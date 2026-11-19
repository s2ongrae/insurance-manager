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

console.log(`\n가려진 이름 지정 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
