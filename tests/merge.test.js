const fs = require('fs'), vm = require('vm');
const core = fs.readFileSync(require('path').join(__dirname,'.build','sync_core.js'),'utf8');
const ctx = vm.createContext({console}); vm.runInContext(core + '\nthis.__api={mergeAll,makeBase,sameData,toMaps,fromMaps,stableStringify,itemHash,normalizeData,merge3,mergeTombs,normTombs,migratePeopleData,legacyPid,cpid,isPid,mergeCoverageRecords};', ctx);
const A = ctx.__api;
let pass=0, fail=0;
const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ❌',m); } };
const clone = o=>JSON.parse(JSON.stringify(o));
const D = (o={})=>Object.assign({contracts:[],monthly:[],groups:{},coverages:{},memos:{},shares:{},settings:{}},o);
const C = (id,extra={})=>Object.assign({id,s:'계약완료',p:'가'+id,co:'화재',n:'종합',pr:1000*id},extra);
const ids = d=>d.contracts.map(c=>c.id).join(',');
// 기준(base)을 "마지막으로 서버와 맞춘 상태"로 만들고, 로컬/서버를 각각 고쳐서 병합
function scenario(base, edit_local, edit_server){
  const L = clone(base), S = clone(base);
  edit_local && edit_local(L); edit_server && edit_server(S);
  return A.mergeAll(A.makeBase(base), L, S);
}

console.log('1) 기본 병합 규칙');
let r = scenario(D({contracts:[C(1),C(2)]}));
ok(ids(r.data)==='1,2' && r.conflicts===0, '아무도 안 바꾸면 그대로');
r = scenario(D({contracts:[C(1),C(2)]}), L=>{L.contracts[0].pr=5}, null);
ok(r.data.contracts[0].pr===5, '이 기기만 바꿈 → 내 값');
r = scenario(D({contracts:[C(1),C(2)]}), null, S=>{S.contracts[1].pr=7});
ok(r.data.contracts[1].pr===7, '서버만 바꿈 → 서버 값');
r = scenario(D({contracts:[C(1),C(2)]}), L=>{L.contracts[0].pr=5}, S=>{S.contracts[1].pr=7});
ok(r.data.contracts[0].pr===5 && r.data.contracts[1].pr===7 && r.conflicts===0, '서로 다른 항목을 고치면 둘 다 살아남음');
r = scenario(D({contracts:[C(1)]}), L=>{L.contracts[0].pr=5}, S=>{S.contracts[0].pr=7});
ok(r.data.contracts[0].pr===5 && r.conflicts===1, '같은 항목을 둘 다 고침 → 이 기기 값, 충돌 1건');
r = scenario(D({contracts:[C(1)]}), L=>{L.contracts.push(C(10))}, S=>{S.contracts.push(C(20))});
ok(ids(r.data)==='1,10,20', '양쪽에서 새로 만든 건 모두 유지');

console.log('2) 삭제');
r = scenario(D({contracts:[C(1),C(2)]}), L=>{L.contracts=L.contracts.filter(c=>c.id!==1)}, null);
ok(ids(r.data)==='2', '이 기기에서 지움 + 서버 그대로 → 삭제 유지');
r = scenario(D({contracts:[C(1),C(2)]}), L=>{L.contracts=L.contracts.filter(c=>c.id!==1)}, S=>{S.contracts[0].pr=9});
ok(ids(r.data)==='1,2' && r.data.contracts[0].pr===9, '내가 지우고 서버가 고쳤으면 고친 쪽(서버) 살림');
r = scenario(D({contracts:[C(1),C(2)]}), L=>{L.contracts[0].pr=9}, S=>{S.contracts=S.contracts.filter(c=>c.id!==1)});
ok(ids(r.data)==='1,2' && r.data.contracts[0].pr===9, '서버에서 지웠어도 내가 고쳤으면 내 값 살림');
r = scenario(D({contracts:[C(1),C(2)]}), null, S=>{S.contracts=S.contracts.filter(c=>c.id!==1)});
ok(ids(r.data)==='1,2', '서버에 없는 항목은 지우지 않고 유지(서버가 비어도 복구)');
r = A.mergeAll(A.makeBase(D({contracts:[C(1),C(2),C(3)]})), D({contracts:[C(1),C(2),C(3)]}), D());
ok(ids(r.data)==='1,2,3', '서버가 통째로 비어 있어도 내 데이터는 그대로');

