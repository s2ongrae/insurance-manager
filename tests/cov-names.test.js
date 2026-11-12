// 담보 이름 표준 통합(bdb800d) 뒤처리: 예전 이름으로 저장된 표 수정값 옮기기 (가짜 데이터만)
const fs = require('fs'), path = require('path');
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_namestest', PK = '가나생명\n보험1';
const dev = cov => makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '가나생명', n: '보험1', s: '계약완료', d: '25.01.01', pr: 10000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: cov }), ins_monthly: '[]', ins_groups: '{}' } });
const items = [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '질병입원일당', amount: 3, unit: '만원' }, { name: '상해입원일당', amount: 2, unit: '만원' }];
const cards = D => { D.bodyHtml = ''; D.run(`showCustomerView('${P}','')`); const cv = D.bodyHtml; const c = cv.slice(cv.indexOf('cv-cards'), cv.indexOf('cv-mtx'));
  return [...c.matchAll(/cv-row-name">([^<]*)<\/span><span class="cv-row-amt"[^>]*>([^<]*)</g)].map(m => m[1] + ' ' + m[2]); };

(async () => {
console.log('A) 예전 이름으로 직접 고친 값이 고객 화면에 두 번 나오던 문제');
let D = dev({ policies: [{ id: 1, items }], matrixView: { '암진단비': { [PK]: 5000 } }, matrixNames: { '암진단비': '암 진단(내가 바꾼 이름)' }, itemOrder: ['상해입원일당', '암진단비', '질병입원일당'] });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
let c = cards(D);
ok(c.filter(x => /암/.test(x)).length === 1 && c.includes('암 진단(내가 바꾼 이름) 5천만원'), '암 진단은 한 줄만, 직접 고친 5천만원 + 바꾼 이름 그대로 (실제: ' + c.join(' / ') + ')');
const rec = D.get(`COVERAGES['${P}']`);
ok(rec.matrixView['일반암 진단비'] && rec.matrixView['일반암 진단비'][PK] === 5000 && !('암진단비' in rec.matrixView), '저장된 수정값 열쇠가 새 이름으로 옮겨짐');
ok(rec.matrixNames['일반암 진단비'] === '암 진단(내가 바꾼 이름)' && !('암진단비' in rec.matrixNames), '바꾼 표시 이름도 옮겨짐');
ok(JSON.stringify(rec.itemOrder) === JSON.stringify(['상해 입원일당', '일반암 진단비', '질병 입원일당']), '순서도 새 이름으로: ' + JSON.stringify(rec.itemOrder));
ok(D.get(`JSON.parse(localStorage.getItem('ins_coverages'))['${P}'].matrixView['일반암 진단비']['${PK.replace('\n', '\\n')}']===5000`), '옮긴 결과가 저장·동기화 대상에 기록');

console.log('B) 예전 이름 두 개가 새 이름 하나로 합쳐질 때 합계가 그대로');
const items2 = [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '일반암진단비', amount: 1000, unit: '만원' }];   // 표기만 다른 같은 담보 → 둘 다 "일반암 진단비"
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '암진단비': { [PK]: 5000 } } });
ok(cards(D).includes('일반암 진단비 6천만원'), '암진단비를 5천만원으로 고쳐 뒀으면 합친 줄 = 5천 + 일반암진단비 1천 = 6천만원 (실제: ' + cards(D).join(' / ') + ')');
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '일반암진단비': { __hidden: true } } });
ok(cards(D).includes('일반암 진단비 3천만원'), '일반암진단비를 숨겨 뒀으면 합친 줄에서 그 몫을 뺌 = 3천만원 (실제: ' + cards(D).join(' / ') + ')');
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '암진단비': { __hidden: true }, '일반암진단비': { __hidden: true } } });
ok(!cards(D).some(x => /암/.test(x)) && D.get(`COVERAGES['${P}'].matrixView['일반암 진단비'].__hidden===true`), '둘 다 숨겨 뒀으면 합친 줄도 숨김');

console.log('B2) 질병·상해 입원일당은 따로 (사용자 요청 2026-11-12)');
D = dev({ policies: [{ id: 1, items }] });
ok(cards(D).includes('질병 입원일당 3만원') && cards(D).includes('상해 입원일당 2만원') && !cards(D).some(x => /질병·상해/.test(x)), '질병 3만원 · 상해 2만원 각각 (실제: ' + cards(D).join(' / ') + ')');
ok(D.get(`normCovName('질병상해입원일당')==='질병·상해 입원일당' && normCovName('입원일당')==='입원일당' && normCovName('상해입원일당(1일이상)')==='상해 입원일당'`), '한 담보가 둘 다 보장할 때만 질병·상해, 구분 없으면 입원일당');
D = dev({ policies: [{ id: 1, items }], matrixView: { '질병입원일당': { [PK]: 10 } } });
ok(cards(D).includes('질병 입원일당 10만원') && cards(D).includes('상해 입원일당 2만원'), '예전에 질병입원일당을 10만원으로 고쳐 둔 값은 질병 줄로만 옮겨짐');
D = dev({ policies: [{ id: 1, items }], matrixView: { '암진단비': { [PK]: 5000, __group: '🏥 실손의료비' } } });
ok(D.get(`COVERAGES['${P}'].matrixView['일반암 진단비'].__group==='🏥 실손의료비'`), '직접 옮긴 분야(그룹)도 유지');

