// 특약 만기·갱신 자동 알림 + 보맵 보장 점검(또래 평균 대비) 삭제 확인 (가짜 고객 데이터만 사용)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };

const pad = n => String(n).padStart(2, '0');
const dayAfter = n => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const rider = (id, name, until, x = {}) => Object.assign({ contractId: id, name, joinAmount: 10000000, maturityDate: until, insuredName: '홍길동', contractStatus: '정상', isMyContract: true }, x);
const pol = (id, x = {}) => Object.assign({ insuranceId: id, insurerName: '가나화재해상보험', productName: '튼튼건강보험' + id, insuranceStatus: '정상', insuranceType: '질병(건강)보험',
  subscriberName: '홍길동', primaryInsuredName: '홍길동', issueDate: '2020-10-29', maturityDate: '2045-10-29', isRenewal: true, monthlyPaymentAmount: 47990,
  paymentCycle: '매월', totalPaymentCount: 240, paidPaymentCount: 13, riders: [] }, x);
const cust = (r1Until) => ({ plannerMemberId: 11, memberId: 901, name: '홍길동', birthDate: '1990.01.02', gender: 'M',
  policies: [
    pol(1, { riders: [rider(10, '암진단비', r1Until), rider(11, '뇌혈관질환진단비', dayAfter(10)), rider(12, '먼특약', dayAfter(200)),
                      rider(13, '이미만기', dayAfter(5), { contractStatus: '만기' }), rider(14, '남의특약', dayAfter(5), { isMyContract: false, insuredName: '주택1' }),
                      rider(15, '날짜없음', '')] }),
    pol(2, { productName: '비갱신보험', isRenewal: false, riders: [rider(20, '수술비', dayAfter(60))] }),
    pol(3, { productName: '끝난보험', insuranceStatus: '소멸', riders: [rider(30, '사망', dayAfter(20))] })],
  guarantees: { ageGroup: 30, groups: [{ g: '암', items: [{ name: '일반암 진단비', status: 'NOTENOUGH', rec: 80000000, total: 50000000, desc: '', by: [{ id: 1, amt: 50000000 }] }] }] },
  report: null });
const file = c => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-11T07:00:00.000Z', customers: [c] });