console.log('3) 기준(base)이 없을 때 (처음 연결하는 기기)');
let Lx = D({contracts:[C(1,{pr:111}),C(5)]}), Sx = D({contracts:[C(1,{pr:222}),C(2)]});
r = A.mergeAll(null, Lx, Sx);
ok(ids(r.data)==='1,2,5', '양쪽 항목이 모두 남음');
ok(r.data.contracts.find(c=>c.id===1).pr===222 && r.conflicts===1, '내용이 다르면 서버 값 + 충돌 집계');

console.log('4) 컬렉션별 (보장분석·메모·그룹·월별·공유 토큰)');
r = scenario(D({coverages:{pid_a:{policies:[{id:1}]},pid_b:{policies:[]}}, memos:{1:'a'}, groups:{x:'#111'}, monthly:[{m:'26.01',after:1}], shares:{pid_a:'t'.repeat(40)}}),
  L=>{L.coverages.pid_a.policies.push({id:2}); L.memos['2']='새메모'; L.shares['pid_b']='n'.repeat(40);},
  S=>{S.coverages.pid_b.policies.push({id:9}); S.monthly.push({m:'26.02',after:2}); S.groups.y='#222';});
ok(r.data.coverages.pid_a.policies.length===2 && r.data.coverages.pid_b.policies.length===1, '보장분석: 고객별로 각자 바꾼 게 합쳐짐');
ok(r.data.memos['1']==='a' && r.data.memos['2']==='새메모', '메모 합쳐짐');
ok(r.data.monthly.length===2 && r.data.monthly[1].m==='26.02', '월별 합쳐짐 + 월 순서 정렬');
ok(r.data.groups.x && r.data.groups.y, '그룹 합쳐짐');
ok(r.data.shares['pid_a'] && r.data.shares['pid_b'], '공유 토큰 합쳐짐');

console.log('5) 서버 데이터를 믿지 않음');
const evil = JSON.parse('{"contracts":[{"id":1,"n":"정상"},{"n":"id없음"},"문자열",null,[1],{"id":{"a":1}}],"monthly":[],"groups":{"__proto__":"#000","ok":"#111","num":5},"coverages":{"__proto__":{"polluted":true},"constructor":{"x":1},"좋음":{"policies":[]},"나쁨":"str"},"memos":{"__proto__":"x","1":"m","2":{"o":1}},"shares":{"__proto__":"x"}}');
r = A.mergeAll(null, D(), evil);
ok(ids(r.data)==='1', '모양이 이상한 계약(id 없음·문자열·null·배열·객체 id)은 건너뜀');
ok(Object.keys(r.data.coverages).length===1 && /^pid_n_/.test(Object.keys(r.data.coverages)[0]) && r.data.coverages[Object.keys(r.data.coverages)[0]].policies,'보장분석: __proto__/constructor/문자열 값 제외, 정상 항목(이름 열쇠)은 번호로 이전');
ok(!({}).polluted && !Object.prototype.polluted, '프로토타입 오염 없음');
ok(Object.keys(r.data.groups).join()==='ok' && Object.keys(r.data.memos).join()==='1', '그룹·메모의 이상한 값/키 제외');
ok(Object.keys(r.data.shares).length===0, '__proto__ 공유 키 제외');

console.log('6) 해시 안정성');
ok(A.stableStringify({b:1,a:[{y:1,x:2}]})===A.stableStringify({a:[{x:2,y:1}],b:1}), '키 순서가 달라도 같은 값');
ok(A.itemHash({a:1})!==A.itemHash({a:2}) && A.itemHash({a:1})===A.itemHash({a:1}), '해시 구분');
ok(A.sameData(D({contracts:[C(2),C(1)]}), D({contracts:[C(1),C(2)]})), '배열 순서만 다르면 같은 데이터');
ok(!A.sameData(D({contracts:[C(1)]}), D({contracts:[C(1,{pr:1})]})), '값이 다르면 다른 데이터');
ok(A.sameData(D({contracts:[C(1,{x:undefined})]}), D({contracts:[C(1)]})), 'undefined 필드는 무시');

console.log('7) 같은 id 겹침도 지우지 않음');
r = A.mergeAll(null, D({contracts:[C(1),C(1,{n:'중복'})]}), D());
ok(r.data.contracts.length===2, '로컬에 같은 id가 2개여도 둘 다 유지');


