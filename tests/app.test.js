const makeServer=require('./lib/ins_fake_server.js');
const {makeDevice}=require('./lib/ins_smoke_harness.js');
const URL1='https://script.google.com/macros/s/AKfycbFULLAPPTESTFULLAPP12345/exec';
let pass=0,fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++;console.log('  ❌',m);} };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const C=(id,x={})=>Object.assign({id,s:'계약완료',d:'26.01.0'+(id%9+1),c:'계약자'+(id%3),p:'가입자'+(id%3),co:'삼성화재',n:'종합'+id,pr:10000+id,g:'지인들'},x);
const COV={'가입자1':{policies:[{id:1,items:[{name:'암진단비',amount:3000,unit:'만원',price:0}]},{id:4,items:[{name:'뇌혈관질환',amount:2000,unit:'만원',price:0}]}],matrixView:{'암진단비':{'삼성화재\n종합1':3500}}},'가입자2':{policies:[{id:2,items:[{name:'상해사망',amount:1000,unit:'만원',price:0}]}]}};
(async()=>{
const S=makeServer();
const route=async(u,opts)=>{ const out=S.post(opts.body); return {json:async()=>out}; };
const mk=(ls,extra={})=>makeDevice(Object.assign({ls,session:{ins_unlocked:'1'},fetch:route},extra));
const P1=mk({}).run("legacyPid('가입자1')");   // 가입자 고유 번호
const seedLS={ins_contracts:JSON.stringify([1,2,3,4,5,6,7].map(i=>C(i))),ins_monthly:JSON.stringify([{m:'26.01',k:1,before:1,after:1,tax:0,memo:''}]),ins_groups:JSON.stringify({'지인들':'#868E96'}),ins_coverages:JSON.stringify(COV),ins_memos:JSON.stringify({'1':'메모1','7':'메모7'}),
  ins_server_url:URL1, ins_server_key:S.KEY};

console.log('A) 그룹 설정 동기화: 예전 방식(이 기기에만 저장)으로 바꿔 둔 설정 이어받기');
const legacy=[{label:'🏥 실손',color:'#0284C7',bg:'#E0F2FD',border:'#0EA5E9',keys:['실손']},{label:'🎗️ 암',color:'#DC2626',bg:'#FEF2F2',border:'#FCA5A5',keys:['암','커스텀암키워드']},{label:'📋 기타',color:'#6B7280',bg:'#F3F4F6',border:'#D1D5DB',keys:[]}];
let A=mk(Object.assign({},seedLS,{ins_cov_groups:JSON.stringify(legacy)}));
await sleep(30);
ok(A.errors.length===0,'앱 로드 오류 없음 '+A.errors.join('|'));
ok(A.get('SETTINGS').covGroups && A.get('SETTINGS').covGroups.list.length===3,'예전 설정이 동기화 대상(SETTINGS)으로 이어받아짐');
ok(A.get('getCovGroup("커스텀암키워드담보").label')==='🎗️ 암','이어받은 설정이 실제로 적용됨');
let r=await A.run('syncNow()'); let srv=JSON.parse(S.dataFile()?S.dataFile().content:'{}');
ok(r.ok&&srv.settings&&srv.settings.covGroups.list.length===3,'첫 동기화로 서버에 그룹 설정 저장');

console.log('B) 그룹 설정 편집 → 다른 기기·고객 화면에 반영');
A.run(`COV_GROUPS[1].keys.push('새키워드'); saveCovGroupsUI()`); await sleep(1700);   // 저장 → 1.5초 뒤 자동 동기화
srv=JSON.parse(S.dataFile().content); ok(srv.settings.covGroups.list[1].keys.includes('새키워드'),'그룹 설정 저장(UI) 후 서버에 자동 동기화');
let B=mk({ins_server_url:URL1,ins_server_key:S.KEY}); await sleep(30);
r=await B.run('syncNow()');
ok(B.get('COV_GROUPS.length')===3 && B.get('getCovGroup("새키워드담보").label')==='🎗️ 암','다른 기기(B)에도 같은 담보 그룹이 적용됨');
ok(B.get('CONTRACTS.length')===7,'B가 계약도 함께 받음');
await A.run(`copyShareLink('${P1}')`); const link=A.clip; const hash='#'+link.split('#')[1];
const Cust=makeDevice({hash,fetch:route}); await sleep(80);
ok(Cust.bodyHtml.includes('cv-screen'),'고객 링크로 고객 화면이 열림');
ok(Cust.get('getCovGroup("새키워드담보").label')==='🎗️ 암','고객 화면에도 관리 화면과 같은 담보 그룹 적용');
ok(Cust.get('CONTRACTS.every(c=>c.p==="가입자1")'),'고객은 자기 계약만 받음');
ok(!/메모1|메모7/.test(Cust.bodyHtml),'고객 화면에 메모 없음');

console.log('C) 서버 설정 값을 믿지 않음 (악성 값이 와도 안전)');
const evil=JSON.parse(S.dataFile().content); evil.settings={covGroups:{list:[{label:'<img src=x onerror=alert(1)>"그룹',color:'red;background:url(x)',bg:'#fff',border:'#000',keys:['<b>키</b>',5,null]},{label:'기타',color:'#222',bg:'#eee',border:'#ddd',keys:[]}]}};
S.dataFile().content=JSON.stringify(evil);
const Cust2=makeDevice({hash,fetch:route}); await sleep(80);
const g0=Cust2.get('COV_GROUPS[0]');
ok(!/[<>"`]/.test(g0.label)&&!/[<>"`]/.test(g0.keys.join('')),'그룹 이름·키워드의 태그/따옴표 제거: '+g0.label);
ok(g0.color==='#6366F1','잘못된 색상 값은 기본 색으로 교체: '+g0.color);
ok(g0.keys.every(k=>typeof k==='string'),'숫자·null 키워드 제거');
const bad=JSON.parse(S.dataFile().content); bad.settings={covGroups:{list:'문자열'}}; S.dataFile().content=JSON.stringify(bad);
const Cust3=makeDevice({hash,fetch:route}); await sleep(80);
ok(Cust3.bodyHtml.includes('cv-screen')&&Cust3.get('COV_GROUPS.length')>=2,'설정이 통째로 이상해도 기본 그룹으로 정상 표시');
const fix=JSON.parse(S.dataFile().content); fix.settings=srv.settings; S.dataFile().content=JSON.stringify(fix);

console.log('D) 백업 파일 → 복원 왕복 (실제 💾 / 📂 함수)');
await A.run('syncNow()');
A.run('exportData()'); const dl=A.downloads[A.downloads.length-1]; const bak=JSON.parse(dl.text);
ok(Object.keys(bak).sort().join()==='contracts,coverages,exportedAt,groups,memos,monthly,settings,shares,version','백업 파일에 모든 데이터 포함: '+Object.keys(bak).sort().join(','));
ok(bak.settings.covGroups.list.length===3&&Object.keys(bak.coverages).length===2&&bak.memos['7']==='메모7','그룹 설정·보장분석·메모가 실제 값으로 들어 있음');
const snapshot=A.get('({c:CONTRACTS,m:MONTHLY,g:GROUPS,v:COVERAGES,o:MEMOS,s:SHARES,t:SETTINGS})');
A.run(`CONTRACTS=[]; MONTHLY=[]; GROUPS={}; COVERAGES={}; MEMOS={}; SETTINGS={}; SHARES={}`);   // 데이터가 모두 날아간 상황
A.run(`importData({target:{files:[{__text:${JSON.stringify(JSON.stringify(bak))}}],value:''}})`); await sleep(120);
const after=A.get('({c:CONTRACTS,m:MONTHLY,g:GROUPS,v:COVERAGES,o:MEMOS,s:SHARES,t:SETTINGS})');
ok(JSON.stringify(after.c)===JSON.stringify(snapshot.c),'복원 후 계약 동일');
ok(JSON.stringify(after.v)===JSON.stringify(snapshot.v),'복원 후 보장분석 동일');
ok(JSON.stringify(after.o)===JSON.stringify(snapshot.o)&&JSON.stringify(after.g)===JSON.stringify(snapshot.g)&&JSON.stringify(after.m)===JSON.stringify(snapshot.m),'복원 후 메모·그룹·월별 동일');
ok(JSON.stringify(after.t)===JSON.stringify(snapshot.t)&&JSON.stringify(after.s)===JSON.stringify(snapshot.s),'복원 후 그룹 설정·고객 링크 토큰 동일');
ok(A.get('getCovGroup("새키워드담보").label')==='🎗️ 암','복원 후 그룹 설정이 실제 적용됨');
srv=JSON.parse(S.dataFile().content);
ok(srv.contracts.length===7&&Object.keys(srv.coverages).length===2&&srv.settings.covGroups.list.length===3,'복원 내용이 서버에도 반영됨');
ok(S.ROOT.folders[0].folders.find(f=>f.name==='백업').files.some(f=>/복원전/.test(f.name)),'복원 직전 서버 상태가 백업 폴더에 보관됨');

console.log('E) 옛 형식 백업(계약·월별·그룹만) 복원 시 보장분석·메모는 유지');
const oldFmt={contracts:bak.contracts.slice(0,5),monthly:bak.monthly,groups:bak.groups};
A.run(`importData({target:{files:[{__text:${JSON.stringify(JSON.stringify(oldFmt))}}],value:''}})`); await sleep(120);
ok(A.get('CONTRACTS.length')===5,'옛 백업의 계약으로 교체됨');
ok(Object.keys(A.get('COVERAGES')).length===2&&A.get('MEMOS')['7']==='메모7'&&A.get('COV_GROUPS.length')===3,'파일에 없는 보장분석·메모·그룹 설정은 지워지지 않고 유지');

console.log('F) 계약 삭제 시 메모·분석 데이터 정리');
let F=mk(seedLS); await sleep(30);
ok(F.get('MEMOS')['7']==='메모7','삭제 전 7번 메모 있음');
F.run(`COVERAGES['${P1}'].policies.push({id:7,items:[{name:'남은분석',amount:1,unit:'만원',price:0}]}); CONTRACTS.find(c=>c.id===7).p='가입자1'`);
F.el('edit-id').value='7'; F.run('deleteContract()');
ok(!F.get('CONTRACTS').some(c=>c.id===7),'7번 계약 삭제');
ok(F.get('MEMOS')['7']===undefined,'7번 메모도 함께 삭제');
ok(!F.get('COVERAGES')[P1].policies.some(p=>p.id===7)&&F.get('COVERAGES')[P1].policies.some(p=>p.id===1),'7번 분석 데이터만 삭제, 다른 계약 분석은 유지');
await F.run('syncNow()'); await B.run('syncNow()');
ok(JSON.parse(S.dataFile().content).memos['7']===undefined,'삭제가 서버에도 반영');

console.log('G) 상단 요약 카드가 동기화 후에도 갱신');
const kBefore=B.el('kpis').innerHTML; B.run('renderAll()'); ok((B.el('kpis').innerHTML.match(/class="kpi /g)||[]).length===5,'요약 카드 5개');

console.log(`\n앱 전체 통합 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail?1:0);
})();
