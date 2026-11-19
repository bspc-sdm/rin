/* স্ক্রিন, নেভিগেশন আর ব্যবহারকারীর কাজ — ধাপ ১ (ঋণ, চুক্তিপত্র, সিঙ্ক, রিমাইন্ডার) */
(function () {
  'use strict';
  var U = RinUtil, S = RinStore, C = RinContract, G = RinGoogle;
  var h = U.escapeHtml, bn = U.toBn;

  S.setStorage(window.localStorage);
  S.load();

  var root = document.getElementById('app');
  var BUILD = 'rin-v16';
  var ui = { dir: localStorage.getItem('rin_dir') === 'given' ? 'given' : 'taken' };
  var current = { key: null, name: 'home', p: [] };
  var draft = null;
  var installPrompt = null;
  var busy = false;

  /* ---------- আইকন ---------- */
  var IC = {
    back: '<path d="M15 5l-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    bell: '<path d="M6 17V11a6 6 0 1112 0v6l2 2H4zM10 21h4"/>',
    file: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>', chev: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', download: '<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 14v5h14v-5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    book: '<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>', minus: '<path d="M5 12h14"/>'
  };
  function ic(name, size, color, w) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') +
      '" stroke-width="' + (w || 2.2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }


  /* ---------- অ্যাপের ভেতর থেকে আপডেট ---------- */
  function checkUpdate(manual) {
    return fetch('sw.js', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/CACHE = '([^']+)'/);
      ui.update = !!(m && m[1] !== BUILD);
      if (manual) toast(ui.update ? 'নতুন সংস্করণ পাওয়া গেছে' : 'আপনার অ্যাপ সর্বশেষ সংস্করণে আছে');
      if (current.name === 'home') vHome(); else if (current.name === 'settings') vSettings();
    }).catch(function () { if (manual) toast('এখন চেক করা গেল না, ইন্টারনেট দেখুন'); });
  }
  function doUpdate() {
    toast('আপডেট হচ্ছে…');
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
  }
  function updateBanner() {
    return ui.update ? '<button class="btn" data-act="do-update" style="margin-bottom:4px">⬆ নতুন সংস্করণ এসেছে — এখানে চেপে আপডেট করুন</button>' : '';
  }

  /* ---------- ফোনের কন্টাক্ট থেকে বাছাই (Chrome/Android) ---------- */
  function pickContact(cb) {
    if (!(navigator.contacts && navigator.contacts.select)) { toast('এই ব্রাউজারে কন্টাক্ট বাছাই চলে না। Android-এর Chrome-এ খুলুন, বা নম্বর হাতে লিখুন'); return; }
    navigator.contacts.select(['name', 'tel'], { multiple: false }).then(function (list) {
      if (!list || !list[0]) return;
      cb(((list[0].name || [])[0] || '').trim(), ((list[0].tel || [])[0] || '').trim());
    }).catch(function () { toast('কন্টাক্ট খোলা গেল না। অনুমতি দিন বা নম্বর হাতে লিখুন'); });
  }
  function pickBtn(target) {
    return '<button type="button" class="linkbtn" data-act="pick-contact" data-arg="' + target + '">📇 কন্টাক্ট থেকে বাছুন</button>';
  }

  /* ---------- ছোট সাহায্যকারী ---------- */
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }
  function sheet(title, text, okLabel, onOk, danger) {
    var o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><h3>' + h(title) + '</h3><p>' + h(text) + '</p>' +
      '<div class="acts"><button class="btn outline small" data-x="no" style="flex:1">না</button>' +
      '<button class="btn small' + (danger ? ' danger' : '') + '" data-x="ok" style="flex:1">' + h(okLabel) + '</button></div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) {
      var x = e.target.getAttribute && e.target.getAttribute('data-x');
      if (e.target === o || x === 'no') o.remove();
      else if (x === 'ok') { o.remove(); onOk(); }
    });
  }
  function render(html) { root.innerHTML = html; enhanceSelects(); }
  /* ফোনের কালো সিস্টেম-সিলেক্টের বদলে অ্যাপের নিজের ডিজাইনের বাছাই-তালিকা */
  function enhanceSelects() {
    Array.prototype.forEach.call(root.querySelectorAll('select'), function (sel) {
      if (sel.getAttribute('data-enh')) return;
      sel.setAttribute('data-enh', '1'); sel.style.display = 'none';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'selbtn';
      function label() { var o = sel.options[sel.selectedIndex]; return o ? o.text : ''; }
      b.innerHTML = '<span>' + h(label()) + '</span>' + ic('chev', 18, '#5B635E', 2.4).replace('<svg ', '<svg style="transform:rotate(90deg);flex-shrink:0" ');
      b.addEventListener('click', function () { openPicker(sel, b, label); });
      sel.parentNode.insertBefore(b, sel.nextSibling);
    });
  }
  function openPicker(sel, b, label) {
    var lab = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    var title = lab ? lab.textContent : (sel.getAttribute('aria-label') || 'বাছুন');
    var o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><h3>' + h(title) + '</h3><div class="opts">' +
      Array.prototype.map.call(sel.options, function (op, i) {
        var on = i === sel.selectedIndex;
        return '<button type="button" class="opt' + (on ? ' on' : '') + '" data-i="' + i + '"><span>' + h(op.text) + '</span>' + (on ? ic('check', 18, '#1F5C4A', 3) : '') + '</button>';
      }).join('') + '</div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-i]') : null;
      if (e.target === o) { o.remove(); return; }
      if (!t) return;
      sel.selectedIndex = +t.getAttribute('data-i');
      var sp = b.querySelector('span'); if (sp) sp.textContent = label();
      o.remove();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function isOpenLoan(l) { return S.balance(l) > 0; }
  function byDue(a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; }
  /* লেখার ভেতর থেকে মোবাইল নম্বর খুঁজে বের করা (যেমন "রহিম, ০১৭১১-২২৩৩৪৪, কুমিল্লা") */
  function phoneOf(c) {
    var t = U.fromBn(c || '').replace(/(\d)[\s\-](?=\d)/g, '$1');
    var m = t.match(/(?:\+?88)?01[3-9]\d{8}/) || t.match(/\+?\d{6,15}/);
    return m ? m[0] : null;
  }
  function telHref(c) { var n = phoneOf(c); return n ? 'tel:' + n : null; }
  function dirWords(dir) {
    return dir === 'taken'
      ? { person: 'যার কাছ থেকে নিলাম (নাম)', add: 'আবার নিলাম', pay: 'টাকা দিলাম', addTx: 'ঋণ নিলাম', payTx: 'শোধ দিলাম',
          payFull: 'পুরো শোধ দিলাম', hero: 'এখন পাওনা (আমি দেব)', total: 'মোট পাওনা (আমি দেব)', list: 'পাওনাদার' }
      : { person: 'যাকে দিলাম (নাম)', add: 'আবার দিলাম', pay: 'টাকা ফেরত পেলাম', addTx: 'ঋণ দিলাম', payTx: 'ফেরত পেলাম',
          payFull: 'পুরো ফেরত পেলাম', hero: 'এখন পাব (আমি পাব)', total: 'মোট পাব (আমি পাব)', list: 'দেনাদার' };
  }
  function chipFor(st) {
    if (st.kind === 'settled') return { cls: 't-gray', text: 'শোধ হয়েছে', av: 't-gray' };
    if (st.kind === 'overdue') return { cls: 't-red', text: bn(st.days) + ' দিন মেয়াদ পার', av: 't-red' };
    if (st.kind === 'today') return { cls: 't-amber', text: 'আজই শোধের দিন', av: 't-amber' };
    if (st.kind === 'soon') return { cls: 't-amber', text: bn(st.days) + ' দিন বাকি', av: 't-amber' };
    return { cls: 't-green', text: bn(st.days) + ' দিন বাকি', av: 't-green' };
  }
  function remindText(r) { return r === 0 ? 'শোধের দিন সকাল ৯টায়' : bn(r) + ' দিন আগে সকাল ৯টায়'; }

  /* ---------- সিঙ্ক অবস্থার বোতাম ---------- */
  function chipHtml() {
    var st = G.getStatus().state, cls = 'sync', text = '', icon = '';
    if (!G.configured()) { cls += ' warn'; text = 'গুগল সেটআপ বাকি'; }
    else if (st === 'signedout') { cls += ' gray'; text = 'লগিন করুন'; }
    else if (st === 'syncing') { cls += ' gray'; text = 'সিঙ্ক হচ্ছে…'; }
    else if (st === 'ok') { text = 'ড্রাইভে সেভ'; icon = ic('check', 16, 'currentColor', 2.6); }
    else if (st === 'offline') { cls += ' warn'; text = 'অফলাইন'; }
    else if (st === 'needlogin') { cls += ' warn'; text = 'আবার লগিন দরকার'; }
    else if (st === 'error') { cls += ' bad'; text = 'সিঙ্ক হয়নি'; }
    else { cls += ' gray'; text = 'সিঙ্ক বাকি'; }
    return '<button class="' + cls + '" id="syncchip" data-act="chip">' + icon + '<span>' + h(text) + '</span></button>';
  }
  function refreshChip() {
    var c = document.getElementById('syncchip');
    if (c) c.outerHTML = chipHtml();
  }

  /* ---------- নিচের মেনু ---------- */
  function nav(active) {
    function tab(key, label, icon, href, soon) {
      return '<a href="' + (soon ? '#' : href) + '" class="' + (active === key ? 'active' : '') + (soon ? ' soon' : '') + '"' +
        (soon ? ' data-act="soon"' : '') + '>' + ic(icon, 24, 'currentColor', 2) + '<span>' + label + '</span></a>';
    }
    return '<nav class="nav" aria-label="প্রধান মেনু">' + tab('home', 'ঋণ', 'wallet', '#/') +
      tab('money', 'আয়-ব্যয়', 'chart', '#/money') + tab('dua', 'দোয়া', 'book', '#/dua') +
      tab('settings', 'সেটিং', 'gear', '#/settings') + '</nav>';
  }

  /* ---------- হোম ---------- */
  function loanItem(l, today) {
    var st = S.status(l, today), c = chipFor(st), w = dirWords(l.dir);
    var bal = S.balance(l);
    var sub = st.kind === 'settled' ? 'সব শোধ হয়েছে' : 'শোধের তারিখ ' + U.formatDate(l.dueDate);
    return '<a class="item" href="#/loan/' + h(l.id) + '"><div class="avatar ' + c.av + '">' + h((l.name || '?').trim().charAt(0)) + '</div>' +
      '<div class="mid"><b>' + h(l.name) + '</b><small>' + h(sub) + '</small></div>' +
      '<div class="end"><b>' + U.formatTaka(st.kind === 'settled' ? 0 : bal) + '</b><span class="chip ' + c.cls + '">' + h(c.text) + '</span></div></a>';
  }

  function vHome() {
    var today = U.todayISO(), dir = ui.dir, w = dirWords(dir), sum = S.summary(dir, today);
    var all = S.liveLoans(dir);
    var open = all.filter(isOpenLoan).sort(byDue);
    var settled = all.filter(function (l) { return !isOpenLoan(l); })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 8);
    var html = '<div class="screen">' +
      '<div class="top"><div><span class="sub">আসসালামু আলাইকুম</span><h1>আমার ঋণ</h1></div>' + chipHtml() + '</div>' + updateBanner() +
      '<div class="hero"><div><div class="lbl">' + w.total + '</div><div class="big">' + U.formatTaka(sum.total) + '</div></div>' +
      '<div class="grid2"><div class="mini"><span>মেয়াদ পার</span><b>' + U.formatTaka(sum.overdue) + '</b></div>' +
      '<div class="mini"><span>আগামী ৭ দিনে</span><b>' + U.formatTaka(sum.next7) + '</b></div></div></div>' +
      '<div class="seg c2" role="tablist"><button data-act="dir" data-arg="taken" class="' + (dir === 'taken' ? 'active' : '') + '">আমি দেব</button>' +
      '<button data-act="dir" data-arg="given" class="' + (dir === 'given' ? 'active' : '') + '">আমি পাব</button></div>' +
      '<a class="linkcard" href="#/parties">' + ic('phone', 24, '#1F5C4A', 2) + '<div class="mid"><b>পাওনাদার ও দেনাদার তালিকা</b><small>একই মানুষের সব ঋণ একসাথে, মোট সহ</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>' +
      '<a class="linkcard" href="#/schedule">' + ic('cal', 24, '#1F5C4A', 2) + '<div class="mid"><b>পরিশোধের সূচি</b><small>মাসওয়ারি কত যাবে, এক নজরে</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>' +
      '<div class="sec-h"><h2>চলমান ঋণ (' + bn(open.length) + 'টি)</h2><span>শোধের তারিখ অনুযায়ী</span></div>';
    if (!open.length) {
      html += '<div class="empty">' + (dir === 'taken' ? 'কোনো ঋণ বাকি নেই। নতুন ঋণ লিখতে নিচের বাটন চাপুন।' : 'কাউকে ঋণ দেওয়া নেই। দিলে নিচের বাটন চেপে লিখে রাখুন।') + '</div>';
    } else html += open.map(function (l) { return loanItem(l, today); }).join('');
    if (settled.length) {
      html += '<div class="sec-h"><h2>শোধ হয়েছে (' + bn(settled.length) + ')</h2></div>' + settled.map(function (l) { return loanItem(l, today); }).join('');
    }
    html += '</div><a class="fab" href="#/add">' + ic('plus', 20, '#fff', 2.6) + '<span>নতুন ঋণ</span></a>' + nav('home');
    render(html);
  }

  /* ---------- নতুন ঋণ / সম্পাদনা ---------- */
  function collectLoan() {
    ['name', 'contact', 'amount', 'date', 'due', 'monthly', 'first'].forEach(function (k) {
      var e = document.getElementById('f-' + k);
      if (e) draft[k] = e.value;
    });
  }
  function errHtml(k) { return draft.errors && draft.errors[k] ? '<span class="err">' + h(draft.errors[k]) + '</span>' : ''; }

  function planPreview(total, m, first) {
    if (!(m > 0) || isNaN(m)) return 'মাসে কত দেবেন লিখুন। কত মাস লাগবে তা নিজে থেকে হিসাব হবে।';
    if (!(total > 0) || isNaN(total)) return 'আগে ঋণের টাকার পরিমাণ লিখুন।';
    if (m >= total) return 'পুরোটাই একবারে শোধ হবে, আলাদা কিস্তি লাগবে না।';
    var n = Math.ceil(total / m), last = U.addMonths(first || U.todayISO(), n - 1);
    return bn(n) + ' মাস লাগবে • শেষ কিস্তি ' + monthLabel(last.slice(0, 7)) + ' (' + U.formatTaka(total - m * (n - 1)) + ')';
  }
  function vLoanForm(editId) {
    var loan = editId ? S.getLoan(editId) : null;
    if (editId && !loan) { go('#/'); return; }
    if (!draft) {
      var t = U.todayISO();
      draft = loan
        ? { dir: loan.dir, name: loan.name, contact: loan.contact, due: loan.dueDate, mode: loan.mode, remind: loan.remind, monthly: loan.plan ? String(S.planMonthly(loan.plan) / 100) : '', first: loan.plan ? loan.plan.first : U.addMonths(t, 1) }
        : { dir: ui.dir, name: '', contact: '', amount: '', date: t, due: U.addMonths(t, 1), mode: 'full', remind: 1, contract: true, monthly: '', first: U.addMonths(t, 1) };
    }
    var w = dirWords(draft.dir);
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="' + (loan ? '#/loan/' + h(loan.id) : '#/') + '" aria-label="ফিরে যান">' + ic('back') + '</a>' +
      '<h1>' + (loan ? 'ঋণ সম্পাদনা' : 'নতুন ঋণ') + '</h1></div>';
    if (!loan) {
      html += '<div class="seg c2"><button data-act="form-dir" data-arg="taken" class="' + (draft.dir === 'taken' ? 'active' : '') + '">ঋণ নিলাম</button>' +
        '<button data-act="form-dir" data-arg="given" class="' + (draft.dir === 'given' ? 'active' : '') + '">ঋণ দিলাম</button></div>';
    }
    html += '<div class="field"><label for="f-name">' + w.person + '</label><input type="text" id="f-name" list="dl-people" value="' + h(draft.name) + '" autocomplete="off">' + errHtml('name') + '<datalist id="dl-people">' + S.peopleList(false).map(function (x) { return '<option value="' + h(x.name) + '"></option>'; }).join('') + '</datalist></div>' +
      '<div class="field"><label for="f-contact">মোবাইল নম্বর (কল দেওয়ার জন্য) ও ঠিকানা</label><input type="text" id="f-contact" inputmode="tel" value="' + h(draft.contact) + '" placeholder="০১৭XXXXXXXX" autocomplete="off">' + pickBtn('loan') + '</div>';
    if (!loan) {
      html += '<div class="field"><label for="f-amount">টাকার পরিমাণ</label><input type="text" inputmode="decimal" class="amount" id="f-amount" value="' + h(draft.amount) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('amount') + '</div>' +
        '<div class="row2"><div class="field"><label for="f-date">ঋণের তারিখ</label><input type="date" id="f-date" value="' + h(draft.date) + '"></div>' +
        (draft.mode === 'full' ? '<div class="field"><label for="f-due">শোধের তারিখ</label><input type="date" id="f-due" value="' + h(draft.due) + '"></div>' : '') + '</div>';
    } else if (draft.mode === 'full') {
      html += '<div class="field"><label for="f-due">শোধের তারিখ</label><input type="date" id="f-due" value="' + h(draft.due) + '"></div>';
    }
    html += errHtml('due') +
      '<div class="field"><span class="lbl">শোধের ধরন</span><div class="seg c2"><button data-act="form-mode" data-arg="full" class="' + (draft.mode === 'full' ? 'active' : '') + '">একবারে পুরো</button>' +
      '<button data-act="form-mode" data-arg="partial" class="' + (draft.mode === 'partial' ? 'active' : '') + '">কিস্তিতে (আংশিক)</button></div></div>' +
      (draft.mode === 'partial' ? '<div class="field"><label for="f-monthly">মাসে কত টাকা ' + (draft.dir === 'taken' ? 'দেবেন' : 'পাবেন') + '</label><input type="text" inputmode="decimal" class="amount" id="f-monthly" value="' + h(draft.monthly) + '" placeholder="৳ ০" autocomplete="off"></div>' +
        '<div class="field"><label for="f-first">প্রথম কিস্তির তারিখ</label><input type="date" id="f-first" value="' + h(draft.first) + '"></div>' + errHtml('n') +
        '<div class="note-box" id="plan-prev">' + h(planPreview(loan ? S.balance(loan) : U.parseAmount(draft.amount), U.parseAmount(draft.monthly), draft.first)) + '</div>' : '') +
      '<div class="field"><span class="lbl">রিমাইন্ডার (গুগল ক্যালেন্ডারে)</span><div class="pills">' +
      [[1, '১ দিন আগে'], [3, '৩ দিন আগে'], [0, 'শোধের দিন']].map(function (r) {
        return '<button class="pill ' + (draft.remind === r[0] ? 'active' : '') + '" data-act="form-remind" data-arg="' + r[0] + '">' + r[1] + '</button>';
      }).join('') + '</div></div>';
    if (!loan) {
      html += '<button class="check ' + (draft.contract ? 'on' : '') + '" data-act="form-contract" aria-pressed="' + !!draft.contract + '"><span class="box">' +
        (draft.contract ? ic('check', 16, '#fff', 3) : '') + '</span><span class="t">চুক্তিপত্র লিখব (পরের ধাপে)</span></button>';
    }
    html += '</div><div class="bottom-bar"><button class="btn" data-act="save-loan" data-arg="' + (loan ? h(loan.id) : '') + '">' +
      (loan ? 'সেভ করুন' : (draft.contract ? 'পরের ধাপ: চুক্তিপত্র' : 'সেভ করুন')) + '</button></div>';
    render(html);
  }

  function saveLoan(editId) {
    collectLoan();
    var errors = {}, amount = null;
    if (!draft.name.trim()) errors.name = 'নাম লিখুন';
    if (draft.mode === 'full' && !draft.due) errors.due = 'শোধের তারিখ দিন';
    if (draft.mode === 'partial' && !draft.due) draft.due = draft.first || U.addMonths(U.todayISO(), 1);
    if (!editId) {
      amount = U.parseAmount(draft.amount);
      if (isNaN(amount) || amount <= 0) errors.amount = 'সঠিক টাকার পরিমাণ লিখুন';
      if (draft.mode === 'full' && draft.due && draft.date && draft.due < draft.date) errors.due = 'শোধের তারিখ ঋণের তারিখের আগে হতে পারে না';
      if (!draft.date) errors.date = 'ঋণের তারিখ দিন';
    }
    var totalNow = editId ? S.balance(S.getLoan(editId)) : amount;
    var pm = draft.mode === 'partial' && String(draft.monthly || '').trim() ? U.parseAmount(draft.monthly) : null;
    var wantPlan = pm != null && pm > 0 && pm < totalNow;
    if (draft.mode === 'partial' && pm == null) errors.n = 'মাসে কত টাকা দেবেন তা লিখুন, তাহলে শোধের তারিখ নিজেই বসে যাবে';
    else if (draft.mode === 'partial' && !isNaN(pm) && pm >= totalNow) errors.n = 'মাসিক টাকা মোট টাকার চেয়ে কম হতে হবে';
    else if (pm != null && (isNaN(pm) || pm <= 0)) errors.n = 'মাসিক টাকার সঠিক অঙ্ক লিখুন';
    else if (wantPlan && Math.ceil(totalNow / pm) > 120) errors.n = 'মাস ১২০-এর বেশি হয়ে যাচ্ছে, মাসিক অঙ্ক বাড়ান';
    else if (wantPlan && !draft.first) errors.n = 'প্রথম কিস্তির তারিখ দিন';
    if (Object.keys(errors).length) { draft.errors = errors; vLoanForm(editId); window.scrollTo(0, 0); return; }
    if (editId) {
      S.rememberPerson({ name: draft.name, contact: draft.contact });
      S.updateLoan(editId, { name: draft.name.trim(), contact: draft.contact.trim(), dueDate: draft.due, mode: draft.mode, remind: draft.remind });
      var cur = S.getLoan(editId);
      if (wantPlan) { if (!cur.plan || S.planMonthly(cur.plan) !== pm || cur.plan.first !== draft.first) S.setMonthlyPlan(editId, pm, draft.first, !!cur.plan); }
      else if (cur.plan) S.setMonthlyPlan(editId, 0);
      afterChange(); toast('বদল সেভ হয়েছে'); go('#/loan/' + editId); return;
    }
    S.rememberPerson({ name: draft.name, contact: draft.contact });
    var loan = S.createLoan({ name: draft.name.trim(), contact: draft.contact.trim(), dir: draft.dir, amount: amount, date: draft.date, dueDate: draft.due, mode: draft.mode, remind: draft.remind });
    if (wantPlan) S.setMonthlyPlan(loan.id, pm, draft.first, false);
    ui.dir = draft.dir; localStorage.setItem('rin_dir', ui.dir);
    var wantContract = draft.contract;
    afterChange();
    if (G.getStatus().state === 'signedout') toast('রিমাইন্ডার চালু করতে সেটিং থেকে গুগল লগিন করুন');
    go(wantContract ? '#/contract/' + loan.id + '/edit' : '#/loan/' + loan.id);
  }

  /* ---------- ঋণের হিসাব ---------- */
  function txLabel(l, t) {
    var w = dirWords(l.dir);
    if (t.kind === 'add') return w.addTx;
    if (t.kind === 'waive') return l.dir === 'given' ? 'মওকুফ করলাম' : 'মওকুফ পেলাম';
    return t.full ? w.payFull : w.payTx;
  }

  function vLoan(id) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    var today = U.todayISO(), bal = S.balance(l), st = S.status(l, today), c = chipFor(st), w = dirWords(l.dir);
    var phone = telHref(l.contact);
    var txs = S.liveTxs(l).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0); });
    var calLine = bal <= 0 ? 'শোধ হয়ে গেছে, রিমাইন্ডার বন্ধ' :
      (l.eventId ? 'ক্যালেন্ডারে রিমাইন্ডার সেট আছে' : 'ক্যালেন্ডারে এখনো সেট হয়নি (লগিন/সিঙ্ক বাকি)');
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + h(l.name) + '</h1>' +
      '<a class="icon-btn" href="#/edit/' + h(l.id) + '" aria-label="সম্পাদনা">' + ic('edit', 20) + '</a></div>' +
      '<div class="hero"><div><div class="lbl">' + w.hero + '</div><div class="big">' + U.formatTaka(bal) + '</div></div><div class="meta">' +
      (l.contact ? '<div>' + ic('phone', 18, '#fff', 2) + (phone ? '<a href="' + h(phone) + '">' + h(l.contact) + '</a>' : '<span>' + h(l.contact) + '</span>') + '</div>' : '') +
      '<div>' + ic('cal', 18, '#fff', 2) + '<span>শোধের তারিখ ' + U.formatDate(l.dueDate) + ' • ' + (l.mode === 'full' ? 'একবারে পুরো' : 'কিস্তিতে') + '</span></div>' +
      '<div>' + ic('bell', 18, '#fff', 2) + '<span>' + h(bal <= 0 ? calLine : remindText(l.remind) + ' • ' + calLine) + '</span></div></div></div>';
    if (st.kind !== 'settled') html += '<div><span class="chip ' + c.cls + '">' + h(c.text) + '</span></div>';
    html += phone
      ? '<div class="calllbl">' + (l.dir === 'taken' ? 'পাওনাদারকে কল করুন' : 'দেনাদারকে কল করুন') + '</div><a class="callrow" href="' + h(phone) + '" aria-label="কল করুন"><span>' + h(U.toBn(phone.slice(4))) + '</span>' + ic('phone', 22, '#1F5C4A', 2.2) + '</a>'
      : '<a class="btn outline small" href="#/edit/' + h(l.id) + '">' + ic('phone', 18, 'currentColor', 2.2) + ' কল দিতে মোবাইল নম্বর যোগ করুন</a>';
    html += l.contract
      ? '<a class="linkcard" href="#/contract/' + h(l.id) + '">' + ic('file', 24, '#1F5C4A', 2) + '<div class="mid"><b>ঋণ চুক্তিপত্র</b><small>' + U.formatDate(l.contract.date) + (l.contract.w1 || l.contract.w2 ? ' • সাক্ষী আছে' : '') + '</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>'
      : '<a class="linkcard" href="#/contract/' + h(l.id) + '/edit">' + ic('file', 24, '#1F5C4A', 2) + '<div class="mid"><b>চুক্তিপত্র লিখুন</b><small>তারিখ, টাকা, মেয়াদ ও সাক্ষীসহ</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>';
    if (l.plan && bal > 0) {
      var ri = S.remainingInstallments(l), nx = ri[0];
      html += '<a class="linkcard" href="#/schedule">' + ic('cal', 24, '#1F5C4A', 2) + '<div class="mid"><b>মাসে ' + U.formatTaka(S.planMonthly(l.plan)) + ' • ' + bn(l.plan.n) + ' মাস' + (nx ? ' • পরের কিস্তি ' + U.formatTaka(nx.amount) : '') + '</b><small>' + (nx ? U.formatDate(nx.date) + ' • ' : '') + 'বাকি ' + bn(ri.length) + 'টি কিস্তি</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>' +
        '<a class="btn outline small" href="#/plan/' + h(l.id) + '">মাসিক কিস্তি কমান / বাড়ান</a>';
    }
    var shNote = l.share ? ((l.share.peer ? h(l.share.peer) + '-এর সাথে শেয়ার করা' : 'শেয়ার করা হয়েছে') + ((l.updatedAt || 0) > (l.share.sentAt || 0) + 1000 ? ' • নতুন পরিবর্তন পাঠানো হয়নি' : ' • সব পাঠানো আছে')) : 'অপর পক্ষও একই হিসাব দেখতে পাবে';
    html += '<a class="linkcard" href="#/share/' + h(l.id) + '">' + ic('share', 24, '#1F5C4A', 2) + '<div class="mid"><b>' + (l.share ? 'শেয়ার করা হিসাব' : 'অপর পক্ষের সাথে শেয়ার করুন') + '</b><small>' + shNote + '</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>';
    html += '<a class="linkcard" href="#/log/' + h(l.id) + '">' + ic('edit', 24, '#1F5C4A', 2) + '<div class="mid"><b>এডিট হিস্টোরি</b><small>' + bn((l.log || []).length) + 'টি পরিবর্তন লেখা আছে</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>';
    html += '<div class="sec-h"><h2>লেনদেনের ইতিহাস</h2></div>';
    html += txs.map(function (t) {
      var add = t.kind === 'add';
      return '<div class="tx"><div class="ic ' + (add ? 't-red' : 't-green') + '">' + ic(add ? 'plus' : 'back', 18, 'currentColor', 2.6).replace('<path d="M15 5l-7 7 7 7"/>', '<path d="M5 12h14"/>') + '</div>' +
        '<div class="mid"><b>' + h(txLabel(l, t)) + '</b><small>' + U.formatDate(t.date) + (t.note && t.note !== 'প্রথম ঋণ' && t.note !== 'প্রথম ঋণ দিলাম' ? ' • ' + h(t.note) : '') + '</small></div>' +
        '<span class="amt" style="color:' + (add ? '#8C1D18' : '#16453A') + '">' + (add ? '+ ' : '− ') + U.formatTaka(t.amount) + '</span>' +
        '<button class="x" data-act="del-tx" data-arg="' + h(t.id) + '" aria-label="এই লেনদেন মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button></div>';
    }).join('');
    if (l.dir === 'given' && bal > 0) html += '<a class="btn outline small" style="margin-top:8px" href="#/waive/' + h(l.id) + '">এই ঋণ মওকুফ করুন</a>';
    html += '<button class="btn danger small" style="margin-top:8px" data-act="del-loan" data-arg="' + h(l.id) + '">এই ঋণের হিসাব মুছুন</button></div>' +
      '<div class="bottom-bar"><a class="btn outline" href="#/tx/' + h(l.id) + '/add">' + w.add + '</a>' +
      (bal > 0 ? '<a class="btn" href="#/tx/' + h(l.id) + '/pay">' + w.pay + '</a>' : '') + '</div>';
    render(html);
  }

  /* ---------- পরিশোধ / আবার ঋণ ---------- */
  function collectTx() {
    ['amount', 'date', 'note', 'due'].forEach(function (k) {
      var e = document.getElementById('f-' + k);
      if (e) draft[k] = e.value;
    });
  }
  function vTx(id, kind) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    var bal = S.balance(l), w = dirWords(l.dir);
    if (kind === 'pay' && bal <= 0) kind = 'add';
    if (!draft) draft = { kind: kind, full: false, amount: '', date: U.todayISO(), note: '', due: l.dueDate };
    var isPay = draft.kind === 'pay';
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a>' +
      '<div><h1 style="font-size:22px">নতুন লেনদেন</h1><span class="sub" style="font-size:14px;color:#5B635E">' + h(l.name) + ' • বাকি ' + U.formatTaka(bal) + '</span></div></div>' +
      '<div class="seg c2"><button data-act="tx-kind" data-arg="pay" class="' + (isPay ? 'active' : '') + '"' + (bal <= 0 ? ' disabled' : '') + '>' + w.pay + (l.dir === 'taken' ? ' (কমবে)' : ' (কমবে)') + '</button>' +
      '<button data-act="tx-kind" data-arg="add" class="' + (!isPay ? 'active red' : '') + '">' + w.add + ' (বাড়বে)</button></div>' +
      '<div class="field"><label for="f-amount">কত টাকা</label><input type="text" inputmode="decimal" class="amount ' + (isPay ? '' : 'red') + '" id="f-amount" value="' +
      h(draft.full ? U.formatTaka(bal, false).replace(/,/g, '') : draft.amount) + '"' + (draft.full ? ' readonly' : '') + ' placeholder="৳ ০" autocomplete="off">' + errHtml('amount');
    if (isPay) {
      html += '<div class="pills" style="margin-top:4px"><button class="pill ' + (draft.full ? 'active' : '') + '" data-act="tx-full">পুরোটা ' + U.formatTaka(bal) + '</button></div>';
    }
    html += '</div>';
    if (isPay) {
      html += '<div class="field"><span class="lbl">শোধের ধরন</span><div class="seg c2"><button data-act="tx-full-set" data-arg="1" class="' + (draft.full ? 'active' : '') + '">ফুল শোধ</button>' +
        '<button data-act="tx-full-set" data-arg="0" class="' + (!draft.full ? 'active' : '') + '">আংশিক শোধ</button></div></div>';
    }
    html += '<div class="field"><label for="f-date">তারিখ</label><input type="date" id="f-date" value="' + h(draft.date) + '"></div>' +
      '<div class="field" id="due-wrap"><label for="f-due">বাকিটা কবে ' + (l.dir === 'taken' ? 'দেবেন' : 'পাবেন') + ' (নতুন রিমাইন্ডার)</label><input type="date" id="f-due" value="' + h(draft.due) + '">' + errHtml('due') + '</div>' +
      '<div class="field"><label for="f-note">নোট (ঐচ্ছিক)</label><input type="text" id="f-note" value="' + h(draft.note) + '" autocomplete="off"></div>' +
      '<div class="preview"><span>সেভের পর বাকি থাকবে</span><b id="pv">' + U.formatTaka(bal) + '</b></div></div>' +
      '<div class="bottom-bar"><button class="btn" data-act="save-tx" data-arg="' + h(id) + '">সেভ করুন</button></div>';
    render(html);
    updateTxPreview();
  }
  function updateTxPreview() {
    if (current.name !== 'tx' || !draft) return;
    var l = S.getLoan(current.p[1]);
    if (!l) return;
    var bal = S.balance(l), a = U.parseAmount((document.getElementById('f-amount') || {}).value || '');
    if (isNaN(a)) a = 0;
    var after = draft.kind === 'pay' ? bal - a : bal + a;
    var pv = document.getElementById('pv');
    if (pv) pv.textContent = U.formatTaka(Math.max(0, after));
    var wrap = document.getElementById('due-wrap');
    if (wrap) wrap.classList.toggle('hidden', after <= 0);
  }
  function saveTx(id) {
    collectTx();
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    var bal = S.balance(l), errors = {};
    var a = draft.full ? bal : U.parseAmount(draft.amount);
    if (isNaN(a) || a <= 0) errors.amount = 'সঠিক টাকার পরিমাণ লিখুন';
    else if (draft.kind === 'pay' && a > bal) errors.amount = 'বাকির (' + U.formatTaka(bal) + ') চেয়ে বেশি হতে পারে না';
    if (!draft.date) errors.date = 'তারিখ দিন';
    var after = draft.kind === 'pay' ? bal - (a || 0) : bal + (a || 0);
    if (after > 0 && (!draft.due || draft.due < draft.date)) errors.due = 'শোধের তারিখ ঠিক করুন (লেনদেনের তারিখের আগে হবে না)';
    if (Object.keys(errors).length) { draft.errors = errors; vTx(id, draft.kind); return; }
    S.addTx(id, { kind: draft.kind, amount: a, date: draft.date, note: draft.note.trim(), full: draft.kind === 'pay' && (draft.full || a === bal), dueDate: after > 0 ? draft.due : undefined });
    afterChange();
    toast(after <= 0 ? 'পুরো শোধ হয়ে গেছে, রিমাইন্ডার বন্ধ হবে' : 'সেভ হয়েছে');
    go('#/loan/' + id);
  }

  /* ---------- চুক্তিপত্র ---------- */
  function firstAdd(l) {
    var adds = S.liveTxs(l).filter(function (t) { return t.kind === 'add'; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0); });
    return adds[0] || null;
  }
  function selectHtml(id, options, value) {
    return '<select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + h(o) + '"' + (o === value ? ' selected' : '') + '>' + h(o) + '</option>';
    }).join('') + '</select>';
  }
  function vContractForm(id) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    var fa = firstAdd(l);
    if (!fa) { go('#/loan/' + id); return; }
    if (!draft) {
      var c = l.contract || {};
      var pp = S.findPerson(l.name, false) || {};
      draft = { myInfo: c.myInfo || S.getProfile(), myPhone: c.myPhone || S.getProfilePhone(), otherInfo: c.otherInfo || pp.addr || '', medium: c.medium || C.MEDIUMS[0], interest: c.interest || C.INTERESTS[0], w1: c.w1 || '', w2: c.w2 || '', extra: c.extra || '' };
    }
    var lender = l.dir === 'taken' ? l.name : 'আমি', borrower = l.dir === 'taken' ? 'আমি' : l.name;
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a>' +
      '<div><h1 style="font-size:22px">চুক্তিপত্র লিখুন</h1><span style="font-size:13px;color:#5B635E">ধাপ ২ / ২</span></div></div>' +
      '<div class="hero" style="padding:14px 16px;gap:4px;font-size:14px;line-height:1.6"><span style="font-size:12px">ঋণের তথ্য থেকে নেওয়া</span>' +
      '<b>ঋণদাতা ' + h(lender) + ' → ঋণগ্রহীতা ' + h(borrower) + '</b><span>' + U.formatTaka(fa.amount) + ' (' + h(U.takaInWords(fa.amount)) + ')</span>' +
      '<span>ঋণের তারিখ ' + U.formatDate(fa.date) + ' • শোধ ' + U.formatDate(l.dueDate) + ' (' + U.termText(fa.date, l.dueDate) + ')</span></div>' +
      '<div class="field"><label for="c-my">আমার নাম ও ঠিকানা</label><input type="text" id="c-my" value="' + h(draft.myInfo) + '" placeholder="নাম, গ্রাম/এলাকা, জেলা" autocomplete="off"></div>' +
      '<div class="field"><label for="c-phone">আমার মোবাইল নম্বর</label><input type="text" id="c-phone" inputmode="tel" value="' + h(draft.myPhone) + '" placeholder="০১৭XXXXXXXX" autocomplete="off">' + pickBtn('cphone') + '</div>' +
      '<div class="field"><label for="c-other">অপর পক্ষের ঠিকানা (ঐচ্ছিক)</label><input type="text" id="c-other" value="' + h(draft.otherInfo) + '" placeholder="ঠিকানা বা পরিচয়পত্র নম্বর" autocomplete="off"></div>' +
      '<div class="field"><label for="c-medium">টাকা দেওয়ার মাধ্যম</label>' + selectHtml('c-medium', C.MEDIUMS, draft.medium) + '</div>' +
      '<div class="field"><label for="c-interest">সুদ</label>' + selectHtml('c-interest', C.INTERESTS, draft.interest) + '</div>' +
      '<div class="field"><label for="c-w1">সাক্ষী ১ (নাম ও ফোন)</label><input type="text" id="c-w1" list="dl-wit" value="' + h(draft.w1) + '" placeholder="নাম, মোবাইল নম্বর" autocomplete="off">' + pickBtn('w1') + '</div>' +
      '<div class="field"><label for="c-w2">সাক্ষী ২ (নাম ও ফোন)</label><input type="text" id="c-w2" list="dl-wit" value="' + h(draft.w2) + '" placeholder="নাম, মোবাইল নম্বর" autocomplete="off">' + pickBtn('w2') + '</div>' +
      '<datalist id="dl-wit">' + S.peopleList(true).map(function (x) { return '<option value="' + h(x.name) + '"></option>'; }).join('') + '</datalist>' +
      '<div class="field"><label for="c-extra">অতিরিক্ত শর্ত (ঐচ্ছিক)</label><input type="text" id="c-extra" value="' + h(draft.extra) + '" placeholder="যেমন: বাকি টাকা দুই কিস্তিতে" autocomplete="off"></div>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="save-contract" data-arg="' + h(id) + '">চুক্তিপত্র তৈরি করুন</button></div>';
    render(html);
  }
  function saveContract(id) {
    var l = S.getLoan(id), fa = l && firstAdd(l);
    if (!l || !fa) { go('#/'); return; }
    function v(i) { return (document.getElementById(i) || {}).value || ''; }
    var contract = {
      myInfo: v('c-my').trim(), myPhone: v('c-phone').trim(), otherInfo: v('c-other').trim(), medium: v('c-medium'), interest: v('c-interest'),
      w1: v('c-w1').trim(), w2: v('c-w2').trim(), extra: v('c-extra').trim(),
      amount: fa.amount, date: fa.date, dueDate: l.dueDate, mode: l.mode, createdAt: Date.now()
    };
    S.setProfile(contract.myInfo, contract.myPhone);
    S.rememberPerson({ name: l.name, contact: l.contact, addr: contract.otherInfo });
    S.rememberPerson({ name: contract.w1 }, true); S.rememberPerson({ name: contract.w2 }, true);
    S.updateLoan(id, { contract: contract });
    afterChange();
    go('#/contract/' + id);
  }
  function vContractView(id) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    if (!l.contract) { go('#/contract/' + id + '/edit'); return; }
    var st = G.getStatus().state;
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a><h1>চুক্তিপত্র</h1>' +
      '<a class="icon-btn" href="#/contract/' + h(id) + '/edit" aria-label="সম্পাদনা">' + ic('edit', 20) + '</a></div>' +
      '<div class="paper-wrap">' + C.renderHtml(l, l.contract) + '</div>' +
      '<div style="text-align:center;font-size:13px;color:#16453A">' + (st === 'ok' ? 'আপনার ড্রাইভে সেভ হয়েছে' : 'ফোনে সেভ আছে, ইন্টারনেট ও লগিন থাকলে ড্রাইভে যাবে') + '</div>' +
      '<div class="note-box">সাদা কাগজে প্রিন্ট করে দুই পক্ষ ও সাক্ষীরা সই করলে এটি পূর্ণ হবে। বড় অঙ্কের ঋণে স্থানীয় আইনি পরামর্শ নেওয়া ভালো।</div></div>' +
      '<div class="bottom-bar"><button class="btn outline" data-act="pdf-dl" data-arg="' + h(id) + '">' + ic('download', 18, 'currentColor', 2.2) + 'পিডিএফ ডাউনলোড</button>' +
      '<button class="btn" data-act="pdf-share" data-arg="' + h(id) + '">' + ic('share', 18, '#fff', 2.2) + 'পাঠান</button></div>';
    render(html);
  }
  function pdfAction(id, mode) {
    if (busy) return;
    var l = S.getLoan(id);
    if (!l || !l.contract) return;
    busy = true; toast('পিডিএফ তৈরি হচ্ছে…');
    C.makePdf(l, l.contract).then(function (blob) {
      var name = C.fileName(l, l.contract);
      if (mode === 'share') {
        return C.share(blob, name, 'ঋণ চুক্তিপত্র').catch(function (e) {
          if (e && e.name === 'AbortError') return;
          C.download(blob, name); toast('এই ফোনে সরাসরি পাঠানো যায়নি, ডাউনলোড হয়েছে');
        });
      }
      C.download(blob, name); toast('ডাউনলোড হয়েছে');
    }).catch(function (e) {
      toast(e && e.message === 'lib_load_failed' ? 'পিডিএফ বানাতে ইন্টারনেট লাগবে, আবার চেষ্টা করুন' : 'পিডিএফ বানানো যায়নি');
    }).then(function () { busy = false; });
  }

  /* ---------- সেটিং ---------- */
  function fmtTime(ts) {
    if (!ts) return 'এখনো হয়নি';
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : String(n); };
    return U.formatDate(U.todayISO(d)) + ', ' + bn(p(d.getHours()) + ':' + p(d.getMinutes()));
  }
  function vSettings() {
    var s = G.getStatus(), st = s.state, cfg = G.configured();
    var txt = { signedout: 'লগিন করা নেই', idle: 'লগিন আছে, সিঙ্ক বাকি', syncing: 'সিঙ্ক হচ্ছে…', ok: 'সব ঠিক আছে', offline: s.msg || 'অফলাইন', needlogin: 'আবার লগিন দরকার', error: s.msg || 'সমস্যা হয়েছে' }[st] || '';
    var loggedIn = st === 'ok' || st === 'syncing' || st === 'idle';
    var html = '<div class="screen"><div class="top"><div><span class="sub">ব্যবস্থাপনা</span><h1>সেটিং</h1></div></div>';
    if (!cfg) html += '<div class="warn-box">গুগল লগিনের Client ID বসানো হয়নি। config.js ফাইলে বসাতে হবে (SETUP.md এর ধাপ ২)। ততক্ষণ সব ডাটা শুধু এই ফোনে থাকবে।</div>';
    html += '<div class="card"><h3>গুগল সংযোগ</h3><div class="kv"><span>অবস্থা</span><span>' + h(txt) + '</span></div>' +
      '<div class="kv"><span>শেষ সিঙ্ক</span><span>' + h(fmtTime(s.last)) + '</span></div>' +
      (s.calMsg ? '<div class="warn-box">' + h(s.calMsg) + '</div>' : '') +
      '<p>ডাটা আপনার গুগল ড্রাইভের গোপন ফোল্ডারে থাকে, আর রিমাইন্ডার গুগল ক্যালেন্ডারে বসে।</p>' +
      '<button class="btn small" data-act="sync-now"' + (cfg ? '' : ' disabled') + '>' + (loggedIn ? 'এখনই সিঙ্ক করুন' : 'গুগল দিয়ে লগিন ও সিঙ্ক') + '</button>' +
      (st !== 'signedout' ? '<button class="btn danger small" data-act="logout">লগআউট (ফোনের ডাটা থাকবে)</button>' : '') + '</div>' +
      '<div class="card"><h3>রিমাইন্ডার পরীক্ষা</h3><p>ক্যালেন্ডারে একটা পরীক্ষামূলক ইভেন্ট বসবে, ৫ মিনিট পরে ফোনে নোটিফিকেশন আসা উচিত। না এলে ক্যালেন্ডার অ্যাপের নোটিফিকেশন চালু আছে কি না দেখুন।</p>' +
      '<button class="btn outline small" data-act="test-remind"' + (cfg ? '' : ' disabled') + '>পরীক্ষামূলক রিমাইন্ডার পাঠান</button></div>' +
      '<div class="card"><h3>ব্যাকআপ</h3><p>নিজের কাছেও একটা কপি রাখুন। ডাউনলোড করা ফাইল থেকে যেকোনো সময় ফিরিয়ে আনা যায়।</p>' +
      '<button class="btn outline small" data-act="backup">ব্যাকআপ ডাউনলোড (JSON)</button>' +
      '<label class="btn outline small" style="cursor:pointer">ব্যাকআপ থেকে ফিরিয়ে আনুন<input type="file" id="restore-file" accept=".json,application/json" class="hidden"></label></div>';
    html += '<div class="card"><h3>আমার নাম ও ঠিকানা</h3><p>একবার লিখে রাখলে চুক্তিপত্রে নিজে থেকে বসবে। লেখা শেষে বাইরে চাপলেই সেভ হয়ে যায়।</p>' +
      '<textarea id="s-me" rows="2" placeholder="নাম, গ্রাম/এলাকা, জেলা">' + h(S.getProfile()) + '</textarea>' +
      '<label for="s-phone" style="margin-top:8px;display:block">আমার মোবাইল নম্বর</label><input type="text" id="s-phone" inputmode="tel" value="' + h(S.getProfilePhone()) + '" placeholder="০১৭XXXXXXXX" autocomplete="off">' + pickBtn('me') + '</div>';
    var plist = S.peopleList(false).concat(S.peopleList(true));
    if (plist.length) {
      html += '<div class="card"><h3>সংরক্ষিত ব্যক্তি (' + bn(plist.length) + ')</h3><p>ঋণ বা চুক্তিপত্রে একবার লিখলেই এখানে জমে, পরের বার নাম লিখতে গেলে নিজে থেকে আসে।</p>' +
        plist.map(function (x) {
          return '<div class="kv"><span>' + h(x.name) + (x.w ? ' <small>(সাক্ষী)</small>' : '') + (x.contact ? '<br><small>' + h(x.contact) + '</small>' : '') + '</span>' +
            '<button class="x" data-act="del-person" data-arg="' + h(x.id) + '" aria-label="মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button></div>';
        }).join('') + '</div>';
    }
    if (installPrompt) html += '<div class="card"><h3>অ্যাপ ইনস্টল</h3><p>হোম স্ক্রিনে অ্যাপের মতো রাখতে ইনস্টল করুন।</p><button class="btn small" data-act="install">ইনস্টল করুন</button></div>';
    html += '<div class="card"><h3>অ্যাপ সম্পর্কে</h3><div class="kv"><span>সংস্করণ</span><span>ধাপ ৪ • ' + h(BUILD.replace('rin-', '')) + '</span></div>' + updateBanner() +
      '<button class="btn outline small" data-act="check-update">আপডেট আছে কিনা দেখুন</button>' +
      '<div class="kv"><span>ঋণের সংখ্যা</span><span>' + bn(S.liveLoans().length) + 'টি</span></div></div></div>' + nav('settings');
    render(html);
  }

  /* =====================================================
     ধাপ ৩: আয়-ব্যয় ও রিপোর্ট
     ===================================================== */
  var fin = { kind: 'month', anchor: U.todayISO(), from: '', to: '', cv: 'expense', allCats: false, allList: false };
  var FIN_TABS = [['day', 'দৈনিক'], ['week', 'সাপ্তাহিক'], ['month', 'মাসিক'], ['year', 'বাৎসরিক'], ['custom', 'কাস্টম']];

  function signed(p) { return p < 0 ? '− ' + U.formatTaka(-p) : U.formatTaka(p); }
  function finRange() {
    if (fin.kind === 'custom') {
      if (!fin.from) fin.from = U.addDays(U.todayISO(), -29);
      if (!fin.to) fin.to = U.todayISO();
      var f = fin.from, t = fin.to;
      if (t < f) { var x = f; f = t; t = x; }
      return { from: f, to: t, label: U.formatDateShort(f) + ' – ' + U.formatDate(t) };
    }
    return S.rangeFor(fin.kind, fin.anchor);
  }
  function entryRow(e) {
    var inc = e.type === 'income';
    var sub = U.formatDateShort(e.date) + (e.note ? ' • ' + h(e.note) : '');
    return '<div class="tx"><div class="ic ' + (inc ? 't-green' : 't-red') + '">' + ic(inc ? 'plus' : 'minus', 18, 'currentColor', 2.6) + '</div>' +
      '<div class="mid"><b>' + h(e.cat) + '</b><small>' + sub + (e.derived ? ' • ঋণের হিসাব থেকে' : '') + '</small></div>' +
      '<span class="amt" style="color:' + (inc ? '#16453A' : '#8C1D18') + '">' + (inc ? '+ ' : '− ') + U.formatTaka(e.amount) + '</span>' +
      (e.derived ? '<a class="x" href="#/loan/' + h(e.loanId) + '" aria-label="ঋণ দেখুন">' + ic('chev', 18, 'currentColor', 2.4) + '</a>'
        : '<button class="x" data-act="del-entry" data-arg="' + h(e.id) + '" aria-label="মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button>') + '</div>';
  }
  function barsHtml(list, total, red) {
    return list.map(function (c) {
      var pct = total > 0 ? Math.round(c.total * 100 / total) : 0;
      return '<div class="bar-row"><div class="top2"><b>' + h(c.name) + '</b><span>' + U.formatTaka(c.total) + ' • ' + bn(pct) + '%</span></div>' +
        '<div class="track"><div class="fill' + (red ? ' red' : '') + '" style="width:' + Math.max(pct, 2) + '%"></div></div></div>';
    }).join('');
  }

  function vMoney() {
    var rng = finRange(), rep = S.report(rng.from, rng.to);
    var html = '<div class="screen"><div class="top"><div><span class="sub">হিসাব</span><h1>আয়-ব্যয়</h1></div>' + chipHtml() + '</div>' +
      '<div class="hero"><div><div class="lbl">ব্যালেন্স (আয় − ব্যয়)</div><div class="big">' + signed(rep.balance) + '</div></div>' +
      '<div class="grid2"><div class="mini"><span>মোট আয়</span><b>' + U.formatTaka(rep.income) + '</b></div>' +
      '<div class="mini"><span>মোট ব্যয়</span><b>' + U.formatTaka(rep.expense) + '</b></div></div></div>' +
      '<div class="seg c5">' + FIN_TABS.map(function (t) {
        return '<button data-act="fin-kind" data-arg="' + t[0] + '" class="' + (fin.kind === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>';
    if (fin.kind === 'custom') {
      html += '<div class="row2"><div class="field"><label for="r-from">শুরু</label><input type="date" id="r-from" value="' + h(rng.from) + '"></div>' +
        '<div class="field"><label for="r-to">শেষ</label><input type="date" id="r-to" value="' + h(rng.to) + '"></div></div>';
    } else {
      html += '<div class="period"><button data-act="fin-prev" aria-label="আগের">' + ic('back', 20, 'currentColor', 2.4) + '</button><b>' + h(rng.label) +
        '</b><button data-act="fin-next" aria-label="পরের"><span style="display:inline-flex;transform:rotate(180deg)">' + ic('back', 20, 'currentColor', 2.4) + '</span></button></div>';
    }
    var isEx = fin.cv === 'expense', list = isEx ? rep.exCats : rep.inCats, total = isEx ? rep.expense : rep.income;
    html += '<div class="seg c2"><button data-act="fin-cv" data-arg="expense" class="' + (isEx ? 'active red' : '') + '">ব্যয়ের খাত</button>' +
      '<button data-act="fin-cv" data-arg="income" class="' + (!isEx ? 'active' : '') + '">আয়ের খাত</button></div>';
    if (!list.length) html += '<div class="empty">এই সময়ে কোনো ' + (isEx ? 'ব্যয়' : 'আয়') + ' নেই।</div>';
    else {
      var shown = fin.allCats ? list : list.slice(0, 5);
      html += '<div class="bars">' + barsHtml(shown, total, isEx) +
        (list.length > 5 ? '<button class="linkbtn" data-act="fin-allcats">' + (fin.allCats ? 'কম দেখুন' : 'আরও দেখুন (আরও ' + bn(list.length - 5) + 'টি খাত)') + '</button>' : '') + '</div>';
    }
    html += '<div class="sec-h"><h2>লেনদেন (' + bn(rep.items.length) + 'টি)</h2><span>নতুন আগে</span></div>';
    if (!rep.items.length) html += '<div class="empty">এই সময়ে কোনো লেনদেন নেই। নিচের বাটন চেপে যোগ করুন।</div>';
    else {
      html += (fin.allList ? rep.items : rep.items.slice(0, 10)).map(entryRow).join('');
      if (rep.items.length > 10) html += '<button class="linkbtn" data-act="fin-alllist">' + (fin.allList ? 'কম দেখুন' : 'সব ' + bn(rep.items.length) + 'টি দেখুন') + '</button>';
    }
    html += '<button class="btn outline small" style="margin-top:6px" data-act="report-pdf">' + ic('download', 18, 'currentColor', 2.2) + 'এই রিপোর্ট পিডিএফ</button>' +
      '<a class="linkcard" href="#/forecast">' + ic('chart', 24, '#1F5C4A', 2) + '<div class="mid"><b>আগামী মাসের পূর্বাভাস</b><small>ডিফল্ট আয়-খরচ ও ঋণ শোধসহ</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>' +
      '</div><div class="bottom-bar"><a class="btn" href="#/entry">' + ic('plus', 18, '#fff', 2.6) + ' নতুন আয় / ব্যয়</a></div>' + nav('money');
    render(html);
  }

  function reportHtml(rep, label) {
    function rows(list) {
      return list.length ? list.map(function (c) { return '<tr><td>' + h(c.name) + '</td><td class="n">' + U.formatTaka(c.total) + '</td></tr>'; }).join('')
        : '<tr><td colspan="2">নেই</td></tr>';
    }
    var items = rep.items.map(function (e) {
      var inc = e.type === 'income';
      return '<tr><td>' + U.formatDateShort(e.date) + '</td><td>' + h(e.cat) + (e.note ? ' — ' + h(e.note) : '') + '</td><td class="n">' +
        (inc ? '+ ' : '− ') + U.formatTaka(e.amount) + '</td></tr>';
    }).join('');
    return '<div class="report-paper"><h1>আয়-ব্যয় রিপোর্ট</h1><div class="rp-sub">' + h(label) + '</div>' +
      '<div class="rp-tot"><div><small>মোট আয়</small><b>' + U.formatTaka(rep.income) + '</b></div><div><small>মোট ব্যয়</small><b>' + U.formatTaka(rep.expense) +
      '</b></div><div><small>ব্যালেন্স</small><b>' + signed(rep.balance) + '</b></div></div>' +
      '<h2>আয়ের খাত</h2><table>' + rows(rep.inCats) + '</table><h2>ব্যয়ের খাত</h2><table>' + rows(rep.exCats) + '</table>' +
      '<h2>সব লেনদেন</h2><table><tr><th>তারিখ</th><th>খাত / নোট</th><th class="n">টাকা</th></tr>' + (items || '<tr><td colspan="3">নেই</td></tr>') + '</table></div>';
  }
  function reportPdf() {
    if (busy) return;
    var rng = finRange(), rep = S.report(rng.from, rng.to);
    busy = true; toast('রিপোর্ট তৈরি হচ্ছে…');
    C.htmlToPdf(reportHtml(rep, rng.label)).then(function (blob) {
      C.download(blob, ('আয়-ব্যয়-' + rng.from + '-' + rng.to + '.pdf')); toast('ডাউনলোড হয়েছে');
    }).catch(function (e) {
      toast(e && e.message === 'lib_load_failed' ? 'পিডিএফ বানাতে ইন্টারনেট লাগবে' : 'পিডিএফ বানানো যায়নি');
    }).then(function () { busy = false; });
  }

  function collectEntry() {
    var m = { amount: 'f-amount', date: 'f-date', note: 'f-note', cat: 'e-cat' };
    Object.keys(m).forEach(function (k) {
      var e = document.getElementById(m[k]);
      if (e && !(k === 'cat' && e.value === '__new')) draft[k] = e.value;
    });
  }
  function vEntry() {
    if (!draft) draft = { type: 'expense', amount: '', cat: '', date: U.todayISO(), note: '', newCat: false };
    var isEx = draft.type === 'expense', list = S.cats(draft.type);
    if (!draft.cat || list.indexOf(draft.cat) < 0) draft.cat = list[0];
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/money" aria-label="ফিরে যান">' + ic('back') + '</a><h1>নতুন ' + (isEx ? 'ব্যয়' : 'আয়') + '</h1></div>' +
      '<div class="seg c2"><button data-act="entry-type" data-arg="expense" class="' + (isEx ? 'active red' : '') + '">ব্যয়</button>' +
      '<button data-act="entry-type" data-arg="income" class="' + (!isEx ? 'active' : '') + '">আয়</button></div>' +
      '<div class="field"><label for="f-amount">টাকার পরিমাণ</label><input type="text" inputmode="decimal" class="amount ' + (isEx ? 'red' : '') + '" id="f-amount" value="' + h(draft.amount) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('amount') + '</div>' +
      '<div class="field"><label for="e-cat">' + (isEx ? 'ব্যয়ের খাত' : 'আয়ের খাত') + '</label><select id="e-cat">' +
      list.map(function (c) { return '<option value="' + h(c) + '"' + (c === draft.cat ? ' selected' : '') + '>' + h(c) + '</option>'; }).join('') +
      '<option value="__new">＋ নতুন খাত যোগ করুন…</option></select></div>';
    if (draft.newCat) {
      html += '<div class="field"><label for="e-newcat">নতুন খাতের নাম</label><div class="newcat"><input type="text" id="e-newcat" autocomplete="off">' +
        '<button class="btn small" data-act="entry-addcat">যোগ</button></div>' + errHtml('cat') + '</div>';
    }
    html += '<div class="field"><label for="f-date">তারিখ</label><input type="date" id="f-date" value="' + h(draft.date) + '">' + errHtml('date') + '</div>' +
      '<div class="field"><label for="f-note">নোট (ঐচ্ছিক)</label><input type="text" id="f-note" value="' + h(draft.note) + '" autocomplete="off"></div>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="save-entry">সেভ করুন</button></div>';
    render(html);
  }
  function saveEntry() {
    collectEntry();
    var errors = {}, a = U.parseAmount(draft.amount);
    if (isNaN(a) || a <= 0) errors.amount = 'সঠিক টাকার পরিমাণ লিখুন';
    if (!draft.date) errors.date = 'তারিখ দিন';
    if (!draft.cat) errors.cat = 'খাত বেছে নিন';
    if (Object.keys(errors).length) { draft.errors = errors; vEntry(); return; }
    S.addEntry({ type: draft.type, cat: draft.cat, amount: a, date: draft.date, note: draft.note.trim() });
    fin.kind = fin.kind === 'custom' ? 'custom' : fin.kind; fin.anchor = draft.date > U.todayISO() ? draft.date : (fin.kind === 'custom' ? fin.anchor : draft.date);
    afterChange(); toast('সেভ হয়েছে'); go('#/money');
  }

  /* =====================================================
     ধাপ ২: দোয়া
     ===================================================== */
  var SAMPLE_DUA = {
    title: 'ঋণ পরিশোধের দোয়া',
    arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
    translit: 'আল্লাহুম্মাকফিনী বিহালালিকা ‘আন হারামিকা, ওয়া আগনিনী বিফাদলিকা ‘আম্মান সিওয়াক।',
    meaning: 'হে আল্লাহ, আপনি আপনার হালাল দিয়ে আমাকে হারাম থেকে যথেষ্ট করে দিন এবং আপনার অনুগ্রহে আপনি ছাড়া অন্য সবার থেকে আমাকে অমুখাপেক্ষী করুন।',
    target: '100', times: ['05:30', '21:00']
  };
  /* সবার জন্য বিল্ট-ইন দোয়া লাইব্রেরি (নতুন দোয়া যোগ করতে এই তালিকায় লিখলেই সবার অ্যাপে আসবে) */
  var DUA_LIB = [
    { title: 'ঋণ পরিশোধের দোয়া', src: 'জামে তিরমিযী', target: 100,
      arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
      translit: 'আল্লাহুম্মাকফিনী বিহালালিকা ‘আন হারামিকা, ওয়া আগনিনী বিফাদলিকা ‘আম্মান সিওয়াক।',
      meaning: 'হে আল্লাহ, আপনি আপনার হালাল দিয়ে আমাকে হারাম থেকে যথেষ্ট করে দিন এবং আপনার অনুগ্রহে আপনি ছাড়া অন্য সবার থেকে আমাকে অমুখাপেক্ষী করুন।' },
    { title: 'দুশ্চিন্তা ও ঋণের বোঝা থেকে আশ্রয়', src: 'সহীহ বুখারী', target: 33,
      arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
      translit: 'আল্লাহুম্মা ইন্নী আঊযুবিকা মিনাল হাম্মি ওয়াল হাযানি, ওয়াল ‘আজযি ওয়াল কাসালি, ওয়াল বুখলি ওয়াল জুবনি, ওয়া দালা‘ইদ দাইনি ওয়া গালাবাতির রিজাল।',
      meaning: 'হে আল্লাহ, আমি আপনার কাছে আশ্রয় চাই দুশ্চিন্তা ও দুঃখ থেকে, অক্ষমতা ও অলসতা থেকে, কৃপণতা ও ভীরুতা থেকে, ঋণের বোঝা ও মানুষের প্রাধান্য থেকে।' },
    { title: 'দুনিয়া ও আখিরাতের কল্যাণের দোয়া', src: 'সূরা বাকারা ২:২০১', target: 11,
      arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
      translit: 'রাব্বানা আতিনা ফিদ-দুনইয়া হাসানাতাঁও ওয়া ফিল-আখিরাতি হাসানাতাঁও ওয়া কিনা ‘আযাবান-নার।',
      meaning: 'হে আমাদের রব, আমাদের দুনিয়াতে কল্যাণ দিন, আখিরাতেও কল্যাণ দিন এবং আমাদের জাহান্নামের আগুন থেকে রক্ষা করুন।' },
    { title: 'হাসবুনাল্লাহ', src: 'সূরা আলে ইমরান ৩:১৭৩', target: 100,
      arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
      translit: 'হাসবুনাল্লাহু ওয়া নি‘মাল ওয়াকীল।',
      meaning: 'আল্লাহই আমাদের জন্য যথেষ্ট এবং তিনিই উত্তম কর্মবিধায়ক।' },
    { title: 'লা হাওলা ওয়ালা কুওয়াতা', src: 'সহীহ বুখারী', target: 100,
      arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
      translit: 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ।',
      meaning: 'আল্লাহর সাহায্য ছাড়া গুনাহ থেকে বাঁচার বা ভালো কাজ করার কোনো শক্তি নেই।' },
    { title: 'তাসবীহ', src: 'সহীহ বুখারী', target: 100,
      arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      translit: 'সুবহানাল্লাহি ওয়া বিহামদিহী।',
      meaning: 'আল্লাহ পবিত্র, আমি তাঁর প্রশংসা করি।' },
    { title: 'ইস্তিগফার', src: 'হাদীসে বর্ণিত', target: 100,
      arabic: 'أَسْتَغْفِرُ اللَّهَ',
      translit: 'আস্তাগফিরুল্লাহ।',
      meaning: 'আমি আল্লাহর কাছে ক্ষমা চাই।' },
    { title: 'দরূদ', src: 'হাদীসে বর্ণিত', target: 100,
      arabic: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
      translit: 'আল্লাহুম্মা সাল্লি ওয়া সাল্লিম ‘আলা নাবিয়্যিনা মুহাম্মাদ।',
      meaning: 'হে আল্লাহ, আমাদের নবী মুহাম্মাদ (সা.)-এর উপর রহমত ও শান্তি বর্ষণ করুন।' }
  ];
  function vDuaLib() {
    var have = {};
    S.liveDuas().forEach(function (d) { have[d.title] = 1; });
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/dua" aria-label="ফিরে যান">' + ic('back') + '</a><h1>দোয়া লাইব্রেরি</h1></div>' +
      '<div class="note-box">পছন্দের দোয়া এক চাপে নিজের তালিকায় যোগ করুন, তারপর লক্ষ্য ও রিমাইন্ডারের সময় বদলে নিতে পারবেন। ব্যবহারের আগে নির্ভরযোগ্য বই বা আলেমের কাছ থেকে মিলিয়ে নেওয়া ভালো।</div>';
    DUA_LIB.forEach(function (d, i) {
      html += '<div class="dua-card"><b style="font-size:17px">' + h(d.title) + '</b><div class="ar" lang="ar">' + h(d.arabic) + '</div>' +
        '<div class="tr">' + h(d.translit) + '</div><div class="mean">' + h(d.meaning) + '</div><small style="color:#5B635E">সূত্র: ' + h(d.src) + ' • প্রস্তাবিত লক্ষ্য ' + bn(d.target) + ' বার</small>' +
        (have[d.title] ? '<div class="chip t-green" style="align-self:flex-start">যোগ করা আছে</div>'
          : '<button class="btn small" data-act="dua-addlib" data-arg="' + i + '">আমার তালিকায় যোগ করুন</button>') + '</div>';
    });
    render(html + '</div>' + nav('dua'));
  }
  function duaPercent(d, n) { return Math.min(100, Math.round(n * 100 / Math.max(1, d.target))); }
  function daysHtml(d) {
    var max = Math.max(d.target, 1);
    return S.duaLastDays(d, U.todayISO(), 7).map(function (x) {
      var hgt = Math.max(6, Math.min(56, Math.round(x.n * 56 / max)));
      return '<div><i class="' + (x.n >= d.target ? 'ok' : '') + '" style="height:' + hgt + 'px"></i><span>' + bn(x.n) + '</span></div>';
    }).join('');
  }
  var dayTimer = null;
  function dayLeftText() {
    var now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    var m = Math.max(0, Math.floor((end - now) / 60000)), hh = Math.floor(m / 60), mm = m % 60;
    return 'দিন শেষ হতে ' + bn(hh) + ' ঘণ্টা ' + bn(mm) + ' মিনিট বাকি';
  }
  function startDayTimer() {
    if (dayTimer) clearInterval(dayTimer);
    dayTimer = setInterval(function () {
      var el = document.getElementById('day-left');
      if (!el) { clearInterval(dayTimer); dayTimer = null; return; }
      el.textContent = dayLeftText();
      var bar = document.getElementById('day-bar');
      if (bar) { var n0 = new Date(); bar.style.width = Math.round((n0 - new Date(n0.getFullYear(), n0.getMonth(), n0.getDate())) * 100 / 86400000) + '%'; }
    }, 30000);
  }
  function leftText(d, n) { return n >= d.target ? 'আজকের লক্ষ্য পূর্ণ ✓' : 'আর ' + bn(d.target - n) + ' বার বাকি'; }
  function dayCard() {
    var now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var pct = Math.round((now - start) * 100 / (end - start));
    return '<div class="hero"><div><div class="lbl">আজকের দিন</div><div class="big" id="day-left" style="font-size:22px">' + dayLeftText() + '</div></div>' +
      '<div class="pbar"><i id="day-bar" style="width:' + pct + '%"></i></div></div>';
  }
  function vDuaList() {
    var list = S.liveDuas(), today = U.todayISO();
    var html = '<div class="screen"><div class="top"><div><span class="sub">প্রতিদিনের আমল</span><h1>দোয়া</h1></div>' + chipHtml() + '</div>';
    if (!list.length) {
      html += '<div class="empty">কোনো দোয়া যোগ করা নেই। লাইব্রেরি থেকে বেছে নিন, অথবা নিজের দোয়া লিখুন।</div>' +
        '<a class="btn" href="#/dua/lib">দোয়া লাইব্রেরি থেকে বেছে নিন</a><a class="btn outline" href="#/dua/new">নিজের দোয়া লিখুন</a></div>' + nav('dua');
      render(html); return;
    }
    html += dayCard() + list.map(function (x) {
      var c = S.duaCount(x, today), left = Math.max(0, x.target - c), ok = c >= x.target, pct = duaPercent(x, c);
      return '<a class="linkcard" href="#/dua/open/' + h(x.id) + '" style="flex-direction:column;align-items:stretch;gap:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">' + h(x.title) + '</b>' +
        '<span class="chip ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'লক্ষ্য পূর্ণ ✓' : 'বাকি ' + bn(left) + ' বার') + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:14px"><span>আজ পড়া হয়েছে <b>' + bn(c) + '</b> বার</span><span>লক্ষ্য ' + bn(x.target) + '</span></div>' +
        '<div style="height:8px;background:#E4E8E5;border-radius:6px;overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#1F5C4A;border-radius:6px"></i></div></a>';
    }).join('') + '<a class="btn outline" href="#/dua/lib">' + ic('plus', 16, 'currentColor', 2.6) + ' দোয়া যোগ করুন</a></div>' + nav('dua');
    render(html);
    startDayTimer();
  }
  function vDua(openId) {
    var list = S.liveDuas(), today = U.todayISO();
    var html = '<div class="screen"><div class="top"><div><span class="sub">প্রতিদিনের আমল</span><h1>দোয়া</h1></div>' + chipHtml() + '</div>';
    if (!list.length) {
      html += '<div class="empty">কোনো দোয়া যোগ করা নেই। লাইব্রেরি থেকে বেছে নিন, অথবা নিজের দোয়া লিখুন।</div>' +
        '<a class="btn" href="#/dua/lib">দোয়া লাইব্রেরি থেকে বেছে নিন</a><a class="btn outline" href="#/dua/new">নিজের দোয়া লিখুন</a></div>' + nav('dua');
      render(html); return;
    }
    var d = S.getDua(openId);
    if (!d) { go('#/dua'); return; }
    localStorage.setItem('rin_dua', d.id);
    var n = S.duaCount(d, today), pct = duaPercent(d, n);
    html = '<div class="screen"><div class="title-row"><a class="back" href="#/dua" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + h(d.title) + '</h1></div>' +
      dayCard() +
      '<div class="dua-card">' +
      (d.arabic ? '<div class="ar" lang="ar">' + h(d.arabic) + '</div>' : '') + (d.translit ? '<div class="tr">' + h(d.translit) + '</div>' : '') + (d.meaning ? '<div class="mean">' + h(d.meaning) + '</div>' : '') +
      '<div class="counter-wrap"><button class="counter' + (n >= d.target ? ' done' : '') + '" id="cnt-btn" data-act="dua-tap" style="--p:' + pct + '" aria-label="গণনা করুন">' +
      '<span><b id="cnt-n">' + bn(n) + '</b><small>আজ / লক্ষ্য <span id="cnt-t" style="display:inline">' + bn(d.target) + '</span></small></span></button>' +
      '<div id="cnt-left" style="text-align:center;font-weight:600">' + leftText(d, n) + '</div>' +
      '<div style="display:flex;gap:8px"><button class="btn outline small" data-act="dua-undo">− ১ কমান</button><button class="btn outline small" data-act="dua-reset">আজকের গণনা শূন্য</button></div></div>' +
      '<div class="sec-h"><h2>শেষ ৭ দিন</h2></div><div class="days7" id="days7">' + daysHtml(d) + '</div></div>' +
      '<div class="card"><h3>রিমাইন্ডার</h3><p>' + (d.times && d.times.length ? 'প্রতিদিন ' + d.times.map(function (t) { return bn(t); }).join(', ') + ' টায় গুগল ক্যালেন্ডারে নোটিফিকেশন আসবে।' : 'কোনো সময় ঠিক করা নেই।') + '</p>' +
      '<div style="display:flex;gap:8px"><a class="btn outline small" href="#/dua/edit/' + h(d.id) + '">' + ic('edit', 16, 'currentColor', 2.2) + ' সম্পাদনা</a>' +
      '<button class="btn danger small" data-act="del-dua" data-arg="' + h(d.id) + '">মুছুন</button></div></div></div>' + nav('dua');
    render(html);
    startDayTimer();
  }
  function duaSetCount(id, delta, absolute) {
    var d = S.getDua(id); if (!d) return;
    var today = U.todayISO(), before = S.duaCount(d, today);
    var n = absolute != null ? S.setDuaCount(id, today, absolute) : S.bumpDua(id, today, delta);
    var btn = document.getElementById('cnt-btn');
    if (btn) { btn.style.setProperty('--p', duaPercent(d, n)); btn.classList.toggle('done', n >= d.target); }
    var el = document.getElementById('cnt-n'); if (el) el.textContent = bn(n);
    var lf = document.getElementById('cnt-left'); if (lf) lf.textContent = leftText(d, n);
    var dy = document.getElementById('days7'); if (dy) dy.innerHTML = daysHtml(d);
    if (delta > 0 && navigator.vibrate) { try { navigator.vibrate(n === d.target ? [30, 40, 60] : 12); } catch (e) { /* ignore */ } }
    if (delta > 0 && before < d.target && n >= d.target) toast('আলহামদুলিল্লাহ, আজকের লক্ষ্য পূর্ণ হয়েছে');
    scheduleSync();
  }

  function collectDua() {
    ['title', 'arabic', 'translit', 'meaning', 'target'].forEach(function (k) {
      var e = document.getElementById('d-' + k); if (e) draft[k] = e.value;
    });
    var ts = document.querySelectorAll('.t-in');
    if (ts.length) draft.times = Array.prototype.map.call(ts, function (x) { return x.value; });
  }
  function vDuaForm(id, sample) {
    var d = id ? S.getDua(id) : null;
    if (id && !d) { go('#/dua'); return; }
    if (!draft) {
      draft = d ? { title: d.title, arabic: d.arabic, translit: d.translit || '', meaning: d.meaning, target: String(d.target), times: d.times.slice() }
        : sample ? JSON.parse(JSON.stringify(SAMPLE_DUA)) : { title: '', arabic: '', translit: '', meaning: '', target: '100', times: ['21:00'] };
    }
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/dua" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + (d ? 'দোয়া সম্পাদনা' : 'নতুন দোয়া') + '</h1></div>';
    if (sample && !d) html += '<div class="note-box">এটি প্রচলিত একটি নমুনা। ব্যবহারের আগে নিজের বই বা আলেমের কাছ থেকে মিলিয়ে নিন, দরকারে বদলে ফেলুন।</div>';
    html += '<div class="field"><label for="d-title">দোয়ার নাম</label><input type="text" id="d-title" value="' + h(draft.title) + '" autocomplete="off">' + errHtml('title') + '</div>' +
      '<div class="field"><label for="d-arabic">আরবি / মূল পাঠ</label><textarea id="d-arabic" rows="3" dir="auto">' + h(draft.arabic) + '</textarea></div>' +
      '<div class="field"><label for="d-translit">বাংলা উচ্চারণ</label><textarea id="d-translit" rows="2">' + h(draft.translit || '') + '</textarea></div>' +
      '<div class="field"><label for="d-meaning">বাংলা অর্থ</label><textarea id="d-meaning" rows="3">' + h(draft.meaning) + '</textarea></div>' +
      '<div class="field"><label for="d-target">দৈনিক লক্ষ্য (কতবার পড়বেন)</label><input type="text" inputmode="numeric" id="d-target" value="' + h(draft.target) + '" autocomplete="off">' + errHtml('target') + '</div>' +
      '<div class="field"><span class="lbl">রিমাইন্ডারের সময় (প্রতিদিন)</span>' +
      draft.times.map(function (t, i) {
        return '<div class="timebox"><input type="time" class="t-in" value="' + h(t) + '"><button data-act="dua-deltime" data-arg="' + i + '" aria-label="সময় মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button></div>';
      }).join('') + (draft.times.length < 5 ? '<button class="linkbtn" data-act="dua-addtime">＋ আরেকটা সময় যোগ করুন</button>' : '') +
      '<span class="hint">রিমাইন্ডার গুগল ক্যালেন্ডারের মাধ্যমে আসে, তাই গুগল লগিন লাগবে।</span></div>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="save-dua" data-arg="' + (d ? h(d.id) : '') + '">সেভ করুন</button></div>';
    render(html);
  }
  function saveDua(id) {
    collectDua();
    var errors = {}, t = parseInt(U.fromBn(draft.target), 10);
    if (!draft.title.trim()) errors.title = 'দোয়ার নাম লিখুন';
    if (isNaN(t) || t < 1 || t > 100000) errors.target = 'সঠিক সংখ্যা লিখুন (১ বা তার বেশি)';
    if (Object.keys(errors).length) { draft.errors = errors; vDuaForm(id); return; }
    var data = { title: draft.title.trim(), arabic: draft.arabic.trim(), translit: (draft.translit || '').trim(), meaning: draft.meaning.trim(), target: t, times: draft.times.filter(Boolean) };
    var d = id ? S.updateDua(id, data) : S.createDua(data);
    localStorage.setItem('rin_dua', d.id);
    afterChange(); toast('সেভ হয়েছে'); go('#/dua');
  }


  /* ---------- পরিশোধের সূচি ---------- */
  function monthLabel(key) { var p = key.split('-'); return U.MONTHS[+p[1] - 1] + ' ' + bn(p[0]); }
  function monthName(key) { return U.MONTHS[+key.split('-')[1] - 1]; }
  function vSchedule() {
    var today = U.todayISO(), dir = ui.dir, cur = today.slice(0, 7), next = U.addMonths(cur + '-01', 1).slice(0, 7);
    var s = S.schedule(dir, today), taken = dir === 'taken';
    var nm = S.monthTotal(dir, next, today).total;
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/" aria-label="ফিরে যান">' + ic('back') + '</a><h1>পরিশোধের সূচি</h1></div>' +
      '<div class="seg c2"><button data-act="sch-dir" data-arg="taken" class="' + (taken ? 'active' : '') + '">আমি দেব</button>' +
      '<button data-act="sch-dir" data-arg="given" class="' + (!taken ? 'active' : '') + '">আমি পাব</button></div>' +
      '<div class="hero amber"><div class="lbl">আগামী মাসে (' + monthName(next) + ') ' + (taken ? 'ঋণ শোধে যাবে' : 'পাওনা আসবে') + '</div><div class="big">' + U.formatTaka(nm) + '</div>' +
      '<div class="lbl">' + (!s.months.length ? 'কোনো বাকি নেই' : s.count === 0 ? 'সব এই মাসেই শেষ হবে' : 'সব ' + (taken ? 'ঋণ শোধ' : 'টাকা আদায়') + ' হতে আরও ' + bn(s.count) + ' মাস • শেষ কিস্তি ' + monthLabel(s.lastKey)) + '</div></div>';
    if (!s.months.length) { html += '<div class="empty">কোনো বাকি ঋণ নেই।</div></div>' + nav('home'); render(html); return; }
    html += '<div class="sec-h"><h2>কোন ঋণ কত মাসে শোধ হবে</h2></div><div class="lstrip">' + s.loans.map(function (ln) {
      return '<div class="lt"><b>' + h(ln.name) + '</b><small>' + (ln.last === cur ? 'এই মাসেই' : bn(ln.span) + ' মাসে (' + monthName(ln.last) + ')') + '</small></div>';
    }).join('') + '</div>';
    html += s.months.map(function (m) {
      var tag = m.key === cur ? '<span class="chip t-green">চলতি মাস</span>' : m.key === next ? '<span class="chip t-amber">আগামী মাস</span>' : '';
      return '<div class="mcard' + (m.key === next ? ' hl' : '') + '"><div class="mh"><div><b>' + monthLabel(m.key) + '</b> ' + tag + '</div>' +
        '<div class="mt"><small>এই মাসে যাবে</small><b>' + U.formatTaka(m.total) + '</b></div></div>' +
        m.items.map(function (it) {
          return '<div class="mrow"><span class="nm">' + h(it.name) + '<small> • ' + (it.n > 1 ? 'কিস্তি ' + bn(it.idx) + '/' + bn(it.n) + ' • ' : '') + (it.late ? 'মেয়াদ পার' : U.formatDateShort(it.date)) + '</small></span><b>' + U.formatTaka(it.amount) + '</b></div>';
        }).join('') + '</div>';
    }).join('');
    html += '<div class="totrow"><span>মোট বাকি</span><b>' + U.formatTaka(s.total) + '</b></div></div>' + nav('home');
    render(html);
  }

  /* ---------- এডিট হিস্টোরি ---------- */
  function fmtTime(ms) {
    var d = new Date(ms), hh = d.getHours(), mm = d.getMinutes();
    return U.formatDate(U.todayISO(d)) + ', ' + bn((hh % 12 || 12)) + ':' + bn(mm < 10 ? '0' + mm : mm) + (hh < 12 ? ' সকাল' : ' বিকাল');
  }
  function vLog(id) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    var log = (l.log || []).slice().sort(function (a, b) { return b.at - a.at; }), by = {};
    log.forEach(function (e) { by[e.by] = (by[e.by] || 0) + 1; });
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a><h1>এডিট হিস্টোরি</h1></div>' +
      '<div class="card"><h3>কে কতবার বদলেছে</h3>' + Object.keys(by).map(function (k) { return '<div class="kv"><span>' + h(k) + '</span><span>' + bn(by[k]) + ' বার</span></div>'; }).join('') +
      (log.length ? '' : '<p>এখনো কোনো পরিবর্তন লেখা নেই।</p>') + '</div>';
    html += log.map(function (e) {
      return '<div class="tx"><div class="mid"><b>' + h(e.text) + '</b><small>' + h(e.by) + ' • ' + fmtTime(e.at) + '</small></div></div>';
    }).join('') + '</div>';
    render(html);
  }

  /* ---------- ডিফল্ট আয়-খরচ ও পূর্বাভাস (ব্যক্তিগত) ---------- */
  var fc = { key: '' };
  function vForecast() {
    var today = U.todayISO();
    if (!fc.key) fc.key = U.addMonths(today.slice(0, 7) + '-01', 1).slice(0, 7);
    var f = S.forecast(fc.key, today), hasDefs = f.defs.length > 0;
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/money" aria-label="ফিরে যান">' + ic('back') + '</a><h1>মাসের পূর্বাভাস</h1></div>' +
      '<div class="period"><button data-act="fc-prev" aria-label="আগের">' + ic('back', 20, 'currentColor', 2.4) + '</button><b>' + monthLabel(fc.key) +
      '</b><button data-act="fc-next" aria-label="পরের"><span style="display:inline-flex;transform:rotate(180deg)">' + ic('back', 20, 'currentColor', 2.4) + '</span></button></div>';
    if (!hasDefs) {
      html += '<div class="empty">আগে ডিফল্ট আয় (যেমন বেতন) ও মাসিক খরচ যোগ করুন, তারপর পূর্বাভাস দেখা যাবে।</div>';
    } else {
      var committed = Math.max(f.budget, f.spent) + f.loanDue, pct = f.income > 0 ? Math.min(100, Math.round(committed * 100 / f.income)) : 100;
      html += '<div class="hero' + (f.over ? ' redh' : '') + '"><div><div class="lbl">' + (f.over ? 'আয়ের চেয়ে ' + U.formatTaka(-f.free) + ' বেশি খরচ হয়ে যাচ্ছে!' : 'এই মাসে হাতে থাকবে (আনুমানিক)') + '</div><div class="big">' + U.formatTaka(f.over ? 0 : f.free) + '</div></div>' +
        '<div class="pbar"><i style="width:' + pct + '%"></i></div><div class="lbl">আয়ের ' + bn(pct) + '% আগেই ধরা আছে</div></div>' +
        '<div class="card"><div class="kv"><span>প্রত্যাশিত আয়</span><span>' + U.formatTaka(f.income) + '</span></div>' +
        '<div class="kv"><span>মাসিক খরচ (ডিফল্ট)</span><span>' + U.formatTaka(f.budget) + '</span></div>' +
        '<div class="kv"><span>ঋণ শোধ (সূচি অনুযায়ী)</span><span>' + U.formatTaka(f.loanDue) + '</span></div>' +
        '<div class="kv"><span>এ পর্যন্ত আসল খরচ</span><span style="color:' + (f.spent > f.budget ? '#8C1D18' : 'inherit') + '">' + U.formatTaka(f.spent) + '</span></div>' +
        (f.receive ? '<div class="kv"><span>ঋণ থেকে পাওনা আসবে (হিসাবের বাইরে)</span><span>' + U.formatTaka(f.receive) + '</span></div>' : '') + '</div>';
    }
    html += '<div class="sec-h"><h2>ডিফল্ট আয় ও খরচ</h2></div>';
    html += f.defs.length ? f.defs.map(function (d) {
      return '<div class="tx"><div class="mid"><b>' + h(d.name) + '</b><small>' + (d.type === 'income' ? 'আয়' : 'খরচ') + ' • ' + monthLabel(d.from) + ' থেকে</small></div>' +
        '<span class="amt" style="color:' + (d.type === 'income' ? '#16453A' : '#8C1D18') + '">' + U.formatTaka(d.amount) + '</span>' +
        '<a class="icon-btn" href="#/default/edit/' + h(d.id) + '" aria-label="বদলান">' + ic('edit', 18) + '</a>' +
        '<button class="x" data-act="del-default" data-arg="' + h(d.id) + '" aria-label="মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button></div>';
    }).join('') : '<div class="empty">এই মাসের জন্য কিছু নেই।</div>';
    html += '<p class="hint">অঙ্ক বদলালে শুধু নির্বাচিত মাস থেকে বদলাবে, আগের মাসের হিসাব ঠিক থাকবে।</p></div>' +
      '<div class="bottom-bar"><a class="btn outline" href="#/default/new/expense">＋ খরচ</a><a class="btn" href="#/default/new/income">＋ আয়</a></div>';
    render(html);
  }
  function vDefault(mode, arg) {
    var d = null, today = U.todayISO();
    if (mode === 'edit') { S.getState().defaults.forEach(function (x) { if (x.id === arg && !x.deleted) d = x; }); if (!d) { go('#/forecast'); return; } }
    if (!draft) draft = d ? { type: d.type, name: d.name, amount: String(d.amount / 100), from: fc.key || today.slice(0, 7) }
      : { type: arg === 'income' ? 'income' : 'expense', name: '', amount: '', from: fc.key || U.addMonths(today.slice(0, 7) + '-01', 1).slice(0, 7) };
    var isEx = draft.type === 'expense', list = S.cats(draft.type);
    if (!draft.name || (!d && list.indexOf(draft.name) < 0)) draft.name = list[0];
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/forecast" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + (d ? 'অঙ্ক বদলান' : (isEx ? 'ডিফল্ট খরচ' : 'ডিফল্ট আয়')) + '</h1></div>';
    if (!d) html += '<div class="seg c2"><button data-act="def-type" data-arg="expense" class="' + (isEx ? 'active red' : '') + '">খরচ</button><button data-act="def-type" data-arg="income" class="' + (!isEx ? 'active' : '') + '">আয়</button></div>';
    html += '<div class="field"><label for="d-cat">খাত</label>' + (d ? '<input type="text" value="' + h(d.name) + '" disabled>' :
      '<select id="d-cat">' + list.map(function (c) { return '<option value="' + h(c) + '"' + (c === draft.name ? ' selected' : '') + '>' + h(c) + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div class="field"><label for="f-amount">মাসে কত টাকা</label><input type="text" inputmode="decimal" class="amount ' + (isEx ? 'red' : '') + '" id="f-amount" value="' + h(draft.amount) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('amount') + '</div>' +
      '<div class="field"><label for="d-from">কোন মাস থেকে কার্যকর</label><input type="month" id="d-from" value="' + h(draft.from) + '"></div>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="save-default" data-arg="' + (d ? h(d.id) : '') + '">সেভ করুন</button></div>';
    render(html);
  }
  function collectDefault() {
    var a = document.getElementById('f-amount'), c = document.getElementById('d-cat'), f = document.getElementById('d-from');
    if (a) draft.amount = a.value; if (c) draft.name = c.value; if (f && f.value) draft.from = f.value;
  }
  function saveDefault(id) {
    collectDefault();
    var a = U.parseAmount(draft.amount);
    if (isNaN(a) || a <= 0) { draft.errors = { amount: 'সঠিক টাকার পরিমাণ লিখুন' }; vDefault(id ? 'edit' : 'new', id || draft.type); return; }
    if (id) S.changeDefault(id, a, draft.from + '-01');
    else S.addDefault({ type: draft.type, name: draft.name, amount: a, from: draft.from });
    fc.key = draft.from; afterChange(); toast('সেভ হয়েছে'); go('#/forecast');
  }


  /* ---------- মওকুফ (শুধু পাওনাদার = আমি পাব) ---------- */
  function vWaive(id) {
    var l = S.getLoan(id);
    if (!l || l.dir !== 'given' || S.balance(l) <= 0) { go(l ? '#/loan/' + id : '#/'); return; }
    var bal = S.balance(l);
    if (!draft) draft = { full: true, amount: '', reason: '' };
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a><h1>ঋণ মওকুফ</h1></div>' +
      '<div class="note-box">মওকুফ মানে বাকি টাকা আর ফেরত চাইবেন না। এটা শুধু যিনি ঋণ দিয়েছেন তিনিই করতে পারেন। কারণ লেখা জরুরি, আর দুইবার নিশ্চিত করতে হবে।</div>' +
      '<div class="hero" style="padding:14px 16px;gap:2px"><span style="font-size:13px">' + h(l.name) + '-এর কাছে এখন পাব</span><b style="font-size:24px">' + U.formatTaka(bal) + '</b></div>' +
      '<div class="seg c2"><button data-act="waive-full" data-arg="1" class="' + (draft.full ? 'active' : '') + '">পুরোটা মওকুফ</button>' +
      '<button data-act="waive-full" data-arg="0" class="' + (!draft.full ? 'active' : '') + '">কিছু অংশ</button></div>';
    if (!draft.full) html += '<div class="field"><label for="f-amount">কত টাকা মওকুফ</label><input type="text" inputmode="decimal" class="amount" id="f-amount" value="' + h(draft.amount) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('amount') + '</div>';
    html += '<div class="field"><label for="w-reason">কারণ (সংক্ষেপে)</label><input type="text" id="w-reason" value="' + h(draft.reason) + '" placeholder="যেমন: অসুস্থতায় অক্ষম, সওয়াবের নিয়তে" autocomplete="off">' + errHtml('reason') + '</div>' +
      '</div><div class="bottom-bar"><button class="btn danger" data-act="waive-go" data-arg="' + h(id) + '">মওকুফ করুন</button></div>';
    render(html);
  }
  function collectWaive() {
    var a = document.getElementById('f-amount'), r = document.getElementById('w-reason');
    if (a) draft.amount = a.value; if (r) draft.reason = r.value;
  }
  function waiveGo(id) {
    collectWaive();
    var l = S.getLoan(id), bal = l ? S.balance(l) : 0, errors = {};
    if (!l || l.dir !== 'given' || bal <= 0) { go('#/'); return; }
    var a = draft.full ? bal : U.parseAmount(draft.amount), reason = draft.reason.trim();
    if (isNaN(a) || a <= 0) errors.amount = 'সঠিক টাকার পরিমাণ লিখুন';
    else if (a > bal) errors.amount = 'বাকির (' + U.formatTaka(bal) + ') চেয়ে বেশি হতে পারে না';
    if (reason.length < 3) errors.reason = 'মওকুফের কারণ লিখুন';
    if (Object.keys(errors).length) { draft.errors = errors; vWaive(id); return; }
    sheet('ধাপ ১/২: মওকুফ করবেন?', h2t(l.name) + '-এর ' + U.formatTaka(a) + ' মওকুফ করা হবে। কারণ: ' + reason, 'হ্যাঁ, পরের ধাপে', function () {
      sheet('ধাপ ২/২: শেষবার নিশ্চিত করুন', U.formatTaka(a) + ' আর ফেরত চাওয়া হবে না। এটা হিসাবে মওকুফ হিসেবে লেখা থাকবে।', 'মওকুফ নিশ্চিত', function () {
        S.addTx(id, { kind: 'waive', amount: a, date: U.todayISO(), note: reason, full: a === bal });
        afterChange(); toast('মওকুফ লেখা হয়েছে'); go('#/loan/' + id);
      }, true);
    }, true);
  }
  function h2t(x) { return String(x == null ? '' : x); }


  /* ---------- পাওনাদার / দেনাদার তালিকা (ব্যক্তি অনুযায়ী) ---------- */
  function vParties() {
    var today = U.todayISO(), dir = ui.dir, taken = dir === 'taken', map = {}, order = [];
    S.liveLoans(dir).filter(isOpenLoan).forEach(function (l) {
      var k = (l.name || '').trim().toLowerCase();
      if (!map[k]) { map[k] = { name: l.name, contact: l.contact, total: 0, loans: [] }; order.push(k); }
      var g = map[k]; g.total += S.balance(l); g.loans.push(l);
      if (!g.contact && l.contact) g.contact = l.contact;
    });
    var list = order.map(function (k) { return map[k]; }).sort(function (a, b) { return b.total - a.total; });
    var sum = list.reduce(function (a, g) { return a + g.total; }, 0);
    var html = '<div class="screen"><div class="title-row"><a class="back" href="#/" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + (taken ? 'পাওনাদার তালিকা' : 'দেনাদার তালিকা') + '</h1></div>' +
      '<div class="seg c2"><button data-act="pt-dir" data-arg="taken" class="' + (taken ? 'active' : '') + '">পাওনাদার (আমি দেব)</button>' +
      '<button data-act="pt-dir" data-arg="given" class="' + (!taken ? 'active' : '') + '">দেনাদার (আমি পাব)</button></div>' +
      '<div class="hero" style="padding:14px 18px;gap:2px"><span style="font-size:13px">' + (taken ? 'মোট ' + bn(list.length) + ' জনকে দিতে হবে' : 'মোট ' + bn(list.length) + ' জনের কাছে পাব') + '</span><b style="font-size:28px">' + U.formatTaka(sum) + '</b></div>';
    if (!list.length) html += '<div class="empty">' + (taken ? 'কারও কাছে ঋণ বাকি নেই।' : 'কারও কাছে পাওনা বাকি নেই।') + '</div>';
    list.forEach(function (g) {
      g.loans.sort(byDue);
      var first = g.loans[0], st = S.status(first, today), c = chipFor(st), tel = telHref(g.contact);
      html += '<div class="item" style="gap:8px"><a href="#/loan/' + h(first.id) + '" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-decoration:none;color:inherit">' +
        '<div class="avatar ' + c.av + '">' + h((g.name || '?').trim().charAt(0)) + '</div>' +
        '<div class="mid"><b>' + h(g.name) + '</b><small>' + (g.loans.length > 1 ? bn(g.loans.length) + 'টি ঋণ • ' : '') + 'পরের শোধ ' + U.formatDateShort(first.dueDate) + '</small></div>' +
        '<div class="end"><b>' + U.formatTaka(g.total) + '</b><span class="chip ' + c.cls + '">' + h(c.text) + '</span></div></a>' +
        (tel ? '<a class="icon-btn" href="' + h(tel) + '" aria-label="কল করুন">' + ic('phone', 20, '#1F5C4A', 2.2) + '</a>' : '') + '</div>';
    });
    html += '</div>' + nav('home');
    render(html);
  }


  /* ---------- মাসিক কিস্তি কমানো / বাড়ানো ---------- */
  function vPlan(id) {
    var l = S.getLoan(id);
    if (!l || S.balance(l) <= 0) { go(l ? '#/loan/' + id : '#/'); return; }
    var bal = S.balance(l), today = U.todayISO(), ri = S.remainingInstallments(l), cur = S.planMonthly(l.plan);
    if (!draft) draft = { monthly: cur ? String(cur / 100) : '', first: ri[0] && ri[0].date >= today ? ri[0].date : today };
    var w = dirWords(l.dir);
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a><h1>মাসিক কিস্তি</h1></div>' +
      '<div class="hero" style="padding:14px 16px;gap:2px"><span style="font-size:13px">' + h(l.name) + ' • ' + w.hero + '</span><b style="font-size:26px">' + U.formatTaka(bal) + '</b>' +
      '<span style="font-size:13px">' + (cur ? 'এখন মাসে ' + U.formatTaka(cur) + ' • বাকি ' + bn(ri.length) + 'টি কিস্তি' : 'এখনো মাসিক কিস্তি ঠিক করা নেই') + '</span></div>' +
      '<div class="field"><label for="p-monthly">নতুন মাসিক অঙ্ক</label><input type="text" inputmode="decimal" class="amount" id="p-monthly" value="' + h(draft.monthly) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('m') + '</div>' +
      '<div class="pills"><button class="pill" data-act="plan-step" data-arg="-100000">− ১,০০০</button><button class="pill" data-act="plan-step" data-arg="-50000">− ৫০০</button>' +
      '<button class="pill" data-act="plan-step" data-arg="50000">+ ৫০০</button><button class="pill" data-act="plan-step" data-arg="100000">+ ১,০০০</button></div>' +
      '<div class="field"><label for="p-first">কোন তারিখের কিস্তি থেকে নতুন অঙ্কে</label><input type="date" id="p-first" value="' + h(draft.first) + '"></div>' +
      '<div class="note-box" id="plan-prev2">' + h(planPreview(bal, U.parseAmount(draft.monthly), draft.first)) + '</div>' +
      '<p class="hint">আগে যা শোধ হয়ে গেছে তা বদলাবে না। শুধু বাকি ' + U.formatTaka(bal) + ' নতুন অঙ্কে ভাগ হবে।</p>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="plan-save" data-arg="' + h(id) + '">সেভ করুন</button></div>';
    render(html);
  }
  function collectPlan() {
    var m = document.getElementById('p-monthly'), f = document.getElementById('p-first');
    if (m) draft.monthly = m.value; if (f && f.value) draft.first = f.value;
  }
  function planSave(id) {
    collectPlan();
    var l = S.getLoan(id); if (!l) { go('#/'); return; }
    var bal = S.balance(l), m = U.parseAmount(draft.monthly);
    if (isNaN(m) || m <= 0) { draft.errors = { m: 'সঠিক মাসিক অঙ্ক লিখুন' }; vPlan(id); return; }
    if (Math.ceil(bal / m) > 120) { draft.errors = { m: 'মাস ১২০-এর বেশি হয়ে যাচ্ছে, অঙ্ক বাড়ান' }; vPlan(id); return; }
    sheet('কিস্তি বদলাবেন?', planPreview(bal, m, draft.first) + '। আগের শোধ বদলাবে না।', 'হ্যাঁ, বদলান', function () {
      S.setMonthlyPlan(id, m, draft.first, !!l.plan);
      afterChange(); toast('মাসিক কিস্তি বদলে গেছে'); go('#/loan/' + id);
    });
  }


  /* ---------- শেয়ার: লিংক পাঠানো ও গ্রহণ ---------- */
  var impPayload = null, lastLink = '', lastLinkId = '';
  function appBase() { return location.origin + location.pathname; }
  function vShare(id) {
    var l = S.getLoan(id);
    if (!l) { go('#/'); return; }
    if (!draft) draft = { name: S.getMyName() };
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a><h1>শেয়ার করুন</h1></div>' +
      '<div class="note-box">অপর পক্ষকে একটি লিংক পাঠাবেন। সে খুলে "গ্রহণ করুন" চাপলে একই হিসাব তার অ্যাপেও আসবে। পরে যে-ই কিছু বদলাবে, নতুন লিংক পাঠালে অন্যজন কী বদলেছে দেখে গ্রহণ করবে। এডিট হিস্টোরিতে কে কতবার বদলেছে দেখা যাবে।</div>' +
      '<div class="card"><h3>কী শেয়ার হয়</h3><p>নাম, টাকার লেনদেন, শোধের তারিখ ও কিস্তি, মওকুফ, এডিট হিস্টোরি, আর চুক্তিপত্র লেখা থাকলে সেটাও (অপর পক্ষের কাছে প্রথমবার পৌঁছালে)।</p>' +
      '<h3>কী শেয়ার হয় না</h3><p>যোগাযোগ নম্বর, আয়-ব্যয়, ডিফল্ট আয়, দোয়া ও রিমাইন্ডার। এগুলো শুধু আপনার কাছে থাকে।</p></div>' +
      '<div class="field"><label for="sh-name">আপনার নাম (অপর পক্ষ এটাই দেখবে)</label><input type="text" id="sh-name" value="' + h(draft.name) + '" autocomplete="off">' + errHtml('name') + '</div>';
    if (l.share) {
      html += '<div class="card"><div class="kv"><span>অপর পক্ষ</span><span>' + h(l.share.peer || 'এখনো গ্রহণ করেনি') + '</span></div>' +
        '<div class="kv"><span>শেষ পাঠানো</span><span>' + (l.share.sentAt ? fmtTime(l.share.sentAt) : 'পাঠানো হয়নি') + '</span></div>' +
        '<div class="kv"><span>শেষ পাওয়া</span><span>' + (l.share.recvAt ? fmtTime(l.share.recvAt) : 'এখনো নেই') + '</span></div></div>';
    }
    if (lastLink && lastLinkId === id) html += '<div class="field"><label for="sh-link">লিংক (কপি করে যেকোনো জায়গায় পাঠাতে পারেন)</label><textarea id="sh-link" rows="3" readonly>' + h(lastLink) + '</textarea></div>';
    html += '<p class="hint">এই লিংকে হিসাবের তথ্য আছে। শুধু যাকে পাঠাতে চান, তাকেই পাঠান।</p>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="share-send" data-arg="' + h(id) + '">' + ic('share', 18, '#fff', 2.2) + (l.share ? ' সর্বশেষ আপডেট পাঠান' : ' লিংক পাঠান') + '</button></div>';
    render(html);
  }
  function shareSend(id) {
    var nm = ((document.getElementById('sh-name') || {}).value || '').trim();
    if (!nm) { draft = { name: '', errors: { name: 'আপনার নাম লিখুন' } }; vShare(id); return; }
    S.setMyName(nm);
    var payload = S.sharedPayload(id, nm);
    if (!payload) return;
    U.packObj(payload).then(function (code) {
      var url = appBase() + '#/import/' + code;
      lastLink = url; lastLinkId = id; S.markSent(id); afterChange();
      var title = 'ঋণের হিসাব';
      if (navigator.share) {
        navigator.share({ title: title, text: nm + ' আপনার সাথে একটি হিসাব শেয়ার করেছে। লিংক খুলে "গ্রহণ করুন" চাপুন:', url: url }).catch(function () { /* বাতিল */ });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('লিংক কপি হয়েছে, এখন পাঠিয়ে দিন'); }, function () { toast('নিচের লিংকটি কপি করে পাঠান'); });
      } else toast('নিচের লিংকটি কপি করে পাঠান');
      draft = { name: nm }; vShare(id);
    }).catch(function () { toast('লিংক বানানো গেল না'); });
  }
  function txRow(t, dir) {
    var add = t.kind === 'add', waive = t.kind === 'waive';
    var lbl = add ? (dir === 'taken' ? 'ঋণ নিলাম' : 'ঋণ দিলাম') : waive ? (dir === 'given' ? 'মওকুফ করলাম' : 'মওকুফ পেলাম') : (dir === 'taken' ? 'শোধ দিলাম' : 'ফেরত পেলাম');
    return '<div class="tx"><div class="mid"><b>' + lbl + '</b><small>' + U.formatDate(t.date) + (t.note && t.note !== 'প্রথম ঋণ' && t.note !== 'প্রথম ঋণ দিলাম' ? ' • ' + h(t.note) : '') + '</small></div>' +
      '<span class="amt" style="color:' + (add ? '#8C1D18' : '#16453A') + '">' + (add ? '+ ' : '− ') + U.formatTaka(t.amount) + '</span></div>';
  }
  function vImport(code) {
    render('<div class="screen"><div class="empty">হিসাব খোলা হচ্ছে…</div></div>');
    U.unpackObj(code).then(function (p) {
      if (!p || p.v !== 1 || !p.sid || !p.txs || !p.terms) throw new Error('bad');
      impPayload = p;
      var pv = S.previewShare(p), me = S.getMyName();
      var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/" aria-label="ফিরে যান">' + ic('back') + '</a><h1>শেয়ার করা হিসাব</h1></div>';
      if (pv.kind === 'new') {
        var tk = pv.myDir === 'taken';
        html += '<div class="hero" style="padding:14px 16px;gap:2px"><span style="font-size:13px">' + h(p.from) + ' আপনার সাথে একটি হিসাব শেয়ার করেছে</span>' +
          '<b style="font-size:26px">' + U.formatTaka(pv.balance) + '</b><span style="font-size:13px">' + (tk ? 'এখন আপনি দেবেন (আমি দেব)' : 'এখন আপনি পাবেন (আমি পাব)') + ' • শোধের তারিখ ' + U.formatDate(p.terms.dueDate) + '</span></div>' +
          (pv.hasContract ? '<div class="note-box">চুক্তিপত্রও পাঠানো হয়েছে। গ্রহণ করলে ঋণের পাতায় দেখতে ও পিডিএফ করতে পারবেন।</div>' : '') +
          '<div class="field"><label for="imp-name">তালিকায় যে নামে থাকবে</label><input type="text" id="imp-name" value="' + h(p.from) + '" autocomplete="off"></div>' +
          '<div class="sec-h"><h2>লেনদেন</h2></div>' + pv.txs.map(function (t) { return txRow(t, pv.myDir); }).join('');
      } else {
        html += '<div class="hero" style="padding:14px 16px;gap:2px"><span style="font-size:13px">' + h(p.from) + ' কিছু বদল পাঠিয়েছে • ' + h(pv.loan.name) + '</span>' +
          '<b style="font-size:26px">' + U.formatTaka(pv.balanceAfter) + '</b><span style="font-size:13px">গ্রহণ করলে বাকি হবে (এখন ' + U.formatTaka(pv.balanceBefore) + ')</span></div>';
        if (pv.contractNew) html += '<div class="note-box">চুক্তিপত্র পাঠানো হয়েছে। গ্রহণ করলে ঋণের পাতায় দেখতে পাবেন।</div>';
        if (!pv.changes.length && !pv.termsNew && !pv.contractNew) html += '<div class="empty">নতুন কোনো বদল নেই। আপনার কাছে সবই আগে থেকে আছে।</div>';
        else {
          html += '<div class="sec-h"><h2>কী কী বদলেছে</h2></div>' + pv.changes.map(function (c) {
            return (c.type === 'del' ? '<div class="note-box">মুছে ফেলেছে:</div>' : '') + txRow(c.tx, pv.dir);
          }).join('');
          if (pv.termsNew) html += '<div class="note-box">শোধের তারিখ বা কিস্তির নিয়ম বদলেছে: শোধ ' + U.formatDate(pv.terms.dueDate) + (pv.terms.plan ? ' • মাসে ' + U.formatTaka(S.planMonthly(pv.terms.plan)) : '') + '</div>';
        }
      }
      html += '</div><div class="bottom-bar"><a class="btn outline" href="#/">বাতিল</a>' + ((pv.kind === 'new' || pv.changes.length || pv.termsNew || pv.newLog || pv.contractNew) ? '<button class="btn" data-act="imp-accept">গ্রহণ করুন</button>' : '') + '</div>';
      render(html);
    }).catch(function () {
      render('<div class="screen"><div class="title-row"><a class="back" href="#/" aria-label="ফিরে যান">' + ic('back') + '</a><h1>শেয়ার করা হিসাব</h1></div><div class="warn-box">লিংকটি ঠিক নেই বা অসম্পূর্ণ। পুরো লিংকটি কপি করে আবার চেষ্টা করুন।</div></div>');
    });
  }
  function impAccept() {
    if (!impPayload) return;
    var nm = document.getElementById('imp-name'), l = S.applyShare(impPayload, S.getMyName(), nm ? nm.value : '');
    impPayload = null; afterChange(); toast('হিসাব গ্রহণ করা হয়েছে'); go('#/loan/' + l.id);
  }

  /* ---------- সিঙ্ক চালু রাখা ---------- */
  var syncTimer = null;
  function scheduleSync() {
    clearTimeout(syncTimer);
    if (!G.configured() || G.getStatus().state === 'signedout') return;
    syncTimer = setTimeout(function () { G.syncAll(false); }, 1200);
  }
  function afterChange() { scheduleSync(); }

  /* ---------- ক্লিক ও ইনপুট ---------- */
  var actions = {
    chip: function () {
      var st = G.getStatus().state;
      if (!G.configured()) { go('#/settings'); return; }
      if (st === 'ok' || st === 'syncing') { go('#/settings'); return; }
      G.syncAll(true);
    },
    soon: function (t, e) { e.preventDefault(); toast('এটা পরের ধাপে আসছে'); },
    dir: function (t) { ui.dir = t.getAttribute('data-arg'); localStorage.setItem('rin_dir', ui.dir); vHome(); },
    'form-dir': function (t) { collectLoan(); draft.dir = t.getAttribute('data-arg'); vLoanForm(); },
    'form-mode': function (t) { collectLoan(); draft.mode = t.getAttribute('data-arg'); vLoanForm(current.name === 'edit' ? current.p[1] : null); },
    'form-remind': function (t) { collectLoan(); draft.remind = +t.getAttribute('data-arg'); vLoanForm(current.name === 'edit' ? current.p[1] : null); },
    'form-contract': function () { collectLoan(); draft.contract = !draft.contract; vLoanForm(); },
    'save-loan': function (t) { saveLoan(t.getAttribute('data-arg') || null); },
    'tx-kind': function (t) { collectTx(); draft.kind = t.getAttribute('data-arg'); draft.full = false; vTx(current.p[1], draft.kind); },
    'tx-full': function () { collectTx(); draft.full = !draft.full; vTx(current.p[1], draft.kind); },
    'tx-full-set': function (t) { collectTx(); draft.full = t.getAttribute('data-arg') === '1'; vTx(current.p[1], draft.kind); },
    'save-tx': function (t) { saveTx(t.getAttribute('data-arg')); },
    'del-tx': function (t) {
      var id = current.p[1], txId = t.getAttribute('data-arg');
      sheet('লেনদেনটি মুছবেন?', 'মুছলে ব্যালেন্স আবার হিসাব হবে।', 'মুছুন', function () { S.deleteTx(id, txId); afterChange(); toast('মুছে ফেলা হয়েছে'); }, true);
    },
    'del-loan': function (t) {
      var id = t.getAttribute('data-arg');
      sheet('এই ঋণের পুরো হিসাব মুছবেন?', 'লেনদেন, চুক্তিপত্র ও ক্যালেন্ডারের রিমাইন্ডার সব যাবে।', 'মুছুন', function () { S.deleteLoan(id); afterChange(); go('#/'); toast('মুছে ফেলা হয়েছে'); }, true);
    },
    'fin-kind': function (t) { fin.kind = t.getAttribute('data-arg'); fin.anchor = U.todayISO(); fin.allCats = false; fin.allList = false; vMoney(); },
    'fin-prev': function () { fin.anchor = S.shiftAnchor(fin.kind, fin.anchor, -1); vMoney(); },
    'fin-next': function () { fin.anchor = S.shiftAnchor(fin.kind, fin.anchor, 1); vMoney(); },
    'fin-cv': function (t) { fin.cv = t.getAttribute('data-arg'); fin.allCats = false; vMoney(); },
    'fin-allcats': function () { fin.allCats = !fin.allCats; vMoney(); },
    'fin-alllist': function () { fin.allList = !fin.allList; vMoney(); },
    'report-pdf': function () { reportPdf(); },
    'entry-type': function (t) { collectEntry(); draft.type = t.getAttribute('data-arg'); draft.cat = ''; draft.newCat = false; vEntry(); },
    'entry-addcat': function () {
      var el = document.getElementById('e-newcat'), name = el ? el.value : '';
      collectEntry();
      var added = S.addCat(draft.type, name);
      if (!added) { draft.errors = { cat: 'খাতের নাম লিখুন (ঋণ শোধ নামটি ব্যবহার করা যাবে না)' }; vEntry(); return; }
      draft.cat = added; draft.newCat = false; draft.errors = null; afterChange(); vEntry();
    },
    'save-entry': function () { saveEntry(); },
    'del-entry': function (t) {
      var id = t.getAttribute('data-arg');
      sheet('লেনদেনটি মুছবেন?', 'মুছলে আয়-ব্যয়ের হিসাব আবার মিলিয়ে নেওয়া হবে।', 'মুছুন', function () { S.deleteEntry(id); afterChange(); toast('মুছে ফেলা হয়েছে'); }, true);
    },
    'dua-tap': function () { duaSetCount(localStorage.getItem('rin_dua'), 1); },
    'dua-undo': function () { duaSetCount(localStorage.getItem('rin_dua'), -1); },
    'dua-reset': function () {
      var id = localStorage.getItem('rin_dua');
      sheet('আজকের গণনা শূন্য করবেন?', 'আজকের গণনা ০ হয়ে যাবে।', 'শূন্য করুন', function () { duaSetCount(id, 0, 0); }, true);
    },
    'dua-addtime': function () { collectDua(); draft.times.push('12:00'); vDuaForm(current.p[2] && current.p[1] === 'edit' ? current.p[2] : null, current.p[2] === 'sample'); },
    'dua-deltime': function (t) { collectDua(); draft.times.splice(+t.getAttribute('data-arg'), 1); vDuaForm(current.p[1] === 'edit' ? current.p[2] : null, current.p[2] === 'sample'); },
    'dua-addlib': function (t) {
      var d = DUA_LIB[+t.getAttribute('data-arg')]; if (!d) return;
      var made = S.createDua({ title: d.title, arabic: d.arabic, translit: d.translit, meaning: d.meaning, target: d.target, times: [] });
      localStorage.setItem('rin_dua', made.id); afterChange(); toast('যোগ হয়েছে। দোয়া পেজে গিয়ে লক্ষ্য ও সময় ঠিক করুন'); vDuaLib();
    },
    'save-dua': function (t) { saveDua(t.getAttribute('data-arg') || null); },
    'del-dua': function (t) {
      var id = t.getAttribute('data-arg');
      sheet('এই দোয়া মুছবেন?', 'গণনার হিসাব ও ক্যালেন্ডারের রিমাইন্ডার সব যাবে।', 'মুছুন', function () { S.deleteDua(id); afterChange(); toast('মুছে ফেলা হয়েছে'); }, true);
    },
    'save-contract': function (t) { saveContract(t.getAttribute('data-arg')); },
    'pdf-dl': function (t) { pdfAction(t.getAttribute('data-arg'), 'download'); },
    'pdf-share': function (t) { pdfAction(t.getAttribute('data-arg'), 'share'); },
    'sync-now': function () {
      var st = G.getStatus().state;
      G.syncAll(!(st === 'ok' || st === 'syncing'));
    },
    logout: function () {
      sheet('লগআউট করবেন?', 'ফোনের ডাটা মুছবে না। আবার লগিন করলে ড্রাইভের সাথে মিলবে।', 'লগআউট', function () { G.signOut(); }, true);
    },
    'test-remind': function () {
      G.createTestReminder().then(function () { toast('ঠিক আছে! ৫ মিনিট পরে নোটিফিকেশন দেখুন'); })
        .catch(function (e) { toast('হয়নি: ' + (e && e.message ? e.message.slice(0, 60) : 'আগে লগিন করুন')); });
    },
    backup: function () {
      var blob = new Blob([JSON.stringify(S.getState(), null, 2)], { type: 'application/json' });
      C.download(blob, 'rin-backup-' + U.todayISO() + '.json');
    },
    'del-person': function (t) { S.deletePerson(t.getAttribute('data-arg')); afterChange(); vSettings(); },
    'waive-full': function (t) { collectWaive(); draft.full = t.getAttribute('data-arg') === '1'; vWaive(current.p[1]); },
    'waive-go': function (t) { waiveGo(t.getAttribute('data-arg')); },
    'pick-contact': function (t) {
      var where = t.getAttribute('data-arg');
      pickContact(function (name, tel) {
        function setv(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
        if (where === 'loan') {
          var n = document.getElementById('f-name');
          if (n && !n.value.trim() && name) n.value = name;
          setv('f-contact', tel);
        } else if (where === 'me') {
          S.setProfile(undefined, tel); afterChange(); setv('s-phone', tel); toast('আমার নম্বর সেভ হয়েছে');
        } else if (where === 'cphone') setv('c-phone', tel);
        else if (where === 'w1' || where === 'w2') setv('c-' + where, [name, tel].filter(Boolean).join(', '));
      });
    },
    'pt-dir': function (t) { ui.dir = t.getAttribute('data-arg'); localStorage.setItem('rin_dir', ui.dir); vParties(); },
    'plan-step': function (t) {
      collectPlan();
      var l = S.getLoan(current.p[1]), bal = l ? S.balance(l) : 0, cur = parseFloat(U.fromBn(draft.monthly)) || 0;
      var v = Math.max(100, Math.round(cur * 100) + (+t.getAttribute('data-arg')));
      draft.monthly = String(Math.min(v, bal) / 100); draft.errors = null; vPlan(current.p[1]);
    },
    'plan-save': function (t) { planSave(t.getAttribute('data-arg')); },
    'share-send': function (t) { shareSend(t.getAttribute('data-arg')); },
    'imp-accept': function () { impAccept(); },
    'do-update': function () { doUpdate(); },
    'check-update': function () { checkUpdate(true); },
    'sch-dir': function (t) { ui.dir = t.getAttribute('data-arg'); localStorage.setItem('rin_dir', ui.dir); vSchedule(); },
    'fc-prev': function () { fc.key = U.addMonths(fc.key + '-01', -1).slice(0, 7); vForecast(); },
    'fc-next': function () { fc.key = U.addMonths(fc.key + '-01', 1).slice(0, 7); vForecast(); },
    'def-type': function (t) { collectDefault(); draft.type = t.getAttribute('data-arg'); draft.name = ''; vDefault('new', draft.type); },
    'save-default': function (t) { saveDefault(t.getAttribute('data-arg') || null); },
    'del-default': function (t) {
      var id = t.getAttribute('data-arg');
      sheet('এটা মুছবেন?', monthLabel(fc.key) + ' থেকে এই ডিফল্ট আর ধরা হবে না। আগের মাসের হিসাব ঠিক থাকবে।', 'মুছুন', function () { S.deleteDefault(id, fc.key); afterChange(); vForecast(); }, true);
    },
    install: function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.then(function () { installPrompt = null; if (current.name === 'settings') vSettings(); });
    }
  };

  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !actions[t.getAttribute('data-act')]) return;
    actions[t.getAttribute('data-act')](t, e);
  });
  root.addEventListener('input', function (e) {
    if (e.target.id === 'f-amount' && current.name === 'tx') updateTxPreview();
    if ((e.target.id === 'f-monthly' || e.target.id === 'f-amount' || e.target.id === 'f-first') && (current.name === 'add' || current.name === 'edit')) {
      var pv = document.getElementById('plan-prev'), l0 = current.name === 'edit' ? S.getLoan(current.p[1]) : null;
      if (pv) pv.textContent = planPreview(l0 ? S.balance(l0) : U.parseAmount((document.getElementById('f-amount') || {}).value), U.parseAmount((document.getElementById('f-monthly') || {}).value), (document.getElementById('f-first') || {}).value);
    }
    if ((e.target.id === 'p-monthly' || e.target.id === 'p-first') && current.name === 'plan') {
      var l1 = S.getLoan(current.p[1]), pv2 = document.getElementById('plan-prev2');
      if (l1 && pv2) pv2.textContent = planPreview(S.balance(l1), U.parseAmount(document.getElementById('p-monthly').value), document.getElementById('p-first').value);
    }
  });
  root.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'r-from' || id === 'r-to') { fin[id === 'r-from' ? 'from' : 'to'] = e.target.value; vMoney(); return; }
    if (id === 'e-cat' && e.target.value === '__new') { collectEntry(); draft.newCat = true; vEntry(); return; }
    if (id === 's-me') { S.setProfile(e.target.value); afterChange(); toast('সেভ হয়েছে'); return; }
    if (id === 's-phone') { S.setProfile(undefined, e.target.value); afterChange(); toast('সেভ হয়েছে'); return; }
    if (id === 'f-name') {
      var pf = S.findPerson(e.target.value, false), cf = document.getElementById('f-contact');
      if (pf && cf && !cf.value.trim() && pf.contact) cf.value = pf.contact;
      return;
    }
    if (id === 'c-w1' || id === 'c-w2') return;
    if (id === 'dua-sel') { localStorage.setItem('rin_dua', e.target.value); vDua(); return; }
    if (e.target.id !== 'restore-file' || !e.target.files || !e.target.files[0]) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var obj = JSON.parse(rd.result);
        if (!obj || !Array.isArray(obj.loans)) throw new Error('bad');
        S.applyMerged(obj); afterChange(); toast('ফিরিয়ে আনা হয়েছে');
      } catch (err) { toast('ফাইলটি সঠিক ব্যাকআপ নয়'); }
    };
    rd.readAsText(e.target.files[0]);
  });

  /* ---------- রাউটার ---------- */
  function route() {
    var p = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    var key = p.join('/');
    if (key !== current.key) { draft = null; window.scrollTo(0, 0); }
    current = { key: key, name: p[0] || 'home', p: p };
    if (current.name === 'add') vLoanForm();
    else if (current.name === 'edit') vLoanForm(p[1]);
    else if (current.name === 'loan') vLoan(p[1]);
    else if (current.name === 'tx') vTx(p[1], p[2] === 'add' ? 'add' : 'pay');
    else if (current.name === 'contract') { if (p[2] === 'edit') vContractForm(p[1]); else vContractView(p[1]); }
    else if (current.name === 'money') vMoney();
    else if (current.name === 'entry') vEntry();
    else if (current.name === 'dua') { if (p[1] === 'lib') vDuaLib(); else if (p[1] === 'new') vDuaForm(null, p[2] === 'sample'); else if (p[1] === 'edit') vDuaForm(p[2]); else if (p[1] === 'open') vDua(p[2]); else vDuaList(); }
    else if (current.name === 'settings') vSettings();
    else if (current.name === 'share') vShare(p[1]);
    else if (current.name === 'import') vImport(p.slice(1).join('/'));
    else if (current.name === 'plan') vPlan(p[1]);
    else if (current.name === 'parties') vParties();
    else if (current.name === 'waive') vWaive(p[1]);
    else if (current.name === 'schedule') vSchedule();
    else if (current.name === 'log') vLog(p[1]);
    else if (current.name === 'forecast') vForecast();
    else if (current.name === 'default') vDefault(p[1], p[2]);
    else { current.name = 'home'; vHome(); }
  }

  window.addEventListener('hashchange', route);
  S.onChange(function () { if (['home', 'loan', 'settings', 'money', 'schedule', 'log', 'forecast', 'parties'].indexOf(current.name) >= 0) route(); });
  G.onStatus(function () {
    if (current.name === 'home' || current.name === 'money' || current.name === 'dua') refreshChip();
    else if (current.name === 'settings') vSettings();
    else if (current.name === 'contract' && current.p[2] !== 'edit') vContractView(current.p[1]);
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; if (current.name === 'settings') vSettings(); });
  window.addEventListener('online', scheduleSync);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { scheduleSync(); checkUpdate(false); } });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* অফলাইন ক্যাশ ছাড়াই চলবে */ });

  function waitGoogle(cb, tries) {
    tries = tries || 0;
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) { cb(); return; }
    if (tries > 40) return;
    setTimeout(function () { waitGoogle(cb, tries + 1); }, 250);
  }

  route();
  checkUpdate(false);
  if (G.configured() && localStorage.getItem('rin_signed_in')) {
    if (G.redirectMode()) G.syncAll(false); else waitGoogle(function () { G.syncAll(false); });
  }
})();
