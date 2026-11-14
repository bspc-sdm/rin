/* ডাটা রাখা (ফোনে), ব্যালেন্সের হিসাব, আর দুই ডিভাইসের ডাটা মেলানো (merge) */
(function (root) {
  'use strict';
  var U = (typeof module !== 'undefined' && module.exports) ? require('./util.js') : root.RinUtil;

  var KEY = 'rin_data_v1';
  var DEFAULT_CATS = {
    expense: ['খাবার', 'যাতায়াত', 'বাসা ভাড়া', 'বিল', 'চিকিৎসা', 'শিক্ষা', 'কেনাকাটা', 'দান', 'অন্যান্য'],
    income: ['বেতন', 'ব্যবসা', 'উপহার', 'অন্যান্য']
  };
  var LOAN_CAT = 'ঋণ শোধ';

  var storage = null;
  var state = emptyState();
  var listeners = [];

  function emptyState() {
    return { v: 2, loans: [], duas: [], entries: [], defaults: [], cats: { income: DEFAULT_CATS.income.slice(), expense: DEFAULT_CATS.expense.slice() }, updatedAt: 0 };
  }

  function unionNames(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (n) { if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    return out;
  }

  function setStorage(s) { storage = s; }
  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  function normalize(s) {
    var out = emptyState();
    if (s && Array.isArray(s.loans)) {
      out.loans = s.loans.map(function (l) {
        l.txs = Array.isArray(l.txs) ? l.txs : [];
        return l;
      });
    }
    out.duas = (s && Array.isArray(s.duas)) ? s.duas : [];
    out.entries = (s && Array.isArray(s.entries)) ? s.entries : [];
    out.defaults = (s && Array.isArray(s.defaults)) ? s.defaults : [];
    out.cats = {
      income: unionNames(DEFAULT_CATS.income, s && s.cats && s.cats.income),
      expense: unionNames(DEFAULT_CATS.expense, s && s.cats && s.cats.expense)
    };
    out.updatedAt = (s && s.updatedAt) || 0;
    return out;
  }

  function load() {
    try {
      var raw = storage && storage.getItem(KEY);
      state = raw ? normalize(JSON.parse(raw)) : emptyState();
    } catch (e) { state = emptyState(); }
    return state;
  }

  function save(silent) {
    state.updatedAt = Date.now();
    if (storage) storage.setItem(KEY, JSON.stringify(state));
    if (!silent) notify();
  }

  function getState() { return state; }
  function replaceState(s) { state = normalize(s); save(); }

  function liveTxs(loan) { return loan.txs.filter(function (t) { return !t.deleted; }); }

  function balance(loan) {
    return liveTxs(loan).reduce(function (sum, t) {
      return sum + (t.kind === 'add' ? t.amount : -t.amount);
    }, 0);
  }

  function getLoan(id) {
    for (var i = 0; i < state.loans.length; i++) {
      if (state.loans[i].id === id && !state.loans[i].deleted) return state.loans[i];
    }
    return null;
  }

  function liveLoans(dir) {
    return state.loans.filter(function (l) { return !l.deleted && (!dir || l.dir === dir); });
  }

  /* এডিট লগ: কে কখন কী করল */
  function logIt(loan, kind, text, by) {
    loan.log = loan.log || [];
    loan.log.push({ id: U.newId(), at: Date.now(), by: by || 'আমি', kind: kind, text: text });
  }

  function touch(loan) { loan.updatedAt = Date.now(); loan.calDirty = true; }

  function createLoan(o) {
    var now = Date.now();
    var loan = {
      id: U.newId(), name: o.name, contact: o.contact || '', dir: o.dir,
      createdAt: now, updatedAt: now, dueDate: o.dueDate, mode: o.mode || 'full',
      remind: o.remind == null ? 1 : o.remind, eventId: null, contract: null,
      deleted: false, calDirty: true,
      txs: [{
        id: U.newId(), kind: 'add', amount: o.amount, date: o.date,
        note: o.dir === 'taken' ? 'প্রথম ঋণ' : 'প্রথম ঋণ দিলাম', createdAt: now, updatedAt: now
      }]
    };
    logIt(loan, 'create', o.dir === 'taken' ? 'ঋণ নেওয়া হিসেবে খোলা হলো' : 'ঋণ দেওয়া হিসেবে খোলা হলো');
    state.loans.push(loan);
    save();
    return loan;
  }

  function updateLoan(id, patch) {
    var loan = getLoan(id);
    if (!loan) return null;
    Object.keys(patch).forEach(function (k) { loan[k] = patch[k]; });
    if (!('contract' in patch)) logIt(loan, 'edit', 'ঋণের তথ্য সম্পাদনা' + ('plan' in patch ? ' (কিস্তির পরিকল্পনা)' : ''));
    touch(loan);
    save();
    return loan;
  }

  function addTx(loanId, o) {
    var loan = getLoan(loanId);
    if (!loan) return null;
    var now = Date.now();
    var tx = {
      id: U.newId(), kind: o.kind, amount: o.amount, date: o.date,
      note: o.note || '', full: !!o.full, createdAt: now, updatedAt: now
    };
    loan.txs.push(tx);
    logIt(loan, o.kind === 'pay' ? 'pay' : 'add', (o.kind === 'pay' ? 'শোধ ' : 'ঋণ যোগ ') + U.formatTaka(o.amount, true));
    if (o.dueDate) loan.dueDate = o.dueDate;
    touch(loan);
    save();
    return tx;
  }

  function deleteTx(loanId, txId) {
    var loan = getLoan(loanId);
    if (!loan) return;
    loan.txs.forEach(function (t) {
      if (t.id === txId && !t.deleted) { t.deleted = true; t.updatedAt = Date.now(); logIt(loan, 'del', 'লেনদেন মুছলাম: ' + U.formatTaka(t.amount, true)); }
    });
    touch(loan);
    save();
  }

  function deleteLoan(id) {
    var loan = getLoan(id);
    if (!loan) return;
    loan.deleted = true;
    logIt(loan, 'del', 'ঋণ মুছে ফেলা হলো');
    touch(loan);
    save();
  }

  /* অবস্থা: শোধ হয়েছে / মেয়াদ পার / আজ / কাছাকাছি / পরে */
  function status(loan, today) {
    if (balance(loan) <= 0) return { kind: 'settled', days: 0 };
    var d = U.daysBetween(today, loan.dueDate);
    if (d < 0) return { kind: 'overdue', days: -d };
    if (d === 0) return { kind: 'today', days: 0 };
    if (d <= 7) return { kind: 'soon', days: d };
    return { kind: 'later', days: d };
  }

  function summary(dir, today) {
    var s = { total: 0, overdue: 0, next7: 0, count: 0 };
    liveLoans(dir).forEach(function (l) {
      var b = balance(l);
      if (b <= 0) return;
      s.total += b;
      s.count += 1;
      var st = status(l, today);
      if (st.kind === 'overdue') s.overdue += b;
      else if (st.kind === 'today' || st.kind === 'soon') s.next7 += b;
    });
    return s;
  }

  /* ---- দুই ডিভাইসের ডাটা মেলানো ---- */
  function mergeTxs(a, b) {
    var map = {};
    a.concat(b).forEach(function (t) {
      var cur = map[t.id];
      if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) map[t.id] = t;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0); });
  }

  function mergeLoan(a, b) {
    var newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
    var older = newer === a ? b : a;
    var out = JSON.parse(JSON.stringify(newer));
    out.txs = mergeTxs(a.txs || [], b.txs || []);
    out.log = mergeById(a.log || [], b.log || [], null).sort(function (x, y) { return x.at - y.at; });
    if (!out.contract && older.contract) out.contract = older.contract;
    if (!out.eventId && older.eventId) out.eventId = older.eventId;
    return out;
  }

  function mergeById(a, b, fn) {
    var map = {};
    (a || []).forEach(function (x) { map[x.id] = x; });
    (b || []).forEach(function (r) {
      var cur = map[r.id];
      if (!cur) { map[r.id] = r; return; }
      if (fn) map[r.id] = fn(cur, r);
      else map[r.id] = (r.updatedAt || 0) > (cur.updatedAt || 0) ? r : cur;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function mergeDua(a, b) {
    var newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
    var out = JSON.parse(JSON.stringify(newer));
    var counts = {};
    [a.counts || {}, b.counts || {}].forEach(function (c) {
      Object.keys(c).forEach(function (d) {
        if (!counts[d] || (c[d].at || 0) > (counts[d].at || 0)) counts[d] = c[d];
      });
    });
    out.counts = counts;
    return out;
  }

  function mergeStates(local, remote) {
    var map = {};
    (local.loans || []).forEach(function (l) { map[l.id] = l; });
    (remote.loans || []).forEach(function (r) {
      map[r.id] = map[r.id] ? mergeLoan(map[r.id], r) : r;
    });
    var out = emptyState();
    out.loans = Object.keys(map).map(function (k) { return map[k]; });
    out.duas = mergeById(local.duas, remote.duas, mergeDua);
    out.entries = mergeById(local.entries, remote.entries, null);
    out.defaults = mergeById(local.defaults, remote.defaults, null);
    out.cats = {
      income: unionNames(local.cats && local.cats.income, remote.cats && remote.cats.income),
      expense: unionNames(local.cats && local.cats.expense, remote.cats && remote.cats.expense)
    };
    out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    return normalize(out);
  }

  function applyMerged(remote) {
    state = mergeStates(state, remote);
    save(true);
    notify();
  }

  /* ---------- দোয়া ---------- */
  function liveDuas() { return state.duas.filter(function (d) { return !d.deleted; }); }
  function getDua(id) {
    for (var i = 0; i < state.duas.length; i++) if (state.duas[i].id === id && !state.duas[i].deleted) return state.duas[i];
    return null;
  }
  function cleanTimes(t) {
    var seen = {}, out = [];
    (t || []).forEach(function (x) { if (/^\d{2}:\d{2}$/.test(x) && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out.sort();
  }
  function createDua(o) {
    var now = Date.now();
    var d = { id: U.newId(), title: o.title, arabic: o.arabic || '', translit: o.translit || '', meaning: o.meaning || '', target: o.target || 1,
      times: cleanTimes(o.times), counts: {}, eventIds: [], createdAt: now, updatedAt: now, deleted: false, calDirty: true };
    state.duas.push(d); save(); return d;
  }
  function updateDua(id, patch) {
    var d = getDua(id); if (!d) return null;
    Object.keys(patch).forEach(function (k) { d[k] = k === 'times' ? cleanTimes(patch[k]) : patch[k]; });
    d.updatedAt = Date.now(); d.calDirty = true; save(); return d;
  }
  function deleteDua(id) {
    var d = getDua(id); if (!d) return;
    d.deleted = true; d.updatedAt = Date.now(); d.calDirty = true; save();
  }
  function duaCount(d, date) { return (d.counts && d.counts[date] && d.counts[date].n) || 0; }
  function setDuaCount(id, date, n) {
    var d = getDua(id); if (!d) return 0;
    d.counts = d.counts || {};
    var now = Date.now();
    d.counts[date] = { n: Math.max(0, n), at: now };
    d.updatedAt = now;
    save(true);
    return d.counts[date].n;
  }
  function bumpDua(id, date, delta) {
    var d = getDua(id); if (!d) return 0;
    return setDuaCount(id, date, duaCount(d, date) + delta);
  }
  function duaLastDays(d, today, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var day = U.addDays(today, -i);
      out.push({ date: day, n: duaCount(d, day) });
    }
    return out;
  }

  /* ---------- আয়-ব্যয় ---------- */
  function cats(type) { return state.cats[type] || []; }
  function addCat(type, name) {
    name = (name || '').trim();
    if (!name || name === LOAN_CAT) return null;
    var list = state.cats[type];
    for (var i = 0; i < list.length; i++) if (list[i] === name) return name;
    list.push(name); save(); return name;
  }
  function addEntry(o) {
    var now = Date.now();
    var e = { id: U.newId(), type: o.type, cat: o.cat, amount: o.amount, date: o.date, note: o.note || '', createdAt: now, updatedAt: now, deleted: false };
    state.entries.push(e); save(); return e;
  }
  function deleteEntry(id) {
    state.entries.forEach(function (e) { if (e.id === id) { e.deleted = true; e.updatedAt = Date.now(); } });
    save();
  }
  /* সব এন্ট্রি: নিজের লেখা + ঋণ শোধ (আমি দেব-এর শোধ) স্বয়ংক্রিয় ব্যয় */
  function allEntries() {
    var out = state.entries.filter(function (e) { return !e.deleted; });
    state.loans.forEach(function (l) {
      if (l.deleted || l.dir !== 'taken') return;
      liveTxs(l).forEach(function (t) {
        if (t.kind === 'pay') out.push({ id: 'ln' + t.id, type: 'expense', cat: LOAN_CAT, amount: t.amount, date: t.date, note: l.name, derived: true, loanId: l.id, createdAt: t.createdAt || 0 });
      });
    });
    return out;
  }

  function dow(iso) { var p = U.parseISO(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function monthStart(iso) { var p = U.parseISO(iso); return p.y + '-' + (p.m < 10 ? '0' : '') + p.m + '-01'; }
  function monthEnd(iso) { var p = U.parseISO(iso); var d = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate(); return p.y + '-' + (p.m < 10 ? '0' : '') + p.m + '-' + (d < 10 ? '0' : '') + d; }
  /* সপ্তাহ শনিবার থেকে শুক্রবার */
  function rangeFor(kind, anchor) {
    var from, to, label, p = U.parseISO(anchor);
    if (kind === 'day') { from = to = anchor; label = U.formatDate(anchor); }
    else if (kind === 'week') {
      from = U.addDays(anchor, -((dow(anchor) + 1) % 7)); to = U.addDays(from, 6);
      label = U.formatDateShort(from) + ' – ' + U.formatDate(to);
    } else if (kind === 'month') { from = monthStart(anchor); to = monthEnd(anchor); label = U.MONTHS[p.m - 1] + ' ' + U.toBn(p.y); }
    else { from = p.y + '-01-01'; to = p.y + '-12-31'; label = U.toBn(p.y) + ' সাল'; }
    return { from: from, to: to, label: label };
  }
  function shiftAnchor(kind, anchor, dir) {
    if (kind === 'day') return U.addDays(anchor, dir);
    if (kind === 'week') return U.addDays(anchor, 7 * dir);
    if (kind === 'month') return U.addMonths(monthStart(anchor), dir);
    return U.addMonths(monthStart(anchor), 12 * dir);
  }
  function groupCats(items, type) {
    var m = {};
    items.forEach(function (e) { if (e.type === type) m[e.cat] = (m[e.cat] || 0) + e.amount; });
    return Object.keys(m).map(function (k) { return { name: k, total: m[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
  }
  function report(from, to) {
    var items = allEntries().filter(function (e) { return e.date >= from && e.date <= to; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0); });
    var inc = 0, exp = 0;
    items.forEach(function (e) { if (e.type === 'income') inc += e.amount; else exp += e.amount; });
    return { from: from, to: to, income: inc, expense: exp, balance: inc - exp, items: items,
      inCats: groupCats(items, 'income'), exCats: groupCats(items, 'expense') };
  }
  /* মোট ব্যালেন্স: সব সময়ের আয় − ব্যয় */
  function totalBalance() { return report('0000-01-01', '9999-12-31').balance; }


  /* ---------- কিস্তির পরিকল্পনা ও মাসওয়ারি সূচি ---------- */
  function ym(iso) { return iso.slice(0, 7); }
  function planInstallments(loan) {
    var pl = loan.plan;
    if (!pl || !pl.n || pl.n < 1) return null;
    var each = Math.floor(pl.total / pl.n), out = [];
    for (var k = 0; k < pl.n; k++) {
      out.push({ idx: k + 1, n: pl.n, date: U.addMonths(pl.first, k), amount: k < pl.n - 1 ? each : pl.total - each * (pl.n - 1) });
    }
    return out;
  }
  /* এখনো বাকি কিস্তি: প্ল্যানের পরে যত শোধ হয়েছে তা ক্রমানুসারে কিস্তিতে ধরা হয় */
  function remainingInstallments(loan) {
    var bal = balance(loan);
    if (bal <= 0) return [];
    var inst = planInstallments(loan);
    if (!inst) return [{ idx: 1, n: 1, date: loan.dueDate, amount: bal }];
    var paid = liveTxs(loan).filter(function (t) { return t.kind === 'pay' && (t.createdAt || 0) >= (loan.plan.at || 0); })
      .reduce(function (a, t) { return a + t.amount; }, 0);
    var out = [];
    inst.forEach(function (it) {
      var take = Math.min(paid, it.amount);
      paid -= take;
      if (it.amount - take > 0) { it.amount -= take; out.push(it); }
    });
    var sum = out.reduce(function (a, i) { return a + i.amount; }, 0);
    if (sum < bal && out.length) out[out.length - 1].amount += bal - sum;
    else if (sum < bal) out.push({ idx: inst.length, n: inst.length, date: inst[inst.length - 1].date, amount: bal - sum });
    return out;
  }
  function setPlan(id, n, first) {
    var loan = getLoan(id);
    if (!loan) return null;
    if (!n || n < 1) return updateLoan(id, { plan: null });
    return updateLoan(id, { plan: { n: n, first: first, total: balance(loan), at: Date.now() }, dueDate: U.addMonths(first, n - 1) });
  }
  function schedule(dir, today) {
    var cur = ym(today), map = {}, loans = {};
    liveLoans(dir).forEach(function (l) {
      remainingInstallments(l).forEach(function (it) {
        var late = ym(it.date) < cur;
        var key = late ? cur : ym(it.date);
        var m = map[key] || (map[key] = { key: key, total: 0, items: [] });
        m.total += it.amount;
        m.items.push({ loanId: l.id, name: l.name, date: it.date, amount: it.amount, idx: it.idx, n: it.n, late: late });
        var ln = loans[l.id] || (loans[l.id] = { loanId: l.id, name: l.name, last: key, months: 0 });
        if (key > ln.last) ln.last = key;
        ln.months += 1;
      });
    });
    var months = Object.keys(map).sort().map(function (k) { return map[k]; });
    var total = months.reduce(function (a, m) { return a + m.total; }, 0);
    var loanList = Object.keys(loans).map(function (k) { return loans[k]; });
    loanList.forEach(function (ln) { ln.span = Math.max(1, monthsBetween(cur, ln.last)); });
    return { months: months, total: total, loans: loanList, count: months.length ? monthsBetween(cur, months[months.length - 1].key) : 0,
      lastKey: months.length ? months[months.length - 1].key : null };
  }
  function monthsBetween(a, b) {
    var x = a.split('-'), y = b.split('-');
    return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]);
  }
  function monthTotal(dir, key, today) {
    var s = schedule(dir, today);
    for (var i = 0; i < s.months.length; i++) if (s.months[i].key === key) return s.months[i];
    return { key: key, total: 0, items: [] };
  }

  /* ---------- ডিফল্ট আয়/খরচ ও পূর্বাভাস (ব্যক্তিগত) ---------- */
  function liveDefaults() { return state.defaults.filter(function (d) { return !d.deleted; }); }
  function defaultsFor(key) {
    return liveDefaults().filter(function (d) { return d.from <= key && (!d.to || key <= d.to); });
  }
  function addDefault(o) {
    var now = Date.now();
    var d = { id: U.newId(), type: o.type, name: o.name, amount: o.amount, from: o.from, to: null, createdAt: now, updatedAt: now, deleted: false };
    state.defaults.push(d); save(); return d;
  }
  /* অঙ্ক বদলালে পুরনোটা আগের মাসে শেষ হয়, নতুনটা এই মাস থেকে শুরু — আগের মাস অপরিবর্তিত */
  function changeDefault(id, amount, from) {
    var old = null;
    from = from.slice(0, 7) + '-01';
    state.defaults.forEach(function (d) { if (d.id === id) old = d; });
    if (!old) return null;
    var now = Date.now();
    if (old.from >= from.slice(0, 7)) { old.amount = amount; old.updatedAt = now; save(); return old; }
    old.to = U.addMonths(from, -1).slice(0, 7); old.updatedAt = now;
    var nd = { id: U.newId(), type: old.type, name: old.name, amount: amount, from: from.slice(0, 7), to: null, createdAt: now, updatedAt: now, deleted: false };
    state.defaults.push(nd); save(); return nd;
  }
  function deleteDefault(id, from) {
    state.defaults.forEach(function (d) {
      if (d.id !== id) return;
      if (d.from >= from.slice(0, 7)) d.deleted = true; else d.to = U.addMonths(from.slice(0, 7) + '-01', -1).slice(0, 7);
      d.updatedAt = Date.now();
    });
    save();
  }
  function forecast(key, today) {
    var defs = defaultsFor(key);
    var r = report(key + '-01', monthEnd(key + '-01'));
    var actualInByCat = {}, spent = 0, loanPaid = 0;
    r.items.forEach(function (e) {
      if (e.type === 'income') actualInByCat[e.cat] = (actualInByCat[e.cat] || 0) + e.amount;
      else if (e.cat === LOAN_CAT) loanPaid += e.amount; else spent += e.amount;
    });
    var income = 0, budget = 0, used = {};
    defs.forEach(function (d) {
      if (d.type === 'income') {
        if (actualInByCat[d.name] != null) { if (!used[d.name]) { income += actualInByCat[d.name]; used[d.name] = 1; } }
        else income += d.amount;
      } else budget += d.amount;
    });
    Object.keys(actualInByCat).forEach(function (c) { if (!used[c]) income += actualInByCat[c]; });
    var due = monthTotal('taken', key, today).total;
    var receive = monthTotal('given', key, today).total;
    var committed = Math.max(budget, spent) + due;
    return { key: key, income: income, budget: budget, spent: spent, loanDue: due, loanPaid: loanPaid, receive: receive,
      free: income - committed, over: income - committed < 0, defs: defs };
  }

  var api = {
    setStorage: setStorage, onChange: onChange, load: load, save: save,
    getState: getState, replaceState: replaceState, balance: balance, liveTxs: liveTxs,
    getLoan: getLoan, liveLoans: liveLoans, createLoan: createLoan, updateLoan: updateLoan,
    addTx: addTx, deleteTx: deleteTx, deleteLoan: deleteLoan, status: status,
    summary: summary, mergeStates: mergeStates, applyMerged: applyMerged,
    liveDuas: liveDuas, getDua: getDua, createDua: createDua, updateDua: updateDua, deleteDua: deleteDua,
    duaCount: duaCount, setDuaCount: setDuaCount, bumpDua: bumpDua, duaLastDays: duaLastDays,
    cats: cats, addCat: addCat, addEntry: addEntry, deleteEntry: deleteEntry, allEntries: allEntries,
    logIt: logIt, planInstallments: planInstallments, remainingInstallments: remainingInstallments, setPlan: setPlan, schedule: schedule, monthTotal: monthTotal,
    liveDefaults: liveDefaults, defaultsFor: defaultsFor, addDefault: addDefault, changeDefault: changeDefault, deleteDefault: deleteDefault, forecast: forecast,
    rangeFor: rangeFor, shiftAnchor: shiftAnchor, report: report, totalBalance: totalBalance, LOAN_CAT: LOAN_CAT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RinStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
