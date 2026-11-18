// 보맵 가져오기 안전: 동명이인이 합쳐지지 않음 · 고객 번호 없는 항목이 기존 보험을 지우지 않음 · 계약에 없는 피보험자는 새로 만들지 않음 (2026-11-15·11-18 점검)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: true,
  issueDate: '2020-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '수술비')] });
// 계약 리스트에 피보험자로 등록된 사람만 가져오기 대상 (사용자 요청 2026-11-18)
const withContracts = people => {
  const cs = [];
  people.forEach((name, i) => { for(let k = 0; k < (i === 0 ? 2 : 1); k++) cs.push({id: (i + 1) * 100 + k, s: '계약완료', d: '25.01.01', c: '계약자' + i + '_' + k, p: name, pid: 'pid_imp' + i + k, co: '우리', n: '계약' + i + '_' + k, pr: 1, g: ''}); });
  return JSON.stringify(cs);
};
const fresh = names => makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: withContracts(names || []), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
const people = D => D.get('Object.values(COVERAGES).map(v=>({mid:v.bomapp&&v.bomapp.memberId, pols:(v.externalPolicies||[]).map(x=>x.n).sort()}))');

console.log('A) 한 파일 안의 동명이인 두 명');
{ const D = fresh(['김민수', '김민수']); ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수'), pol(2, '김민수')] }, { memberId: 2, name: '김민수', policies: [pol(3, '김민수')] }] };
  const r = D.get('importBomappData(__f)');
  ok(r.newPeople === 0 && r.removed === 0, `새 가입자를 자동으로 만들지 않고 지운 보험도 없음 (새 사람 ${r.newPeople}, 지움 ${r.removed})`);
  ok(r.ambiguous.length === 2, '동명이인 두 명을 알림: ' + JSON.stringify(r.ambiguous));
  const p = people(D);
  const m1 = p.filter(x => x.mid === 1), m2 = p.filter(x => x.mid === 2);
  ok(m1.length === 1 && m1[0].pols.join() === '보험1,보험2' && m2.length === 1 && m2[0].pols.join() === '보험3', '1번 고객 보험 2건, 2번 고객 보험 1건 — 피보험자 계약이 있는 두 사람에게 따로');
}

console.log('B) 나중에 보맵에 같은 이름의 새 고객이 생겨도 기존 고객과 합쳐지지 않음');
{ const D = fresh(['김민수']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수')] }] };
  D.run('importBomappData(__f)');
  D.ctx.__g = { source: 'bomapp-planner', customers: [{ memberId: 1, name: '김민수', policies: [pol(1, '김민수')] }, { memberId: 7, name: '김민수', policies: [pol(9, '김민수')] }] };
  D.run('importBomappData(__g)');
  const p = people(D);
  ok(p.length === 2 && p.some(x => x.mid === 1 && x.pols.join() === '보험1') && p.some(x => x.mid === 7 && x.pols.join() === '보험9'), '기존 1번 고객 그대로, 새 7번 고객도 피보험자 계약이 있는 사람에게 따로');
}

console.log('C) 보맵 고객 번호 없이 빈 목록으로 온 고객은 건너뜀 (기존 보험 유지)');
{ const D = fresh(['홍']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 9, name: '홍', policies: [pol(1, '홍'), pol(2, '홍')] }] };
  D.run('importBomappData(__f)');
  D.ctx.__g = { source: 'bomapp-planner', customers: [{ plannerMemberId: 11, name: '홍', policies: [] }] };
  const r = D.get('importBomappData(__g)');
  ok(r.removed === 0 && r.warnings.some(w => /고객 번호가 없어 건너뛰었어요/.test(w)), '지운 보험 없음 + 건너뛰었다는 안내');
  const p = people(D);
  ok(p.length === 1 && p[0].mid === 9 && p[0].pols.length === 2, '보험 2건과 보맵 고객 번호(9)가 그대로');
}

