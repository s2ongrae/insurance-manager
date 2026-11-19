// 👤 고객 정보 가져오기 (사용자 요청 2026-11-19): 카톡에서 뽑은 생년월일·핸드폰·주소·직업을 파일로 한 번에 채움 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const ph = (a, b) => ['010', a, b].join('-');            // 가짜 번호는 실행 때 조립 (소스에 번호 꼴을 두지 않음)
const C = (id, pid, name) => ({ id, pid, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 50000, g: '' });

const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([C(1, 'pid_a', '김가입'), C(2, 'pid_b', '이둘째')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

console.log('A) 있는 사람만 채우고, 없는 이름은 건너뜀');
D.run(`setProfile('김가입', {memo:'기존메모', email:'a@example.com', phone:'${ph('0000', '0001')}'})`);
const list = [
  { name: '김가입', birth: '1990.01.02', phone: '01011112222', addr: '대전 서구 둔산로 1', job: '교사' },
  { name: '이둘째', birth: '1985-3-4', phone: '', addr: '', job: '' },
  { name: '모르는사람', birth: '1970.01.01', phone: '01033334444' },
  { birth: '1970.01.01' }, null,
];
D.ctx.__l = list;
const r = D.get('importCustomerProfiles(__l)');
ok(r.matched === 2 && r.changed === 2 && r.unmatched.length === 1 && r.unmatched[0] === '모르는사람' && r.bad === 2, `결과: 일치 ${r.matched}·바뀜 ${r.changed}·없음 ${r.unmatched.length}·불량 ${r.bad}`);
const p1 = D.get(`getProfile('김가입')`);
ok(p1.birth === '1990.01.02' && p1.phone === ph('1111', '2222') && p1.addr === '대전 서구 둔산로 1' && p1.job === '교사', '생년월일·핸드폰(하이픈 정리)·주소·직업이 최신 값으로');
ok(p1.memo === '기존메모' && p1.email === 'a@example.com', '파일에 없는 칸(메모·이메일)은 그대로');
ok(D.get(`getProfile('이둘째').birth`) === '1985.03.04' && D.get(`getProfile('이둘째').phone === undefined`), '날짜 정리(1985.03.04), 빈 칸은 안 건드림');
ok(D.get(`getProfile('모르는사람').birth === undefined`), '앱에 없는 사람은 만들지 않음');

console.log('B) 다시 가져와도 그대로 · 값이 바뀌면 최신으로');
D.ctx.__l = list; const r2 = D.get('importCustomerProfiles(__l)');
ok(r2.changed === 0, '같은 파일을 또 가져오면 바뀐 사람 0명');
D.ctx.__l = [{ name: '김가입', phone: '01099998888', addr: '세종시 어딘가 2' }];
const r3 = D.get('importCustomerProfiles(__l)');
const p2 = D.get(`getProfile('김가입')`);
ok(r3.changed === 1 && p2.phone === ph('9999', '8888') && p2.addr === '세종시 어딘가 2' && p2.birth === '1990.01.02' && p2.job === '교사', '바뀐 칸만 최신으로, 나머지는 유지');

console.log('C) 잘못된 값은 무시');
D.ctx.__l = [{ name: '김가입', birth: '99999', phone: '123' }];
const r4 = D.get('importCustomerProfiles(__l)'); const p3 = D.get(`getProfile('김가입')`);
ok(r4.changed === 0 && p3.birth === '1990.01.02' && p3.phone === ph('9999', '8888'), '잘못된 생년월일·번호는 기존 값을 안 덮어씀');
ok(D.get(`JSON.parse(localStorage.getItem('ins_memos'))['cust:김가입']`).includes('세종시'), '이 기기 저장소(동기화 대상)에 기록됨');

console.log(`\n고객 정보 가져오기 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
