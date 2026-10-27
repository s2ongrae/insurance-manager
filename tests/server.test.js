const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname,'.build','code_gs.js'), 'utf8');

// ───────── 가짜 Google 환경 ─────────
let CLOCK = new Date('2026-10-13T03:00:00Z').getTime();
class FakeFile {
  constructor(name, content, parent){ this.name=name; this.content=content; this.parent=parent; this.trashed=false; this.created=CLOCK; this.id='id'+Math.random().toString(36).slice(2,10); this.sharing=null; }
  getBlob(){ const c=this.content; return { getDataAsString:()=>c }; }
  setContent(c){ this.content=c; return this; }
  getName(){ return this.name; }
  getDateCreated(){ return new Date(this.created); }
  setTrashed(t){ this.trashed=t; return this; }
  makeCopy(name, folder){ const f=new FakeFile(name, this.content, folder); folder.files.push(f); return f; }
  setSharing(a,p){ this.sharing=[a,p]; return this; }
  getUrl(){ return 'https://drive.google.com/file/d/'+this.id+'/view'; }
  getId(){ return this.id; }
}
class FakeFolder {
  constructor(name, parent){ this.name=name; this.parent=parent; this.files=[]; this.folders=[]; }
  _it(arr){ let i=0; return { hasNext:()=>i<arr.length, next:()=>arr[i++] }; }
  getFilesByName(n){ return this._it(this.files.filter(f=>!f.trashed&&f.name===n)); }
  getFiles(){ return this._it(this.files.filter(f=>!f.trashed)); }
  getFoldersByName(n){ return this._it(this.folders.filter(f=>f.name===n)); }
  createFolder(n){ const f=new FakeFolder(n,this); this.folders.push(f); return f; }
  createFile(a,b){ // createFile(name, content, mime) or createFile(blob)
    let f; if(typeof a==='string') f=new FakeFile(a,b,this); else f=new FakeFile(a.name, a.bytes, this);
    this.files.push(f); return f; }
}
const ROOT = new FakeFolder('', null);
const props = {};
let lockBusy = false;
const sandbox = {
  console, Logger:{ log:(m)=>{ sandbox.__logs.push(m); } }, __logs:[],
  DriveApp:{
    getFoldersByName:n=>ROOT._it(ROOT.folders.filter(f=>f.name===n)),
    createFolder:n=>ROOT.createFolder(n),
    Access:{ANYONE_WITH_LINK:'ANYONE_WITH_LINK'}, Permission:{VIEW:'VIEW'}
  },
  MimeType:{ PLAIN_TEXT:'text/plain', PDF:'application/pdf' },
  PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]===undefined?null:props[k], setProperty:(k,v)=>{props[k]=v;} }) },
  LockService:{ getScriptLock:()=>({ tryLock:()=>!lockBusy, releaseLock:()=>{} }) },
  Utilities:{
    sleep:()=>{ sandbox.__sleeps++; }, getUuid:()=>require('crypto').randomUUID(),
    base64Decode:s=>Array.from(Buffer.from(s,'base64')),
    newBlob:(bytes,mime,name)=>({bytes:Buffer.from(bytes).toString('latin1'),mime,name}),
    formatDate:(d,tz,fmt)=>{ const x=new Date(d.getTime()+9*3600e3); const p=n=>String(n).padStart(2,'0');
      const Y=x.getUTCFullYear(),M=p(x.getUTCMonth()+1),D=p(x.getUTCDate()),h=p(x.getUTCHours()),m=p(x.getUTCMinutes()),s=p(x.getUTCSeconds());
      return fmt.replace('yyyy',Y).replace('MM',M).replace('dd',D).replace('HHmmss',h+m+s); }
  },
  ContentService:{ MimeType:{JSON:'json'}, createTextOutput:t=>({ _t:t, setMimeType(){ return this; }, getContent(){ return this._t; } }) },
  __sleeps:0, Date:class extends Date{ constructor(...a){ if(a.length) super(...a); else super(CLOCK); } static now(){ return CLOCK; } }
};
const vm = require('vm'); vm.createContext(sandbox); vm.runInContext(src, sandbox);

