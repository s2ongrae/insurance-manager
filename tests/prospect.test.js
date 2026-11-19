// 🌱 예비 고객 (사용자 요청 2026-11-19): 계약 리스트에 없어도 보맵에서 가져오고, 보장분석 목록·고객별 탭에서 가입자/예비 고객을 구분,
// 나중에 계약을 등록하면 같은 사람으로 이어진다 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const count = (h, w) => h.split(w).length - 1;
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who, self = true) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: self,
  issueDate: '2024-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const file = customers => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers });
const C = (id, pid, name, g) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_member1', '김가입', '지인'), C(2, 'pid_member2', '이무그룹', '')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{"지인":"#3B82F6"}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 계약 리스트에 없는 보맵 고객·가족도 가져와서 예비 고객으로');
D.ctx.__f = file([{ plannerMemberId: 7, memberId: 7, name: '박예비', policies: [pol(1, '박예비')] },
  { plannerMemberId: 8, memberId: 8, name: '최가족', policies: [pol(2, '최가족'), pol(3, '최아들', false)] }]);
const r = D.get('importBomappData(__f)');
ok(r.people === 2 && r.newPeople === 3 && r.skippedPeople === undefined, '고객 2명 + 가족 1명 = 새 사람 3명, 건너뜀 없음 (새 사람 ' + r.newPeople + ')');
ok(JSON.stringify([...r.prospects].sort()) === JSON.stringify(['박예비', '최가족', '최아들'].sort()) && r.warnings.length === 0, '예비 고객으로 알림: ' + r.prospects.join(', '));
ok(D.get(`peopleList().filter(isProspectPerson).length`) === 3 && D.get(`CONTRACTS.length`) === 2, '예비 고객 3명, 계약 리스트는 그대로 2건 (계약은 안 만듦)');
ok(D.get(`(()=>{const k=peopleList().find(p=>p.name==='최아들');return rootFamilyPid(k.pid)===peopleList().find(p=>p.name==='최가족').pid;})()`), '최아들은 최가족 가족으로 묶임');
const again = D.get('importBomappData(__f)');
ok(again.newPeople === 0 && again.prospects.length === 0 && D.get(`peopleList().length`) === 5, '다시 가져와도 예비 고객이 또 생기지 않음');

console.log('B) 보장분석 목록: 🌱 예비 고객 묶음(맨 아래) · 예비 배지 · 검색');
let list = D.get('covPeopleListHtml()');
ok(/🌱 예비 고객<\/span> <span class="cov-cust-cnt">3명 · 계약 전/.test(list), '"🌱 예비 고객 3명 · 계약 전" 묶음');
ok(list.indexOf('지인') > -1 && list.indexOf('지인') < list.indexOf('🌱 예비 고객') && list.indexOf('이무그룹') < list.indexOf('🌱 예비 고객'), '일반 그룹 → 그룹 없음 → 예비 고객 순서 (예비 고객이 맨 아래)');
ok(count(list, 'class="cov-prospect">예비') === 3, '예비 배지는 예비 고객 3명에게만');
D.run(`window._covSearch='박예'`); list = D.get('covPeopleListHtml()');
ok(/박예비/.test(list) && !/김가입/.test(list) && !/최가족/.test(list), '예비 고객도 이름으로 검색됨');
D.run(`window._covSearch='보험1'`); list = D.get('covPeopleListHtml()');
ok(/박예비/.test(list), '보맵 보험 이름으로도 검색됨');
D.run(`window._covSearch=''`);
const pros = D.get(`peopleList().find(p=>p.name==='박예비').pid`), mem = 'pid_member1';
D.run(`selectedCovCustomer='${pros}'; renderCovDetail('${pros}')`);
ok(/🌱 예비 고객 · 계약 전/.test(D.el('cov-detail').innerHTML), '상세 머리에 "🌱 예비 고객 · 계약 전"');
D.run(`selectedCovCustomer='${mem}'; renderCovDetail('${mem}')`);
ok(!/예비 고객 · 계약 전/.test(D.el('cov-detail').innerHTML), '가입자 상세에는 안 나옴');

