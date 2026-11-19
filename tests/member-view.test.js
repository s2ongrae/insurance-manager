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
D.run(`renderGroups()`); let h = D.el('pane-그룹별').innerHTML;
ok(h.indexOf('<th>가입자</th>') > -1 && h.indexOf('<th>가입자</th>') < h.indexOf('<th>계약자</th>'), '표 머리: 가입자 → 계약자 순서');
const rowOf = n => { const i = h.indexOf(`data-pid="${pidOf(n)}"`); return i < 0 ? '' : h.slice(i, h.indexOf('</tr>', i)); };
ok(/조유건/.test(rowOf('조유건')) && />김아름</.test(rowOf('조유건').replace(/\s+/g, '').replace(/<td[^>]*>/g, '>').replace(/<\/td>/g, '<')), '조유건 행이 따로 있고 계약자 칸에 김아름');
ok(/본인/.test(rowOf('이무그룹')), '가입자=계약자면 계약자 칸은 "본인"');
ok(D.get(`peopleList().filter(p=>p.cs.length).length`) === 3 && /가입자 <b>3<\/b>/.test(h), '가입자 3명 (김아름·조유건·이무그룹) — 계약자 이름이 아니라 가입자 수');
ok(/\+보맵2/.test(rowOf('조유건')), '조유건 줄에 +보맵 2건 표시');

console.log('B) 펼치면: 내 계약 + 가져온 보맵 보험 (조유건 보험 2개가 안 보이던 문제), 계약자 칸');
const jid = pidOf('조유건');
D.run(`expandedCustomer='${jid}'; renderGroups()`); h = D.el('pane-그룹별').innerHTML;
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
D.run(`expandedCustomer='${jid}'; renderGroups()`); h = D.el('pane-그룹별').innerHTML;
ok(/data-pid="pid_j"/.test(h) && />친구</.test(h.slice(h.indexOf('data-pid="pid_j"'), h.indexOf('data-pid="pid_j"') + 4000)), '펼친 칸의 그룹 선택도 조유건 기준');
D.run(`expandedCustomer=null; moveCustomerGroup('조유건', '가족', false, '${jid}')`);

