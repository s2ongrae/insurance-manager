// 보맵 가져오기 안전: 동명이인이 합쳐지지 않음 · 고객 번호 없는 항목이 기존 보험을 지우지 않음 (2026-11-15 점검)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: true,
  issueDate: '2020-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '수술비')] });
const fresh = () => makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
const people = D => D.get('Object.values(COVERAGES).map(v=>({mid:v.bomapp&&v.bomapp.memberId, pols:(v.externalPolicies||[]).map(x=>x.n).sort()}))');

console.log('A) 한 파일 안의 동명이인 두 명');
{ const D = fresh(); ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수'), pol(2, '김민수')] }, { memberId: 2, name: '김민수', policies: [pol(3, '김민수')] }] };
  const r = D.get('importBomappData(__f)');
  ok(r.newPeople === 2 && r.removed === 0, `두 사람으로 따로 들어가고 지운 보험 없음 (새 사람 ${r.newPeople}, 지움 ${r.removed})`);
  const p = people(D);
  ok(p.some(x => x.mid === 1 && x.pols.join() === '보험1,보험2') && p.some(x => x.mid === 2 && x.pols.join() === '보험3'), '1번 고객 보험 2건, 2번 고객 보험 1건 그대로');
}

console.log('B) 나중에 보맵에 같은 이름의 새 고객이 생겨도 기존 고객과 합쳐지지 않음');
{ const D = fresh();
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수')] }] };
  D.run('importBomappData(__f)');
  D.ctx.__g = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수')] }, { memberId: 7, name: '김민수', policies: [pol(9, '김민수')] }] };
  D.run('importBomappData(__g)');
  const p = people(D);
  ok(p.length === 2 && p.some(x => x.mid === 1 && x.pols.join() === '보험1') && p.some(x => x.mid === 7 && x.pols.join() === '보험9'), '기존 1번 고객 그대로, 새 7번 고객은 따로');
}

console.log('C) 보맵 고객 번호 없이 빈 목록으로 온 고객은 건너뜀 (기존 보험 유지)');
{ const D = fresh();
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 9, name: '홍', policies: [pol(1, '홍'), pol(2, '홍')] }] };
  D.run('importBomappData(__f)');
  D.ctx.__g = { source: 'bomapp-planner', customers: [{ plannerMemberId: 11, name: '홍', policies: [] }] };
  const r = D.get('importBomappData(__g)');
  ok(r.removed === 0 && r.warnings.some(w => /고객 번호가 없어 건너뛰었어요/.test(w)), '지운 보험 없음 + 건너뛰었다는 안내');
  const p = people(D);
  ok(p.length === 1 && p[0].mid === 9 && p[0].pols.length === 2, '보험 2건과 보맵 고객 번호(9)가 그대로');
}

console.log('D) 같은 사람을 다시 가져오면 그대로 갱신 (예전 동작 유지)');
{ const D = fresh();
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 3, name: '이영희', policies: [pol(1, '이영희')] }] };
  D.run('importBomappData(__f)');
  const r = D.get('importBomappData(__f)');
  ok(r.newPeople === 0 && r.updated === 1 && people(D).length === 1, '두 번째 가져오기는 새 사람 없이 갱신');
}

console.log(`\n가져오기 안전 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
