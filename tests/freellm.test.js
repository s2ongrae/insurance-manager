const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const core=html.match(/\/\/ <FREELLM_CORE>([\s\S]*?)\/\/ <\/FREELLM_CORE>/)[1];
const state="let FREELLM_KEY='freellmapi-synthetic-test';let FREELLM_BASE_URL='http://localhost:3001/v1';let FREELLM_MODEL='test-model';let FREELLM_PDF_MODE='auto';";
let calls=[],queue=[],pass=0;
const sb=vm.createContext({URL,AbortController,console,atob,Uint8Array,JSON,Number,Set,String,Array,Promise,
  setTimeout:(f,ms)=>ms===3000?setTimeout(f,0):setTimeout(f,ms),clearTimeout,showToast:()=>{},
  fetch:async(u,o)=>{calls.push({u,o});const r=queue.shift();if(r instanceof Error)throw r;return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.data};}});
vm.runInContext(state+core,sb);const run=s=>vm.runInContext(s,sb);
function ok(v,m){assert.ok(v,m);pass++;}
function result(content,finish='stop'){return {choices:[{finish_reason:finish,message:{content}}]};}
(async()=>{
ok(run("normalizeFreeLLMBase('http://localhost:3001')")==='http://localhost:3001/v1','base root normalized');
ok(run("normalizeFreeLLMBase('http://127.0.0.1:3001/v1/')")==='http://127.0.0.1:3001/v1','base duplicate slash');
ok(run("normalizeFreeLLMBase('https://router.example/path')")==='https://router.example/path/v1','https custom path');
for(const bad of ['http://router.example','https://a:b@router.example','https://router.example/?key=test','https://router.example/#x','javascript:alert(1)']){assert.throws(()=>run(`normalizeFreeLLMBase(${JSON.stringify(bad)})`));pass++;}
queue.push({status:200,data:{data:[{id:'x'},{id:'x'},{id:'y'},{bad:true}]}});
ok(JSON.stringify(await run('listFreeLLMModels()'))===JSON.stringify(['x','y']),'deduplicated models');
ok(calls[0].u==='http://localhost:3001/v1/models','endpoint models');
ok(calls[0].o.headers.Authorization==='Bearer freellmapi-synthetic-test','bearer auth');
ok(!calls[0].o.body&&calls[0].o.credentials==='omit'&&calls[0].o.redirect==='error','models read only without cookies or redirects');
queue.push({status:200,data:result(JSON.stringify({items:[{name:'암진단비',amount:3000,unit:'만원',price:10000}]}))});
const parsed=await run("callFreeLLMContent([{type:'text',text:'SYNTHETIC ONLY'}],'추출 요청')");
ok(parsed.items[0].amount===3000,'parsed result');
const req=calls[calls.length-1],body=JSON.parse(req.o.body);
ok(req.u.endsWith('/chat/completions')&&req.o.method==='POST','chat route');
ok(body.model==='test-model'&&body.stream===false,'pinned model');
ok(body.response_format.type==='json_object'&&body.max_tokens===8192,'JSON format config');
ok(body.messages[1].content[1].text==='SYNTHETIC ONLY','PDF text payload');
ok(!JSON.stringify(body).includes('freellmapi-synthetic-test'),'key not in body');
queue.push({status:503,data:{error:{message:'busy'}}},{status:200,data:{data:[{id:'ok'}]}});
ok((await run('listFreeLLMModels()'))[0]==='ok','retry on overloaded router');
queue.push({status:401,data:{error:{message:'secret'}}});
await assert.rejects(()=>run('listFreeLLMModels()'),/통합 API 키/);pass++;
queue.push(new Error('network'));
await assert.rejects(()=>run('listFreeLLMModels()'),/DASHBOARD_ORIGINS/);pass++;
sb.output=result('```json\n{"items":[]}\n```');ok(run('parseFreeLLMCoverage(output)').items.length===0,'fenced JSON parse');
for(const invalid of [result('{"items":[]}','length'),result('not json'),result('{"wrong":[]}'),result('{"items":[{"name":"bad","amount":-1}]}'),result('{"items":[{"name":"bad","amount":"3000"}]}'),{choices:[]}]){sb.output=invalid;assert.throws(()=>run('parseFreeLLMCoverage(output)'));pass++;}
ok(run("freeLLMError(400,{error:{message:'oops freellmapi-synthetic-test'}})").includes('[키 숨김]'),'error redacts key');
ok(/AI_PROVIDER==='gemini'/.test(html) && /자동 전환하지 않습니다/.test(html),'Gemini path is opt-in only, no silent provider fallback');
queue.push({status:200,data:{data:[]}});await run("listFreeLLMModels({base:'https://router.example/v1',key:'freellmapi-other-test'})");
ok(run('FREELLM_BASE_URL')==='http://localhost:3001/v1'&&run('FREELLM_KEY')==='freellmapi-synthetic-test','connection test never mutates saved config');
console.log(`FreeLLMAPI 테스트: ${pass}건 통과, 0건 실패`);
})().catch(e=>{console.error(e);process.exit(1);});
