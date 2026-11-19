// 예비 고객 보험 표: 중복 의심 표시 · 삭제 · 다른 사람으로 옮기기(목록에 없는 사람은 새로 만들기) (사용자 요청 2026-11-19, 가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who, prod, self = true) => ({ insuranceId: id, insurerName: '가나화재', productName: prod, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: self,
  issueDate: '2024-01-01', monthlyPaymentAmount: 1000 * id, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const C = (id, pid, name) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g: '' });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
const idOf = n => D.get(`peopleList().find(p=>p.name==='${n}').pid`);
const nPeople = n => D.get(`peopleList().filter(p=>p.name==='${n}').length`);
const ext = n => D.get(`((COVERAGES['${idOf(n)}']||{}).externalPolicies||[]).map(x=>x.n)`);

// 조종연: 계약 없는 예비 고객. 같은 이름 보험이 두 번(보맵 번호는 다름) + 다른 사람 보험(조해인 것)이 잘못 섞임
D.ctx.__f = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 9, memberId: 9, name: '조종연',
  policies: [pol(1, '조종연', '알파보장보험'), pol(2, '조종연', '알파보장보험'), pol(3, '조종연', '치료비안심보험'), pol(4, '조종연', '자전거보험')] }] };
D.get('importBomappData(__f)');
const jp = idOf('조종연');

console.log('A) 표에 중복 의심 · 옮기기 · 삭제 버튼');
D.run(`expandedCustomer='p:${jp}'; renderCustomers()`); let h = D.el('pane-고객별').innerHTML;
ok(h.split('class="pol-dup"').length - 1 === 2, '같은 보험이 두 번이면 두 줄에 ⚠️ 중복 의심 (2개)');
ok(h.split('movePolicyTo(').length - 1 === 4 && h.split("deletePolicy('").length - 1 === 4, '보험마다 ➡️ 옮기기 · 🗑 버튼');

console.log('B) 중복 삭제');
const dupId = D.get(`COVERAGES['${jp}'].externalPolicies.filter(x=>x.n==='알파보장보험')[1].id`);
D.confirmQ.push(true); D.confirmQ.push(false);                  // 삭제 확인 → (보맵 보험이면) 다시 가져와도 빼 둘지: 아니오
D.run(`deletePolicy('${jp}', ${dupId})`);
ok(ext('조종연').length === 3 && ext('조종연').filter(n => n === '알파보장보험').length === 1, '중복 하나만 삭제됨');

console.log('C) 잘못 들어간 보험을 목록에 없는 새 사람(조해인)으로 옮김');
const bid = D.get(`COVERAGES['${jp}'].externalPolicies.find(x=>x.n==='자전거보험').id`);
D.promptQ.push(null);
D.run(`movePolicyTo('${jp}', ${bid})`);
ok(ext('조종연').includes('자전거보험') && nPeople('조해인') === 0, '번호 입력 취소하면 그대로');
D.promptQ.push('0'); D.promptQ.push('조해인'); D.confirmQ.push(true);
D.run(`movePolicyTo('${jp}', ${bid})`);
ok(nPeople('조해인') === 1 && JSON.stringify(ext('조해인')) === '["자전거보험"]' && !ext('조종연').includes('자전거보험'), '조해인 님이 새로 만들어지고 그 보험이 그쪽으로 감');
ok(D.get(`isProspectPerson(peopleList().find(p=>p.name==='조해인'))`), '새 사람은 예비 고객으로 보임 (계약 전)');
ok(D.get(`rootFamilyPid('${idOf('조해인')}') === rootFamilyPid('${jp}')`), '원래 사람의 가족으로 묶임');

console.log('D) 이미 있는 사람에게 옮기기 · 같은 이름 새로 만들기 거절 · 다시 가져와도 그 자리 유지');
const cid = D.get(`COVERAGES['${jp}'].externalPolicies.find(x=>x.n==='치료비안심보험').id`);
D.promptQ.push('0'); D.promptQ.push('김아름');                    // 이미 있는 이름으로는 새로 못 만듦
D.run(`movePolicyTo('${jp}', ${cid})`);
ok(ext('조종연').includes('치료비안심보험') && nPeople('김아름') === 1, '이미 있는 이름이면 새로 만들지 않고 안내');
const list = D.get(`peopleList().filter(p=>p.pid!=='${jp}').map(p=>p.name)`);
D.promptQ.push(String(list.indexOf('김아름') + 1)); D.confirmQ.push(true);
D.run(`movePolicyTo('${jp}', ${cid})`);
ok(ext('김아름').includes('치료비안심보험') && !ext('조종연').includes('치료비안심보험'), '목록에서 고른 기존 고객(김아름)에게 옮겨짐');
D.get('importBomappData(__f)');
ok(ext('조해인').filter(n => n === '자전거보험').length === 1 && ext('김아름').filter(n => n === '치료비안심보험').length === 1 && nPeople('조해인') === 1, '보맵을 다시 가져와도 옮긴 자리에서 갱신 (중복·되돌아옴 없음)');

