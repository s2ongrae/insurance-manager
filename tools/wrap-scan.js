// 줄바뀜·잘림 자동 점검 (개발용): node tools/wrap-scan.js [결과 json]
// 실제 크롬(Playwright)으로 모든 화면을 폰 2종·태블릿·PC 폭에서 그리고, 글자 한 자 한 자의 위치로 어색한 줄바뀜을 찾는다.
//  · 막는 것(있으면 종료코드 1): 어절 중간 꺾임, 문장 끝 꼬리글자, 화면 밖 넘침, 실행·스크립트 오류
//  · 알려만 주는 것: 짧은 글자 줄바뀜, 말줄임(…), 잘림 — 의도한 것(보험 칩·알림 띠)이 섞여 있어서
//  · Playwright 는 이 저장소 의존성이 아니다: `PLAYWRIGHT_DIR` 환경변수, 또는 옆 폴더 gaegyebu/tests/node_modules 의 것을 쓴다.
//  · 화면 캡처도 보고 싶으면 SHOT=폴더이름 node tools/wrap-scan.js (결과는 임시 폴더에 저장)
//  · 데이터는 전부 가짜(홍길동 등)이고, 파일을 읽기만 한다(file://) — 서버·키·실제 고객 정보를 쓰지 않는다.
const fs = require('fs'), path = require('path'), os = require('os');
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_DIR, 'playwright', path.join(__dirname, '..', '..', 'gaegyebu', 'tests', 'node_modules', 'playwright'), 'C:/dev/gaegyebu/tests/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* 다음 후보 */ } }
  console.error('Playwright 를 찾지 못했어요. PLAYWRIGHT_DIR=<playwright 폴더> 를 지정하거나 npm i -D playwright 후 npx playwright install chromium'); process.exit(2);
}
const { chromium } = loadPlaywright();
const HTML = path.join(__dirname, '..', 'index.html');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'wrap-scan.json');
const SHOT = process.env.SHOT ? path.join(os.tmpdir(), process.env.SHOT) : null;
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });

const SEED = `(() => {
  const day = n => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const it = (name, amount, x) => Object.assign({ name, amount, unit: '만원', price: 0 }, x || {});
  const P1 = 'pid_demo1', P2 = 'pid_demo2', P3 = 'pid_demo3';
  const C = [
    { id: 1, pid: P1, s: '계약완료', d: '24.03.10', c: '홍길동', p: '홍길동', co: '삼성화재', n: '무배당 삼성 인생이모작 건강보험 갱신형 (해약환급금 미지급형) 플러스', pr: 85000, g: '가나다 가족', pn: '2024-0310-123456' },
    { id: 2, pid: P1, s: '계약완료', d: '25.07.02', c: '홍길동', p: '홍길동', co: '메리츠화재', n: '알파플러스 보장보험 2511', pr: 62000, g: '가나다 가족' },
    { id: 3, pid: P1, s: '계약해지', d: '22.01.05', ed: '25.01.05', c: '홍길동', p: '홍길동', co: 'DB손해보험', n: '프로미라이프 참좋은운전자', pr: 15000, g: '가나다 가족' },
    { id: 4, pid: P2, s: '계약완료', d: '25.11.20', c: '홍길동', p: '홍길순', co: '현대해상', n: '무배당 굿앤굿어린이종합보험Q', pr: 48000, g: '가나다 가족' },
    { id: 5, pid: P3, s: '계약완료', d: '23.05.15', c: '김서연', p: '김서연', co: 'KB손해보험', n: 'KB 5.10.10 플러스 건강보험(세만기형)', pr: 121500, g: '지인들' },
    { id: 6, pid: P3, s: '가입 예정', d: '26.12.01', c: '김서연', p: '김서연', co: '한화생명', n: '한화 시그니처 암보험 3.0', pr: 93000, g: '지인들' }];
  const L1 = [it('암 진단비(유사암 제외)', 3000, { until: day(40) }), it('유사암 진단비(소액암)', 600), it('뇌혈관질환 진단비', 1000), it('허혈성심장질환 진단비', 1000, { until: day(5) }), it('질병수술비(1~5종 수술)', 100), it('상해후유장해(3%~100%)', 10000), it('특정 순환계질환 주요치료비(갱신형, 최초1회한)', 500), it('임플란트 치료비(연간 2개한도)', 150)];
  const L2 = [it('일반암 진단비', 2000), it('뇌졸중진단비', 500), it('질병입원일당(1일이상 180일한도)', 3), it('상해입원일당', 3), it('표적항암약물허가치료비(연간 1회한)', 2000), it('골절 진단비(치아파절제외)', 30), it('운전자 교통사고처리지원금(형사합의금)', 20000)];
  const cov = {};
  cov[P1] = { covNameVer: 3, policies: [{ id: 1, payPeriod: '20년납', covPeriod: '100세', renewable: '비갱신형', items: L1 }, { id: 2, payPeriod: '10년납', covPeriod: '90세', renewable: '갱신형(10년)', items: L2 }],
    externalPolicies: [{ id: -11, co: 'DB손해보험', n: '실손의료비보험(4세대) 표준형', pr: 21000, payPeriod: '1년갱신', covPeriod: '100세', renewable: '갱신형', items: [it('질병입원의료비', 5000), it('질병통원의료비(외래)', 20), it('상해입원의료비', 5000), it('비급여 도수·체외충격파·증식치료', 300)] }],
    otherPolicies: [{ id: 'ext_17', co: '교보생명', name: '무배당 교보 종신보험(저해약환급금형)', price: 73000, items: [it('일반사망 보험금', 10000), it('재해사망 보험금', 10000)] }],
    person: { name: '홍길동', birth: '1985.04.12', gender: 'M' } };
  cov[P2] = { covNameVer: 3, policies: [{ id: 4, payPeriod: '20년납', covPeriod: '100세', renewable: '비갱신', items: [it('암 진단비', 3000), it('소아 특정질환 수술비', 500), it('배상책임(일상생활 가족일상생활)', 10000)] }] };
  cov[P3] = { covNameVer: 3, policies: [{ id: 5, payPeriod: '전기납', covPeriod: '종신', renewable: '비갱신', items: [it('암 진단비', 5000), it('뇌졸중 진단비', 2000), it('골절 진단비', 50)] }] };
  const M = []; for (let m = 1; m <= 11; m++) M.push({ m: '26.' + String(m).padStart(2, '0'), k: m % 4 + 1, before: 2100000 + m * 130000, after: 1800000 + m * 110000, tax: m * 1000, memo: m % 3 ? '' : '분기 마감 정산 반영 · 시책 수당 포함 (세전 기준으로 입력함)' });
  const R = { a: { id: 'a', date: day(0), memo: '홍길동 고객 갱신 안내 전화 — 실손 4세대 전환 여부, 특약 만기(허혈성심장질환) 설명, 청구 서류 안내 같이 하기', done: false, cid: '1' }, b: { id: 'b', date: day(9), memo: '김서연 한화 시그니처 암보험 청약서 서명 받기', done: false, cid: '6' } };
  localStorage.setItem('ins_contracts', JSON.stringify(C)); localStorage.setItem('ins_coverages', JSON.stringify(cov)); localStorage.setItem('ins_monthly', JSON.stringify(M));
  localStorage.setItem('ins_groups', JSON.stringify({ '가나다 가족': '#C2255C', '지인들': '#6B7280' })); localStorage.setItem('ins_memos', JSON.stringify({ '1': '첫 상담 메모 — 건강검진 결과 확인 필요\\n둘째 줄', '5': '갱신 확인 필요' }));
  localStorage.setItem('ins_reminders', JSON.stringify(R)); sessionStorage.setItem('ins_unlocked', '1');
})();`;

