// 보험을 다 옮기고 남은 "빈 사람" 정리 + 이미 있는 이름으로 새로 만들려 하면 그 사람 것으로 (사용자 요청 2026-11-19, 가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who, self = true) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: self,
  issueDate: '2024-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const C = (id, pid, name) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g: '' });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름'), C(2, 'pid_j', '조유건')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
const has = n => D.get(`peopleList().some(p=>p.name==='${n}')`);
const idOf = n => D.get(`peopleList().find(p=>p.name==='${n}').pid`);
const ext = n => D.get(`((COVERAGES['${idOf(n)}']||{}).externalPolicies||[]).map(x=>x.n)`);

D.ctx.__f = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 9, memberId: 9, name: '박예비', policies: [pol(1, '박예비'), pol(2, '박예비')] }] };
D.get('importBomappData(__f)');
const pb = idOf('박예비');
const polId = n => D.get(`COVERAGES['${pb}'].externalPolicies.find(x=>x.n==='${n}').id`);

console.log('A) 이미 있는 이름으로 새로 만들려 하면 그 사람 것으로 (이름을 바꿔 새로 만들 필요 없음)');
D.promptQ.push('0'); D.promptQ.push('조유건'); D.confirmQ.push(true); D.confirmQ.push(true);        // 이미 있어요 → 그 사람 것으로 → 옮기기 확인
D.run(`movePolicyTo('${pb}', ${polId('보험1')})`);
ok(D.get(`peopleList().filter(p=>p.name==='조유건').length`) === 1 && ext('조유건').includes('보험1') && !ext('박예비').includes('보험1'), '조유건 님이 둘로 안 나뉘고 기존 조유건 님에게 들어감');
D.promptQ.push('0'); D.promptQ.push('조유건'); D.confirmQ.push(false);                               // 이미 있어요 → 아니오
D.run(`movePolicyTo('${pb}', ${polId('보험2')})`);
ok(ext('박예비').includes('보험2'), '"그 사람 것으로" 에서 아니오 하면 그대로');

console.log('B) 다 옮기면 남는 빈 껍데기(옮기기로 만든 사람)는 자동으로 사라짐');
D.promptQ.push('0'); D.promptQ.push('조유건(김아름 아들)'); D.confirmQ.push(true);
D.run(`movePolicyTo('${pb}', ${polId('보험2')})`);
ok(has('조유건(김아름 아들)') && ext('조유건(김아름 아들)').length === 1, '옮기기로 새 사람을 만들고 보험이 들어감');
const shellPid = idOf('조유건(김아름 아들)');
D.run(`moveCustomerGroup('조유건(김아름 아들)', '', true)`);
D.promptQ.push('0'); D.promptQ.push('조유건'); D.confirmQ.push(true); D.confirmQ.push(true);
D.run(`movePolicyTo('${shellPid}', ${D.get(`COVERAGES['${shellPid}'].externalPolicies[0].id`)})`);
ok(!has('조유건(김아름 아들)') && D.get(`COVERAGES['${shellPid}'] === undefined`) && ext('조유건').length === 2, '보험을 다 옮기자 빈 사람이 지워지고 조유건 님에게 모임');

console.log('C) 직접 쓴 고객 정보가 있으면 자동으로 안 지우고, 🗑 로 지울 수 있음');
D.promptQ.push('0'); D.promptQ.push('임시사람'); D.confirmQ.push(true);
D.run(`movePolicyTo('${idOf('조유건')}', ${D.get(`COVERAGES['pid_j'].externalPolicies[0].id`)})`);
const tmp = idOf('임시사람');
D.run(`setProfile('임시사람', {phone:'01012345678'})`);                                           // 이 줄은 번호 꼴이 아니라서 가드에 안 걸림
D.promptQ.push('1'); D.confirmQ.push(true);
D.run(`movePolicyTo('${tmp}', ${D.get(`COVERAGES['${tmp}'].externalPolicies[0].id`)})`);
ok(has('임시사람') && D.get(`isShellPerson('${tmp}')`) === false, '정보가 입력된 사람은 보험이 0건이어도 자동 삭제 안 함');
D.run(`expandedCustomer='p:${tmp}'; renderGroups()`);
const ph0 = D.el('pane-그룹별').innerHTML;
ok(/renamePerson/.test(ph0) && /mergePerson/.test(ph0) && /deletePerson/.test(ph0), '펼친 칸에 ✏️ 이름 변경 · 🔀 합치기 · 🗑 삭제 버튼');
D.run(`deleteEmptyPerson('${idOf('조유건')}')`);
ok(has('조유건'), '보험·계약이 있는 사람은 지워지지 않음');
D.confirmQ.push(true); D.run(`deleteEmptyPerson('${tmp}')`);
ok(!has('임시사람') && D.get(`MEMOS['cust:임시사람'] === undefined`), '빈 사람을 지우면 입력해 둔 정보도 같이 정리');

