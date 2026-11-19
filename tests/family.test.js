// 가족: 보맵 사람 이름 변경 · 보맵 가족 보험을 피보험자별로 · 다시 가져와도 옮겨 둔 곳 유지 · 보맵 보험 분리 · 목록 그룹 묶음·검색 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name, amt) => ({ contractId: id, name, joinAmount: amt, maturityDate: '2045-10-29', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, insured, x = {}) => Object.assign({ insuranceId: id, insurerName: '가나화재해상보험', productName: '튼튼보험' + id, insuranceStatus: '정상', insuranceType: '질병(건강)보험',
  subscriberName: '홍엄마', primaryInsuredName: insured, isPrimaryInsuredMyself: insured === '홍엄마', issueDate: '2024-01-01', maturityDate: '2045-10-29', isRenewal: false,
  monthlyPaymentAmount: 30000 + id, paymentCycle: '매월', totalPaymentCount: 240, paidPaymentCount: 10, riders: [rider(id * 10, '암진단비', 10000000 * id)] }, x);
const file = pols => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-12T07:00:00.000Z', customers: [{ plannerMemberId: 11, memberId: 901, name: '홍엄마', birthDate: '1990.01.02', gender: 'F', policies: pols }] });
const ppl = D => D.get('peopleList().map(p=>({pid:p.pid,name:p.name,n:covPolicyCount(p.pid)}))');
const pidOf = (D, n) => (ppl(D).find(p => p.name === n) || {}).pid;
const polNames = (D, pid) => D.get(`[...(COVERAGES['${pid}'].externalPolicies||[]),...(COVERAGES['${pid}'].otherPolicies||[])].map(x=>x.n||x.name)`);
// 보맵 가져오기는 계약 리스트에 피보험자로 등록된 사람만 대상 (사용자 요청 2026-11-18) — 테스트용 피보험자 계약
const grpContracts = (people) => JSON.stringify(people.map((x, i) => ({ id: 500 + i, s: '계약완료', d: '25.01.01', c: x.p, p: x.p, pid: x.pid, co: '우리', n: '계약' + i, pr: 1, g: '' })));

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: grpContracts([{ pid: 'pid_fam1', p: '홍엄마' }, { pid: 'pid_fam2', p: '홍딸' }, { pid: 'pid_fam3', p: '태아' }]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 보맵 가족 보험은 피보험자별로 따로 보장분석');
D.ctx.__f = file([pol(1, '홍엄마'), pol(2, '홍딸'), pol(3, '태아')]);
const r1 = D.get('importBomappData(__f)');
ok(r1.newPeople === 0 && JSON.stringify(r1.family) === JSON.stringify(['홍딸', '태아']), '피보험자 계약이 있는 사람 3명(홍엄마·홍딸·태아)이 따로, 새 가입자 자동 생성 없음: ' + JSON.stringify(r1.family));
const mom = pidOf(D, '홍엄마'), girl = pidOf(D, '홍딸'), baby = pidOf(D, '태아');
ok(mom === 'pid_fam1' && girl === 'pid_fam2' && baby === 'pid_fam3', '세 사람 모두 계약의 pid로 연결됨');
ok(JSON.stringify(polNames(D, mom)) === '["튼튼보험1"]' && JSON.stringify(polNames(D, girl)) === '["튼튼보험2"]' && JSON.stringify(polNames(D, baby)) === '["튼튼보험3"]', '각자 자기 보험만');
ok(D.get(`familyNameOf(peopleList().find(p=>p.pid==='${girl}'))==='홍엄마' && familyNameOf(peopleList().find(p=>p.pid==='${baby}'))==='홍엄마'`), '가족은 홍엄마 가족으로 묶임');

console.log('B) 보맵에서 가져온 사람 이름 바꾸기 (예전엔 안 바뀜)');
D.promptQ.push('홍아기');
D.run(`renamePerson('${baby}')`);
ok(D.get(`personName('${baby}')==='홍아기'`), '태아 → 홍아기 로 바뀜');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${baby}'].person.name==='홍아기'`), '저장·동기화 대상에 반영');

console.log('C) 다시 가져와도: 이름 바꾼 사람·옮겨 둔 보험 그대로, 중복 없음');
const r2 = D.get('importBomappData(__f)');
ok(r2.newPeople === 0 && r2.added === 0, '새 사람·새 보험 안 생김 (added ' + r2.added + ', newPeople ' + r2.newPeople + ')');
ok(D.get(`personName('${baby}')==='홍아기'`) && JSON.stringify(polNames(D, baby)) === '["튼튼보험3"]', '홍아기 이름과 보험 유지');
ok(JSON.stringify(polNames(D, mom)) === '["튼튼보험1"]', '엄마 쪽에 가족 보험이 다시 생기지 않음');

console.log('D) 보맵·외부 보험도 ✂️ 분리 가능 (예전엔 내 계약만)');
D.ctx.__f2 = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-12T08:00:00.000Z', customers: [{ plannerMemberId: 12, memberId: 902, name: '김아빠', policies: [pol(21, '김아빠', { subscriberName: '김아빠', isPrimaryInsuredMyself: true, primaryInsuredName: '김아빠' }), pol(22, '김아빠', { subscriberName: '김아빠', isPrimaryInsuredMyself: true, primaryInsuredName: '김아빠' })] }] };
D.run(`CONTRACTS=CONTRACTS.concat([{id:600,s:'계약완료',d:'25.01.01',c:'김아빠',p:'김아빠',pid:'pid_fam4',co:'우리',n:'계약4',pr:1,g:''}])`);
D.get('importBomappData(__f2)');
const dad = pidOf(D, '김아빠');
D.promptQ.push('3', '김막내');   // 목록: 1=내 계약(계약4), 2=튼튼보험21, 3=튼튼보험22
D.run(`splitPerson('${dad}')`);
const kid = pidOf(D, '김막내');
ok(kid && JSON.stringify(polNames(D, kid)) === '["튼튼보험22"]' && JSON.stringify(polNames(D, dad)) === '["튼튼보험21"]', '2번 보맵 보험이 김막내로 옮겨짐');
ok(D.get(`familyNameOf(peopleList().find(p=>p.pid==='${kid}'))==='김아빠'`), '분리한 사람은 원래 사람 가족으로 묶임');
D.get('importBomappData(__f2)');
ok(JSON.stringify(polNames(D, dad)) === '["튼튼보험21"]' && JSON.stringify(polNames(D, kid)) === '["튼튼보험22"]', '다시 가져와도 김막내 보험이 아빠 쪽에 다시 안 생김');

console.log('D2) 예전에 고객 본인 쪽에 같이 들어가 있던 가족 보험은 다시 가져올 때 가족 쪽으로 옮김');
{ const X = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: grpContracts([{ pid: 'pid_oldmom1', p: '홍엄마' }, { pid: 'pid_oldgirl1', p: '홍딸' }]), ins_monthly: '[]', ins_groups: '{}',
    ins_coverages: JSON.stringify({ pid_oldmom1: { policies: [], person: { name: '홍엄마', src: 'bomapp' }, bomapp: { memberId: 901 },
      externalPolicies: [{ id: -1, co: '가나화재', n: '튼튼보험1', pr: 1, items: [], bm: { id: 1 } }, { id: -2, co: '가나화재', n: '튼튼보험2', pr: 1, items: [], termsUrl: 'https://t.example.test/a.pdf', bm: { id: 2 } }] } }) } });
  X.ctx.__f = file([pol(1, '홍엄마'), pol(2, '홍딸')]);
  const r = X.get('importBomappData(__f)');
  const g2 = pidOf(X, '홍딸');
  ok(g2 && JSON.stringify(polNames(X, g2)) === '["튼튼보험2"]' && JSON.stringify(polNames(X, 'pid_oldmom1')) === '["튼튼보험1"]', '홍딸 보험이 엄마 쪽에서 홍딸로 옮겨짐 (중복 없음)');
  ok(X.get(`(COVERAGES['${g2}'].externalPolicies[0].termsUrl||'').startsWith('https://t.example.test/')`), '옮겨도 직접 넣어 둔 약관 링크 유지');
  ok(r.moved === 1, '옮긴 건수 1'); }

