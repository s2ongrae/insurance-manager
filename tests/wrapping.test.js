// 줄바뀜 규칙 (2026-11-19): 한글이 어절 중간에서 꺾이지 않게, 금액이 쪼개지지 않게, 폰에서 입력줄이 안 잘리게
// 실제 글자 위치로 재는 점검은 `node tools/wrap-scan.js` (크롬 필요). 여기서는 그 점검이 통과하게 만든 규칙이 지켜지는지만 빠르게 본다.
const { makeDevice, html } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');       // 설명 주석은 뺀다 (주석 속 글자에 걸리지 않게)

console.log('A) 전체 줄바꿈 규칙');
ok(/html\{word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty\}/.test(flat), '한글은 띄어쓰기에서만 줄바꿈 (keep-all) + 너무 긴 글자만 강제 (break-word) + 문장 끝 꼬리 방지');
ok(!/word-break:\s*break-(all|word)/.test(flat), 'break-all·break-word 로 한글을 어절 중간에서 꺾는 규칙이 없음 (예전 알림 본문이 그랬음)');
const any = [...flat.matchAll(/([^{}]+)\{[^{}]*overflow-wrap:\s*anywhere[^{}]*\}/g)].map(m => m[1].trim());
ok(any.every(s => /^\.pol-tbl td:nth-child\(5\)$/.test(s)), 'overflow-wrap:anywhere 는 좁은 표 칸 한 곳만 허용 — ' + JSON.stringify(any));
ok(/\.nw,\.hdr-logo,\.rm-fine b\{white-space:nowrap\}/.test(flat), '.nw(쪼개지 않는 덩어리) 규칙');

console.log('B) 금액은 중간에서 줄바뀜 없음');
{ const D = makeDevice({ ls: { ins_contracts: '[]', ins_monthly: '[]', ins_groups: '{}' } });
  ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  const vals = ['korWon(85000)', 'korWon(120000000)', 'korWon(47990)', 'manWon(3000)', 'manWon(12345)', 'korWon(-30050000)'].map(e => D.get(e));
  ok(vals.every(v => !/ /.test(v)), '금액에 일반 공백이 없음 (줄바뀜 자리가 없음) — ' + JSON.stringify(vals));
  ok(D.get('korWon(85000)') === '8만 5,000원' && D.get('korWon(120000000)') === '1억 2천만원', '값은 그대로 (공백만 줄바뀜 없는 공백)');
}

console.log('C) 폰에서 담보 입력줄은 두 줄 (이름 윗줄, 숫자 아랫줄)');
ok(/@media\(max-width:700px\)\{ \.cov-item-row\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\) 56px;row-gap:6px\} \.cov-item-row>:first-child\{grid-column:1\/-1\}/.test(flat), '입력줄 폰 규칙');
ok(/\.policy-first-card \.cov-item-row\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\) 56px/.test(flat) && /\.policy-first-card \.cov-item-row>:first-child\{grid-column:1\/-1\}/.test(flat), '보험 카드 안 입력줄도 같은 두 줄 규칙 (더 강한 옛 규칙이 덮지 못함)');
ok(!/grid-template-columns:minmax\(90px,1fr\) 65px 42px 70px 42px/.test(flat), '5칸을 한 줄에 욱여넣던 옛 폰 규칙이 없음');

console.log('D) 글자 크기: 보조 글자도 12px 이상');
ok(/\.pol-dup,\.cov-prospect,\.kind-badge[^{]*\.policy-source-delete\{font-size:12px\}/.test(flat), '9~11px 였던 뱃지·힌트·출처 규칙을 12px 로 올리는 덮어쓰기');
{ // 선택자마다 "마지막으로 적용되는" font-size 를 구한다 (뒤 규칙이 앞 규칙을 덮으므로). 새로 12px 미만을 쓰면 여기서 걸린다.
  const last = new Map();
  for (const m of flat.matchAll(/(?:^|[{}])\s*([^{}@]+?)\{([^{}]*)\}/g)) {
    const fs = m[2].match(/(?:^|;)\s*font-size:\s*([\d.]+)px/); if (!fs) continue;
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(sel => last.set(sel, parseFloat(fs[1])));
  }
  const small = [...last.entries()].filter(([, v]) => v < 12).map(([s, v]) => s + ' ' + v + 'px');
  ok(small.length === 0, '마지막으로 적용되는 글자 크기가 12px 미만인 CSS 규칙이 없음: ' + JSON.stringify(small)); }

console.log('E) 화면 조각: 쪼개지면 안 되는 덩어리는 .nw 로 감싸 있음');
{ const C = [{ id: 1, pid: 'pid_w', s: '계약완료', d: '24.03.10', c: '홍길동', p: '홍길동', co: '삼성화재', n: '무배당 삼성 인생이모작 건강보험 갱신형 플러스', pr: 85000, g: '그룹' }];
  const cov = { pid_w: { covNameVer: 3, policies: [{ id: 1, items: [{ name: '암 진단비', amount: 3000, unit: '만원', price: 0 }] }], externalPolicies: [{ id: -1, co: 'DB손해보험', n: '실손의료비보험', pr: 21000, items: [{ name: '질병입원의료비', amount: 5000, unit: '만원', price: 0 }] }] } };
  const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify(C), ins_coverages: JSON.stringify(cov), ins_monthly: '[]', ins_groups: '{}' } });
  D.run(`selectedCovCustomer='pid_w'; renderCoverageTab('보장분석')`);
  const cd = D.el('cov-detail').innerHTML;
  ok(/class="pol-meta"><span class="nw">월 8만 5,000원<\/span> · <span class="nw">특약 1개<\/span> · <span class="nw">24\.03\.10<\/span>/.test(cd), '보험 카드 머리: "월 8만 5,000원 · 특약 1개 · 날짜" 를 조각별로만 줄바꿈');
  ok(/class="cov-head"/.test(cd) && /<span class="nw">원본 삭제<\/span>|<span class="nw">삭제<\/span>/.test(cd), '제목 줄(cov-head)과 입력줄 머리글(nowrap)');
  ok(!/>원본 삭제<\/button>/.test(cd) && />삭제<\/button>/.test(cd), '행 삭제 버튼은 짧은 "삭제"');
  D.bodyHtml = ''; D.run(`showCustomerView('pid_w','홍길동')`);
  ok(/<span class="nw">· 월 <b[^>]*>8만 5,000원<\/b><\/span>/.test(D.bodyHtml), '고객 화면 보험 카드: "· 월 8만 5,000원" 한 덩어리');
}

console.log(`\n줄바뀜 규칙 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