// ───────── 테스트 도우미 ─────────
let pass=0, fail=0;
function ok(cond, msg){ if(cond){ pass++; } else { fail++; console.log('  ❌', msg); } }
const post = (body)=> JSON.parse(sandbox.doPost({postData:{contents: typeof body==='string'?body:JSON.stringify(body)}}).getContent());
const KEY = 'k'.repeat(64);
function setup(){ props.SECRET_KEY = KEY; }
const sample = (n=6)=>({ contracts:Array.from({length:n},(_,i)=>({id:i+1,s:'계약완료',d:'26.01.01',c:'홍길동',p:i%2?'가입자B':'가입자A',co:'테스트화재',n:'종합'+i,pr:10000+i,g:'지인들',proposalUrl:'https://secret/'+i})), monthly:[{m:'26.01',k:1,before:1,after:1,tax:0,memo:''}], groups:{'지인들':'#868E96'}, coverages:{'가입자A':{policies:[{id:1,items:[{name:'암진단비',amount:3000}]}]},'가입자B':{policies:[]}, 'c3':{}, 'c4':{}}, memos:{'1':'비공개 메모'}, shares:{'가입자A':'t'.repeat(40)} });

// ───────── 1) 접근 통제 ─────────
console.log('1) 접근 통제');
let r = JSON.parse(sandbox.doGet({}).getContent());
ok(r.ok===false && r.error==='POST로만 사용할 수 있어요.', 'doGet은 안내 문구만');
ok(!JSON.stringify(r).includes('contracts'), 'doGet에 데이터 없음');
r = post({action:'load', key:KEY}); ok(r.error==='unauthorized', '키 미설정 서버는 전부 거절');
setup();
r = post({action:'load'}); ok(r.error==='unauthorized', '키 없이 load 거절');
r = post({action:'load', key:'x'.repeat(64)}); ok(r.error==='unauthorized', '틀린 키 load 거절');
r = post({action:'save', key:'short', data:sample()}); ok(r.error==='unauthorized', '틀린 키 save 거절');
r = post({action:'uploadFile', key:'z', base64:'JVBERi0='}); ok(r.error==='unauthorized', '틀린 키 upload 거절');
ok(sandbox.__sleeps>=4, '틀릴 때 지연(sleep) 적용');
r = post(sample()); ok(r.ok===false, '옛 방식(키·action 없이 통째로 전송) 거절');
r = post('not json'); ok(r.ok===false, '깨진 요청 거절');
r = post({action:'hack', key:KEY}); ok(r.ok===false, '알 수 없는 action 거절');
r = post({action:'ping', key:KEY}); ok(r.ok===true, '올바른 키 ping 성공');
props.SECRET_KEY='short'; r = post({action:'ping', key:'short'}); ok(r.error==='unauthorized','32자 미만 키는 설정돼도 거절'); setup();

// ───────── 2) 저장/불러오기/rev ─────────
console.log('2) 저장·개정번호·충돌');
r = post({action:'load', key:KEY}); ok(r.ok && r.rev===0 && r.data.contracts.length===0, '새 서버는 빈 데이터 rev 0');
r = post({action:'save', key:KEY, baseRev:0, data:sample()}); ok(r.ok && r.rev===1, '첫 저장 rev 1');
r = post({action:'load', key:KEY}); ok(r.data.contracts.length===6 && r.rev===1, '불러오기 일치');
const s2 = sample(); s2.contracts[0].pr = 99999;
r = post({action:'save', key:KEY, baseRev:0, data:s2}); ok(r.conflict===true && r.rev===1 && r.data.contracts.length===6, '옛 rev로 저장하면 충돌(덮어쓰지 않음)');
r = post({action:'load', key:KEY}); ok(r.data.contracts[0].pr===10000, '충돌 시 서버 데이터 그대로');
r = post({action:'save', key:KEY, baseRev:1, data:s2}); ok(r.ok && r.rev===2, '맞는 rev로 저장 성공');
r = post({action:'save', key:KEY, baseRev:2, data:{contracts:'x'}}); ok(r.ok===false, '모양이 이상한 데이터 거절');
lockBusy = true; r = post({action:'save', key:KEY, baseRev:2, data:sample()}); ok(r.ok===false && /진행 중/.test(r.error), '동시 저장(잠금) 중이면 거절'); lockBusy=false;

