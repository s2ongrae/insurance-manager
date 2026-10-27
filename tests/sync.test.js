const fs = require('fs'), vm = require('vm'), nodeCrypto = require('crypto');

// ───────── 가짜 서버 (실제 Code.gs 를 그대로 실행) ─────────
function makeServer(){
  let CLOCK = new Date('2026-10-13T03:00:00Z').getTime();
  class FakeFile{ constructor(n,c,p){this.name=n;this.content=c;this.parent=p;this.trashed=false;this.created=CLOCK;this.id='id'+Math.random().toString(36).slice(2,10);}
    getBlob(){const c=this.content;return{getDataAsString:()=>c};} setContent(c){this.content=c;return this;} getName(){return this.name;}
    getDateCreated(){return new Date(this.created);} setTrashed(t){this.trashed=t;return this;}
    makeCopy(n,f){const x=new FakeFile(n,this.content,f);f.files.push(x);return x;} setSharing(){return this;}
    getUrl(){return'https://drive.google.com/file/d/'+this.id+'/view';} getId(){return this.id;} }
  class FakeFolder{ constructor(n,p){this.name=n;this.parent=p;this.files=[];this.folders=[];}
    _it(a){let i=0;return{hasNext:()=>i<a.length,next:()=>a[i++]};}
    getFilesByName(n){return this._it(this.files.filter(f=>!f.trashed&&f.name===n));} getFiles(){return this._it(this.files.filter(f=>!f.trashed));}
    getFoldersByName(n){return this._it(this.folders.filter(f=>f.name===n));}
    createFolder(n){const f=new FakeFolder(n,this);this.folders.push(f);return f;}
    createFile(a,b){const f=typeof a==='string'?new FakeFile(a,b,this):new FakeFile(a.name,a.bytes,this);this.files.push(f);return f;} }
  const ROOT=new FakeFolder('',null), props={}; let writes=0;
  const sb={ console, Logger:{log(){}},
    DriveApp:{getFoldersByName:n=>ROOT._it(ROOT.folders.filter(f=>f.name===n)),createFolder:n=>ROOT.createFolder(n),Access:{ANYONE_WITH_LINK:1},Permission:{VIEW:1}},
    MimeType:{PLAIN_TEXT:'t',PDF:'p'}, PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]===undefined?null:props[k],setProperty:(k,v)=>{props[k]=v;}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{sleep(){},getUuid:()=>nodeCrypto.randomUUID(),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({bytes:Buffer.from(b).toString('latin1'),name:n}),
      formatDate:(d,tz,f)=>{const x=new Date(d.getTime()+9*3600e3),p=n=>String(n).padStart(2,'0');return f.replace('yyyy',x.getUTCFullYear()).replace('MM',p(x.getUTCMonth()+1)).replace('dd',p(x.getUTCDate())).replace('HHmmss',p(x.getUTCHours())+p(x.getUTCMinutes())+p(x.getUTCSeconds()));}},
    ContentService:{MimeType:{JSON:'j'},createTextOutput:t=>({_t:t,setMimeType(){return this;},getContent(){return this._t;}})},
    Date:class extends Date{constructor(...a){if(a.length)super(...a);else super(CLOCK);} static now(){return CLOCK;}} };
  vm.createContext(sb); vm.runInContext(fs.readFileSync(require('path').join(__dirname,'.build','code_gs.js'),'utf8'), sb);
  const KEY = 'K'.repeat(16)+'e'.repeat(48); props.SECRET_KEY = KEY;
  const post = body => JSON.parse(sb.doPost({postData:{contents: typeof body==='string'?body:JSON.stringify(body)}}).getContent());
  const dataFile = ()=>{ const r=ROOT.folders.find(f=>f.name==='보험관리툴'); return r && r.files.find(f=>f.name==='보험관리툴_데이터.json'); };
  return { post, KEY, ROOT, props, dataFile, tick:ms=>{CLOCK+=ms;} };
}