console.log('E) 그룹별(그룹 → 고객 → 계약): 가입자 → 계약자 순서, 처음엔 접힘, 고객을 누르면 계약·가져온 보맵 보험');
D.run(`expandedCustomer=null; renderGroups()`); let gh = D.el('pane-그룹별').innerHTML;
ok(gh.indexOf('<th>가입자</th>') > -1 && gh.indexOf('<th>가입자</th>') < gh.indexOf('<th>계약자</th>'), '그룹별 표 머리: 가입자 → 계약자');
const card = name => { const i = gh.indexOf(`<span class="gname">${name}</span>`); return i < 0 ? '' : gh.slice(gh.lastIndexOf('<div class="gcard">', i), gh.indexOf('<div class="gcard">', i) < 0 ? gh.length : gh.indexOf('<div class="gcard">', i)); };
ok(!/class="gtbl open"/.test(gh) && !/class="gtoolbar"/.test(gh), '그룹 카드는 처음에 모두 접혀 있음 (기본값)');
let fam = card('가족');
ok(/조유건/.test(fam) && /\+보맵2/.test(fam) && />김아름</.test(fam.replace(/\s+/g, '').replace(/<td[^>]*>/g, '>').replace(/<\/td>/g, '<')) && /1명/.test(fam), '가족 그룹 카드: 조유건 한 줄 (계약자 김아름, 보맵 2건, 인원은 가입자 수 1명)');
ok(!/님이 가진 보험/.test(fam) && !/openPolicyPopup/.test(fam), '고객을 누르기 전엔 계약·보험 목록(표)이 안 나옴');
D.run(`toggleCustomerDetail('${jid}')`); gh = D.el('pane-그룹별').innerHTML; fam = card('가족');
ok(/class="gtbl open"/.test(fam) && /보험2/.test(fam) && /보험3/.test(fam) && /계약2/.test(fam) && /보맵·외부/.test(fam), '조유건을 누르면 그 그룹 카드가 열리고 계약 + 보맵 보험 2건이 나옴');
ok(/openPolicyPopup\('pid_j'/.test(fam), '보험 줄을 누르면 팝업');
ok(!/님이 가진 보험/.test(card('지인')) && !/class="gtbl open"/.test(card('지인')), '다른 그룹은 그대로 접힘');
D.run(`toggleG('g0','가족')`);
D.run(`toggleCustomerDetail('${jid}')`);                                   // 접기
ok(D.get('expandedCustomer') === null, '한 번 더 누르면 접힘');

console.log('F) 예비 고객(조해인 될 사람): 가입자 앞, 계약자(김아름)는 뒤');
const mk = pidOf('조*인');
D.run(`moveCustomerGroup('조*인', '친구', true)`);
D.run(`renderGroups()`); const gh2 = D.el('pane-그룹별').innerHTML;
const i2 = gh2.indexOf(`data-pid="${mk}"`), row2 = gh2.slice(i2, gh2.indexOf('</tr>', i2));
ok(i2 > -1 && /조\*인/.test(row2) && />김아름</.test(row2.replace(/\s+/g, '').replace(/<td[^>]*>/g, '>').replace(/<\/td>/g, '<')) && row2.indexOf('조*인') < row2.indexOf('김아름'), '예비 고객 줄: 가입자 조*인 다음에 계약자 김아름 (조*인 본인이 계약자로 나오지 않음)');
ok(/class="gtbl open"/.test(card('친구')) === false, '친구 그룹도 접힌 채 (펼치기 전)');
D.run(`expandedCustomer='p:${mk}'; renderGroups()`); h = D.el('pane-그룹별').innerHTML;
ok(/조\*인님이 가진 보험 \(1건\)/.test(h) && /김아름/.test(h.slice(h.indexOf('조*인님이 가진 보험'))), '예비 고객을 펼치면 보험 표에도 계약자 김아름');

console.log('G) 내 계약과 겹치지 않는 새 보맵 보험은 보장분석에서 기본 "기존"으로 체크');
const ex = D.get(`COVERAGES['${jid}'].externalPolicies.map(x=>x.id)`);
ok(ex.length === 2 && ex.every(id => D.get(`remodelRoleOf('${jid}', {id:${id}})`) === 'both'), '조유건의 새 보맵 보험 2건이 모두 "기존"(both)으로');
D.run(`setRemodelRole('${jid}', ${ex[0]}, 'after')`);
D.get('importBomappData(__f)');
ok(D.get(`remodelRoleOf('${jid}', {id:${ex[0]}})`) === 'after' && D.get(`remodelRoleOf('${jid}', {id:${ex[1]}})`) === 'both', '다시 가져와도 이미 고른 역할은 그대로');
D.get('importBomappData(__f)');
ok(D.get(`COVERAGES['${jid}'].externalPolicies.length`) === 2, '다시 가져와도 중복 안 생김');

console.log('H) 가족이 피보험자인 보험: 특약이 전부 "내 계약 아님"으로 와도 그 가족 몫 담보로 들어옴 (조유건 농협 담보가 비던 문제)');
const famRider = (id, name, ins, mine) => ({ contractId: id, name, joinAmount: 20000000, maturityDate: '2045-01-01', insuredName: ins, contractStatus: '정상', isMyContract: mine });
D.ctx.__g = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 7, memberId: 7, name: '김아름', policies: [
  pol(1, '김아름', '김아름', true), pol(2, '조*건', '김아름'), pol(3, '조*건', '김*름'), pol(4, '조*인', '김*름'),
  Object.assign(pol(8, '조*건', '김아름'), { riders: [famRider(81, '농협특약A', '조*건', false), famRider(82, '농협특약B', '조*건', false), famRider(83, '다른사람 특약', '박*수', false)] })] }] };
D.get('importBomappData(__g)');
const nh = D.get(`COVERAGES['${jid}'].externalPolicies.find(x=>x.bm.id===8)`);
ok(nh.items.map(i => i.name).sort().join() === '농협특약A,농협특약B', '같은 피보험자(조*건)의 특약 2개는 담보로');
ok(nh.bm.extra.length === 1 && nh.bm.extra[0].name === '다른사람 특약', '피보험자가 다른 사람(박*수)인 특약만 따로(합계에 안 넣음)');
const own = D.get(`COVERAGES['${pidOf('김아름')}'].externalPolicies.find(x=>x.bm.id===1)`);
ok(own.items.length === 1 && own.bm.extra.length === 0, '고객 본인 보험은 예전처럼');

console.log('I) 특약 분류 기준 = 피보험자 (내 계약이 아니어도 피보험자면 담보 / 가족 보험에 얹힌 고객 본인 특약은 따로)');
D.ctx.__g = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 7, memberId: 7, name: '김아름', policies: [
  pol(1, '김아름', '김아름', true), pol(2, '조*건', '김아름'), pol(3, '조*건', '김*름'), pol(4, '조*인', '김*름'),
  Object.assign(pol(9, '조*건', '김아름'), { riders: [famRider(91, '가족특약', '조*건', false), famRider(92, '엄마특약', '김아름', true), famRider(93, '주인없는특약', '', false)] }),
  Object.assign(pol(10, '김아름', '김아름', true), { riders: [famRider(101, '본인특약', '김*름', true), famRider(102, '본인특약2', '김아름', true)] })] }] };