r = post({action:'save', key:KEY, baseRev:2, data:Object.assign(sample(), {tombstones:{contracts:{'9':'2026-10-01T00:00:00Z'}}})}); ok(r.ok && r.rev===3, '삭제 기록이 포함된 저장');
r = post({action:'load', key:KEY}); ok(r.data.tombstones.contracts['9'], '삭제 기록이 서버에 보관됨');
r = post({action:'save', key:KEY, baseRev:3, data:sample()}); ok(r.ok && r.rev===4, '삭제 기록 없이 저장하면 빈 값으로(모양 유지)');
r = post({action:'load', key:KEY}); ok(JSON.stringify(r.data.tombstones)==='{}', '빈 삭제 기록');
// ───────── 3) 줄어듦 방지 ─────────
console.log('3) 줄어듦 방지');
const tiny = sample(1); tiny.coverages = sample().coverages;
r = post({action:'save', key:KEY, baseRev:4, data:tiny}); ok(r.error==='shrink', '계약이 절반 아래로 줄면 중단');
const tiny2 = sample(6); tiny2.coverages = {};
r = post({action:'save', key:KEY, baseRev:4, data:tiny2}); ok(r.error==='shrink', '보장분석 고객이 절반 아래로 줄면 중단');
r = post({action:'load', key:KEY}); ok(r.data.contracts.length===6 && Object.keys(r.data.coverages).length===4, '중단된 저장은 서버 데이터를 건드리지 않음');
r = post({action:'save', key:KEY, baseRev:4, force:true, data:tiny}); ok(r.ok && r.rev===5, 'force 저장은 허용(복원용)');
r = post({action:'save', key:KEY, baseRev:5, data:sample()}); ok(r.ok && r.rev===6, '이후 정상 저장');

// ───────── 4) 백업 ─────────
console.log('4) 백업');
const bdir = ROOT.folders[0].folders.find(f=>f.name==='백업');
ok(!!bdir, '백업 폴더 생성');
const names = bdir.files.map(f=>f.name);
ok(names.some(n=>n==='보험관리툴_데이터_2026-10-13.json'), '하루 1회 백업 파일 생성');
ok(names.filter(n=>/_2026-10-13\.json$/.test(n)).length===1, '같은 날 두 번째 저장은 백업 중복 안 함');
ok(names.some(n=>/복원전/.test(n)), 'force 저장 직전엔 별도 백업');
const first = bdir.files.find(f=>f.name==='보험관리툴_데이터_2026-10-13.json');
ok(JSON.parse(first.content).rev===0 || JSON.parse(first.content).contracts.length===0, '백업은 저장 "직전" 상태');
CLOCK += 20*86400e3;  // 20일 뒤
r = post({action:'save', key:KEY, baseRev:6, data:sample()}); ok(r.ok, '20일 뒤 저장');
ok(bdir.files.filter(f=>!f.trashed&&/2026-10-13/.test(f.name)).length===0, '14일 지난 백업은 휴지통으로');
ok(bdir.files.some(f=>!f.trashed&&/2026-11-02/.test(f.name)), '새 날짜 백업 생성');

// ───────── 5) 고객 링크 ─────────
console.log('5) 고객 링크(고객별 토큰)');
const TOK = 't'.repeat(40);
r = post({action:'getCustomerView', name:'가입자A', token:TOK});
ok(r.ok===true, '올바른 토큰이면 조회 가능 (관리 키 불필요)');
ok(r.contracts.every(c=>c.p==='가입자A'), '그 고객 계약만 반환');
ok(Object.keys(r.coverages).length===1 && r.coverages['가입자A'], '그 고객 보장분석만 반환');
const txt = JSON.stringify(r);
ok(!txt.includes('비공개 메모') && !txt.includes('secret') && !txt.includes('홍길동') && !txt.includes('가입자B'), '메모·제안서 링크·계약자·다른 고객 정보는 포함 안 됨');
r = post({action:'getCustomerView', name:'가입자A', token:'wrong'.repeat(8)}); ok(r.ok===false && !r.contracts, '틀린 토큰 거절');
r = post({action:'getCustomerView', name:'가입자B', token:TOK}); ok(r.ok && r.key==='가입자A' && r.contracts.every(c=>c.p==='가입자A') && !JSON.stringify(r).includes('가입자B'), '다른 이름을 넣어도 토큰이 정한 사람의 정보만 나옴 (이름은 인증에 쓰지 않음)');
r = post({action:'getCustomerView', name:'가입자A', token:''}); ok(r.ok===false, '토큰 없음 거절');
r = post({action:'getCustomerView', name:'__proto__', token:'x'.repeat(40)}); ok(r.ok===false, '__proto__ 이름 거절');
r = post({action:'getCustomerView', name:'없는사람', token:'z'.repeat(40)}); ok(r.ok===false, '모르는 토큰은 이름이 뭐든 거절');