console.log('8) 삭제 기록(tombstone)');
const baseT = D({contracts:[C(1),C(2),C(3)], memos:{1:'a',2:'b'}});
function sc2(edit_l, edit_s, tombs){
  const L=clone(baseT), S=clone(baseT); edit_l&&edit_l(L); edit_s&&edit_s(S);
  if(tombs) S.tombstones = tombs;
  return A.mergeAll(A.makeBase(baseT), L, S);
}
let T = sc2(null, S=>{S.contracts=S.contracts.filter(c=>c.id!==2)}, {contracts:{'2':'2026-10-01T00:00:00Z'}});
ok(ids(T.data)==='1,3', '다른 기기가 지웠다는 기록이 있고 내가 안 고쳤으면 → 함께 삭제');
T = sc2(null, S=>{S.contracts=S.contracts.filter(c=>c.id!==2)}, null);
ok(ids(T.data)==='1,2,3', '삭제 기록이 없으면(서버 증발 등) 지우지 않고 유지');
T = sc2(L=>{L.contracts.find(c=>c.id===2).pr=777}, S=>{S.contracts=S.contracts.filter(c=>c.id!==2)}, {contracts:{'2':'2026-10-01T00:00:00Z'}});
ok(ids(T.data)==='1,2,3' && T.data.contracts.find(c=>c.id===2).pr===777, '삭제 기록이 있어도 내가 고쳤으면 내 값 살림');
ok(!(T.data.tombstones.contracts && T.data.tombstones.contracts['2']), '살아난 항목의 삭제 기록은 정리');
T = sc2(L=>{L.contracts=L.contracts.filter(c=>c.id!==3); delete L.memos['2'];}, null, null);
ok(ids(T.data)==='1,2' && T.data.tombstones.contracts['3'] && T.data.tombstones.memos['2'], '이 기기에서 지우면 삭제 기록 생성(계약·메모 모두)');
const oldT = new Date(Date.now()-70*86400e3).toISOString();
T = sc2(null, null, {contracts:{'99':oldT,'3':new Date().toISOString()}});
ok(!T.data.tombstones.contracts || !T.data.tombstones.contracts['99'], '60일 지난 삭제 기록은 정리');
T = sc2(null, null, {contracts:{'__proto__':'x','constructor':'x','5':'2026-10-01T00:00:00Z'}, groups:'str', memos:{'1':5}});
ok(Object.keys(T.data.tombstones.contracts||{}).join()==='5' && !T.data.tombstones.groups && !T.data.tombstones.memos, '삭제 기록의 이상한 키·값은 무시');
const mt = A.mergeTombs({contracts:{'1':'2026-01-01T00:00:00Z'}}, {contracts:{'1':'2026-02-01T00:00:00Z','2':'2026-01-05T00:00:00Z'}});
ok(mt.contracts['1']==='2026-02-01T00:00:00Z' && mt.contracts['2'], '삭제 기록 합칠 땐 더 늦은 시각 + 양쪽 합집합');
T = A.mergeAll(null, D({contracts:[C(1),C(2)]}), Object.assign(D({contracts:[C(1)]}), {tombstones:{contracts:{'2':'2026-10-01T00:00:00Z'}}}));
ok(ids(T.data)==='1,2', '기준(base)이 없는 기기는 삭제 기록이 있어도 지우지 않음 (처음 연결 보호)');

console.log('9) 설정(settings: 담보 그룹)');
const gl=(n)=>({covGroups:{list:[{label:'G'+n,color:'#111',bg:'#eee',border:'#ddd',keys:['k'+n]},{label:'기타',color:'#222',bg:'#eee',border:'#ddd',keys:[]}]}});
let rs=A.mergeAll(A.makeBase(D({settings:gl(1)})), D({settings:gl(2)}), D({settings:gl(1)}));
ok(rs.data.settings.covGroups.list[0].label==='G2','이 기기에서 바꾼 그룹 설정은 서버로 올라감');
rs=A.mergeAll(A.makeBase(D({settings:gl(1)})), D({settings:gl(1)}), D({settings:gl(3)}));
ok(rs.data.settings.covGroups.list[0].label==='G3','다른 기기에서 바꾼 그룹 설정은 이 기기로 내려옴');
rs=A.mergeAll(null, D({settings:gl(4)}), D({}));
ok(rs.data.settings.covGroups.list[0].label==='G4','서버에 설정이 없으면 이 기기 설정을 유지(옛 설정 이어받기)');
rs=A.mergeAll(null, D({}), D({settings:{covGroups:'문자열',__proto__x:{a:1}}}));
ok(!rs.data.settings.covGroups,'모양이 이상한 서버 설정(문자열)은 건너뜀');
ok(A.sameData(D({settings:gl(1)}),D({settings:gl(1)})) && !A.sameData(D({settings:gl(1)}),D({settings:gl(2)})),'설정도 같음/다름 비교에 포함');

