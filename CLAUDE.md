# 보험 고객 관리툴 (insurance-manager)

보험 설계사 업무용 웹앱. GitHub Pages 로 `index.html` 한 파일을 배포하고, 데이터는 Google Apps Script 웹 앱(`apps-script/Code.gs`)이 Google Drive 의 JSON 파일(`보험관리툴/보험관리툴_데이터.json`)에 저장한다.

> **이 저장소는 공개다(GitHub Pages).** 서버 주소·비밀 키·Gemini 키·고객 정보는 코드·문서·테스트 어디에도 넣지 않는다. 주소와 키는 각 기기의 ⚙️ 서버 설정에서 입력해 그 기기의 localStorage 에만 있다. 예전에 HTML 에 고객 데이터가 하드코딩돼 공개됐던 적이 있다.

## 작업 규칙 (반드시)

- 수정 후에는 `npm test` (정적 검사 + 테스트 7종) 가 전부 ✅ 인지 확인한다. 처음이면 `npm install`. 한 가지만: `npm run test:only -- people`.
- 테스트가 실패하면 **앱 버그인지 테스트 실수인지 먼저 가려서** 사용자에게 그대로 말한다. 통과시키려고 검사를 약하게 만들지 않는다 (`|| true`, 항상 참인 조건 금지).
- 새 기능·버그 수정에는 테스트를 같이 추가한다. 가능하면 **고치기 전 파일에 같은 테스트를 돌려 실제로 실패하는지** 확인한다 (검사가 문제를 잡는다는 증거). 사용자가 말한 증상은 고치기 전·후 파일에서 그대로 재현해서 비교한다.
- `index.html` 은 약 3,600줄짜리 한 파일(스크립트 인라인). 큰 수정은 "찾는 문장이 정확히 한 곳에 있는지 확인한 뒤 교체"로 한다. 이스케이프를 손으로 흉내 내지 말고 문장을 있는 그대로 다룬다. 함수를 통째로 지울 때는 `node tools/rmfuncs.js index.html 함수1,함수2` (파서로 정확한 범위만 지움).
- 과거에 반복된 사고: 수정하다 함수 선언이 같이 지워짐, 닫는 `}` 누락, `const`/`let` 중복, 템플릿 백틱 짝 안 맞음. `npm run check` 가 문법·중복 함수·정의 안 된 이름(ESLint no-undef)·죽은 함수를 잡는다.
- `npm run check` 에 **죽은 함수**가 나오면 지우기 전에 "끊긴 기능"인지 먼저 확인한다. 예전에 상단 요약 카드(`renderKPIs`)와 필터 패널이 호출이 끊긴 채로 남아 있었다.
- 화면(innerHTML)에 넣는 사용자·서버·AI 값은 `esc()`. 링크는 `safeDriveUrl()` 로 Drive 주소만. `onclick` 에 넣는 id 는 `jsId()` (기존 보험 id 가 `'ext_…'` 글자라서, 따옴표 없이 넣으면 클릭 시 ReferenceError).
- 데이터를 바꾸는 코드는 반드시 `scheduleSave()` 또는 `saveCoverages()` 를 불러 동기화되게 한다. "이 기기에만 저장되고 동기화·백업에 안 들어가는 데이터"가 반복 데이터 손실의 근본 원인이었다.
- `Code.gs` 를 바꾸면 배포가 필요하다는 점과 순서를 사용자에게 분명히 말한다 (아래 배포).

## 파일

- `index.html` — 앱 전체. 첫 `<script>` 는 PIN 잠금 화면, 둘째가 앱.
- `apps-script/Code.gs` — 서버 (Apps Script 편집기에 붙여 넣어 배포).
- `tests/` — node 테스트. `run-all.js` 가 실행기. `lib/` 에 가짜 서버·가짜 브라우저.
- `tools/check.js` 정적 검사, `tools/deadcode.js` 죽은 함수 찾기, `tools/rmfuncs.js` 함수 삭제.

## 화면