(async () => {
console.log('A) 보맵에서 가져온 특약 → 90일 안에 만기·갱신이면 🔔 알림에 자동 등록');
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
D.ctx.__f = file(cust(dayAfter(45)));
D.run('importBomappData(__f); saveCoverages(); renderAll()');
const autos = () => D.get('Object.values(REMINDERS).filter(x=>x.auto)');
let a = autos();
ok(a.length === 3, '자동 알림 3건 (45일·10일 뒤 갱신, 60일 뒤 만기) — 실제 ' + a.length);
const has = s => a.some(x => x.memo.endsWith(' · ' + s));               // 메모 끝 = 특약 이름
const find = s => a.find(x => x.memo.endsWith(' · ' + s)) || { memo: '', id: '__none__' };
ok(has('암진단비') && find('암진단비').date === dayAfter(15), '알림 날짜 = 특약 만기일 30일 전');
ok(has('뇌혈관질환진단비') && find('뇌혈관질환진단비').date === dayAfter(-20), '30일 안이면 지금 확인할 알림으로 (날짜가 이미 지남)');
ok(/갱신/.test(find('암진단비').memo) && /홍길동/.test(find('암진단비').memo) && /튼튼건강보험1/.test(find('암진단비').memo), '메모에 갱신·이름·보험명');
ok(has('수술비') && /^특약 만기 /.test(find('수술비').memo), '비갱신형 보험 특약은 "만기"');
ok(/^특약 갱신 /.test(find('암진단비').memo), '갱신형 보험 특약은 "갱신"');
ok(!has('먼특약') && !has('이미만기') && !has('남의특약') && !has('날짜없음') && !has('사망'), '90일 밖·만기된 특약·다른 피보험자·날짜 없음·종료 보험은 등록 안 함');
ok(D.get('reminderBuckets().due.some(x=>x.auto && x.memo.includes("뇌혈관질환진단비"))'), '30일 안 특약은 "지금 확인할 것"에 나옴');
ok(D.get('reminderBadgeCount()') >= 1, '🔔 숫자에 포함');

console.log('B) 다시 그려도 중복 등록 안 됨 · 완료·삭제는 유지');
D.run('renderAll(); renderAll()');
ok(autos().length === 3, '여러 번 그려도 3건 그대로');
const idDone = find('암진단비').id, idDel = find('수술비').id;
D.run(`toggleReminder(${JSON.stringify(idDone)})`);
D.run(`deleteReminder(${JSON.stringify(idDel)})`);
D.run('renderAll()');
ok(D.get(`REMINDERS[${JSON.stringify(idDone)}].done`) === true, '완료한 자동 알림은 다시 안 살아남');
ok(!D.get(`(b=>b.soon.concat(b.due, b.done).some(x=>x.id===${JSON.stringify(idDel)}))(reminderBuckets())`), '지운 자동 알림은 어느 목록(완료 포함)에도 다시 나타나지 않음');
D.run('openReminders()');
ok(/자동/.test(D.el('rem-list').innerHTML) && /뇌혈관질환진단비/.test(D.el('rem-list').innerHTML), '알림 창에 자동 표시와 함께 나옴');

console.log('C) 갱신돼서 만기일이 바뀌면, 아직 처리 안 한 옛 자동 알림은 정리');
D.run(`toggleReminder(${JSON.stringify(idDone)})`);       // 다시 미완료로
D.ctx.__f = file(cust(dayAfter(45 + 365)));
D.run('importBomappData(__f); saveCoverages(); renderAll()');
a = autos();
ok(!a.some(x => x.id === idDone), '만기일이 1년 뒤로 바뀐 특약의 옛 알림은 지워짐');
ok(a.some(x => x.memo.includes('뇌혈관질환진단비')), '그대로인 특약 알림은 유지');

console.log('D) 내 계약 담보에 넣은 만기일도 등록 · 해지 계약은 제외 · 계약 연결');
const E = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([{ id: 5, pid: 'pid_aaaa1111', c: '김철수', p: '김철수', co: '다라생명', n: '좋은보험', s: '계약완료', d: '24.01.02', pr: 30000, g: '지인' },
                                 { id: 6, pid: 'pid_aaaa1111', c: '김철수', p: '김철수', co: '다라생명', n: '해지보험', s: '계약해지', d: '24.01.02', pr: 30000, g: '지인' }]),
  ins_coverages: JSON.stringify({ pid_aaaa1111: { policies: [
    { id: 5, items: [{ name: '입원일당', amount: 3, unit: '만원', until: dayAfter(40).replace(/-/g, '.') }] },
    { id: 6, items: [{ name: '해지특약', amount: 3, unit: '만원', until: dayAfter(40).replace(/-/g, '.') }] }] } }),
  ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(E.errors.length === 0, '로드 오류 없음 ' + E.errors.join('|'));
E.run('renderAll()');
const ea = E.get('Object.values(REMINDERS).filter(x=>x.auto)');
ok(ea.length === 1 && /입원일당/.test(ea[0].memo) && String(ea[0].cid) === '5', '계약완료 계약의 특약 1건 · 계약 연결(cid)');

console.log('E) 보맵 보장 점검(또래 평균 대비) 삭제');
const pid = D.get('Object.keys(COVERAGES)[0]');
ok(D.get(`COVERAGES[${JSON.stringify(pid)}].bomapp.std===undefined`), '가져올 때 보장 점검 데이터를 저장하지 않음');
D.run(`COVERAGES[${JSON.stringify(pid)}].bomapp.std={age:30,groups:[{g:'암',items:[{n:'일반암 진단비',st:'no',rec:1,total:1,by:[]}]}]}`);   // 예전에 저장된 데이터
D.run(`selectedCovCustomer=${JSON.stringify(pid)}; renderCoverageTab('보장분석')`);
const cd = D.el('cov-detail').innerHTML;
ok(!/보장 점검|또래/.test(cd), '관리 화면에 보장 점검 표 없음 (옛 데이터가 있어도)');
D.run(`showCustomerView(${JSON.stringify(pid)}, '')`);
ok(!/보장 점검|또래/.test(D.bodyHtml), '고객 화면에 보장 점검 표 없음');
ok(D.get('typeof bmStdHtml') === 'undefined', '보장 점검 표 함수 삭제됨');

console.log(`\n특약 알림·보장 점검 삭제 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