console.log('10) 가입자 고유 번호(pid) 이전');
{ const mk=(id,p,x={})=>Object.assign({id,s:'계약완료',p,c:'계약자',co:'화재',n:'종합',pr:1},x);
  const d={contracts:[mk(1,'홍길동'),mk(2,'홍길동'),mk(3,'이순신')],coverages:{'홍길동':{policies:[{id:1}]},'이순신':{policies:[{id:3}]}},shares:{'홍길동':'t'.repeat(40)}};
  const changed=A.migratePeopleData(d);
  ok(changed===true,'예전 데이터는 이전됨');
  ok(d.contracts.every(r=>A.isPid(r.pid)),'모든 계약에 번호가 붙음');
  ok(d.contracts[0].pid===d.contracts[1].pid && d.contracts[0].pid!==d.contracts[2].pid,'같은 이름=같은 번호, 다른 이름=다른 번호');
  ok(d.contracts[0].pid===A.legacyPid('홍길동') && A.cpid({p:'홍길동'})===A.legacyPid('홍길동'),'번호는 이름에서 정해져서 기기마다 똑같이 나옴');
  ok(Object.keys(d.coverages).every(A.isPid) && d.coverages[A.legacyPid('홍길동')].policies[0].id===1,'보장분석이 번호 열쇠로 옮겨지고 내용은 그대로');
  ok(Object.keys(d.shares).join()===A.legacyPid('홍길동') && d.shares[A.legacyPid('홍길동')]==='t'.repeat(40),'고객 링크 토큰도 번호 열쇠로 (같은 토큰)');
  ok(A.migratePeopleData(d)===false,'이미 이전된 데이터는 다시 해도 변화 없음(여러 번 안전)');
  ok(JSON.stringify(Object.keys(d.coverages).sort())===JSON.stringify([A.legacyPid('이순신'),A.legacyPid('홍길동')].sort()),'두 번째 실행에서도 열쇠가 그대로');
}
{ const orig=[{id:1,p:'가',s:'계약완료'}]; const d={contracts:orig,coverages:{},shares:{}};
  A.migratePeopleData(d); ok(orig[0].pid===undefined && d.contracts[0].pid && d.contracts!==orig,'원래 계약 객체는 건드리지 않고 새로 만듦(다른 쪽 데이터와 객체를 같이 쓰는 경우 대비)'); }
{ const p1=A.legacyPid('홍'); const d={contracts:[{id:1,p:'홍',pid:'pid_new1'}],coverages:{'홍':{policies:[{id:1,a:1},{id:2}],matrixNames:{x:'옛'},itemOrder:['a']},'pid_new1':{policies:[{id:1,a:9}],matrixNames:{y:'새'},itemOrder:['b']}},shares:{}};
  A.migratePeopleData(d);
  ok(d.contracts[0].pid==='pid_new1','이미 번호가 있는 계약의 번호는 그대로');
  ok(d.coverages[p1]&&d.coverages['pid_new1'],'이름 열쇠는 그 이름의 예전 번호로 이전(번호가 따로 있는 사람과는 별개)'); }
{ const t=A.legacyPid('이름'); const d={contracts:[],coverages:{[t]:{policies:[{id:1,v:'기존'}]},'이름':{policies:[{id:1,v:'덮어쓰면안됨'},{id:2,v:'추가'}],matrixNames:{a:'1'}}},shares:{[t]:'기존토큰'+'x'.repeat(40),'이름':'다른토큰'+'y'.repeat(40)}};
  A.migratePeopleData(d);
  ok(d.coverages[t].policies.length===2 && d.coverages[t].policies.find(p=>p.id===1).v==='기존','같은 번호 기록이 이미 있으면 합침(같은 항목은 기존 우선, 없던 건 추가)');
  ok(d.coverages[t].matrixNames.a==='1','합칠 때 매트릭스 이름도 보존');
  ok(d.shares[t].startsWith('기존토큰'),'이미 있는 링크 토큰은 덮어쓰지 않음'); }
{ const x=A.mergeCoverageRecords({policies:[{id:1,k:'a'}],externalPolicies:[{id:-1}],matrixView:{n:{p:1}}},{policies:[{id:1,k:'b'},{id:2}],otherPolicies:[{id:5}],matrixView:{n:{p:2},m:{p:3}}});
  ok(x.policies.length===2&&x.policies[0].k==='a'&&x.externalPolicies.length===1&&x.otherPolicies.length===1&&x.matrixView.m.p===3,'보장분석 기록 합치기: 계약별 분석·외부 보험 합집합, 같은 것은 앞쪽 우선'); }
{ // 두 기기가 따로 이전해도 같은 결과 → 합쳐도 충돌 없음
  const legacy=()=>({contracts:[{id:1,p:'홍길동',s:'계약완료'},{id:2,p:'이순신',s:'계약완료'}],monthly:[],groups:{},coverages:{'홍길동':{policies:[{id:1}]}},memos:{},shares:{},settings:{}});
  const a=legacy(), b=legacy(); A.migratePeopleData(a); A.migratePeopleData(b);
  ok(JSON.stringify(A.normalizeData(a))===JSON.stringify(A.normalizeData(b)),'기기마다 따로 이전해도 결과가 완전히 같음');
  const mg=A.mergeAll(A.makeBase(legacy()), a, b); ok(mg.conflicts===0 && mg.data.contracts.length===2 && Object.keys(mg.data.coverages).length===1,'따로 이전한 두 기기를 합쳐도 충돌·중복 없음');
  // 이전 안 된 서버(옛 앱이 올린 데이터)와 합쳐도 결과가 번호 기준
  const mg2=A.mergeAll(null, a, legacy()); ok(mg2.data.contracts.every(r=>A.isPid(r.pid)) && Object.keys(mg2.data.coverages).every(A.isPid) && mg2.data.contracts.length===2,'옛 형식 서버 데이터와 합쳐도 결과는 번호 기준, 중복 없음'); }

