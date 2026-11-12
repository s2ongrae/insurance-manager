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
const items2 = [{ name: '암진단비', amount: 3000, unit: '만원' }, { name: '특정암진단비', amount: 1000, unit: '만원' }];   // 둘 다 "일반암 진단비"로 합쳐짐
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '암진단비': { [PK]: 5000 } } });
ok(cards(D).includes('일반암 진단비 6천만원'), '암진단비를 5천만원으로 고쳐 뒀으면 합친 줄 = 5천 + 특정암 1천 = 6천만원 (실제: ' + cards(D).join(' / ') + ')');
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '특정암진단비': { __hidden: true } } });
ok(cards(D).includes('일반암 진단비 3천만원'), '특정암진단비를 숨겨 뒀으면 합친 줄에서 그 몫을 뺌 = 3천만원 (실제: ' + cards(D).join(' / ') + ')');
D = dev({ policies: [{ id: 1, items: items2 }], matrixView: { '암진단비': { __hidden: true }, '특정암진단비': { __hidden: true } } });
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

console.log(`\n담보 이름 옮기기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
