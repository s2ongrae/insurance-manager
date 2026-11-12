const {makeDevice, html} = require('./lib/ins_smoke_harness.js');
let pass=0, fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++;console.log('  ❌',m);} };
const C=(id,x={})=>Object.assign({id,s:'계약완료',d:'26.0'+(id%9+1)+'.01',c:'계약자'+(id%4),p:'가입자'+(id%3),co:['삼성화재','현대해상','메리츠화재'][id%3],n:'종합'+id,pr:10000+id*100,g:['가족A','가족B','지인들'][id%3]},x);
const contracts=[...Array(9)].map((_,i)=>C(i+1)); contracts[2].s='계약해지'; contracts[2].ed='26.09.01'; contracts[4].s='가입 예정';
const cov={ '가입자1':{ policies:[{id:1,payPeriod:'20년납',covPeriod:'100세',renewable:'비갱신형',items:[{name:'암진단비(유사암제외)',amount:3000,unit:'만원',price:20000},{name:'뇌혈관질환진단비',amount:2000,unit:'만원',price:8000},{name:'상해사망',amount:1000,unit:'만원',price:100},{name:'자동차사고부상보장A',amount:500,unit:'만원',price:0}]},{id:4,items:[{name:'암진단비',amount:1000,unit:'만원',price:5000},{name:'5대장기이식수술담보',amount:1000,unit:'만원',price:0}]}],
  matrixView:{'암진단비':{'삼성화재\n종합1':4500}, '가짜항목':{'__group':'🏥 실손의료비','삼성화재\n종합1':100}, '숨길항목':{__hidden:true}}, matrixNames:{'뇌혈관질환진단비':'뇌혈관'}, itemOrder:['암진단비','뇌혈관질환진단비'], externalPolicies:[{id:-5,co:'외부화재',n:'외부종합',pr:12000,items:[{name:'암진단비',amount:500,unit:'만원',price:0}]}] },
  '가입자2':{policies:[]} };
const memos={'1':'첫 줄 메모\n둘째 줄','2':'<b>태그</b> 메모'};
const monthly=[{m:'26.01',k:2,before:1000000,after:900000,tax:0,memo:''},{m:'26.02',k:1,before:2000000,after:1800000,tax:10,memo:'연말'}];

