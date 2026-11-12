// 화면 정리(2026-11-11): 전체 비교 맨 위 · 합계 칸 맨 왼쪽 · 보맵 리포트 비밀번호 설정 · 메뉴 정리 · 고객 화면 펼치기/접기 (가짜 데이터만)
const fs = require('fs'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const PID = 'pid_uitest01';
const ls = {
  ins_contracts: JSON.stringify([{ id: 1, pid: PID, c: '가나다', p: '가나다', co: '가나생명', n: '든든종신', s: '계약완료', d: '25.03.02', pr: 85000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [PID]: {
    policies: [{ id: 1, items: [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '일반사망', amount: 10000, unit: '만원' }] }],
    externalPolicies: [{ id: -5, co: '마바손해보험', n: '실손의료비', pr: 23000, items: [{ name: '암진단비', amount: 2000, unit: '만원' }] }],
    bomapp: { memberId: 9, plannerMemberId: 9, at: '2026-11-11T07:00:00', reportUrl: 'https://drive.google.com/file/d/abc/view' } } }),
  ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}'
};

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 보장분석 상세: 전체 비교가 맨 위, 버튼은 더보기로');
D.run(`window._mtxMode='full'; selectedCovCustomer='${PID}'; renderCovDetail('${PID}')`);
let cd = D.el('cov-detail').innerHTML;
const iCmp = cd.indexOf('보험별 설정 결과 전체 비교 보기'), iBm = cd.indexOf('보맵 연동'), iOvw = cd.indexOf('보험 개요'), iList = cd.indexOf('보험별 담보 내역');
ok(iCmp > 0 && iCmp < iBm && iCmp < iOvw && iCmp < iList, '전체 비교 보기가 보맵 머리줄·개요·담보 내역보다 위');
ok(!/필요할 때 펼쳐보세요/.test(cd) && !/policy-first-intro/.test(cd), '군더더기 안내 문구 제거');
const head = cd.slice(0, cd.indexOf('</details>', cd.indexOf('more-menu')));
ok(/class="more-menu"/.test(cd) && /⋯ 더보기/.test(cd), '상세 버튼은 ⋯ 더보기 메뉴로');
ok(/✏️ 이름 변경/.test(head) && /🔀 합치기/.test(head) && /✂️ 분리/.test(head) && /고객 링크 재발급/.test(head), '이름 변경·합치기·분리·재발급은 메뉴 안에 그대로 있음');
ok(/📤 고객 링크 복사/.test(cd) && /➕ 기존 보험 추가/.test(cd), '자주 쓰는 버튼은 밖에');

console.log('B) 보험별 표(관리): 합계 칸이 담보 이름 바로 오른쪽');
const thead = cd.slice(cd.indexOf('>담보 항목</th>'), cd.indexOf('</thead>', cd.indexOf('>담보 항목</th>')));
ok(thead.indexOf('합계') > 0 && thead.indexOf('합계') < thead.indexOf('실손의료비'), '머리줄: 담보 항목 → 합계 → 보험들');
const row = cd.slice(cd.indexOf('>일반암 진단비<'), cd.indexOf('</tr>', cd.indexOf('>일반암 진단비<')));
ok(row.indexOf('5천만원') >= 0 && row.indexOf('5천만원') < row.indexOf('3천만원'), '행: 합계(5천만원)가 보험별 금액(3천만원)보다 먼저');

console.log('C) 보맵 리포트 비밀번호: 설정에 저장, 관리 화면에만');
ok(!/비밀번호: 9644/.test(html) && !/CORRECT_PIN/.test(html), '코드에 비밀번호 숫자를 넣지 않음');
ok(/비밀번호: 플래너 사번/.test(cd), '설정 전에는 "플래너 사번" 안내');
D.run(`setBmReportPw(' PW-TEST ')`);
ok(D.get(`SETTINGS.bomapp.reportPw==='PW-TEST'`), 'SETTINGS.bomapp.reportPw 에 저장 (앞뒤 공백 제거)');
ok(D.get(`JSON.parse(localStorage.getItem('ins_settings')).bomapp.reportPw==='PW-TEST'`), '이 기기 저장 + 동기화 대상(settings)');
D.run(`renderCovDetail('${PID}')`); cd = D.el('cov-detail').innerHTML;
ok(/비밀번호: PW-TEST/.test(cd), '관리 화면 리포트 안내에 저장한 비밀번호');
D.run(`openBomappModal()`);
ok(D.get(`document.getElementById('bm-report-pw').value==='PW-TEST'`), '보맵 창을 열면 입력칸에 저장된 값');
D.run(`setBmReportPw('<img src=x onerror=alert(1)>')`); D.run(`renderCovDetail('${PID}')`);
ok(!/<img src=x/.test(D.el('cov-detail').innerHTML), '비밀번호 값은 글자 그대로(태그 실행 안 됨)');
D.run(`setBmReportPw('PW-TEST')`);

console.log('D) 상단 헤더: 서버·동기화·보맵·백업·복원은 ⚙️ 관리 메뉴 안');
const hdr = html.slice(html.indexOf('<div class="hdr-right">'), html.indexOf('<div class="main">'));
const menu = hdr.slice(hdr.indexOf('more-menu hdr-menu'), hdr.indexOf('</details>'));
ok(/⚙️ 관리/.test(hdr), '⚙️ 관리 메뉴');
ok(['openServerSettings()', 'manualSync()', 'openBomappModal()', 'exportData()', 'importData(event)'].every(f => menu.includes(f)), '메뉴 안에 서버·동기화·보맵·백업·복원이 모두 있음');
ok(hdr.includes('openReminders()') && hdr.includes('openAddModal()') && !menu.includes('openAddModal()'), '알림·계약 추가는 밖에');
ok(/\.btn\{[^}]*white-space:nowrap/.test(html), '버튼 글자가 세로로 깨지지 않게 (nowrap)');

console.log('E) 고객 화면: 펼치기·접기');
D.run(`showCustomerView('${PID}', '')`);
const cv = D.bodyHtml;
ok(/cvFoldAll\(true\)/.test(cv) && /cvFoldAll\(false\)/.test(cv), '모두 펼치기 / 모두 접기 버튼');
ok((cv.match(/<details class="cv-policy" data-fold>/g) || []).length === 2, '보험마다 눌러서 펼치는 칸 (2건, 처음엔 접힘)');
ok(/<details class="cv-ovw" data-fold open>/.test(cv) && /<details data-fold open><summary class="cv-sec">📊 분야별 보장 합계/.test(cv) && /<details data-fold open><summary class="cv-sec">📋 보험별 담보 내역/.test(cv), '개요·분야별 합계·담보 내역 구역도 접을 수 있음 (처음엔 펼침)');
ok(!/PW-TEST/.test(cv) && !/플래너 사번/.test(cv), '고객 화면에는 리포트 비밀번호가 안 나옴');
const cvHead = cv.slice(cv.indexOf('담보 항목'), cv.indexOf('</thead>', cv.indexOf('담보 항목')));
ok(cvHead.indexOf('합계') > 0 && cvHead.indexOf('합계') < cvHead.indexOf('실손의료비'), '고객 보험별 표도 합계 칸이 먼저');
// 고객 화면 펼치기/접기 함수가 실제로 동작하는지 (가짜 DOM 의 querySelectorAll 이 지원하는 범위)
ok(D.get(`typeof cvFoldAll==='function'`), 'cvFoldAll 함수 있음');

console.log(`\n화면 정리 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
