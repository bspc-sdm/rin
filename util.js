/* বাংলা সংখ্যা, টাকা, তারিখ ও কথায় লেখার সাহায্যকারী ফাংশন */
(function (root) {
  'use strict';

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  function toBn(v) {
    return String(v).replace(/\d/g, function (d) { return BN_DIGITS[d]; });
  }
  function fromBn(v) {
    return String(v).replace(/[০-৯]/g, function (d) { return String(BN_DIGITS.indexOf(d)); });
  }

  /* টাকা সবসময় পয়সায় (পূর্ণসংখ্যা) রাখা হয়, যাতে হিসাবে ভুল না হয় */
  function parseAmount(text) {
    var t = fromBn(text).replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!t) return NaN;
    var parts = t.split('.');
    if (parts.length > 2) return NaN;
    var taka = parseInt(parts[0] || '0', 10);
    var frac = parts[1] ? parseInt((parts[1] + '00').slice(0, 2), 10) : 0;
    if (!isFinite(taka)) return NaN;
    return taka * 100 + frac;
  }

  function groupIndian(n) {
    var s = String(n);
    if (s.length <= 3) return s;
    var last3 = s.slice(-3);
    var rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  function formatTaka(paisa, withSymbol) {
    var neg = paisa < 0;
    var a = Math.abs(paisa);
    var taka = Math.floor(a / 100);
    var frac = a % 100;
    var s = groupIndian(taka);
    if (frac) s += '.' + (frac < 10 ? '0' + frac : String(frac));
    s = toBn(s);
    return (neg ? '− ' : '') + (withSymbol === false ? '' : '৳ ') + s;
  }

  var W = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
    'এগার', 'বার', 'তের', 'চৌদ্দ', 'পনের', 'ষোল', 'সতের', 'আঠার', 'ঊনিশ', 'বিশ',
    'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ', 'ত্রিশ',
    'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ',
    'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ',
    'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট',
    'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর',
    'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি',
    'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই',
    'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

  function words(n) {
    n = Math.floor(n);
    if (n === 0) return W[0];
    var parts = [];
    var crore = Math.floor(n / 1e7); n = n % 1e7;
    var lakh = Math.floor(n / 1e5); n = n % 1e5;
    var th = Math.floor(n / 1e3); n = n % 1e3;
    var h = Math.floor(n / 100);
    var r = n % 100;
    if (crore) parts.push(words(crore) + ' কোটি');
    if (lakh) parts.push(W[lakh] + ' লক্ষ');
    if (th) parts.push(W[th] + ' হাজার');
    if (h) parts.push(W[h] + 'শ');
    if (r) parts.push(W[r]);
    return parts.join(' ');
  }

  function takaInWords(paisa) {
    var taka = Math.floor(Math.abs(paisa) / 100);
    var frac = Math.abs(paisa) % 100;
    var s = words(taka) + ' টাকা';
    if (frac) s += ' ' + words(frac) + ' পয়সা';
    return s + ' মাত্র';
  }

  var MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function todayISO(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseISO(iso) {
    var p = String(iso).split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function formatDate(iso) {
    if (!iso) return '';
    var p = parseISO(iso);
    return toBn(p.d) + ' ' + MONTHS[p.m - 1] + ' ' + toBn(p.y);
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    var p = parseISO(iso);
    return toBn(p.d) + ' ' + MONTHS[p.m - 1];
  }

  function dayNumber(iso) {
    var p = parseISO(iso);
    return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  function daysBetween(fromISO, toISO) {
    return dayNumber(toISO) - dayNumber(fromISO);
  }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function addMonths(iso, n) {
    var p = parseISO(iso);
    var total = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(total / 12);
    var m = (total % 12) + 1;
    var d = Math.min(p.d, daysInMonth(y, m));
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function addDays(iso, n) {
    var t = new Date((dayNumber(iso) + n) * 86400000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  /* দুই তারিখের মাঝের সময়কে বাংলায় লেখা: "৩ মাসে" বা "৪৫ দিনে" */
  function termText(fromISO, toISO) {
    var days = daysBetween(fromISO, toISO);
    if (days <= 0) return 'আজই';
    for (var k = 1; k <= 60; k++) {
      if (addMonths(fromISO, k) === toISO) return toBn(k) + ' মাসে';
    }
    return toBn(days) + ' দিনে';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- শেয়ার লিংকের জন্য ডাটা ছোট করে লেখা/পড়া ---- */
  function b64u(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8Bytes(text) {
    var bin = unescape(encodeURIComponent(text)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8Text(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return decodeURIComponent(escape(bin));
  }
  function pipe(bytes, stream) {
    var w = stream.writable.getWriter();
    w.write(bytes); w.close();
    return new Response(stream.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function packObj(obj) {
    var bytes = utf8Bytes(JSON.stringify(obj));
    if (typeof CompressionStream !== 'undefined' && typeof Response !== 'undefined') {
      try { return pipe(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + b64u(z); }, function () { return 'j' + b64u(bytes); }); } catch (e) { /* সাধারণ পদ্ধতি */ }
    }
    return Promise.resolve('j' + b64u(bytes));
  }
  function unpackObj(code) {
    try {
      var type = code.charAt(0), bytes = unb64u(code.slice(1));
      if (type === 'z') return pipe(bytes, new DecompressionStream('deflate-raw')).then(function (b) { return JSON.parse(utf8Text(b)); });
      if (type === 'j') return Promise.resolve(JSON.parse(utf8Text(bytes)));
    } catch (e) { return Promise.reject(e); }
    return Promise.reject(new Error('bad'));
  }

  var api = {
    packObj: packObj, unpackObj: unpackObj,
    toBn: toBn, fromBn: fromBn, parseAmount: parseAmount, formatTaka: formatTaka,
    words: words, takaInWords: takaInWords, MONTHS: MONTHS,
    todayISO: todayISO, formatDate: formatDate, formatDateShort: formatDateShort,
    daysBetween: daysBetween, addMonths: addMonths, addDays: addDays, termText: termText,
    escapeHtml: escapeHtml, newId: newId, parseISO: parseISO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RinUtil = api;
})(typeof window !== 'undefined' ? window : globalThis);
