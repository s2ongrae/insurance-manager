const fs=require('fs'), vm=require('vm'), nodeCrypto=require('crypto');
const FILE = process.env.HTMLFILE || require('path').join(__dirname,'..','..','index.html');
const html=fs.readFileSync(FILE,'utf8');
const SCRIPT=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n;\n');

function makeEl(){ const e={ value:'',textContent:'',innerHTML:'',placeholder:'',style:{},dataset:{},children:[],
  classList:{add(){},remove(){},toggle(){},contains(){return false;}}, appendChild(c){e.children.push(c);}, insertAdjacentHTML(p,h){e.innerHTML+=h;},
  querySelector:()=>null, querySelectorAll:()=>[], closest:()=>null, remove(){}, focus(){}, select(){}, click(){}, setAttribute(){}, addEventListener(){}, onclick:null, files:[] };
  return e; }
exports.makeDevice=function(opts={}){
  const store=new Map(Object.entries(opts.ls||{})); const sess=new Map(Object.entries(opts.session||{}));
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const sessionStorage={getItem:k=>sess.has(k)?sess.get(k):null,setItem:(k,v)=>sess.set(k,String(v)),removeItem:k=>sess.delete(k)};
  const els={}; const el=id=>els[id]||(els[id]=makeEl());
  const dev={errors:[],toasts:[],alerts:[],clip:null,downloads:[],bodyHtml:'',confirmQ:[],promptQ:[],confirms:[],prompts:[]};
  const body=makeEl(); body.insertAdjacentHTML=(p,h)=>{dev.bodyHtml+=h;};
  class FakeBlob{ constructor(parts,o){ this.text=parts.join(''); this.type=o&&o.type; } }
  class FakeFileReader{ readAsText(f){ setTimeout(()=>this.onload&&this.onload({target:{result:f.__text}}),0);} readAsDataURL(f){ setTimeout(()=>this.onload&&this.onload({target:{result:'data:application/pdf;base64,'+(f.__b64||'')}}),0);} }
  const ctx=vm.createContext({console, localStorage, sessionStorage, crypto:nodeCrypto.webcrypto, Promise, setTimeout, clearTimeout, URLSearchParams, Blob:FakeBlob, FileReader:FakeFileReader,
    URL:{createObjectURL:b=>{dev.downloads.push(b);return 'blob:x';},revokeObjectURL(){}}, atob:s=>Buffer.from(s,'base64').toString('binary'), Uint8Array,
    document:{getElementById:el, createElement:t=>{const e=makeEl(); e.tagName=t.toUpperCase(); e.click=()=>{dev.lastClick=e;}; return e;}, querySelectorAll:()=>[], querySelector:()=>null, body, activeElement:null, addEventListener(){}},
    window:{location:{hash:opts.hash||'',origin:'https://example.test',pathname:'/insurance-manager/'},addEventListener(){}, _covSubTab:null},
    location:{hash:opts.hash||'',origin:'https://example.test',pathname:'/insurance-manager/'},
    navigator:{clipboard:{writeText:async t=>{dev.clip=t;}}}, alert:m=>dev.alerts.push(m), confirm:m=>{dev.confirms.push(m);return dev.confirmQ.length?dev.confirmQ.shift():true;}, prompt:(m)=>{dev.prompts.push(m);return dev.promptQ.length?dev.promptQ.shift():null;},
    fetch: opts.fetch || (async()=>({json:async()=>({ok:false})})), PDFLib:undefined });
  // 토스트 가로채기는 앱의 showToast 가 textContent 에 쓰는 것으로 확인
  dev.ctx=ctx; dev.el=el; dev.store=store; dev.session=sess;
  dev.run=c=>vm.runInContext(c,ctx); dev.get=e=>JSON.parse(vm.runInContext(`JSON.stringify(${e})`,ctx));
  try{ vm.runInContext(SCRIPT, ctx); }catch(e){ dev.errors.push('LOAD: '+e.message); }
  return dev;
};
exports.SCRIPT=SCRIPT; exports.html=html;
