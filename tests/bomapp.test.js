// 보맵 플래너 가져오기 · 읽기 쉬운 금액 · 짧아진 보장분석 화면 테스트 (가짜 고객 데이터만 사용)
const {makeDevice, html} = require('./lib/ins_smoke_harness.js');
const fs = require('fs'), path = require('path');
let pass=0, fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++;console.log('  ❌',m);} };

const rider=(id,name,amt,x={})=>Object.assign({contractId:id,name,joinAmount:amt,maturityDate:'2045-10-29',insuredName:'홍길동',contractStatus:'정상',isMyContract:true,guaranteeName:null},x);
const pol=(id,x={})=>Object.assign({insuranceId:id,insurerName:'가나화재해상보험',productName:'튼튼건강보험'+id,insuranceStatus:'정상',insuranceType:'질병(건강)보험',
  subscriberName:'홍길동',primaryInsuredName:'홍길동',issueDate:'2025-10-29',maturityDate:'2045-10-29',isRenewal:true,monthlyPaymentAmount:47990,
  paymentCycle:'매월',totalPaymentCount:240,paidPaymentCount:13,paidPaymentAmount:623870,remainPaymentAmount:10893730,paymentEndDate:'2045-10-29',isPaymentCompleted:false,
  termsUrl:'https://s3.ap-northeast-2.amazonaws.com/x/약관.pdf',riders:[]},x);
const exportFile=(customers)=>({source:'bomapp-planner',version:1,exportedAt:'2026-11-11T07:00:00.000Z',customers});
const cust1=()=>({plannerMemberId:11,memberId:901,name:'홍길동',birthDate:'1990.01.02',gender:'M',
  policies:[
    pol(1,{riders:[rider(10,'암진단비(유사암제외)',50000000,{guaranteeName:'일반암 진단비'}), rider(11,'뇌혈관질환진단비',20000000,{guaranteeName:'뇌혈관질환 진단비'}),
                   rider(11,'뇌혈관질환진단비',20000000,{guaranteeName:'뇌졸중 진단비'}), rider(12,'특정부위부보장',0), rider(13,'옛 특약',1000000,{contractStatus:'만기'}),
                   rider(14,'주택화재',100000000,{isMyContract:false,insuredName:'주택1'})]}),
    pol(2,{productName:'실손<b>X</b>',termsUrl:'javascript:alert(1)',riders:[rider(20,'질병입원의료비',50000000)]}),
    pol(3,{productName:'담보없는보험',riders:[]}),
    pol(4,{productName:'끝난보험',insuranceStatus:'소멸',riders:[rider(40,'사망',10000000)]})],
  guarantees:{ageGroup:30,groups:[{g:'암',items:[{name:'일반암 진단비',status:'NOTENOUGH',rec:80000000,total:50000000,desc:'',by:[{id:1,amt:50000000}]}]},
                                   {g:'뇌질환',items:[{name:'뇌졸중 진단비',status:'ENOUGH',rec:10000000,total:20000000,desc:'',by:[{id:1,amt:20000000}]}]}]},
  report:{pdfB64:'JVBERi0xLjcK'.repeat(20)}});

