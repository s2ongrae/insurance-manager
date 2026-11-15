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
    coverages: { pid_aa: { policies: [{ id: 1, items: [{ name: '암', amount: 10 }],
      bm: { total: X, paid: X, holder: '아버지김계약', insured: '홍길동', extra: [{ name: '아내의특약', amount: 5, who: '배우자이름' }, { name: '만기된특약', amount: 3, st: '만기' }] } }] } },
    settings: {} };
  const D = makeDevice({ hash: '#view=x&t=tok&s=AKfycbXXXXXXXXXXXXXXXXXXXXXX', fetch: async () => ({ json: async () => resp }) });
  await sleep(300);
  const h = D.bodyHtml;
  ok(D.errors.length === 0 && h.includes('cv-screen'), '고객 화면이 열림 ' + D.errors.join('|'));
  ok(!h.includes(X) && !/<img src=x/.test(h), '납입 횟수 칸의 글자가 태그로 실행되지 않음');
  ok(!h.includes('아버지김계약'), '계약자 이름이 고객 화면에 안 보임');
  ok(!h.includes('배우자이름') && !h.includes('아내의특약'), '다른 가족의 이름·특약이 고객 화면에 안 보임');
  ok(h.includes('만기된특약'), '본인의 만기 특약은 그대로 보임');
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
  D.run("expandedCustomer='고객'+" + JSON.stringify(X) + "; renderTab('고객별')"); const cr = D.el('pane-고객별').innerHTML;
  ok(!cr.includes(X) && /data-c="고객&lt;img/.test(cr), '고객별 탭: 이름·보험사·상품명 이스케이프, 이름은 data- 속성');
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

console.log(`\n보안 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
})();
