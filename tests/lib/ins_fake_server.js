const fs=require('fs'), vm=require('vm'), nodeCrypto=require('crypto');
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
  vm.createContext(sb); vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','.build','code_gs.js'),'utf8'), sb);
  const KEY = 'K'.repeat(16)+'e'.repeat(48); props.SECRET_KEY = KEY;
  const post = body => JSON.parse(sb.doPost({postData:{contents: typeof body==='string'?body:JSON.stringify(body)}}).getContent());
  const dataFile = ()=>{ const r=ROOT.folders.find(f=>f.name==='보험관리툴'); return r && r.files.find(f=>f.name==='보험관리툴_데이터.json'); };
  return { post, KEY, ROOT, props, dataFile, tick:ms=>{CLOCK+=ms;} };
}


module.exports=makeServer;
