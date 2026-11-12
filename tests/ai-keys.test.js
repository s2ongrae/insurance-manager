// AI 연결 키(FreeLLMAPI·Gemini): "이 기기에 기억하기"로 앱을 다시 열어도 유지 · 끄면 탭에만 · 지우기 · PIN 재설정 시 삭제 (가짜 키만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const base = { ins_contracts: '[]', ins_monthly: '[]', ins_groups: '{}', ins_coverages: '{}' };
const MODELS = { data: [{ id: 'auto' }, { id: 'test-model' }] };
const fetchOk = async (u) => ({ ok: true, status: 200, json: async () => (/models/.test(String(u)) ? MODELS : { models: [{ name: 'models/gemini-2.5-flash' }] }), text: async () => '' });

(async () => {
console.log('A) 저장된 키는 앱을 새로 열어도 그대로 (예전: 탭을 닫으면 사라짐)');
let D = makeDevice({ session: { ins_unlocked: '1' }, ls: Object.assign({}, base, { freellm_key: 'freellmapi-TESTKEY1', ins_gemini_key: 'GEMINI-TESTKEY1' }) });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
ok(D.get(`FREELLM_KEY==='freellmapi-TESTKEY1'`), 'FreeLLMAPI 키를 이 기기 저장소에서 불러옴');
ok(D.get(`GEMINI_SESSION_KEY==='GEMINI-TESTKEY1'`), 'Gemini 키를 이 기기 저장소에서 불러옴');
D = makeDevice({ session: { ins_unlocked: '1', freellm_key: 'freellmapi-SESSION' }, ls: base });
ok(D.get(`FREELLM_KEY==='freellmapi-SESSION'`), '예전 방식(탭에만 저장된 키)도 그대로 읽음');

console.log('B) 설정 창: 기억하기 체크(기본 켜짐) → 저장하면 이 기기에 남음');
D = makeDevice({ session: { ins_unlocked: '1' }, ls: base, fetch: fetchOk });
D.run(`openFreeLLMSettings()`);
let dlg = D.get(`document.body.children[document.body.children.length-1].innerHTML`);
ok(/id="ai-key-remember" checked/.test(dlg), '"이 기기에 키 기억하기" 체크박스 (기본 켜짐)');
ok(!/이 탭의 세션에만 저장됩니다/.test(dlg), '"탭을 닫으면 다시 입력" 안내 문구 없음');
ok(!/\\\$\{/.test(dlg) && !/\$\{\(FREELLM_KEY/.test(dlg), '화면에 코드 조각(${...})이 글자로 새지 않음');
D.run(`document.getElementById('ai-provider').value='freellm'; document.getElementById('freellm-base').value='http://127.0.0.1:31415/v1'; document.getElementById('freellm-model').value='auto'; document.getElementById('freellm-pdf-mode').value='auto'; document.getElementById('ai-key-remember').checked=true; document.getElementById('freellm-key').value='freellmapi-NEWKEY'`);
await D.run(`saveFreeLLMSettings()`);
ok(D.get(`localStorage.getItem('freellm_key')==='freellmapi-NEWKEY'`) && D.get(`FREELLM_KEY==='freellmapi-NEWKEY'`), '저장하면 이 기기(localStorage)에 남음 → 다시 열어도 유지');
ok(D.get(`localStorage.getItem('ins_ai_key_remember')==='1'`), '기억하기 설정도 저장');

console.log('C) 기억하기를 끄면 탭에만 (같이 쓰는 PC)');
D.run(`openFreeLLMSettings(); document.getElementById('ai-provider').value='freellm'; document.getElementById('freellm-base').value='http://127.0.0.1:31415/v1'; document.getElementById('freellm-model').value='auto'; document.getElementById('freellm-pdf-mode').value='auto'; document.getElementById('ai-key-remember').checked=false; document.getElementById('freellm-key').value='freellmapi-TABONLY'`);
await D.run(`saveFreeLLMSettings()`);
ok(D.get(`localStorage.getItem('freellm_key')===null`) && D.get(`sessionStorage.getItem('freellm_key')==='freellmapi-TABONLY'`), '끄면 이 기기에는 안 남고 이 탭에만');
ok(D.get(`localStorage.getItem('ins_ai_key_remember')==='0'`), '끈 설정도 기억 (다음에 열 때 꺼진 채)');
D.run(`openFreeLLMSettings()`);
ok(!/id="ai-key-remember" checked/.test(D.get(`document.body.children[document.body.children.length-1].innerHTML`)), '다시 열면 체크 해제 상태');

console.log('D) 이 기기에서 키 지우기');
D = makeDevice({ session: { ins_unlocked: '1', freellm_key: 'x' }, ls: Object.assign({}, base, { freellm_key: 'freellmapi-DEL', ins_gemini_key: 'GEMINI-DEL' }) });
D.run(`openFreeLLMSettings()`);
ok(/forgetAiKeys\(\)/.test(D.get(`document.body.children[document.body.children.length-1].innerHTML`)), '키가 있으면 "이 기기에서 키 지우기" 버튼');
D.run(`forgetAiKeys()`);
ok(D.get(`localStorage.getItem('freellm_key')===null && localStorage.getItem('ins_gemini_key')===null && sessionStorage.getItem('freellm_key')===null`), '저장소에서 두 키 모두 삭제');
ok(D.get(`FREELLM_KEY==='' && GEMINI_SESSION_KEY===''`), '메모리에서도 삭제');

console.log('E) PIN 을 새로 정하면(PIN을 잊었어요) 서버 키처럼 AI 키도 지움');
D = makeDevice({ session: {}, ls: Object.assign({}, base, { freellm_key: 'freellmapi-PIN', ins_gemini_key: 'GEMINI-PIN', ins_server_key: 'k' }) });
D.run(`pinForgot()`);
ok(D.get(`localStorage.getItem('freellm_key')===null && localStorage.getItem('ins_gemini_key')===null && localStorage.getItem('ins_server_key')===null`), 'PIN 재설정 시 AI 키·서버 키 모두 삭제');

console.log(`\nAI 키 저장 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
