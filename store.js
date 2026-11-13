/* ডাটা রাখা (ফোনে), ব্যালেন্সের হিসাব, আর দুই ডিভাইসের ডাটা মেলানো (merge) */
(function (root) {
  'use strict';
  var U = (typeof module !== 'undefined' && module.exports) ? require('./util.js') : root.RinUtil;

  var KEY = 'rin_data_v1';
  var storage = null;
  var state = emptyState();
  var listeners = [];

  function emptyState() { return { v: 1, loans: [], updatedAt: 0 }; }

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
    state.loans.push(loan);
    save();
    return loan;
  }

  function updateLoan(id, patch) {
    var loan = getLoan(id);
    if (!loan) return null;
    Object.keys(patch).forEach(function (k) { loan[k] = patch[k]; });
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
    if (o.dueDate) loan.dueDate = o.dueDate;
    touch(loan);
    save();
    return tx;
  }

  function deleteTx(loanId, txId) {
    var loan = getLoan(loanId);
    if (!loan) return;
    loan.txs.forEach(function (t) {
      if (t.id === txId) { t.deleted = true; t.updatedAt = Date.now(); }
    });
    touch(loan);
    save();
  }

  function deleteLoan(id) {
    var loan = getLoan(id);
    if (!loan) return;
    loan.deleted = true;
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
    if (!out.contract && older.contract) out.contract = older.contract;
    if (!out.eventId && older.eventId) out.eventId = older.eventId;
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
    out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    return normalize(out);
  }

  function applyMerged(remote) {
    state = mergeStates(state, remote);
    save(true);
    notify();
  }

  var api = {
    setStorage: setStorage, onChange: onChange, load: load, save: save,
    getState: getState, replaceState: replaceState, balance: balance, liveTxs: liveTxs,
    getLoan: getLoan, liveLoans: liveLoans, createLoan: createLoan, updateLoan: updateLoan,
    addTx: addTx, deleteTx: deleteTx, deleteLoan: deleteLoan, status: status,
    summary: summary, mergeStates: mergeStates, applyMerged: applyMerged
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RinStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
