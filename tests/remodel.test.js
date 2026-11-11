// 리모델링 비교(기존 → 변경) + 증권번호: 계산 규칙 · 화면 · 저장·동기화 · 고객 화면 차단
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
const SID = 'AKfycbREMODELTESTREMODEL12345', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = (id, x) => Object.assign({ id, s: '계약완료', d: '26.05.01', c: '김철수', p: '홍길동', co: '삼성화재', n: '종합' + id, pr: 10000, g: '지인들' }, x);
const I = (name, amount) => ({ name, amount, unit: '만원', price: 0 });

const contracts = [
  C(1, { co: '삼성화재', n: '리모델 종합', pr: 70000, pn: '1-2345-678901' }),                 // 내가 새로 가입시킨 계약 (계약완료)
  C(2, { s: '계약해지', co: '현대해상', n: '옛 상해', pr: 30000, d: '23.01.01', ed: '26.05.01' }), // 해지한 옛 계약
  C(3, { s: '가입 예정', co: 'KB손해보험', n: '수술비', pr: 10000, d: '26.06.01' }),              // 가입 예정
  C(4, { c: '박문수', p: '이순신', co: '메리츠화재', n: '다른 사람', pr: 99999 })                    // 다른 사람 (섞이면 안 됨)
];
const coverages = { '홍길동': {
  policies: [{ id: 1, items: [I('암진단비', 5000), I('뇌혈관진단비', 2000), I('실손의료비', 1)] },
             { id: 2, items: [I('상해사망', 5000)] },
             { id: 3, items: [I('수술비', 100)] }],
  otherPolicies: [{ id: 'ext_1', co: '라이나생명', name: '옛 암보험', price: 50000, pn: 'L-777', items: [I('암진단비', 3000), I('뇌혈관진단비', 1000)] }],
  externalPolicies: [{ id: -9, co: 'DB손해보험', n: '운전자', pr: 20000, items: [I('질병사망', 3000)] }]
}, '이순신': { policies: [{ id: 4, items: [I('암진단비', 9999)] }] } };

function makeEnv() {
  const S = makeServer();
  const route = async (u, o) => { const out = S.post(o.body); return { status: 200, json: async () => out }; };
  const seed = { ins_contracts: JSON.stringify(contracts), ins_monthly: '[]', ins_groups: '{"지인들":"#868E96"}', ins_coverages: JSON.stringify(coverages) };
  const mk = (extra = {}) => makeDevice({ ls: Object.assign({}, seed, { ins_server_url: URL1, ins_server_key: S.KEY }, extra), session: { ins_unlocked: '1' }, fetch: route });
  return { S, route, mk };
}
const pidOf = (D, n) => D.get(`peopleList().find(p=>p.name==='${n}').pid`);
const R = (D, pid) => D.get(`(()=>{const r=buildRemodel('${pid}');return {bt:r.beforeTotal,at:r.afterTotal,bn:r.before.length,an:r.after.length,c:r.counts,items:Object.fromEntries(r.items.map(x=>[x.name,[x.before,x.after,x.kind]])),roles:Object.fromEntries(r.policies.map(p=>[String(p.id),p.role]))};})()`);