console.log('D) 같은 사람을 다시 가져오면 그대로 갱신 (예전 동작 유지)');
{ const D = fresh(['이영희']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 3, name: '이영희', policies: [pol(1, '이영희')] }] };
  D.run('importBomappData(__f)');
  const r = D.get('importBomappData(__f)');
  ok(r.newPeople === 0 && r.updated === 1 && people(D).length === 1, '두 번째 가져오기는 새 사람 없이 갱신');
}

console.log('E) 계약 리스트에 피보험자가 없는 보맵 고객은 건너뜀 (사용자 요청 2026-11-18)');
{ const D = fresh(['다른사람']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 5, name: '김신규', policies: [pol(1, '김신규')] }] };
  const r = D.get('importBomappData(__f)');
  ok(r.people === 0 && Object.keys(D.get('COVERAGES')).length === 0 && (r.skippedPeople || 0) === 1, '새 가입자 없음 + 건너뜀 1건');
  ok(r.warnings.some(w => /김신규 — 계약 리스트에 피보험자가 없어/.test(w)), '건너뛴 이유 안내: ' + JSON.stringify(r.warnings)); }

console.log('F) 보맵 가족 보험의 피보험자도 계약에 등록된 사람만 (새 기록 자동 생성 차단)');
{ const D = fresh(['홍엄마', '홍딸']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 11, name: '홍엄마', policies: [Object.assign(pol(1, '홍엄마'), {isPrimaryInsuredMyself: true}), Object.assign(pol(2, '홍딸'), {isPrimaryInsuredMyself: false})] }] };
  const r = D.get('importBomappData(__f)');
  const p = people(D);
  ok(p.length === 2 && p.some(x => x.pols.join() === '보험1') && p.some(x => x.pols.join() === '보험2'), '본인 계약이 있는 홍엄마·홍딸에게 각각 보험');
  ok(r.family.join() === '홍딸', '피보험자 계약이 있는 가족(홍딸)에게 보맵 기록을 붙임: ' + JSON.stringify(r.family)); }
{ const D = fresh(['홍엄마']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 11, name: '홍엄마', policies: [pol(1, '홍엄마'), Object.assign(pol(2, '홍아들'), {isPrimaryInsuredMyself: false})] }] };
  const r = D.get('importBomappData(__f)');
  const p = people(D);
  ok(p.length === 1 && p[0].pols.join() === '보험1' && p[0].mid === 11, '계약에 없는 가족(홍아들) 보험은 넣지 않음 — 본인 보험만');
  ok((r.skippedPeople || 0) === 1 && r.warnings.some(w => /홍아들/.test(w)), '건너뛴 가족 보험 안내: ' + JSON.stringify(r.warnings)); }

console.log('G) 필터링 후 보험 개요·매트릭스·담보 내역은 피보험자 본인 것만 (사용자 요청 2026-11-18)');
{ const D = fresh(['홍엄마']);
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 11, name: '홍엄마', policies: [pol(1, '홍엄마'),
    Object.assign(pol(2, '홍딸'), {isPrimaryInsuredMyself: false}), Object.assign(pol(3, '홍아들'), {isPrimaryInsuredMyself: false})] }] };
  D.get('importBomappData(__f)');
  D.run(`window._mtxMode='sum'; selectedCovCustomer=peopleList()[0].pid; renderCoverageTab('보장분석')`);
  const cd = D.el('cov-detail').innerHTML;
  ok(/보험1/.test(cd) && !/보험2/.test(cd) && !/보험3/.test(cd), '보험 개요에 본인 보험(보험1)만 — 딸·아들 보험 제외');
  ok(!/2,000만원/.test(cd) && !/3,000만원/.test(cd), '보장 합산 매트릭스에 딸(2천만)·아들(3천만) 담보 없음');
  ok(/1천만원/.test(cd), '본인 담보(1천만원)는 보임'); }

console.log(`\n가져오기 안전 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
