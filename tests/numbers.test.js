// 숫자·화면 (2026-11-15 점검 4순위): 고객 화면 중복 합산 · 합쳐진 칸 편집 · 금액 읽기 · 날짜 형식 · 특약 알림
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_t';
const seed = (cov, extra) => makeDevice({ session: { ins_unlocked: '1' }, ls: Object.assign({
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '다라생명', n: '내계약', s: '계약완료', d: '25.01.01', pr: 50000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: cov }), ins_monthly: '[]', ins_groups: '{}' }, extra || {}) });
const pad = n => String(n).padStart(2, '0');
const dayAfter = n => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const twoExt = { covNameVer: 4, policies: [{ id: 1, items: [] }], externalPolicies: [
  { id: -1, co: '마바손보', n: '외부보험', pr: 1, items: [{ name: '골절 진단비', amount: 1000, unit: '만원' }] },
  { id: -2, co: '마바손보', n: '외부보험', pr: 1, items: [{ name: '골절 진단비', amount: 500, unit: '만원' }] }] };
const adminSum = D => { const m = D.el('cov-detail').innerHTML.match(/mtx-sum-n">골절 진단비[\s\S]*?mtx-sum-v[^>]*>([^<]*)/); return m && m[1]; };

console.log('A) 같은 보험사·상품명 보험이 둘이어도 고객 화면 합계가 관리 화면과 같음');
{ const D = seed(twoExt); ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  D.run(`renderCovDetail('${P}')`); ok(adminSum(D) === '1천5백만원', '관리 화면 1천5백만원');
  D.run(`showCustomerView('${P}','')`); const c = D.bodyHtml;
  const card = c.slice(c.indexOf('cv-row-name">골절 진단비'), c.indexOf('cv-row-name">골절 진단비') + 200);
  ok(/1천5백만원/.test(card) && !/3천만원/.test(card), '고객 화면 카드도 1천5백만원 (예전엔 3천만원)');
  ok(!/마바손보 1천5백만원 · 마바손보 1천5백만원/.test(c), '같은 보험이 두 번 적히지 않음');
}

console.log('B) 합쳐진 칸을 눌렀다 그냥 나가도 금액이 줄지 않음, 시작값은 두 보험의 합');
{ const D = seed(twoExt); D.run(`renderCovDetail('${P}')`);
  D.run(`var __td={dataset:{cust:'${P}',polid:'-1',idx:'0',norm:encodeURIComponent('골절 진단비'),polkey:encodeURIComponent('마바손보'+String.fromCharCode(10)+'외부보험'),mode:'edit'},innerHTML:'',appendChild(x){this.inp=x;}}; inlineEditCell(__td)`);
  ok(D.get('__td.inp.value') == 1500, '편집 칸 시작값 1500 (예전엔 첫 보험의 1000)');
  D.run('__td.inp.onblur()');
  ok(adminSum(D) === '1천5백만원' && !D.get(`!!(COVERAGES['${P}'].matrixView||{})['골절 진단비']`), '그냥 나가면 저장 안 함 (그대로 1천5백만원)');
  D.run(`renderCovDetail('${P}'); inlineEditCell(__td); __td.inp.value='2000'; __td.inp.onblur()`);
  ok(adminSum(D) === '2천만원', '값을 바꾸면 그 값으로');
}

console.log('C) 외부 보험 금액: 쉼표·억·천만·만·원 단위를 만원으로');
{ const D = seed({ policies: [] });
  const t = { '3000': 3000, '3,000': 3000, '1억': 10000, '1억5천': 15000, '5천만원': 5000, '300만': 300, '30000000원': 3000, '0.5': 0.5 };
  ok(Object.entries(t).every(([s, v]) => D.get(`parseManWon(${JSON.stringify(s)})`) === v), '단위별로 바르게 (3,000→3000, 1억→10000, 5천만원→5000 …)');
  ok(D.get(`isNaN(parseManWon('abc')) && isNaN(parseManWon(''))`), '숫자가 아니면 금액 없음');
  ['ext-customer', 'ext-co', 'ext-name', 'ext-pr', 'ext-pay', 'ext-cov', 'ext-renew', 'ext-pn', 'ext-items'].forEach(id => { D.el(id).value = ''; });
  D.el('ext-customer').value = P; D.el('ext-co').value = 'X화재'; D.el('ext-name').value = 'Y종합';
  D.el('ext-items').value = '암진단비 3,000\n뇌졸중진단비 1억\n골절진단비 5천만원\n메모만';
  D.run('saveExternalInsurance()');
  const its = D.get(`COVERAGES['${P}'].externalPolicies[0].items.map(i=>[i.name,i.amount])`);
  ok(JSON.stringify(its) === JSON.stringify([['암진단비', 3000], ['뇌졸중진단비', 10000], ['골절진단비', 5000], ['메모만', 0]]), '저장된 금액 ' + JSON.stringify(its));
}

console.log('D) 가입일: 다른 형식은 YY.MM.DD 로 맞추고, 없는 날짜는 막음');
{ const D = seed({ policies: [] });
  const fill = d => { D.run('openAddModal()'); D.el('f-status').value = '계약완료'; D.el('f-date').value = d; D.el('f-holder').value = '새고객'; D.el('f-insured').value = '새고객';
    D.el('f-co').value = 'A'; D.el('f-name').value = 'B'; D.el('f-price').value = '1000'; D.el('f-group').value = '지인'; D.el('contract-memo').value = ''; };
  fill('2026-11-02'); D.confirmQ.push(true); D.run('saveContract()');
  ok(D.get(`CONTRACTS.some(c=>c.c==='새고객' && c.d==='26.11.02')`), '"2026-11-02" → "26.11.02" 로 저장');
  ok(!D.get(`MONTHLY.some(m=>m.m==='2026-')`), '월별 실적에 "2026-" 줄이 생기지 않음');
  const n = D.get('CONTRACTS.length');
  fill('26.13.40'); D.run('saveContract()');
  ok(D.get('CONTRACTS.length') === n, '없는 날짜(26.13.40)는 저장하지 않음');
}

console.log('E) 특약 자동 알림: 사람을 옮겨도 지운 알림이 다시 안 생기고, 확인 안 한 만기 알림은 남음');
{ const rider = (id, name, until) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: until, insuredName: '', contractStatus: '정상', isMyContract: true });
  const pol = id => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', subscriberName: '홍', primaryInsuredName: '홍', isPrimaryInsuredMyself: true,
    issueDate: '2020-01-01', maturityDate: '2045-01-01', isRenewal: false, monthlyPaymentAmount: 1000 + id, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '수술비' + id, dayAfter(40))] });
  const D = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
  D.ctx.__f = { source: 'bomapp-planner', customers: [{ memberId: 9, name: '홍', policies: [pol(1), pol(2)] }] };
  D.run('importBomappData(__f);saveCoverages();renderAll()');
  const autos = D.get('Object.values(REMINDERS).filter(x=>x.auto&&!x.off)'); ok(autos.length === 2, '자동 알림 2개');
  const del = autos.find(x => x.memo.includes('수술비2')); D.confirmQ.push(true); D.run(`deleteReminder(${JSON.stringify(del.id)})`); D.run('renderAll()');
  const pid = D.get('peopleList()[0].pid');
  D.promptQ.push('2', '딸'); D.run(`splitPerson('${pid}')`); D.run('renderAll()');
  const vis = D.get('reminderBuckets().due.concat(reminderBuckets().soon).map(x=>x.memo)');
  ok(!vis.some(m => m.includes('수술비2')), '보험2를 딸로 분리해도 지운 수술비2 알림이 다시 안 생김');
  ok(vis.some(m => m.includes('수술비1')), '다른 알림은 그대로');
  // 예전 번호(가입자 번호가 들어간)로 지워 둔 알림도 이어받음
  const D2 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
  D2.ctx.__f = D.ctx.__f; D2.run('importBomappData(__f);saveCoverages()');
  const p2 = D2.get('peopleList()[0].pid');
  const legacy = D2.get(`Object.values(riderReminderTargets()).find(x=>x.memo.includes('수술비1')).legacyId`);
  D2.run(`REMINDERS={}; REMINDERS[${JSON.stringify(legacy)}]={id:${JSON.stringify(legacy)},date:'2026-01-01',until:'2030-01-01',memo:'옛',done:true,off:true,auto:'rider'}; renderAll()`);
  ok(!D2.get('reminderBuckets().due.concat(reminderBuckets().soon).map(x=>x.memo)').some(m => m.includes('수술비1')) && p2, '예전 번호로 지워 둔 알림은 새 번호로 바뀌어도 지운 상태 유지');
  // 만기일이 지난, 확인 안 한 알림
  const D3 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: '[]', ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}',
    ins_reminders: JSON.stringify({ rauto_x: { id: 'rauto_x', date: dayAfter(-31), until: dayAfter(-1), memo: '특약 만기 지난것', done: false, auto: 'rider' },
                                    rauto_y: { id: 'rauto_y', date: dayAfter(-60), until: dayAfter(-40), memo: '처리한 옛것', done: true, auto: 'rider' },
                                    rauto_z: { id: 'rauto_z', date: dayAfter(10), until: dayAfter(40), memo: '날짜 바뀐 것', done: false, auto: 'rider' } }) } });
  D3.run('renderAll()');
  const ids = D3.get('Object.keys(REMINDERS)');
  ok(ids.includes('rauto_x'), '만기 지난 미확인 알림은 남음 (예전엔 다음 날 사라짐)');
  ok(!ids.includes('rauto_y'), '처리했고 만기 30일 지난 알림은 정리');
  ok(!ids.includes('rauto_z'), '만기 전인데 목록에 없는(갱신돼 날짜가 바뀐) 미확인 알림은 정리');
  ok(D3.get('reminderBuckets().due.some(x=>x.id==="rauto_x")'), '"지금 확인할 것"에 보임');
}

console.log(`\n숫자·화면 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
