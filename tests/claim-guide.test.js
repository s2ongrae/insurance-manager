// 보험금 청구 서류 안내(자세히, 세 곳 같은 내용) + 고객 링크 "담당 설계사에게 꼭 확인" 안내 (가짜 데이터만)
const fs = require('fs'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const P = 'pid_claimtest';
const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '가나생명', n: '보험1', s: '계약완료', d: '25.01.01', pr: 10000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: { policies: [{ id: 1, items: [{ name: '암진단비', amount: 3000, unit: '만원' }] }] } }),
  ins_monthly: '[]', ins_groups: '{}' } });
// 출처로 확인한 핵심 내용 (손해보험협회 실손 청구서류 표준화 · 금융위 실손24 · 보험사 안내 · 상법 제662조)
const MUST = ['3만원 이하', '10만원 이하', '질병분류기호', '10만원 초과', '50만원 이하', '입퇴원확인서', '수술확인서', '조직검사 결과지', '사망진단서', '가족관계증명서', '후유장해진단서', '실손24', 'silson24.or.kr', '2025.10.25', '3년', '상법 제662조', '산부인과', '초진차트'];

(async () => {
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 고객 링크: 맨 위 "담당 설계사에게 꼭 확인" 안내');
D.bodyHtml = ''; D.run(`showCustomerView('${P}','')`);
const cv = D.bodyHtml;
const notice = cv.indexOf('class="cv-notice"');
ok(notice > 0 && /반드시 담당 설계사/.test(cv.slice(notice, notice + 400)) && /실제 계약과 다를 수 있어요/.test(cv.slice(notice, notice + 400)), '안내 문구: 실제와 다를 수 있음 + 반드시 담당 설계사에게 확인');
ok(notice < cv.indexOf('분야별 보장 합계') && notice < cv.indexOf('보험별 담보 내역'), '보장 내용보다 위에 보임');
ok(/보험별 담보 내역 <small>[^<]*담당 설계사에게 꼭 확인/.test(cv), '보험별 담보 내역 제목에도 한 번 더');

console.log('B) 고객 링크: 청구 서류 안내가 자세하게');
const cg = cv.slice(cv.indexOf('보험금 청구 서류 안내'), cv.indexOf('</details>', cv.indexOf('class="cg-grid"')));
const miss = MUST.filter(w => !cg.includes(w));
ok(miss.length === 0, '핵심 내용이 모두 있음 (빠진 것: ' + miss.join(', ') + ')');
ok((cg.match(/class="cg-card"/g) || []).length === 11, '항목 11개 (공통·실손 통원·입원·입원일당·수술·진단·교통/상해·후유장해·사망·실손24·꼭 알아두세요)');
ok(/담당 설계사에게 연락/.test(cg) && !/출처:/.test(cg), '고객에게는 "설계사에게 연락" 안내 (출처 메모는 관리 화면에만)');

console.log('C) 관리 화면 "청구 서류 안내" 탭과 📋 청구 서류 팝업도 같은 내용');
D.run(`renderCoverageTab('청구서류')`);
const tab = D.el('pane-보장분석').innerHTML;
ok(MUST.every(w => tab.includes(w)) && /출처: 손해보험협회/.test(tab), '탭: 같은 내용 + 출처');
D.run(`openDocGuide()`);
const pop = D.el('docguide-body').innerHTML;
ok(MUST.every(w => pop.includes(w)), '팝업: 같은 내용');
const modal = html.slice(html.indexOf('id="modal-docguide"'), html.indexOf('<!-- 기존 보험 추가 모달 -->'));
ok(!/\$\{/.test(modal), '팝업 고정 HTML 에 코드 조각(${...})이 글자로 보이지 않음 (예전 버그)');
ok(/onclick="openDocGuide\(\)"/.test(html) && !/onclick="[^"]*openModal\('docguide'\)/.test(html), '📋 청구 서류 버튼은 내용을 채워서 열기');

console.log('D) 비교 분석 탭 안내에도 설계사 확인');
ok(/결정 전에 반드시 담당 설계사에게 확인/.test(D.get(`compareTabHtml({at:'2026-11-12T00:00:00Z',beforeTotal:1,afterTotal:1,items:[],policies:[]},{blocks:{}})`)), '비교 분석 안내 문구');

console.log(`\n청구 서류 안내 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