(async()=>{
console.log('A) 시작·렌더링 (서버 설정 없음)');
const D=makeDevice({ls:{ins_contracts:JSON.stringify(contracts),ins_monthly:JSON.stringify(monthly),ins_groups:JSON.stringify({'가족A':'#3B5BDB','가족B':'#C2255C','지인들':'#868E96'}),ins_coverages:JSON.stringify(cov),ins_memos:JSON.stringify(memos)},session:{ins_unlocked:'1'}});
ok(D.errors.length===0,'스크립트 로드 오류 없음 '+D.errors.join('|'));
{ const hdr=(html.match(/<div class="hdr-links">[\s\S]*?<\/div>/)||[''])[0];
  ok(/href="https:\/\/s2ongrae\.github\.io\/"[^>]*>[^<]*<span>포털/.test(hdr),'상단에 포털 링크');
  ok(/href="https:\/\/s2ongrae\.github\.io\/gaegyebu"[^>]*>[^<]*<span>가계부/.test(hdr),'상단에 가계부 링크');
  ok(/href="https:\/\/s2ongrae\.github\.io\/prediag\/"[^>]*>[^<]*<span>사전진단/.test(hdr),'상단에 사전진단툴 링크');
  ok((hdr.match(/<a class="hdr-link"/g)||[]).length===3,'상단 링크는 포털·가계부·사전진단 3개');
  ok((hdr.match(/rel="noopener"/g)||[]).length===3 && (hdr.match(/target="_blank"/g)||[]).length===3,'새 탭 링크는 모두 rel=noopener');
  const app=html.indexOf('<div id="app-wrap"'), cust=html.indexOf('<div class="hdr-links">');
  ok(app>0 && cust>app,'링크는 app-wrap 안에 있어서 고객 전용 화면에는 안 보임'); }
const tabs=[['리스트','list-results'],['그룹별','pane-그룹별'],['고객별','pane-고객별'],['월별','pane-월별'],['보장분석','pane-보장분석']];
for(const [t,id] of tabs){
  try{ D.run(`currentTab='${t}'; renderTab('${t}')`); ok(D.el(id).innerHTML.length>200, `${t} 탭 렌더링 (${D.el(id).innerHTML.length}자)`); }
  catch(e){ ok(false,`${t} 탭 렌더링 오류: ${e.message}`); }
}
console.log('B) 상단 요약(KPI)');
D.run('renderAll()'); const kp=D.el('kpis').innerHTML; ok((kp.match(/class="kpi /g)||[]).length===5,'상단 요약 카드 5개 (총 계약·완료·해지·예정·월 보험료)'); ok(/완료/.test(kp)&&/월 보험료/.test(kp),'요약 카드 내용');
console.log('C) 리스트 구성요소');
const list=D.el('list-results').innerHTML;
ok(/완료 계약 월보험료 합계/.test(list),'월보험료 합계 표시');
ok(!/<b>태그<\/b>/.test(list),'메모 미리보기의 태그가 실행되지 않음');
ok(/첫 줄 메모/.test(list),'메모 첫 줄 미리보기 표시');
D.run("filterOpen=true; fStatus=new Set(['계약완료']); renderList()");
const fa=D.el('filter-area').innerHTML, lr=D.el('list-results').innerHTML;
ok(D.el('filter-area').style.display==='block','필터를 열면 패널이 보임');
ok((fa.match(/toggleFilter\(/g)||[]).length>=3+3+3+3,'필터 칩 버튼이 상태·그룹·가입월·보험사 모두 그려짐 ('+(fa.match(/toggleFilter\(/g)||[]).length+'개)');
ok(/data-t="status"/.test(fa)&&/data-t="groups"/.test(fa)&&/data-t="months"/.test(fa)&&/data-t="cos"/.test(fa),'필터 4종류(상태·그룹·가입월·보험사) 구분');
ok(/전체 해제/.test(lr)&&/clearAllFilters\(\)/.test(lr),'적용 중인 필터가 있으면 "전체 해제" 버튼');
ok(/removeOneFilter\(this\.dataset\.v\)/.test(lr),'적용 필터 칩의 × 버튼');
ok(/필터 \(1\)/.test(D.el('filter-btn').textContent),'필터 버튼에 적용 개수 표시: '+D.el('filter-btn').textContent);
D.run("toggleFilter('groups','가족A')");
ok(D.el('filter-btn').textContent.includes('(2)'),'칩을 누르면 적용 개수가 2로 늘어남: '+D.el('filter-btn').textContent);
ok(Number((D.el('list-results').innerHTML.match(/class="cnt"[^>]*>(\d+)건/)||[])[1])===2,'상태=계약완료 + 그룹=가족A 조건으로 정확히 2건만 남음 (id 6, 9)');
const cntBefore=(D.el('list-results').innerHTML.match(/class="cnt"[^>]*>(\d+)건/)||[])[1];
D.run("clearAllFilters()"); ok(D.el('filter-btn').textContent==='⚙️ 필터'&&!/전체 해제/.test(D.el('list-results').innerHTML),'전체 해제하면 필터가 모두 풀림');
ok(Number((D.el('list-results').innerHTML.match(/class="cnt"[^>]*>(\d+)건/)||[])[1])===9,'전체 해제 후 9건 모두 표시');
D.run("filterOpen=false; renderList()"); ok(D.el('filter-area').style.display==='none','닫으면 패널 숨김');
console.log('D) 정리한 코드');
ok(!/id="modal-memo"/.test(html)&&!/scheduleSearch|renderEditTable|toggleCovEditMode|openMemoModal/.test(html),'안 쓰는 메모 모달·옛 함수가 남아 있지 않음');
console.log('D2) 중복 DOM');
ok((html.match(/id="sq-inp"/g)||[]).length===1,'검색창 id 중복 없음');
console.log('E) 보장분석 상세');
try{ D.run(`selectedCovCustomer=legacyPid('가입자1'); renderCoverageTab('보장분석')`); const cd=D.el('cov-detail').innerHTML;
  ok(cd.length>1000,'보장분석 상세 렌더링'); ok(/뇌혈관/.test(cd),'매트릭스 이름 변경(matrixNames) 반영'); ok(/renamePerson\(/.test(cd)&&/mergePerson\(/.test(cd)&&/splitPerson\(/.test(cd),'✏️ 이름 변경 · 🔀 합치기 · ✂️ 분리 버튼이 보장분석 화면에 있음'); ok(/가입자1 님의 보장 분석/.test(cd),'제목에 사람 이름 표시'); ok(!/숨길항목/.test(cd),'숨긴 행(__hidden)은 안 보임'); ok(/외부화재/.test(cd),'외부 보험 컬럼 표시'); ok(!/가짜항목/.test(cd),'금액 없는 매트릭스 전용 행은 기본으로 숨김');
  D.run(`window._mtxShowEmpty=true; renderCovDetail(selectedCovCustomer)`); ok(/가짜항목/.test(D.el('cov-detail').innerHTML),'"금액 없는 담보도 보기"를 켜면 매트릭스 전용 행 표시'); D.run(`window._mtxShowEmpty=false`);
}catch(e){ ok(false,'보장분석 상세 오류: '+e.message); }
console.log('F) 고객 화면');
try{ D.run(`showCustomerView(legacyPid('가입자1'),'가입자1')`); const html2=D.bodyHtml; ok(html2.includes('cv-screen')&&/가입자1/.test(html2),'고객 화면 렌더링'); ok(/청구 서류/.test(html2),'청구 서류 안내'); ok(!/<b>태그<\/b>/.test(html2)&&!/메모/.test(html2.replace(/청구 서류[\s\S]*?(?=<)/,'')) ,'고객 화면에 메모 없음'); }
catch(e){ ok(false,'고객 화면 오류: '+e.message); }
console.log('G) 보장분석 가독성 (외부 보험 포함 합계·폰 카드·머리줄)');
try{
  const it=(n,a,p)=>({name:n,amount:a,unit:'만원',price:p});
  const gc=[{id:1,s:'계약완료',d:'25.03.10',c:'갑',p:'갑',pid:'pid_g1',co:'삼성화재',n:'건강A',pr:85000,g:''},
            {id:2,s:'계약완료',d:'25.07.02',c:'갑',p:'갑',pid:'pid_g1',co:'메리츠화재',n:'종합B',pr:62000,g:''}];
  const gcov={pid_g1:{policies:[{id:1,payPeriod:'20년납',covPeriod:'100세',renewable:'비갱신',items:[it('유사암진단비',600,1800)]},{id:2,items:[it('뇌졸중진단비',500,4000)]}],
    externalPolicies:[{id:-1,co:'DB손해보험',n:'실손<b>X</b>',pr:21000,items:[it('질병입원의료비',5000,8000),it('질병통원의료비',20,4000)]}]}};
  const G=makeDevice({ls:{ins_contracts:JSON.stringify(gc),ins_coverages:JSON.stringify(gcov),ins_groups:'{}',ins_monthly:'[]'}});
  ok(G.errors.length===0,'G 기기 로드 오류 없음 '+G.errors.join('|'));
  G.run(`selectedCovCustomer='pid_g1'; renderCoverageTab('보장분석')`); const cd=G.el('cov-detail').innerHTML;
  ok(/class="cov-sum"/.test(cd)&&/168,000원/.test(cd),'관리 화면 요약 카드: 월 보험료 168,000원 (외부 21,000 포함)');
  { const parts=cd.split('📊 보장 합산 매트릭스'), mx=(parts[1]||'').split('🔄 기존 → 변경 비교');
    ok(/class="ntbl"/.test(parts[0])&&/class="mtx-sum"/.test(mx[0])&&/rm-workspace/.test(cd)&&/rm-change-table/.test(cd),'관리 화면 개요 표·매트릭스 합계 보기와 새 비교 카드/변화표가 표시됨'); }
  G.run(`window._mtxMode='full'; renderCovDetail('pid_g1')`);
  { const mx2=(G.el('cov-detail').innerHTML.split('📊 보장 합산 매트릭스')[1]||'');
    ok(/class="mtx-scroll"/.test(mx2)&&/class="ntbl"/.test(mx2)&&/inlineEditCell/.test(mx2),'"보험별 표 (편집)"로 바꾸면 스크롤 표(머리줄 고정)와 편집 칸'); }
  G.run(`window._mtxMode='sum'`);
  ok((cd.match(/📋 보험별 담보 내역/g)||[]).length===1,'"보험별 담보 내역" 제목이 한 번만');
  ok(/updateCovItem\([^)]*'price'/.test(cd),'담보 줄에 보험료 입력칸 (머리줄 5칸과 맞음)');
  ok(!/실손<b>X<\/b>/.test(cd)&&/실손&lt;b&gt;X/.test(cd),'관리 화면 보험명은 글자 그대로(태그 실행 안 됨)');
  ok(/실손의료비[\s\S]{0,400}질병입원 ?의료비/.test(cd.replace(/<[^>]+>/g,' ')),'기본 그룹에서 "의료비" 담보는 실손의료비로 분류');
  G.run(`showCustomerView('pid_g1','갑')`); const cv=G.bodyHtml;
  ok(/168,000원/.test(cv),'고객 화면 월 보험료에 외부 보험 포함 (168,000원)');
  ok(/class="cv-cards"/.test(cv)&&/class="cv-mtx cv-mtx-d"/.test(cv),'고객 화면: 합계 카드(cv-cards) + 접힌 보험별 표(cv-mtx)');
  ok(/class="cv-row-name">질병입원 ?의료비/.test(cv),'폰 카드에 외부 보험 담보도 나옴');
  ok((cv.match(/class="cv-policy"/g)||[]).length===3,'보험별 담보 내역에 외부 보험까지 3건');
  ok(!/실손<b>X<\/b>/.test(cv),'고객 화면 보험명 태그 실행 안 됨');
  ok(/<span>20년납<\/span><span>100세<\/span><span>비갱신<\/span>/.test(cv),'보험별 카드에 납입·보험기간·갱신 표시');
  ok(/@media\(max-width:700px\)\{[^}]*\.cv-mtx,\.cv-ovw\{display:none\}/.test(html.replace(/\s+/g,'')),'폰에서는 표를 숨기고 카드로');
  ok(/@media\(max-width:600px\)\{\.kpi-grid\{[^}]*\}\.form-grid/.test(html),'폰 CSS 규칙 사이에 잘못된 ";" 없음 (입력 칸 1열 규칙이 적용됨)');
}catch(e){ ok(false,'G 오류: '+e.message); }
console.log('H) 디자인 점검 (그룹 표 폭·작은 글자·폰 배치)');
try{
  D.run("renderTab('그룹별')"); const gp=D.el('pane-그룹별').innerHTML;
  ok(!/display='table'|display==='table'/.test(html),'그룹 표를 display:table 로 열지 않음 (상자가 내용 폭으로 줄어 표가 반쪽이 되던 원인)');
  ok(/\.gtbl\.open\{display:block\}/.test(html)&&/onclick="toggleG\('g\d+'\)"/.test(gp),'그룹은 순번 id + open 클래스로 펼침');
  const t={classList:{_o:false,contains(){return this._o;},toggle(c,v){this._o=v;}}}, a={textContent:''};
  D.ctx.document.getElementById=id=>id==='gt-g0'?t:id==='arr-g0'?a:{style:{}};
  D.run("toggleG('g0')"); ok(t.classList._o===true&&a.textContent==='▲','toggleG: 누르면 펼치고 ▲');
  D.run("toggleG('g0')"); ok(t.classList._o===false&&a.textContent==='▼','toggleG: 다시 누르면 접고 ▼');
  ok(/\[style\*="font-size:11px"\]\{font-size:12px!important\}/.test(html),'인라인 9~11px 글자를 12px 로 올리는 규칙');
  ok(/\.mo-charts\{grid-template-columns:minmax\(0,1fr\);/.test(html.replace(/\s+/g,''))&&/class="mo-charts"/.test(html),'폰에서 월별 차트 두 개를 세로로');
  ok(/\.gmeta\{order:5;flex-basis:100%/.test(html),'폰 그룹 머리줄: 건수 설명을 둘째 줄로 (이름이 세로로 쪼개지던 문제)');
  ok(/id="filter-btn"[^>]*white-space:nowrap;flex-shrink:0/.test(html)&&/#list-search-area \.search-w\{min-width:0\}/.test(html),'폰 검색줄: "필터" 글자가 세로로 깨지지 않고 화면 안에 들어옴');
}catch(e){ ok(false,'H 오류: '+e.message); }
console.log(`\n스모크 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail?1:0);
})();