// ───────── 기기 하나 (실제 index.html 의 동기화 코드를 그대로 실행) ─────────
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const s0 = html.indexOf('// 구글 드라이브 클라우드 연동 (보안 강화판)'), e0 = html.indexOf('function load(key, def)');
const SYNC_SRC = html.slice(s0, e0);
function makeDevice(server, url){
  const store = new Map();
  const localStorage = { getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
  const els = {}; const el = id => els[id] || (els[id] = {value:'',textContent:'',placeholder:'',style:{},dataset:{},classList:{add(){},remove(){}},appendChild(){},onclick:null});
  const dev = { toasts:[], renders:0, hooks:{} };
  const ctx = vm.createContext({
    console, localStorage, crypto: nodeCrypto.webcrypto, URLSearchParams, Promise, setTimeout, clearTimeout,
    document:{ getElementById:el, createElement:()=>({style:{},dataset:{},appendChild(){},textContent:''}), activeElement:null },
    window:{ addEventListener(){} }, location:{origin:'https://s2ongrae.github.io',pathname:'/insurance-manager/'},
    navigator:{clipboard:{writeText:async t=>{dev.clip=t;}}}, prompt:()=>{}, confirm:()=>true,
    fetch: async (u, opts) => {
      const body = JSON.parse(opts.body);
      const h = dev.hooks;
      if(h.beforeCall) h.beforeCall(body);
      const out = server.post(opts.body);
      if(body.action==='load' && h.afterLoad){ const f=h.afterLoad; h.afterLoad=null; f(); }
      if(body.action==='save' && h.afterSave){ const f=h.afterSave; h.afterSave=null; f(); }
      return { json: async()=>out };
    }
  });
  const prelude = `let CONTRACTS=[],MONTHLY=[],GROUPS={},COVERAGES={},MEMOS={},SHARES={},TOMBS={},SETTINGS={},nextId=1; function refreshCovGroups(){}
    function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
    function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
    function showToast(m){__dev.toasts.push(m);} function renderAll(){__dev.renders++;} function closeModal(){} function openServerSettings(){__dev.opened=true;}`;
  ctx.__dev = dev;
  vm.runInContext(prelude, ctx);
  if(url){ localStorage.setItem('ins_server_url', url); localStorage.setItem('ins_server_key', server.KEY); }
  vm.runInContext(SYNC_SRC, ctx);
  dev.run = code => vm.runInContext(code, ctx);
  dev.get = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx));
  dev.el = el; dev.store = store;
  return dev;
}

// ───────── 테스트 ─────────
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ❌',m); } };
const URL1 = 'https://script.google.com/macros/s/AKfycbTESTTESTTESTTESTTEST1234/exec';
const C=(id,x={})=>Object.assign({id,s:'계약완료',c:'계약자'+id,p:'가입자'+(id%3),co:'화재',n:'종합'+id,pr:1000*id,g:'지인들'},x);
const seed = {contracts:[C(1),C(2),C(3),C(4),C(5),C(6)], monthly:[{m:'26.01',k:1,before:1,after:1,tax:0,memo:''}], groups:{'지인들':'#868E96'}, coverages:{}, memos:{'1':'메모1'}};