- 탭: 계약 리스트 / 그룹별 / 고객별(계약자 기준) / 월별 실적 / 보장분석(가입자 기준). 상단에 요약 카드 5개.
- 고객 전용 화면: `#view=이름&t=토큰&s=서버ID`. PIN 없이 열리고 그 고객의 보장만 보인다. 링크의 이름은 표시용이고 토큰이 그 사람을 정한다.
- 보장분석: 고객 목록(동명이인 구분 표시) → 상세(요약표, 보장 합산 매트릭스, 계약별 담보 구역). 상세 버튼: ✏️ 이름 변경, 🔀 합치기, ✂️ 분리, 📋 청구 서류, ⚙️ 그룹 설정, 고객 링크 복사/재발급.

## 데이터 (전역 ↔ localStorage 키 ↔ 서버 JSON 컬렉션)

- `CONTRACTS` / `ins_contracts` / `contracts`: `[{id, s 상태, d 가입일 YY.MM.DD, ed 해지일, c 계약자, p 가입자 표시 이름, pid 가입자 번호, co 보험사, n 상품명, pr 월보험료, g 그룹, proposalUrl 제안서 Drive 주소}]`
- `MONTHLY` / `ins_monthly` / `monthly`: `[{m:'YY.MM', k, before, after, tax, memo}]`
- `GROUPS` / `ins_groups` / `groups`: `{그룹명: 색}`
- `COVERAGES` / `ins_coverages` / `coverages`: `{pid: 기록}`. 기록 = `policies:[{id 계약id, items:[{name, amount, unit, price}], payPeriod, covPeriod, renewable}]`, `externalPolicies:[{id 음수, co, n, pr, items, …, proposalUrl}]`, `otherPolicies:[{id 'ext_…', co, name, price, payPeriod, items, proposalUrl}]`, `matrixView:{정규화 담보명:{보험키:값, __hidden, __group}}`(매트릭스 표시 전용 덮어쓰기 — 원본 items 를 바꾸지 않음), `matrixNames:{정규화명:표시명}`, `itemOrder:[...]`
- `MEMOS` / `ins_memos` / `memos`: `{계약id: 메모}` (고객에게는 절대 안 감)
- `SHARES` / `ins_shares` / `shares`: `{pid: 고객 링크 토큰 48자}`
- `SETTINGS` / `ins_settings` / `settings`: `{covGroups:{list:[{label, color, bg, border, keys[]}]}}` (담보 그룹 설정. 예전 `ins_cov_groups` 는 이전용으로만 읽음)
- `TOMBS` / `ins_tombs` / `tombstones`: 삭제 기록 `{컬렉션:{키: 시각}}`, 60일 보관
- 이 기기에만: `ins_server_url`, `ins_server_key`, `ins_sync_base`(마지막 동기화 기준 해시), `ins_cp_*`(체크포인트 최대 3개), `gemini_key`, `gemini_model`

## 가입자 고유 번호 (pid)

- 보장분석·고객 링크는 이름이 아니라 `pid` 로 연결한다 → 동명이인이 따로 관리되고, 이름을 바꿔도 데이터·링크가 유지된다.
- 형식 `pid_…`. 새 사람은 `newPid()`(무작위), 예전 데이터는 `legacyPid(이름)`(이름 해시 → 어느 기기에서 이전해도 같은 결과). `cpid(계약)` = 계약의 pid (없으면 legacyPid).
- `peopleList()` 사람 목록. 같은 이름이 여럿이면 `이름 (계약자 …)`, 계약자까지 같으면 `이름 #n`.
- 계약 저장 시 `planPerson()` 이 묻는다: 같은 이름이 있으면 같은 사람인지(확인=같은 사람, 취소=동명이인), 다른 계약이 있는 사람의 이름을 바꾸면 "1 모두 바꾸기 / 2 이 계약만 다른 사람으로". 취소하면 저장하지 않는다.
- `renamePerson` / `mergePerson` / `splitPerson` (이미 합쳐져 있는 동명이인은 자동으로 못 가르므로 분리 버튼으로 사용자가 직접 가른다).
- `migratePeopleData()` (SYNC_CORE 안): 앱 시작·병합 결과·복원 때 자동 실행. 계약에 pid 부여, COVERAGES/SHARES 열쇠를 이름→pid, 외부·기존 보험의 분석 결과가 `policies` 에 잘못 쌓인 예전 데이터를 그 보험 기록으로 합침. 여러 번 해도 안전하고 원본 객체를 건드리지 않는다(새 객체를 만든다).
- 고객별·그룹별 탭은 여전히 계약자 이름 기준이다 (의도적으로 안 바꿈).

