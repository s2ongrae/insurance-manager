// 🩺 상태 점검: 정상 · 서버 예전 버전 · 이 기기 데이터 줄어듦 · 보장분석 정리 필요 · 결과에 고객 이름 없음 (가짜 데이터만)
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
const SID = 'AKfycbHEALTHTESTHEALTH12345', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = i => ({ id: i, pid: 'pid_h' + i, s: '계약완료', d: '25.01.01', c: '비밀고객' + i, p: '비밀고객' + i, co: '가나생명', n: '보험' + i, pr: 1, g: '지인' });
const contracts = Array.from({ length: 6 }, (_, i) => C(i + 1));
const coverages = Object.fromEntries(contracts.map(c => [c.pid, { policies: [{ id: c.id, items: [{ name: '암진단비', amount: 1000, unit: '만원' }] }] }]));
const byLabel = (rows, l) => rows.find(r => r.label === l) || {};

(async () => {
const S = makeServer();
S.tick(Date.now() - Date.parse('2026-10-13T03:00:00Z'));   // 가짜 서버 시계(2026-10-13 고정)를 지금 시각에 맞춤 → 백업 날짜가 "오늘"
let oldServer = false;
const route = async (u, o) => { const b = JSON.parse(o.body); if (oldServer && (b.action === 'listBackups' || b.action === 'getBackup')) return { status: 200, json: async () => ({ ok: false, error: '알 수 없는 요청이에요.' }) }; return { status: 200, json: async () => S.post(o.body) }; };
const D = makeDevice({ ls: { ins_contracts: JSON.stringify(contracts), ins_coverages: JSON.stringify(coverages), ins_monthly: '[]', ins_groups: '{}', ins_server_url: URL1, ins_server_key: S.KEY }, session: { ins_unlocked: '1' }, fetch: route });
await sleep(150);
await D.run('syncNow()');
D.run(`CONTRACTS = CONTRACTS.map(c => c.id === 1 ? Object.assign({}, c, {pr: 2}) : c); persistLocal();`);
await D.run('syncNow()');   // 두 번째 저장 → 하루 백업이 서버에 생김

console.log('A) 정상');
let rows = await D.run('openHealthCheck()');
ok(byLabel(rows, '서버 연결').st === 'ok' && byLabel(rows, '서버 버전').st === 'ok', '서버 연결·새 버전 확인');
ok(byLabel(rows, '서버 백업').st === 'ok' && /가장 최근/.test(byLabel(rows, '서버 백업').detail), '서버 백업 있음: ' + byLabel(rows, '서버 백업').detail);
ok(byLabel(rows, '이 기기 ↔ 서버').st === 'ok' && /완전히 같음 \(계약 6건/.test(byLabel(rows, '이 기기 ↔ 서버').detail), '이 기기와 서버 완전히 같음');
ok(/서버 데이터/.test(rows.map(r => r.label).join()) && /계약 6건/.test(byLabel(rows, '서버 데이터').detail), '서버 데이터 계약 6건');
ok(byLabel(rows, '보장분석 정리 상태').st === 'ok' && byLabel(rows, '중복 의심 보험').st === 'ok' && byLabel(rows, '담보 이름').st === 'ok', '보장분석: 정리할 것·중복·예전 이름 없음');
ok(!rows.some(r => r.st === 'bad'), '문제 없음');
const text = D.get('window._healthText');
ok(/상태 점검/.test(text) && !/비밀고객/.test(text) && !new RegExp(S.KEY).test(text) && !/script\.google/.test(text), '결과 문장에 고객 이름·비밀 키·서버 주소 없음');

console.log('B) 서버가 예전 버전이면 알려줌');
oldServer = true;
rows = await D.run('healthCheckData()');
ok(byLabel(rows, '서버 버전').st === 'bad' && /다시 배포/.test(byLabel(rows, '서버 버전').detail), '예전 버전 → 재배포 안내');
oldServer = false;

console.log('C) 이 기기 데이터가 크게 줄면 ❌ + 되돌리기 안내');
D.run(`CONTRACTS = CONTRACTS.slice(0, 1); COVERAGES = {pid_h1: COVERAGES.pid_h1};`);
rows = await D.run('healthCheckData()');
ok(byLabel(rows, '이 기기 ↔ 서버').st === 'bad' && /서버 데이터로 되돌리기/.test(byLabel(rows, '이 기기 ↔ 서버').detail), '줄어듦 → ❌ 되돌리기 안내');
D.confirmQ.push(true);
await D.run('pullFromServer()');

console.log('D) 보장분석 정리가 필요하면 ⚠️');
D.run(`COVERAGES['pid_h2'] = Object.assign({}, COVERAGES['pid_h2'], {matrixView: {'암진단비': {'가나생명\\n보험2': 3000}}, covNameVer: 0}); COVERAGES['pid_h3'].externalPolicies = [{id:-1,co:'A',n:'X',pr:1,items:[]},{id:-2,co:'A',n:'X',pr:1,items:[]}];`);
rows = await D.run('healthCheckData()');
ok(byLabel(rows, '담보 이름').st === 'warn' && byLabel(rows, '보장분석 정리 상태').st === 'warn' && byLabel(rows, '중복 의심 보험').st === 'warn', '예전 이름·정리할 것·중복 의심 → ⚠️');
ok(D.get(`'암진단비' in COVERAGES['pid_h2'].matrixView`), '점검은 데이터를 바꾸지 않음');

console.log(`\n상태 점검 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
