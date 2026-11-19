// 고객 정보(생년월일·핸드폰·주소·사는 곳·메모) · 그룹 이동·관리 · 예비 고객 그룹별 표시 · 고객별 탭 클릭=펼침 (사용자 요청 2026-11-19, 가짜 데이터만)
const makeServer = require('./lib/ins_fake_server.js');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
const ph = (a, b) => ['010', a, b].join('-');   // 가짜 번호는 실행 때 조립 (소스에 번호 꼴을 두지 않음)
const P1 = ph('1234', '5678'), P2 = ph('9999', '8888'), P3 = ph('1111', '2222'), P4 = ph('5555', '6666');
const SID = 'AKfycbCUSTINFOTESTCUSTINFO12345', URL1 = `https://script.google.com/macros/s/${SID}/exec`;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const count = (h, w) => h.split(w).length - 1;
const C = (id, pid, name, g) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g });
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: true,
  issueDate: '2024-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const baseLs = () => ({
  ins_contracts: JSON.stringify([C(1, 'pid_kim', '김가입', '지인'), C(2, 'pid_kim', '김가입', '친구'), C(3, 'pid_mu', '이무그룹', '')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{"지인":"#3B82F6","친구":"#10B981"}', ins_reminders: '{}', ins_memos: JSON.stringify({ 1: '계약1 메모' }) });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: baseLs() });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
D.ctx.__f = { source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [
  { plannerMemberId: 7, memberId: 7, name: '박예비', policies: [pol(1, '박예비')] }, { plannerMemberId: 8, memberId: 8, name: '최가족', policies: [pol(2, '최가족')] }] };
D.get('importBomappData(__f)');
const pros = D.get(`peopleList().find(p=>p.name==='박예비').pid`), pros2 = D.get(`peopleList().find(p=>p.name==='최가족').pid`);

console.log('A) 정규화: 생년월일 · 핸드폰');
const nb = s => D.get(`normBirth(${JSON.stringify(s)})`), np = s => D.get(`normPhone(${JSON.stringify(s)})`);
ok(nb('1990.1.2') === '1990.01.02' && nb('19900102') === '1990.01.02' && nb('1990-01-02') === '1990.01.02' && nb('1990년 1월 2일') === '1990.01.02', '여러 입력 꼴 → 1990.01.02');
ok(nb('') === '' && nb('900102') === null && nb('1990.02.30') === null && nb('2999.01.01') === null && nb('abc') === null, '비움은 허용, 6자리·없는 날짜·미래·글자는 거절');
ok(np('01012345678') === P1 && np('010 1234 5678') === P1 && np('0212345678') === '02-1234-5678' && np('021234567') === '02-123-4567' && np('15881234') === '1588-1234', '핸드폰·전화 번호 꼴 맞춤');
ok(np('') === '' && np('12345') === null && np('+82 10-1234-5678') === '+82 10-1234-5678', '비움 허용, 자릿수 틀리면 거절, 국제번호는 그대로');

console.log('B) 저장: MEMOS 의 cust:이름 키 (고객 링크로 안 나가는 곳)');
D.run(`setProfile('김가입', {birth:'1990.01.02', phone:'${P1}', region:'대전 서구', addr:'둔산로 1', memo:'비밀메모', job:'교사', email:'a@example.com'})`);
let pr = D.get(`getProfile('김가입')`);
ok(pr.birth === '1990.01.02' && pr.phone === P1 && pr.region === '대전 서구' && pr.memo === '비밀메모' && pr.job === '교사', '저장·읽기');
ok(D.get(`typeof MEMOS['cust:김가입']`) === 'string' && D.get(`MEMOS[1]`) === '계약1 메모', 'cust: 키에 JSON 문자열, 계약 메모(숫자 키)는 그대로');
ok(D.get(`JSON.parse(localStorage.getItem('ins_memos'))['cust:김가입']`).includes(P1), '이 기기 저장소(동기화 대상 memos)에 기록');
D.run(`setProfile('김가입', {phone:'', memo:'바뀐메모'})`);
pr = D.get(`getProfile('김가입')`);
ok(!('phone' in pr) && pr.memo === '바뀐메모' && pr.birth === '1990.01.02', '일부 칸만 바꾸고 비우면 그 칸만 삭제');
D.run(`setProfile('김가입', {memo:'x'.repeat(3000)})`);
ok(D.get(`getProfile('김가입').memo.length`) === 2000, '메모는 2000자까지');
D.run(`setProfile('임시', {memo:'a'}); setProfile('임시', {memo:''})`);
ok(D.get(`!('cust:임시' in MEMOS)`), '모든 칸이 비면 키 자체를 지움');
D.run(`setProfile('__proto__', {memo:'p'})`);
ok(D.get(`({}).memo === undefined && 'cust:__proto__' in MEMOS`), '__proto__ 이름이어도 오염 없음');
D.run(`delete MEMOS['cust:__proto__']; setProfile('김가입', {phone:'${P1}'})`);

console.log('C) 고객별 탭: 클릭은 펼침만 (보장분석으로 안 감) + 정보 입력·수정');
D.run(`window._covSubTab='청구서류'; selectedCovCustomer=null; renderCustomers()`);
let h = D.el('pane-고객별').innerHTML;
ok(!/openCovCustomer/.test(h) && count(h, 'toggleProspectDetail') >= 2, '예비 고객 행 클릭은 보장분석 이동이 아니라 펼침(toggleProspectDetail)');
ok(h.includes('📞 ' + P1 + ' · 📍 대전 서구 · 📝 메모'), '표의 이름 아래에 핸드폰·사는 곳·메모 표시 (내용은 안 보이고 메모 있음만)');
ok(!/바뀐메모/.test(h), '메모 내용은 표에 노출하지 않음');
D.run(`toggleProspectDetail('${pros}')`); h = D.el('pane-고객별').innerHTML;
ok(D.get('expandedCustomer') === 'p:' + pros && D.get('selectedCovCustomer') === null && D.get('window._covSubTab') === '청구서류', '예비 고객 클릭 → 펼쳐지기만, 보장분석 선택·탭 이동 없음');
ok(/👤 박예비 님 정보/.test(h) && /id="cp-birth"/.test(h) && /id="cp-phone"/.test(h) && /id="cp-region"/.test(h) && /id="cp-addr"/.test(h) && /id="cp-memo"/.test(h), '정보 칸: 생년월일·핸드폰·사는 곳·주소·메모');
ok(/data-pid="[^"]+" onclick="openCovCustomer\(this\.dataset\.pid\)">📋 보장분석 보기/.test(h), '"📋 보장분석 보기" 버튼을 눌러야 이동');
D.run(`toggleProspectDetail('${pros}')`);
ok(D.get('expandedCustomer') === null, '한 번 더 누르면 접힘');
D.run(`toggleCustomerDetail('김가입')`); h = D.el('pane-고객별').innerHTML;
ok(D.get('selectedCovCustomer') === null && /👤 김가입 님 정보/.test(h) && h.includes('value="' + P1 + '"') && /value="1990.01.02"/.test(h), '가입자 클릭도 펼침 + 저장된 값이 채워져 있음');
ok(/📋 보장분석 보기/.test(h) && /계약이 2개 그룹에 걸쳐 있어요/.test(h), '가입자: 보장분석 보기 버튼 + 여러 그룹 안내');
// 입력 → 저장
const E = D.el;
E('cp-birth').value = '1991.3.4'; E('cp-phone').value = '01099998888'; E('cp-email').value = 'kim@example.com'; E('cp-job').value = '회사원';
E('cp-region').value = '세종'; E('cp-addr').value = '<img src=x onerror=alert(1)> 1번지'; E('cp-memo').value = '두 번째\n줄';
ok(D.run(`saveCustomerProfile('김가입')`) === true, '저장 성공');
pr = D.get(`getProfile('김가입')`);
ok(pr.birth === '1991.03.04' && pr.phone === P2 && pr.email === 'kim@example.com' && pr.region === '세종' && pr.memo === '두 번째\n줄', '정규화돼서 저장 (1991.03.04)');
h = D.el('pane-고객별').innerHTML;
ok(!/<img src=x/.test(h) && /&lt;img src=x/.test(h), '주소에 넣은 태그는 글자 그대로 (실행 안 됨)');
E('cp-birth').value = '900102'; const before = D.get(`MEMOS['cust:김가입']`);
ok(D.run(`saveCustomerProfile('김가입')`) === false && D.get(`MEMOS['cust:김가입']`) === before, '잘못된 생년월일(6자리)은 저장 안 하고 거절');
E('cp-birth').value = '1991.03.04'; E('cp-phone').value = '123';
ok(D.run(`saveCustomerProfile('김가입')`) === false, '잘못된 전화번호도 거절');
E('cp-phone').value = P2; E('cp-email').value = '메일아님';
ok(D.run(`saveCustomerProfile('김가입')`) === false, '잘못된 이메일도 거절');
D.run(`toggleCustomerDetail('김가입')`);

console.log('D) 그룹 이동: 가입자 · 예비 고객 · 새 그룹');
ok(D.run(`moveCustomerGroup('김가입', '친구')`) === true && D.get(`CONTRACTS.filter(r=>r.c==='김가입').every(r=>r.g==='친구')`), '가입자: 그 계약자의 모든 계약이 한 그룹으로');
ok(D.get(`JSON.parse(localStorage.getItem('ins_contracts')).filter(r=>r.c==='김가입').every(r=>r.g==='친구')`), '이 기기 저장에도 반영');
D.run(`moveCustomerGroup('김가입', '지인')`);
ok(D.run(`moveCustomerGroup('박예비', '친구')`) === true && D.get(`getProfile('박예비').group`) === '친구' && D.get(`prospectGroupOf('박예비')`) === '친구', '예비 고객: 고객 정보의 그룹에 저장');
ok(D.get(`CONTRACTS.length`) === 3, '예비 고객을 옮겨도 계약은 안 생김');
D.promptQ.push('VIP');
ok(D.run(`moveCustomerGroup('최가족', '__new__')`) === true && D.get(`('VIP' in GROUPS)`) && D.get(`getProfile('최가족').group`) === 'VIP' && /^#[0-9A-F]{6}$/i.test(D.get(`GROUPS['VIP']`)), '＋ 새 그룹 만들기 → 만들고 바로 이동 (색 자동)');
D.promptQ.push(null);
ok(D.run(`moveCustomerGroup('최가족', '__new__')`) === false && D.get(`getProfile('최가족').group`) === 'VIP', '이름 입력 취소하면 아무것도 안 바뀜');
ok(D.run(`moveCustomerGroup('최가족', '없는그룹')`) === false, '없는 그룹으로는 못 옮김');
D.run(`moveCustomerGroup('최가족', '')`);
ok(D.get(`prospectGroupOf('최가족')`) === '', '그룹 없음으로 비우기');

console.log('E) 그룹별 탭·보장분석 목록에 예비 고객이 그 그룹으로 보임');
D.run(`renderGroups()`); let gh = D.el('pane-그룹별').innerHTML;
const card = name => { const i = gh.indexOf(`<span class="gname">${name}</span>`); return i < 0 ? '' : gh.slice(gh.lastIndexOf('<div class="gcard">', i), gh.indexOf('<div class="gcard">', i) < 0 ? gh.length : gh.indexOf('<div class="gcard">', i)); };
ok(/박예비/.test(card('친구')) && /cov-prospect/.test(card('친구')) && /🌱 예비 1명/.test(card('친구')), '친구 그룹 카드에 박예비(🌱 예비) 표시');
ok(!/박예비/.test(card('지인')), '다른 그룹엔 없음');
const rowsOf = html => html.split('<tr class="pros-tr">').length - 1;
ok(rowsOf(card('친구')) === 1 && /가나화재/.test(card('친구')) && /보험1/.test(card('친구')), '가져온 보험이 계약 행처럼 한 줄씩 (보험사·보험명)');
D.run(`COVERAGES['${pros}'].externalPolicies.push({id:-99, co:'다라생명', n:'추가보험', pr:20000, items:[], bm:{issue:'2024.05.06', status:'정상'}}); renderGroups()`); gh = D.el('pane-그룹별').innerHTML;
ok(rowsOf(card('친구')) === 2 && /추가보험/.test(card('친구')) && /20,000/.test(card('친구')) && card('친구').split('class="grp-move"').length - 1 === 1, '보험이 2건이면 두 줄, 그룹 선택칸은 사람당 한 번만');
ok(!/class="gamt"[^>]*>[^<]*20,000/.test(card('친구')), '예비 고객 보험료는 그룹 월 합계에 안 더함');
const free = card('🌱 예비 고객 (그룹 미지정)');
ok(/최가족/.test(free) && /class="grp-move"/.test(free) && /moveCustomerGroup\(this\.dataset\.name,this\.value\)/.test(free), '그룹 미지정 예비 고객은 맨 아래 카드에, 거기서 바로 그룹 선택');
ok(/class="gtoolbar"/.test(gh) && /openGroupManager/.test(gh), '그룹별 탭 위에 🗂️ 그룹 관리 버튼');
let list = D.get('covPeopleListHtml()');
const famBlock = n => { const i = list.indexOf(`data-fam="${n}"`); return i < 0 ? '' : list.slice(i, list.indexOf('</details>', i)); };
ok(/박예비/.test(famBlock('친구')) && !/박예비/.test(famBlock('🌱 예비 고객')) && /최가족/.test(famBlock('🌱 예비 고객')), '보장분석 목록: 박예비는 친구 그룹에, 그룹 없는 최가족만 🌱 예비 고객 묶음에');
D.run(`window._covSearch='친구'`); list = D.get('covPeopleListHtml()');
ok(/박예비/.test(list), '그룹 이름으로 검색해도 예비 고객이 나옴');
D.run(`window._covSearch=''`);
D.run(`renderCustomers()`); h = D.el('pane-고객별').innerHTML;
ok(/🗂️ 그룹 관리/.test(h) && /박예비/.test(h) && />친구</.test(h.slice(h.indexOf('박예비'), h.indexOf('박예비') + 900)), '고객별 탭: 예비 고객의 그룹 칸에 친구, 그룹 관리 버튼');

console.log('F) 그룹 관리: 만들기 · 이름 · 색 · 삭제');
const cg = (n, c) => D.get(`createGroup(${JSON.stringify(n)}, ${JSON.stringify(c || '')})`);
ok(cg('').ok === false && cg('친구').ok === false && cg('가'.repeat(31)).ok === false && cg('__proto__').ok === false && cg('constructor').ok === false, '빈 이름·중복·너무 긴 이름·위험한 이름은 거절');
const g1 = cg('신규', '#ff0000');
ok(g1.ok && D.get(`GROUPS['신규']`) === '#ff0000' && D.get(`JSON.parse(localStorage.getItem('ins_groups'))['신규']`) === '#ff0000', '만들기 (색 지정, 이 기기에 저장)');
ok(cg('색없음', 'red').ok && /^#[0-9A-F]{6}$/i.test(D.get(`GROUPS['색없음']`)), '색이 이상하면 자동 색');
D.run(`delete GROUPS['색없음']`);
D.run(`fGroups.add('친구')`);
const rn = D.get(`renameGroup('친구', '절친')`);
ok(rn.ok && D.get(`!('친구' in GROUPS) && GROUPS['절친']==='#10B981'`) && D.get(`CONTRACTS.every(r=>r.g!=='친구')`), '이름 바꾸기: 그룹·색 유지');
ok(D.get(`getProfile('박예비').group`) === '절친' && D.get(`prospectGroupOf('박예비')`) === '절친', '예비 고객의 그룹도 새 이름으로');
ok(D.get(`fGroups.has('절친') && !fGroups.has('친구')`), '계약 리스트 필터에 걸려 있던 그룹도 따라감');
D.run(`moveCustomerGroup('이무그룹', '절친')`);
ok(D.get(`renameGroup('절친', '지인').ok`) === false && D.get(`renameGroup('없는', 'x').ok`) === false && D.get(`renameGroup('절친', '').ok`) === false, '이미 있는 이름·없는 그룹·빈 이름으로는 못 바꿈');
ok(D.get(`setGroupColor('절친', '#123456')`) === true && D.get(`GROUPS['절친']`) === '#123456' && D.get(`setGroupColor('절친', 'blue')`) === false, '색 바꾸기 (6자리 #색만)');
const st = D.get(`groupStats()['절친']`);
ok(st.contracts === 1 && st.customers === 1 && st.prospects === 1, '그룹 통계: 계약 1건 · 고객 1명 · 예비 고객 1명');
const del = D.get(`deleteGroup('절친')`);
ok(del.ok && del.contracts === 1 && del.prospects === 1 && D.get(`!('절친' in GROUPS)`), '삭제: 계약 1건·예비 고객 1명이 그룹 없음으로');
ok(D.get(`CONTRACTS.find(r=>r.c==='이무그룹').g`) === '' && D.get(`getProfile('박예비').group || ''`) === '' && D.get(`CONTRACTS.length`) === 3 && D.get(`peopleList().length`) === 4, '계약·고객은 안 지워짐');
ok(D.get(`prospectGroupOf('박예비')`) === '', '지워진 그룹을 가리키는 예비 고객은 그룹 없음으로 취급');
// 그룹 관리 창 (UI 래퍼)
D.run(`openGroupManager()`);
const gmh = D.get(`groupManagerHtml()`);
ok(/🗂️ 그룹 관리/.test(gmh) && /gm-name-0/.test(gmh) && /gm-new-name/.test(gmh) && /계약 \d+건 · 고객 \d+명 · 🌱 \d+명/.test(gmh), '그룹 관리 창: 목록·건수·새 그룹 입력');
E('gm-new-name').value = '새로'; E('gm-new-color').value = '#00ff00';
ok(D.run(`gmCreate()`) === true && D.get(`GROUPS['새로']`) === '#00ff00', '창에서 만들기');
const idx = D.get(`GM_LIST.indexOf('새로')`);
E('gm-name-' + idx).value = '새로운'; E('gm-color-' + idx).value = '#0000ff';
ok(D.run(`gmSave(${idx})`) === true && D.get(`GROUPS['새로운']`) === '#0000ff' && D.get(`!('새로' in GROUPS)`), '창에서 이름+색 수정');
const idx2 = D.get(`GM_LIST.indexOf('새로운')`);
D.confirmQ.push(false);
ok(D.run(`gmDelete(${idx2})`) === false && D.get(`('새로운' in GROUPS)`), '삭제 확인 창에서 취소하면 그대로');
D.confirmQ.push(true);
ok(D.run(`gmDelete(${idx2})`) === true && D.get(`!('새로운' in GROUPS)`), '확인하면 삭제');
ok(/openGroupManager/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').match(/<details class="more-menu hdr-menu">[\s\S]*?<\/details>/)[0]), '⚙️ 관리 메뉴에도 🗂️ 그룹 관리');

console.log('G) 이름을 바꾸면 고객 정보도 따라감');
D.run(`setProfile('박예비', {memo:'예비메모', phone:'${P3}'})`);
D.promptQ.push('박예비2');
D.run(`renamePerson('${pros}')`);
ok(D.get(`!('cust:박예비' in MEMOS)`) && D.get(`getProfile('박예비2').memo`) === '예비메모', '예비 고객 이름 변경 → 정보가 새 이름으로 이동');
// 계약자 이름 변경 (saveContract)
D.run(`setProfile('이무그룹', {memo:'무그룹메모'})`);
E('edit-id').value = '3'; E('f-status').value = '계약완료'; E('f-end-date').value = ''; E('f-date').value = '25.01.01'; E('f-holder').value = '이무그룹개명'; E('f-insured').value = '이무그룹개명';
E('f-co').value = '다라생명'; E('f-name').value = '계약3'; E('f-price').value = '50000'; E('f-group').value = ''; E('contract-memo').value = ''; E('f-pn').value = '';
D.confirmQ.push(true, true, true);
D.promptQ.push('1');
D.run('saveContract()');
ok(D.get(`CONTRACTS.find(r=>r.id===3).c`) === '이무그룹개명' && D.get(`getProfile('이무그룹개명').memo`) === '무그룹메모' && D.get(`!('cust:이무그룹' in MEMOS)`), '계약자 이름 변경 → 고객 정보가 새 이름으로 이동');
D.run(`setProfile('김가입', {memo:'남아야함'})`);
ok(D.get(`migrateProfileName('김가입', '다른이름')`) === false && D.get(`getProfile('김가입').memo`) === '남아야함', '아직 그 이름을 쓰는 사람이 있으면 옮기지 않음');

console.log('H) 고객 링크로 안 나감 + 기기 간 동기화 (실제 Code.gs 로)');
const S = makeServer(); const TOK = 't'.repeat(48);
const route = async (u, o) => ({ status: 200, json: async () => S.post(o.body) });
const srvLs = Object.assign(baseLs(), { ins_server_url: URL1, ins_server_key: S.KEY });
const A = makeDevice({ session: { ins_unlocked: '1' }, ls: srvLs, fetch: route }); await sleep(120);
await A.run('syncNow()');
A.run(`setProfile('김가입', {phone:'${P4}', memo:'외부노출금지', addr:'서울 어딘가', birth:'1980.05.05'})`);
await A.run('syncNow()');
const dataOnServer = JSON.parse(S.dataFile().content);
ok(typeof dataOnServer.memos['cust:김가입'] === 'string' && dataOnServer.memos['cust:김가입'].includes(P4), '서버(Drive) 데이터의 memos 에 저장됨');
S.post({ action: 'save', key: S.KEY, baseRev: dataOnServer.rev, data: Object.assign(dataOnServer, { shares: { pid_kim: TOK } }) });
const view = S.post({ action: 'getCustomerView', name: '김가입', token: TOK });
const vs = JSON.stringify(view);
ok(view.ok === true && !vs.includes(P4) && !/외부노출금지|서울 어딘가|1980\.05\.05|cust:/.test(vs), '고객 링크 응답에 연락처·메모·주소·생년월일이 없음 (memos 는 고객에게 안 감)');
const B = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_monthly: '[]', ins_groups: '{}', ins_server_url: URL1, ins_server_key: S.KEY }, fetch: route }); await sleep(150);
await B.run('syncNow()');
ok(B.get(`getProfile('김가입').phone`) === P4, '다른 기기(B)가 동기화하면 같은 고객 정보를 받음');
A.run(`setProfile('이무그룹', {memo:'A에서'})`); B.run(`setProfile('김가입', {memo:'B에서 수정'})`);
await A.run('syncNow()'); await B.run('syncNow()'); await A.run('syncNow()');
ok(A.get(`getProfile('이무그룹').memo`) === 'A에서' && A.get(`getProfile('김가입').memo`) === 'B에서 수정' && B.get(`getProfile('이무그룹').memo`) === 'A에서', '두 기기에서 서로 다른 고객 정보를 고쳐도 둘 다 남음 (고객별로 합쳐짐)');
A.run(`moveCustomerGroup('김가입', '지인')`);
await A.run('syncNow()'); await B.run('syncNow()');
ok(B.get(`CONTRACTS.filter(r=>r.c==='김가입').every(r=>r.g==='지인')`), '그룹 이동도 다른 기기에 동기화');

console.log(`\n고객 정보·그룹 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