(async()=>{
console.log('A) 읽기 쉬운 금액');
{ const D=makeDevice({session:{ins_unlocked:'1'}});
  ok(D.errors.length===0,'로드 오류 없음 '+D.errors.join('|'));
  const k=e=>D.get(e);
  ok(k('korWon(80000000)')==='8천만원','8천만원'); ok(k('korWon(20000)')==='2만원','2만원');
  ok(k('korWon(47990)')==='4만 7,990원','4만 7,990원'); ok(k('korWon(120000000)')==='1억 2천만원','1억 2천만원');
  ok(k('korWon(15000000)')==='1천5백만원','1천5백만원'); ok(k('korWon(10100000)')==='1,010만원','1,010만원');
  ok(k('korWon(3000000)')==='3백만원','3백만원'); ok(k('korWon(0)')==='0원','0원'); ok(k('korWon(-30000000)')==='-3천만원','음수');
  ok(k('manWon(8000)')==='8천만원'&&k('manWon(2)')==='2만원'&&k('manWon(0.5)')==='5,000원','만원 단위 값 변환');
  ok(k('korWon(250000000000)')==='2,500억원','억 단위 큰 값'); }

console.log('B) 보맵 가져오기 — 새 고객');
const D=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:'[]',ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
ok(D.errors.length===0,'로드 오류 없음 '+D.errors.join('|'));
D.ctx.__f=exportFile([cust1()]);
const r1=D.get('importBomappData(__f)');
ok(r1.people===1&&r1.newPeople===1&&r1.added===3&&r1.updated===0,'고객 1명(새 사람) · 정상 보험 3건 추가');
ok(r1.ended===1,'소멸 보험은 종료 목록으로');
ok(r1.reports.length===1&&r1.reports[0].name==='홍길동','리포트 PDF 는 Drive 업로드 목록으로');
const pid=D.get('Object.keys(COVERAGES)[0]');
ok(/^pid_/.test(pid),'새 가입자 번호(pid)');
ok(D.get(`peopleList().some(p=>p.pid===${JSON.stringify(pid)} && p.name==='홍길동')`),'계약 없이도 사람 목록에 나옴(보장분석 왼쪽 목록)');
const rec=D.get(`COVERAGES[${JSON.stringify(pid)}]`);
ok(rec.person&&rec.person.name==='홍길동'&&rec.person.birth==='1990.01.02','사람 정보(이름·생년월일) 저장');
ok(!JSON.stringify(rec).includes('JVBERi0'),'리포트 PDF 내용은 동기화 데이터에 안 넣음');
const p1=rec.externalPolicies.find(x=>x.bm.id===1);
ok(p1.items.length===3,'특약은 계약 번호로 중복 제거 (같은 특약이 여러 보장에 걸려도 1번)');
ok(p1.items.find(i=>i.name==='뇌혈관질환진단비').bmStd.join(',')==='뇌혈관질환 진단비,뇌졸중 진단비','특약이 반영되는 보맵 보장 분류 기록');
ok(p1.items.find(i=>i.name.startsWith('암진단비')).amount===5000,'금액은 만원 단위 (5천만원 → 5000)');
ok(p1.bm.extra.length===2&&p1.bm.extra.some(i=>i.st==='만기')&&p1.bm.extra.some(i=>i.who==='주택1'),'만기 특약·다른 피보험자 특약은 합계 밖(extra)');
ok(p1.pr===47990&&p1.payPeriod==='20년납'&&p1.covPeriod==='2045.10.29 만기'&&p1.renewable==='갱신형','월 보험료·납입기간·보험기간·갱신');
ok(p1.bm.paid===13&&p1.bm.total===240&&p1.bm.paidAmt===623870&&p1.bm.remainAmt===10893730,'납입 횟수·낸 보험료·남은 보험료');
ok(p1.bm.terms.startsWith('https://'),'약관 주소 저장');
ok(rec.externalPolicies.find(x=>x.bm.id===2).bm.terms==='','javascript: 약관 주소는 버림');
ok(rec.bomapp.memberId===901&&rec.bomapp.ended.length===1&&rec.bomapp.ended[0].status==='소멸','보맵 고객 번호·종료 보험 기록');
ok(rec.bomapp.std.groups.length===2&&rec.bomapp.std.groups[0].items[0].by[0].id===p1.id,'보장 점검의 보험 번호가 관리툴 보험 번호로 연결');

console.log('C) 관리 화면');
D.run(`window._mtxMode='sum'; selectedCovCustomer=${JSON.stringify(pid)}; renderCoverageTab('보장분석')`);
let cd=D.el('cov-detail').innerHTML;
ok(/홍길동 님의 보장 분석/.test(cd),'제목에 이름');
ok(/보맵 연동/.test(cd)&&/보맵에서 열기/.test(cd),'보맵 연동 머리줄');
ok(/📜 약관 보기/.test(cd)&&/납입 13\/240회/.test(cd)&&/남은 보험료 1,089만 3,730원/.test(cd),'보험 카드에 약관·납입 현황');
ok(!/javascript:alert/.test(cd),'위험한 약관 주소는 링크로 안 만듦');
ok(/실손&lt;b&gt;X/.test(cd)&&!/실손<b>X/.test(cd),'보험명은 글자 그대로(태그 실행 안 됨)');
ok(/📭 담보가 아직 없는 보험 1건/.test(cd),'담보 없는 보험은 접힌 칸으로');
ok(/class="mtx-sum"/.test(cd)&&/5천만원/.test(cd),'매트릭스 합계 보기 + 읽기 쉬운 금액');
ok(/담보 없는 보험 1건은 표에서 뺐어요/.test(cd),'담보 없는 보험 열은 표에서 빠짐');
ok(!/class="mtx-sum-n">특정부위부보장/.test(cd),'0원 특약 행은 기본으로 숨김');
ok(/📈 보장 점검 \(30대 또래 평균 대비\) · 충분 1 · 부족 1/.test(cd),'보맵 보장 점검 표');
ok(/🗂️ 종료된 보험 \(보맵\) 1건/.test(cd),'종료된 보험 목록');
ok(/만기됐거나 다른 피보험자의 특약 2개/.test(cd),'합계 밖 특약 표시');

console.log('D) 고객 화면');
D.run(`showCustomerView(${JSON.stringify(pid)}, '')`);
let cv=D.bodyHtml;
ok(/홍길동 님/.test(cv),'계약 없는 고객도 이름 표시 (person.name)');
ok(/📜 약관 보기/.test(cv)&&/낸 보험료 62만 3,870원/.test(cv),'고객 화면에 약관·납입');
ok(!/보맵에서 열기/.test(cv)&&!/플래너 사번/.test(cv),'고객 화면에 설계사용 링크·비밀번호 안내 없음');
ok(/📈 보장 점검/.test(cv),'고객 화면 보장 점검');
ok(/담보 내용을 정리 중인 보험 1건/.test(cv),'담보 없는 보험은 한 줄로');
ok(!/class="cv-row-name">특정부위부보장/.test(cv),'0원 담보는 고객 합계 카드에 안 나옴');
ok(!/분석 리포트/.test(cv),'리포트 주소가 없으면 리포트 칸 없음');

console.log('E) 다시 가져오기 — 갱신 · 직접 넣은 값 유지 · 소멸 반영');
D.run(`{ const p=COVERAGES[${JSON.stringify(pid)}].externalPolicies.find(x=>x.bm.id===1); p.pn='증권-123'; p.proposalUrl='https://drive.google.com/file/d/abc'; COVERAGES[${JSON.stringify(pid)}].bomapp.reportUrl='https://drive.google.com/file/d/rep'; }`);
const c2=cust1(); c2.policies[0].paidPaymentCount=14; c2.policies[1].insuranceStatus='소멸'; delete c2.report;
D.ctx.__f=exportFile([c2]);
const r2=D.get('importBomappData(__f)');
ok(r2.newPeople===0&&r2.added===0&&r2.updated===2&&r2.removed===1,'같은 보맵 고객으로 갱신 (새 사람 안 만듦), 소멸된 보험은 빠짐');
const rec2=D.get(`COVERAGES[${JSON.stringify(pid)}]`);
const q1=rec2.externalPolicies.find(x=>x.bm.id===1);
ok(q1.id===p1.id&&q1.pn==='증권-123'&&q1.proposalUrl==='https://drive.google.com/file/d/abc'&&q1.bm.paid===14,'보험 번호·증권번호·제안서 유지, 납입 횟수 갱신');
ok(rec2.bomapp.reportUrl==='https://drive.google.com/file/d/rep','리포트 주소 유지');
ok(rec2.bomapp.ended.length===2,'종료 목록 갱신');
D.run(`document.body.innerHTML=''`); D.bodyHtml='';
D.run(`showCustomerView(${JSON.stringify(pid)}, '')`);
ok(/보험 분석 리포트/.test(D.bodyHtml)&&/drive\.google\.com\/file\/d\/rep/.test(D.bodyHtml),'고객 화면에 분석 리포트 PDF 링크');

console.log('F) 기존 고객과 연결 · 동명이인');
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:JSON.stringify([{id:1,s:'계약완료',d:'25.01.01',c:'홍길동',p:'홍길동',pid:'pid_aaaa',co:'우리',n:'내계약',pr:10000,g:''}]),ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
  E.ctx.__f=exportFile([cust1()]);
  const r=E.get('importBomappData(__f)');
  ok(r.newPeople===0&&E.get(`COVERAGES.pid_aaaa.externalPolicies.length===3`),'같은 이름 한 명 → 그 사람 보장분석에 넣음');
  ok(E.get('covPolicyCount("pid_aaaa")')===4,'왼쪽 목록 건수 = 내 계약 + 보맵 보험'); }
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:JSON.stringify([{id:1,s:'계약완료',d:'25.01.01',c:'갑',p:'홍길동',pid:'pid_a1',co:'우리',n:'A',pr:1,g:''},{id:2,s:'계약완료',d:'25.01.01',c:'을',p:'홍길동',pid:'pid_a2',co:'우리',n:'B',pr:1,g:''}]),ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
  E.ctx.__f=exportFile([cust1()]);
  const r=E.get('importBomappData(__f)');
  ok(r.newPeople===1&&r.ambiguous.join()==='홍길동','동명이인이 여럿이면 새 사람으로 만들고 알려줌');
  ok(!E.get('!!(COVERAGES.pid_a1&&COVERAGES.pid_a1.externalPolicies)'),'아무 동명이인에게나 넣지 않음'); }
{ const E=makeDevice({session:{ins_unlocked:'1'}});
  E.ctx.__f={source:'other',customers:[]};
  let threw=false; try{ E.run('importBomappData(__f)'); }catch(e){ threw=/보맵 내보내기 파일이 아니에요/.test(e.message); }
  ok(threw,'다른 파일은 거부'); }