// 페이지 안에서 도는 점검 함수 (글자 한 자 한 자의 위치로 줄을 나눠 판정)
const SCAN = `(() => {
  const issues = [];
  const isHan = c => /[가-힣]/.test(c);
  const root = document.body;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const sig = el => { const p = el.parentElement; return (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')) + (p ? ' < ' + p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') : ''); };
  let n;
  while ((n = tw.nextNode())) {
    const raw = n.textContent; const t = raw.replace(/\\s+/g, ' ').trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,noscript,option,select,textarea,input,title')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!el.getClientRects().length) continue;
    let hidden = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden') { hidden = true; break; } } if (hidden) continue;
    const r = document.createRange(); const chars = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i]; if (/\\s/.test(c)) { chars.push({ c, top: null }); continue; }
      r.setStart(n, i); r.setEnd(n, i + 1); const rc = r.getClientRects()[0];
      chars.push(rc ? { c, top: rc.top, left: rc.left, w: rc.width } : { c, top: null });
    }
    const lines = []; let cur = null;
    chars.forEach(o => { if (o.top === null) { if (cur) cur.text += ' '; return; } if (!cur || Math.abs(o.top - cur.top) > 4) { cur = { top: o.top, text: '' }; lines.push(cur); } cur.text += o.c; });
    if (lines.length < 2) continue;
    const kind = [];
    // 1) 어절 중간에서 끊김: 줄이 바뀌는 곳 앞뒤가 공백 없이 붙은 한글/숫자+단위
    for (let k = 0; k < lines.length - 1; k++) {
      const a = lines[k].text, b = lines[k + 1].text; if (!a.trim() || !b.trim()) continue;
      if (/\\s$/.test(a)) continue;
      const lastC = a.trim().slice(-1), firstC = b.trim()[0];
      if ((isHan(lastC) || /\\d/.test(lastC)) && (isHan(firstC) || /[\\d%]/.test(firstC))) { kind.push('어절중간'); break; }
    }
    // 2) 마지막 줄에 1~2글자만 남음
    const lastT = lines[lines.length - 1].text.trim().replace(/[.,·)\\]]/g, '');
    if (lastT.length <= 2 && t.length >= 6) kind.push('꼬리글자');
    // 3) 짧은 글자가 줄바뀜
    if (t.length <= 10) kind.push('짧은글자');
    if (!kind.length) continue;
    issues.push({ type: kind.join('+'), text: t.slice(0, 70), lines: lines.length, line1: lines[0].text.trim().slice(0, 30), lineN: lines[lines.length - 1].text.trim().slice(0, 30), el: sig(el), w: Math.round(el.getBoundingClientRect().width), ws: cs.whiteSpace, wb: cs.wordBreak, ow: cs.overflowWrap });
  }
  // 4) 잘림: 넘친 글자가 숨겨짐
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) return;
    if (!(el.textContent || '').trim()) return;
    let hid = false; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (getComputedStyle(a).display === 'none') { hid = true; break; } } if (hid) return;
    const clipX = /hidden|clip/.test(cs.overflowX), clipY = /hidden|clip/.test(cs.overflowY);
    if (clipX && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) issues.push({ type: cs.textOverflow === 'ellipsis' ? '말줄임' : '가로잘림', text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60), el: sig(el), w: el.clientWidth, sw: el.scrollWidth });
    else if (clipY && el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0 && !/auto|scroll/.test(cs.overflowY) && el.children.length < 6) issues.push({ type: '세로잘림', text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60), el: sig(el), h: el.clientHeight, sh: el.scrollHeight });
  });
  const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (over > 1) issues.push({ type: '화면밖넘침', text: '문서 가로 ' + document.documentElement.scrollWidth + ' > 화면 ' + document.documentElement.clientWidth, el: 'document' });
  return issues;
})()`;

