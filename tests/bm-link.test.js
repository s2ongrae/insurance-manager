// 내 계약 연결/해제: 보맵 보험 ↔ 내 계약 (사용자 요청 2026-11-24, 가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_bmlink';
const bpol = (id, name, extra) => Object.assign({ insuranceId: id, insurerName: '가나화재해상보험', productName: name, insuranceStatus: '정상', subscriberName: '가', primaryInsuredName: '가', isPrimaryInsuredMyself: true,
  issueDate: '2024-03-05', maturityDate: '2045-10-29', monthlyPaymentAmount: 33000, paymentCycle: '매월', totalPaymentCount: 240, paidPaymentCount: 1,
  riders: [{ contractId: id, name: '암진단비', joinAmount: 30000000, maturityDate: '2045-10-29', contractStatus: '정상', isMyContract: true }] }, extra || {});
const bfile = ps => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-12T07:00:00.000Z', customers: [{ plannerMemberId: 1, memberId: 777, name: '가', policies: ps }] });
const dev = () => makeDevice({ session: { ins_unlocked: '1' }, ls: {
  // 내 계약: 보험사·상품은 같지만 월보험료가 달라 자동 연결이 안 되는 상황 (보맵에서 중복으로 들어옴)
  ins_contracts: JSON.stringify([{ id: 11, pid: P, c: '가', p: '가', co: '가나화재해상보험', n: '내 암보험', s: '계약완료', d: '24.03.05', pr: 31000, g: '지인', proposalUrl: 'https://drive.google.com/file/d/abc/view' }]),
  ins_coverages: JSON.stringify({ [P]: { policies: [{ id: 11, items: [{ name: '옛 제안서 담보', amount: 1000, unit: '만원' }] }] } }), ins_monthly: '[]', ins_groups: '{}' } });