console.log('G) 파일 열기 흐름 (확인 → 저장 → 리포트 업로드 실패 알림)');
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:'[]',ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
  const txt=JSON.stringify(exportFile([cust1()]));
  E.ctx.__ev={target:{files:[{name:'보맵.json',text:async()=>txt}],value:'x'}};
  await E.run('importBomappFile(__ev)');
  ok(E.confirms.length===1&&/고객 1명 · 보험 4건/.test(E.confirms[0]),'가져오기 전에 확인');
  const saved=JSON.parse(E.store.get('ins_coverages')||'{}');
  ok(Object.values(saved).some(r=>r.bomapp&&r.externalPolicies.length===3),'로컬 저장(동기화 대상)에 반영');
  ok(/분석 리포트 0개 Drive 저장 · 1개 실패/.test(E.el('bm-import-status').textContent),'서버 연결이 없으면 리포트 저장 실패를 알림');
  ok(E.store.get('ins_cp_index')&&JSON.parse(E.store.get('ins_cp_index')).length===1,'가져오기 전 체크포인트');
  E.ctx.__ev2={target:{files:[{name:'x.json',text:async()=>txt}],value:'x'}}; E.confirmQ.push(false);
  await E.run('importBomappFile(__ev2)');
  ok(JSON.parse(E.store.get('ins_cp_index')).length===1,'취소하면 아무것도 안 바꿈'); }

