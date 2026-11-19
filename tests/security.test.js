// 보안·개인정보 (2026-11-15 전체 점검): 고객 화면 스크립트 주입 · 계약자/가족 이름 노출 · 서버 응답 최소화 · 관리 화면 이스케이프
const fs = require('fs'), vm = require('vm'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const X = '<img src=x onerror=alert(1)>';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
console.log('A) 고객 링크: 서버(가짜 서버 포함) 응답의 글자가 코드로 실행되지 않고, 계약자·다른 가족 이름이 안 보임');
{ const resp = { ok: true, key: 'pid_aa', name: '홍길동',
    contracts: [{ id: 1, s: '계약완료', p: '홍길동', pid: 'pid_aa', co: '삼성', n: 'A', pr: 1 }],
    coverages: { pid_aa: { policies: [{ id: 1, items: [{ name: '암', amount: 10 }, { name: '특약' + X, amount: 2 }],
      bm: { total: X, paid: X, holder: '아버지김계약', insured: '홍길동', extra: [{ name: '아내의특약', amount: 5, who: '배우자이름' }, { name: '만기된특약', amount: 3, st: '만기' }] } }] } },
    settings: { covGroups: { list: [{ label: '암' + X, color: '#111111' }, { label: '기타', color: '#222222' }] } } };
  const D = makeDevice({ hash: '#view=x&t=tok&s=AKfycbXXXXXXXXXXXXXXXXXXXXXX', fetch: async () => ({ json: async () => resp }) });
  await sleep(300);
  const h = D.bodyHtml;
  ok(D.errors.length === 0 && h.includes('cv-screen'), '고객 화면이 열림 ' + D.errors.join('|'));
  ok(!h.includes(X) && !/<img src=x/.test(h), '납입 횟수 칸의 글자가 태그로 실행되지 않음');
  ok(!h.includes('아버지김계약'), '계약자 이름이 고객 화면에 안 보임');
  ok(!h.includes('배우자이름') && !h.includes('아내의특약'), '다른 가족의 이름·특약이 고객 화면에 안 보임');
  ok(h.includes('만기된특약'), '본인의 만기 특약은 그대로 보임');
  ok(!h.includes(X) && !/<img src=x/.test(h), '담보 이름·담보 그룹 이름의 글자도 태그로 실행되지 않음');
  ok(h.includes('특약&lt;img') || h.includes('특약<img'), '이름은 글자로는 그대로 보임');
}

console.log('B) 서버 고객 응답은 필요한 칸만');
{ const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  const T = 'a'.repeat(48);
  const snap = { beforeTotal: 1, afterTotal: 2, items: [], policies: [] };
  const mk = cs => ({ contracts: [{ id: 1, s: '계약완료', p: '홍', pid: 'pid_aa', c: '계약자아빠', g: 'VIP', co: '삼성', n: 'A', pr: 1, proposalUrl: 'https://drive.google.com/file/d/1/view' }],
    memos: { 1: '내부메모' }, reminders: { r: { memo: '알림메모' } }, shares: { pid_aa: T },
    coverages: { pid_aa: { policies: [{ id: 1, items: [{ name: '암', amount: 10, aiRaw: '원문' }], bm: { holder: '계약자아빠', total: 240, extra: [{ name: 'x', who: '배우자' }] } }],
      externalPolicies: [{ id: -1, co: 'DB', n: '실손', pr: 2, items: [{ name: '실손', amount: 5000 }], proposalUrl: 'javascript:alert(1)', memo: '외부메모' }],
      matrixView: { 암: { __group: 'G' } }, remodel: { roles: { r1: 'before' } }, compareShare: cs,
      bomapp: { plannerMemberId: 77, memberId: 9 }, person: { name: '홍', birth: '1990.01.02', gender: 'M' } } },
    settings: { covGroups: { list: [] }, bomapp: { reportPw: '1234' } } });
  const run = data => {
    const ctx = { Utilities: { sleep() {} }, PropertiesService: {}, LockService: {}, DriveApp: {}, MimeType: {}, ContentService: {} };
    vm.createContext(ctx);
    vm.runInContext(src + ';getDataFile=()=>({getBlob:()=>({getDataAsString:()=>' + JSON.stringify(JSON.stringify(data)) + '})});', ctx);
    ctx.__b = { token: T }; return vm.runInContext('getCustomerView(__b)', ctx);
  };
  const r = run(mk({ make: true, on: false, note: '공개전초안' })), s = JSON.stringify(r);
  ok(r.ok && r.coverages.pid_aa.policies[0].items[0].name === '암', '응답은 정상');
  for (const w of ['계약자아빠', '내부메모', '알림메모', '공개전초안', 'remodel', 'plannerMemberId', '1990.01.02', '배우자', 'reportPw', 'VIP', 'aiRaw', '외부메모', 'javascript:'])
    ok(!s.includes(w), `"${w}" 가 고객 응답에 없음`);
  ok(r.coverages.pid_aa.externalPolicies[0].items[0].amount === 5000 && r.coverages.pid_aa.matrixView.암.__group === 'G', '외부 보험 담보·표 수정값·그룹은 그대로');
  ok(r.coverages.pid_aa.policies[0].bm.total === 240 && r.coverages.pid_aa.person.name === '홍', '납입 정보·이름은 그대로');
  const r2 = run(mk({ make: true, on: true, note: '공개한한마디', snap }));
  ok(r2.coverages.pid_aa.compareShare && r2.coverages.pid_aa.compareShare.note === '공개한한마디' && r2.coverages.pid_aa.compareShare.snap.afterTotal === 2, '고객 공개를 켠 비교 분석은 그대로 전달');
}

console.log('C) 관리 화면: 그룹 이름·색, 고객별·월별 탭, 보맵 납입기간');
{ const C = [{ id: 1, s: '계약완료', d: '26.01.01', c: '고객' + X, p: '홍', co: '보험사' + X, n: '상품' + X, pr: 1000, g: 'VIP' + X },
             { id: 2, s: '계약완료', c: "따옴표'\"이름", p: '김', co: 'A', n: 'B', pr: 1, g: '일반' }];
  const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify(C), ins_monthly: JSON.stringify([{ m: '26.01', k: X, before: 0, after: 0, tax: 0, memo: '' }]),
    ins_groups: JSON.stringify({ ['VIP' + X]: 'red;" onmouseover="alert(2)', 일반: '#3B5BDB' }) } });
  ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  D.run("renderTab('리스트')"); const lr = D.el('list-results').innerHTML;
  ok(!lr.includes(X) && !/onmouseover="alert/.test(lr), '계약 리스트: 그룹 이름·색이 코드로 안 들어감');
  D.run("expandedCustomer=peopleList().find(p=>p.cs.some(r=>r.c==='고객'+" + JSON.stringify(X) + ")).pid; renderTab('고객별')"); const cr = D.el('pane-고객별').innerHTML;
  ok(!cr.includes(X) && /고객&lt;img/.test(cr) && /data-pid="pid_/.test(cr), '고객별 탭: 이름·보험사·상품명 이스케이프, 펼치기는 이름이 아니라 data-pid 로');
  ok(!/⚠️ 오류/.test(cr), '가입일이 빈 계약이 있어도 고객별 탭이 오류로 바뀌지 않음');
  ok(!/onclick="toggleCustomerDetail\('/.test(cr), '고객 이름을 onclick 코드 글자에 넣지 않음');
  D.run("expandedMonth='26.01'; renderTab('월별')"); const mr = D.el('pane-월별').innerHTML;
  ok(!mr.includes(X), '월별 탭: 건수·계약 정보 이스케이프');
  D.run('populateGroupDropdown()'); ok(!D.el('f-group').innerHTML.includes(X), '그룹 선택 목록 이스케이프');
  ok(D.get(`bmPayPeriod({paymentYears:'" autofocus onfocus="alert(1)" x="'})`) === '' && D.get(`bmPayPeriod({paymentYears:20})`) === '20년납', '보맵 납입기간은 숫자만');
  ok(D.get(`gc('VIP'+${JSON.stringify(X)})`) === '#868E96', '이상한 그룹 색은 기본색으로');
}

console.log('D) PIN 을 풀기 전에는 고객 데이터를 화면에 그리지 않음');
{ const C = [{ id: 1, s: '계약완료', d: '26.01.01', c: '잠금뒤고객', p: '잠금뒤고객', co: 'A', n: 'B', pr: 1000, g: '' }];
  const D = makeDevice({ ls: { ins_contracts: JSON.stringify(C), ins_monthly: '[]', ins_groups: '{}' } });
  await sleep(150);
  ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  ok(!D.el('list-results').innerHTML.includes('잠금뒤고객') && D.el('app-wrap').style.display !== 'block', '잠금 상태: 계약 목록이 그려지지 않고 화면도 숨김');
  D.run('renderAll()'); ok(!D.el('list-results').innerHTML.includes('잠금뒤고객'), '잠금 상태에서 동기화 등으로 renderAll 이 불려도 그리지 않음');
  D.run('unlock()');
  ok(D.el('list-results').innerHTML.includes('잠금뒤고객') && D.el('app-wrap').style.display === 'block', 'PIN 을 풀면 그때 그림');
}

console.log('E) 고객 응답 필드 격리 (2026-11-17 전수 점검): 다른 고객·다른 설정이 섞이지 않는지');
{ const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  const TOK_A = 'a'.repeat(48), TOK_B = 'b'.repeat(48), TOK_NAME = 'c'.repeat(48);
  const run = (data, body) => {
    const ctx = { Utilities: { sleep() {} }, PropertiesService: {}, LockService: {}, DriveApp: {}, MimeType: {}, ContentService: {} };
    vm.createContext(ctx);
    vm.runInContext(src + ';getDataFile=()=>({getBlob:()=>({getDataAsString:()=>' + JSON.stringify(JSON.stringify(data)) + '})});', ctx);
    ctx.__b = body; return vm.runInContext('getCustomerView(__b)', ctx);
  };
  // 같은 이름("같은이름")을 쓰는 두 사람: 옛 기록(번호 없음)과 새 고객(번호 있음)
  const twoPeople = {
    contracts: [
      { id: 1, s: '계약완료', p: '같은이름', c: '같은이름', co: 'A', n: '옛계약', pr: 1000 },
      { id: 2, s: '계약완료', p: '같은이름', pid: 'pid_newone', c: '다른사람', co: 'B', n: '새계약', pr: 2000 }],
    monthly: [], groups: {}, memos: { 1: '메모1', 2: '메모2' }, reminders: {},
    coverages: { '같은이름': { policies: [{ id: 1, items: [{ name: '암', amount: 1 }] }] },
                 pid_newone: { policies: [{ id: 2, items: [{ name: '뇌', amount: 2 }] }], person: { name: '같은이름', birth: '1990.01.02' } } },
    shares: { '같은이름': TOK_NAME, pid_newone: TOK_B, pid_other: TOK_A },
    settings: { covGroups: { list: [{ label: '암', color: '#111111' }] }, bomapp: { reportPw: 'pw' }, aiKeys: { gemini: 'g' }, foo: 'bar' },
    tombstones: { contracts: { 9: '2026-01-01T00:00:00Z' } } };
  const rName = run(twoPeople, { token: TOK_NAME, name: '같은이름' });
  ok(rName.ok && rName.contracts.map(c => c.id).join() === '1', '이름 열쇠(옛 링크)로는 번호가 붙은 다른 사람의 계약이 안 나옴 — ' + JSON.stringify((rName.contracts || []).map(c => c.id)));
  const rB = run(twoPeople, { token: TOK_B, name: '다른이름' });
  ok(rB.ok && rB.contracts.map(c => c.id).join() === '2' && rB.name === '같은이름', '번호 열쇠는 그 사람 계약만, 이름은 서버 값 (링크의 name 은 표시용)');
  const rA = run(twoPeople, { token: TOK_A });
  ok(rA.ok && rA.contracts.length === 0 && rA.coverages.pid_other && rA.coverages.pid_other.policies.length === 0, '아무 기록 없는 고객 토큰은 빈 결과');
  ok(Object.keys(rA).sort().join() === 'contracts,coverages,key,name,ok,settings', '고객 응답 칸은 정해진 6개뿐 — ' + Object.keys(rA).sort().join());
  ok(Object.keys(rB.settings).join() === 'covGroups' && Object.keys(rB.coverages.pid_newone).every(k => !['person', 'bomapp', 'remodel', 'compareShare'].includes(k) || k === 'person'), 'settings 는 담보 그룹만 (보맵 비밀번호·AI 키·기타 설정 안 감)');
  ok(rB.coverages.pid_newone.person.name === '같은이름' && !JSON.stringify(rB).includes('1990.01.02'), '사람 이름만 가고 생년월일은 안 감');
  ok(!JSON.stringify(rB).includes('메모2') && !JSON.stringify(rB).includes('2026-01-01'), '메모·삭제 기록은 안 감');
  ok(run(twoPeople, { token: 'x'.repeat(48) }).ok === false && run(twoPeople, { token: '' }).ok === false, '없는 토큰·빈 토큰은 거절');
  const shortTok = Object.assign({}, twoPeople, { shares: { pid_short: 's'.repeat(20) } });
  ok(run(shortTok, { token: 's'.repeat(20) }).ok === false, '짧은 토큰(32자 미만)은 맞아도 거절');
  const protoTok = Object.assign({}, twoPeople, { shares: JSON.parse('{"__proto__":"' + TOK_A + '","pid_newone":"' + TOK_B + '"}') });
  ok(run(protoTok, { token: TOK_A }).ok === false, '__proto__ 같은 열쇠는 토큰으로 안 받음');
  const pending = Object.assign({}, twoPeople, { contracts: [{ id: 3, s: '가입 예정', p: '같은이름', pid: 'pid_newone', co: 'C', n: '예정', pr: 1 }] });
  ok(run(pending, { token: TOK_B }).contracts.length === 0, '가입 예정 계약은 고객 화면에 안 감 (계약완료만)');
}

console.log('F) 관리 화면: 고객 링크 토큰 재발급·폐기 (서버 가짜 환경)');
{ const makeServer = require('./lib/ins_fake_server.js');
  const S = makeServer();
  const SID = 'AKfycbSHARETEST1234567890abcdef', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
  const C = (id, pid) => ({ id, pid, p: '가나' + id, c: '가나' + id, s: '계약완료', d: '26.01.01', co: 'A', n: 'B' + id, pr: 1000, g: '' });
  const contracts = [C(1, 'pid_aa'), C(2, 'pid_bb')];
  let failSave = false;
  const route = async (u, o) => { const b = JSON.parse(o.body); if (failSave && b.action === 'save') return { json: async () => ({ ok: false, error: '서버 오류' }) }; return { json: async () => S.post(o.body) }; };
  const D = makeDevice({ ls: { ins_contracts: JSON.stringify(contracts), ins_monthly: '[]', ins_groups: '{}', ins_coverages: '{}', ins_server_url: URL1, ins_server_key: S.KEY }, session: { ins_unlocked: '1' }, fetch: route });
  await sleep(120);
  const link = D.run('buildShareLink("pid_aa")');
  const tok1 = D.get('SHARES["pid_aa"]');
  ok(/^[0-9a-f]{48}$/.test(tok1), '토큰은 48자리 무작위 16진수');
  ok(link.includes('#view=') && link.includes('&t=' + tok1) && link.includes('&s=' + SID), '링크 모양: #view=이름 & t=토큰 & s=서버ID');
  D.run('buildShareLink("pid_aa")');
  ok(D.get('SHARES["pid_aa"]') === tok1, '링크 복사는 토큰을 새로 만들지 않음 (같은 링크)');
  D.run('buildShareLink("pid_aa", true)');
  const tok2 = D.get('SHARES["pid_aa"]');
  ok(tok2 !== tok1 && /^[0-9a-f]{48}$/.test(tok2) && !JSON.stringify(D.get('SHARES')).includes(tok1), '재발급하면 토큰이 바뀌고 옛 토큰은 사라짐');
  ok(D.get('Object.keys(SHARES).includes("pid_bb")') === false, '재발급은 그 고객만 (다른 고객 토큰은 그대로)');
  // 서버에 토큰 등록 → 고객 링크가 실제로 열리는지
  let r = await D.run('syncNow()');
  const sharesOnServer = () => JSON.parse(S.dataFile().content).shares || {};
  ok(r.ok && sharesOnServer().pid_aa === tok2, '동기화하면 토큰이 서버에 올라감');
  ok(S.post({ action: 'getCustomerView', token: tok2 }).ok === true, '그 토큰으로 고객 링크가 열림');
  failSave = true; D.clip = null;
  await D.run('copyShareLink("pid_bb")');
  ok(D.clip === null, '서버에 등록 실패하면 링크를 복사하지 않음 (죽은 링크를 고객에게 주지 않음)');
  failSave = false; D.clip = null;
  await D.run('copyShareLink("pid_bb")');
  ok(D.clip && D.clip.includes('#view='), '서버 등록이 되면 그때 클립보드로 복사');
  // 폐기: 링크를 없애면 서버에서도 사라져 그 링크가 안 열려야 함
  ok(D.get('typeof revokeShareLink') === 'function', '고객 링크 폐기 함수가 있음');
  D.confirmQ.push(true);
  r = await D.run('revokeShareLink("pid_bb")');
  ok(r === true && D.get('Object.keys(SHARES).includes("pid_bb")') === false, '폐기하면 이 기기에서 토큰이 사라짐');
  ok(!(sharesOnServer().pid_bb), '폐기한 토큰은 서버에도 안 남음 (다른 기기가 되살리지 않음)');
  D.confirmQ.push(false);
  await D.run('revokeShareLink("pid_aa")');
  ok(D.get('SHARES["pid_aa"]') === tok2 && sharesOnServer().pid_aa === tok2, '취소하면 폐기되지 않음');
  ok(/revokeShareLink/.test(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').match(/<details class="more-menu">[\s\S]*?<\/details>/)[0]), '고객 링크 폐기 버튼이 ⋯ 더보기 메뉴에 있음');
}

console.log(`\n보안 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
})();
