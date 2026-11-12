// 약관 링크: 모든 보험에 입력 · 주소 검사(http/https, 띄어쓰기) · 접힌 카드 머리줄 · 고객 화면 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_termstest';
const dev = () => makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '가나생명', n: '직접입력보험', s: '계약완료', d: '25.01.01', pr: 10000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: { policies: [{ id: 1, items: [{ name: '암진단비', amount: 3000, unit: '만원' }] }],
    externalPolicies: [{ id: -5, co: '마바손해보험', n: '보맵보험', pr: 2000, items: [{ name: '질병사망', amount: 1000, unit: '만원' }], bm: { id: 7, terms: 'https://s3.example.test/약관 2023 개정.pdf' } }] } }),
  ins_monthly: '[]', ins_groups: '{}' } });
const summaryOf = (h, id) => h.slice(h.indexOf(`data-policy-id="${id}"`), h.indexOf('</summary>', h.indexOf(`data-policy-id="${id}"`)));

(async () => {
const D = dev();
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 주소 검사');
ok(D.get(`safeLinkUrl('https://s3.example.test/약관 2023.pdf')`).startsWith('https://s3.example.test/') && !/ /.test(D.get(`safeLinkUrl('https://s3.example.test/약관 2023.pdf')`)), '띄어쓰기 있는 주소도 받아서 주소 규칙대로 바꿈 (예전엔 버려짐)');
ok(D.get(`safeLinkUrl('http://insurer.example.test/terms.pdf')`) === 'http://insurer.example.test/terms.pdf', 'http 주소도 받음');
ok(D.get(`safeLinkUrl('javascript:alert(1)')`) === '' && D.get(`safeLinkUrl('https://user:pw@evil.test/x')`) === '' && D.get(`safeLinkUrl('ftp://x.test/a')`) === '', '위험한 주소는 거절');

console.log('B) 보맵 보험: 가져온 약관 주소(띄어쓰기 포함)가 접힌 카드 머리줄과 고객 화면에 보임');
D.run(`renderCovDetail('${P}')`);
let h = D.el('cov-detail').innerHTML;
ok(/📜 약관 보기/.test(summaryOf(h, -5)), '관리 화면: 보맵 보험 카드 머리줄(접혀 있어도 보이는 곳)에 약관 보기');
ok(/보맵에서 가져온 약관 주소를 쓰는 중/.test(h), '입력칸에 "보맵 주소를 쓰는 중" 안내');
ok(!/📜 약관 보기/.test(summaryOf(h, 1)), '약관 주소가 없는 보험엔 링크 없음');

console.log('C) 직접 입력한 보험에도 약관 링크를 넣을 수 있음');
ok(/onchange="setPolTerms\('pid_termstest',1,this.value\)"/.test(h), '모든 보험 카드에 약관 링크 입력칸');
D.run(`setPolTerms('${P}', 1, 'https://insurer.example.test/약관.pdf')`);
ok(D.get(`polIn(COVERAGES['${P}'],1).termsUrl`).startsWith('https://insurer.example.test/'), '보험 기록에 저장');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${P}'].policies[0].termsUrl`).startsWith('https://insurer.example.test/'), '저장·동기화 대상(coverages)에 기록');
h = D.el('cov-detail').innerHTML;
ok(/📜 약관 보기/.test(summaryOf(h, 1)), '저장 후 그 카드 머리줄에 약관 보기');
D.run(`setPolTerms('${P}', 1, 'javascript:alert(1)')`);
ok(D.get(`polIn(COVERAGES['${P}'],1).termsUrl`).startsWith('https://insurer.example.test/'), '위험한 주소는 저장하지 않음 (이전 값 유지)');
D.run(`setPolTerms('${P}', -5, 'https://direct.example.test/내가넣은.pdf')`);
ok(D.get(`termsUrlOf(polIn(COVERAGES['${P}'],-5))`).startsWith('https://direct.example.test/'), '직접 넣은 주소가 보맵 주소보다 우선');

console.log('D) 고객 화면');
D.bodyHtml = ''; D.run(`showCustomerView('${P}','')`);
const cv = D.bodyHtml;
ok((cv.match(/📜 약관 보기/g) || []).length === 2, '두 보험 모두 고객 화면에 약관 보기 (중복 없이 한 번씩)');
ok(!/javascript:/.test(cv), '위험한 주소 없음');

console.log(`\n약관 링크 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