console.log('5b) 설정(settings): 저장·고객 화면 전달 범위');
{ const cur = post({action:'load',key:KEY});
  const d = Object.assign(sample(), {settings:{covGroups:{list:[{label:'A',color:'#111',bg:'#eee',border:'#ddd',keys:['x']},{label:'B',color:'#222',bg:'#eee',border:'#ddd',keys:[]}]}, 비공개설정:{비밀:'값'}}, shares:{'가입자A':'t'.repeat(40)}});
  let w = post({action:'save',key:KEY,baseRev:cur.rev,data:d}); ok(w.ok,'settings 포함 저장');
  const l = post({action:'load',key:KEY}); ok(l.data.settings.covGroups.list.length===2 && l.data.settings['비공개설정'],'settings 가 서버에 보관됨');
  const cv = post({action:'getCustomerView',name:'가입자A',token:'t'.repeat(40)});
  ok(cv.ok && cv.settings.covGroups.list[0].label==='A','고객 화면에 담보 그룹 설정 전달');
  ok(!JSON.stringify(cv).includes('비공개') && Object.keys(cv.settings).join()==='covGroups','다른 설정은 고객에게 안 감');
  w = post({action:'save',key:KEY,baseRev:l.rev,data:sample()}); ok(w.ok,'settings 없는 저장도 가능 (옛 앱 호환)');
  ok(JSON.stringify(post({action:'load',key:KEY}).data.settings)==='{}','settings 없으면 빈 값으로 유지'); }

