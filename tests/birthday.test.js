// 🎂 생일 · 보험나이 바뀌는 날 (🔔 알림 창, 계산만 하고 저장 안 함) — 날짜는 오늘 기준으로 만든다 (가짜 데이터만)
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const t = new Date(), y = t.getFullYear(), M = t.getMonth(), Dd = t.getDate();
const K = (id, name) => ({ id, pid: 'pid_' + id, c: name, p: name, co: '다라생명', n: '계약' + id, s: '계약완료', d: '25.01.01', pr: 1000, g: '' });

const D = makeDevice({ session: { ins_unlocked: '1' }, ls: {
  ins_contracts: JSON.stringify([K(1, '곧생일'), K(2, '곧상령일'), K(3, '먼생일'), K(4, '정보없음')]),
  ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));

D.run(`setProfile('곧생일', {birth:'${fmt(new Date(1990, M, Dd + 10))}'})`);        // 생일이 10일 뒤
D.run(`setProfile('곧상령일', {birth:'${fmt(new Date(1985, M - 6, Dd + 5))}'})`);   // 생일이 6개월 전 + 5일 → 상령일이 5일 뒤
D.run(`setProfile('먼생일', {birth:'${fmt(new Date(1980, M, Dd + 100))}'})`);        // 100일 뒤 (30일 밖)
D.run(`setProfile('지워진사람', {birth:'${fmt(new Date(1990, M, Dd + 3))}'})`);      // 앱에 없는 사람의 옛 정보
const n = D.get('birthdayNotices()');

console.log('A) 30일 안 생일 · 상령일만, 앱에 있는 사람만');
const bd = n.find(x => x.name === '곧생일' && x.kind === 'birthday');
ok(bd && bd.days === 10 && bd.label === `만 ${y - 1990}세 생일`, '곧생일: 10일 뒤 생일 (만 나이 맞음) ' + JSON.stringify(bd));
const ag = n.find(x => x.name === '곧상령일' && x.kind === 'age');
ok(ag && ag.days === 5, '곧상령일: 생일 6개월 뒤 = 5일 뒤 보험나이가 바뀜 ' + JSON.stringify(ag));
ok(ag && /보험나이 \d+→\d+세/.test(ag.label) && Number(ag.label.match(/(\d+)→(\d+)/)[2]) === Number(ag.label.match(/(\d+)→(\d+)/)[1]) + 1, '보험나이는 1 늘어남');
ok(!n.some(x => x.name === '먼생일'), '30일 밖은 안 나옴');
ok(!n.some(x => x.name === '지워진사람') && !n.some(x => x.name === '정보없음'), '앱에 없는 사람·생년월일 없는 사람은 안 나옴');
ok(n.every((x, i) => i === 0 || n[i - 1].date <= x.date), '날짜순');

console.log('B) 알림 창에 보이고, 데이터는 안 바뀜');
const before = D.get(`JSON.stringify(REMINDERS) + localStorage.getItem('ins_reminders')`);
D.run('renderReminders()');
const html = D.el('rem-list').innerHTML;
ok(/🎂 생일 · 보험나이 바뀌는 날/.test(html) && /곧생일/.test(html) && /곧상령일/.test(html) && /보험나이가 바뀌어요/.test(html) && !/먼생일/.test(html), '알림 창 섹션에 해당 고객만');
ok(D.get(`JSON.stringify(REMINDERS) + localStorage.getItem('ins_reminders')`) === before, '알림(REMINDERS)에 아무것도 저장하지 않음 (계산만)');

console.log('C) 아무도 없으면 안내');
const E = makeDevice({ session: { ins_unlocked: '1' }, ls: { ins_contracts: JSON.stringify([K(1, '홍길동')]), ins_coverages: '{}', ins_monthly: '[]', ins_groups: '{}', ins_reminders: '{}' } });
E.run('renderReminders()');
ok(/30일 안에 생일이나 보험나이가 바뀌는 고객이 없어요/.test(E.el('rem-list').innerHTML), '비어 있으면 생년월일을 넣으라는 안내');

console.log(`\n생일·보험나이 테스트: ${pass}건 통과, ${fail}건 실패`);
process.exit(fail ? 1 : 0);
