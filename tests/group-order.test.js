// 그룹별: 이름순 정렬 · ★ 즐겨찾기(그룹·고객) · 그룹 이름을 그 줄에서 바꾸기 (사용자 요청 2026-11-19, 가짜 데이터만)
const fs = require('fs'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const K = (id, name, g) => ({ id, pid: 'pid_' + id, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.0' + id, pr: 10000 * (10 - id), g });

const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([K(1, '하나', '다그룹'), K(2, '가나', '다그룹'), K(3, '마바', '가그룹'), K(4, '나다', '나그룹')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: JSON.stringify({ 가그룹: '#3B82F6', 나그룹: '#10B981', 다그룹: '#F59E0B' }), ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
const html = () => D.el('pane-그룹별').innerHTML;
const pos = s => html().indexOf(s);
const gpos = n => pos(`<span class="gname">${n}</span>`);

console.log('A) 이름순 (월보험료 큰 순이 아니라 가나다): 그룹도, 그룹 안 고객도');
D.run('renderGroups()');
ok(gpos('가그룹') > -1 && gpos('가그룹') < gpos('나그룹') && gpos('나그룹') < gpos('다그룹'), '그룹 카드: 가그룹 → 나그룹 → 다그룹 (월보험료는 다그룹이 가장 큼)');
const card = n => { const i = gpos(n); return html().slice(html().lastIndexOf('<div class="gcard">', i), html().indexOf('<div class="gcard">', i) < 0 ? html().length : html().indexOf('<div class="gcard">', i)); };
const inCard = (n, who) => card(n).indexOf(`data-pid="pid_${who}"`);
ok(inCard('다그룹', 2) > -1 && inCard('다그룹', 2) < inCard('다그룹', 1), '다그룹 안에서 가나(2)가 하나(1)보다 먼저 (이름순)');

console.log('B) ★ 그룹 즐겨찾기: 맨 위로, 저장·동기화 대상(settings), 다시 누르면 해제');
D.run(`toggleFav('groups', '다그룹')`);
ok(gpos('다그룹') < gpos('가그룹') && /★<\/button><button type="button" class="g-ico"[^>]*title="그룹 이름 바꾸기"/.test(card('다그룹')), '즐겨찾기한 다그룹이 맨 위, 머리줄에 ★');
ok(JSON.stringify(D.get(`JSON.parse(localStorage.getItem('ins_settings')).favorites.groups`)) === '["다그룹"]', '이 기기 저장소(동기화 대상 settings)에 기록');
D.run(`toggleFav('groups', '다그룹')`);
ok(gpos('가그룹') < gpos('다그룹') && /☆/.test(card('다그룹')), '다시 누르면 해제되어 이름순으로 돌아감');

console.log('C) ★ 고객 즐겨찾기: 그룹 안에서 맨 위로');
D.run(`toggleFav('people', 'pid_1')`);
ok(inCard('다그룹', 1) < inCard('다그룹', 2), '하나(1)를 ★ 하면 가나(2)보다 위로');
ok(/★/.test(card('다그룹').slice(inCard('다그룹', 1), inCard('다그룹', 1) + 400)), '고객 줄에 ★ 표시');

console.log('D) ★ 즐겨찾기만 보기');
D.run(`setGroupFavOnly()`);
ok(gpos('다그룹') > -1 && gpos('가그룹') < 0 && gpos('나그룹') < 0 && inCard('다그룹', 1) > -1 && inCard('다그룹', 2) < 0, '★ 고객 하나(1)가 있는 다그룹 카드에 그 사람만 (가나는 빠짐)');
D.run(`toggleFav('groups', '가그룹')`);
ok(gpos('가그룹') > -1 && inCard('가그룹', 3) > -1 && gpos('나그룹') < 0, '★ 그룹이면 그 그룹 고객 전부');
D.run(`setGroupFavOnly(); toggleFav('groups', '가그룹')`);
ok(gpos('나그룹') > -1 && /kind-chip on[^>]*onclick="setGroupFavOnly\(\)"/.test(html()) === false, '다시 누르면 전체로');

console.log('E) 그룹 이름을 그 줄에서 바꾸기');
ok(/title="그룹 이름 바꾸기"/.test(card('나그룹')) && /title="그룹 이름 바꾸기"/.test(card('가그룹')), '실제 그룹 줄마다 ✏️ 버튼');
D.run(`toggleFav('groups', '다그룹')`);
D.promptQ.push(null); D.run(`renameGroupPrompt('다그룹')`);
ok(D.get(`hasOwn(GROUPS, '다그룹')`), '입력 취소하면 그대로');
D.promptQ.push('가그룹'); D.run(`renameGroupPrompt('다그룹')`);
ok(D.get(`hasOwn(GROUPS, '다그룹')`) && D.get(`CONTRACTS.filter(c=>c.g==='가그룹').length`) === 1, '이미 있는 이름으로는 못 바꿈');
D.promptQ.push('라그룹'); D.run(`renameGroupPrompt('다그룹')`);
ok(!D.get(`hasOwn(GROUPS, '다그룹')`) && D.get(`hasOwn(GROUPS, '라그룹')`) && D.get(`CONTRACTS.filter(c=>c.g==='라그룹').length`) === 2, '이름이 바뀌고 계약들도 따라감');
ok(JSON.stringify(D.get(`JSON.parse(localStorage.getItem('ins_settings')).favorites.groups`)) === '["라그룹"]', '즐겨찾기도 새 이름으로 따라감');
D.run('renderGroups()');
ok(gpos('라그룹') > -1 && gpos('라그룹') < gpos('가그룹') && gpos('다그룹') < 0, '화면에도 새 이름으로 (즐겨찾기라 맨 위)');

console.log('F) 즐겨찾기는 고객 링크로 안 나감');
const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
ok(!/favorites/.test(code), '서버 고객 응답 목록에 favorites 없음 (settings 중 담보 그룹만 보냄)');

console.log(`\n그룹 정렬·즐겨찾기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
