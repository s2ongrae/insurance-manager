// 데이터 보호 (2026-11-12 사고: 계약 리스트가 한 고객 것만 남음)
// 고객 화면에서 저장·동기화 차단 · 이 기기 데이터가 크게 줄면 동기화 멈춤 · ☁️ 서버 데이터로 되돌리기 (가짜 데이터만)
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
const SID = 'AKfycbSAFETYTESTSAFETY12345', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = i => ({ id: i, pid: 'pid_p' + i, s: '계약완료', d: '25.01.0' + (i % 9 + 1), c: '고객' + i, p: '고객' + i, co: '가나생명', n: '보험' + i, pr: 10000, g: '지인' });
const contracts = Array.from({ length: 10 }, (_, i) => C(i + 1));
const coverages = Object.fromEntries(contracts.map(c => [c.pid, { policies: [{ id: c.id, items: [{ name: '암진단비', amount: 1000, unit: '만원' }] }] }]));

(async () => {
const S = makeServer();
const calls = [];
const route = async (u, o) => { const body = JSON.parse(o.body); calls.push(body.action); return { status: 200, json: async () => S.post(o.body) }; };
const base = { ins_monthly: '[]', ins_groups: '{"지인":"#868E96"}', ins_server_url: URL1, ins_server_key: S.KEY };
const A = makeDevice({ ls: Object.assign({}, base, { ins_contracts: JSON.stringify(contracts), ins_coverages: JSON.stringify(coverages) }), session: { ins_unlocked: '1' }, fetch: route });
await sleep(120);
let r = await A.run('syncNow()');
ok(r.ok && JSON.parse(S.dataFile().content).contracts.length === 10, '처음 동기화: 서버에 계약 10건');
S.post({ action: 'save', key: S.KEY, baseRev: JSON.parse(S.dataFile().content).rev, data: Object.assign(JSON.parse(S.dataFile().content), { shares: { pid_p3: 't'.repeat(48) } }) });

console.log('A) 고객 링크 화면(같은 브라우저)에서는 이 기기 저장·서버 저장을 절대 안 함');
const lsBefore = A.get(`localStorage.getItem('ins_contracts')`);
const V = makeDevice({ hash: `#view=고객3&t=${'t'.repeat(48)}&s=${SID}`, ls: Object.assign({}, base, { ins_contracts: lsBefore, ins_coverages: JSON.stringify(coverages) }), fetch: route });
await sleep(150);
ok(V.get(`CUSTOMER_MODE===true`) && V.get('CONTRACTS.length') === 1, '고객 화면: 메모리 계약은 그 고객 것 1건 (원래 동작)');
const saves0 = calls.filter(a => a === 'save').length;
V.run('persistLocal(); scheduleSave();');
r = await V.run('syncNow()');
await sleep(1700);
ok(V.get(`JSON.parse(localStorage.getItem('ins_contracts')).length`) === 10, '이 기기 저장소의 계약 10건 그대로 (예전엔 1건으로 덮어써질 수 있었음)');
ok(r.ok === false && r.reason === 'customer' && calls.filter(a => a === 'save').length === saves0, '서버 저장 요청도 안 보냄');
ok(JSON.parse(S.dataFile().content).contracts.length === 10, '서버 계약 10건 그대로');

console.log('B) 이 기기 데이터가 크게 줄어 있으면 합치지도 저장하지도 않고 멈춤');
A.run(`CONTRACTS = CONTRACTS.filter(c => c.id === 3); COVERAGES = {pid_p3: COVERAGES.pid_p3}; persistLocal();`);   // 사고 상황 재현
r = await A.run('syncNow()');
ok(r.ok === false && r.reason === 'localShrink', '동기화 멈춤 (localShrink)');
ok(A.get('CONTRACTS.length') === 1, '줄어든 합친 결과를 적용하지 않음');
ok(JSON.parse(S.dataFile().content).contracts.length === 10, '서버 계약 10건 그대로');
ok(/서버 데이터로 되돌리기/.test(A.get(`(document.getElementById('shrink-banner')||{}).innerHTML||''`)), '화면에 "☁️ 서버 데이터로 되돌리기" 안내 띠');

console.log('C) ☁️ 서버 데이터로 되돌리기');
A.confirmQ.push(false);
await A.run('pullFromServer()');
ok(A.get('CONTRACTS.length') === 1, '취소하면 그대로');
A.confirmQ.push(true);
const done = await A.run('pullFromServer()');
ok(done === true && A.get('CONTRACTS.length') === 10 && A.get('Object.keys(COVERAGES).length') === 10, '서버 데이터(계약 10건·보장분석 10명)로 되돌아옴');
ok(A.get(`JSON.parse(localStorage.getItem('ins_contracts')).length`) === 10, '이 기기 저장소에도 반영');
ok(A.get(`load('ins_cp_index', []).some(id => (load(id, {}) || {}).label === '서버에서 받기 전')`), '되돌리기 직전 상태는 체크포인트로 남김');
r = await A.run('syncNow()');
ok(r.ok && JSON.parse(S.dataFile().content).contracts.length === 10, '되돌린 뒤 동기화 정상');
ok(/pullFromServer\(\)/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').match(/<details class="more-menu hdr-menu">[\s\S]*?<\/details>/)[0]), '⚙️ 관리 메뉴에 "서버 데이터로 되돌리기"');

console.log('D) 서버 백업: 줄어드는 저장 직전엔 항상 백업 · 목록 · 날짜별 되돌리기');
const bfolder = () => { const r0 = S.ROOT.folders.find(f => f.name === '보험관리툴'); return r0 && r0.folders.find(f => f.name === '백업'); };
const nBackups = () => (bfolder() ? bfolder().files.filter(f => !f.trashed).length : 0);
const b0 = nBackups();
A.run(`CONTRACTS = CONTRACTS.filter(c => c.id !== 10); persistLocal();`);
r = await A.run('syncNow()');
ok(r.ok && bfolder().files.some(f => !f.trashed && /_줄어들기전\.json$/.test(f.name)) && nBackups() > b0, '계약이 줄어드는 저장(10→9건) 직전 상태가 "줄어들기전" 백업으로 남음');
const lb = S.post({ action: 'listBackups', key: S.KEY });
ok(lb.ok && lb.backups.length >= 1 && lb.backups.some(b => b.contracts === 10), '백업 목록: 날짜·계약 수 (10건짜리 백업 있음)');
ok(S.post({ action: 'listBackups', key: 'wrong' }).ok === false && S.post({ action: 'getBackup', key: S.KEY, name: '../보험관리툴_데이터.json' }).ok === false, '비밀 키 없거나 이상한 이름이면 거절');
await A.run('openServerSettings(); loadServerBackups()');
ok(/이 백업으로 되돌리기/.test(A.el('srv-backups').innerHTML), '서버 설정 창에 날짜별 백업 목록');
const name10 = lb.backups.find(b => b.contracts === 10).name;
A.confirmQ.push(true);
const rb = await A.run(`restoreServerBackup(${JSON.stringify(name10)})`);
ok(rb === true && A.get('CONTRACTS.length') === 10 && JSON.parse(S.dataFile().content).contracts.length === 10, '그 백업으로 이 기기·서버 모두 되돌림 (계약 10건)');
ok(bfolder().files.some(f => !f.trashed && /_복원전\.json$/.test(f.name)), '되돌리기 직전 서버 상태도 "복원전" 백업으로 남음');
ok(A.get(`load('ins_daily_index', []).length`) >= 1, '동기화 성공 뒤 하루 자동 백업이 이 기기에 남음');

console.log(`\n데이터 보호 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
