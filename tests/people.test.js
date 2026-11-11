const makeServer=require('./lib/ins_fake_server.js');
const {makeDevice}=require('./lib/ins_smoke_harness.js');
const SID='AKfycbPEOPLETESTPEOPLE12345', URL1=`https://script.google.com/macros/s/${SID}/exec`;
let pass=0,fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++;console.log('  ❌',m);} };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const C=(id,p,c,x={})=>Object.assign({id,s:'계약완료',d:'26.01.0'+(id%9+1),c,p,co:'삼성화재',n:'종합'+id,pr:10000+id,g:'지인들'},x);
function fill(D,o){ const e=D.el; e('edit-id').value=o.id!=null?String(o.id):''; e('f-status').value=o.s||'계약완료'; e('f-end-date').value=''; e('f-date').value=o.d||'26.05.01';
  e('f-holder').value=o.c; e('f-insured').value=o.p; e('f-co').value=o.co||'삼성화재'; e('f-name').value=o.n||'종합'; e('f-price').value=String(o.pr||10000); e('f-group').value='지인들'; e('contract-memo').value=''; }
const people=D=>D.get('peopleList().map(p=>({pid:p.pid,name:p.name,label:p.label,n:p.cs.length,ids:p.cs.map(r=>r.id)}))');
const byLabel=(D,l)=>people(D).find(p=>p.label===l);
const L=(id)=>`legacyPid('${id}')`;

