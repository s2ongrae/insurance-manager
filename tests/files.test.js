const makeServer=require('./lib/ins_fake_server.js');
const {makeDevice}=require('./lib/ins_smoke_harness.js');
const SID='AKfycbFILETESTFILETEST1234567', URL1=`https://script.google.com/macros/s/${SID}/exec`;
let pass=0,fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++;console.log('  ❌',m);} };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PDF=(name='제안서.pdf')=>({name,size:1234,__b64:Buffer.from('%PDF-1.4 가짜 제안서 내용').toString('base64')});
const ev=(f)=>`{target:{files:[${JSON.stringify(f)}],value:''}}`;
const C=(id,p,c,d,x={})=>Object.assign({id,s:'계약완료',d,c,p,co:'삼성화재',n:'종합'+id,pr:10000+id,g:'지인들'},x);
const AI={payPeriod:'20년납',covPeriod:'100세',renewable:'비갱신형',items:[{name:'암진단비',amount:3000,unit:'만원',price:10000},{name:'뇌혈관',amount:1000,unit:'만원',price:5000}]};

function makeEnv(){
  const S=makeServer(); const st={gemini:'ok',upload:'ok',geminiCalls:0,uploadCalls:0};
  const route=async(u,o)=>{
    if(/generativelanguage\.googleapis\.com/.test(u)){ st.geminiCalls++;
      return st.gemini==='ok' ? {status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(AI)}]}}]})}
                              : {status:400,json:async()=>({error:{message:'API key not valid'}})}; }
    const body=JSON.parse(o.body);
    if(body.action==='uploadFile'){ st.uploadCalls++; if(st.upload==='fail') return {status:200,json:async()=>({ok:false,error:'드라이브 용량 부족'})}; }
    const out=S.post(o.body); return {status:200,json:async()=>out}; };
  const seed={ins_contracts:JSON.stringify([C(1,'홍길동','김철수','26.05.01'),C(2,'홍길동','김철수','26.05.02'),C(3,'이순신','박문수','26.06.03')]),ins_monthly:'[]',ins_groups:'{"지인들":"#868E96"}',gemini_key:'AIzaFAKEKEYFORTEST'};
  const mk=(extra={},noServer=false)=>makeDevice({ls:Object.assign({},seed,noServer?{}:{ins_server_url:URL1,ins_server_key:S.KEY},extra),session:{ins_unlocked:'1'},fetch:route});
  return {S,st,route,mk};
}
const driveFiles=S=>{ const root=S.ROOT.folders.find(f=>f.name==='보험관리툴'); const sub=root&&root.folders.find(f=>f.name==='제안서'); const out=[]; (sub?sub.folders:[]).forEach(cf=>cf.files.forEach(f=>out.push({folder:cf.name,name:f.name,trashed:f.trashed}))); return out; };
const toast=D=>D.el('toast').textContent;
const pidOf=(D,n)=>D.get(`peopleList().find(p=>p.name==='${n}').pid`);
const urlOf=(D,id)=>D.get(`CONTRACTS.find(r=>r.id===${id}).proposalUrl||''`);
const isDrive=u=>/^https:\/\/drive\.google\.com\//.test(u);