(async()=>{
console.log('A) 처음 연결: 옛 서버 파일(보장분석 비어 있음) + 이 기기에만 있는 보장분석');
const S = makeServer();
S.ROOT.createFolder('보험관리툴').createFile('보험관리툴_데이터.json', JSON.stringify(seed));   // 옛 형식: rev·shares 없음
let A = makeDevice(S, URL1);
const P1 = A.run("legacyPid('가입자1')"), P2 = A.run("legacyPid('가입자2')");   // 가입자 고유 번호(이름이 같으면 같은 번호)
A.run(`CONTRACTS=${JSON.stringify(seed.contracts)};MONTHLY=${JSON.stringify(seed.monthly)};GROUPS=${JSON.stringify(seed.groups)};MEMOS=${JSON.stringify(seed.memos)};COVERAGES=${JSON.stringify({[P1]:{policies:[{id:1,items:[{name:'암진단비',amount:3000,unit:'만원',price:0}]}]}})}`);
let r = await A.run('syncNow()');
ok(r.ok, 'A 첫 동기화 성공');
let srv = JSON.parse(S.dataFile().content);
ok(srv.rev===1 && srv.contracts.length===6, '서버 계약 6건 그대로 + rev 1');
ok(srv.coverages[P1] && srv.coverages[P1].policies[0].items[0].name==='암진단비', '서버에 비어 있던 보장분석이 이 기기 것으로 복구');
ok(A.get('SYNC_BASE').rev===1, '기준 상태(base) 저장');

console.log('B) 새 기기에서 연결: 서버 내용을 받아옴');
let B = makeDevice(S, URL1);
r = await B.run('syncNow()');
ok(r.ok && r.changedLocal, 'B 동기화 + 로컬 변경 표시');
ok(B.get('CONTRACTS').length===6 && B.get('COVERAGES')[P1], 'B가 계약·보장분석 모두 받음');
ok(B.run('listCheckpoints()').length>=1, '합치기 직전 체크포인트 생성');

console.log('C) 두 기기가 서로 다른 항목을 고치고 번갈아 동기화');
B.run(`CONTRACTS.find(c=>c.id===2).pr=22222; MEMOS['2']='B가 쓴 메모'`);
A.run(`CONTRACTS.find(c=>c.id===3).pr=33333; CONTRACTS.push({id:7,s:'계약완료',c:'새계약',p:'가입자1',co:'화재',n:'새상품',pr:7000,g:'지인들'}); nextId=8`);
await B.run('syncNow()'); await A.run('syncNow()'); await B.run('syncNow()');
for(const [nm,D] of [['A',A],['B',B]]){
  const cs = D.get('CONTRACTS');
  ok(cs.find(c=>c.id===2).pr===22222 && cs.find(c=>c.id===3).pr===33333 && cs.some(c=>c.id===7), `${nm}: 두 기기의 수정·추가가 모두 남음`);
  ok(D.get('MEMOS')['2']==='B가 쓴 메모' && D.get('MEMOS')['1']==='메모1', `${nm}: 메모 합쳐짐`);
}

console.log('D) 저장하는 순간 다른 기기가 먼저 저장 (rev 충돌 → 다시 합쳐 저장)');
A.run(`CONTRACTS.find(c=>c.id===4).pr=44444`);
B.run(`CONTRACTS.find(c=>c.id===5).pr=55555`);
A.hooks.afterLoad = ()=>{ B.run('syncNow()'); };      // A가 load 한 직후 B가 끼어들어 저장
// B.run('syncNow()') 는 Promise 라서 동기 훅에선 끝나지 않으니, 서버에 직접 B의 변경을 저장해 충돌을 만든다
A.hooks.afterLoad = ()=>{ const cur=S.post({action:'load',key:S.KEY}); const d=cur.data; d.contracts.find(c=>c.id===6).pr=66666; S.post({action:'save',key:S.KEY,baseRev:cur.rev,data:d}); };
r = await A.run('syncNow()');
ok(r.ok, '충돌이 있어도 다시 불러와 합친 뒤 저장 성공');
srv = JSON.parse(S.dataFile().content);
ok(srv.contracts.find(c=>c.id===4).pr===44444 && srv.contracts.find(c=>c.id===6).pr===66666, '끼어든 저장(6번)과 내 저장(4번)이 둘 다 서버에 남음');

console.log('E) 입력 중에 동기화가 끝나도 입력이 사라지지 않음');
A.hooks.afterLoad = ()=>{ A.run(`CONTRACTS.find(c=>c.id===1).pr=11111`); };   // 불러오는 동안 사용자가 고침
r = await A.run('syncNow()'); srv = JSON.parse(S.dataFile().content);
ok(A.get('CONTRACTS').find(c=>c.id===1).pr===11111 && srv.contracts.find(c=>c.id===1).pr===11111, '불러오는 중 고친 값이 로컬·서버에 남음');
A.hooks.afterSave = ()=>{ A.run(`CONTRACTS.find(c=>c.id===2).pr=20202`); };    // 저장하는 동안 사용자가 또 고침
A.run(`CONTRACTS.find(c=>c.id===3).pr=30303`);
await A.run('syncNow()');
ok(A.get('CONTRACTS').find(c=>c.id===2).pr===20202, '저장 중 고친 값이 로컬에 남음');
r = await A.run('syncNow()'); srv = JSON.parse(S.dataFile().content);
ok(srv.contracts.find(c=>c.id===2).pr===20202, '저장 중 고친 값이 다음 동기화에서 서버에 반영됨 (유실 없음)');

console.log('F) 삭제 전파');
A.run(`CONTRACTS = CONTRACTS.filter(c=>c.id!==7)`); await A.run('syncNow()'); await B.run('syncNow()');
ok(!B.get('CONTRACTS').some(c=>c.id===7), 'A에서 지운 계약이 B에서도 사라짐');
ok(JSON.parse(S.dataFile().content).contracts.every(c=>c.id!==7), '서버에서도 삭제');


console.log('F2) 지워진 항목을 다른 기기가 고쳐 두었으면 고친 쪽이 살아남음');
let Cd = makeDevice(S, URL1); await Cd.run('syncNow()');
A.run(`CONTRACTS = CONTRACTS.filter(c=>c.id!==6)`); await A.run('syncNow()');
ok(!JSON.parse(S.dataFile().content).contracts.some(c=>c.id===6), 'A가 6번을 지워 서버에서도 삭제');
ok(JSON.parse(S.dataFile().content).tombstones.contracts['6'], '서버에 삭제 기록이 남음');
Cd.run(`CONTRACTS.find(c=>c.id===6).pr=60606`); await Cd.run('syncNow()');
ok(JSON.parse(S.dataFile().content).contracts.some(c=>c.id===6 && c.pr===60606), '지워진 항목을 고쳐 둔 C의 값이 서버에 되살아남');
await A.run('syncNow()');
ok(A.get('CONTRACTS').some(c=>c.id===6 && c.pr===60606), 'A에도 반영');
ok(!(JSON.parse(S.dataFile().content).tombstones.contracts||{})['6'], '살아난 항목의 삭제 기록은 정리');
await B.run('syncNow()');

console.log('G) 서버 데이터가 증발해도 이 기기 데이터로 복구');
const df = S.dataFile(); const before = JSON.parse(df.content);
df.content = JSON.stringify({contracts:[],monthly:[],groups:{},coverages:{},memos:{},shares:{},rev:before.rev});
r = await A.run('syncNow()'); srv = JSON.parse(S.dataFile().content);
ok(r.ok && srv.contracts.length===before.contracts.length && Object.keys(srv.coverages).length>=1, '서버가 비어 있어도 A의 데이터로 서버 복구');

console.log('H) 이 기기 데이터가 실수로 비워지면 서버가 막아줌');
A.run(`CONTRACTS = []; COVERAGES = {}; MEMOS = {}`);
const serverBefore = S.dataFile().content;
r = await A.run('syncNow()');
ok(r.ok===false && r.reason==='shrink', '줄어듦 방지 작동: 동기화 중단');
ok(S.dataFile().content===serverBefore, '서버 데이터는 그대로');
A.run(`SYNC_BASE=null; localStorage.removeItem('ins_sync_base')`);
r = await A.run('syncNow()');
ok(r.ok && A.get('CONTRACTS').length>=6, '기준 없이 다시 동기화하면 서버 데이터를 받아 복구');

console.log('I) 잘못된 키');
const goodKey = A.run('SERVER_KEY'); A.run(`SERVER_KEY='x'.repeat(64)`);
const keep = JSON.stringify(A.get('CONTRACTS'));
r = await A.run('syncNow()');
ok(r.ok===false && r.reason==='unauthorized', '키가 틀리면 동기화 실패 + 안내');
ok(JSON.stringify(A.get('CONTRACTS'))===keep, '키 오류 시 로컬 데이터는 그대로');
A.run(`SERVER_KEY='${goodKey}'`);

console.log('J) 고객 링크');
const url = await (async()=>{ await A.run(`copyShareLink('${P1}')`); return A.clip; })();
const hash = url.split('#')[1]; const p = new URLSearchParams(hash);
ok(p.get('view')==='가입자1' && p.get('t').length===48 && p.get('s')==='AKfycbTESTTESTTESTTESTTEST1234', '링크에 이름·토큰·서버ID 포함 (비밀 키는 없음)');
ok(!url.includes(S.KEY), '링크에 관리 비밀 키가 들어가지 않음');
let cv = S.post({action:'getCustomerView', name:'가입자1', token:p.get('t')});
ok(cv.ok && cv.contracts.length>0 && cv.contracts.every(c=>c.p==='가입자1'), '그 링크로 해당 고객 정보만 조회');
ok(!JSON.stringify(cv).includes('메모1') && !cv.contracts[0].c && !cv.contracts[0].g, '메모·계약자·그룹은 고객에게 안 감');
const oldTok = p.get('t');
await A.run(`copyShareLink('${P1}', true)`);
const newTok = new URLSearchParams(A.clip.split('#')[1]).get('t');
ok(newTok!==oldTok, '재발급하면 새 토큰');
ok(S.post({action:'getCustomerView', name:'가입자1', token:oldTok}).ok===false, '재발급 후 이전 링크는 무효');
ok(S.post({action:'getCustomerView', name:'가입자1', token:newTok}).ok===true, '새 링크는 유효');
await B.run('syncNow()');
ok(B.get('SHARES')[P1]===newTok, '다른 기기에도 토큰이 동기화');
{ const x=S.post({action:'getCustomerView', name:'가입자2', token:newTok}); ok(x.ok && x.contracts.length>0 && x.contracts.every(c=>c.p==='가입자1') && !JSON.stringify(x).includes('가입자2'), '다른 이름을 넣어도 토큰이 정한 사람(가입자1)의 정보만 나옴 — 이름은 인증에 쓰지 않음'); }

console.log('K) 복원(강제 저장)');
const snap = A.get('CONTRACTS').slice(0,3);
A.run(`CONTRACTS=${JSON.stringify(snap)}`);
const okp = await A.run(`forcePushLocal('테스트 복원')`);
srv = JSON.parse(S.dataFile().content);
ok(okp===true && srv.contracts.length===3, '복원은 서버를 이 상태로 바꿈');
const bk = S.ROOT.folders[0].folders.find(f=>f.name==='백업');
ok(bk.files.some(f=>/복원전/.test(f.name)), '복원 직전 서버 상태가 백업 폴더에 보관');

console.log('L) 서버 설정 저장');
const D = makeDevice(S, null);
r = await D.run('syncNow()'); ok(r.reason==='noconfig' && D.opened!==true, '설정이 없으면 동기화 안 함');
D.el('srv-url').value = 'http://evil.example/exec'; D.el('srv-key').value = S.KEY;
await D.run('saveServerSettings()'); ok(D.run('SERVER_URL')==='' , '주소 형식이 틀리면 저장 거절');
D.el('srv-url').value = URL1; D.el('srv-key').value = 'short';
await D.run('saveServerSettings()'); ok(D.run('SERVER_URL')==='', '키가 짧으면 거절');
D.el('srv-key').value = 'x'.repeat(64);
await D.run('saveServerSettings()'); ok(D.run('SERVER_URL')==='' && D.store.get('ins_server_key')===undefined, '연결 테스트 실패 시 이전(없음) 상태로 복원, 저장 안 됨');
D.el('srv-key').value = S.KEY;
await D.run('saveServerSettings()'); ok(D.run('SERVER_URL')===URL1 && D.store.get('ins_server_key')===S.KEY, '올바른 값은 테스트 통과 후 저장');
ok(D.get('CONTRACTS').length===3, '저장 직후 자동 동기화로 서버 내용을 받음');

console.log('M) 백업 파일 형식');
const exp = A.run(`(function(){ return JSON.stringify({version:2,contracts:CONTRACTS,monthly:MONTHLY,groups:GROUPS,coverages:COVERAGES,memos:MEMOS,shares:SHARES}); })()`);
ok(Object.keys(JSON.parse(exp)).join()==='version,contracts,monthly,groups,coverages,memos,shares', '백업에 보장분석·메모·링크 토큰 포함');

console.log(`\n앱↔서버 통합 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail?1:0);
})();