(async () => {
const E = makeEnv(); const D = E.mk(); await sleep(80);
ok(D.errors.length === 0, '앱 로드 오류 없음 ' + D.errors.join('|'));
const hp = pidOf(D, '홍길동');

console.log('A) 자동으로 신규/해지를 단정하지 않고 직접 분류한 경우의 계산');
ok(D.get(`buildRemodel('${hp}').pending`)===5,'처음에는 5건이 미분류');
ok(D.get(`buildRemodel('${hp}').beforeTotal`)===0,'미분류 계약은 기존 합계를 단정하지 않음');
for(const [id,role] of [[1,'after'],[2,'before'],[3,'after'],['ext_1','before'],[-9,'before']])D.run(`setRemodelRole('${hp}',${JSON.stringify(id)},'${role}')`);
let r = R(D, hp);
ok(JSON.stringify(r.roles) === JSON.stringify({ '1': 'after', '2': 'before', '3': 'after', 'ext_1': 'before', '-9': 'before' }), '기본 역할: ' + JSON.stringify(r.roles));
ok(r.bt === 100000 && r.bn === 3, '기존: 3건 · 월 100,000원 (해지 30,000 + 기존 50,000 + 외부 20,000)');
ok(r.at === 80000 && r.an === 2, '변경 후: 2건 · 월 80,000원 (신규 70,000 + 가입 예정 10,000)');
ok(!('9999' in r.items) && JSON.stringify(r.items).indexOf('9999') < 0 && r.roles['4'] === undefined, '다른 사람(이순신)의 계약·담보는 섞이지 않음');
ok(JSON.stringify(r.items['암진단비']) === JSON.stringify([3000, 5000, '증가']), '암진단비 3,000만 → 5,000만 증가');
ok(JSON.stringify(r.items['뇌혈관진단비']) === JSON.stringify([1000, 2000, '증가']), '뇌혈관진단비 증가');
ok(JSON.stringify(r.items['상해사망']) === JSON.stringify([5000, 0, '삭제']) && JSON.stringify(r.items['질병사망']) === JSON.stringify([3000, 0, '삭제']), '해지·기존 보험에만 있던 담보는 삭제');
ok(JSON.stringify(r.items['실손의료비']) === JSON.stringify([0, 1, '신규']) && JSON.stringify(r.items['수술비']) === JSON.stringify([0, 100, '신규']), '새 보험에만 있는 담보는 신규 (가입 예정 포함)');
ok(JSON.stringify(r.c) === JSON.stringify({ 증가: 2, 감소: 0, 신규: 2, 삭제: 2, 동일: 0 }), '담보 변화 개수: ' + JSON.stringify(r.c));

console.log('B) 역할 바꾸기 (유지·제외) → 저장·동기화');
D.run(`setRemodelRole('${hp}',-9,'both')`);
r = R(D, hp);
ok(r.roles['-9'] === 'both' && r.bt === 100000 && r.at === 100000, '외부 보험을 "유지"로: 기존·변경 후 모두에 들어감 (월 100,000 → 100,000)');
ok(JSON.stringify(r.items['질병사망']) === JSON.stringify([3000, 3000, '동일']), '유지한 보험의 담보는 변동 없음');
D.run(`setRemodelRole('${hp}',3,'none')`);
r = R(D, hp);
ok(r.at === 90000 && !('수술비' in r.items), '가입 예정을 "제외": 변경 후에서 빠지고 그 담보도 사라짐');
D.run(`setRemodelRole('${hp}','ext_1','after')`);
ok(R(D, hp).roles['ext_1'] === 'after', '글자 id(기존 보험)도 역할 변경 가능');
D.run(`setRemodelRole('${hp}','ext_1','before')`);
D.run(`setRemodelRole('${hp}',1,'엉터리')`);
ok(R(D, hp).roles['1'] === 'after', '잘못된 역할 값은 무시');
await D.run('syncNow()');
const srv = JSON.parse(E.S.dataFile().content);
const sroles = ((srv.coverages[hp] || {}).remodel || {}).roles || {};
ok(sroles['r-9'] === 'both' && sroles['r3'] === 'none' && sroles['rext_1'] === 'before', '역할이 서버에 저장됨 (보장분석 기록 안)');
const D2 = E.mk({ ins_coverages: JSON.stringify(coverages) }); await sleep(120);
await D2.run('syncNow()');
const r2 = R(D2, pidOf(D2, '홍길동'));
ok(r2.roles['-9'] === 'both' && r2.roles['3'] === 'none' && r2.at === 90000, '다른 기기에서도 같은 비교 (역할이 동기화됨)');

console.log('C) 매트릭스와 같은 숫자 (직접 고친 값 · 숨긴 담보 · 표시 이름)');
D.run(`COVERAGES['${hp}'].matrixView={'암진단비':{'삼성화재\\n리모델 종합':6000},'수술비':{'KB손해보험\\n수술비':999},'실손의료비':{__hidden:true}}; COVERAGES['${hp}'].matrixNames={'뇌혈관진단비':'뇌혈관 진단(표시명)'}`);
D.run(`setRemodelRole('${hp}',3,'after')`);
r = R(D, hp);
ok(JSON.stringify(r.items['암진단비']) === JSON.stringify([3000, 6000, '증가']), '매트릭스에서 직접 고친 값(6,000만)을 그대로 씀');
ok(r.items['수술비'] && r.items['수술비'][1] === 100, '가입 예정 보험은 매트릭스에 없으니 담보 원본(100만)을 씀');
ok(!('실손의료비' in r.items), '매트릭스에서 숨긴 담보는 비교에서도 빠짐');
ok('뇌혈관 진단(표시명)' in r.items && !('뇌혈관진단비' in r.items), '매트릭스에서 바꾼 표시 이름을 씀');
D.run(`COVERAGES['${hp}'].externalPolicies.push({id:-10,co:'삼성화재',n:'리모델 종합',pr:0,items:[{name:'암진단비',amount:100}]})`);
D.run(`setRemodelRole('${hp}',-10,'before')`);
r = R(D, hp);
ok(JSON.stringify(r.items['암진단비']) === JSON.stringify([3100, 5000, '증가']), '보험사+상품명이 같은 보험이 둘이면(매트릭스에서 한 칸) 고친 값 대신 원본으로 계산');
D.run(`COVERAGES['${hp}'].externalPolicies=COVERAGES['${hp}'].externalPolicies.filter(x=>x.id!==-10)`);

console.log('D) 화면');
D.run(`selectedCovCustomer='${hp}'; renderCoverageTab('보장분석')`);
let html = D.el('cov-detail').innerHTML;
const sec = html.split('보험 변경 전 / 변경 후 비교')[1] || '';
ok(sec.length > 0, '보장분석 화면에 "🔄 기존 → 변경 비교" 섹션');
ok(/100,000원/.test(sec) && /변경 전 월 보험료/.test(sec) && /변경 후 월 보험료/.test(sec), '요약 카드: 기존·변경 후 월 보험료');
ok(/증가 3천만원/.test(sec) && /보장 삭제/.test(sec) && /새로 추가/.test(sec), '담보 변화 표시 (▲ 증가 · ✕ 삭제 · 🆕 신규)');
ok(!/변동 없음/.test(sec.split('📋 보험별 담보 내역')[0]) && /전체 담보 보기/.test(sec), '기본은 바뀐 담보만 (변동 없는 담보는 숨김)');
D.run(`toggleRemodelAll('${hp}')`);
html = D.el('cov-detail').innerHTML;
ok(/변동 없음/.test(html) && /바뀐 담보만 보기/.test(html), '"전체 담보 보기"를 누르면 변동 없는 담보도 보임');
D.run(`toggleRemodelAll('${hp}')`);
html = D.el('cov-detail').innerHTML;
const codes = [...html.matchAll(/onclick="(setRemodelRole\([^"]*\))"/g)].map(m => m[1]);
ok(codes.length === 5 * 5, '보험 5개 × 역할/비교제외 버튼 5개 (' + codes.length + ')');
const bad = codes.map(c => { try { D.run(c); return null; } catch (e) { return c + ' → ' + e.message; } }).filter(Boolean);
ok(bad.length === 0, '역할 버튼 코드를 실제로 눌러도 오류 없음 (글자 id 포함) ' + bad.join(' | '));
const ov = (html.split('📑 보험 개요')[1] || '').split('📊 보장 합산 매트릭스')[0];
ok(ov.includes('리모델 종합') && !ov.includes('옛 상해') && !ov.includes('>수술비<'), '보험 개요는 지금처럼 계약완료·기존·외부만 (해지·가입 예정은 안 들어감)');
const secs = html.split('📋 보험별 담보 내역')[1] || '';
ok(/옛 상해/.test(secs) && /계약해지/.test(secs) && /가입 예정/.test(secs) && /handlePDFUpload\(event,2,/.test(secs) && /handlePDFUpload\(event,3,/.test(secs), '해지·가입 예정 계약도 "보험별 담보 내역"에 나와서 PDF 분석·담보 입력 가능');
D.run(`COVERAGES['${hp}'].otherPolicies.push({id:'ext_x',co:'<img src=x onerror=alert(1)>',name:'"><script>alert(2)</script>',price:1,pn:'"><b>pn</b>',items:[{name:'<i>담보</i>',amount:1}]}); renderCovDetail('${hp}')`);
html = D.el('cov-detail').innerHTML;
ok(!/<img src=x/.test(html) && !/<script>alert/.test(html) && !/<b>pn<\/b>/.test(html) && !/<i>담보<\/i>/.test(html), '보험사·보험명·증권번호·담보 이름은 이스케이프됨');
D.run(`COVERAGES['${hp}'].otherPolicies=COVERAGES['${hp}'].otherPolicies.filter(x=>x.id!=='ext_x')`);

console.log('E) 증권번호 입력');
D.run('openEditModal(1)');
ok(D.el('f-pn').value === '1-2345-678901', '계약 수정 창에 저장된 증권번호가 보임');
D.el('f-pn').value = '  9-8765-432100  '; D.run('saveContract()');
ok(D.get('CONTRACTS.find(c=>c.id===1).pn') === '9-8765-432100', '계약 수정 창에서 고친 증권번호 저장 (앞뒤 공백 제거)');
D.run('openAddModal()');
ok(D.el('f-pn').value === '', '새 계약 창은 증권번호가 비어 있음');
D.el('f-holder').value = '새고객'; D.el('f-insured').value = '새고객'; D.el('f-co').value = '한화손해보험'; D.el('f-name').value = '새 상품'; D.el('f-price').value = '1000'; D.el('f-date').value = '26.07.01';
D.el('f-pn').value = 'X'.repeat(60); D.run('saveContract()');
ok(D.get("CONTRACTS.find(c=>c.c==='새고객').pn") === 'X'.repeat(40), '새 계약 증권번호 저장 (최대 40자)');
D.run(`setPolicyNo('${hp}',1,' 1-1111 ')`); D.run(`setPolicyNo('${hp}','ext_1','L-888')`); D.run(`setPolicyNo('${hp}',-9,'D-1')`);
ok(D.get('CONTRACTS.find(c=>c.id===1).pn') === '1-1111' && D.get(`COVERAGES['${hp}'].otherPolicies[0].pn`) === 'L-888' && D.get(`COVERAGES['${hp}'].externalPolicies[0].pn`) === 'D-1', '보장분석 요약표에서 증권번호 입력: 내 계약은 계약에, 기존·외부 보험은 그 기록에');
D.run(`renderCovDetail('${hp}')`); html = D.el('cov-detail').innerHTML;
const ov2 = (html.split('📑 보험 개요')[1] || '').split('📊 보장 합산 매트릭스')[0];
ok(/value="1-1111"/.test(ov2) && /value="L-888"/.test(ov2) && /value="D-1"/.test(ov2) && /증권번호/.test(ov2), '보험 개요 표에 증권번호 칸');
D.run(`openAddOtherPolicy('${hp}')`); ok(D.el('op-pn').value === '', '기존 보험 추가 창: 증권번호 칸이 비어 있음');
D.el('op-co').value = '교보생명'; D.el('op-name').value = '옛 종신'; D.el('op-price').value = '40000'; D.el('op-pn').value = 'KB-123'; D.run('saveOtherPolicy()');
ok(D.get(`COVERAGES['${hp}'].otherPolicies.find(x=>x.name==='옛 종신').pn`) === 'KB-123', '기존 보험 추가 창에서 증권번호 저장');
D.run(`openAddExternalModal('${hp}')`); ok(D.el('ext-pn').value === '', '외부 보험 추가 창: 증권번호 칸이 비어 있음');
D.el('ext-co').value = '흥국화재'; D.el('ext-name').value = '외부2'; D.el('ext-pr').value = '5000'; D.el('ext-pn').value = 'HG-9'; D.run('saveExternalInsurance()');
ok(D.get(`COVERAGES['${hp}'].externalPolicies.find(x=>x.n==='외부2').pn`) === 'HG-9', '외부 보험 추가 창에서 증권번호 저장');
D.run("sq='1-1111'; renderList()"); const lr = D.el('list-results').innerHTML;
ok(/리모델 종합/.test(lr) && !/옛 상해/.test(lr), '계약 리스트 검색에 증권번호가 걸림');
D.run("sq=''; renderList()");
await D.run('syncNow()');
const srv2 = JSON.parse(E.S.dataFile().content);
ok(srv2.contracts.find(c => c.id === 1).pn === '1-1111' && srv2.coverages[hp].otherPolicies.find(x => x.name === '옛 종신').pn === 'KB-123', '증권번호가 서버에 저장됨');

console.log('F) 고객 화면에는 비교표·내 계약 증권번호가 안 나감 (아직 정하지 않은 부분)');
await D.run(`copyShareLink('${hp}')`); const link = '#' + D.clip.split('#')[1];
const V = makeDevice({ hash: link, fetch: E.route }); await sleep(100);
ok(V.bodyHtml.includes('cv-screen') && !/기존 → 변경 비교/.test(V.bodyHtml), '고객 화면에 리모델링 비교 섹션 없음');
ok(V.get('CONTRACTS.every(c=>c.pn===undefined)') && !V.bodyHtml.includes('1-1111'), '고객이 받는 계약 데이터·화면에 증권번호 없음');

console.log(`\n리모델링 비교·증권번호 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.log('테스트 실행 오류:', e && e.stack || e); process.exit(1); });
