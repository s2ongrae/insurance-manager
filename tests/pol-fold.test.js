// 관리 화면 보험 카드 접기·펼치기 (사용자 요청 2026-11-11: 보험이 많으면 스크롤이 너무 길어짐) — 가짜 데이터만
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const PID = 'pid_foldtest';
const contract = (id, n) => ({ id, pid: PID, c: '가나다', p: '가나다', co: '가나생명', n, s: '계약완료', d: '25.01.0' + id, pr: 10000 * id, g: '지인' });
const dev = count => makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify(Array.from({ length: count }, (_, i) => contract(i + 1, '보험' + (i + 1)))),
  ins_coverages: JSON.stringify({ [PID]: { policies: Array.from({ length: count }, (_, i) => ({ id: i + 1, items: [{ name: '암진단비', amount: 1000 * (i + 1), unit: '만원' }, { name: '일반사망', amount: 500, unit: '만원' }] })) } }),
  ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
const cards = h => h.match(/<details class="cov-policy policy-first-card pol-fold"[^>]*>/g) || [];
const cardOf = (h, id) => cards(h).find(t => t.includes(`data-policy-id="${id}"`)) || '';

(async () => {
console.log('A) 보험이 3건 이하면 처음에 펼침, 더 많으면 접음');
const S = dev(2);
ok(S.errors.length === 0, '로드 오류 없음 ' + S.errors.join('|'));
S.run(`renderCovDetail('${PID}')`);
let h = S.el('cov-detail').innerHTML;
ok(cards(h).length === 2 && cards(h).every(t => / open /.test(t + ' ')), '2건: 카드 2개 모두 펼침');
const D = dev(5);
D.run(`renderCovDetail('${PID}')`);
h = D.el('cov-detail').innerHTML;
ok(cards(h).length === 5 && cards(h).every(t => !/ open[ >]/.test(t)), '5건: 카드 5개 모두 접힘 (스크롤 짧게)');

console.log('B) 접힌 머리줄만 봐도 알 수 있게');
const sum = h.slice(h.indexOf('data-policy-id="3"'), h.indexOf('</summary>', h.indexOf('data-policy-id="3"')));
ok(/가나생명 · 보험3/.test(sum) && /월 3만원/.test(sum) && /특약 2개/.test(sum), '머리줄: 보험사·상품명 · 월 보험료 · 특약 수');
ok(/rm-state/.test(sum), '머리줄: 기존·해지·배서·신규 상태 표시');
ok(!/제안서 넣기/.test(sum) && !/파일만 저장/.test(sum), '버튼은 머리줄이 아니라 펼친 안쪽 (누를 때 카드가 같이 접히지 않게)');

console.log('C) 모두 펼치기/접기 · 보험 바로가기');
ok(/polFoldAll\('pid_foldtest',true\)/.test(h) && /polFoldAll\('pid_foldtest',false\)/.test(h), '모두 펼치기 / 모두 접기 버튼');
ok((h.match(/class="pol-chip"/g) || []).length === 5 && /polJump\('pid_foldtest',3\)/.test(h), '보험 바로가기 5개');
ok(/보험별 담보 내역 <span class="rm-fine"[^>]*>5건/.test(h), '담보 내역 제목에 보험 수');

console.log('D) 펼친 상태는 다시 그려도(담보 수정 등) 유지');
D.run(`polFoldSet('${PID}', '3', true); updateCovItem('${PID}', 3, 0, 'amount', '7000'); renderCovDetail('${PID}')`);
h = D.el('cov-detail').innerHTML;
ok(/ open /.test(cardOf(h, 3) + ' '), '펼친 3번 카드는 다시 그려도 펼친 채');
ok(!/ open[ >]/.test(cardOf(h, 2)), '나머지는 접힌 채');
S.run(`polFoldSet('${PID}', '1', false); renderCovDetail('${PID}')`);
ok(!/ open[ >]/.test(cardOf(S.el('cov-detail').innerHTML, 1)), '접은 카드도 다시 그려도 접힌 채');

console.log('E) PDF 분석 중·실패는 접힌 머리줄에도 표시');
D.run(`PDF_ANALYSIS_STATUS['${PID}:4'] = {status:'running', message:'2/4 읽는 중'}; PDF_ANALYSIS_STATUS['${PID}:5'] = {status:'error', message:'실패'}; PDF_ANALYSIS_STATUS['${PID}:2'] = {status:'success', message:'완료'}; renderCovDetail('${PID}')`);
h = D.el('cov-detail').innerHTML;
const sumOf = id => h.slice(h.indexOf(`data-policy-id="${id}"`), h.indexOf('</summary>', h.indexOf(`data-policy-id="${id}"`)));
ok(/pol-busy">분석 중/.test(sumOf(4)), '분석 중 표시');
ok(/pol-busy fail">분석 실패/.test(sumOf(5)), '분석 실패 표시');
ok(!/pol-busy/.test(sumOf(2)), '완료된 건 표시 안 함');

console.log('F) 보장분석표(매트릭스·개요·고객 화면)에는 해지·가입 예정 계약이 안 들어감, 담보 내역 카드에는 가입 예정만');
{ const P = 'pid_cxltest';
  const c = (id, n, s) => ({ id, pid: P, c: '가', p: '가', co: '가나생명', n, s, d: '25.01.01', pr: 10000 * id, g: '지인' });
  const X = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([c(1, '유지보험', '계약완료'), c(2, '해지보험', '계약해지'), c(3, '예정보험', '가입 예정')]),
    ins_coverages: JSON.stringify({ [P]: { policies: [1, 2, 3].map(id => ({ id, items: [{ name: '암진단비', amount: 1000 * id, unit: '만원' }] })) } }), ins_monthly: '[]', ins_groups: '{}' } });
  X.run(`window._mtxMode='full'; renderCovDetail('${P}')`);
  const hx = X.el('cov-detail').innerHTML;
  const mt = hx.slice(hx.indexOf('>담보 항목</th>'), hx.indexOf('</table>', hx.indexOf('>담보 항목</th>')));
  const ov = hx.slice(hx.indexOf('보험 개요'), hx.indexOf('보장 합산 매트릭스'));
  ok(mt.includes('유지보험') && !mt.includes('해지보험') && !mt.includes('예정보험'), '매트릭스: 계약완료만');
  ok(ov.includes('유지보험') && !ov.includes('해지보험') && !ov.includes('예정보험'), '보험 개요: 계약완료만');
  ok(!/data-policy-id="2"/.test(hx) && /data-policy-id="3"/.test(hx), '담보 내역 카드: 해지는 빠지고, 가입 예정은 비교 입력용으로 있음');
  X.bodyHtml = ''; X.run(`showCustomerView('${P}', '')`);
  ok(X.bodyHtml.includes('유지보험') && !X.bodyHtml.includes('해지보험') && !X.bodyHtml.includes('예정보험'), '고객 화면: 계약완료만'); }

console.log(`\n보험 카드 접기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