## 담보 기록 찾기

- 일반 계약은 `COVERAGES[pid].policies` 의 항목, 외부·기존 보험은 **그 보험 기록 자체**가 `items` 를 가진다. 읽고 쓸 때는 반드시 `polIn(cData, polId)` / `getPol(pid, polId)` 를 쓴다. 예전에 구역 목록·PDF 분석은 `policies` 에, 매트릭스는 보험 기록에서 읽어서 서로 어긋났다.

## 동기화

- `// <SYNC_CORE>` ~ `// </SYNC_CORE>` 구간은 화면과 무관한 순수 함수다. 테스트가 이 구간을 뽑아 직접 검증하므로 **표시 주석을 지우거나 구간 밖으로 핵심 로직을 옮기지 않는다.**
- 3-way 병합(`merge3`): 이 기기만 바꿈→내 값 / 서버만 바꿈→서버 값 / 새로 만든 건 유지 / 한쪽이 지우고 다른 쪽이 고침→고친 쪽 / 둘 다 바꿈→이 기기 값 / 기준(base) 없음→서버 값(이 기기 값은 체크포인트) / 서버에 없는 항목은 지우지 않고 유지 — 단 삭제 기록이 있고 이 기기에서 안 고쳤으면 함께 삭제.
- 열쇠: contracts=id, monthly=m, groups·coverages·memos·shares·settings=객체 키. `__proto__`·`constructor` 는 무시, 서버 데이터의 이상한 모양은 건너뜀.
- `syncNow()` 는 큐로 하나씩. 흐름: load → `mergeAll` → (데이터가 바뀌면 체크포인트 후 `applyData`) → **보내는 순간의 해시로** 기준 저장 → save(baseRev) → 다른 기기가 먼저 저장했으면(conflict) 다시 병합(최대 4회).
- `scheduleSave()` = 즉시 로컬 저장 + 1.5초 뒤 동기화. 입력 중이면 화면을 다시 그리지 않는다.
- 💾 백업 파일은 서버 백업과 같은 전체 데이터. 📂 복원·체크포인트 복원은 force 저장(서버가 직전 상태를 백업).

## 서버 (Code.gs)

- POST 전용. 모든 관리 요청에 비밀 키(스크립트 속성 `SECRET_KEY`, 길이 비교 후 끝까지 비교, 틀리면 0.3초 지연). `doGet` 은 안내 문구만.
- 동작: `ping`, `meta`, `load`, `save`(baseRev, force), `uploadFile`, `getCustomerView`(토큰).
- `save`: 잠금, rev 가 다르면 conflict + 서버 데이터 반환, 계약 수·보장분석 고객 수가 절반 아래로 줄면 `shrink` 로 거부(force 제외), 하루 1회 백업(`백업/`, 14일), force 직전 별도 백업, 손상된 파일은 빈 데이터로 덮어쓰지 않음.
- `getCustomerView`: 토큰으로 그 사람을 찾는다(이름은 인증에 안 씀). 열쇠가 pid 면 `c.pid`, 예전 이름 열쇠면 `c.p` 로 계약을 찾는다(번호 이전 전에 보낸 링크도 열림). 계약완료 계약의 최소 필드 + 그 사람 보장분석 + 담보 그룹 설정만 반환. 메모·계약자·그룹·제안서 주소는 보내지 않는다.
- `uploadFile`: PDF 머리글 확인, `보험관리툴/제안서/<고객 폴더>/` 에 저장, 링크 공유(보기). **같은 이름 파일은 휴지통으로 보낸다** → 그래서 클라이언트가 파일 이름에 날짜와 무작위 글자를 붙인다(`proposalFileName`).
- `createSecretKey()` 처음 한 번, `rotateSecretKey()` 키가 샜을 때.

## 제안서 파일