console.log('5c) 가입자 고유 번호(pid) 기반 고객 링크');
{ const cur=post({action:'load',key:KEY});
  const TA='a'.repeat(40), TB='b'.repeat(40);
  const mkC=(id,p,pid,c)=>({id,s:'계약완료',d:'26.01.01',c,p,pid,co:'화재',n:'종합'+id,pr:1000,g:'지인들'});
  const d={contracts:[mkC(1,'홍길동','pid_a','김철수'),mkC(2,'홍길동','pid_b','이영희'),mkC(3,'홍길동','pid_a','김철수'),Object.assign(mkC(4,'홍길동','pid_a','김철수'),{s:'계약해지'})],
    monthly:[],groups:{},memos:{'1':'비공개메모'},settings:{},
    coverages:{pid_a:{policies:[{id:1,items:[{name:'A담보',amount:1}]},{id:3,items:[]}]},pid_b:{policies:[{id:2,items:[{name:'B담보',amount:2}]}]}},
    shares:{pid_a:TA,pid_b:TB}};
  let w=post({action:'save',key:KEY,baseRev:cur.rev,force:true,data:d}); ok(w.ok,'번호 기반 데이터 저장');
  const a=post({action:'getCustomerView',name:'홍길동',token:TA}), b=post({action:'getCustomerView',name:'홍길동',token:TB});
  ok(a.ok&&a.key==='pid_a'&&a.contracts.map(c=>c.id).join()==='1,3','같은 이름이어도 A 링크는 A의 계약만 (해지 계약 제외)');
  ok(b.ok&&b.key==='pid_b'&&b.contracts.map(c=>c.id).join()==='2','B 링크는 B의 계약만');
  ok(Object.keys(a.coverages).join()==='pid_a'&&JSON.stringify(a).includes('A담보')&&!JSON.stringify(a).includes('B담보'),'A 링크에는 A의 보장분석만');
  ok(!JSON.stringify(a).includes('이영희')&&!JSON.stringify(a).includes('비공개메모')&&!JSON.stringify(b).includes('김철수'),'서로의 계약자·메모는 안 보임');
  ok(a.name==='홍길동'&&a.contracts[0].pid==='pid_a','서버가 표시용 이름과 번호를 알려줌');
  const cur2=post({action:'load',key:KEY}); const d2=cur2.data; d2.contracts.filter(c=>c.pid==='pid_a').forEach(c=>c.p='홍길순');
  w=post({action:'save',key:KEY,baseRev:cur2.rev,data:d2}); ok(w.ok,'이름 변경 저장');
  const a2=post({action:'getCustomerView',name:'홍길동',token:TA});
  ok(a2.ok&&a2.name==='홍길순'&&a2.contracts.length===2&&JSON.stringify(a2).includes('A담보'),'이름을 바꿔도 같은 링크가 열리고 새 이름으로 표시, 보장분석 유지');
  ok(post({action:'getCustomerView',name:'홍길동',token:'q'.repeat(40)}).ok===false,'모르는 토큰은 거절');
  ok(post({action:'getCustomerView',name:'홍길동',token:TA.slice(0,39)}).ok===false,'토큰 일부만 맞아도 거절');
  const cur3=post({action:'load',key:KEY}); const d3=cur3.data; d3.shares=JSON.parse('{"__proto__":"'+'x'.repeat(40)+'","pid_c":"'+'c'.repeat(40)+'","pid_a":"'+TA+'"}');
  w=post({action:'save',key:KEY,baseRev:cur3.rev,data:d3});
  ok(post({action:'getCustomerView',token:'x'.repeat(40)}).ok===false,'__proto__ 열쇠의 토큰은 무시');
  ok(post({action:'getCustomerView',token:TA}).ok===true,'다른 항목이 있어도 정상 토큰은 그대로 열림');
}
// ───────── 6) 업로드 ─────────
console.log('6) PDF 업로드');
const pdf = Buffer.from('%PDF-1.4 test content').toString('base64');
r = post({action:'uploadFile', key:KEY, base64:pdf, filename:'제안서.pdf', customerFolder:'김 고객'});
ok(r.ok && /김 고객/.test(r.path) && r.viewUrl, 'PDF 업로드 성공 + 고객 폴더');
r = post({action:'uploadFile', key:KEY, base64:Buffer.from('MZ not a pdf').toString('base64'), filename:'a.pdf', customerFolder:'x'}); ok(r.ok===false, 'PDF가 아닌 파일 거절');
r = post({action:'uploadFile', key:KEY, base64:pdf, filename:'../../evil', customerFolder:'../상위'});
ok(r.ok && !/\.\.\//.test(r.path) && /\.pdf$/.test(r.path), '경로 조작 문자 제거 + .pdf 보장');
r = post({action:'uploadFile', key:KEY, base64:'', filename:'a.pdf'}); ok(r.ok===false, '빈 파일 거절');

// ───────── 7) 키 생성 ─────────
console.log('7) 키 생성/교체');
delete props.SECRET_KEY; sandbox.__logs.length=0;
vm.runInContext('createSecretKey()', sandbox);
ok(props.SECRET_KEY && props.SECRET_KEY.length===64, 'createSecretKey: 64자 키 생성');
ok(sandbox.__logs[0].includes(props.SECRET_KEY), '실행 로그에 키 표시');
const old = props.SECRET_KEY; vm.runInContext('createSecretKey()', sandbox);
ok(props.SECRET_KEY===old, '이미 있으면 덮어쓰지 않음');
vm.runInContext('rotateSecretKey()', sandbox);
ok(props.SECRET_KEY!==old && props.SECRET_KEY.length===64, 'rotateSecretKey: 새 키로 교체');
r = post({action:'ping', key:old}); ok(r.error==='unauthorized', '교체 후 옛 키 거절');

// ───────── 8) 손상 파일 보호 ─────────
console.log('8) 손상 데이터 보호');
setup();
const df = ROOT.folders[0].files.find(f=>f.name==='보험관리툴_데이터.json');
const keep = df.content; df.content = '{"contracts":[{"id":1'+'x'.repeat(50);
r = post({action:'save', key:KEY, baseRev:0, data:sample()}); ok(r.ok===false && /읽을 수 없/.test(r.error), '손상된 파일은 빈 데이터로 취급해 덮어쓰지 않음');
df.content = keep;

console.log(`\n서버 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail?1:0);
