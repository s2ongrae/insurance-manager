// 동기화 안전: 두 기기 동시 추가 · 저장 실패 후 재시도 · 저장 공간 가득 참 · 복원 되살아남 (2026-11-15 전체 점검에서 재현된 문제)
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const SID = 'AKfycbSYNCSAFETYTEST12345', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = i => ({ id: i, pid: 'pid_p' + i, s: '계약완료', d: '25.01.01', c: '고객' + i, p: '고객' + i, co: '가', n: '보험' + i, pr: 1, g: '지인' });
const contracts = Array.from({ length: 10 }, (_, i) => C(i + 1));

function setup(extra) {
  const S = makeServer(); let hook = null, failSave = false;
  const route = async (u, o) => {
    const b = JSON.parse(o.body);
    if (b.action === 'save' && hook) { const h = hook; hook = null; h(); }
    if (b.action === 'save' && failSave) { failSave = false; throw new Error('network'); }
    return { status: 200, json: async () => S.post(o.body) };
  };
  const ls = Object.assign({ ins_monthly: '[]', ins_groups: '{}', ins_server_url: URL1, ins_server_key: S.KEY }, extra || {});
  const dev = more => makeDevice({ ls: Object.assign({}, ls, more || {}), session: { ins_unlocked: '1' }, fetch: route });
  const cur = () => JSON.parse(S.dataFile().content);
  const other = fn => { const d = cur(); fn(d); return S.post(JSON.stringify({ action: 'save', key: S.KEY, baseRev: d.rev, data: d })); };
  return { S, route, dev, cur, other, setHook: h => { hook = h; }, failNextSave: () => { failSave = true; } };
}

(async () => {
console.log('A) 두 기기가 동시에 새 계약을 넣어도 둘 다 남음');
{ const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts) }); await sleep(150); await A.run('syncNow()');
  const B = T.dev(); await sleep(150); await B.run('syncNow()');
  ok(B.get('CONTRACTS.length') === 10, 'B 가 10건을 받음');
  A.run('Math.random=()=>0.11'); B.run('Math.random=()=>0.42');
  const ia = A.get('newContractId()'), ib = B.get('newContractId()');
  ok(ia !== ib && ia > 10 && ib > 10, `두 기기의 새 번호가 다름 (${ia} / ${ib})`);
  ok(Number.isSafeInteger(ia) && Number.isSafeInteger(ib), '새 번호는 안전한 정수 범위');
  A.run(`CONTRACTS.push(Object.assign({}, ${JSON.stringify(C(0))}, {id:${ia}, pid:'pid_new_a', c:'김A', p:'김A'})); MEMOS[${ia}]='A 메모'; persistLocal();`);
  B.run(`CONTRACTS.push(Object.assign({}, ${JSON.stringify(C(0))}, {id:${ib}, pid:'pid_new_b', c:'박B', p:'박B'})); MEMOS[${ib}]='B 메모'; persistLocal();`);
  await A.run('syncNow()'); await B.run('syncNow()');
  const sv = T.cur();
  ok(sv.contracts.some(c => c.c === '김A') && sv.contracts.some(c => c.c === '박B') && sv.contracts.length === 12, '서버에 김A·박B 둘 다 있음 (12건)');
  ok(sv.memos[ia] === 'A 메모' && sv.memos[ib] === 'B 메모', '메모도 각자 계약에 붙어 있음');
  ok(A.get('newContractId()') !== A.get('newContractId()'), '한 기기에서 연속으로 만들어도 번호가 겹치지 않음');
}

console.log('B) 저장 중 다른 기기가 먼저 저장(충돌)해도 그 기기의 최신 값을 덮어쓰지 않음');
{ const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts) }); await sleep(150); await A.run('syncNow()');
  T.other(d => { d.contracts.find(c => c.id === 5).pr = 111; });          // 기기 B: 111
  A.run(`CONTRACTS.find(c=>c.id===1).pr=999; persistLocal();`);            // A 자신의 수정
  T.setHook(() => T.other(d => { d.contracts.find(c => c.id === 5).pr = 222; }));   // A 가 받은 뒤·저장 전에 기기 C: 222
  const r = await A.run('syncNow()');
  ok(r.ok, '동기화 성공');
  ok(T.cur().contracts.find(c => c.id === 5).pr === 222, '기기 C 의 최신 값 222 유지 (예전엔 111 로 덮어씀)');
  ok(T.cur().contracts.find(c => c.id === 1).pr === 999, 'A 자신의 수정은 반영');
}