const VIEWS = [{ n: '폰360', w: 360, h: 780 }, { n: '폰390', w: 390, h: 844 }, { n: '태블릿820', w: 820, h: 1100 }, { n: 'PC1400', w: 1400, h: 900 }];
const SCREENS = [
  ['계약 리스트', `switchTab('리스트',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'리스트'")))`],
  ['그룹별(펼침)', `window._gOpen={'가나다 가족':true,'지인들':true}; expandedCustomer='pid_demo1'; switchTab('그룹별',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'그룹별'")))`],
  ['월별 실적', `expandedMonth='26.10'; switchTab('월별',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'월별'")))`],
  ['보장분석-합계(홍길동)', `selectedCovCustomer='pid_demo1'; window._mtxMode='sum'; switchTab('보장분석',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'보장분석'")))`],
  ['보장분석-보험별표(홍길동)', `selectedCovCustomer='pid_demo1'; window._mtxMode='full'; switchTab('보장분석',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'보장분석'")))`],
  ['보장분석-김서연', `selectedCovCustomer='pid_demo3'; window._mtxMode='sum'; switchTab('보장분석',[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes("'보장분석'")))`],
  ['팝업-알림', `closeAll(); openReminders()`],
  ['팝업-청구서류안내', `closeAll(); openDocGuide()`],
  ['팝업-계약수정', `closeAll(); openEditModal(1)`],
  ['팝업-계약추가', `closeAll(); openAddModal()`],
  ['팝업-월수입', `closeAll(); openIncomeModal()`],
  ['팝업-그룹설정', `closeAll(); openCovGroupEditor()`],
  ['팝업-서버설정', `closeAll(); openServerSettings()`],
  ['팝업-보맵', `closeAll(); openBomappModal()`],
  ['팝업-외부보험추가', `closeAll(); openAddExternalModal('pid_demo1')`],
  ['팝업-기존보험추가', `closeAll(); openAddOtherPolicy('pid_demo1')`],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const all = [];
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await page.addInitScript(SEED);
    await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate(`window.closeAll = () => { document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on')); document.getElementById('cov-tidy')?.remove(); };`);
    for (const [name, code] of SCREENS) {
      try {
        await page.evaluate('closeAll()');                  // 서버 주소가 없으면 앱이 설정 팝업을 자동으로 열어서, 화면마다 먼저 닫아요
        await page.evaluate(code); await page.waitForTimeout(250);
        const iss = await page.evaluate(SCAN);
        iss.forEach(i => all.push(Object.assign({ view: v.n, screen: name }, i)));
        if (SHOT && /^(폰390|PC1400)$/.test(v.n)) await page.screenshot({ path: path.join(SHOT, `${v.n}_${name.replace(/[^가-힣A-Za-z0-9-]/g, '')}.png`), fullPage: true });
      } catch (e) { all.push({ view: v.n, screen: name, type: '실행오류', text: String(e.message).slice(0, 160), el: '' }); }
    }
    await page.evaluate(`closeAll()`);
    // 고객 화면은 새로 열어서
    const cp = await ctx.newPage(); await cp.addInitScript(SEED);
    await cp.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'load' }); await cp.waitForTimeout(500);
    try {
      await cp.evaluate(`showCustomerView('pid_demo1','홍길동')`); await cp.waitForTimeout(300);
      for (const [name, pre] of [['고객화면', ''], ['고객화면-전체펼침', `document.querySelectorAll('#cv-screen details').forEach(d=>d.open=true)`]]) {
        if (pre) await cp.evaluate(pre);
        await cp.waitForTimeout(200);
        const iss = await cp.evaluate(SCAN); iss.forEach(i => all.push(Object.assign({ view: v.n, screen: name }, i)));
        if (SHOT && /^(폰390|PC1400)$/.test(v.n)) await cp.screenshot({ path: path.join(SHOT, `${v.n}_${name}.png`), fullPage: true });
      }
    } catch (e) { all.push({ view: v.n, screen: '고객화면', type: '실행오류', text: String(e.message).slice(0, 160), el: '' }); }
    if (errs.length) all.push({ view: v.n, screen: '(전체)', type: '스크립트오류', text: errs.join(' | '), el: '' });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
  const by = {}; all.forEach(i => { by[i.type] = (by[i.type] || 0) + 1; });
  console.log('총 ' + all.length + '건', JSON.stringify(by));
  const blocking = all.filter(i => /어절중간|꼬리글자|화면밖넘침|실행오류|스크립트오류/.test(i.type));
  const seen = new Set();
  blocking.forEach(i => { const k = i.type + '|' + i.text; if (seen.has(k) || seen.size >= 20) return; seen.add(k); console.log('  ❌ [' + i.view + '] ' + i.screen + ' · ' + i.type + ' · ' + i.text.slice(0, 50) + (i.el ? '  (' + i.el.slice(0, 50) + ')' : '')); });
  console.log(blocking.length ? '❌ 막는 항목 ' + blocking.length + '건 (어절 중간 꺾임·꼬리글자·화면 밖 넘침 등)' : '✅ 어색한 줄바뀜·넘침 없음 (남은 말줄임·잘림은 의도한 것인지 ' + OUT + ' 에서 확인)');
  process.exitCode = blocking.length ? 1 : 0;
})().catch(e => { console.error('SCAN_FAIL', e.message); process.exit(1); });