console.log('C) 고객별 탭: 구분 열(가입자 / 예비 고객) · 필터 · 눌러서 보장분석');
D.run('renderGroups()');
let h = D.el('pane-그룹별').innerHTML;
ok(/<th>구분<\/th>/.test(h) && count(h, 'kind-badge kind-member') === 2 && count(h, 'kind-badge kind-prospect') === 3, '구분 열: 가입자 2 · 예비 고객 3');
ok(/전체 <b>5<\/b>/.test(h) && /가입자 <b>2<\/b>/.test(h) && /예비 고객 <b>3<\/b>/.test(h), '필터 버튼 건수: 전체 5 · 가입자 2 · 예비 고객 3');
ok(/박예비/.test(h) && /보험 1건/.test(h) && /보험1/.test(h), '예비 고객 행: 이름 · 보험 건수 · 보험 이름');
D.run(`setCustKind('prospect')`); h = D.el('pane-그룹별').innerHTML;
ok(count(h, 'kind-badge kind-member') === 0 && count(h, 'kind-badge kind-prospect') === 3 && !/김가입/.test(h), '예비 고객만 보기');
D.run(`setCustKind('member')`); h = D.el('pane-그룹별').innerHTML;
ok(count(h, 'kind-badge kind-member') === 2 && count(h, 'kind-badge kind-prospect') === 0 && /김가입/.test(h), '가입자만 보기');
D.run(`setCustKind('all')`);
D.run(`openCovCustomer('${pros}')`);
ok(D.get(`selectedCovCustomer`) === pros && D.get(`window._covSubTab`) === '보장분석', '예비 고객 행을 누르면 그 사람의 보장분석으로');
D.run(`expandedCustomer='pid_member1'; renderGroups()`); h = D.el('pane-그룹별').innerHTML;
ok(/colspan="8"/.test(h), '가입자 상세 행도 열 수에 맞음 (colspan 8)');
D.run(`expandedCustomer=null`);
D.run(`toggleProspectDetail('${pros}')`); h = D.el('pane-그룹별').innerHTML;
ok(/📋 박예비님이 가진 보험 \(1건\)/.test(h) && /가나화재/.test(h) && /보험1/.test(h) && /월 합계 보험료/.test(h) && /1,000원/.test(h), '예비 고객을 펼치면 가져온 보험 목록(보험사·보험명·월보험료·합계)이 표로 나옴');
D.run(`expandedCustomer='p:' + peopleList().find(p=>p.name==='최가족').pid; renderGroups()`); h = D.el('pane-그룹별').innerHTML;
ok(/최가족님이 가진 보험 \(1건\)/.test(h) && /최아들/.test(D.get(`peopleList().find(p=>p.name==='최아들').label`)), '다른 예비 고객도 자기 보험만 (가족 보험은 그 가족 쪽)');
D.run(`expandedCustomer=null; renderGroups()`);

console.log('D) 나중에 계약을 등록하면 같은 사람으로 이어짐 (가입자가 됨)');
const e = D.el;
e('edit-id').value = ''; e('f-status').value = '계약완료'; e('f-end-date').value = ''; e('f-date').value = '26.11.19'; e('f-holder').value = '박예비'; e('f-insured').value = '박예비';
e('f-co').value = '삼성화재'; e('f-name').value = '새계약'; e('f-price').value = '30000'; e('f-group').value = '지인'; e('contract-memo').value = ''; e('f-pn').value = '';
D.confirmQ.push(true);                                  // "이미 박예비 님이 있어요 — 같은 사람이면 [확인]"
const c0 = D.confirms.length;
D.run('saveContract()');
const asked = D.confirms.slice(c0).join('\n');
ok(/예비 고객/.test(asked) && /같은 사람이면/.test(asked), '같은 이름 확인 창에 "🌱 예비 고객 · 계약 전"으로 설명: ' + asked.split('\n')[0]);
ok(D.get(`CONTRACTS.length`) === 3 && D.get(`CONTRACTS.find(c=>c.n==='새계약').pid`) === pros, '새 계약이 예비 고객과 같은 사람(pid)으로 등록됨');
ok(D.get(`peopleList().length`) === 5 && D.get(`peopleList().filter(isProspectPerson).length`) === 2 && !D.get(`isProspectPerson(peopleList().find(p=>p.pid==='${pros}'))`), '사람 수는 그대로 5명, 박예비는 가입자로 바뀌고 예비 고객은 2명');
ok(D.get(`(COVERAGES['${pros}'].externalPolicies||[]).length`) === 1, '가져왔던 보맵 보험(보장분석)은 그대로 유지');
list = D.get('covPeopleListHtml()');
ok(count(list, 'class="cov-prospect">예비') === 2 && /🌱 예비 고객<\/span> <span class="cov-cust-cnt">2명 · 계약 전/.test(list), '목록에서 박예비의 예비 배지가 사라짐');
D.run('renderGroups()');
ok(count(D.el('pane-그룹별').innerHTML, 'kind-badge kind-member') === 3 && count(D.el('pane-그룹별').innerHTML, 'kind-badge kind-prospect') === 2, '고객별 탭도 가입자 3 · 예비 고객 2');

console.log('E) 상태 점검에 예비 고객 수');
const rows = await D.run('healthCheckData()');
const row = rows.find(x => x.label === '보장분석 고객') || {};
ok(/예비 고객 2명 포함/.test(row.detail || ''), '상태 점검: ' + row.detail);

console.log(`\n예비 고객 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