console.log('C) 저장이 인터넷 오류로 실패해도, 나중에 다른 기기 값을 되돌리지 않음');
{ const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts) }); await sleep(150); await A.run('syncNow()');
  T.other(d => { d.contracts.find(c => c.id === 5).pr = 111; });
  A.run(`CONTRACTS.find(c=>c.id===1).pr=999; persistLocal();`);
  T.failNextSave();
  const r1 = await A.run('syncNow()'); ok(!r1.ok, '첫 동기화는 인터넷 오류로 실패');
  T.other(d => { d.contracts.find(c => c.id === 5).pr = 222; });          // 몇 시간 뒤 다른 기기: 222
  const r2 = await A.run('syncNow()'); ok(r2.ok, '다음 동기화 성공');
  ok(T.cur().contracts.find(c => c.id === 5).pr === 222, '다른 기기의 222 유지 (예전엔 111 로 되돌림)');
  ok(T.cur().contracts.find(c => c.id === 1).pr === 999, 'A 의 수정은 결국 반영');
}

console.log('D) 이 기기 저장 공간이 가득 차도, 다시 열었을 때 서버를 옛 값으로 되돌리지 않음');
{ const cov = Object.fromEntries(contracts.map(c => [c.pid, { policies: [{ id: c.id, items: [{ name: '암', amount: 1000 }] }] }]));
  const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts), ins_coverages: JSON.stringify(cov) }); await sleep(150); await A.run('syncNow()');
  const orig = A.ctx.localStorage.setItem; A.ctx.localStorage.setItem = (k, v) => { if (k === 'ins_coverages') throw new Error('QuotaExceededError'); return orig(k, v); };
  A.run(`COVERAGES.pid_p1.policies[0].items[0].amount=5000; saveCoverages();`);
  const r = await A.run('syncNow()');
  ok(r.ok && T.cur().coverages.pid_p1.policies[0].items[0].amount === 5000, '서버에는 5000 저장');
  ok(A.get('LOCAL_SAVE_FAILED') === true, '이 기기 저장 실패를 알아챔');
  const A2 = makeDevice({ ls: Object.fromEntries(A.store), session: { ins_unlocked: '1' }, fetch: T.route }); await sleep(200);
  await A2.run('syncNow()');
  ok(T.cur().coverages.pid_p1.policies[0].items[0].amount === 5000, '다시 열고 동기화해도 서버 5000 유지 (예전엔 1000 으로 되돌림)');
  ok(A2.get('COVERAGES.pid_p1.policies[0].items[0].amount') === 5000, '다시 연 기기도 5000 을 받음');
}

console.log('E) 저장 공간이 차면 오래된 체크포인트를 지우고 다시 저장');
{ const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts) }); await sleep(150);
  A.run(`saveCheckpoint('테스트1'); saveCheckpoint('테스트2');`);
  ok(A.get('listCheckpoints().length') >= 2, '체크포인트 2개 이상');
  const orig = A.ctx.localStorage.setItem; let full = true;
  A.ctx.localStorage.setItem = (k, v) => { if (k === 'ins_contracts' && full && A.store.has('ins_cp_index') && JSON.parse(A.store.get('ins_cp_index')).length) throw new Error('QuotaExceededError'); return orig(k, v); };
  ok(A.get(`save('ins_contracts', CONTRACTS)`) === true, '체크포인트를 비우고 다시 저장 성공');
  ok(A.get('listCheckpoints().length') === 0, '체크포인트를 비움');
}

console.log('F) 복원한 뒤 다른 기기가 동기화해도 복원이 되돌아가지 않음');
{ const T = setup();
  const A = T.dev({ ins_contracts: JSON.stringify(contracts) }); await sleep(150); await A.run('syncNow()');
  const B = T.dev(); await sleep(150); await B.run('syncNow()');
  const small = { contracts: contracts.slice(0, 3), monthly: [], groups: {}, coverages: {}, memos: {}, shares: {}, settings: {}, reminders: {} };
  A.run(`applyData(normalizeData(${JSON.stringify(small)}))`);
  ok(await A.run(`forcePushLocal('복원')`), '복원 저장 성공');
  ok(T.cur().contracts.length === 3, '서버 3건');
  ok(Object.keys(T.cur().tombstones.contracts || {}).length === 7, '복원에 없는 7건의 삭제 기록이 서버에 남음');
  const r = await B.run('syncNow()');
  ok(r.ok && T.cur().contracts.length === 3 && B.get('CONTRACTS.length') === 3, '다른 기기가 동기화해도 3건 그대로 (예전엔 11건으로 되살아남)');
  // 복원한 데이터에 다시 있는 항목은 삭제 기록에서 빠짐
  A.run(`applyData(normalizeData(${JSON.stringify({ ...small, contracts: contracts.slice(0, 5) })}))`);
  await A.run(`forcePushLocal('복원2')`);
  const t = T.cur().tombstones.contracts || {};
  ok(!t['4'] && !t['5'] && t['6'], '다시 넣은 4·5번은 삭제 기록에서 빠지고 6번은 남음');
}

console.log(`\n동기화 안전 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
})();