(async()=>{
const S=makeServer(); const route=async(u,o)=>{ const out=S.post(o.body); return {json:async()=>out}; };
const TOKH='h'.repeat(48);
// ── 예전 형식(번호 없음, 이름으로 연결) 데이터 ──
const legacy={contracts:[C(1,'홍길동','김철수'),C(2,'홍길동','김철수'),C(3,'이순신','박문수'),C(4,'홍길동','이영희')],monthly:[],groups:{'지인들':'#868E96'},
  coverages:{'홍길동':{policies:[{id:1,items:[{name:'암진단비',amount:3000,unit:'만원',price:0}]},{id:2,items:[{name:'상해사망',amount:1000,unit:'만원',price:0}]},{id:4,items:[{name:'뇌혈관질환',amount:500,unit:'만원',price:0}]}],matrixNames:{'암진단비':'암'}},'이순신':{policies:[{id:3,items:[{name:'실손',amount:5000,unit:'만원',price:0}]}]}},
  memos:{'1':'비공개'},shares:{'홍길동':TOKH}};
S.ROOT.createFolder('보험관리툴').createFile('보험관리툴_데이터.json',JSON.stringify(legacy));
const LS=(extra={})=>Object.assign({ins_contracts:JSON.stringify(legacy.contracts),ins_monthly:'[]',ins_groups:JSON.stringify(legacy.groups),ins_coverages:JSON.stringify(legacy.coverages),ins_memos:JSON.stringify(legacy.memos),ins_shares:JSON.stringify(legacy.shares)},extra);
const mk=(ls,extra={})=>makeDevice(Object.assign({ls,session:{ins_unlocked:'1'},fetch:route},extra));
const CFG={ins_server_url:URL1,ins_server_key:S.KEY};

console.log('A) 예전 데이터 자동 이전 (이름으로 연결돼 있던 보장분석·링크가 그대로 유지)');
const oldLinkView=makeDevice({hash:`#view=홍길동&t=${TOKH}&s=${SID}`,fetch:route}); await sleep(80);
ok(oldLinkView.bodyHtml.includes('cv-screen')&&/암진단비|암/.test(oldLinkView.bodyHtml),'이전 전에 보낸 옛 고객 링크가 서버에서 그대로 열림 (서버가 옛 형식도 이해)');
let A=mk(LS(CFG)); await sleep(80);
ok(A.errors.length===0,'앱 로드 오류 없음 '+A.errors.join('|'));
ok(A.get('CONTRACTS.every(r=>isPid(r.pid))'),'모든 계약에 가입자 번호가 붙음');
ok(A.get('Object.keys(COVERAGES).every(isPid)')&&A.get('Object.keys(SHARES).every(isPid)'),'보장분석·링크 토큰이 번호 열쇠로 옮겨짐');
let pl=people(A); ok(pl.length===2 && byLabel(A,'홍길동').n===3 && byLabel(A,'이순신').n===1,'사람 2명 (예전과 똑같이 묶여서 시작: 홍길동 3건, 이순신 1건)');
ok(A.get(`COVERAGES[${L('홍길동')}].policies.length`)===3 && A.get(`COVERAGES[${L('홍길동')}].matrixNames['암진단비']`)==='암','보장분석 내용 하나도 안 사라짐');
await sleep(50); await A.run('syncNow()');
let srv=JSON.parse(S.dataFile().content);
ok(Object.keys(srv.shares).every(k=>/^pid_/.test(k))&&srv.contracts.every(r=>r.pid)&&Object.keys(srv.coverages).every(k=>/^pid_/.test(k)),'서버 데이터도 번호 기준으로 바뀜');
const oldLinkAfter=makeDevice({hash:`#view=홍길동&t=${TOKH}&s=${SID}`,fetch:route}); await sleep(80);
ok(oldLinkAfter.bodyHtml.includes('cv-screen'),'이전 뒤에도 같은 옛 링크가 계속 열림');
ok(oldLinkAfter.get('CONTRACTS.length')===3,'옛 링크: 지금까지 묶여 있던 대로 홍길동 3건');

console.log('B) 동명이인 구분 (계약 추가)');
const D=mk(LS());  await sleep(30);
fill(D,{c:'이영희',p:'홍길동',n:'새종합'}); D.confirmQ.push(false);       // "이름만 같은 다른 사람(취소)"
D.run('saveContract()');
ok(D.confirms.length===1&&/이미 '홍길동' 님이 있어요/.test(D.confirms[0])&&/같은 사람이면 \[확인\]/.test(D.confirms[0]),'같은 이름이 있으면 같은 사람인지 물어봄');
pl=people(D); ok(pl.length===3,'동명이인이 별도의 사람으로 등록됨(3명)');
const hongs=pl.filter(p=>p.name==='홍길동'); ok(hongs.length===2&&new Set(hongs.map(p=>p.label)).size===2,'화면에서 서로 구분됨: '+hongs.map(p=>p.label).join(' | '));
const newP=hongs.find(p=>p.n===1), oldP=hongs.find(p=>p.n===3);
ok(!!newP&&!!oldP&&newP.pid!==oldP.pid,'새 사람은 따로(번호 다름), 기존 사람 3건 그대로');
ok(D.get(`CONTRACTS.find(r=>r.id===${newP.ids[0]}).pid`)===newP.pid,'새 계약에 새 번호');
D.run(`selectedCovCustomer='${oldP.pid}'; renderCoverageTab('보장분석')`); let cd=D.el('cov-detail').innerHTML;
ok(/암진단비|암/.test(cd)&&!/새종합/.test(cd),'기존 사람의 보장분석에는 기존 계약만 (새 동명이인의 계약이 섞이지 않음)');
D.run(`selectedCovCustomer='${newP.pid}'; renderCoverageTab('보장분석')`); cd=D.el('cov-detail').innerHTML;
ok(/새종합/.test(cd)&&!/종합1\b|종합2\b|종합4\b/.test(cd.replace(/새종합/g,'')),'동명이인의 보장분석에는 그 사람 계약만');
const list=D.el('pane-보장분석').innerHTML; ok(hongs.every(p=>list.includes(p.label.replace(/&/g,'&amp;'))),'고객 목록에 두 사람이 따로 표시');

console.log('C) 같은 사람이라고 답하면 합쳐짐 / 새 이름이면 묻지 않음');
const nBefore=people(D).length, cBefore=D.confirms.length;
fill(D,{c:'박문수',p:'이순신',n:'이순신추가'}); D.confirmQ.push(true);
D.run('saveContract()'); ok(people(D).length===nBefore&&byLabel(D,'이순신').n===2,'같은 사람(확인)이면 기존 사람에 계약이 붙음');
fill(D,{c:'강감찬',p:'강감찬',n:'강감찬종합'}); D.run('saveContract()');
ok(D.confirms.length===cBefore+1&&people(D).length===nBefore+1,'처음 보는 이름은 묻지 않고 새 사람으로 등록');
fill(D,{c:'누구',p:'',n:'가입자비움'}); D.confirmQ.push(true); D.run('saveContract()');
ok(D.get("CONTRACTS.some(r=>r.n==='가입자비움'&&r.p==='누구'&&isPid(r.pid))"),'가입자를 비우면 계약자 이름으로 처리되고 번호도 붙음');

console.log('D) 이름 변경해도 보장분석 유지 (계약 수정 화면)');
{ // 1) 계약이 하나뿐인 사람: 묻지 않고 이름만 바뀜
  const gp=byLabel(D,'강감찬'); const gid=gp.ids[0];
  D.run(`COVERAGES['${gp.pid}']={policies:[{id:${gid},items:[{name:'강감찬담보',amount:1,unit:'만원',price:0}]}]}`);
  fill(D,{id:gid,c:'강감찬',p:'강감독',n:'강감찬종합'}); const pc=D.prompts.length,cc=D.confirms.length; D.run('saveContract()');
  ok(D.prompts.length===pc&&D.confirms.length===cc,'계약이 하나뿐인 사람의 이름 변경은 묻지 않음');
  ok(D.get(`COVERAGES['${gp.pid}'].policies[0].items[0].name`)==='강감찬담보'&&D.get(`personName('${gp.pid}')`)==='강감독','이름 변경 후에도 보장분석이 그대로, 이름만 바뀜');
  ok(!!byLabel(D,'강감독')&&!byLabel(D,'강감찬'),'목록에서도 새 이름으로 보임'); }
{ // 2) 계약이 여러 개인 사람: 모든 계약 이름을 함께 바꾸기
  const sp=byLabel(D,'이순신'); const tok=D.get(`SHARES['${sp.pid}']||null`);
  D.run(`SHARES['${sp.pid}']='${'s'.repeat(48)}'`);
  fill(D,{id:sp.ids[0],c:'박문수',p:'이순신장군',n:'종합'}); D.promptQ.push('1'); D.run('saveContract()');
  ok(/이 사람의 다른 계약이 1건 더 있어요/.test(D.prompts[D.prompts.length-1]),'다른 계약이 있으면 모두 바꿀지 물어봄');
  ok(D.get(`CONTRACTS.filter(r=>r.pid==='${sp.pid}').every(r=>r.p==='이순신장군')`)&&people(D).find(p=>p.pid===sp.pid).n===2,'1번: 이 사람의 모든 계약 이름이 함께 바뀜(번호는 그대로)');
  ok(D.get(`COVERAGES['${sp.pid}'].policies.length`)===1&&D.get(`SHARES['${sp.pid}']`)==='s'.repeat(48),'보장분석과 고객 링크 토큰 그대로'); }
{ // 3) 이 계약만 다른 사람으로 옮기기
  const sp=people(D).find(p=>p.name==='이순신장군'); const mv=sp.ids[0]; const rest=sp.ids[1];
  D.run(`COVERAGES['${sp.pid}']={policies:[{id:${mv},items:[{name:'옮겨질담보',amount:7,unit:'만원',price:0}]},{id:${rest},items:[{name:'남을담보',amount:1,unit:'만원',price:0}]}]}`);
  fill(D,{id:mv,c:'박문수',p:'이름오타수정',n:'종합'}); D.promptQ.push('2'); D.run('saveContract()');
  const np=byLabel(D,'이름오타수정'); ok(!!np&&np.ids.join()===String(mv),'2번: 이 계약만 새로운 사람으로 분리됨');
  ok(D.get(`COVERAGES['${np.pid}'].policies.some(p=>p.id===${mv}&&p.items[0].name==='옮겨질담보')`),'이 계약의 보장분석이 새 사람 쪽으로 함께 이동');
  ok(!D.get(`COVERAGES['${sp.pid}'].policies.some(p=>p.id===${mv})`)&&D.get(`COVERAGES['${sp.pid}'].policies.some(p=>p.id===${rest})`),'원래 사람에게는 나머지 계약의 보장분석만 남음'); }
{ // 4) 취소하면 저장하지 않음 (계약이 여러 건인 사람이어야 물어봄)
  const hp=people(D).find(p=>p.pid===oldP.pid); const id=hp.ids[0]; const before=JSON.stringify(D.get(`CONTRACTS.find(r=>r.id===${id})`)); const pc=D.prompts.length;
  fill(D,{id,c:'김철수',p:'취소될이름',n:'종합'}); D.promptQ.push(null); D.run('saveContract()');
  ok(D.prompts.length===pc+1,'계약이 여러 건인 사람의 이름을 바꾸면 물어봄');
  ok(JSON.stringify(D.get(`CONTRACTS.find(r=>r.id===${id})`))===before,'물음에서 취소하면 아무것도 바뀌지 않음');
  ok(D.promptQ.length===0&&!byLabel(D,'취소될이름'),'취소한 이름으로 사람이 만들어지지 않음');
  fill(D,{id,c:'김철수',p:'취소될이름',n:'종합'}); D.promptQ.push('abc'); D.run('saveContract()');
  ok(JSON.stringify(D.get(`CONTRACTS.find(r=>r.id===${id})`))===before,'1·2가 아닌 값을 입력해도 저장하지 않음'); }
{ // 5) 이미 있는 사람 이름으로 바꾸면(같은 사람) 합쳐짐
  const a=byLabel(D,'강감독'); const target=byLabel(D,'이순신장군');
  fill(D,{id:a.ids[0],c:'강감찬',p:'이순신장군',n:'강감찬종합'}); D.confirmQ.push(true); D.run('saveContract()');
  ok(D.get(`CONTRACTS.find(r=>r.id===${a.ids[0]}).pid`)===target.pid,'이미 있는 사람 이름으로 바꾸고 "같은 사람"이라 하면 그 사람으로 합쳐짐');
  ok(D.get(`COVERAGES['${target.pid}'].policies.some(p=>p.id===${a.ids[0]}&&p.items[0].name==='강감찬담보')`),'합쳐지면서 보장분석도 함께 이동'); }

console.log('E) ✏️ 이름 변경 버튼 / 🔀 합치기 버튼');
{ const p=byLabel(D,'이름오타수정'); D.promptQ.push('새이름정리'); D.run(`renamePerson('${p.pid}')`);
  ok(!!byLabel(D,'새이름정리')&&D.get(`COVERAGES['${p.pid}'].policies.length`)>=1,'이름 변경 버튼: 이름만 바뀌고 보장분석 유지');
  const before=JSON.stringify(D.get('CONTRACTS')); D.promptQ.push(null); D.run(`renamePerson('${p.pid}')`); ok(JSON.stringify(D.get('CONTRACTS'))===before,'취소하면 그대로'); }
{ const src=byLabel(D,'새이름정리'); const dstLabel=hongs.find(h=>h.n===3).label;
  D.run(`SHARES['${src.pid}']='${'z'.repeat(48)}'`);
  const others=D.get(`peopleList().filter(p=>p.pid!=='${src.pid}').map(p=>p.label)`); const idx=others.indexOf(dstLabel)+1;
  const dstPid=oldP.pid; const polBefore=D.get(`COVERAGES['${dstPid}'].policies.length`)+D.get(`COVERAGES['${src.pid}'].policies.length`);
  D.promptQ.push(String(idx)); D.run(`mergePerson('${src.pid}')`);
  ok(!people(D).some(p=>p.pid===src.pid)&&D.get(`CONTRACTS.filter(r=>r.pid==='${dstPid}').length`)===oldP.n+src.n,'합치기: 계약이 대상 사람으로 이동');
  ok(D.get(`COVERAGES['${dstPid}'].policies.length`)===polBefore&&D.get(`COVERAGES['${src.pid}']===undefined`)===true,'합치기: 보장분석이 합쳐지고(잃는 것 없음) 합쳐진 쪽 기록은 정리');
  ok(D.get(`SHARES['${src.pid}']===undefined`)===true,'합쳐진 쪽의 고객 링크는 무효화'); }

console.log('F) 이름을 바꿔도 고객 링크가 계속 열림 / 동명이인 링크는 서로 안 섞임');
{ const S2=makeServer(); const route2=async(u,o)=>{ const out=S2.post(o.body); return {json:async()=>out}; };
  const mk2=(ls,extra={})=>makeDevice(Object.assign({ls,session:{ins_unlocked:'1'},fetch:route2},extra));
  const cfg={ins_server_url:URL1,ins_server_key:S2.KEY};
  const X=mk2({ins_contracts:JSON.stringify([C(1,'홍길동','김철수'),C(2,'홍길동','김철수',{pid:'pid_other'})]),...cfg}); await sleep(60);
  // 같은 계약자·같은 이름의 두 사람 → '#1', '#2' 로 구분되는지
  ok(new Set(people(X).map(p=>p.label)).size===2&&people(X).every(p=>/ #\d$/.test(p.label)),'이름·계약자가 모두 같아도 #1, #2 로 구분: '+people(X).map(p=>p.label).join(' | '));
  const p1=people(X)[0], p2=people(X)[1];
  X.run(`COVERAGES['${p1.pid}']={policies:[{id:${p1.ids[0]},items:[{name:'첫번째사람담보',amount:1,unit:'만원',price:0}]}]}; COVERAGES['${p2.pid}']={policies:[{id:${p2.ids[0]},items:[{name:'두번째사람담보',amount:2,unit:'만원',price:0}]}]}`);
  await X.run(`copyShareLink('${p1.pid}')`); const link1=X.clip; await X.run(`copyShareLink('${p2.pid}')`); const link2=X.clip;
  const v1=makeDevice({hash:'#'+link1.split('#')[1],fetch:route2}); const v2=makeDevice({hash:'#'+link2.split('#')[1],fetch:route2}); await sleep(80);
  ok(v1.bodyHtml.includes('첫번째사람담보')&&!v1.bodyHtml.includes('두번째사람담보'),'같은 이름이어도 1번 링크에는 1번 사람의 보장분석만');
  ok(v2.bodyHtml.includes('두번째사람담보')&&!v2.bodyHtml.includes('첫번째사람담보'),'2번 링크에는 2번 사람의 보장분석만');
  X.promptQ.push('개명한이름'); X.run(`renamePerson('${p1.pid}')`); await X.run('syncNow()');
  const v1b=makeDevice({hash:'#'+link1.split('#')[1],fetch:route2}); await sleep(80);
  ok(v1b.bodyHtml.includes('cv-screen')&&v1b.bodyHtml.includes('첫번째사람담보'),'이름을 바꾼 뒤에도 예전에 보낸 같은 링크가 열리고 보장분석 유지');
  ok(v1b.bodyHtml.includes('개명한이름 님'),'링크의 이름이 옛 이름이어도 화면에는 서버가 알려준 새 이름으로 표시');
  const Y=mk2({...cfg}); await sleep(40); await Y.run('syncNow()');
  ok(Y.get('CONTRACTS.some(r=>r.p==="개명한이름")')&&Y.get(`COVERAGES['${p1.pid}'].policies.length`)===1,'다른 기기에도 새 이름과 보장분석이 그대로 전달'); }

console.log('G) 예전 형식 백업 파일 복원 / 새 형식 백업 왕복');
{ const legacyBak={contracts:legacy.contracts,monthly:[],groups:legacy.groups,coverages:legacy.coverages,memos:legacy.memos};
  const R=mk({}); await sleep(30);
  R.run(`importData({target:{files:[{__text:${JSON.stringify(JSON.stringify(legacyBak))}}],value:''}})`); await sleep(100);
  ok(R.get('CONTRACTS.length')===4&&R.get('CONTRACTS.every(r=>isPid(r.pid))'),'번호가 없던 예전 백업을 복원하면 번호가 자동으로 붙음');
  ok(R.get(`COVERAGES[${L('홍길동')}].policies.length`)===3&&R.get('Object.keys(COVERAGES).every(isPid)'),'예전 백업의 보장분석이 번호 열쇠로 복원됨');
  R.run('exportData()'); const bak=JSON.parse(R.downloads[R.downloads.length-1].text);
  ok(bak.contracts.every(r=>/^pid_/.test(r.pid))&&Object.keys(bak.coverages).every(k=>/^pid_/.test(k)),'새 백업 파일에는 번호가 들어 있음');
  const R2=mk({}); await sleep(30); R2.run(`importData({target:{files:[{__text:${JSON.stringify(JSON.stringify(bak))}}],value:''}})`); await sleep(100);
  ok(JSON.stringify(R2.get('COVERAGES'))===JSON.stringify(R.get('COVERAGES'))&&JSON.stringify(R2.get('CONTRACTS'))===JSON.stringify(R.get('CONTRACTS')),'새 백업 → 복원 왕복 후 계약·보장분석이 똑같음'); }

console.log('H) 계약 삭제와 번호');
{ const T=mk(LS()); await sleep(30); const hp=byLabel(T,'홍길동'); const id=hp.ids[0];
  T.el('edit-id').value=String(id); T.run('deleteContract()');
  ok(!T.get('CONTRACTS').some(r=>r.id===id)&&!T.get(`COVERAGES['${hp.pid}'].policies.some(p=>p.id===${id})`),'삭제하면 그 계약의 보장분석 기록도 번호 기준으로 정리');
  ok(T.get(`COVERAGES['${hp.pid}'].policies.length`)===2,'같은 사람의 다른 계약 분석은 유지'); }

console.log('I) ✂️ 분리: 이미 이름으로 합쳐져 있던 동명이인 갈라내기');
{ const T=mk(LS(CFG)); await sleep(80);
  const hp=byLabel(T,'홍길동'); const tokBefore=T.get(`SHARES['${hp.pid}']`);
  ok(hp.n===3&&T.get('typeof splitPerson')==='function','분리 대상: 예전에 한 사람으로 묶여 있던 홍길동 3건');
  const snap=JSON.stringify(T.get('CONTRACTS')); const pc=T.prompts.length;
  T.promptQ.push(null); T.run(`splitPerson('${hp.pid}')`); ok(T.prompts.length===pc+1&&JSON.stringify(T.get('CONTRACTS'))===snap,'취소하면 아무것도 안 바뀜');
  T.promptQ.push('1,2,3'); T.run(`splitPerson('${hp.pid}')`); ok(JSON.stringify(T.get('CONTRACTS'))===snap,'전부 고르면 분리하지 않음(한 명은 남아야 함)');
  T.promptQ.push('9,abc'); T.run(`splitPerson('${hp.pid}')`); ok(JSON.stringify(T.get('CONTRACTS'))===snap,'잘못된 번호만 입력하면 분리하지 않음');
  T.promptQ.push('3',''); T.run(`splitPerson('${hp.pid}')`); ok(JSON.stringify(T.get('CONTRACTS'))===snap,'이름을 비워서 취소하면 분리하지 않음');
  const solo=people(T).find(p=>p.n===1); const sb=JSON.stringify(T.get('CONTRACTS')); T.run(`splitPerson('${solo.pid}')`); ok(JSON.stringify(T.get('CONTRACTS'))===sb&&T.promptQ.length===0,'계약이 1건뿐인 사람은 묻지도 않고 분리하지 않음');
  T.promptQ.push('3','홍길동'); T.run(`splitPerson('${hp.pid}')`);          // 세 번째(계약 4번, 계약자 이영희)를 분리, 이름은 그대로
  const ps=people(T).filter(p=>p.name==='홍길동'); ok(ps.length===2,'이름이 같은 두 사람으로 갈라짐');
  const np=ps.find(p=>p.ids.join()==='4'), op=ps.find(p=>p.ids.slice().sort((a,b)=>a-b).join()==='1,2');
  ok(!!np&&!!op&&np.pid!==op.pid,'고른 계약(4번)만 새 사람, 나머지(1·2번)는 기존 사람');
  ok(new Set(ps.map(p=>p.label)).size===2,'목록에서 구분됨: '+ps.map(p=>p.label).join(' | '));
  ok(T.get(`COVERAGES['${np.pid}'].policies.map(p=>p.id).join()`)==='4'&&T.get(`COVERAGES['${op.pid}'].policies.map(p=>p.id).sort().join()`)==='1,2','보장분석도 계약별로 함께 갈라짐 (4번은 새 사람, 1·2번은 기존)');
  ok(T.get(`COVERAGES['${np.pid}'].policies[0].items[0].name`)==='뇌혈관질환','갈라진 계약의 보장분석 내용은 그대로');
  ok(T.get(`SHARES['${op.pid}']`)===tokBefore&&T.get(`SHARES['${np.pid}']===undefined`)===true,'기존 사람의 고객 링크는 그대로, 새 사람은 아직 링크 없음');
  await T.run('syncNow()');
  const v=makeDevice({hash:`#view=홍길동&t=${TOKH}&s=${SID}`,fetch:route}); await sleep(80);
  ok(v.get('CONTRACTS.map(c=>c.id).sort().join()')==='1,2'&&!v.bodyHtml.includes('뇌혈관질환'),'이미 보낸 옛 링크는 기존 사람의 계약(1·2번)만 보여주고, 갈라낸 사람의 정보는 안 보임');
  const U=mk(CFG); await sleep(40); await U.run('syncNow()');
  ok(people(U).filter(p=>p.name==='홍길동').length===2&&U.get(`COVERAGES['${np.pid}'].policies.length`)===1,'다른 기기에도 갈라진 상태가 그대로 전달'); }

console.log(`\n가입자 고유 번호 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail?1:0);
})();
