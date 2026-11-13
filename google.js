/* গুগল লগিন, ড্রাইভ (গোপন অ্যাপ-ফোল্ডার) আর ক্যালেন্ডারের কাজ */
(function (root) {
  'use strict';
  var U = root.RinUtil, Store = root.RinStore;
  var CFG = root.RIN_CONFIG || {};
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  var FILE_NAME = 'rin-data.json';
  var TZ = CFG.TZ || 'Asia/Dhaka';

  var tok = { value: null, exp: 0 };
  var client = null, pending = null, running = null, again = false;
  var granted = { drive: true, cal: true };
  var status = { state: localStorage.getItem('rin_signed_in') ? 'idle' : 'signedout', msg: '', calMsg: '', last: +(localStorage.getItem('rin_last_sync') || 0) };
  var listeners = [];

  function onStatus(fn) { listeners.push(fn); }
  function setStatus(state, msg) {
    status.state = state; status.msg = msg || '';
    listeners.forEach(function (fn) { try { fn(status); } catch (e) { /* ignore */ } });
  }
  function getStatus() { return status; }
  function configured() { return CFG.CLIENT_ID && CFG.CLIENT_ID.indexOf('YOUR_CLIENT_ID') === -1; }
  function googleReady() { return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2; }

  function initClient() {
    if (client) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: CFG.CLIENT_ID,
      scope: DRIVE_SCOPE + ' ' + CAL_SCOPE,
      callback: function (r) {
        var p = pending; pending = null;
        if (!p) return;
        if (r.error) { p.reject(new Error(r.error)); return; }
        tok.value = r.access_token;
        tok.exp = Date.now() + Math.max(60, (r.expires_in || 3600) - 90) * 1000;
        granted.drive = google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE);
        granted.cal = google.accounts.oauth2.hasGrantedAllScopes(r, CAL_SCOPE);
        localStorage.setItem('rin_signed_in', '1');
        p.resolve(tok.value);
      },
      error_callback: function (e) {
        var p = pending; pending = null;
        if (p) p.reject(new Error(e && e.type ? e.type : 'popup_error'));
      }
    });
  }

  function getToken(interactive) {
    if (tok.value && Date.now() < tok.exp) return Promise.resolve(tok.value);
    if (!configured()) return Promise.reject(new Error('not_configured'));
    if (!googleReady()) return Promise.reject(new Error('google_not_loaded'));
    initClient();
    return new Promise(function (resolve, reject) {
      pending = { resolve: resolve, reject: reject };
      client.requestAccessToken({ prompt: interactive ? 'select_account' : '' });
    });
  }

  function api(url, opts) {
    return getToken(false).then(function (t) {
      opts = opts || {};
      opts.headers = Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {});
      return fetch(url, opts);
    }).then(function (r) {
      if (r.status === 401) { tok.value = null; throw new Error('unauthorized'); }
      if (!r.ok) {
        return r.text().then(function (x) {
          var e = new Error('http_' + r.status + ': ' + x.slice(0, 160));
          e.status = r.status;
          throw e;
        });
      }
      if (r.status === 204) return null;
      return r.text().then(function (x) { return x ? JSON.parse(x) : null; });
    });
  }

  /* ---------- ড্রাইভ ---------- */
  function findFile() {
    var q = encodeURIComponent("name='" + FILE_NAME + "'");
    return api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q +
      '&orderBy=createdTime&fields=files(id,name,modifiedTime)&pageSize=10')
      .then(function (r) { return (r.files && r.files[0]) || null; });
  }
  function download(id) { return api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media'); }
  function upload(id, obj) {
    var body = JSON.stringify(obj);
    if (id) {
      return api('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body
      });
    }
    var b = 'rinboundary' + Date.now();
    var multipart = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
      '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--';
    return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multipart
    });
  }

  function syncDrive() {
    if (!granted.drive) throw new Error('drive_denied');
    return findFile().then(function (f) {
      if (!f) return upload(null, Store.getState());
      return download(f.id).then(function (remote) {
        if (remote && remote.loans) Store.applyMerged(remote);
        return upload(f.id, Store.getState());
      });
    });
  }

  /* ---------- ক্যালেন্ডার ---------- */
  var CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  function loanTexts(loan) {
    var bal = Store.balance(loan);
    var summary = (loan.dir === 'taken' ? 'ঋণ শোধের দিন: ' : 'ঋণ ফেরত পাওয়ার দিন: ') +
      loan.name + ' — ' + U.formatTaka(bal);
    var desc = (loan.dir === 'taken' ? 'আমি দেব: ' : 'আমি পাব: ') + U.formatTaka(bal) +
      (loan.contact ? '\nযোগাযোগ: ' + loan.contact : '') +
      '\nশোধের তারিখ: ' + U.formatDate(loan.dueDate);
    return { summary: summary, description: desc };
  }

  function eventBody(loan) {
    var t = loanTexts(loan);
    var minutes = Math.max(0, Math.min(40320, (loan.remind || 0) * 1440));
    return {
      summary: t.summary, description: t.description,
      start: { dateTime: loan.dueDate + 'T09:00:00', timeZone: TZ },
      end: { dateTime: loan.dueDate + 'T09:30:00', timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: minutes }] },
      extendedProperties: { private: { rinLoanId: loan.id } }
    };
  }

  function deleteEvent(id) {
    return api(CAL + '/' + id, { method: 'DELETE' }).catch(function (e) {
      if (e.status === 404 || e.status === 410) return null;
      throw e;
    });
  }

  function pushLoanEvent(loan) {
    var settled = Store.balance(loan) <= 0;
    if (loan.deleted || settled) {
      if (!loan.eventId) return Promise.resolve(null);
      return deleteEvent(loan.eventId).then(function () { return null; });
    }
    var body = JSON.stringify(eventBody(loan));
    var hdr = { 'Content-Type': 'application/json' };
    if (loan.eventId) {
      return api(CAL + '/' + loan.eventId, { method: 'PATCH', headers: hdr, body: body })
        .then(function (r) { return r.id; })
        .catch(function (e) {
          if (e.status === 404 || e.status === 410) {
            return api(CAL, { method: 'POST', headers: hdr, body: body }).then(function (r) { return r.id; });
          }
          throw e;
        });
    }
    return api(CAL, { method: 'POST', headers: hdr, body: body }).then(function (r) { return r.id; });
  }

  function pushCalendar() {
    if (!granted.cal) { status.calMsg = 'ক্যালেন্ডারের অনুমতি দেওয়া হয়নি'; return Promise.resolve(); }
    var dirty = Store.getState().loans.filter(function (l) { return l.calDirty; });
    status.calMsg = '';
    var chain = Promise.resolve();
    dirty.forEach(function (loan) {
      chain = chain.then(function () {
        return pushLoanEvent(loan).then(function (id) {
          loan.eventId = id || null;
          loan.calDirty = false;
          Store.save(true);
        });
      }).catch(function (e) {
        status.calMsg = 'রিমাইন্ডার সেট হয়নি (' + (e.message || e) + ')';
      });
    });
    Store.getState().duas.filter(function (d) { return d.calDirty; }).forEach(function (dua) {
      chain = chain.then(function () {
        return pushDuaEvents(dua).then(function (ids) {
          dua.eventIds = ids; dua.calDirty = false; Store.save(true);
        });
      }).catch(function (e) {
        status.calMsg = 'দোয়ার রিমাইন্ডার সেট হয়নি (' + (e.message || e) + ')';
      });
    });
    return chain;
  }

  /* দোয়ার রিমাইন্ডার: প্রতিদিন নির্দিষ্ট সময়ে পুনরাবৃত্ত ইভেন্ট (প্রতি সময়ের জন্য একটি) */
  function duaEventBody(dua, time) {
    var hh = time.split(':'), endM = (+hh[0]) * 60 + (+hh[1]) + 10;
    var end = ('0' + Math.floor(endM / 60) % 24).slice(-2) + ':' + ('0' + endM % 60).slice(-2);
    return {
      summary: 'দোয়া: ' + dua.title + ' (' + U.toBn(dua.target) + ' বার)',
      description: (dua.arabic ? dua.arabic + '\n' : '') + (dua.meaning || ''),
      start: { dateTime: U.todayISO() + 'T' + time + ':00', timeZone: TZ },
      end: { dateTime: U.todayISO() + 'T' + end + ':00', timeZone: TZ },
      recurrence: ['RRULE:FREQ=DAILY'],
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      extendedProperties: { private: { rinDuaId: dua.id } }
    };
  }

  function pushDuaEvents(dua) {
    var chain = Promise.resolve();
    (dua.eventIds || []).forEach(function (id) { chain = chain.then(function () { return deleteEvent(id); }); });
    var ids = [];
    if (!dua.deleted) {
      (dua.times || []).forEach(function (t) {
        chain = chain.then(function () {
          return api(CAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(duaEventBody(dua, t)) })
            .then(function (r) { ids.push(r.id); });
        });
      });
    }
    return chain.then(function () { return ids; });
  }

  /* পরীক্ষামূলক রিমাইন্ডার: ৫ মিনিট পরে ক্যালেন্ডারে নোটিফিকেশন আসবে */
  function createTestReminder() {
    var start = new Date(Date.now() + 5 * 60000);
    var end = new Date(start.getTime() + 10 * 60000);
    return api(CAL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: 'আমার ঋণ অ্যাপ: পরীক্ষামূলক রিমাইন্ডার',
        description: 'এই নোটিফিকেশন এলে রিমাইন্ডার ঠিকমতো কাজ করছে। ইভেন্টটি মুছে দিতে পারেন।',
        start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] }
      })
    });
  }

  /* ---------- মোট সিঙ্ক ---------- */
  function classify(e) {
    var m = String((e && e.message) || e);
    if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(m)) return ['offline', 'ইন্টারনেট নেই। ডাটা ফোনে সেভ আছে।'];
    if (m === 'not_configured') return ['error', 'গুগল সেটআপ বাকি (config.js এ Client ID বসাননি)'];
    if (m === 'google_not_loaded') return ['offline', 'গুগলের স্ক্রিপ্ট লোড হয়নি'];
    if (m === 'drive_denied') return ['error', 'ড্রাইভের অনুমতি দেওয়া হয়নি। আবার লগিন করে সব টিক দিন।'];
    if (/popup|access_denied|unauthorized|interaction_required|login_required|immediate_failed/i.test(m)) return ['needlogin', 'আবার লগিন করুন'];
    return ['error', m];
  }

  function syncAll(interactive) {
    if (running) { again = true; return running; }
    setStatus('syncing');
    running = getToken(!!interactive)
      .then(syncDrive)
      .then(pushCalendar)
      .then(function () {
        status.last = Date.now();
        localStorage.setItem('rin_last_sync', String(status.last));
        setStatus('ok');
      })
      .catch(function (e) {
        var c = classify(e);
        setStatus(c[0], c[1]);
      })
      .then(function () {
        running = null;
        if (again) { again = false; syncAll(false); }
      });
    return running;
  }

  function signOut() {
    var t = tok.value;
    tok.value = null; tok.exp = 0;
    localStorage.removeItem('rin_signed_in');
    if (t && googleReady()) { try { google.accounts.oauth2.revoke(t, function () { /* done */ }); } catch (e) { /* ignore */ } }
    setStatus('signedout');
  }

  root.RinGoogle = {
    configured: configured, syncAll: syncAll, signOut: signOut, onStatus: onStatus,
    getStatus: getStatus, createTestReminder: createTestReminder, getToken: getToken
  };
})(window);