console.log('E) 보장분석 목록: 그룹별 탭 기준 묶음 · 검색 (사용자 요청 2026-11-18: 그룹 데이터 일원화)');
// 보맵 사람은 계약이 없어서 그룹이 없음 → 계약을 넣어 그룹(g)을 지정해 검증
const mkGrp = (id, pid, p, g, pr) => ({ id, pid, c: p, p, co: '보험' + id, n: '상품' + id, s: '계약완료', d: '25.01.01', pr, g });
D.ctx.__gc = [mkGrp(11, mom, '홍엄마', '홍가족', 50000), mkGrp(12, girl, '홍딸', '홍가족', 30000), mkGrp(13, dad, '김아빠', '', 10000)];
D.run(`CONTRACTS=__gc`);
let list = D.get('covPeopleListHtml()');
ok(/data-fam="홍가족"/.test(list) && /2명/.test(list), '그룹별 탭과 같은 묶음 머리줄 (홍가족 2명)');
const momGroup = list.slice(list.indexOf('data-fam="홍가족"'), list.indexOf('</details>', list.indexOf('data-fam="홍가족"')));
ok(momGroup.includes('>홍엄마<') && momGroup.includes('>홍딸<') && !/김아빠/.test(momGroup), '묶음 안: 그룹 지정된 사람만, 김아빠(그룹 없음)는 밖에');
ok(/김아빠/.test(list.replace(/<details[\s\S]*?<\/details>/g, '')), '그룹 없는 계약만 있는 사람은 개별 항목');
ok(/80,000원\/월/.test(list), '그룹 머리줄에 월보험료 합계 (그룹별 탭과 같은 숫자)');
D.run(`window._covSearch='홍아'`); list = D.get('covPeopleListHtml()');
ok(/홍아기/.test(list) && !/김아빠/.test(list), '이름 검색');
D.run(`window._covSearch='상품11'`); list = D.get('covPeopleListHtml()');
ok(/홍엄마/.test(list) && !/홍딸/.test(list.replace(/<summary[\s\S]*?<\/summary>/g, '')), '보험 상품명으로도 검색');
D.run(`window._covSearch='홍가족'`); list = D.get('covPeopleListHtml()');
ok(/홍엄마/.test(list) && /홍딸/.test(list), '그룹 이름으로도 검색');
D.run(`window._covSearch='없는이름'`);
ok(/검색 결과가 없어요/.test(D.get('covPeopleListHtml()')), '결과 없음 안내');
D.run(`window._covSearch=''`);

console.log(`\n가족 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