(async()=>{
console.log('A) 보장분석 PDF 분석 → 파일이 Drive에 저장되고 그 계약에 연결');
const E=makeEnv(); const D=E.mk(); await sleep(70);
const hp=pidOf(D,'홍길동');
D.run(`selectedCovCustomer='${hp}'; renderCoverageTab('보장분석')`);
ok(!/제안서 보기/.test(D.el('cov-detail').innerHTML)&&/📎 파일만 저장/.test(D.el('cov-detail').innerHTML),'업로드 전: "제안서 보기"는 없고 "파일만 저장" 버튼이 있음');
D.run(`handlePDFUpload(${ev(PDF())},1,'삼성화재','종합1')`); await sleep(300);
ok(D.get(`COVERAGES['${hp}'].policies.find(p=>p.id===1).items.length`)===2,'AI 분석 결과(담보 2개)가 반영됨');
let files=driveFiles(E.S);
ok(files.length===1&&files[0].folder==='홍길동'&&/^제안서_\d{4}-\d{2}-\d{2}_[0-9a-f]{6}\.pdf$/.test(files[0].name),'Drive > 보험관리툴 > 제안서 > 홍길동 폴더에 파일 저장: '+files.map(f=>f.folder+'/'+f.name).join(','));
const url1=urlOf(D,1); ok(isDrive(url1),'1번 계약에 제안서 주소가 연결됨'); ok(urlOf(D,2)==='','같은 사람의 다른 계약(2번)에는 연결 안 됨');
ok(/성공|✅/.test(toast(D))&&/제안서 파일도 저장했어요/.test(toast(D)),'알림: '+toast(D));
ok(D.el('cov-detail').innerHTML.includes(url1.replace(/&/g,'&amp;'))&&/📄 제안서 보기/.test(D.el('cov-detail').innerHTML),'보장분석 화면에 "제안서 보기" 링크가 생김');

console.log('B) 계약 수정 화면·각 탭에서 파일이 "있음"으로 보임 (레이가 겪은 증상)');
const nb=D.el('proposal-info').children.length; D.run('openEditModal(1)'); await sleep(160);
const kids=D.el('proposal-info').children; ok(kids.length===nb+2&&kids[kids.length-2].href===url1&&/기존 제안서 보기/.test(kids[kids.length-2].textContent),'계약 수정 화면: "파일 없음" 대신 "기존 제안서 보기" 링크');
D.run('openEditModal(2)'); await sleep(160); ok(D.el('proposal-info').textContent==='파일 없음','파일이 없는 계약(2번)은 "파일 없음"');
const has=(html,u)=>html.includes(u.replace(/&/g,'&amp;'));
D.run("renderTab('리스트')"); ok(has(D.el('list-results').innerHTML,url1),'계약 리스트에 📄');
D.run("currentTab='그룹별'; renderTab('그룹별')"); ok(has(D.el('pane-그룹별').innerHTML,url1),'그룹별 탭에 📄');
D.run("expandedCustomer='김철수'; renderTab('고객별')"); ok(has(D.el('pane-고객별').innerHTML,url1),'고객별 탭에 📄');
D.run("expandedMonth='26.05'; renderTab('월별')"); ok(has(D.el('pane-월별').innerHTML,url1),'월별 탭에 📄');
const noLinkForTwo=!D.el('list-results').innerHTML.split('종합2')[1]?.split('</tr>')[0].includes('drive.google'); ok(noLinkForTwo,'파일 없는 2번 계약 행에는 📄가 없음');

console.log('C) 분석이 실패해도 업로드한 파일은 저장·연결');
E.st.gemini='fail'; D.run(`selectedCovCustomer='${hp}'; renderCoverageTab('보장분석')`);
D.run(`handlePDFUpload(${ev(PDF('제안서.pdf'))},2,'삼성화재','종합2')`); await sleep(300);
ok(isDrive(urlOf(D,2)),'분석이 실패했어도 2번 계약에 파일이 연결됨');
ok(/분석 실패/.test(toast(D))&&/제안서 파일도 저장했어요/.test(toast(D)),'알림에 분석 실패와 파일 저장이 함께 안내됨: '+toast(D));
ok(D.get(`(function(){const p=COVERAGES['${hp}'].policies.find(x=>x.id===2); return !p || p.items.length===0;})()`)===true,'실패한 분석은 담보를 만들지 않음');
E.st.gemini='ok';

console.log('D) 파일 저장이 실패해도 분석은 그대로');
E.st.upload='fail'; const before3=urlOf(D,3);
const tp=pidOf(D,'이순신'); D.run(`selectedCovCustomer='${tp}'; renderCoverageTab('보장분석')`);
D.run(`handlePDFUpload(${ev(PDF())},3,'삼성화재','종합3')`); await sleep(300);
ok(D.get(`COVERAGES['${tp}'].policies.find(p=>p.id===3).items.length`)===2,'분석 결과는 정상 반영');
ok(urlOf(D,3)===before3&&/파일 저장 실패/.test(toast(D))&&/드라이브 용량 부족/.test(toast(D)),'파일 저장 실패 이유가 알림에 나오고, 계약의 파일 주소는 그대로: '+toast(D));
E.st.upload='ok';

console.log('E) 서버 설정이 없을 때');
const E2=makeEnv(); const N=E2.mk({},true); await sleep(50); const np=pidOf(N,'홍길동');
N.run(`selectedCovCustomer='${np}'; renderCoverageTab('보장분석')`); N.run(`handlePDFUpload(${ev(PDF())},1,'삼성화재','종합1')`); await sleep(250);
ok(N.get(`COVERAGES['${np}'].policies.find(p=>p.id===1).items.length`)===2&&E2.st.uploadCalls===0,'서버 설정이 없어도 분석은 되고, 업로드 요청은 보내지 않음');
ok(/서버 설정이 없어서 파일은 저장하지 못했어요/.test(toast(N)),'안내: '+toast(N));
N.run(`attachProposalOnly(${ev(PDF())},1)`); await sleep(80); ok(/서버 설정/.test(toast(N))&&N.get('CONTRACTS.find(r=>r.id===1).proposalUrl||""')==='','파일만 저장도 서버 설정이 없으면 안내하고 아무것도 안 바꿈');

console.log('F) 📎 파일만 저장: AI 분석 없이 파일만 연결 (담보 내용은 그대로)');
const F=E.mk(); await sleep(70); const fp=pidOf(F,'이순신');
F.run(`COVERAGES['${fp}']={policies:[{id:3,items:[{name:'직접고친담보',amount:777,unit:'만원',price:0}]}]}; selectedCovCustomer='${fp}'; renderCoverageTab('보장분석')`);
const gBefore=E.st.geminiCalls; F.run(`attachProposalOnly(${ev(PDF('옛제안서.pdf'))},3)`); await sleep(250);
ok(E.st.geminiCalls===gBefore,'AI 분석을 호출하지 않음');
ok(F.get(`COVERAGES['${fp}'].policies[0].items[0].name`)==='직접고친담보'&&F.get(`COVERAGES['${fp}'].policies[0].items.length`)===1,'직접 고친 담보 내용은 하나도 안 바뀜');
ok(isDrive(urlOf(F,3))&&driveFiles(E.S).some(f=>f.folder==='이순신'&&/^옛제안서_/.test(f.name)),'파일이 이순신 폴더에 저장되고 3번 계약에 연결됨');
ok(/📄 제안서 보기/.test(F.el('cov-detail').innerHTML),'저장 후 보장분석 화면에 "제안서 보기"가 나타남');

console.log('G) 기존·외부 보험에도 파일 연결');
const G=E.mk(); await sleep(70); const gp=pidOf(G,'홍길동');
G.run(`COVERAGES['${gp}']=Object.assign(COVERAGES['${gp}']||{policies:[]},{externalPolicies:[{id:-5,co:'외부화재',n:'외부종합',pr:1000,items:[]}]}); selectedCovCustomer='${gp}'; renderCoverageTab('보장분석')`);
G.run(`handlePDFUpload(${ev(PDF('외부.pdf'))},-5,'외부화재','외부종합')`); await sleep(300);
ok(isDrive(G.get(`COVERAGES['${gp}'].externalPolicies[0].proposalUrl||''`)),'외부 보험 기록에 파일 주소가 연결됨');
ok(/📄 제안서 보기/.test(G.el('cov-detail').innerHTML)&&G.get(`COVERAGES['${gp}'].externalPolicies[0].items.length`)===2,'외부 보험도 분석 결과 반영 + 제안서 보기 링크');

console.log('H) 파일 이름이 겹쳐도 서로 지워지지 않음');
const before=driveFiles(E.S).filter(f=>!f.trashed).length;
const H=E.mk(); await sleep(70); const hh=pidOf(H,'홍길동'); H.run(`selectedCovCustomer='${hh}'; renderCoverageTab('보장분석')`);
H.run(`attachProposalOnly(${ev(PDF('제안서.pdf'))},1)`); await sleep(200); const u1=urlOf(H,1);
H.run(`attachProposalOnly(${ev(PDF('제안서.pdf'))},2)`); await sleep(200); const u2=urlOf(H,2);
H.run(`attachProposalOnly(${ev(PDF('제안서.pdf'))},1)`); await sleep(200); const u1b=urlOf(H,1);
const all=driveFiles(E.S); ok(all.filter(f=>!f.trashed).length===before+3&&all.every(f=>!f.trashed),'같은 이름·같은 날 파일 3개를 올려도 하나도 휴지통으로 가지 않음');
ok(new Set(all.map(f=>f.name)).size===all.length,'파일 이름이 모두 서로 다름');
ok(u1!==u2&&u1b!==u1,'계약별로 각자 다른 파일을 가리킴, 다시 올리면 새 파일로 교체 연결');

console.log('I) 다른 기기·서버에도 반영');
await H.run('syncNow()'); const sv=JSON.parse(E.S.dataFile().content);
ok(isDrive(sv.contracts.find(r=>r.id===1).proposalUrl||'')&&isDrive(sv.contracts.find(r=>r.id===2).proposalUrl||''),'서버 데이터의 계약에 제안서 주소가 들어감');
const I=E.mk({},false); await sleep(60); await I.run('syncNow()');
ok(urlOf(I,1)===u1b&&urlOf(I,2)===u2,'다른 기기에서도 같은 파일이 연결돼 보임');

console.log('J) 계약 수정 화면 업로드(파일만 저장): 가입자 이름 폴더 + 안 겹치는 이름');
const J=E.mk(); await sleep(70);
const e=J.el; e('edit-id').value='3'; e('f-status').value='계약완료'; e('f-end-date').value=''; e('f-date').value='26.06.03'; e('f-holder').value='박문수'; e('f-insured').value='이순신'; e('f-co').value='삼성화재'; e('f-name').value='종합3'; e('f-price').value='10003'; e('f-group').value='지인들'; e('contract-memo').value='';
const jb=driveFiles(E.S).length; J.run(`handleProposalUpload(${ev(PDF('수정화면.pdf'))})`); await sleep(250);
const jf=driveFiles(E.S); const nf=jf[jf.length-1];
ok(jf.length===jb+1&&nf.folder==='이순신'&&/^수정화면_/.test(nf.name),'수정 화면에서 올린 파일은 계약자(박문수)가 아니라 가입자(이순신) 폴더에 저장: '+nf.folder+'/'+nf.name);
ok(/폴더에 저장됐어요/.test(toast(J))&&/제안서 > 이순신/.test(toast(J))&&/저장 버튼/.test(toast(J)),'알림에 실제 폴더 경로와 "저장 버튼" 안내: '+toast(J));
J.run('saveContract()'); ok(isDrive(urlOf(J,3)),'저장 버튼을 누르면 계약에 연결');
e('f-insured').value=''; e('f-holder').value='박문수'; const jb2=driveFiles(E.S).length; J.run(`handleProposalUpload(${ev(PDF('가입자없음.pdf'))})`); await sleep(250);
ok(driveFiles(E.S)[jb2].folder==='박문수','가입자가 비어 있으면 계약자 이름 폴더');

console.log('K) 주소 검증 (Drive 주소가 아니면 링크로 만들지 않음)');
const K=E.mk(); await sleep(70);
for(const bad of ['javascript:alert(1)','https://evil.example/x.pdf','http://drive.google.com/x','data:text/html,<script>1</script>']){
  K.run(`CONTRACTS=CONTRACTS.map(r=>r.id===1?Object.assign({},r,{proposalUrl:${JSON.stringify(bad)}}):r)`);
  const n=K.el('proposal-info').children.length; K.run('openEditModal(1)'); await sleep(150);
  ok(K.el('proposal-info').textContent==='파일 없음'&&K.el('proposal-info').children.length===n,`수정 화면: 안전하지 않은 주소(${bad.slice(0,22)})는 링크로 만들지 않음`);
  K.run("renderTab('리스트')"); ok(!K.el('list-results').innerHTML.includes(bad.replace(/&/g,'&amp;'))&&!/href="javascript:/.test(K.el('list-results').innerHTML),'계약 리스트에도 링크 없음');
}
K.run(`CONTRACTS=CONTRACTS.map(r=>r.id===1?Object.assign({},r,{proposalUrl:'https://drive.google.com/file/d/abc"onmouseover="alert(1)/view'}):r)`);
K.run("renderTab('리스트')"); ok(!/onmouseover="alert/.test(K.el('list-results').innerHTML),'따옴표가 섞인 주소도 속성 밖으로 못 나감(이스케이프)');

console.log('L) 고객 링크로는 파일 주소가 안 나감');
await H.run(`copyShareLink('${hh}')`); const link='#'+H.clip.split('#')[1];
const V=makeDevice({hash:link,fetch:E.route}); await sleep(90);
ok(V.bodyHtml.includes('cv-screen')&&!/drive\.google\.com/.test(V.bodyHtml)&&V.get('CONTRACTS.every(c=>c.proposalUrl===undefined)'),'고객 화면과 고객이 받는 데이터에 제안서 파일 주소 없음');

console.log('M) "기존 보험 추가"(글자 id) 보험: 담보 입력·분석·파일 저장이 모두 동작');
{ const M=E.mk(); await sleep(70); const mp=pidOf(M,'홍길동'); const XID='ext_1700000000000';
  M.run(`COVERAGES['${mp}']={policies:[],otherPolicies:[{id:'${XID}',co:'옛보험사',name:'옛상품',price:5000,payPeriod:'20년납',items:[]}]}; selectedCovCustomer='${mp}'; renderCoverageTab('보장분석')`);
  const codes=[...M.el('cov-detail').innerHTML.matchAll(/(?:onclick|onchange)="((?:addCovItem|updateCovItem|removeCovItem|handlePDFUpload|attachProposalOnly|updatePolMeta)\([^"]*ext_[^"]*)"/g)].map(m=>m[1]);
  ok(codes.length>=4,'글자 id 보험의 버튼·입력 칸 코드가 만들어짐 ('+codes.length+'개)');
  const run=code=>{ try{ M.run(`(function(event){ ${code} }).call({value:'직접입력담보'},{target:{files:[],value:''}})`); return null; }catch(e){ return e.name+': '+e.message; } };
  const errs=codes.map(run).filter(Boolean); ok(errs.length===0,'버튼·입력 칸 코드를 실제로 실행해도 오류가 없음 '+errs.join(' | '));
  const rec=()=>M.get(`COVERAGES['${mp}'].otherPolicies[0]`);
  M.run(`COVERAGES['${mp}'].otherPolicies[0].items=[]`);
  M.run(`addCovItem('${mp}','${XID}')`); ok(rec().items.length===1&&M.get(`COVERAGES['${mp}'].policies.length`)===0,'＋ 담보 추가: 그 보험 기록에 저장되고 policies 에는 쌓이지 않음');
  M.run(`updateCovItem('${mp}','${XID}',0,'name','직접입력담보')`); M.run(`updateCovItem('${mp}','${XID}',0,'amount','500')`);
  M.run(`renderCoverageTab('보장분석')`); ok(/직접입력담보/.test(M.el('cov-detail').innerHTML.split('보장 합산 매트릭스')[1]||''),'직접 입력한 담보가 매트릭스에 나타남');
  M.run(`updatePolMeta('${mp}','${XID}','covPeriod','100세')`); ok(rec().covPeriod==='100세','납입·보험기간 입력도 그 보험 기록에 저장');
  M.run(`handlePDFUpload(${ev(PDF('옛보험.pdf'))},'${XID}','옛보험사','옛상품')`); await sleep(300);
  ok(rec().items.some(i=>i.name==='암진단비')&&M.get(`COVERAGES['${mp}'].policies.length`)===0,'PDF 분석 결과가 그 보험 기록에 저장됨 (policies 에 따로 쌓이지 않음)');
  ok(isDrive(rec().proposalUrl||''),'분석한 PDF 파일이 기존 보험 기록에 연결됨');
  const det=M.el('cov-detail').innerHTML; ok(/📄 제안서 보기/.test(det)&&/암진단비/.test(det.split('보장 합산 매트릭스')[1]||''),'제안서 보기 링크 + 분석한 담보가 매트릭스에 나타남');
  M.run(`removeCovItem('${mp}','${XID}',0)`); ok(!rec().items.some(i=>i.name==='직접입력담보'),'담보 삭제도 동작');
  M.run(`attachProposalOnly(${ev(PDF('옛보험2.pdf'))},'${XID}')`); await sleep(220); ok(driveFiles(E.S).some(f=>/^옛보험2_/.test(f.name))&&isDrive(rec().proposalUrl||''),'📎 파일만 저장도 글자 id 보험에서 동작'); }

console.log('N) 예전에 분석 결과가 엉뚱한 곳에 쌓여 있던 데이터가 자동으로 정리');
{ const legacyCov={'홍길동':{policies:[{id:1,items:[{name:'일반담보',amount:10,unit:'만원',price:0}]},{id:-5,payPeriod:'10년납',items:[{name:'예전분석담보',amount:300,unit:'만원',price:0}]}],externalPolicies:[{id:-5,co:'외부화재',n:'외부종합',pr:1000,items:[{name:'모달입력담보',amount:111,unit:'만원',price:0}]}]}};
  const EN=makeEnv(); const N2=EN.mk({ins_coverages:JSON.stringify(legacyCov)}); await sleep(100);   // 앞 단계와 서버를 공유하지 않도록 독립 환경
  const np2=pidOf(N2,'홍길동');
  ok(N2.get(`COVERAGES['${np2}'].policies.map(p=>p.id).join()`)==='1'&&N2.get(`COVERAGES['${np2}'].externalPolicies[0].items.length`)===2,'앱을 열면 옛 분석 결과가 그 외부 보험 기록으로 합쳐지고 policies 에는 일반 계약만 남음');
  N2.run(`selectedCovCustomer='${np2}'; renderCoverageTab('보장분석')`); const mx=N2.el('cov-detail').innerHTML.split('보장 합산 매트릭스')[1]||'';
  ok(/예전분석담보/.test(mx)&&/모달입력담보/.test(mx),'예전에 안 보이던 분석 담보가 이제 매트릭스에 나타남 (기존 담보와 함께)');
  ok(/일반담보/.test(mx),'일반 계약의 담보는 그대로');
  await N2.run('syncNow()'); const sv2=JSON.parse(EN.S.dataFile().content); const rc=sv2.coverages[np2];
  ok(rc&&rc.policies.length===1&&rc.externalPolicies[0].items.length===2,'정리된 모습이 서버에도 저장됨'); }

console.log(`\n제안서 파일 연결 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail?1:0);
})();
