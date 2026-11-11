// 보맵 플래너 → 보험관리툴 내보내기 (북마크로 보맵 플래너 화면에서 실행)
// - 고객 정보·계약·특약(담보) 전체·납입 정보·약관 주소·보맵 보장분석(또래 평균 대비)을 JSON 파일 하나로 받아요
// - 선택하면 보맵 "보험 분석 리포트" PDF 도 같이 넣어요 (관리툴이 Google Drive 에 저장)
// - 리포트 PDF/Excel 을 고객별로 바로 내려받을 수도 있어요 (비밀번호: 플래너 사번)
// 이 파일에는 비밀 정보가 없어요. 로그인한 내 브라우저의 보맵 세션으로만 동작해요.
(function () {
  'use strict';
  if (!/bomapp\.co\.kr$/.test(location.hostname)) { alert('보맵 플래너(dplanner.bomapp.co.kr)에 로그인한 화면에서 실행해 주세요.'); return; }
  var old = document.getElementById('im-bomapp-panel'); if (old) old.remove();

  var API = 'https://wapi.bomapp.co.kr';
  function token() {
    var v = null;
    for (var i = 0; i < sessionStorage.length; i++) {
      var s = sessionStorage.getItem(sessionStorage.key(i)) || '';
      if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(s)) v = s;
    }
    return v;
  }
  function hdr() {
    var t = token();
    if (!t) throw new Error('로그인 정보가 없어요. 보맵 플래너에 다시 로그인한 뒤 실행해 주세요.');
    return { Authorization: 'Bearer ' + t, 'X-Client-Platform': 'WEB' };
  }
  async function get(p) {
    var r = await fetch(API + p, { headers: hdr() });
    if (r.status === 401) throw new Error('로그인이 만료됐어요. 보맵 화면을 새로고침(또는 다시 로그인)한 뒤 실행해 주세요.');
    if (!r.ok) throw new Error(p + ' → ' + r.status);
    return r.json();
  }
  async function blob(p) {
    var r = await fetch(API + p, { headers: hdr() });
    if (!r.ok) throw new Error(p + ' → ' + r.status);
    return r.blob();
  }
  function b64(bl) {
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = no; fr.readAsDataURL(bl);
    });
  }
  function save(bl, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function ymd() { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function listCustomers() {
    var out = [], page = 0;
    for (;;) {
      var d = await get('/planner-members/list/all?pageIndex=' + page + '&pageSize=100');
      (d.items || []).forEach(function (x) { out.push(x); });
      if (!d.hasNext || page > 50) break; page++;
    }
    return out;
  }

  var POL_KEYS = ['insuranceId', 'insurerName', 'productName', 'insuranceStatus', 'insuranceStatusCode', 'insuranceType',
    'actualExpenseGeneration', 'guaranteeCategories', 'subscriberName', 'primaryInsuredName', 'subInsuredName',
    'isPrimaryInsuredMyself', 'issueDate', 'maturityDate', 'isRenewal', 'joinAmount', 'isVariable', 'isUniversal',
    'monthlyPaymentAmount', 'paymentAmount', 'paymentCycle', 'paymentDay', 'totalPaymentCount', 'paidPaymentCount',
    'paidPaymentAmount', 'remainPaymentAmount', 'paymentEndDate', 'paymentYears', 'isPaymentCompleted'];
  var RIDER_KEYS = ['contractId', 'name', 'joinAmount', 'maturityDate', 'insuredName', 'contractStatus', 'isRequire',
    'isMyContract', 'guaranteeCode', 'guaranteeName', 'guaranteeCategory'];
  function pick(o, ks) { var r = {}; ks.forEach(function (k) { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }

  async function exportOne(it, withPdf, log) {
    var det = (await get('/planner-members/' + it.plannerMemberId)).data || {};
    var m = det.member || {};
    var mid = m.memberId;
    var c = { plannerMemberId: it.plannerMemberId, memberId: mid, name: m.name || it.name, birthDate: m.birthDate || it.birthDate || '',
      gender: m.gender || '', policies: [], guarantees: null, report: null };
    if (!mid) return c;
    var ins = await get('/members/' + mid + '/insurances');
    var pols = ins.insurances || [];
    for (var i = 0; i < pols.length; i++) {
      var p = pick(pols[i], POL_KEYS);
      log(c.name + ' · 보험 ' + (i + 1) + '/' + pols.length);
      try { p.riders = ((await get('/members/' + mid + '/insurances/' + p.insuranceId + '/contracts')).contracts || []).map(function (r) { return pick(r, RIDER_KEYS); }); }
      catch (e) { p.riders = []; p.ridersError = String(e.message || e); }
      try { p.termsUrl = (await get('/members/' + mid + '/insurances/' + p.insuranceId + '/terms')).insuranceTermsUrl || ''; }
      catch (e) { p.termsUrl = ''; }
      c.policies.push(p);
    }
    try {
      var g = await get('/members/' + mid + '/insurance-guarantees');
      c.guarantees = { ageGroup: g.ageGroup, basis: g.appliedAmountBasis, groups: (g.insuranceGuaranteeDetails || []).map(function (gr) {
        return { g: gr.guaranteeCategoryGroupName, items: (gr.items || []).map(function (x) {
          return { code: x.guaranteeCode, name: x.guaranteeName, status: x.guaranteeStatus, desc: x.description,
            rec: x.recommendAmount, total: x.myTotalAmount,
            by: (x.myInsurances || []).map(function (y) { return { id: y.insuranceId, amt: y.guaranteeAmount }; }) };
        }) };
      }) };
    } catch (e) { c.guarantees = null; }
    if (withPdf) {
      try { log(c.name + ' · 분석 리포트 PDF'); c.report = { pdfB64: await b64(await blob('/members/' + mid + '/insurance-analysis-report/pdf')), at: new Date().toISOString() }; }
      catch (e) { c.report = { error: String(e.message || e) }; }
    }
    return c;
  }

  // ── 화면 ─────────────────────────────────────────────
  var box = document.createElement('div');
  box.id = 'im-bomapp-panel';
  box.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;width:380px;max-height:86vh;overflow:auto;background:#fff;border:1px solid #CBD5E1;border-radius:14px;box-shadow:0 12px 40px rgba(15,23,42,.25);font:13px/1.5 -apple-system,"Malgun Gothic",sans-serif;color:#0F172A';
  box.innerHTML = '<div style="padding:14px 16px;background:#1E3A8A;color:#fff;border-radius:14px 14px 0 0;display:flex;align-items:center"><b style="flex:1">보맵 → 보험관리툴</b><button data-x style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button></div>' +
    '<div style="padding:12px 16px"><div data-st style="color:#475569">고객 목록을 불러오는 중…</div>' +
    '<div data-list style="margin:10px 0;max-height:240px;overflow:auto;border:1px solid #E2E8F0;border-radius:8px"></div>' +
    '<label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" data-pdf checked> 분석 리포트 PDF 도 넣기 <span style="color:#64748B">(관리툴이 Drive 에 저장)</span></label>' +
    '<button data-go style="width:100%;padding:11px;border:0;border-radius:9px;background:#2563EB;color:#fff;font-weight:700;cursor:pointer">📦 관리툴용 파일 만들기</button>' +
    '<div style="display:flex;gap:6px;margin-top:8px"><button data-rp="pdf" style="flex:1;padding:9px;border:1px solid #CBD5E1;border-radius:9px;background:#fff;cursor:pointer">📄 리포트 PDF 받기</button><button data-rp="xlsx" style="flex:1;padding:9px;border:1px solid #CBD5E1;border-radius:9px;background:#fff;cursor:pointer">📊 리포트 Excel 받기</button></div>' +
    '<p style="font-size:11px;color:#64748B;margin:10px 0 0">리포트 파일 비밀번호는 보맵이 정한 <b>플래너 사번</b>이에요. 휴대폰 번호는 파일에 넣지 않아요.</p></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  var st = $('[data-st]');
  function log(t) { st.textContent = t; }
  $('[data-x]').onclick = function () { box.remove(); };
  var busy = false, customers = [];

  function chosen() { return customers.filter(function (c, i) { var el = box.querySelector('[data-ci="' + i + '"]'); return el && el.checked; }); }
  function lock(on) { busy = on; box.querySelectorAll('button[data-go],button[data-rp]').forEach(function (b) { b.disabled = on; b.style.opacity = on ? .5 : 1; }); }

  listCustomers().then(function (list) {
    customers = list;
    var L = $('[data-list]');
    var all = document.createElement('label');
    all.style.cssText = 'display:flex;gap:6px;padding:7px 10px;background:#F8FAFC;font-weight:700;border-bottom:1px solid #E2E8F0';
    all.innerHTML = '<input type="checkbox" checked> 전체 <span data-n></span>';
    all.querySelector('[data-n]').textContent = '(' + list.length + '명)';
    all.querySelector('input').onchange = function (e) { L.querySelectorAll('[data-ci]').forEach(function (x) { x.checked = e.target.checked; }); };
    L.appendChild(all);
    list.forEach(function (c, i) {
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid #F1F5F9;cursor:pointer';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.setAttribute('data-ci', String(i));
      var sp = document.createElement('span'); sp.textContent = c.name + '  ' + (c.birthDate || '') + (c.isInsuranceDataExist ? '' : '  (보험 정보 없음)');
      row.appendChild(cb); row.appendChild(sp); L.appendChild(row);
    });
    log('고객 ' + list.length + '명. 고른 뒤 버튼을 누르세요.');
  }).catch(function (e) { log('⚠️ ' + (e.message || e)); });

  $('[data-go]').onclick = async function () {
    if (busy) return; var sel = chosen(); if (!sel.length) { log('고객을 한 명 이상 고르세요.'); return; }
    lock(true);
    try {
      var withPdf = $('[data-pdf]').checked, out = [];
      for (var i = 0; i < sel.length; i++) { log('(' + (i + 1) + '/' + sel.length + ') ' + sel[i].name); out.push(await exportOne(sel[i], withPdf, log)); await sleep(150); }
      var data = { source: 'bomapp-planner', version: 1, exportedAt: new Date().toISOString(), customers: out };
      save(new Blob([JSON.stringify(data)], { type: 'application/json' }), '보맵_관리툴_' + ymd() + '.json');
      var np = out.reduce(function (s, c) { return s + c.policies.length; }, 0);
      log('✅ 완료: 고객 ' + out.length + '명 · 보험 ' + np + '건. 관리툴에서 📥 보맵 가져오기로 이 파일을 여세요.');
    } catch (e) { log('⚠️ ' + (e.message || e)); }
    lock(false);
  };
  box.querySelectorAll('[data-rp]').forEach(function (b) {
    b.onclick = async function () {
      if (busy) return; var sel = chosen(); if (!sel.length) { log('고객을 한 명 이상 고르세요.'); return; }
      var fmt = b.getAttribute('data-rp'); lock(true);
      try {
        for (var i = 0; i < sel.length; i++) {
          log('(' + (i + 1) + '/' + sel.length + ') ' + sel[i].name + ' 리포트 받는 중');
          var det = (await get('/planner-members/' + sel[i].plannerMemberId)).data || {};
          var mid = det.member && det.member.memberId; if (!mid) continue;
          save(await blob('/members/' + mid + '/insurance-analysis-report/' + fmt), sel[i].name + '_보험분석리포트_' + ymd() + '.' + fmt);
          await sleep(400);
        }
        log('✅ 리포트 ' + sel.length + '개를 받았어요. 비밀번호는 플래너 사번이에요.');
      } catch (e) { log('⚠️ ' + (e.message || e)); }
      lock(false);
    };
  });
})();