console.log('11) 외부·기존 보험의 분석 결과가 엉뚱한 곳(policies)에 쌓여 있던 예전 데이터');
{ const mkRec=()=>({policies:[{id:1,items:[{name:'일반계약담보',amount:10}]},{id:-5,payPeriod:'10년납',items:[{name:'분석으로들어온담보',amount:300},{name:'겹치는담보',amount:50}]},{id:'ext_9',items:[{name:'기존보험분석담보',amount:7}]}],
    externalPolicies:[{id:-5,co:'외부화재',n:'외부종합',items:[{name:'모달에서입력',amount:111},{name:'겹치는담보',amount:50}]}],
    otherPolicies:[{id:'ext_9',co:'옛보험사',name:'옛상품',items:[]}]});
  const orig=mkRec(); const d={contracts:[],coverages:{pid_x:orig},shares:{}};
  const ch=A.migratePeopleData(d); const r=d.coverages.pid_x;
  ok(ch===true,'엉뚱한 곳에 쌓인 분석 결과가 있으면 이전이 일어남');
  ok(JSON.stringify(orig)===JSON.stringify(mkRec()),'원래 기록 객체는 건드리지 않고 새 기록을 만듦');
  ok(r.policies.length===1&&r.policies[0].id===1&&r.policies[0].items[0].name==='일반계약담보','일반 계약의 분석 기록만 policies 에 남음');
  ok(r.externalPolicies[0].items.map(i=>i.name).join()==='모달에서입력,겹치는담보,분석으로들어온담보','외부 보험: 기존 담보 + 분석으로 들어온 담보(겹치는 건 한 번만)');
  ok(r.externalPolicies[0].payPeriod==='10년납','비어 있던 납입기간도 채워짐');
  ok(r.otherPolicies[0].items.map(i=>i.name).join()==='기존보험분석담보','기존 보험(글자 id)도 합쳐짐');
  ok(A.migratePeopleData(d)===false,'다시 해도 변화 없음(여러 번 안전)'); }
{ const d={contracts:[],coverages:{pid_y:{policies:[{id:1,items:[{name:'가'}]}],externalPolicies:[{id:-7,items:[{name:'나'}]}]}},shares:{}};
  ok(A.migratePeopleData(d)===false&&d.coverages.pid_y.policies.length===1,'id 가 겹치지 않으면(일반 계약과 외부 보험이 따로면) 아무것도 건드리지 않음'); }
{ const srv={contracts:[],monthly:[],groups:{},memos:{},shares:{},settings:{},coverages:{pid_z:{policies:[{id:-5,items:[{name:'분석담보',amount:1}]}],externalPolicies:[{id:-5,co:'외부',n:'상품',items:[]}]}}};
  const loc={contracts:[],monthly:[],groups:{},memos:{},shares:{},settings:{},coverages:{}};
  const mg=A.mergeAll(null,loc,srv); ok(mg.data.coverages.pid_z.policies.length===0&&mg.data.coverages.pid_z.externalPolicies[0].items[0].name==='분석담보','서버에서 온 옛 형식 데이터도 합친 결과에서 바로 정리됨'); }

console.log(`\n병합 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail?1:0);