D.get('importBomappData(__g)');
const p9 = D.get(`COVERAGES['${jid}'].externalPolicies.find(x=>x.bm.id===9)`);
ok(p9.items.map(i => i.name).join() === '가족특약' && p9.bm.extra.map(i => i.name).sort().join() === '엄마특약,주인없는특약', '가족 보험: 가족(조*건) 특약만 담보, 고객 본인(김아름) 특약·피보험자 모르는 특약은 합계 제외');
const p10 = D.get(`COVERAGES['${pidOf('김아름')}'].externalPolicies.find(x=>x.bm.id===10)`);
ok(p10.items.length === 2 && p10.bm.extra.length === 0, '본인 보험: 가려진 이름(김*름)이 본인과 글자가 맞으면 본인 특약으로');

console.log('J) 이미 가져와 둔 잘못된 보험 고치기: 가족 보험의 담보가 비어 있던 것(전부 합계 제외 목록에 있던 것)을 담보로 옮김');
const bad = { id: -777, co: '가나화재', n: '옛가족보험', pr: 1, items: [], bm: { id: 777, insured: '조*건', issue: '2020.01.01', status: '정상', extra: [
  { name: '옛특약A', amount: 1000, unit: '만원', price: 0, who: '조*건' }, { name: '옛특약B', amount: 500, unit: '만원', price: 0, who: '조*건' },
  { name: '만기특약', amount: 100, unit: '만원', price: 0, st: '만기', who: '조*건' }, { name: '남의특약', amount: 100, unit: '만원', price: 0, who: '박*수' }] } };
D.run(`COVERAGES['${jid}'].externalPolicies.push(${JSON.stringify(bad)})`);
ok(D.run('fixBmRiderSplit()') === true, '옛 기록이 있으면 고침');
const fixed = D.get(`COVERAGES['${jid}'].externalPolicies.find(x=>x.id===-777)`);
ok(fixed.items.map(i => i.name).join() === '옛특약A,옛특약B' && fixed.bm.extra.map(i => i.name).sort().join() === '남의특약,만기특약' && !('who' in fixed.items[0]), '같은 피보험자 특약 2개는 담보로, 만기·남의 특약은 합계 제외에 그대로');
ok(D.run('fixBmRiderSplit()') === false, '여러 번 실행해도 더 바뀌지 않음');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${jid}'].externalPolicies.find(x=>x.id===-777).items.length`) === 2, '고친 결과가 저장돼 동기화 대상에 들어감');

console.log('K) 같은 보험이 두 번 들어간 것(다른 보맵 계정에서 각각 가져옴) 정리: 담보 많은 쪽을 남기고 보험료·계약자는 합침');
const dupA = { id: -801, co: '가나화재', n: '중복보험', pr: 0, items: [{ name: 'a', amount: 1, unit: '만원', price: 0 }, { name: 'b', amount: 1, unit: '만원', price: 0 }, { name: 'c', amount: 1, unit: '만원', price: 0 }], bm: { id: 801, insured: '조*건', holder: '김*름', issue: '2012.06.11', status: '정상', extra: [] } };
const dupB = { id: -802, co: '가나화재', n: '중복보험', pr: 5000, items: [{ name: 'a', amount: 1, unit: '만원', price: 0 }], bm: { id: 802, insured: '조*건', holder: '김아름', issue: '2012.06.11', status: '정상', extra: [] } };
D.run(`COVERAGES['${jid}'].externalPolicies.push(${JSON.stringify(dupA)}, ${JSON.stringify(dupB)}); renderGroups()`);
ok(D.get(`cleanupItems().some(it=>it.kind==='dups' && it.pid==='${jid}' && it.n===1)`) && /중복 정리/.test(D.el('pane-그룹별').innerHTML), '정리 패널에 중복 1건이 뜸');
D.confirmQ.push(false); D.run(`dedupePolicies('${jid}')`);
ok(D.get(`COVERAGES['${jid}'].externalPolicies.filter(x=>x.n==='중복보험').length`) === 2, '확인에서 아니오 하면 그대로');
D.confirmQ.push(true); D.run(`dedupePolicies('${jid}')`);
const left = D.get(`COVERAGES['${jid}'].externalPolicies.filter(x=>x.n==='중복보험')`);
ok(left.length === 1 && left[0].items.length === 3 && left[0].pr === 5000 && left[0].bm.holder === '김아름', '담보 3개짜리를 남기고, 월보험료(5,000)와 풀린 계약자(김아름)를 가져옴');
ok(D.get(`COVERAGES['${jid}'].bmSkip.includes(802)`) && D.get(`cleanupItems().some(it=>it.kind==='dups' && it.pid==='${jid}')`) === false, '지운 보험은 다시 가져와도 안 생기게 기록, 패널에서도 사라짐');

console.log(`\n가입자 기준 화면 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
