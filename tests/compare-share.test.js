// 고객용 비교 분석 자료: 만들기 스위치 · 내용 블록 · 공개(고정 숫자) · 최신 아님 표시 · 공개 중지 · 고객 링크 탭 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const PID = 'pid_cmptest1';
const ls = {
  ins_contracts: JSON.stringify([{ id: 1, pid: PID, c: '가나다', p: '가나다', co: '가나생명', n: '새건강보험', s: '가입 예정', d: '26.11.20', pr: 85000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [PID]: {
    policies: [{ id: 1, items: [{ name: '암진단비', amount: 5000, unit: '만원' }] }],
    externalPolicies: [{ id: -5, co: '마바손해보험', n: '옛실손보험', pr: 23000, items: [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '질병입원의료비', amount: 5000, unit: '만원' }] }] } }),
  ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}'
};
const rec = D => D.get(`COVERAGES['${PID}']`);
const cvHtml = D => { D.bodyHtml = ''; D.run(`showCustomerView('${PID}', '')`); return D.bodyHtml; };   // 가짜 화면은 고객 화면 HTML 을 이어 붙이므로 매번 비움

(async () => {
const D = makeDevice({ session: { ins_unlocked: '1' }, ls });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
D.run(`setRemodelRole('${PID}', 1, 'after'); setRemodelRole('${PID}', -5, 'before')`);

console.log('A) 기본은 꺼짐: 관리 화면에 스위치만, 고객 링크에는 탭 없음');
D.run(`renderCovDetail('${PID}')`);
let cd = D.el('cov-detail').innerHTML;
ok(/고객용 비교 분석 자료 만들기/.test(cd) && /onchange="setCompareMake\('pid_cmptest1',this.checked\)"/.test(cd), '전체 비교 칸에 "고객용 비교 분석 자료 만들기" 스위치');
ok(!/cs-blocks/.test(cd), '꺼져 있으면 내용 설정 칸 안 보임');
let cv = cvHtml(D);
ok(!/cv-tabs/.test(cv) && !/비교 분석/.test(cv), '고객 링크에 비교 분석 탭 없음');

console.log('B) 켜기 → 내용 블록 설정 (아직 공개 전)');
D.run(`setCompareMake('${PID}', true)`);
ok(D.get(`compareShareOf('${PID}').make===true && compareShareOf('${PID}').on===false`), '만들기 켜짐, 공개는 아직');
cd = D.el('cov-detail').innerHTML;
ok((cd.match(/setCompareBlock\(/g) || []).length === 6, '내용 블록 체크 6개');
ok(/👀 고객 화면 미리보기/.test(cd) && /보장 변경 안내/.test(cd), '미리보기 (고객 화면과 같은 내용)');
ok(!rec(D).compareShare.snap, '공개 전에는 숫자(snap)를 저장하지 않음 → 고객 응답 데이터에도 없음');
ok(!/cv-tabs/.test(cvHtml(D)), '공개 전에는 고객 링크에 탭 없음');

console.log('C) 공개 → 고객 링크에 📋 내 보장 / 🔄 비교 분석 탭');
D.run(`publishCompare('${PID}')`);
const snap = rec(D).compareShare.snap;
ok(snap && snap.at && snap.beforeTotal === 23000 && snap.afterTotal === 85000, '공개한 순간의 숫자 저장 (변경 전 23,000 · 후 85,000)');
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${PID}'].compareShare.on===true`), '저장·동기화 대상(coverages)에 기록');
cv = cvHtml(D);
ok(/class="cv-tabs"/.test(cv) && /📋 내 보장/.test(cv) && /🔄 비교 분석/.test(cv), '고객 링크에 탭 2개');
ok(/id="cv-pane-cmp" style="display:none/.test(cv), '처음엔 내 보장 탭이 보이고 비교 분석은 숨김');
const cmp = cv.slice(cv.indexOf('id="cv-pane-cmp"'), cv.indexOf('id="cv-pane-cov"'));
ok(/23,000원/.test(cmp) && /85,000원/.test(cmp) && /\+62,000원/.test(cmp), '보험료 요약: 지금 → 바꾼 뒤 → 차이');
ok(/📈 늘어나는 보장 1개/.test(cmp) && /암진단비/.test(cmp) && /3천만원 → 5천만원/.test(cmp), '늘어나는 보장: 암진단비 3천만원 → 5천만원');
ok(/✖️ 없어지는 보장 1개/.test(cmp) && /질병입원의료비/.test(cmp), '없어지는 보장: 질병입원의료비');
ok(/🗑️ 해지 1건/.test(cmp) && /🆕 새로 가입 1건/.test(cmp), '보험 정리: 해지 1 · 신규 1');
ok(/바꾸기 전에 꼭 확인하세요/.test(cmp), '바꿀 때 알아둘 점 (기본 켜짐)');
ok(!/담당 설계사 설명/.test(cmp) && !/그대로인 보장/.test(cmp), '설계사 한마디·그대로인 보장은 기본 꺼짐');
D.run(`cvTab('cmp')`);
ok(D.get(`document.getElementById('cv-pane-cmp').style.display===''`) && D.get(`document.getElementById('cv-pane-cov').style.display==='none'`), '탭을 누르면 비교 분석으로 바뀜');

console.log('D) 블록 끄고 켜기 · 설계사 한마디 (글자 그대로)');
D.run(`setCompareBlock('${PID}', 'caution', false); setCompareBlock('${PID}', 'note', true); setCompareNote('${PID}', '<img src=x onerror=alert(1)> 실손 전환')`);
cv = cvHtml(D);
ok(!/바꾸기 전에 꼭 확인하세요/.test(cv), '끈 블록은 고객 화면에서 빠짐');
ok(/담당 설계사 설명/.test(cv) && /&lt;img src=x/.test(cv) && !/<img src=x/.test(cv), '설계사 한마디는 글자 그대로 (태그 실행 안 됨)');
D.run(`setCompareBlock('${PID}', 'nope', true)`);
ok(D.get(`!('nope' in (COVERAGES['${PID}'].compareShare.blocks||{}))`), '없는 블록 이름은 무시');

console.log('E) 공개 뒤 담보를 고치면 "최신 아님", 고객은 공개한 숫자 그대로');
D.run(`COVERAGES['${PID}'].policies[0].items[0].amount = 7000; renderCovDetail('${PID}')`);
ok(D.get(`compareIsStale('${PID}')`), '최신 아님 감지');
ok(/최신 아님/.test(D.el('cov-detail').innerHTML) && /최신 내용으로 다시 공개/.test(D.el('cov-detail').innerHTML), '관리 화면에 최신 아님 표시 + 다시 공개 버튼');
ok(/3천만원 → 5천만원/.test(cvHtml(D)), '고객 화면은 다시 공개 전까지 공개한 숫자 그대로');
D.run(`publishCompare('${PID}')`);
ok(!D.get(`compareIsStale('${PID}')`) && /3천만원 → 7천만원/.test(cvHtml(D)), '다시 공개하면 새 숫자');

console.log('E2) 공개 시각은 한국 시간으로 표시');
D.run(`COVERAGES['${PID}'].compareShare.snap.at = '2026-11-10T16:30:00.000Z'; renderCovDetail('${PID}')`);   // 한국 시간 11월 11일 01:30
ok(/2026\.11\.11 01:30/.test(D.el('cov-detail').innerHTML), '관리 화면: 2026.11.11 01:30 (국제 표준시 그대로 쓰면 11.10 16:30)');
ok(/2026\.11\.11 기준/.test(cvHtml(D)), '고객 화면: 2026.11.11 기준');

console.log('F) 공개 중지 · 만들기 끄기');
D.run(`unpublishCompare('${PID}')`);
ok(!rec(D).compareShare.snap && rec(D).compareShare.on === false, '공개 중지하면 숫자(snap)도 지움');
ok(!/cv-tabs/.test(cvHtml(D)), '고객 링크에서 탭 사라짐');
D.run(`COVERAGES['${PID}'].compareShare = Object.assign({}, COVERAGES['${PID}'].compareShare, {on:false, snap:{at:'2026-11-11T00:00:00', beforeTotal:1, afterTotal:2, items:[], policies:[]}})`);
ok(!/cv-tabs/.test(cvHtml(D)), '공개가 꺼져 있으면 숫자가 남아 있어도(다른 기기·옛 데이터) 탭을 안 띄움');
D.run(`delete COVERAGES['${PID}'].compareShare.snap`);
ok(rec(D).compareShare.note && rec(D).compareShare.blocks.note === true, '설정한 블록·한마디는 남아 있음');
D.run(`publishCompare('${PID}'); setCompareMake('${PID}', false)`);
ok(rec(D).compareShare.make === false && rec(D).compareShare.on === false && !rec(D).compareShare.snap, '만들기를 끄면 공개도 함께 내림');
ok(!/cv-tabs/.test(cvHtml(D)), '고객 링크에 탭 없음');

console.log('G) 비교할 보험이 없으면 공개 안 됨');
D.run(`setRemodelRole('${PID}', 1, 'none'); setRemodelRole('${PID}', -5, 'none'); publishCompare('${PID}')`);
ok(rec(D).compareShare.on === false, '상태를 고른 보험이 없으면 공개하지 않음');

console.log('H) 실제 서버 코드(Code.gs): 고객 링크 응답에 비교 자료는 가고, 리포트 비밀번호는 안 감');
{ const S = require('./lib/ins_fake_server.js')(); const TOK = 't'.repeat(48);
  const data = { contracts: [{ id: 1, pid: PID, c: '가나다', p: '가나다', co: '가나생명', n: 'B', s: '계약완료', d: '25.01.01', pr: 1 }], monthly: [], groups: {}, memos: {}, reminders: {},
    settings: { covGroups: { list: [] }, bomapp: { reportPw: 'PW-TEST' } }, shares: { [PID]: TOK },
    coverages: { [PID]: { policies: [], compareShare: { make: true, on: true, blocks: { premium: true }, note: '', snap: { at: '2026-11-11T00:00:00Z', beforeTotal: 1, afterTotal: 2, items: [], policies: [] } } } } };
  ok(S.post({ action: 'save', key: S.KEY, baseRev: 0, data, force: true }).ok, '가짜 서버에 저장');
  const r = S.post({ action: 'getCustomerView', name: '가나다', token: TOK });
  ok(r.ok && r.coverages && r.coverages[PID] && r.coverages[PID].compareShare && r.coverages[PID].compareShare.snap.afterTotal === 2, '고객 응답에 공개한 비교 자료가 들어감 (서버 수정 없이 동작)');
  ok(!JSON.stringify(r).includes('PW-TEST'), '보맵 리포트 비밀번호(settings.bomapp)는 고객 응답에 없음'); }

console.log(`\n비교 분석 자료 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