console.log('H) 부분 응답 보존 · 종료 담보 · 동일 계약 연결');
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:'[]',ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
  E.ctx.__f=exportFile([cust1()]);E.run('importBomappData(__f)');
  const key=E.get('Object.keys(COVERAGES)[0]');const before=E.get(`COVERAGES[${JSON.stringify(key)}].externalPolicies[0].items`);
  const bad=cust1();bad.policies[0].riders=[];bad.policies[0].ridersError='network';E.ctx.__f=exportFile([bad]);
  const r=E.get('importBomappData(__f)');ok(r.warnings.length===1,'특약 조회 실패 표시');
  ok(JSON.stringify(before)===JSON.stringify(E.get(`COVERAGES[${JSON.stringify(key)}].externalPolicies[0].items`)),'부분 조회 실패 때 기존 담보 보존');
  ok(E.get(`COVERAGES[${JSON.stringify(key)}].bomapp.ended[0].items.length`)===1,'종료된 보험도 원본 특약 보관');
  bad.policies=null;E.ctx.__f=exportFile([bad]);let thrown=false;try{E.run('importBomappData(__f)')}catch(e){thrown=true}ok(thrown,'불완전 보험 목록은 저장 전 거절'); }
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:JSON.stringify([{id:777,s:'계약완료',d:'25.10.29',c:'홍길동',p:'홍길동',pid:'pid_link',co:'가나화재',n:'기존 약칭',pr:47990,g:''}]),ins_coverages:'{}',ins_monthly:'[]',ins_groups:'{}'}});
  const c=cust1();c.policies=c.policies.slice(0,1);E.ctx.__f=exportFile([c]);const r=E.get('importBomappData(__f)');
  ok(r.linked===1&&r.added===0,'동일 고객·보험사·가입일·보험료의 유일한 내 계약에 연결');
  ok(E.get('COVERAGES.pid_link.policies[0].id')===777,'원래 계약 ID 유지');
  ok(E.get('CONTRACTS[0].n')==='기존 약칭'&&E.get('CONTRACTS[0].pr')===47990,'기존 계약 정보 변경 없음');
  E.run("renderCovDetail('pid_link')");const v=E.el('cov-detail').innerHTML;
  ok(/📜 약관 보기/.test(v)&&/납입 13\/240회/.test(v),'연결된 내 계약에도 약관·납입 표시');
  ok(v.indexOf('📊 보장 합산 매트릭스')<v.indexOf('📋 보험별 담보 내역')&&v.indexOf('📑 보험 개요')<v.indexOf('📋 보험별 담보 내역'),'매트릭스·보험 개요가 보험 세부 항목 위');
  ok(/<b>기존<\/b>/.test(v)&&/<b>해지<\/b>/.test(v)&&/<b>일부 배서<\/b>/.test(v)&&/<b>신규<\/b>/.test(v),'기존/해지/일부 배서/신규 버튼'); }
{ const E=makeDevice({session:{ins_unlocked:'1'},ls:{ins_contracts:JSON.stringify([{id:1,s:'계약완료',d:'24.01.01',c:'홍길동',p:'홍길동',pid:'pid_dup',co:'우리',n:'다른계약',pr:1,g:''}]),
    ins_coverages:JSON.stringify({pid_dup:{policies:[],otherPolicies:[{id:'ext_x1',co:'가나화재',name:'(무) 튼튼건강보험1',price:1,items:[{name:'손입력',amount:1}],pn:'번호-9'}]}}),ins_monthly:'[]',ins_groups:'{}'}});
  const c=cust1();c.policies=c.policies.slice(0,1);E.ctx.__f=exportFile([c]);const r=E.get('importBomappData(__f)');
  ok(r.added===0&&r.linked===1,'직접 입력한 같은 보험(보험사+상품명)은 새로 만들지 않고 갱신');
  ok(E.get('COVERAGES.pid_dup.otherPolicies.length')===1&&E.get('(COVERAGES.pid_dup.externalPolicies||[]).length')===0,'중복 보험 없음');
  ok(E.get('COVERAGES.pid_dup.otherPolicies[0].id')==='ext_x1'&&E.get('COVERAGES.pid_dup.otherPolicies[0].pn')==='번호-9'&&E.get('COVERAGES.pid_dup.otherPolicies[0].items.length')===3,'기존 id·증권번호 유지, 특약은 보맵 기준'); }