(async () => {
const D = dev();
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
D.ctx.__f = bfile([bpol(5001, '보맵 암보험')]); D.get('importBomappData(__f)');
const rec = () => D.get(`COVERAGES['${P}']`);
const ext = () => D.get(`(COVERAGES['${P}'].externalPolicies||[]).map(x=>x.n)`);
ok(JSON.stringify(ext()) === '["보맵 암보험"]', '준비: 보맵 보험이 외부 보험으로 따로 들어와 중복');
const eid = () => D.get(`COVERAGES['${P}'].externalPolicies[0].id`);

console.log('A) 카드 버튼');
D.run(`renderCovDetail('${P}')`);
let h = D.el('cov-detail').innerHTML;
ok(/linkPolicyToContract\('pid_bmlink',-?\d+\)/.test(h) && /🔗 내 계약으로 설정/.test(h), '보맵 보험 카드에 "내 계약으로 설정"');
ok(!/unlinkContractPolicy/.test(h), '아직 연결된 계약이 없으니 해제 버튼 없음');

console.log('B) 취소·잘못된 번호는 아무것도 안 바꿈');
D.run(`linkPolicyToContract('${P}', ${eid()})`);   // prompt 응답 없음 = 취소
ok(JSON.stringify(ext()) === '["보맵 암보험"]' && D.get(`CONTRACTS.length===1`), '취소 → 그대로');
D.promptQ.push('9'); D.run(`linkPolicyToContract('${P}', ${eid()})`);
ok(JSON.stringify(ext()) === '["보맵 암보험"]', '없는 번호 → 그대로');

console.log('C) 기존 계약에 연결: 보맵 담보가 살고 옛 담보·중복이 사라짐, 제안서 링크 유지');
D.promptQ.push('1'); D.run(`linkPolicyToContract('${P}', ${eid()})`);
ok(D.get(`(COVERAGES['${P}'].externalPolicies||[]).length===0`), '외부 보험 쪽 중복이 사라짐');
ok(D.get(`COVERAGES['${P}'].policies.length===1 && COVERAGES['${P}'].policies[0].id===11`), '계약 11 번호로 들어감');
ok(D.get(`COVERAGES['${P}'].policies[0].items.map(i=>i.name).join()==='암진단비'`), '보맵 담보로 교체 (옛 제안서 담보 없음)');
ok(D.get(`COVERAGES['${P}'].policies[0].bm.id===5001`), '보맵 번호가 붙음');
ok(D.get(`CONTRACTS.length===1 && CONTRACTS[0].proposalUrl==='https://drive.google.com/file/d/abc/view'`), '계약의 제안서 링크 유지');
ok(D.get(`load('ins_cp_index', []).some(id => (load(id, {}) || {}).label === '내 계약 연결 전')`), '연결 직전 체크포인트');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${P}'].policies[0].bm.id===5001`), '저장·동기화 대상에 반영');
D.run('renderAll()');
ok(/보맵 연결/.test(D.el('list-results').innerHTML), '계약 리스트에 "보맵 연결" 표시');
ok(D.errors.length === 0, '오류 없음 ' + D.errors.join('|'));

console.log('D) 보맵을 다시 가져와도 그 계약에 갱신(중복 안 생김)');
D.ctx.__f = bfile([bpol(5001, '보맵 암보험', { monthlyPaymentAmount: 34000 })]);
D.get('importBomappData(__f)');
ok(D.get(`(COVERAGES['${P}'].externalPolicies||[]).length===0 && COVERAGES['${P}'].policies.length===1 && COVERAGES['${P}'].policies[0].pr===34000`), '다시 가져와도 외부 보험 안 생기고 계약 쪽이 갱신');

console.log('E) 해제: 외부 보험으로 되돌아가고, 다시 가져와도 안 붙음');
D.run(`renderCovDetail('${P}')`);
ok(/unlinkContractPolicy\('pid_bmlink',11\)/.test(D.el('cov-detail').innerHTML), '내 계약 카드에 "내 계약 해제"');
D.confirmQ.push(true, false);   // 해제 확인, 계약은 남김
D.run(`unlinkContractPolicy('${P}', 11)`);
ok(JSON.stringify(ext()) === '["보맵 암보험"]' && D.get(`!(COVERAGES['${P}'].policies||[]).some(p=>p.id===11)`), '보맵 보험이 외부 보험으로 돌아감');
ok(D.get(`CONTRACTS.length===1 && CONTRACTS[0].proposalUrl==='https://drive.google.com/file/d/abc/view'`), '계약은 리스트에 남음');
D.get('importBomappData(__f)');
ok(D.get(`(COVERAGES['${P}'].externalPolicies||[]).length===1 && !(COVERAGES['${P}'].policies||[]).some(p=>p.bm)`), '다시 가져와도 자동으로 안 붙음');

console.log('F) 새 계약으로 등록 → 계약 리스트에 생김, 해제 시 계약도 삭제 선택 가능');
D.promptQ.push('0'); D.run(`linkPolicyToContract('${P}', ${eid()})`);
const nc = D.get(`CONTRACTS.find(c=>c.id!==11)`);
ok(nc && nc.co === '가나화재해상보험' && nc.n === '보맵 암보험' && nc.pr === 34000 && nc.d === '24.03.05' && nc.s === '계약완료' && nc.pid === P, '새 계약이 보맵 정보로 등록됨: ' + JSON.stringify(nc));
ok(D.get(`COVERAGES['${P}'].policies.some(p=>p.id===${nc.id} && p.bm.id===5001)`), '새 계약에 보맵 담보 연결');
ok(D.get(`MONTHLY.some(m=>m.m==='24.03')`), '월별 실적에 가입월 추가');
D.confirmQ.push(true, true);
D.run(`unlinkContractPolicy('${P}', ${nc.id})`);
ok(D.get(`!CONTRACTS.some(c=>c.id===${nc.id})`) && JSON.stringify(ext()) === '["보맵 암보험"]', '해제 + 계약 삭제 → 리스트에서 빠지고 보맵 보험은 외부로 남음');
ok(D.errors.length === 0, '오류 없음 ' + D.errors.join('|'));

console.log(`\n내 계약 연결 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