console.log('C) 새 이름으로 이미 고친 값이 있으면 그게 우선 · 여러 번 해도 같음');
D = dev({ policies: [{ id: 1, items }], matrixView: { '암진단비': { [PK]: 5000 }, '일반암 진단비': { [PK]: 7000 } } });
ok(D.get(`COVERAGES['${P}'].matrixView['일반암 진단비']['${PK.replace('\n', '\\n')}']===7000`), '새 이름 값(7000) 우선');
ok(D.get(`migrateCovNames(COVERAGES['${P}'], CONTRACTS).changed===false`), '한 번 옮긴 뒤에는 다시 바뀌지 않음');

console.log('D) 고객 링크가 먼저 열려도(설계사가 아직 새 버전을 안 열어서 예전 이름 그대로) 화면은 맞게, 저장은 안 함');
D = dev({ policies: [{ id: 1, items }] });
D.run(`COVERAGES['${P}'] = Object.assign({}, COVERAGES['${P}'], {matrixView: {'암진단비': {'${PK.replace('\n', '\\n')}': 5000}}})`);
ok(cards(D).filter(x => /암/.test(x)).join() === '일반암 진단비 5천만원', '고객 화면: 한 줄, 5천만원');
ok(D.get(`'암진단비' in COVERAGES['${P}'].matrixView`), '고객 화면은 데이터를 바꾸지 않음');

console.log('E) 표준 이름은 다시 넣어도 그대로 (고정점)');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const i = html.indexOf('function normCovName(name) {');
D.ctx.__o = [...new Set([...html.slice(i, html.indexOf('function', i + 30)).matchAll(/return '([^']+)';/g)].map(m => m[1]))];
const bad = D.get(`__o.filter(o=>normCovName(o)!==o)`);
ok(D.get('__o.length') > 40 && bad.length === 0, '표준 이름 ' + D.get('__o.length') + '개 모두 그대로 (바뀌는 것: ' + bad.join(', ') + ')');

console.log('F) 같은 담보만 묶고 다른 담보는 따로 (사용자 요청 2026-11-12)');
{ const N = n => D.get(`normCovName(${JSON.stringify(n)})`);
  const SAME = [['암진단비', '일반암진단비', '암진단비(유사암제외)', '(무)암진단비Ⅱ(갱신형)'], ['유사암진단비', '소액암진단비'], ['질병입원일당', '질병입원일당(1일이상)'], ['상해후유장해(3%~100%)', '상해후유장해(3~100%)']];
  SAME.forEach(g => ok(new Set(g.map(N)).size === 1, '같은 담보로 묶음: ' + g.join(' / ') + ' → ' + g.map(N).join(' | ')));
  ok(N('암진단비(유사암제외)') === '일반암 진단비', '"암진단비(유사암제외)"는 일반암 (예전엔 괄호 안 유사암 때문에 유사암으로 감)');
  const DIFF = [['암진단비', '특정암진단비', '주요암진단비', '통합암진단비', '고액암진단비', '재진단암진단비', '유사암진단비', '갑상선암진단비'],
    ['암수술비', '유사암수술비'], ['항암약물치료비', '항암방사선치료비'], ['상해후유장해(3%~100%)', '상해후유장해(80%이상)'], ['질병후유장해(3%~100%)', '질병후유장해(80%이상)'],
    ['운전자벌금(대인)', '운전자벌금(대물)', '스쿨존벌금'], ['일상생활배상책임', '가족일상생활배상책임', '화재배상책임'],
    ['임플란트치료비', '브릿지치료비', '틀니치료비', '크라운치료비', '레진충전치료비'], ['질병수술비', '16대질병수술비', '질병수술비(1-7종)(1종)', '질병수술비(1-5종)(1종)'],
    ['질병입원일당', '상해입원일당', '중환자실입원일당', '상급종합병원입원일당'], ['뇌졸중진단비', '뇌경색증진단비', '뇌출혈진단비', '뇌혈관질환진단비'], ['12대기관양성신생물수술비', '통합양성신생물수술비'], ['골절진단비', '5대골절진단비']];
  DIFF.forEach(g => ok(new Set(g.map(N)).size === g.length, '따로 보임: ' + g.map(N).join(' | ')));
  ok(N('고위험임신진단비') !== '위·대장 용종(폴립) 진단비', '"위" 한 글자로 용종 담보에 엉뚱하게 들어가지 않음'); }

console.log('G) 기존 고객 다듬기: 한때 한 줄로 묶여 고쳐 둔 값(일반암 6천 = 암 3천+특정암 1천을 6천으로)도 나뉜 뒤 합계 그대로');
D = dev({ policies: [{ id: 1, items: [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '특정암진단비', amount: 1000, unit: '만원' }] }], matrixView: { '일반암 진단비': { [PK]: 6000 } } });
c = cards(D);
ok(c.includes('일반암 진단비 5천만원') && c.includes('특정암 진단비 1천만원'), '일반암 5천만원(직접 고친 차이 포함) + 특정암 1천만원 = 6천만원 그대로 (실제: ' + c.join(' / ') + ')');
ok(D.get(`COVERAGES['${P}'].covNameVer`) === 3 && D.get(`migrateCovNames(COVERAGES['${P}'], CONTRACTS).changed===false`), '한 번 다듬은 뒤에는 다시 바뀌지 않음');
D = dev({ policies: [{ id: 1, items }], matrixView: { '빈설정줄': {} }, itemOrder: ['없는담보', '암진단비'], matrixNames: { '없는담보': 'x' } });
const r2 = D.get(`COVERAGES['${P}']`);
ok(!('빈설정줄' in r2.matrixView), '담보도 값도 없는 빈 설정은 정리');
ok(!r2.itemOrder.includes('없는담보') && !('없는담보' in r2.matrixNames), '없는 담보의 순서·이름 설정 정리');

console.log(`\n담보 이름 옮기기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
