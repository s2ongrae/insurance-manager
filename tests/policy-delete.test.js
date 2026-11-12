// 보험 삭제: 외부·기존 보험 · 내 계약 완전 삭제 · 보맵 보험(완전 삭제/이번만/중복 정리) · 중복 의심 표시 · 체크포인트 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_deltest';
const rider = (id, name, amt) => ({ contractId: id, name, joinAmount: amt, maturityDate: '2045-10-29', contractStatus: '정상', isMyContract: true });
const bpol = id => ({ insuranceId: id, insurerName: '가나화재해상보험', productName: '보맵보험' + id, insuranceStatus: '정상', subscriberName: '가', primaryInsuredName: '가', isPrimaryInsuredMyself: true,
  issueDate: '2024-01-01', maturityDate: '2045-10-29', monthlyPaymentAmount: 10000 + id, paymentCycle: '매월', totalPaymentCount: 240, paidPaymentCount: 1, riders: [rider(id, '암진단비', 10000000)] });
const bfile = ids => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-12T07:00:00.000Z', customers: [{ plannerMemberId: 1, memberId: 555, name: '가', policies: ids.map(bpol) }] });
const dev = () => makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '다라생명', n: '내계약', s: '계약완료', d: '25.01.01', pr: 50000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: { policies: [{ id: 1, items: [{ name: '일반사망', amount: 5000, unit: '만원' }] }],
    externalPolicies: [{ id: -1, co: '마바손보', n: '외부보험', pr: 1, items: [{ name: '암진단비', amount: 1000, unit: '만원' }] }, { id: -2, co: '마바손보', n: '외부보험', pr: 1, items: [{ name: '암진단비', amount: 1000, unit: '만원' }] }],
    otherPolicies: [{ id: 'ext_a', co: '사아생명', name: '기존보험', price: 1, items: [] }] } }), ins_monthly: '[]', ins_groups: '{}' } });
const names = D => D.get(`[...(COVERAGES['${P}'].externalPolicies||[]),...(COVERAGES['${P}'].otherPolicies||[])].map(x=>x.n||x.name)`);

(async () => {
const D = dev();
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 카드: 삭제 버튼 · 중복 의심 표시');
D.run(`renderCovDetail('${P}')`);
let h = D.el('cov-detail').innerHTML;
ok(/deletePolicy\('pid_deltest',-1\)/.test(h) && /deletePolicy\('pid_deltest','ext_a'\)/.test(h) && /deletePolicy\('pid_deltest',1\)/.test(h), '외부·기존·내 계약 카드 모두 삭제 버튼');
ok(/🗑 계약까지 완전 삭제/.test(h) && /🗑 이 보험 삭제/.test(h), '내 계약은 "계약까지 완전 삭제", 나머지는 "이 보험 삭제"');
ok((h.match(/⚠️ 중복 의심 2건/g) || []).length === 2, '같은 보험사+상품명 2건에 중복 의심 표시');

console.log('B) 취소하면 아무것도 안 지움');
D.confirmQ.push(false);
D.run(`deletePolicy('${P}', -1)`);
ok(names(D).length === 3, '취소 → 그대로 3건');

console.log('C) 외부 보험(중복) 삭제');
D.run(`deletePolicy('${P}', -2)`);
ok(JSON.stringify(names(D)) === '["외부보험","기존보험"]', '중복 하나만 지워짐');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${P}'].externalPolicies.length===1`), '저장·동기화 대상에 반영');
ok(D.get(`load('ins_cp_index', []).some(id => (load(id, {}) || {}).label === '보험 삭제 전')`), '삭제 직전 상태가 체크포인트로 남음');
D.run(`renderCovDetail('${P}')`);
ok(!/중복 의심/.test(D.el('cov-detail').innerHTML), '중복이 사라지면 표시도 사라짐');

console.log('D) 내 계약 완전 삭제');
D.run(`deletePolicy('${P}', 1)`);
ok(D.get(`CONTRACTS.length===0`) && D.get(`!(COVERAGES['${P}'].policies||[]).some(p=>p.id===1)`), '계약 리스트·보장분석에서 모두 사라짐');

console.log('E) 보맵 보험: 완전 삭제하면 다시 가져와도 안 생김, 이번만 삭제는 다시 생김');
const B = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}' } });
B.ctx.__f = bfile([1, 2]); B.get('importBomappData(__f)');
const bp = B.get(`peopleList()[0].pid`);
const ext = () => B.get(`(COVERAGES['${bp}'].externalPolicies||[]).map(x=>x.n)`);
const idOf = n => B.get(`COVERAGES['${bp}'].externalPolicies.find(x=>x.n==='${n}').id`);
B.confirmQ.push(true, true);
B.run(`deletePolicy('${bp}', ${idOf('보맵보험1')})`);
ok(B.get(`JSON.stringify(COVERAGES['${bp}'].bmSkip)`) === '[1]', '완전 삭제 → 빼 둘 목록에 기록');
let r = B.get('importBomappData(__f)');
ok(JSON.stringify(ext()) === '["보맵보험2"]' && r.skipped === 1, '다시 가져와도 보맵보험1 안 생김 (건너뜀 1)');
B.run(`renderCovDetail('${bp}')`);
ok(/보맵에서 빼 둔 보험 1건/.test(B.el('cov-detail').innerHTML), '보맵 머리줄에 "빼 둔 보험 1건 · 다시 가져오게 하기"');
B.confirmQ.push(true, false);
B.run(`deletePolicy('${bp}', ${idOf('보맵보험2')})`);
B.get('importBomappData(__f)');
ok(JSON.stringify(ext()) === '["보맵보험2"]', '이번만 삭제 → 다음에 가져오면 다시 생김');
B.run(`clearBmSkip('${bp}')`);
B.get('importBomappData(__f)');
ok(JSON.stringify(ext().sort()) === '["보맵보험1","보맵보험2"]', '빼 둔 목록을 풀면 다시 가져옴');

console.log('F) 같은 보맵 보험이 두 곳에 중복이면 하나만 지우고 빼 두지 않음');
B.run(`COVERAGES['pid_dupcopy'] = {policies: [], person: {name: '가복사'}, externalPolicies: [JSON.parse(JSON.stringify(COVERAGES['${bp}'].externalPolicies.find(x=>x.n==='보맵보험1')))]}`);
B.confirmQ.push(true);
const c0 = B.confirms.length;
B.run(`deletePolicy('pid_dupcopy', COVERAGES['pid_dupcopy'].externalPolicies[0].id)`);
ok(B.get(`COVERAGES['pid_dupcopy'].externalPolicies.length===0`) && B.get(`!COVERAGES['pid_dupcopy'].bmSkip`) && B.confirms.length - c0 === 1, '중복 사본만 지우고 "빼 둘까요?"는 안 물음 (확인 창 1번)');
ok(JSON.stringify(ext().sort()) === '["보맵보험1","보맵보험2"]', '원래 쪽 보험은 그대로');

console.log(`\n보험 삭제 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
