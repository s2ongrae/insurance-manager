// 고객별 탭: 보험 한 줄을 누르면 보험 정보 + 보장(담보) 내역 팝업 (사용자 요청 2026-11-19, 가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 30000000, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const C = (id, pid, name) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g: '', pn: 'PN-TEST-1' });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_a', '김가입')]),
  ins_coverages: JSON.stringify({ pid_a: { policies: [{ id: 1, items: [{ name: '암진단비', amount: 3000, unit: '만원', price: 12000 }, { name: '입원일당', amount: 5, unit: '만원', price: 0 }], payPeriod: '20년납', covPeriod: '100세', renewable: '비갱신형' }] } }),
  ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}', ins_memos: JSON.stringify({ 1: '첫 줄 메모' }) } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 가입자의 계약: 보험 정보 + 보장 내역');
let h = D.get(`policyPopupHtml('pid_a', 1)`);
ok(/다라생명/.test(h) && /계약1/.test(h) && /50,000원/.test(h) && /PN-TEST-1/.test(h) && /첫 줄 메모/.test(h), '보험사·보험명·월보험료·증권번호·메모');
ok(/보장 내역 \(2개\)/.test(h) && /암진단비/.test(h) && /3천만원/.test(h) && /12,000원/.test(h) && /입원일당/.test(h), '담보 이름·가입금액·보험료가 표로 나옴');
ok(/20년납 · 100세 · 비갱신형/.test(h), '납입·보장 기간');
ok(D.get(`policyPopupHtml('pid_a', 999)`) === null && D.get(`policyPopupHtml('pid_x', 1)`) === null, '없는 보험·남의 보험은 열리지 않음 (null)');

console.log('B) 예비 고객(보맵 가져온) 보험: 보맵 납입 정보 + 보장 내역');
D.ctx.__f = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 9, memberId: 9, name: '박예비', policies: [{ insuranceId: 77, insurerName: '가나화재', productName: '예비건강보험', insuranceStatus: '정상', primaryInsuredName: '박예비', isPrimaryInsuredMyself: true,
  issueDate: '2024-01-01', monthlyPaymentAmount: 8000, paymentCycle: '매월', totalPaymentCount: 240, paidPaymentCount: 20, riders: [rider(1, '암진단비'), rider(2, '뇌졸중진단비')] }] }] };
D.get('importBomappData(__f)');
const pros = D.get(`peopleList().find(p=>p.name==='박예비').pid`);
const polId = D.get(`COVERAGES['${pros}'].externalPolicies[0].id`);
h = D.get(`policyPopupHtml('${pros}', ${polId})`);
ok(/가나화재/.test(h) && /예비건강보험/.test(h) && /8,000원/.test(h) && /박예비 님의 보험/.test(h), '보험 기본 정보');
ok(/납입 20\/240회/.test(h) && /보맵/.test(h), '보맵에서 가져온 납입 현황');
ok(/보장 내역 \(2개\)/.test(h) && /암진단비/.test(h) && /뇌졸중진단비/.test(h), '특약(담보)이 보장 내역으로');
ok(/보장분석에서 보기/.test(h) && /닫기/.test(h), '닫기 · 보장분석으로 가는 버튼');

console.log('C) 고객별 탭의 줄을 누르면 팝업이 열리도록 연결됨');
D.run(`expandedCustomer='pid_a'; renderGroups()`);
let t = D.el('pane-그룹별').innerHTML;
ok(/class="pol-row"[^>]*onclick="openPolicyPopup\('pid_a',1\)"/.test(t), '가입자 계약 줄: 눌러서 팝업');
D.run(`expandedCustomer='p:${pros}'; renderGroups()`); t = D.el('pane-그룹별').innerHTML;
ok(new RegExp(`class="pol-row"[^>]*onclick="openPolicyPopup\\('${pros}',${polId}\\)"`).test(t), '예비 고객 보험 줄: 눌러서 팝업');
ok(/onclick="event\.stopPropagation\(\);movePolicyTo\(/.test(t) && /onclick="event\.stopPropagation\(\);deletePolicy\(/.test(t), '옮기기·삭제 버튼을 눌러도 팝업은 안 뜸');
D.run(`openPolicyPopup('${pros}', ${polId})`); D.run(`closePolicyPopup()`);
ok(D.errors.length === 0, '팝업 열고 닫기 오류 없음 ' + D.errors.join('|'));

console.log(`\n보험 팝업 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
