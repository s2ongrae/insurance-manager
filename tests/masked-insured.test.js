// 보맵이 가족 이름을 '조*건' 처럼 별표로 가려서 줄 때: 설계사가 골라서 그 사람(기존 고객 포함) 것으로 보냄 (사용자 요청 2026-11-19, 가짜 데이터만)
const fs = require('fs'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const rider = (id, name) => ({ contractId: id, name, joinAmount: 1e7, maturityDate: '2045-01-01', insuredName: '', contractStatus: '정상', isMyContract: true });
const pol = (id, who, self = true) => ({ insuranceId: id, insurerName: '가나화재', productName: '보험' + id, insuranceStatus: '정상', primaryInsuredName: who, isPrimaryInsuredMyself: self,
  issueDate: '2024-01-01', monthlyPaymentAmount: 1000, paymentCycle: '매월', totalPaymentCount: 240, riders: [rider(id * 10, '암진단비')] });
const file = pols => ({ source: 'bomapp-planner', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', customers: [{ plannerMemberId: 7, memberId: 7, name: '김아름', policies: pols }] });
const C = (id, pid, name) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g: '' });

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름'), C(2, 'pid_b', '조유건'), C(3, 'pid_c', '박영수')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
const idOf = n => D.get(`peopleList().find(p=>p.name==='${n}').pid`);
const nPeople = n => D.get(`peopleList().filter(p=>p.name==='${n}').length`);
const extOf = n => D.get(`((COVERAGES['${idOf(n)}']||{}).externalPolicies||[]).map(x=>x.bm.id)`);

console.log('A) 별표 이름은 따로 가져와지고 안내 + 지정 버튼이 보임');
D.ctx.__f = file([pol(1, '김아름'), pol(2, '조*건', false), pol(3, '박*수', false)]);
const r = D.get('importBomappData(__f)');
ok(nPeople('조*건') === 1 && nPeople('박*수') === 1 && r.prospects.includes('조*건'), '가려진 이름 두 명이 예비 고객으로 생김');
const mp = idOf('조*건');
ok(/assignMaskedPerson/.test(D.get(`maskNoticeHtml('${mp}', '조*건')`)) && D.get(`maskNoticeHtml('${idOf('김아름')}', '김아름')`) === '', '가려진 이름에만 "누구 보험인지 지정" 안내');
D.run(`selectedCovCustomer='${mp}'; renderCovDetail('${mp}')`);
ok(/누구 보험인지 지정/.test(D.el('cov-detail').innerHTML), '보장분석 상세 맨 위에 안내가 보임');
D.run(`expandedCustomer='p:${mp}'; renderCustomers()`);
ok(/누구 보험인지 지정/.test(D.el('pane-고객별').innerHTML), '고객별 탭 펼친 칸에도 보임');
D.run(`expandedCustomer=null`);

console.log('B) 취소하면 그대로, 고르면 기존 고객에게 합쳐짐 (계약 있는 사람)');
D.promptQ.push(null);
D.run(`assignMaskedPerson('${mp}')`);
ok(nPeople('조*건') === 1 && extOf('조유건').length === 0, '프롬프트 취소하면 아무것도 안 바뀜');
D.promptQ.push('1'); D.confirmQ.push(true);                    // 맨 위(⭐ 이름 글자가 맞는 사람) = 조유건
D.run(`assignMaskedPerson('${mp}')`);
ok(nPeople('조*건') === 0, '가려진 이름의 예비 고객은 없어짐');
ok(JSON.stringify(extOf('조유건')) === '[2]', '조유건 님 기록에 그 보험이 들어감');
ok(D.get(`CONTRACTS.filter(c=>cpid(c)==='pid_b').length`) === 1, '조유건 님의 기존 계약은 그대로');
ok(D.get(`COVERAGES['pid_b'].person === undefined || !isMaskedName(COVERAGES['pid_b'].person.name)`) && D.get(`!(COVERAGES['pid_b'].bomapp && COVERAGES['pid_b'].bomapp.insured)`), '조유건 님 기록에 가려진 이름·보맵 가족 연결이 묻어 들어오지 않음');
ok(nPeople('조유건') === 1, '조유건 님이 둘로 나뉘지 않음');

console.log('C) 다시 가져와도 같은 사람에게 (새 보험이 추가돼도)');
D.ctx.__f = file([pol(1, '김아름'), pol(2, '조*건', false), pol(3, '박*수', false), pol(4, '조*건', false)]);
const r2 = D.get('importBomappData(__f)');
ok(nPeople('조*건') === 0 && nPeople('박*수') === 1, '다시 가져와도 조*건 예비 고객이 또 생기지 않음 (박*수는 그대로)');
ok(JSON.stringify(extOf('조유건').sort()) === JSON.stringify([2, 4]) && r2.newPeople === 0, '이미 들어간 보험은 갱신, 새 보험(4)도 조유건 님에게 (중복 없음)');
ok(D.get(`isPlain(COVERAGES['${idOf('김아름')}'].insuredMap) && COVERAGES['${idOf('김아름')}'].insuredMap['조*건'] === 'pid_b'`), '고른 결과가 보맵 고객 기록(insuredMap)에 남음');

console.log('D) 계약 없는 쪽(예비 고객)·같은 이름이 아닌 사람에게도 보낼 수 있음');
const ps = idOf('박*수');
D.promptQ.push('99');                                            // 없는 번호
D.run(`assignMaskedPerson('${ps}')`);
ok(nPeople('박*수') === 1, '없는 번호를 넣으면 그대로');
const num = D.get(`(()=>{const m=peopleList().filter(p=>p.pid!=='${ps}'&&!isMaskedName(p.name));const rx=maskPattern('박*수');const o=[...m.filter(p=>rx.test(p.name)),...m.filter(p=>!rx.test(p.name))];return o.findIndex(p=>p.name==='박영수')+1;})()`);
ok(num === 1, '이름 글자가 맞는 박영수가 맨 위(⭐)에 옴');
D.promptQ.push(String(num)); D.confirmQ.push(true);
D.run(`assignMaskedPerson('${ps}')`);
ok(nPeople('박*수') === 0 && JSON.stringify(extOf('박영수')) === '[3]', '박*수 보험이 박영수 님으로');

console.log('E) 고객 링크 응답에는 안 나감');
const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
ok(!/insuredMap/.test(code), '서버 Code.gs 의 고객 응답 목록에 insuredMap 없음 (화면용 칸만 골라 보냄)');

console.log('F) 고객 리스트에 없던 사람은 이름을 넣어 새로 만들고 그 사람 것으로 (조*인 → 조해인) + 다시 가져와도 유지');
const D2 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름')]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
D2.ctx.__f = file([pol(1, '김아름'), pol(5, '조*인', false), pol(6, '조*인', false)]);
D2.get('importBomappData(__f)');
const mi = D2.get(`peopleList().find(p=>p.name==='조*인').pid`);
D2.promptQ.push('0'); D2.promptQ.push('*가짜'); D2.run(`assignMaskedPerson('${mi}')`);
ok(D2.get(`peopleList().filter(p=>p.name==='조*인').length`) === 1 && D2.get(`peopleList().some(p=>p.name==='*가짜')`) === false, '별표가 든 이름으로는 못 만듦');
D2.promptQ.push('0'); D2.promptQ.push('조해인'); D2.confirmQ.push(false); D2.run(`assignMaskedPerson('${mi}')`);
ok(D2.get(`peopleList().filter(p=>p.name==='조*인').length`) === 1 && D2.get(`peopleList().some(p=>p.name==='조해인')`) === false, '확인에서 취소하면 새 사람도 안 남음');
D2.promptQ.push('0'); D2.promptQ.push('조해인'); D2.confirmQ.push(true); D2.run(`assignMaskedPerson('${mi}')`);
const jh = D2.get(`peopleList().find(p=>p.name==='조해인').pid`);
ok(D2.get(`peopleList().filter(p=>p.name==='조*인').length`) === 0 && JSON.stringify(D2.get(`COVERAGES['${jh}'].externalPolicies.map(x=>x.bm.id).sort()`)) === '[5,6]', '조해인 님이 새로 만들어지고 조*인 보험 2건이 그쪽으로');
D2.ctx.__f = file([pol(1, '김아름'), pol(5, '조*인', false), pol(6, '조*인', false), pol(7, '조*인', false)]);
D2.get('importBomappData(__f)');
ok(D2.get(`peopleList().filter(p=>p.name==='조*인').length`) === 0 && D2.get(`COVERAGES['${jh}'].externalPolicies.length`) === 3, '다시 가져와도 조해인 님에게 (새 보험 7 포함, 조*인 안 생김)');

console.log('G) 보맵이 "본인" 표시를 붙여도 이름이 가려져 있고 고객 이름과 글자가 안 맞으면 가족 보험');
const D3 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름')]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
D3.ctx.__f = file([pol(1, '김아름'), pol(2, '조*건', true), pol(3, '김*름', true), pol(4, '이름다른', true)]);
D3.get('importBomappData(__f)');
const own = D3.get(`(COVERAGES['pid_a'].externalPolicies||[]).concat(COVERAGES['pid_a'].otherPolicies||[]).map(x=>x.bm.id).sort()`);
ok(D3.get(`peopleList().some(p=>p.name==='조*건')`) && !own.includes(2), '본인 표시가 붙은 조*건(김아름과 글자 다름)은 김아름 쪽이 아니라 조*건 쪽으로');
ok(own.includes(3) && own.includes(4), '김*름(글자 맞음)·가려지지 않은 다른 이름은 예전처럼 본인 쪽');

console.log('H) 피보험자는 한 사람의 고객: 내가 계약자인 계약의 가입자 중 글자가 맞는 한 명이면 자동으로 그 사람 (조*건 → 조유건)');
const D4 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름')]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
D4.ctx.__f = file([pol(1, '김아름'), pol(2, '조*건', false)]);
D4.get('importBomappData(__f)');
ok(D4.get(`peopleList().filter(p=>p.name==='조*건').length`) === 1, '계약 리스트에 연결이 없으면 일단 가려진 이름 그대로 (예전과 같음)');
// 김아름 님이 계약자이고 가입자가 조유건 인 계약을 등록
D4.run(`CONTRACTS = [...CONTRACTS, {id:55, pid:'pid_j', c:'김아름', p:'조유건', co:'다라생명', n:'조유건계약', s:'계약완료', d:'25.03.03', pr:9000, g:''}]; renderAll()`);
ok(D4.get(`maskedCandidate('조*건', '김아름').name`) === '조유건', '후보: 김아름 님이 계약자인 계약의 가입자 중 글자가 맞는 조유건 한 명');
const r4 = D4.get('importBomappData(__f)');
ok(D4.get(`peopleList().filter(p=>p.name==='조*건').length`) === 0 && D4.get(`peopleList().filter(p=>p.name==='조유건').length`) === 1, '다시 가져오면 조*건 이 조유건 한 사람으로 합쳐짐 (둘로 안 나뉨)');
ok(D4.get(`((COVERAGES['pid_j']||{}).externalPolicies||[]).map(x=>x.bm.id).join()`) === '2' && D4.get(`CONTRACTS.filter(c=>cpid(c)==='pid_j').length`) === 1, '보맵 보험은 조유건 님 기록으로, 내가 가입시킨 계약은 그대로 한 사람 안에');
ok(D4.get(`isPlain(COVERAGES['${D4.get(`peopleList().find(p=>p.name==='김아름').pid`)}'].insuredMap) && Object.values(COVERAGES['${D4.get(`peopleList().find(p=>p.name==='김아름').pid`)}'].insuredMap)[0] === 'pid_j'`), '연결 결과가 기록(insuredMap)에 남음');
D4.ctx.__f = file([pol(1, '김아름'), pol(2, '조*건', false), pol(3, '조*건', false)]);
D4.get('importBomappData(__f)');
ok(D4.get(`peopleList().filter(p=>p.name==='조*건').length`) === 0 && D4.get(`COVERAGES['pid_j'].externalPolicies.length`) === 2, '새 보험(3)도 조유건 님에게');
D4.run(`CONTRACTS = [...CONTRACTS, {id:56, pid:'pid_k', c:'김아름', p:'조민건', co:'다라생명', n:'조민건계약', s:'계약완료', d:'25.04.04', pr:9000, g:''}]; renderAll()`);
ok(D4.get(`maskedCandidate('조*건', '김아름') === null`), '글자가 맞는 후보가 둘이면 자동으로 정하지 않음');

console.log('I) 🔎 정리가 필요한 보험 패널 (고객별 탭 맨 위) + 한 번에 옮기기');
const D5 = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([C(1, 'pid_a', '김아름')]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
D5.ctx.__f = file([pol(1, '김아름'), pol(2, '조*인', false)]);
D5.get('importBomappData(__f)');
const ar = D5.get(`peopleList().find(p=>p.name==='김아름').pid`);
D5.run(`COVERAGES['${ar}'].externalPolicies.push({id:-501, co:'가나화재', n:'어린이보험', pr:1, items:[], bm:{id:501, insured:'조*건', issue:'2014.01.01', status:'정상'}}); renderCustomers()`);
let ph = D5.el('pane-고객별').innerHTML;
ok(/정리가 필요한 보험 2건/.test(ph) && /조\*인<\/b> <span class="rm-fine">\(가려진 이름/.test(ph) && /피보험자가 <b>조\*건<\/b> 인 보험 1건/.test(ph), '가려진 이름 사람 1명 + 다른 사람 보험이 섞인 1건을 한곳에 모아 보여줌');
D5.run(`CONTRACTS = [...CONTRACTS, {id:55, pid:'pid_j', c:'김아름', p:'조유건', co:'다라생명', n:'조유건계약', s:'계약완료', d:'25.03.03', pr:9000, g:''}]; renderCustomers()`);
ph = D5.el('pane-고객별').innerHTML;
ok(/⭐ 조유건 님으로 옮기기/.test(ph), '조*건 후보(조유건)가 있으면 ⭐ 한 번에 옮기기 버튼');
D5.confirmQ.push(true);
D5.run(`moveInsuredPolicies('${ar}', '조*건', 'pid_j')`);                     // 번호 묻기 없이 바로
ok(D5.get(`((COVERAGES['pid_j']||{}).externalPolicies||[]).map(x=>x.n).join()`) === '어린이보험' && !D5.get(`COVERAGES['${ar}'].externalPolicies.some(x=>x.n==='어린이보험')`), '조유건 님 쪽으로 옮겨짐');
ok(D5.get(`Object.values(COVERAGES['${ar}'].insuredMap||{}).includes('pid_j')`), '옮긴 결과도 insuredMap 에 남아 다시 가져와도 같은 사람');
D5.run(`renderCustomers()`); ph = D5.el('pane-고객별').innerHTML;
ok(/정리가 필요한 보험 1건/.test(ph) && !/피보험자가 <b>조\*건/.test(ph), '옮기고 나면 그 항목은 패널에서 사라짐');

console.log(`\n가려진 이름 지정 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
