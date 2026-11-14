/* স্ক্রিন, নেভিগেশন আর ব্যবহারকারীর কাজ — ধাপ ১ (ঋণ, চুক্তিপত্র, সিঙ্ক, রিমাইন্ডার) */
(function () {
  'use strict';
  var U = RinUtil, S = RinStore, C = RinContract, G = RinGoogle;
  var h = U.escapeHtml, bn = U.toBn;

  S.setStorage(window.localStorage);
  S.load();

  var root = document.getElementById('app');
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
  function render(html) { root.innerHTML = html; }
  function isOpenLoan(l) { return S.balance(l) > 0; }
  function byDue(a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; }
  function telHref(c) {
    var d = U.fromBn(c || '').replace(/[\s\-]/g, '');
    return /^\+?\d{6,15}$/.test(d) ? 'tel:' + d : null;
  }
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
      '<div class="top"><div><span class="sub">আসসালামু আলাইকুম</span><h1>আমার ঋণ</h1></div>' + chipHtml() + '</div>' +
      '<div class="hero"><div><div class="lbl">' + w.total + '</div><div class="big">' + U.formatTaka(sum.total) + '</div></div>' +
      '<div class="grid2"><div class="mini"><span>মেয়াদ পার</span><b>' + U.formatTaka(sum.overdue) + '</b></div>' +
      '<div class="mini"><span>আগামী ৭ দিনে</span><b>' + U.formatTaka(sum.next7) + '</b></div></div></div>' +
      '<div class="seg c2" role="tablist"><button data-act="dir" data-arg="taken" class="' + (dir === 'taken' ? 'active' : '') + '">আমি দেব</button>' +
      '<button data-act="dir" data-arg="given" class="' + (dir === 'given' ? 'active' : '') + '">আমি পাব</button></div>' +
      '<div class="sec-h"><h2>' + w.list + ' (' + bn(open.length) + ' জন)</h2><span>তারিখ অনুযায়ী</span></div>';
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
    ['name', 'contact', 'amount', 'date', 'due'].forEach(function (k) {
      var e = document.getElementById('f-' + k);
      if (e) draft[k] = e.value;
    });
  }
  function errHtml(k) { return draft.errors && draft.errors[k] ? '<span class="err">' + h(draft.errors[k]) + '</span>' : ''; }

  function vLoanForm(editId) {
    var loan = editId ? S.getLoan(editId) : null;
    if (editId && !loan) { go('#/'); return; }
    if (!draft) {
      var t = U.todayISO();
      draft = loan
        ? { dir: loan.dir, name: loan.name, contact: loan.contact, due: loan.dueDate, mode: loan.mode, remind: loan.remind }
        : { dir: ui.dir, name: '', contact: '', amount: '', date: t, due: U.addMonths(t, 1), mode: 'full', remind: 1, contract: true };
    }
    var w = dirWords(draft.dir);
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="' + (loan ? '#/loan/' + h(loan.id) : '#/') + '" aria-label="ফিরে যান">' + ic('back') + '</a>' +
      '<h1>' + (loan ? 'ঋণ সম্পাদনা' : 'নতুন ঋণ') + '</h1></div>';
    if (!loan) {
      html += '<div class="seg c2"><button data-act="form-dir" data-arg="taken" class="' + (draft.dir === 'taken' ? 'active' : '') + '">ঋণ নিলাম</button>' +
        '<button data-act="form-dir" data-arg="given" class="' + (draft.dir === 'given' ? 'active' : '') + '">ঋণ দিলাম</button></div>';
    }
    html += '<div class="field"><label for="f-name">' + w.person + '</label><input type="text" id="f-name" value="' + h(draft.name) + '" autocomplete="off">' + errHtml('name') + '</div>' +
      '<div class="field"><label for="f-contact">যোগাযোগ (ফোন বা ঠিকানা)</label><input type="text" id="f-contact" value="' + h(draft.contact) + '" autocomplete="off"></div>';
    if (!loan) {
      html += '<div class="field"><label for="f-amount">টাকার পরিমাণ</label><input type="text" inputmode="decimal" class="amount" id="f-amount" value="' + h(draft.amount) + '" placeholder="৳ ০" autocomplete="off">' + errHtml('amount') + '</div>' +
        '<div class="row2"><div class="field"><label for="f-date">ঋণের তারিখ</label><input type="date" id="f-date" value="' + h(draft.date) + '"></div>' +
        '<div class="field"><label for="f-due">শোধের তারিখ</label><input type="date" id="f-due" value="' + h(draft.due) + '"></div></div>';
    } else {
      html += '<div class="field"><label for="f-due">শোধের তারিখ</label><input type="date" id="f-due" value="' + h(draft.due) + '"></div>';
    }
    html += errHtml('due') +
      '<div class="field"><span class="lbl">শোধের ধরন</span><div class="seg c2"><button data-act="form-mode" data-arg="full" class="' + (draft.mode === 'full' ? 'active' : '') + '">একবারে পুরো</button>' +
      '<button data-act="form-mode" data-arg="partial" class="' + (draft.mode === 'partial' ? 'active' : '') + '">কিস্তিতে (আংশিক)</button></div></div>' +
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
    if (!draft.due) errors.due = 'শোধের তারিখ দিন';
    if (!editId) {
      amount = U.parseAmount(draft.amount);
      if (isNaN(amount) || amount <= 0) errors.amount = 'সঠিক টাকার পরিমাণ লিখুন';
      if (draft.due && draft.date && draft.due < draft.date) errors.due = 'শোধের তারিখ ঋণের তারিখের আগে হতে পারে না';
      if (!draft.date) errors.date = 'ঋণের তারিখ দিন';
    }
    if (Object.keys(errors).length) { draft.errors = errors; vLoanForm(editId); window.scrollTo(0, 0); return; }
    if (editId) {
      S.updateLoan(editId, { name: draft.name.trim(), contact: draft.contact.trim(), dueDate: draft.due, mode: draft.mode, remind: draft.remind });
      afterChange(); toast('বদল সেভ হয়েছে'); go('#/loan/' + editId); return;
    }
    var loan = S.createLoan({ name: draft.name.trim(), contact: draft.contact.trim(), dir: draft.dir, amount: amount, date: draft.date, dueDate: draft.due, mode: draft.mode, remind: draft.remind });
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
    html += l.contract
      ? '<a class="linkcard" href="#/contract/' + h(l.id) + '">' + ic('file', 24, '#1F5C4A', 2) + '<div class="mid"><b>ঋণ চুক্তিপত্র</b><small>' + U.formatDate(l.contract.date) + (l.contract.w1 || l.contract.w2 ? ' • সাক্ষী আছে' : '') + '</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>'
      : '<a class="linkcard" href="#/contract/' + h(l.id) + '/edit">' + ic('file', 24, '#1F5C4A', 2) + '<div class="mid"><b>চুক্তিপত্র লিখুন</b><small>তারিখ, টাকা, মেয়াদ ও সাক্ষীসহ</small></div>' + ic('chev', 18, '#5B635E', 2.4) + '</a>';
    html += '<div class="sec-h"><h2>লেনদেনের ইতিহাস</h2></div>';
    html += txs.map(function (t) {
      var add = t.kind === 'add';
      return '<div class="tx"><div class="ic ' + (add ? 't-red' : 't-green') + '">' + ic(add ? 'plus' : 'back', 18, 'currentColor', 2.6).replace('<path d="M15 5l-7 7 7 7"/>', '<path d="M5 12h14"/>') + '</div>' +
        '<div class="mid"><b>' + h(txLabel(l, t)) + '</b><small>' + U.formatDate(t.date) + (t.note && t.note !== 'প্রথম ঋণ' && t.note !== 'প্রথম ঋণ দিলাম' ? ' • ' + h(t.note) : '') + '</small></div>' +
        '<span class="amt" style="color:' + (add ? '#8C1D18' : '#16453A') + '">' + (add ? '+ ' : '− ') + U.formatTaka(t.amount) + '</span>' +
        '<button class="x" data-act="del-tx" data-arg="' + h(t.id) + '" aria-label="এই লেনদেন মুছুন">' + ic('x', 18, 'currentColor', 2.4) + '</button></div>';
    }).join('');
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
      draft = { myInfo: c.myInfo || '', otherInfo: c.otherInfo || '', medium: c.medium || C.MEDIUMS[0], interest: c.interest || C.INTERESTS[0], w1: c.w1 || '', w2: c.w2 || '', extra: c.extra || '' };
    }
    var lender = l.dir === 'taken' ? l.name : 'আমি', borrower = l.dir === 'taken' ? 'আমি' : l.name;
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/loan/' + h(id) + '" aria-label="ফিরে যান">' + ic('back') + '</a>' +
      '<div><h1 style="font-size:22px">চুক্তিপত্র লিখুন</h1><span style="font-size:13px;color:#5B635E">ধাপ ২ / ২</span></div></div>' +
      '<div class="hero" style="padding:14px 16px;gap:4px;font-size:14px;line-height:1.6"><span style="font-size:12px">ঋণের তথ্য থেকে নেওয়া</span>' +
      '<b>ঋণদাতা ' + h(lender) + ' → ঋণগ্রহীতা ' + h(borrower) + '</b><span>' + U.formatTaka(fa.amount) + ' (' + h(U.takaInWords(fa.amount)) + ')</span>' +
      '<span>ঋণের তারিখ ' + U.formatDate(fa.date) + ' • শোধ ' + U.formatDate(l.dueDate) + ' (' + U.termText(fa.date, l.dueDate) + ')</span></div>' +
      '<div class="field"><label for="c-my">আমার নাম ও ঠিকানা</label><input type="text" id="c-my" value="' + h(draft.myInfo) + '" placeholder="নাম, গ্রাম/এলাকা, জেলা" autocomplete="off"></div>' +
      '<div class="field"><label for="c-other">অপর পক্ষের ঠিকানা (ঐচ্ছিক)</label><input type="text" id="c-other" value="' + h(draft.otherInfo) + '" placeholder="ঠিকানা বা পরিচয়পত্র নম্বর" autocomplete="off"></div>' +
      '<div class="field"><label for="c-medium">টাকা দেওয়ার মাধ্যম</label>' + selectHtml('c-medium', C.MEDIUMS, draft.medium) + '</div>' +
      '<div class="field"><label for="c-interest">সুদ</label>' + selectHtml('c-interest', C.INTERESTS, draft.interest) + '</div>' +
      '<div class="field"><label for="c-w1">সাক্ষী ১ (নাম ও ফোন)</label><input type="text" id="c-w1" value="' + h(draft.w1) + '" placeholder="নাম, মোবাইল নম্বর" autocomplete="off"></div>' +
      '<div class="field"><label for="c-w2">সাক্ষী ২ (নাম ও ফোন)</label><input type="text" id="c-w2" value="' + h(draft.w2) + '" placeholder="নাম, মোবাইল নম্বর" autocomplete="off"></div>' +
      '<div class="field"><label for="c-extra">অতিরিক্ত শর্ত (ঐচ্ছিক)</label><input type="text" id="c-extra" value="' + h(draft.extra) + '" placeholder="যেমন: বাকি টাকা দুই কিস্তিতে" autocomplete="off"></div>' +
      '</div><div class="bottom-bar"><button class="btn" data-act="save-contract" data-arg="' + h(id) + '">চুক্তিপত্র তৈরি করুন</button></div>';
    render(html);
  }
  function saveContract(id) {
    var l = S.getLoan(id), fa = l && firstAdd(l);
    if (!l || !fa) { go('#/'); return; }
    function v(i) { return (document.getElementById(i) || {}).value || ''; }
    var contract = {
      myInfo: v('c-my').trim(), otherInfo: v('c-other').trim(), medium: v('c-medium'), interest: v('c-interest'),
      w1: v('c-w1').trim(), w2: v('c-w2').trim(), extra: v('c-extra').trim(),
      amount: fa.amount, date: fa.date, dueDate: l.dueDate, mode: l.mode, createdAt: Date.now()
    };
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
    if (installPrompt) html += '<div class="card"><h3>অ্যাপ ইনস্টল</h3><p>হোম স্ক্রিনে অ্যাপের মতো রাখতে ইনস্টল করুন।</p><button class="btn small" data-act="install">ইনস্টল করুন</button></div>';
    html += '<div class="card"><h3>অ্যাপ সম্পর্কে</h3><div class="kv"><span>সংস্করণ</span><span>ধাপ ৩ • v2.0</span></div>' +
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
    meaning: 'হে আল্লাহ, আপনি আপনার হালাল দিয়ে আমাকে হারাম থেকে যথেষ্ট করে দিন এবং আপনার অনুগ্রহে আপনি ছাড়া অন্য সবার থেকে আমাকে অমুখাপেক্ষী করুন।',
    target: '100', times: ['05:30', '21:00']
  };
  function duaPercent(d, n) { return Math.min(100, Math.round(n * 100 / Math.max(1, d.target))); }
  function daysHtml(d) {
    var max = Math.max(d.target, 1);
    return S.duaLastDays(d, U.todayISO(), 7).map(function (x) {
      var hgt = Math.max(6, Math.min(56, Math.round(x.n * 56 / max)));
      return '<div><i class="' + (x.n >= d.target ? 'ok' : '') + '" style="height:' + hgt + 'px"></i><span>' + bn(x.n) + '</span></div>';
    }).join('');
  }
  function vDua() {
    var list = S.liveDuas(), today = U.todayISO();
    var html = '<div class="screen"><div class="top"><div><span class="sub">প্রতিদিনের আমল</span><h1>দোয়া</h1></div>' + chipHtml() + '</div>';
    if (!list.length) {
      html += '<div class="empty">কোনো দোয়া যোগ করা নেই। নিজের দোয়া লিখতে পারেন, অথবা নিচের নমুনা দিয়ে শুরু করুন।</div>' +
        '<a class="btn" href="#/dua/new">নতুন দোয়া যোগ করুন</a><a class="btn outline" href="#/dua/new/sample">ঋণ পরিশোধের দোয়া দিয়ে শুরু</a></div>' + nav('dua');
      render(html); return;
    }
    var sel = localStorage.getItem('rin_dua'), d = S.getDua(sel) || list[0];
    localStorage.setItem('rin_dua', d.id);
    var n = S.duaCount(d, today), pct = duaPercent(d, n);
    html += '<div class="duasel"><select id="dua-sel" aria-label="দোয়া বাছুন">' + list.map(function (x) {
      return '<option value="' + h(x.id) + '"' + (x.id === d.id ? ' selected' : '') + '>' + h(x.title) + '</option>';
    }).join('') + '</select><a class="btn small" href="#/dua/new">' + ic('plus', 16, '#fff', 2.6) + 'নতুন</a></div>' +
      '<div class="dua-card"><b style="font-size:18px">' + h(d.title) + '</b>' +
      (d.arabic ? '<div class="ar" lang="ar">' + h(d.arabic) + '</div>' : '') + (d.meaning ? '<div class="mean">' + h(d.meaning) + '</div>' : '') +
      '<div class="counter-wrap"><button class="counter' + (n >= d.target ? ' done' : '') + '" id="cnt-btn" data-act="dua-tap" style="--p:' + pct + '" aria-label="গণনা করুন">' +
      '<span><b id="cnt-n">' + bn(n) + '</b><small>আজ / লক্ষ্য <span id="cnt-t" style="display:inline">' + bn(d.target) + '</span></small></span></button>' +
      '<div style="display:flex;gap:8px"><button class="btn outline small" data-act="dua-undo">− ১ কমান</button><button class="btn outline small" data-act="dua-reset">আজকের গণনা শূন্য</button></div></div>' +
      '<div class="sec-h"><h2>শেষ ৭ দিন</h2></div><div class="days7" id="days7">' + daysHtml(d) + '</div></div>' +
      '<div class="card"><h3>রিমাইন্ডার</h3><p>' + (d.times && d.times.length ? 'প্রতিদিন ' + d.times.map(function (t) { return bn(t); }).join(', ') + ' টায় গুগল ক্যালেন্ডারে নোটিফিকেশন আসবে।' : 'কোনো সময় ঠিক করা নেই।') + '</p>' +
      '<div style="display:flex;gap:8px"><a class="btn outline small" href="#/dua/edit/' + h(d.id) + '">' + ic('edit', 16, 'currentColor', 2.2) + ' সম্পাদনা</a>' +
      '<button class="btn danger small" data-act="del-dua" data-arg="' + h(d.id) + '">মুছুন</button></div></div></div>' + nav('dua');
    render(html);
  }
  function duaSetCount(id, delta, absolute) {
    var d = S.getDua(id); if (!d) return;
    var today = U.todayISO(), before = S.duaCount(d, today);
    var n = absolute != null ? S.setDuaCount(id, today, absolute) : S.bumpDua(id, today, delta);
    var btn = document.getElementById('cnt-btn');
    if (btn) { btn.style.setProperty('--p', duaPercent(d, n)); btn.classList.toggle('done', n >= d.target); }
    var el = document.getElementById('cnt-n'); if (el) el.textContent = bn(n);
    var dy = document.getElementById('days7'); if (dy) dy.innerHTML = daysHtml(d);
    if (delta > 0 && navigator.vibrate) { try { navigator.vibrate(n === d.target ? [30, 40, 60] : 12); } catch (e) { /* ignore */ } }
    if (delta > 0 && before < d.target && n >= d.target) toast('আলহামদুলিল্লাহ, আজকের লক্ষ্য পূর্ণ হয়েছে');
    scheduleSync();
  }

  function collectDua() {
    ['title', 'arabic', 'meaning', 'target'].forEach(function (k) {
      var e = document.getElementById('d-' + k); if (e) draft[k] = e.value;
    });
    var ts = document.querySelectorAll('.t-in');
    if (ts.length) draft.times = Array.prototype.map.call(ts, function (x) { return x.value; });
  }
  function vDuaForm(id, sample) {
    var d = id ? S.getDua(id) : null;
    if (id && !d) { go('#/dua'); return; }
    if (!draft) {
      draft = d ? { title: d.title, arabic: d.arabic, meaning: d.meaning, target: String(d.target), times: d.times.slice() }
        : sample ? JSON.parse(JSON.stringify(SAMPLE_DUA)) : { title: '', arabic: '', meaning: '', target: '100', times: ['21:00'] };
    }
    var html = '<div class="screen form"><div class="title-row"><a class="back" href="#/dua" aria-label="ফিরে যান">' + ic('back') + '</a><h1>' + (d ? 'দোয়া সম্পাদনা' : 'নতুন দোয়া') + '</h1></div>';
    if (sample && !d) html += '<div class="note-box">এটি প্রচলিত একটি নমুনা। ব্যবহারের আগে নিজের বই বা আলেমের কাছ থেকে মিলিয়ে নিন, দরকারে বদলে ফেলুন।</div>';
    html += '<div class="field"><label for="d-title">দোয়ার নাম</label><input type="text" id="d-title" value="' + h(draft.title) + '" autocomplete="off">' + errHtml('title') + '</div>' +
      '<div class="field"><label for="d-arabic">আরবি / মূল পাঠ</label><textarea id="d-arabic" rows="3" dir="auto">' + h(draft.arabic) + '</textarea></div>' +
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
    var data = { title: draft.title.trim(), arabic: draft.arabic.trim(), meaning: draft.meaning.trim(), target: t, times: draft.times.filter(Boolean) };
    var d = id ? S.updateDua(id, data) : S.createDua(data);
    localStorage.setItem('rin_dua', d.id);
    afterChange(); toast('সেভ হয়েছে'); go('#/dua');
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
  });
  root.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'r-from' || id === 'r-to') { fin[id === 'r-from' ? 'from' : 'to'] = e.target.value; vMoney(); return; }
    if (id === 'e-cat' && e.target.value === '__new') { collectEntry(); draft.newCat = true; vEntry(); return; }
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
    else if (current.name === 'dua') { if (p[1] === 'new') vDuaForm(null, p[2] === 'sample'); else if (p[1] === 'edit') vDuaForm(p[2]); else vDua(); }
    else if (current.name === 'settings') vSettings();
    else { current.name = 'home'; vHome(); }
  }

  window.addEventListener('hashchange', route);
  S.onChange(function () { if (['home', 'loan', 'settings', 'money'].indexOf(current.name) >= 0) route(); });
  G.onStatus(function () {
    if (current.name === 'home' || current.name === 'money' || current.name === 'dua') refreshChip();
    else if (current.name === 'settings') vSettings();
    else if (current.name === 'contract' && current.p[2] !== 'edit') vContractView(current.p[1]);
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; if (current.name === 'settings') vSettings(); });
  window.addEventListener('online', scheduleSync);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') scheduleSync(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* অফলাইন ক্যাশ ছাড়াই চলবে */ });

  function waitGoogle(cb, tries) {
    tries = tries || 0;
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) { cb(); return; }
    if (tries > 40) return;
    setTimeout(function () { waitGoogle(cb, tries + 1); }, 250);
  }

  route();
  if (G.configured() && localStorage.getItem('rin_signed_in')) {
    if (G.redirectMode()) G.syncAll(false); else waitGoogle(function () { G.syncAll(false); });
  }
})();
