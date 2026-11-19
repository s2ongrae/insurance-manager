// 그룹별·고객별: 가입자(피보험자)가 앞, 계약자는 그 뒤 / 가입자가 가져온 보맵 보험도 같이 보임 / 보맵 계약자 가려진 이름 풀기 (사용자 요청 2026-11-19, 가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, ins, holder, self = false) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: ins, isPrimaryInsuredMyself: self, subscriberName: holder,
  issueDate: '2024-0' + (id % 9 + 1) + '-01', monthlyPaymentAmount: 1000 * id, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const K = (id, pid, holder, ins, g, extra) => Object.assign({ id, pid, c: holder, p: ins, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.0' + id, pr: 10000 * id, g }, extra || {});

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([K(1, 'pid_a', '김아름', '김아름', '지인'), K(2, 'pid_j', '김아름', '조유건', '가족'), K(3, 'pid_m', '이무그룹', '이무그룹', '지인')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: JSON.stringify({ 지인: '#3B82F6', 가족: '#10B981', 친구: '#F59E0B' }), ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
// 김아름 보맵: 본인 보험 1건 + 조*건(= 조유건, 계약자 김아름) 2건 + 조*인(조해인, 계약자 김*름 으로 가려져 옴) 1건
D.ctx.__f = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 7, memberId: 7, name: '김아름', policies: [
  pol(1, '김아름', '김아름', true), pol(2, '조*건', '김아름'), pol(3, '조*건', '김*름'), pol(4, '조*인', '김*름')] }] };
D.get('importBomappData(__f)');
const pidOf = n => D.get(`peopleList().find(p=>p.name==='${n}').pid`);

console.log('A) 고객별: 가입자가 한 줄 (계약자는 뒤 칸). 조유건이 김아름 밑에 묻히지 않고 따로 보임');
D.run(`renderCustomers()`); let h = D.el('pane-고객별').innerHTML;
ok(h.indexOf('<th>가입자</th>') > -1 && h.indexOf('<th>가입자</th>') < h.indexOf('<th>계약자</th>'), '표 머리: 가입자 → 계약자 순서');
const rowOf = n => { const i = h.indexOf(`data-pid="${pidOf(n)}"`); return i < 0 ? '' : h.slice(i, h.indexOf('</tr>', i)); };
ok(/조유건/.test(rowOf('조유건')) && />김아름</.test(rowOf('조유건').replace(/\s+/g, '').replace(/<td[^>]*>/g, '>').replace(/<\/td>/g, '<')), '조유건 행이 따로 있고 계약자 칸에 김아름');
ok(/본인/.test(rowOf('이무그룹')), '가입자=계약자면 계약자 칸은 "본인"');
ok(D.get(`peopleList().filter(p=>p.cs.length).length`) === 3 && /가입자 <b>3<\/b>/.test(h), '가입자 3명 (김아름·조유건·이무그룹) — 계약자 이름이 아니라 가입자 수');
ok(/\+보맵2/.test(rowOf('조유건')), '조유건 줄에 +보맵 2건 표시');

console.log('B) 펼치면: 내 계약 + 가져온 보맵 보험 (조유건 보험 2개가 안 보이던 문제), 계약자 칸');
const jid = pidOf('조유건');
D.run(`expandedCustomer='${jid}'; renderCustomers()`); h = D.el('pane-고객별').innerHTML;
ok(/조유건님이 가진 보험 \(계약 1건 \+ 보맵·외부 2건\)/.test(h), '계약 1건 + 보맵·외부 2건');
ok(/보험2/.test(h) && /보험3/.test(h) && /계약2/.test(h), '계약과 보맵 보험 3줄 모두 보임');
ok(h.split('class="pol-row"').length - 1 >= 3 && /openPolicyPopup\('pid_j',2\)/.test(h), '줄마다 눌러서 팝업');
ok(/월 합계 보험료 \(내 계약\)/.test(h) && /가져온 보맵·외부 보험 월/.test(h), '합계: 내 계약과 가져온 보험을 나눠서');
const t0 = h.slice(h.indexOf('조유건님이 가진 보험'));
ok(t0.indexOf('<th style="padding:6px 10px;text-align:left;font-weight:600;color:var(--muted);white-space:nowrap">계약자') > -1, '보험 표에 계약자 칸');
ok(/김아름/.test(t0), '보험 줄의 계약자가 김아름');

console.log('C) 가려진 계약자 이름(김*름)은 보맵 고객 본인(김아름)으로 풀어서 보여줌');
const pol3 = D.get(`personExtPolicies('${jid}').find(o=>o.id===${D.get(`COVERAGES['${jid}'].externalPolicies.find(x=>x.bm.id===3).id`)})`);
ok(pol3.holder === '김*름' && D.get(`resolveHolder('김*름', '${jid}')`) === '김아름', '가려진 계약자 → 김아름');
ok(D.get(`resolveHolder('홍길동', '${jid}')`) === '홍길동' && D.get(`resolveHolder('', '${jid}')`) === '', '가려지지 않은 이름·빈 값은 그대로');

console.log('D) 가입자 줄에서 그룹을 바꾸면 그 가입자의 계약만 (계약자인 다른 사람 계약은 안 건드림)');
D.run(`moveCustomerGroup('조유건', '친구', false, '${jid}')`);
ok(D.get(`CONTRACTS.find(c=>c.id===2).g`) === '친구' && D.get(`CONTRACTS.find(c=>c.id===1).g`) === '지인', '조유건 계약만 친구로, 김아름 본인 계약은 그대로 (계약자가 같아도)');
D.run(`expandedCustomer='${jid}'; renderCustomers()`); h = D.el('pane-고객별').innerHTML;
ok(/data-pid="pid_j"/.test(h) && />친구</.test(h.slice(h.indexOf('data-pid="pid_j"'), h.indexOf('data-pid="pid_j"') + 4000)), '펼친 칸의 그룹 선택도 조유건 기준');
D.run(`expandedCustomer=null; moveCustomerGroup('조유건', '가족', false, '${jid}')`);

console.log('E) 그룹별: 가입자 → 계약자 순서, 가져온 보맵 보험도 같은 그룹 카드에');
D.run(`renderGroups()`); const gh = D.el('pane-그룹별').innerHTML;
ok(gh.indexOf('<th>가입자</th>') > -1 && gh.indexOf('<th>가입자</th>') < gh.indexOf('<th>계약자</th>'), '그룹별 표 머리: 가입자 → 계약자');
const card = name => { const i = gh.indexOf(`<span class="gname">${name}</span>`); return i < 0 ? '' : gh.slice(gh.lastIndexOf('<div class="gcard">', i), gh.indexOf('<div class="gcard">', i) < 0 ? gh.length : gh.indexOf('<div class="gcard">', i)); };
const fam = card('가족');
ok(/조유건/.test(fam) && /보험2/.test(fam) && /보험3/.test(fam) && /보맵·외부/.test(fam), '가족 그룹 카드에 조유건의 계약 + 보맵 보험 2건');
ok(/>김아름</.test(fam.replace(/\s+/g, '')) && /1명/.test(fam), '계약자 칸에 김아름, 인원은 가입자 수(1명)');
ok(!/보험2/.test(card('지인')), '다른 그룹엔 없음');
ok(/openPolicyPopup\('pid_j'/.test(fam), '그룹별 보맵 보험 줄도 눌러서 팝업');

console.log('F) 예비 고객(조해인 될 사람): 그룹별·고객별 모두 가입자 앞, 계약자(김아름)는 뒤');
const mk = pidOf('조*인');
D.run(`moveCustomerGroup('조*인', '친구', true)`);
D.run(`renderGroups()`); const gh2 = D.el('pane-그룹별').innerHTML;
const i2 = gh2.indexOf('조*인'), row2 = gh2.slice(gh2.lastIndexOf('<tr', i2), gh2.indexOf('</tr>', i2));
ok(/조\*인/.test(row2) && />김아름</.test(row2.replace(/\s+/g, '').replace(/<td[^>]*>/g, '>').replace(/<\/td>/g, '<')) && row2.indexOf('조*인') < row2.indexOf('김아름'), '그룹별 예비 고객 줄: 가입자 조*인 다음에 계약자 김아름 (조*인 본인이 계약자로 나오지 않음)');
D.run(`expandedCustomer='p:${mk}'; renderCustomers()`); h = D.el('pane-고객별').innerHTML;
ok(/조\*인님이 가진 보험 \(1건\)/.test(h) && /김아름/.test(h.slice(h.indexOf('조*인님이 가진 보험'))), '고객별 예비 고객 보험 표에도 계약자 김아름');

console.log(`\n가입자 기준 화면 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
