// 🧹 보장분석 자료 점검·정리 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const A = 'pid_tidyaaa', B = 'pid_tidybbb';
const C = (id, pid, n) => ({ id, pid, c: '가', p: n, co: '가나생명', n: '보험' + id, s: '계약완료', d: '25.01.01', pr: 1, g: '지인' });
const I = (n, a) => ({ name: n, amount: a, unit: '만원' });
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, A, '엄마'), C(2, B, '딸'), C(3, B, '딸')]),
  ins_coverages: JSON.stringify({
    [A]: { policies: [{ id: 1, items: [I('암진단비', 3000)] }, { id: 2, items: [I('상해사망', 100)] }, { id: 3, items: [I('남은것', 1)] }, { id: 99, items: [I('삭제된계약', 1)] }],
      externalPolicies: [{ id: -1, co: '마바손보', n: '실손', pr: 1, items: [I('질병입원의료비', 5000)] }, { id: -2, co: '마바손보', n: '실손', pr: 1, items: [I('질병입원의료비', 5000)] }],
      remodel: { roles: { r1: 'both', r99: 'before', 'r-1': 'both' } }, matrixView: { '암진단비': { '가나생명\n보험1': 5000 } } },
    [B]: { policies: [{ id: 3, items: [I('딸보험', 2)] }] },
    pid_emptyone: { policies: [] },
    pid_personkeep: { policies: [], person: { name: '남겨둘사람' } } }),
  ins_monthly: '[]', ins_groups: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

// 앱이 열리면서 이름 다듬기는 이미 됐을 수 있음 → 점검 전에 예전 이름 데이터를 다시 넣어 확인
D.run(`COVERAGES['${A}'] = Object.assign({}, COVERAGES['${A}'], {matrixView: {'암진단비': {'가나생명\\n보험1': 5000}}, covNameVer: 0})`);
const plan = D.get('covTidyPlan()');
ok(plan.names.includes(A), '담보 이름 다듬을 고객 찾음');
ok(plan.moves.length === 1 && plan.moves[0].id === 2 && plan.moves[0].to === B, '딸에게 옮겨진 계약 2번의 담보 기록 → 딸에게 옮길 것');
ok(plan.drops.some(d => d.id === 3) && plan.drops.some(d => d.id === 99) && plan.drops.length === 2, '이미 딸 쪽에 있는 3번·삭제된 99번 기록은 정리할 것');
ok(plan.roles.length === 1 && plan.roles[0].k === 'r99', '없는 보험(99번)을 가리키는 비교 설정 1건');
ok(JSON.stringify(plan.empties) === JSON.stringify(['pid_emptyone']), '빈 기록 1건 (이름만 있는 사람은 남김)');
ok(plan.dups.length === 1 && plan.dups[0].n === 2 && /실손/.test(plan.dups[0].label), '중복 의심: 마바손보 실손 2건');
ok(D.get(`COVERAGES['${A}'].policies.length`) === 4, '점검만으로는 아무것도 안 바뀜');

D.confirmQ.push(true);
D.run('openCovTidy()');
const a = D.get(`COVERAGES['${A}']`), b = D.get(`COVERAGES['${B}']`);
ok(JSON.stringify(a.policies.map(p => p.id)) === '[1]', '엄마 쪽엔 1번 기록만 남음');
ok(JSON.stringify(b.policies.map(p => p.id).sort()) === '[2,3]' && b.policies.find(p => p.id === 2).items[0].name === '상해사망', '2번 담보 기록이 딸에게 옮겨짐 (내용 그대로)');
ok(!('r99' in a.remodel.roles) && a.remodel.roles.r1 === 'both' && a.remodel.roles['r-1'] === 'both', '없는 보험 비교 설정만 정리');
ok(D.get(`!('pid_emptyone' in COVERAGES) && ('pid_personkeep' in COVERAGES)`), '빈 기록만 지움');
ok(a.matrixView['일반암 진단비'] && !('암진단비' in a.matrixView) && a.covNameVer === 3, '담보 이름 다듬기 적용');
ok(a.externalPolicies.length === 2, '중복 의심 보험은 자동으로 지우지 않음');
ok(D.get(`load('ins_cp_index', []).some(id => (load(id, {}) || {}).label === '보장분석 정리 전')`), '정리 직전 체크포인트');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${B}'].policies.length===2`), '저장·동기화 대상에 반영');
const p2 = D.get('covTidyPlan()');
ok(!p2.names.length && !p2.moves.length && !p2.drops.length && !p2.roles.length && !p2.empties.length && p2.dups.length === 1, '다시 점검하면 정리할 것 없음 (중복 의심만 남음)');
ok(/🧹 보장분석 자료 정리/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').match(/<details class="more-menu hdr-menu">[\s\S]*?<\/details>/)[0]), '⚙️ 관리 메뉴에 버튼');

console.log(`\n보장분석 정리 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
