// 🔢 증권번호 가져오기 (일회용, 사용자 요청 2026-11-19): 가짜 데이터만
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const C = (id, name, co, n, d, pr, pn) => ({ id, pid: 'pid_' + name, c: name, p: name, co, n, s: '계약완료', d, pr, g: '', pn });

const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([
    C(1, '김가입', '가나화재', '건강보험A', '24.07.05', 27370),
    C(2, '김가입', '다라생명', '치아보험B', '24.07.05', 30000),            // 같은 날 두 계약 → 보험료/상품명으로 구분
    C(3, '이둘째', '가나화재', '운전자보험', '24.08.01', 12000, 'OLD-1'),   // 이미 번호 있음
    C(4, '박셋째', '라마화재', '실손보험', '24.09.09', 15000),
    C(5, '최넷째', '라마화재', '종합보험', '24.10.10', 40000),
    C(6, '최넷째', '라마화재', '종합보험', '24.10.10', 40000),              // 완전 같은 두 계약 → 하나로 못 정함
  ]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

const list = [
  { holder: '김가입', co: '가나화재', prod: '건강보험A', sd: '2024-07-05', prem: '27370', pn: 'PN-AAA-1' },
  { holder: '김가입', co: '다라생명', prod: '치아보험B', sd: '2024-07-05', prem: '30000', pn: 'PN-BBB-2' },
  { holder: '이둘째', co: '가나화재', prod: '운전자보험', sd: '2024-08-01', prem: '12000', pn: 'NEW-9' },
  { holder: '', co: '', prod: '실손보험', sd: '2024-09-09', prem: '15000', pn: 'PN-CCC-3' },       // 계약자 없음 → 날짜+보험료로
  { holder: '최넷째', co: '라마화재', prod: '종합보험', sd: '2024-10-10', prem: '40000', pn: 'PN-DDD-4' },
  { holder: '없는사람', co: '가나화재', prod: '무엇', sd: '2024-01-01', prem: '1', pn: 'PN-EEE-5' },
  { holder: '김가입', pn: '', sd: '2024-07-05' }, null,
];
D.ctx.__l = list;
const r = D.get('importPolicyNumbers(__l)');
ok(r.set === 3 && r.kept === 1 && r.ambiguous === 1 && r.unmatched === 1 && r.total === 6, `결과: 채움 ${r.set}·건너뜀 ${r.kept}·모호 ${r.ambiguous}·없음 ${r.unmatched}·전체 ${r.total}`);
const pn = id => D.get(`CONTRACTS.find(c=>c.id===${id}).pn || ''`);
ok(pn(1) === 'PN-AAA-1' && pn(2) === 'PN-BBB-2', '같은 날 두 계약도 보험료·상품명으로 구분해서 각각 채움');
ok(pn(3) === 'OLD-1', '이미 있는 증권번호는 안 덮어씀');
ok(pn(4) === 'PN-CCC-3', '계약자 없는 기록도 날짜+보험료가 하나로 좁혀지면 채움');
ok(pn(5) === '' && pn(6) === '', '똑같은 계약이 둘이면 잘못 넣지 않고 건너뜀');
ok(D.get(`JSON.parse(localStorage.getItem('ins_contracts')).find(c=>c.id===1).pn`) === 'PN-AAA-1', '이 기기 저장소(동기화 대상)에 기록됨');

D.ctx.__l = list; const r2 = D.get('importPolicyNumbers(__l)');
ok(r2.set === 0 && r2.same === 3, '다시 가져와도 그대로 (이미 같은 번호 3건)');

console.log(`\n증권번호 가져오기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