- 📄 PDF 분석: Gemini 분석과 동시에 Drive 에 저장해서 그 계약(또는 외부·기존 보험 기록)의 `proposalUrl` 로 연결. 둘 중 하나가 실패해도 다른 하나는 진행하고, 결과를 한 알림에 같이 알린다.
- 📎 파일만 저장(`attachProposalOnly`): 분석 없이 연결. 이미 분석한 계약용 (재분석은 사용자가 직접 고친 담보를 덮어씀).
- 계약 수정 화면 업로드: `pendingProposalUrl` → 저장 버튼을 눌러야 연결. 폴더는 가입자 이름(없으면 계약자).
- 표시: 각 탭 표의 📄(`proposalLinkHtml`), 수정 화면(`resetProposalField`), 보장분석 구역 "📄 제안서 보기".
- 이 기능 이전에 보장분석에서 올린 파일은 분석에만 쓰이고 저장된 적이 없다.

## PDF 분석 (Gemini)

- 키는 기기별 localStorage. 모델은 코드 기본값 + 🤖 모델 변경으로 사용자가 고를 수 있다.
- `callGeminiPDF`: 혼잡(503/429/500) 시 4·10·20초 간격 재시도 → 그래도 안 되면 다른 flash 모델 최대 3개 → 성공한 모델을 기본으로 기억.
- 8쪽 넘는 PDF 는 pdf-lib(SRI 고정)로 6쪽씩 나눠 분석 후 합친다. 15MB 초과는 거부.
- 결과는 `name/amount/unit/price` 만 받고 `cleanAI` 로 태그·따옴표를 무력화한다.

## 배포

- 앱: `index.html` 을 GitHub 에 올리면 끝. 사용자에게 PC·폰 모두 강력 새로고침을 안내한다 (옛 화면이 남은 기기가 옛 형식 데이터를 다시 올릴 수 있음).
- 서버: `Code.gs` 를 Apps Script 편집기에 붙여 넣고 **배포 → 배포 관리 → 연필 → 새 버전** (주소·키 그대로). 보안 설정을 처음 할 때만 "새 배포" + `createSecretKey` + 옛 배포 보관.
- 서버 변경이 포함되면 **서버를 먼저** 배포하고 앱을 올린다.
- 배포 후 확인: 새 주소를 브라우저로 열면 `{"ok":false,"error":"POST로만 사용할 수 있어요."}` 한 줄.

## 알려진 한계 · 사용자 결정 대기

- ➕ 기존 보험 추가(`otherPolicies`)와 ＋ 외부 보험 추가(`externalPolicies`)가 거의 같은 기능이다. 합칠지 사용자 결정 대기.
- PIN 잠금은 화면 가림막이다(코드에 보임). 실제 보호는 서버 키.
- 제안서 PDF 는 Drive "링크가 있는 사람 보기" 공유. 소유자만 보게 바꿀 수 있음(아직 안 바꿈).
- git 이력에 예전 버전의 고객 데이터·옛 서버 주소가 남아 있을 수 있다. 저장소 재생성 여부는 사용자 결정.
- 테스트는 가짜 Google 환경·가짜 브라우저에서 돈다. 실제 Apps Script·Drive·Gemini·브라우저 동작은 배포 후 사용자 확인이 필요하다.

## 테스트

- `tests/lib/ins_fake_server.js`: 가짜 DriveApp·PropertiesService·LockService·Utilities 위에서 **실제 Code.gs** 를 실행한다.
- `tests/lib/ins_smoke_harness.js`: `makeDevice({ls, session, fetch, hash})` — 가짜 DOM·localStorage 로 **실제 index.html 스크립트**를 실행한다. `dev.run(코드)`, `dev.get(식)`(값이 undefined 면 실패하므로 참/거짓으로 물을 것), `dev.el(id)`, `dev.confirmQ`/`dev.promptQ`(대화상자 응답을 순서대로), `dev.bodyHtml`(고객 화면), `dev.downloads`(💾 백업 파일).
- 시간대는 Asia/Seoul 고정(`run-all.js` 가 설정). 컨테이너가 UTC 면 일정 시간이 어긋난다.
- 일부 테스트는 일부러 실패 상황을 만들어서, 앱이 `PDF 분석 실패` 로그를 남긴다(정상).
- 테스트 종류: `server`(서버), `merge`(병합·번호 이전·옛 데이터 정리 규칙), `sync`(동기화 코드 ↔ 서버), `smoke`(모든 탭 렌더링), `app`(설정 동기화·백업 왕복·삭제), `people`(동명이인·이름 변경·합치기·분리·링크), `files`(제안서 파일·기존 보험).