console.log('I) 화면 요소 · 내보내기 스크립트');
ok(/onclick="openModal\('bomapp'\)"/.test(html)&&/id="modal-bomapp"/.test(html),'📥 보맵 버튼과 가져오기 창');
ok(/href="javascript:\(function\(\)\{var s=document\.createElement\('script'\);s\.src='https:\/\/s2ongrae\.github\.io\/insurance-manager\/bomapp-export\.js/.test(html),'북마크 버튼이 저장소의 bomapp-export.js 를 불러옴');
{ const js=fs.readFileSync(path.join(__dirname,'..','bomapp-export.js'),'utf8');
  ok(/insurance-analysis-report\//.test(js)&&/\/contracts'/.test(js)&&/\/terms'/.test(js)&&/insurance-guarantees/.test(js),'내보내기: 특약·약관·보장분석·리포트');
  ok(!/mobile/.test(js.replace(/휴대폰 번호는 파일에 넣지 않아요/,'')),'내보내기 파일에 휴대폰 번호를 넣지 않음');
  ok(/bomapp\\\.co\\\.kr\$/.test(js),'보맵 화면에서만 동작');
  try{ new (require('vm').Script)(js); ok(true,'내보내기 스크립트 문법'); }catch(e){ ok(false,'내보내기 스크립트 문법 '+e.message); } }

console.log(`\n보맵·화면 개선 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail?1:0);
})().catch(e=>{ console.log('  ❌ 테스트 중단', e); process.exit(1); });