console.log('D) 🔎 정리 패널에 빈 사람이 뜸');
D.run(`COVERAGES['pid_shell'] = {policies: [], person: {name: '빈사람', src: 'split'}}; renderGroups()`);
let h = D.el('pane-그룹별').innerHTML;
ok(/빈사람<\/b> <span class="rm-fine">\(보험·계약이 하나도 없는 빈 사람\)/.test(h) && /deleteEmptyPerson/.test(h), '정리 패널에 빈 사람 + 🗑 삭제 / 🔀 합치기');
D.confirmQ.push(true); D.run(`deleteEmptyPerson('pid_shell')`);
ok(!has('빈사람'), '패널에서 지우면 사라짐');

console.log('E) 가려진 이름 지정에서 새 사람 만들다 취소해도 아무것도 안 남고, 이미 있는 이름이면 그 사람에게');
D.ctx.__g = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 12, memberId: 12, name: '최본인', policies: [pol(31, '최본인'), pol(32, '조*인', false)] }] };
D.get('importBomappData(__g)');
const mk = idOf('조*인');
D.promptQ.push('0'); D.promptQ.push('조해인'); D.confirmQ.push(false); D.run(`assignMaskedPerson('${mk}')`);
ok(!has('조해인') && has('조*인'), '취소하면 조해인 이 안 만들어짐');
D.promptQ.push('0'); D.promptQ.push('조유건'); D.confirmQ.push(true); D.run(`assignMaskedPerson('${mk}')`);
ok(!has('조*인') && D.get(`peopleList().filter(p=>p.name==='조유건').length`) === 1 && ext('조유건').includes('보험32'), '이미 있는 조유건 이름이면 새로 안 만들고 그 사람에게 (그 사람 기록이 지워지지도 않음)');

console.log('F) 그룹별·고객별에서 이름 변경(이미 있는 이름이면 합치기 선택) · 삭제');
D.run(`expandedCustomer='p:${pb}'; renderGroups()`);
ok(/renamePerson/.test(D.el('pane-그룹별').innerHTML) && /deletePerson/.test(D.el('pane-그룹별').innerHTML) && /mergePerson/.test(D.el('pane-그룹별').innerHTML), '그룹별 탭에서 예비 고객을 펼치면 ✏️ 🔀 🗑 버튼');
D.ctx.__h = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 20, memberId: 20, name: '이름틀림', policies: [pol(41, '이름틀림')] }] };
D.get('importBomappData(__h)');
const wrong = idOf('이름틀림');
D.promptQ.push('조유건'); D.confirmQ.push(true);                       // 새 이름 입력 → 이미 있어요, 합치기
D.run(`renamePerson('${wrong}')`);
ok(!has('이름틀림') && D.get(`peopleList().filter(p=>p.name==='조유건').length`) === 1 && ext('조유건').includes('보험41'), '이미 있는 이름으로 바꾸면 그 사람과 합쳐짐 (둘로 안 나뉨)');
D.ctx.__h = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 21, memberId: 21, name: '이름틀림2', policies: [pol(42, '이름틀림2')] }] };
D.get('importBomappData(__h)');
const wrong2 = idOf('이름틀림2');
D.promptQ.push('새이름'); D.run(`renamePerson('${wrong2}')`);
ok(has('새이름') && !has('이름틀림2') && ext('새이름').includes('보험42'), '없는 이름이면 그냥 이름만 바뀜');
D.promptQ.push('조유건'); D.confirmQ.push(false); D.run(`renamePerson('${idOf('새이름')}')`);
ok(has('새이름') === false && D.get(`peopleList().filter(p=>p.name==='조유건').length`) === 2, '합치기 대신 "이름만 바꾸기"를 고르면 동명이인으로 따로 둠');
const d2 = D.get(`peopleList().filter(p=>p.name==='조유건').find(p=>p.pid!=='pid_j').pid`);
D.confirmQ.push(true); D.run(`deletePerson('${d2}')`);
ok(D.get(`peopleList().filter(p=>p.name==='조유건').length`) === 1 && D.get(`peopleList().some(p=>p.pid==='pid_j')`), '보험이 남은 예비 고객도 확인 후 삭제 (계약 있는 pid_j 는 그대로)');
D.run(`deletePerson('pid_j')`);
ok(D.get(`peopleList().some(p=>p.pid==='pid_j')`), '계약이 있는 고객은 여기서 못 지움');

console.log(`\n빈 사람 정리 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
