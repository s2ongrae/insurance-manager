// 가족: 보맵 사람 이름 변경 · 보맵 가족 보험을 피보험자별로 · 다시 가져와도 옮겨 둔 곳 유지 · 보맵 보험 분리 · 목록 가족 묶기·검색 (가짜 데이터만)
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

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 보맵 가족 보험은 피보험자별로 따로 보장분석');
D.ctx.__f = file([pol(1, '홍엄마'), pol(2, '홍딸'), pol(3, '태아')]);
const r1 = D.get('importBomappData(__f)');
ok(r1.newPeople === 3 && JSON.stringify(r1.family) === JSON.stringify(['홍딸', '태아']), '고객 1명 + 가족 2명(홍딸·태아)이 따로: ' + JSON.stringify(r1.family));
const mom = pidOf(D, '홍엄마'), girl = pidOf(D, '홍딸'), baby = pidOf(D, '태아');
ok(mom && girl && baby && new Set([mom, girl, baby]).size === 3, '세 사람 모두 따로 있음');
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
D.get('importBomappData(__f2)');
const dad = pidOf(D, '김아빠');
D.promptQ.push('2', '김막내');
D.run(`splitPerson('${dad}')`);
const kid = pidOf(D, '김막내');
ok(kid && JSON.stringify(polNames(D, kid)) === '["튼튼보험22"]' && JSON.stringify(polNames(D, dad)) === '["튼튼보험21"]', '2번 보맵 보험이 김막내로 옮겨짐');
ok(D.get(`familyNameOf(peopleList().find(p=>p.pid==='${kid}'))==='김아빠'`), '분리한 사람은 원래 사람 가족으로 묶임');
D.get('importBomappData(__f2)');
ok(JSON.stringify(polNames(D, dad)) === '["튼튼보험21"]' && JSON.stringify(polNames(D, kid)) === '["튼튼보험22"]', '다시 가져와도 김막내 보험이 아빠 쪽에 다시 안 생김');

console.log('D2) 예전에 고객 본인 쪽에 같이 들어가 있던 가족 보험은 다시 가져올 때 가족 쪽으로 옮김');
{ const X = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_monthly: '[]', ins_groups: '{}',
    ins_coverages: JSON.stringify({ pid_oldmom1: { policies: [], person: { name: '홍엄마', src: 'bomapp' }, bomapp: { memberId: 901 },
      externalPolicies: [{ id: -1, co: '가나화재', n: '튼튼보험1', pr: 1, items: [], bm: { id: 1 } }, { id: -2, co: '가나화재', n: '튼튼보험2', pr: 1, items: [], termsUrl: 'https://t.example.test/a.pdf', bm: { id: 2 } }] } }) } });
  X.ctx.__f = file([pol(1, '홍엄마'), pol(2, '홍딸')]);
  const r = X.get('importBomappData(__f)');
  const g2 = pidOf(X, '홍딸');
  ok(g2 && JSON.stringify(polNames(X, g2)) === '["튼튼보험2"]' && JSON.stringify(polNames(X, 'pid_oldmom1')) === '["튼튼보험1"]', '홍딸 보험이 엄마 쪽에서 홍딸로 옮겨짐 (중복 없음)');
  ok(X.get(`(COVERAGES['${g2}'].externalPolicies[0].termsUrl||'').startsWith('https://t.example.test/')`), '옮겨도 직접 넣어 둔 약관 링크 유지');
  ok(r.moved === 1, '옮긴 건수 1'); }

console.log('E) 보장분석 목록: 가족 묶음 · 검색 · 가족으로 묶기');
let list = D.get('covPeopleListHtml()');
ok(/👪 홍엄마 가족 <span class="cov-cust-cnt">3명/.test(list) && /👪 김아빠 가족 <span class="cov-cust-cnt">2명/.test(list), '가족 묶음 머리줄 (홍엄마 3명, 김아빠 2명)');
const momGroup = list.slice(list.indexOf('홍엄마 가족'), list.indexOf('</details>', list.indexOf('홍엄마 가족')));
ok(momGroup.indexOf('>홍엄마<') < momGroup.indexOf('>홍딸<') && /홍아기/.test(momGroup), '묶음 안: 대표(홍엄마)가 맨 위, 가족이 아래');
D.run(`window._covSearch='홍아'`); list = D.get('covPeopleListHtml()');
ok(/홍아기/.test(list) && !/김아빠/.test(list), '이름 검색');
D.run(`window._covSearch='튼튼보험22'`); list = D.get('covPeopleListHtml()');
ok(/김막내/.test(list) && !/홍엄마/.test(list.replace(/👪[^<]*/g, '')), '보험 상품명으로도 검색');
D.run(`window._covSearch='없는이름'`);
ok(/검색 결과가 없어요/.test(D.get('covPeopleListHtml()')), '결과 없음 안내');
D.run(`window._covSearch=''`);
const E = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([{ id: 1, pid: 'pid_aaaa1', c: '이부모', p: '이부모', co: 'A', n: 'a', s: '계약완료', d: '25.01.01', pr: 1, g: 'x' }, { id: 2, pid: 'pid_bbbb2', c: '다른계약자', p: '이자녀', co: 'B', n: 'b', s: '계약완료', d: '25.01.01', pr: 1, g: 'x' }]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}' } });
ok(!/👪/.test(E.get('covPeopleListHtml()')), '처음엔 따로');
E.promptQ.push('1');
E.run(`setFamily('pid_bbbb2')`);
ok(/👪 이부모 가족/.test(E.get('covPeopleListHtml()')) && E.get(`COVERAGES['pid_bbbb2'].person.familyPid==='pid_aaaa1'`), '👪 가족으로 묶기: 이자녀 → 이부모 가족');
E.promptQ.push('0');
E.run(`setFamily('pid_bbbb2')`);
ok(!/👪 이부모 가족/.test(E.get('covPeopleListHtml()')), '0 을 넣으면 묶음 풂');

console.log(`\n가족 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
