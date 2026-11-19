# `.claude/skills/ecc-*` — ECC에서 골라 온 스킬 (2026-11-19)

원본: `affaan-m/ECC` **v2.2.3** — `skills/` 327종 · `rules/` 122파일 · `agents/` 72종 · `commands/` 98종 (커밋 `3f14a10`).
이 앱의 두 위험(고객 PII 유출, 한 파일 수정 사고)에 직접 쓰는 **2개**만 골랐다. 본문은 영어 원문 그대로, 앞머리에 한국어 메모.
**규칙이 부딪히면 `CLAUDE.md`·`tests/security.test.js`가 우선이다.**

| 스킬 | 원본 | 이 레포에서 쓰는 자리 | 주의 |
|---|---|---|---|
| `ecc-healthcare-phi-compliance` | `healthcare-phi-compliance` | 고객 정보를 다루는 코드 — 분류, 응답 칸, 로그·URL·저장소 누출 경로 | 의료(HIPAA/RLS) 예시는 해당 없음. 원칙만. 고객 응답 6칸 잠금 유지 |
| `ecc-verification-loop` | `verification-loop` | `npm test`(정적 + 32종) 뒤 커밋 전 diff 리뷰 — 함수 삭제·중복 선언 사고 확인 | TS·커버리지 단계 없음. `Code.gs` 수정 시 배포 필요를 보고에 포함 |

## 갱신·제거

- **갱신**: 원본 `skills/<이름>/SKILL.md`와 각 폴더 원문 본문(구분선 아래)을 비교. 원본 SHA가 달라지면 `upstream_commit`도 같이.
- **제거**: `ecc-*` 폴더 삭제로 끝. `npm test`는 이 폴더를 읽지 않는다.
