/* ঋণ চুক্তিপত্রের লেখা তৈরি, দেখানো আর পিডিএফ বানানো */
(function (root) {
  'use strict';
  var U = (typeof module !== 'undefined' && module.exports) ? require('./util.js') : root.RinUtil;

  var MEDIUMS = ['হাতে হাতে নগদ টাকা', 'বিকাশ', 'নগদ অ্যাপ', 'রকেট', 'ব্যাংক ট্রান্সফার'];
  var INTERESTS = ['সুদমুক্ত', 'সুদ বা অতিরিক্ত লেনদেনের শর্ত আছে (নিচে লিখব)'];

  function clean(s) { return String(s || '').trim(); }

  /* চুক্তির সব লেখা একটা অবজেক্টে সাজানো (HTML আলাদা ফাংশনে) */
  function build(loan, c) {
    var meText = (clean(c.myInfo) || '[আমার নাম ও ঠিকানা]') + (clean(c.myPhone) ? ', মোবাইল ' + clean(c.myPhone) : '');
    var otherText = clean(loan.name) +
      (clean(loan.contact) ? ', ' + clean(loan.contact) : '') +
      (clean(c.otherInfo) ? ', ' + clean(c.otherInfo) : '');
    var lender = loan.dir === 'taken' ? otherText : meText;
    var borrower = loan.dir === 'taken' ? meText : otherText;
    var lenderName = loan.dir === 'taken' ? clean(loan.name) : 'ঋণদাতা';
    var borrowerName = loan.dir === 'taken' ? 'ঋণগ্রহীতা' : clean(loan.name);

    var amountText = U.formatTaka(c.amount) + ' (' + U.takaInWords(c.amount) + ')';
    var term = U.termText(c.date, c.dueDate);
    var clauses = [];
    clauses.push('ঋণদাতা ঋণগ্রহীতাকে ' + amountText + ' ঋণ দিয়েছেন (মাধ্যম: ' + (c.medium || MEDIUMS[0]) + ') এবং ঋণগ্রহীতা তা বুঝে পেয়েছেন।');
    if (c.mode === 'partial') {
      clauses.push('ঋণগ্রহীতা ' + U.formatDate(c.dueDate) + ' তারিখের মধ্যে (' + term + ') পুরো টাকা ফেরত দেবেন; প্রয়োজনে কিস্তিতে বা ধাপে ধাপে দিতে পারবেন।');
    } else {
      clauses.push('ঋণগ্রহীতা ' + U.formatDate(c.dueDate) + ' তারিখের মধ্যে (' + term + ') পুরো টাকা একবারে ফেরত দেবেন।');
    }
    if ((c.interest || INTERESTS[0]) === INTERESTS[0]) {
      clauses.push('এই ঋণ সম্পূর্ণ সুদমুক্ত। মূল টাকার বেশি কিছু দিতে হবে না।');
    } else {
      clauses.push('সুদ বা অতিরিক্ত লেনদেনের শর্ত নিচের অতিরিক্ত শর্তে লেখা হলো।');
    }
    clauses.push('কিছু টাকা ফেরত দিলে তা লিখে রাখা হবে এবং বাকি টাকা থেকে বাদ যাবে।');
    clauses.push('সময়মতো দিতে না পারলে ঋণগ্রহীতা আগে জানাবেন এবং উভয়ের সম্মতিতে নতুন তারিখ ঠিক হবে।');
    if (clean(c.extra)) clauses.push('অতিরিক্ত শর্ত: ' + clean(c.extra));

    return {
      title: 'ঋণ চুক্তিপত্র',
      date: U.formatDate(c.date),
      lender: lender, borrower: borrower,
      lenderName: lenderName, borrowerName: borrowerName,
      clauses: clauses,
      closing: 'উভয় পক্ষ স্বেচ্ছায় ও সুস্থ মস্তিষ্কে সাক্ষীদের সামনে এই চুক্তি করলেন।',
      w1: clean(c.w1), w2: clean(c.w2)
    };
  }

  function sigBox(label, name) {
    return '<div class="sig"><div class="sig-line"></div><span>' + U.escapeHtml(label) + '</span>' +
      (name ? '<small>' + U.escapeHtml(name) + '</small>' : '') + '</div>';
  }

  function renderHtml(loan, c) {
    var d = build(loan, c);
    var e = U.escapeHtml;
    var clauses = d.clauses.map(function (t, i) {
      return '<p class="cl"><b>' + U.toBn(i + 1) + '.</b> ' + e(t) + '</p>';
    }).join('');
    return '<div class="contract-paper">' +
      '<div class="c-head"><div class="c-title">' + e(d.title) + '</div><div class="c-date">তারিখ: ' + e(d.date) + '</div></div>' +
      '<div class="c-block"><p><b>ঋণদাতা:</b> ' + e(d.lender) + '</p><p><b>ঋণগ্রহীতা:</b> ' + e(d.borrower) + '</p></div>' +
      '<div class="c-block">' + clauses + '</div>' +
      '<p class="c-close">' + e(d.closing) + '</p>' +
      '<div class="sigs">' +
      sigBox('ঋণদাতার স্বাক্ষর', '') + sigBox('ঋণগ্রহীতার স্বাক্ষর', '') +
      sigBox('সাক্ষী ১', d.w1) + sigBox('সাক্ষী ২', d.w2) +
      '</div></div>';
  }

  /* ---------- পিডিএফ ---------- */
  var libs = {};
  function loadScript(url) {
    if (libs[url]) return libs[url];
    libs[url] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.onload = resolve;
      s.onerror = function () { delete libs[url]; reject(new Error('lib_load_failed')); };
      document.head.appendChild(s);
    });
    return libs[url];
  }

  /* যেকোনো HTML থেকে A4 পিডিএফ (বড় হলে একাধিক পাতা) */
  function htmlToPdf(html) {
    return Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      (document.fonts && document.fonts.ready) || Promise.resolve()
    ]).then(function () {
      var holder = document.createElement('div');
      holder.className = 'pdf-holder';
      holder.innerHTML = html;
      document.body.appendChild(holder);
      var el = holder.firstChild;
      return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(function (canvas) {
        document.body.removeChild(holder);
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        var margin = 28, w = pw - margin * 2, maxH = ph - margin * 2;
        var scale = w / canvas.width;
        var pageHpx = Math.floor(maxH / scale);
        var y = 0, first = true;
        while (y < canvas.height) {
          var sliceH = Math.min(pageHpx, canvas.height - y);
          var part = document.createElement('canvas');
          part.width = canvas.width; part.height = sliceH;
          part.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first) pdf.addPage();
          pdf.addImage(part.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, w, sliceH * scale);
          first = false; y += sliceH;
        }
        return pdf.output('blob');
      }, function (err) { document.body.removeChild(holder); throw err; });
    });
  }

  function makePdf(loan, c) { return htmlToPdf(renderHtml(loan, c)); }

  function fileName(loan, c) {
    return ('ঋণ-চুক্তি-' + loan.name + '-' + c.date + '.pdf').replace(/[\\/:*?"<>|\s]+/g, '-');
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  function share(blob, name, title) {
    var file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title });
    }
    return Promise.reject(new Error('share_unsupported'));
  }

  var api = { htmlToPdf: htmlToPdf, MEDIUMS: MEDIUMS, INTERESTS: INTERESTS, build: build, renderHtml: renderHtml, makePdf: makePdf, fileName: fileName, download: download, share: share };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RinContract = api;
})(typeof window !== 'undefined' ? window : globalThis);