console.log('E) 내 계약은 여기서 못 옮김');
D.run(`movePolicyTo('pid_a', 1)`);
ok(D.get(`CONTRACTS.filter(c=>cpid(c)==='pid_a').length`) === 1, '내 계약은 그대로');

console.log('F) 피보험자가 다른 사람인 보험이 잘못 섞였으면 알려주고 한꺼번에 옮김 (가려진 이름 → 실제 이름)');
D.run(`COVERAGES['${jp}'].externalPolicies.push({id:-901, co:'가나화재', n:'가려진보험1', pr:100, items:[], bm:{id:901, insured:'조*인', issue:'2024.01.01', status:'정상'}}, {id:-902, co:'가나화재', n:'가려진보험2', pr:200, items:[], bm:{id:902, insured:'조*인', issue:'2024.02.01', status:'정상'}}); expandedCustomer='p:${jp}'; renderCustomers()`);
h = D.el('pane-고객별').innerHTML;
ok(JSON.stringify(D.get(`Object.keys(foreignInsureds('${jp}'))`)) === '["조*인"]' && /피보험자가 <b>조\*인<\/b> 인 보험 2건/.test(h) && /moveInsuredPolicies/.test(h), '조종연 님 쪽에 조*인 보험 2건이 섞여 있다고 알려줌');
ok(h.split('피보험자 조*인').length - 1 === 2, '해당 줄마다 피보험자 이름이 달림');
const dstNames = D.get(`peopleList().filter(p=>p.pid!=='${jp}').map(p=>p.name)`);
D.promptQ.push(String(dstNames.indexOf('조해인') + 1)); D.confirmQ.push(true);
D.run(`moveInsuredPolicies('${jp}', '조*인')`);
ok(ext('조해인').includes('가려진보험1') && ext('조해인').includes('가려진보험2') && !ext('조종연').includes('가려진보험1') && !ext('조종연').includes('가려진보험2'), '두 건이 한 번에 조해인 님으로');
ok(D.get(`Object.keys(foreignInsureds('${idOf('조해인')}')).length`) === 0 && D.get(`Object.keys(foreignInsureds('${jp}')).length`) === 0, '조*인 은 조해인 과 글자가 맞아 더 이상 경고하지 않음');

console.log('G) 다른 사람 계약의 계약자이기도 한 예비 고객도 그룹이 옮겨짐');
D.ctx.__f2 = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 11, memberId: 11, name: '박예비', policies: [pol(21, '박예비', '예비보험')] }] };
D.get('importBomappData(__f2)');
D.run(`CONTRACTS = [...CONTRACTS, {id:77, pid:'pid_kid', c:'박예비', p:'박아이', co:'다라생명', n:'아이보험', s:'계약완료', d:'25.01.01', pr:1000, g:''}]; createGroup('친구'); renderAll()`);
ok(D.get(`isProspectPerson(peopleList().find(p=>p.name==='박예비'))`), '박예비 님은 계약자이지만 자기 계약은 없어 예비 고객');
D.run(`renderGroups()`); const gh = D.el('pane-그룹별').innerHTML;
ok(/class="grp-move"[^>]*data-pros="1"/.test(gh), '그룹별 탭의 예비 고객 그룹 선택칸은 예비 고객용 표시(data-pros)');
ok(D.run(`moveCustomerGroup('박예비', '친구', true)`) === true && D.get(`prospectGroupOf('박예비')`) === '친구', '그룹을 옮기면 예비 고객 자신의 그룹이 바뀜');
ok(D.get(`CONTRACTS.find(c=>c.id===77).g`) === '', '그 사람이 계약자인 다른 사람 계약의 그룹은 안 건드림');

console.log(`\n보험 이동·삭제 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
