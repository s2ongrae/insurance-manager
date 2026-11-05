// 날짜 알림 + 2년 1개월 시점: 날짜 계산 · 기기 간 병합 · 서버 저장 · 고객 화면 차단 · 앱 동작
const fs = require('fs'), vm = require('vm'), path = require('path');
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const clone = o => JSON.parse(JSON.stringify(o));

(async () => {
console.log('A) 2년 1개월 날짜 (가입일 + 25개월, 말일은 그 달 말일로)');
const D0 = makeDevice({ ls: { ins_contracts: '[]', ins_monthly: '[]', ins_groups: '{}' } });
ok(D0.errors.length === 0, '앱 로드 오류 없음 ' + D0.errors.join('|'));
const ms = (d, s = '계약완료') => D0.get(`(milestoneOf({s:${JSON.stringify(s)},d:${JSON.stringify(d)}})||{label:null}).label`);
ok(ms('24.08.28') === '26.09.28', '24.08.28 → 26.09.28');
ok(ms('24.01.31') === '26.02.28', '24.01.31 → 26.02.28 (2월 말일로, 3월로 넘어가지 않음)');
ok(ms('23.12.31') === '26.01.31', '23.12.31 → 26.01.31 (해가 넘어감)');
ok(ms('25.11.30') === '27.12.30', '25.11.30 → 27.12.30');
ok(ms('24.08.28', '계약해지') === null && ms('24.08.28', '가입 예정') === null, '해지·예정 계약은 표시 안 함');
ok(ms('24.02.30') === null && ms('') === null && ms('abc') === null, '없는 날짜·빈 값은 표시 안 함');
ok(D0.get(`ddayLabel(0)`) === 'D-DAY' && D0.get(`ddayLabel(3)`) === 'D-3' && D0.get(`ddayLabel(-2)`) === '2일 지남', 'D-day 표시');

console.log('B) 두 기기에서 알림을 따로 추가·완료·삭제해도 합쳐짐 (SYNC_CORE 병합)');
const core = fs.readFileSync(path.join(__dirname, '.build', 'sync_core.js'), 'utf8');
const cx = vm.createContext({ console }); vm.runInContext(core + '\nthis.__api={mergeAll,makeBase,toMaps};', cx); const A = cx.__api;
const base = { contracts: [], monthly: [], groups: {}, coverages: {}, memos: {}, shares: {}, settings: {},
  reminders: { r1: { id: 'r1', date: '2026-11-10', memo: '갱신 안내', done: false }, r2: { id: 'r2', date: '2026-12-01', memo: '서류', done: false } } };
const L = clone(base), S = clone(base);
L.reminders.r3 = { id: 'r3', date: '2026-11-20', memo: '폰에서 추가', done: false };
L.reminders.r1 = { ...L.reminders.r1, done: true };
S.reminders.r4 = { id: 'r4', date: '2026-11-21', memo: 'PC에서 추가', done: false };
delete S.reminders.r2; S.tombstones = { reminders: { r2: new Date().toISOString() } };   // 실제로는 지운 기기가 삭제 기록을 함께 올려요
const r = A.mergeAll(A.makeBase(base), L, S).data.reminders;
{ // 그 삭제 기록이 실제 병합에서 만들어지는지도 확인: 이 기기(L2)에서 지움 → 서버(S2)는 그대로 → 삭제 기록 생성
  const L2 = clone(base); delete L2.reminders.r2;
  const t = A.mergeAll(A.makeBase(base), L2, clone(base)).data.tombstones;
  ok(t.reminders && t.reminders.r2, '이 기기에서 알림을 지우면 삭제 기록(tombstone)이 생김');
}
ok(r.r3 && r.r4, '양쪽에서 새로 넣은 알림이 모두 남음');
ok(r.r1 && r.r1.done === true, '한 기기에서 완료 처리한 것이 반영');
ok(!r.r2, '다른 기기에서 지운 알림은 여기서도 지워짐');
ok(A.mergeAll(null, { reminders: { x: 'not-object' } }, { reminders: { y: 5 } }).data.reminders.y === undefined, '서버에서 온 이상한 모양의 알림은 건너뜀');

console.log('C) 서버: 저장·유지 · 옛 화면이 저장해도 알림 유지 · 고객 화면에 안 나감');
const sv = makeServer(), post = b => sv.post(Object.assign({ key: sv.KEY }, b));
const full = { contracts: [{ id: 1, s: '계약완료', d: '24.08.28', c: '갑', p: '갑', pid: 'pid_a1', co: '삼성', n: '건강', pr: 1000 }], monthly: [], groups: {}, coverages: {}, memos: {},
  shares: { pid_a1: 'T'.repeat(48) }, settings: {}, reminders: { r1: { id: 'r1', date: '2026-11-10', memo: '비밀메모ZZ', done: false, cid: '1' } } };
let res = post({ action: 'save', baseRev: 0, data: full });
ok(res.ok, '알림 포함 저장 성공');
res = post({ action: 'load' }); ok(res.data.reminders && res.data.reminders.r1 && res.data.reminders.r1.memo === '비밀메모ZZ', '불러오면 알림이 그대로');
const old = clone(full); delete old.reminders;
res = post({ action: 'save', baseRev: res.rev, data: old }); ok(res.ok, '알림 칸을 모르는 옛 화면의 저장도 성공');
res = post({ action: 'load' }); ok(res.data.reminders && res.data.reminders.r1, '옛 화면이 저장해도 알림이 지워지지 않음');
const emptied = clone(full); emptied.reminders = {};
res = post({ action: 'save', baseRev: res.rev, data: emptied }); res = post({ action: 'load' });
ok(res.data.reminders && Object.keys(res.data.reminders).length === 0, '새 화면에서 모두 지우면(빈 칸) 서버에서도 지워짐');
post({ action: 'save', baseRev: res.rev, data: full });
const cv = sv.post({ action: 'getCustomerView', name: '갑', token: 'T'.repeat(48) });
ok(cv.ok && !JSON.stringify(cv).includes('비밀메모ZZ') && !('reminders' in cv), '고객 화면 응답에 알림이 없음');

console.log('D) 앱: 추가 · 완료 · 삭제 · 상단 숫자 · 2년 1개월 칸');
const now = new Date(); const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yy = d => `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
// 2년 1개월이 정확히 5일 뒤가 되는 가입일 (독립 계산)
const t5 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5);
const start5 = new Date(t5.getFullYear(), t5.getMonth() - 25, t5.getDate());
const okStart = start5.getDate() === t5.getDate();       // 말일 보정이 끼면 이 시나리오는 건너뜀
const cons = [{ id: 1, s: '계약완료', d: yy(start5), c: '을', p: '을', co: '현대', n: '종합<b>X</b>', pr: 1000, g: '' },
              { id: 2, s: '계약완료', d: '20.01.01', c: '병', p: '병', co: 'DB', n: '실비', pr: 2000, g: '' }];
const P = makeDevice({ ls: { ins_contracts: JSON.stringify(cons), ins_monthly: '[]', ins_groups: '{}' } });
ok(P.errors.length === 0, '앱 로드 오류 없음 ' + P.errors.join('|'));
P.run("renderTab('리스트')"); const lr = P.el('list-results').innerHTML;
ok(/<th[^>]*>2년 1개월<\/th>/.test(lr), '계약 리스트에 "2년 1개월" 칸');
if (okStart) {
  ok(lr.includes(yy(t5)) && /D-5/.test(lr), '5일 뒤 2년 1개월인 계약: 날짜와 D-5 표시');
  ok(P.get('reminderBadgeCount()') === 1, '7일 안에 2년 1개월이 오는 계약 1건 → 상단 숫자 1');
}
ok(!/종합<b>X<\/b>/.test(lr), '리스트 보험명 태그 실행 안 됨');
P.el('rem-date').value = iso(now); P.el('rem-memo').value = '오늘 전화<script>'; P.el('rem-cid').value = '2';
P.run('addReminder()');
const ids = P.get('Object.keys(REMINDERS)');
ok(ids.length === 1 && P.get(`REMINDERS['${ids[0]}'].memo`) === '오늘 전화<script>' && P.get(`REMINDERS['${ids[0]}'].cid`) === '2', '알림 추가: 날짜·메모·연결 계약 저장');
ok(JSON.parse(P.store.get('ins_reminders'))[ids[0]], '이 기기 저장소에도 저장');
ok(P.get('collectLocal().reminders') && P.get(`!!collectLocal().reminders['${ids[0]}']`), '동기화 데이터(collectLocal)에 포함');
ok(P.get('reminderBuckets().due.length') === 1, '오늘 날짜 알림은 "지금 확인할 것"');
ok(P.get('reminderBadgeCount()') === (okStart ? 2 : 1), '상단 숫자 = 오늘까지 알림 + 7일 안 2년 1개월');
P.run('renderReminders()'); const rl = P.el('rem-list').innerHTML;
ok(!rl.includes('<script>') && rl.includes('오늘 전화&lt;script&gt;'), '알림 메모는 글자 그대로 (태그 실행 안 됨)');
ok(rl.includes('병 · DB 실비'), '연결한 계약이 함께 보임');
P.run(`toggleReminder('${ids[0]}')`); ok(P.get(`REMINDERS['${ids[0]}'].done`) === true && P.get('reminderBuckets().due.length') === 0, '완료하면 확인할 목록에서 빠짐');
P.run(`toggleReminder('${ids[0]}')`); ok(P.get(`REMINDERS['${ids[0]}'].done`) === false, '되돌리기');
P.el('rem-memo').value = ''; P.run('addReminder()'); ok(P.get('Object.keys(REMINDERS).length') === 1, '메모가 비면 추가 안 함');
P.el('rem-date').value = '2026-02-30'; P.el('rem-memo').value = 'x'; P.run('addReminder()'); ok(P.get('Object.keys(REMINDERS).length') === 1, '없는 날짜면 추가 안 함');
P.confirmQ.push(true); P.run(`deleteReminder('${ids[0]}')`); ok(P.get('Object.keys(REMINDERS).length') === 0, '삭제');
P.run('exportData()'); const bak = JSON.parse(P.downloads[P.downloads.length - 1].text); ok('reminders' in bak, '💾 백업 파일에 알림 포함');

console.log('E) 고객 화면에는 알림이 안 보임');
const Q = makeDevice({ ls: { ins_contracts: JSON.stringify([{ id: 1, s: '계약완료', d: '24.08.28', c: '갑', p: '갑', pid: 'pid_q1', co: '삼성', n: '건강', pr: 1000 }]), ins_monthly: '[]', ins_groups: '{}',
  ins_reminders: JSON.stringify({ r1: { id: 'r1', date: '2026-11-01', memo: '고객에게안보여야함', done: false, cid: '1' } }) } });
Q.run(`showCustomerView('pid_q1','갑')`);
ok(Q.bodyHtml.includes('cv-screen') && !Q.bodyHtml.includes('고객에게안보여야함') && !/2년 1개월/.test(Q.bodyHtml), '고객 화면에 알림·2년 1개월 없음');

console.log(`\n알림 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
})();
