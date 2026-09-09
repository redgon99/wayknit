# HANDOFF — Wayknit(여로담) 작업 인계 문서

최신 갱신: 2026-09-08 (3차) / 브랜치 `main`

이 문서는 같은 사용자가 다른 장소·다른 세션에서 작업을 이어받기 위한 인계 문서다. 아래 순서대로 읽으면 된다: **0(지금 상태) → 1(주의사항) → 필요한 상세는 2~13에서 찾아보기**.

**배포를 건드릴 일이 있으면 §9를 먼저 읽을 것** — 이 프로젝트의 Netlify 사이트는 **Git 연동이 없다.** 커밋·푸시만으로는 아무것도 배포되지 않는다. **배포 스크립트를 손대기 전에 §13을 읽을 것** — 문서가 설명하던 격리 동작이 코드에 없었던 적이 있다. 배포 명령은 이제 OS 상관없이 `npm run deploy -- "메모"` 하나다(§12-3).

---

## 0. 지금 상태 한눈에 보기

일곱 작업 트랙이 있다.

1. **관리자 페이지 개선** (§2) — 사용자가 요청한 감사에서 나온 우선순위 4건 전부 완료, 확장 백로그도 대부분 완료. 남은 건 페이지별 세부 미비점(§2-7, 아직 착수 안 함).
2. **동선짜기 UX 검토** (§3) — 발견 5건 **전부 완료.**
3. **플래너 검색·상세보기 UX** (§4) — 2026-09-05 세션. 사용자가 화면을 보며 지시한 6건 전부 완료·브라우저 검증됨.
4. **실시간 공동편집** (§5) — **A안 1~4단계 전부 완료.** 핀 행 분리·실시간 반영·활동 로그·UX(presence 아바타, 핀 작성자 표시). 남은 건 payload 통짜 저장 항목뿐(§5-2-1 말미).
5. **모바일 UX 감사·개선** (§6) — 2026-09-06 세션. 실제 모바일 화면을 전수 점검해 버그·불편 목록을 뽑고, 합의된 5단계를 **전부 완료.** 남은 결정 사항 있음(§6-7).

6. **브랜드 개명** (§7) — 2026-09-06. `WayMeld` → `Wayknit`으로 폴더·저장소·코드·DB·스토리지 키 전부 전환 **완료.** 개명 빌드 배포도 완료됐다(§7-4). 남은 사용자 조치는 카카오 콘솔 도메인 등록·`.com` 확보.
8. **모바일 UX 2차 · 공동편집 4단계** (§10) — 2026-09-07. 사용자가 폰으로 직접 보며 지시한 4건 완료. 모바일 검색을 전면 덮개에서 **하단 시트 탭**으로 바꿔 지도와 함께 보이게 했다.
7. **배포·환경변수** (§9) — 2026-09-07~08. 라이브에서 지도가 안 뜨는 신고로 시작해, **배포 빌드에 `VITE_*` 환경변수가 하나도 없던 것**을 찾아 고쳤다. 지도만이 아니라 Supabase가 통째로 미설정이라 로그인·저장·협업이 전부 죽어 있었다. **배포 스크립트(`npm run deploy`)를 만들어 절차를 고정**했고, **GitHub 연동은 빌드 크레딧 때문에 일부러 하지 않는다**(§9-5-1 — 권하지 말 것).

**막고 있던 것 (2026-09-08 기준):** 오래 걸려 있던 🔴 두 개가 **모두 풀렸다** —
Anthropic 크레딧 소진(§1-1, 충전 후 200 실측)과 모바일 로그인 오류(§10-7, 앱 버그가 아니라
Tailscale 테스트 환경 탓이었음). **지금 남은 실질적 걸림돌은 배포뿐이다** — 라이브가
`d166d24`라서 **협업자 저장 403 수정(`f0777d0`)이 아직 안 올라갔고, 그래서 라이브에서는
협업자가 핀을 추가해도 소유자에게 가지 않는다**(§11-1).

**검증은 사용자가 직접 한다 (2026-09-06 사용자 지시로 변경됨):** 이전 방침("크로미움 설치해서 직접 접속해 확인해줘", 2026-09-05)은 **폐기됐다.** 세션이 Playwright로 자체 검증하지 말고, 각 단계 끝에 **"어디서 무엇을 눌러 어떤 결과가 나와야 정상인지" 확인 절차를 설명**하고 사용자의 확인을 기다린다. 이유: 스크린샷·DOM 스냅샷·스크립트 결과가 실제 코드 수정보다 토큰을 더 많이 먹는다는 걸 사용자가 확인했다. 브라우저 자동화가 정말 필요할 때의 설치법은 §8에 남겨둔다.

**작업 방식 (반드시 지킬 것):** 사용자와 "하나씩 완료 → 브리핑 → 컨펌 → 다음"으로 진행하기로 합의했다. 사용자 확답 없이 다음 항목으로 앞서가지 말 것.

**커밋 정책 (2026-09-04 사용자 지시):** git commit/push는 **사용자가 명시적으로 요청할 때만** 한다. 항목을 하나 완료했다고 자동으로 커밋하지 말 것 — 완료 확인과 커밋 요청은 별개다.

---

## 1. ⚠️ 반드시 알아야 할 주의사항

### 1-1. ✅ Anthropic API 크레딧 소진 — 2026-09-08 해결됨

2026-09-04 Playwright로 AI 체류시간 추천을 테스트하다가 발견. `route-stay-suggest` Edge Function이 **502**를 반환하고, 실제 응답 본문은:

> `"claude api failed: 400 ... Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."`

이 Supabase 프로젝트가 쓰는 **Anthropic API 키의 크레딧이 소진**된 상태다. 코드 문제가 아니라 결제 문제라 세션에서 고칠 수 없다. 같은 키를 쓰는 다른 Edge Function도 전부 막혀 있을 가능성이 크다(확인 필요): `tour-scenario`, `tour-scenario-catalog-generate`, `insight-analyze`, `insight-guide-draft`, `distribution-draft`, `link-places-extract`, `youtube-places-extract`, `route-stay-suggest`, `_shared/scenarioGen.ts`를 참조하는 곳 전부. **사실상 이 앱의 AI 기능 대부분.**

→ **2026-09-08 사용자가 충전했고, 실제로 되는 것을 확인했다.** 말만 듣지 않고 찔러봤다:

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/route-stay-suggest" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"places":[{"id":"t1","name":"소양강스카이워크"}],"locale":"ko"}'
# → HTTP 200, 실제 Claude 응답(체류시간 90분 + 한국어 근거)
```

**AI 함수 9개가 전부 같은 `ANTHROPIC_API_KEY` 하나를 쓴다**(`grep`으로 확인:
`route-stay-suggest`·`tour-scenario`·`tour-scenario-catalog-generate`·`insight-analyze`·
`insight-guide-draft`·`insight-place-match`·`distribution-draft`·`link-places-extract`·
`youtube-places-extract`). 그래서 하나가 200이면 나머지도 크레딧 때문에 막히지는 않는다 —
각 함수 자체의 버그는 별개다.

> 다음에 AI 기능이 502를 내면 **응답 본문을 먼저 볼 것.** 크레딧 문제는 코드가 아니라
> 본문에만 드러난다(`claude api failed: 400 ... credit balance is too low`).

### 1-2. Supabase 마이그레이션 이력이 CLI와 어긋나 있음

`supabase db push --dry-run`을 시도하다가 발견. **스키마 변경을 배포하려 할 때마다 똑같이 막힐 것이므로 반드시 인지하고 시작할 것.**

- 프로젝트 ref `ainftwifvclgiookzrwm`(`.env.local`의 `VITE_SUPABASE_URL`과 일치, 올바른 프로젝트 맞음)에 CLI로 연결하면, 원격 DB의 마이그레이션 이력 테이블에 **213개** 버전이 기록돼 있는데 로컬 `supabase/migrations/`의 파일과 **단 하나도 일치하지 않는다.** 반대로 로컬 파일 중 원격에 "적용됨"으로 기록된 것도 없다.
- 앱이 정상 동작하는 것으로 보아 실제 스키마(테이블/RLS 정책)는 DB에 존재할 가능성이 높다 — 즉 지금까지 배포는 `supabase db push`가 아니라 **Supabase 대시보드 SQL 에디터로 SQL을 직접 실행**하는 방식으로 이뤄져 온 것으로 추정된다(CLI 이력 테이블에는 기록이 안 남는 방식).
- CLI가 자동으로 제안하는 해결책(`supabase migration repair --status reverted <213개 id>`)은 **실행하지 않았다** — 그대로 따르면 이후 `db push`가 로컬 마이그레이션 전체를 "미적용"으로 보고 프로덕션 DB에 처음부터 다시 실행하려 들 위험이 있다(이미 존재하는 테이블/컬럼을 다시 만들다 에러 or 예기치 않은 부작용).
- **당분간 새 마이그레이션은 `supabase db push`를 쓰지 말고** 아래 둘 중 하나로 적용한다:
  1. Supabase 대시보드 SQL 에디터에 직접 붙여넣어 실행 (사용자가 직접 하거나)
  2. MCP `apply_migration`으로 원격에 직접 적용 (세션 안에서 적용 후 즉시 재검증까지 가능해 편하다 — 이번 세션에서 실제로 여러 번 이 경로로 적용·검증했다)
  - 공유 DB(다른 실서비스가 같은 프로젝트에 있음)이므로 **적용 전 영향 범위를 확인하고 사용자 승인을 받을 것.**
- CLI 이력 정리(`migration repair`)는 별도로 사용자와 충분히 논의한 뒤에만 시도할 것 — 세션 혼자 판단으로 진행하지 말 것.
- **이 어긋남이 실제로 장애를 만든 사례(2026-09-06 발견):** 로컬 마이그레이션 `20260817110000_landing_promo_order.sql`이 원격에 적용되지 않아 `landing_promo` 테이블에 `is_published`·`block_order` 컬럼이 없는데 코드는 두 컬럼을 조회·저장한다 → 랜딩 CMS가 조회(400)·저장 양쪽 다 깨진 채 오래 방치됐다. 상세와 적용 SQL은 §6-2. **다른 테이블에도 같은 종류의 드리프트가 남아 있을 수 있다** — 코드가 참조하는 컬럼이 원격에 실제로 있는지 의심되면 REST로 직접 확인하는 게 빠르다(§6-2에 방법).

### 1-3. app.css / AdminPage.tsx / 로케일 파일 커밋 시 사용자 작업과 섞임 주의

2026-09-04 동안 **사용자가 직접 진행 중인 작업**(목업 메일 로그인, 약관 모달 `LegalModal.tsx`/`LegalDocuments.tsx`, `AuthContext`, 로그인·약관 페이지, 9개 로케일의 `auth.json`)이 여러 차례 워킹트리에 미커밋 상태로 섞여 있었다. `src/styles/app.css`와 `src/pages/AdminPage.tsx`는 양쪽 변경이 같은 파일에 섞이는 일이 반복됐다.

**`git diff -U0`로 hunk를 쪼개 커밋하는 방식은 쓰지 말 것** — 새 CSS 블록을 기존 블록 바로 앞에 삽입하면 git이 "이동"으로 정렬하면서 **기존에 커밋된 CSS를 삭제하는 패치**가 나온 적이 실제로 있었다(커밋 전에 발견해서 걸렀다).

안전한 절차:
1. 작업트리에서 내가 추가한 블록만 잘라낸 사본을 만든다
2. `git show HEAD:src/styles/app.css` 등 기존 커밋본과 **셀렉터/키 집합을 비교**해 "사라지는 것 0건"을 확인한다
3. `git hash-object -w` + `git update-index --cacheinfo`로 그 사본만 스테이징해 커밋한다
4. 커밋 후 워킹트리를 다시 전체(내 것 + 사용자 것) 버전으로 복원한다

`git add -A`로 통째로 담지 말 것 — 사용자의 미완성 작업이 섞여 들어간다. `git add`는 항상 파일을 명시적으로 나열할 것.

### 1-4. 커밋 상태 (최신)

이 문서를 갱신하는 시점의 워킹트리 변경사항과 실제 커밋 여부는 세션마다 다르다 — `git log --oneline -20`과 `git status --short`로 직접 확인할 것. 과거 커밋 이력(관리자 페이지 개선 전체)은 `git log`에서 `20260904_` 접두어 커밋들로 확인 가능하다.

**2026-09-05 커밋에서 일부러 제외한 것 (워킹트리에 그대로 남아 있음):**

- `src/pages/PlannerPage.tsx` — `useEffect(() => { if (!useMobileChrome) setMobileSheet(null); }, [])`의 의존성 배열에서 `useMobileChrome`이 빠진 한 줄. 세션의 편집 이력에 없는(= 세션이 만들지 않은) 변경이라 커밋에 담지 않았다. 그대로 두면 데스크톱으로 전환해도 모바일 시트가 안 닫힌다 — **의도한 변경인지 확인하고, 아니면 되돌릴 것.**
- `docs/산악사고 신고자 구조 전 안전관리 PWA 구축계획.md` — 사용자 문서, untracked 상태 유지.

**2026-09-07 확인 결과 — 위 두 건의 현재 상태가 달라졌다:**

- `PlannerPage.tsx`의 의존성 배열 한 줄은 **커밋에 이미 들어가 있고 문제도 그대로다**([PlannerPage.tsx:2044-2046](src/pages/PlannerPage.tsx#L2044-L2046)). 워킹트리 미커밋 항목이 아니라 **코드에 남은 버그**로 다뤄야 한다. 사용자 판단 대기 중.
- `docs/산악사고 …` 문서는 untracked가 아니라 `2933439`에 **커밋돼 있었고, 지금은 워킹트리에서 삭제된 상태**(`git status`에 ` D`)다. 의도한 삭제인지 미확인이라 손대지 않았다.

**2026-09-07(2차) 갱신:**

- `deno.lock` — Netlify 배포 시 Deno 번들러가 의존성 4줄을 추가한 변경(§9). 커밋에 포함시켰다.
- `PlannerPage.tsx`의 의존성 배열 버그는 **§10-5에서 해소됐다** — 대상 상태(`mobileSheet`)가 통째로 사라져 그 `useEffect`를 제거했다.
- `docs/산악사고 …` 삭제는 **여전히 미결**이라 커밋하지 않았다. 워킹트리에만 삭제 상태로 남아 있으므로 다른 PC에는 파일이 그대로 있다.

### 1-5. Windows에서 `.env.local`을 셸로 읽을 때 (2026-09-07)

이 저장소의 `.env.local`은 **CRLF**다. Git Bash에서 `set -a; . ./.env.local; set +a`로 소싱하면 **모든 값 끝에 `\r`가 붙어** 비교·요청이 조용히 다 어긋난다. 실제로 2026-09-07 세션에서 배포 번들과 값을 대조하다 "전부 불일치"라는 잘못된 결론을 한 번 냈다.

```bash
tr -d '\r' < .env.local > /tmp/env.clean
set -a; . /tmp/env.clean; set +a
```

§6-2의 curl 레시피도 Windows에서는 이 전처리를 거쳐야 한다.

---

## 2. 관리자 페이지 개선

### 2-0. 배경

사용자 요청으로 **관리자 페이지(`/admin` 및 하위 페이지) 전체를 감사해 미비점 목록을 뽑고, 우선순위 높은 것부터 하나씩 고치는** 작업이었다.

관리자 페이지 구성 (`src/components/AdminHeader.tsx`의 `NAV_ITEMS` 기준): `/admin`(현황 관리) · `/admin/insights`(시장 인사이트) · `/admin/guides`(가이드 카드) · `/admin/distribution`(배포관리) · `/admin/scenarios`(시나리오 카탈로그) · `/admin/landing`(랜딩페이지 관리) · `/admin/reports`(신고 검수) · `/admin/audit`(감사 로그, 이번에 추가) · `/admin/dashboard`(대시보드, 이번에 추가) · `/admin/search`(전역 검색, 이번에 추가).

### 2-1. 합의된 우선순위 4건 — 전부 완료

| # | 항목 | 상태 |
|---|---|---|
| 1 | 관리자 계정 관리 UI 부재 | ✅ 완료 + 실사용 검증됨 (§2-2) |
| 2 | 감사 로그(Audit log) 부재 | ✅ 완료 (§2-3) |
| 3 | 대용량 데이터 페이지네이션/검색 부재 | ✅ 완료 (§2-4) |
| 4 | 신고 검수에서 직접 제재 액션 연결 부재 | ✅ 완료 (§2-5) |

### 2-2. ① 관리자 계정 관리 UI

**문제였던 것:** `admin_users` 테이블에 RLS 정책이 "본인 행 SELECT"만 있고 INSERT/UPDATE/DELETE 정책이 전혀 없어서, 관리자 본인도 Supabase 대시보드로 DB에 직접 들어가지 않으면 새 관리자를 등록할 방법이 없었다.

**변경한 파일:**
- `supabase/migrations/20260904000000_admin_users_management.sql` — 관리자 전용 INSERT/DELETE RLS 정책 추가, SELECT도 관리자면 전체 조회 가능하도록 확장
- `src/lib/admin.ts` — `listAdminUserAccounts` / `addAdminUserAccount` / `removeAdminUserAccount` / `getEnvAdminEmails`
- `src/pages/AdminPage.tsx` — "관리자 계정 관리" 섹션 신설(이메일로 추가, 목록+삭제, `VITE_ADMIN_EMAILS` 환경변수 관리자는 읽기 전용 안내, **마지막 관리자 1명은 삭제 버튼 비활성화**로 전원 잠금 방지)

**후속 확인·수정 (같은 날):**
- 마이그레이션 적용 확인됨, 실사용(두 번째 관리자 추가)까지 확인됨.
- **버그 발견·수정: `is_admin()` 무한재귀.** `admin_users` SELECT 정책이 `is_admin()`을 호출하는데, `is_admin()`이 SECURITY DEFINER가 아니라 호출자 권한으로 `admin_users`를 다시 읽어 **정책 → is_admin() → admin_users 조회 → 정책 → …** 로 순환했다. 관리자가 1명일 때는 `OR` 첫 조건에서 단락돼 우연히 동작했지만, **두 번째 관리자를 추가하는 순간** 전체 스캔 중 `stack depth limit exceeded`(54001)로 목록 화면이 깨졌다. 수정: `supabase/migrations/20260904010000_fix_admin_is_admin_recursion.sql` — 저장소 기존 해법(`is_trip_collaborator`)과 동일하게 `security definer` + `set search_path = public`. `is_admin()`을 참조하는 정책 24개 전부 Wayknit 테이블 전용임을 확인(공유 DB지만 영향 범위는 Wayknit 한정).

### 2-3. ② 감사 로그 (Audit log)

**설계 판단:** 호출부마다 로깅 코드를 넣는 대신 **DB 트리거**로 붙였다. 관리자 변경 지점이 9개 테이블·여러 lib 파일에 흩어져 있어 호출부 방식은 새 기능 추가 시 빠뜨리기 쉽고, 대시보드에서 직접 고친 변경은 아예 못 잡는다.

**변경한 파일:**
- `supabase/migrations/20260904020000_admin_audit_log.sql` — `admin_audit_log` 테이블 + `audit_redact()` + `log_admin_action()` 트리거 함수 + 9개 테이블에 트리거 부착
- `src/lib/adminAudit.ts` — 조회·필터·키셋 페이지네이션, `describeAuditEntry()`(로그 한 줄을 사람 문장으로)
- `src/pages/AdminAuditPage.tsx` — `/admin/audit`
- `src/components/AdminHeader.tsx`, `src/App.tsx`, `src/styles/app.css`(`.audit-op`, `.audit-detail`)

**감사 대상 9개 테이블:** `admin_users` / `admin_notices` / `admin_user_verifications` / `guide_articles` / `scenario_catalog` / `landing_promo` / `distribution_accounts` / `insight_keywords` / `content_reports`(관리자 조치인 UPDATE·DELETE만). `insight_raw_items`·`distribution_posts`는 파이프라인이 대량으로 써서 로그가 넘치므로 **일부러 제외**.

**설계상 지켜진 것 (검증 완료):** append-only(관리자도 자기 흔적 못 지움) · 비관리자 차단 · 대용량 컬럼(예: `scenario_catalog.content`)은 1000바이트 초과 시 크기만 남김 · UPDATE는 바뀐 컬럼만 기록(no-op UPDATE는 기록 안 함) · 서비스 롤 변경은 "시스템"으로 표기.

**⚠️ 알아둘 것:** 트리거는 설치 시점부터 기록하므로 그 이전 변경 이력은 없다. 화면을 처음 열면 비어 있는 게 정상.

### 2-4. ③ 목록 페이지네이션·검색

**무엇이 문제였나:** `lib/admin.ts`가 `wayknit_trips` 전량을 브라우저로 가져와 JS에서 집계했다. 특히 자료 개수를 세려고 `payload` 컬럼(여행 1건 최대 151KB)까지 통째로 받아왔다 — 데이터가 늘면 매 조회마다 수십~수백 MB. 검색창도 없었고 사용자 목록은 UUID만 보여줘 검색해도 쓸모없었다.

**변경한 파일:**
- `supabase/migrations/20260904030000_admin_pagination_search.sql` — RPC 3개: `admin_user_rows`(집계+이메일조인+검색+페이지네이션), `admin_share_stats`(카운트 전부 SQL에서, `jsonb_array_length`로 자료 수 세서 payload 자체는 브라우저로 안 나감), `admin_plaza_listings`(최근 12건 고정 → 검색+페이지네이션). 셋 다 `security definer`라 **함수 첫 줄에서 `is_admin()` 직접 확인**(RLS 우회하므로 필수).
- `src/lib/admin.ts` — RPC 호출로 교체, `AdminPage<T>`(rows+totalCount)·`AdminListQuery`·`ADMIN_PAGE_SIZE`(25) 추가, JS 집계 코드 삭제
- `src/pages/AdminPage.tsx` — 검색창(250ms 디바운스) + `Pager` 컴포넌트, 사용자 목록에 이메일 노출

**검증:** RPC 3개를 관리자 JWT로 직접 호출해 기존 집계와 값 일치 확인, 비관리자 호출은 `42501` 거부.

### 2-5. ④ 신고 검수 직접 제재

**무엇이 문제였나:** `/admin/reports`에서 상태값 변경·메모만 가능했다. "조치 완료"로 바꿔도 신고당한 콘텐츠는 그대로 공개돼 있었다.

**신고 대상별 실제 레버:**

| 대상 | 식별자 | 제재 |
|---|---|---|
| `trip` | `wayknit_trips.id` | `is_public=false` + `listed_in_plaza=false` |
| `plaza_listing` | `wayknit_trips.id` | `listed_in_plaza=false`만 |
| `guide` | `guide_articles.id` | `status='draft'` |
| `place` | — | 신고 생성 UI 자체가 없어 제재 액션 없음으로 표시 |

**변경한 파일:**
- `supabase/migrations/20260904050000_admin_report_moderation.sql` — `admin_report_target_states()`(대상 현재 상태), `admin_moderate_report(p_report_id)`(제재+신고 resolved 전환을 한 트랜잭션으로, 대상 유형을 신고 행에서 직접 읽어 호출자가 어긋나게 지정 불가)
- `src/lib/contentReports.ts`, `src/pages/AdminReportsPage.tsx`, `src/styles/app.css`(`.admin-moderate-btn`)

**설계 판단:** 관리자에게 `wayknit_trips` UPDATE 권한을 주지 않고(컬럼 단위 제한이 안 되므로) SECURITY DEFINER RPC로 필요한 플래그만 뒤집음. `wayknit_trips`엔 감사 트리거 안 닮(자동저장이 로그를 뒤덮으므로) — 제재 RPC 안에서만 직접 `admin_audit_log`에 기록.

**⚠️ 남은 확인:** 세션 시점 실제 신고가 0건이라 브라우저에서는 빈 화면. `/plaza`나 공유 여행 페이지에서 신고를 접수한 뒤 확인할 것.

### 2-6. 확장 백로그 — 완료된 것들

사용자가 "순차적으로 진행"을 지시해 아래도 이어서 처리했다.

**보안 어드바이저 점검 및 강화** — ②~④에서 SECURITY DEFINER 함수 6개를 추가해 Supabase security advisor로 검증. 전체 214건 중 Wayknit 테이블 ERROR는 0건(나머지는 같은 프로젝트의 다른 앱 것). 고친 것 둘(`20260904060000_admin_function_hardening.sql`): `audit_redact()`에 빠져 있던 `set search_path = public` 추가, 관리자 전용 RPC 5개가 로그아웃(anon) 상태에서도 호출 가능하던 것을 PUBLIC/anon 회수 후 `authenticated`에만 부여.
**⚠️ 건드리면 안 되는 것:** `is_admin()`과 트리거 함수 `log_admin_action()`의 EXECUTE 권한은 회수하면 안 된다 — RLS 정책 본문에서 호출되므로 회수하면 관련 테이블이 전부 접근 불가가 된다. 어드바이저가 WARN으로 계속 표시하지만 의도된 것.

**통합 대시보드** — 지표가 8개 페이지에 흩어져 있던 문제. `supabase/migrations/20260904070000_admin_dashboard.sql`의 `admin_dashboard_summary()` RPC(왕복 1회) + `src/lib/adminDashboard.ts`의 `deriveAlerts()`(숫자 나열이 아니라 "지금 손대야 할 것"을 규칙으로 추출) + `/admin/dashboard`. 경보 규칙: 미처리 신고 / 배포 실패 / 배포 초안은 있는데 계정 0개 / 트렌드 수집 정체 / 수집 원문-장소 미연결 / 시나리오 테마 미커버 / 초안 대기 / 관리자 1명뿐. 첫 실행에서 실제로 여러 건 잡혀 기능이 의도대로 동작함을 확인(배포 초안 9건인데 계정 0개, 트렌드 수집 정체, 수집 원문 597건 미연결, 시나리오 테마 6/10 커버 등).

**전역 검색** — `supabase/migrations/20260904080000_admin_global_search.sql`의 `admin_global_search(p_query, p_limit)`(사용자/여행/가이드/시나리오/공지를 UNION ALL로 훑어 정규화) + `src/lib/adminSearch.ts` + `/admin/search`. 모든 관리자 화면 상단(`AdminHeader.tsx`)에 검색창 배치. 공개된 여행은 결과에서 바로 `/trip/<slug>` 링크로 열람 가능.

**데이터 내보내기 (CSV)** — `src/lib/csv.ts`(`toCsv`/`downloadCsv`/`csvFilename`). 사용자 목록·공유마당 목록·감사 로그에 내보내기 버튼. 필수 처리 두 가지: **CSV 수식 인젝션 방지**(`=`/`+`/`-`/`@`로 시작하는 값 앞에 작은따옴표) + **UTF-8 BOM**(없으면 Excel에서 한글 깨짐). 화면에 보이는 페이지가 아니라 현재 검색·필터 조건에 맞는 전체(최대 5000건)를 내보낸다.

**버전 이력 되돌리기** — 별도 버전 테이블 없이 감사 로그(②)의 전/후 값을 재사용. `supabase/migrations/20260904090000_admin_audit_restore.sql`의 `admin_restore_audit_entry(p_audit_id)`. **핵심 위험 대응:** `audit_redact()`가 1000바이트 넘는 값을 자리표시자로 자르는데, 그대로 복원하면 원본이 파괴된다 — 잘림 마커를 구조화된 jsonb(`{"__audit_omitted_bytes__": N}`)로 만들고, 잘린 필드가 있으면 필드명을 알려주며 복원을 **서버에서 거부**한다(UI도 버튼을 막음). 허용 테이블: `guide_articles`/`landing_promo`/`admin_notices`/`scenario_catalog`. `admin_users`(권한 부여)·`content_reports`(신고 처리)는 되돌리면 안 되므로 서버에서 거부. INSERT 되돌리기(=행 자체를 지우는 것)도 거부 — 해당 화면에서 삭제하면 됨.

**🔴 회귀 버그 수정 — 남의 여행이 "내 여행" 목록에 섞이던 문제 (관리자 페이지 밖 이슈지만 이 작업 중 발견):** 2026-09-01 공동편집 작업에서 `listRemote`/`readRemoteById`/`readRemoteLatest`가 `owner_id` 필터를 제거하면서, `wayknit_trips`의 SELECT 정책 4개(소유·협업 / **공개** / 마당등록 / **관리자**)가 전부 OR로 합쳐져 **일반 사용자에게도 공개 여행 전부가 "내 여행"으로 보이는** 문제였다(관리자 55건→19건, 여행 없는 사용자 34건→0건 등 실측). 데이터 손상·소유권 탈취는 없었음(UPDATE 정책은 그대로 소유자/편집자 한정). 수정: 쿼리에서 명시적으로 `or(owner_id.eq.나, id.in.(협업 여행들))`로 좁힘. **교훈: RLS에 "내 것 판별"을 맡기지 말 것** — RLS는 "접근 가능한가"만 정하고, 화면 목록은 그보다 좁은 질의여야 한다. 정책이 하나 추가될 때마다 조용히 넓어진다.

**협업 초대 알림 (A안 — 초대 링크 복사, 관리자 페이지 밖):** 초대해도 상대에게 알림이 안 가던 문제(이메일 발송 수단이 저장소에 없음). A안으로 링크 복사 방식 채택. `supabase/migrations/20260904100000_trip_invite_preview.sql`의 `get_trip_invite_preview()`(SECURITY DEFINER, 이메일 마스킹해서 anon도 미리보기 가능) + `InviteBanner.tsx`(`/plan?invite=<id>` 진입 시 4가지 상태: 미로그인/다른계정로그인/연결중/이미참여). **B안(실제 이메일 발송)은 미착수** — 외부 서비스 가입 + 발신 도메인 인증(SPF/DKIM) 필요.

### 2-7. 미착수 — 페이지별 세부 미비점

최초 감사 시 발견했지만 아직 손 안 댐. 우선순위 미정, 필요시 사용자에게 확인 후 착수:
- **현황관리**: Tier3 게이트가 지표만 보여줄 뿐 후속 액션 없음, 공지 예약발행/종료일 없음
- **시장 인사이트**: 수집 실행 진행률 표시·취소 불가, 잘못 수집된 원문 삭제 불가, AI 오분류 수동 재분류 불가
- **가이드 카드**: 발행 전 실제 렌더링 미리보기 없음(버전 되돌리기는 §2-6에서 해결됨), 일괄 편집 불가
- **배포관리**: X(트위터) 외 5개 플랫폼(Reddit/YouTube/TikTok/웨이보/샤오홍슈)은 초안까지만 되고 게시 커넥터 미구현, 계정 자격증명 수정/교체(rotate) UI 없음(삭제 후 재등록만), 게시 실패 재시도 버튼 없음, `scheduledAt` 필드는 있는데 예약 게시 UI 없음
- **시나리오 카탈로그**: 대량 재생성이 순차 실행만 지원, 재생성 전/후 콘텐츠 diff 비교 뷰 없음
- **랜딩페이지 관리**: 데스크톱 미리보기만 있고 모바일 미리보기 없음, 예약 게시 없음(버전 되돌리기는 §2-6에서 해결됨)
- **신고 검수**: 신고자에게 처리 결과 통보 없음, 여러 건 선택 일괄 처리 불가

---

## 3. 동선짜기 UX 검토 — 5건 전부 완료

사용자 요청으로 플래너의 동선 패널(`RouteOptionsPanel.tsx`)을 사용자 입장에서 검토해 발견한 5건. **"차례대로 진행하고 매번 컨펌"** 방식으로 합의해 순서대로 처리했다.

| # | 문제 | 상태 |
|---|---|---|
| 1 | 최적화 3버튼(최단거리/최소시간/무료도로)이 아무 일도 안 함 | ✅ 완료 (§3-1) |
| 2 | Preview의 "13분"과 "ends 20:10"이 서로 다른 시간 기준 | ✅ 완료 (§3-2) |
| 3 | AI 자동 추천이 기본 ON이라 두 번 눌러야 실제 호출 | ✅ 완료 (§3-3) |
| 4 | "핀 순서" 모드인데 동선 패널에서 순서 변경 불가 | ✅ 완료 (§3-4) |
| 5 | 날짜를 비우면 영업시간 검증이 조용히 꺼짐 | ✅ 완료 (§3-5) |

### 3-1. ① 최적화 3버튼을 실제로 연결

**문제:** `optimizeBy`가 패널·기본값·타입 선언에만 등장하고 **읽는 곳이 없었다.** `useHighway`·`useRealTimeTraffic`도 같은 상태. 눌러도 동선이 안 바뀌는데 하나가 선택된 것처럼 보였다.

**해법:** 이미 쓰던 카카오모빌리티 길찾기(`refineRouteWithRealLegs`)의 `priority`/`avoid` 파라미터가 `'RECOMMEND'`로 하드코딩돼 있던 것을 `optimizeBy`로 실제 전달: 최단거리→DISTANCE / 최소시간→TIME / 무료도로→RECOMMEND+avoid=toll. 도보·자전거·대중교통 API는 이 파라미터를 안 받으므로 자동차가 아니면 버튼을 비활성화.

**실제 API 검증(서울시청→춘천시청):** RECOMMEND 101.5km·107분·톨 3900원 / DISTANCE 90.1km·123분·톨 5300원 / avoid=toll 100.7km·121분·톨 0원.

이어서 사용자 추가 요청으로 **최적화 3종 경로 미리보기 + 통행료 표시**도 붙였다. 카카오 경유지 길찾기(`/v1/waypoints/directions`)는 전체 경로를 1회 호출로 돌려주므로 3종 비교가 3회로 끝난다(`src/lib/routeCompare.ts`, `comparisonKey()`로 좌표·이동수단이 같으면 재호출 안 함). 통행료는 무료도로를 뺀 두 기준에만 표시. 안동 4지점 실호출로 경로가 실제로 갈리는 것 확인(최단거리 88.9km·130분, 최소시간 103.2km·115분).

### 3-2. ② Preview 시간 표기 기준 통일

**문제:** Preview 줄의 `{{minutes}}분`은 **이동시간만**(`totalTravelMinutes`)이고 `ends {{time}}`은 **이동+체류를 다 더한** 종료시각이라 두 숫자 기준이 달랐다.

**원인:** `planner.ts`의 `generateRoute()`가 이미 `totalStayMinutes`를 계산해 갖고 있었는데 `RouteOptionsPanel.tsx`가 읽지 않고 있었을 뿐 — 새 합산 로직은 필요 없었다.

**해법:** `stayMinutes: preview.totalStayMinutes`를 i18n 호출에 추가하고, 9개 로케일의 `previewStats`를 "이동 {{minutes}}분 · 체류 {{stayMinutes}}분 · {{time}} 끝" 형태로 분리. 새 단어를 짓지 않고 이미 앱에 있던 표현(`detailTravel`, `pillNext`의 종료 표현, `stayMinutesAria`의 체류 명사)을 재사용. 부수적으로 ja/zh-CN/zh-TW에 번역 안 된 채 남아있던 영어 "ends"도 함께 고침.

**변경한 파일:** `RouteOptionsPanel.tsx`, `src/locales/{9개 언어}/planner.json`

**✅ 브라우저 확인됨 (§3-3에서 같이 확인):** "7.7 km · 이동 18분 · 체류 420분 · 18:43 끝"으로 정확히 표시.

### 3-3. ③ AI 자동 추천 기본 ON 문제

**문제:** `DEFAULT_ROUTE_OPTIONS.autoStayTime = true`였다. `true`는 실제로는 "AI가 추천을 마쳤다"는 뜻인데, 새 여행/새 날짜를 열면 AI를 호출한 적도 없이 버튼이 이미 켜진 것처럼 보이고 카테고리 고정 문구가 AI 추천인 것처럼 떴다. `handleToggleAutoStay()`는 이미 `true`인 상태에서 첫 클릭 시 그냥 꺼버리기만 해서, 실제 AI 호출은 두 번째 클릭에서야 일어났다. 이 상태에서는 체류시간 수동 입력창도 숨겨졌다. AI 호출이 실패해도 조용히 카테고리 기본값으로 대체하며 `autoStayTime`을 `true`로 바꿔버려, 실패를 알 수 없고 재시도도 안 되고 **사용자가 직접 넣어둔 체류시간까지 덮어써지는** 부작용까지 있었다.

**해법:**
- `src/lib/tripRouteOptions.ts` — `DEFAULT_ROUTE_OPTIONS.autoStayTime`을 `false`로. 새 여행/새 날짜에서 시작 상태가 정직해지고, 입력창이 처음부터 편집 가능해지며, 첫 클릭이 곧바로 실제 AI 호출로 이어진다. 기존 저장된 트립에는 영향 없음(`normalizeTrip`이 미저장 날짜에만 기본값 채움).
- `RouteOptionsPanel.tsx` — 실패 시 더 이상 `autoStayTime`을 `true`로 바꾸지 않고(입력창 계속 편집 가능), 기존 체류시간을 덮어쓰던 로직 제거(어차피 `generateRoute()`가 미지정 스톱에 카테고리 기본값을 자동 적용하므로 불필요했음). 새 상태 `aiStayError`로 실패를 화면에 알림.
- 9개 로케일에 `aiSuggestError` 키 추가, `app.css`에 `.route-ai-suggest-error`.

**✅ 브라우저 실동작 확인 완료 (Playwright, 2026-09-04):** `npm install --no-save playwright`로 설치(프로젝트에 안 남음, `.pw-scratch/`는 `.gitignore`에 추가돼 있음). user1@mail.com 목업 계정 → 기존 "춘천여행" 트립에서 확인:
- Preview 줄 정상 분리 표시(§3-2와 함께 확인)
- AI 버튼 처음부터 비활성, 체류시간 입력창 바로 편집 가능
- 버튼 1회 클릭 → 네트워크 로그로 `route-stay-suggest` 호출이 **정확히 1회**만 발생(두 번 눌러야 하던 문제 해소 확인)
- 이 클릭이 마침 §1-1의 Anthropic 크레딧 소진과 겹쳐 **실전 실패를 그대로 재현** — `aiStayError` 안내 문구가 정확히 뜨고 버튼이 active로 안 바뀌는 것까지 확인됨

### 3-4. ④ "핀 순서" 모드에서 동선 패널 드래그 재정렬

**문제:** `RouteOptionsPanel`의 체류시간 목록(번호 붙은 카드)에는 드래그 재정렬이 전혀 없었다(`DndContext` 0건). 순서를 바꾸려면 다른 탭(핀 탭, `PinupBar`)으로 가서 드래그해야 했다.

**핵심 판단:** `preview.stops`(카드 목록의 실제 소스)는 `options.autoOrder === true`(자동 모드)일 때 최근접이웃 알고리즘으로 매번 재계산되므로 **드래그해도 다음 렌더에서 그대로 되돌아간다** — 드래그는 `autoOrder === false`(핀 순서 모드)일 때만 의미가 있다. 이때는 `preview.stops` 순서가 `pinned` 배열 순서와 정확히 1:1이라, 카드 드래그 결과를 그대로 `pinned` 재배열에 반영하면 된다.

**변경한 파일:**
- `src/components/Sortable.tsx` — **선행 버그 수정**: `SortableContainer`가 `onReorder` 없으면 조기 `return` 한 뒤에 `useSensors`/`useSensor`를 호출하고 있었다. `onReorder`가 같은 컴포넌트 인스턴스에서 런타임에 생겼다 사라졌다 하면(이번 기능처럼 자동/핀 순서 토글로 바뀜) 훅 호출 순서가 렌더마다 달라져 React가 깨진다. 훅 호출을 조기 return보다 앞으로 옮김. 기존 사용처(`AdminLandingPage.tsx` 이미지 재정렬)는 `onReorder`가 항상 고정값이라 영향 없음.
- `src/components/RouteOptionsPanel.tsx` — `onReorderPins?: (next: PinnedPlace[]) => void` prop 추가. `canReorderStops = !options.autoOrder && !hoursOnly && Boolean(onReorderPins)`(영업시간 필터가 켜져 있으면 카드 목록이 전체의 부분집합이라 드래그 결과를 원배열에 정확히 되꽂을 수 없어 그때도 끔). 번호 배지를 `canReorderStops`일 때만 `<button>`(드래그 핸들, `SortableItem`의 `listeners`/`setActivatorNodeRef` 연결)으로, 아니면 기존처럼 `<span>`으로 렌더링 — 카드 본문은 그대로 두고 배지만 갈아끼운다. `SortableContainer`/`SortableItem`(`./Sortable`)을 재사용해 `PinupBar`와 별도로 `@dnd-kit`을 다시 끌어오지 않음. 드래그 종료 시 `orderedIds: string[]`를 받아 `pinned` 배열에서 id로 다시 찾아 `PinnedPlace[]`로 복원 후 `onReorderPins` 호출.
- `src/pages/PlannerPage.tsx` — 새 핸들러 `handleReorderRoutePins`. **주의:** 동선 패널에 전달되는 `pinned` prop은 실은 `routePins`(핀 탭에서 일부만 선택했을 때는 그 부분집합)라서, 받은 새 순서를 그대로 `setPinnedForDay`에 넘기면 선택 안 된 핀들이 날아간다. 그래서 전체 `pinned` 배열을 순회하며 "보였던 자리"에만 새 순서를 순서대로 끼워 넣고, 안 보였던 핀은 원래 자리 그대로 둔다. 두 `RouteOptionsPanel` 호출부(데스크톱·모바일 시트) 모두에 `onReorderPins={handleReorderRoutePins}` 연결.
- `src/styles/app.css` — `.route-stay-drag`(버튼 리셋 + `cursor: grab`/`grabbing`, `PinupBar`의 `.chip-drag`와 같은 관례).
- 새 로케일 키는 만들지 않았다 — 기존 `route.dragReorder`("드래그하여 순서 변경" 등, `RouteSummary.tsx`에서 이미 쓰던 범용 aria-label)를 그대로 재사용.

**✅ 브라우저 실동작 확인 완료 (Playwright):** 이미 핀 순서 모드로 저장돼 있던 "춘천여행" 트립에서 확인 — 드래그 핸들 7개(스톱 수만큼) 렌더, 첫 카드를 세 번째 자리로 드래그 → 목록이 실제로 재정렬(앙그렐라→피자체스→넘버25호텔 순으로 바뀜, Preview 줄도 "7.7km·18분"→"9km·22분"으로 재계산됨). **자동 모드로 전환하면 드래그 핸들이 정확히 0개로 사라지고, 다시 전환해도 콘솔·페이지 에러 없음**(Sortable.tsx 훅 순서 수정이 실제로 유효함을 확인).

### 3-5. ⑤ 날짜 비우면 영업시간 검증이 조용히 꺼지는 문제

**문제:** `annotateOpeningHours()`(`planner.ts:140-155`)는 `options.date`가 비어 있으면 조용히 요일(`weekday`)을 `null`로 두고 계속 진행한다 — 에러도, 스킵 표시도 없다. 그 결과 특정 요일에만 쉬는 곳의 휴무일 체크가 통째로 빠지거나, 요일별로만 영업시간이 정의된 곳은 상태가 `unknown`이 되는데, `isHoursProblem()`이 `unknown`을 문제로 안 치므로 경고가 하나도 안 뜬다. 정상(문제없음)과 검증이 꺼진 상태가 화면에서 **똑같이** "조용함"으로 보이는 게 핵심 문제였다.

**왜 "오늘 날짜로 자동 채우기"를 하지 않았나:** `Trip`에는 시작일(달력 기준일) 개념이 아예 없다(`totalDays`=일수, `currentDay`=몇 일차라는 인덱스만 있음). 그래서 "오늘"로 채우면 다음 달에 갈 3일차 일정인데 "오늘의 요일" 기준으로 확인해버려 **자신 있게 틀린 답**을 낼 수 있다 — 조용히 꺼져 있는 것보다 나쁘다. 시작일을 추가해 일차별로 날짜를 역산하는 건 `Trip` 스키마 변경(+마이그레이션)이 필요한 별도 작업이라 이번 범위 밖으로 뒀다.

**해법:** 날짜를 추측하는 대신, **꺼져 있다는 사실 자체를 화면에 드러냈다.** `options.date`가 비어 있으면 날짜 입력 바로 아래에 상시 노출되는 안내를 추가(기존 `dateHint`는 마우스 오버 툴팁이라 놓치기 쉬웠다).

**변경한 파일:**
- `RouteOptionsPanel.tsx` — `route-depart-row` 아래에 `!options.date`일 때만 보이는 `<p className="route-date-missing-hint">` 추가
- `app.css` — `.route-date-missing-hint`(기존 `.route-stay-hours-warning`과 같은 호박색 경고 스타일 재사용)
- 9개 로케일에 `route.options.dateMissingNotice` 키 추가(예: ko "날짜를 입력하지 않아 휴무일·영업시간 확인이 꺼져 있어요")

**✅ 브라우저 실동작 확인 완료 (Playwright):** 날짜 필드를 비우자 안내 문구가 정확히 뜨고, 날짜를 채우자 사라짐. 콘솔·페이지 에러 없음.

### 3-6. 🔴 DEPART 출발 줄(시간·날짜·출발지 칩)이 좁은 폭에서 깨지던 문제

사용자가 모바일 스크린샷으로 신고. 원인은 `.route-depart-row`가 시간·날짜·출발지 3개 칩을 `flex:1`/`1.55`로 균등 3분할 + `min-width:0`으로 강제 축소만 하고 **줄바꿈이 없었던** 것 — 좁은 폭에서 네이티브 날짜 입력이 "연도. 월"처럼 잘리고 출발지 주소가 "현.."으로 잘렸다. **이 버그는 모바일뿐 아니라 데스크톱 임베드 사이드바(~340px 폭)에도 이미 있었다** — 이번 세션 초반 스크린샷(`03-route-tab.png` 등)에도 "mm/dd/y", "강.." 같은 잘림이 그대로 찍혀 있었는데 다른 걸 보느라 놓쳤었다.

**해법:** `app.css` — `.route-depart-row`에 `flex-wrap: wrap` 추가, 시간/날짜 칩은 `flex: 1 1 128px`로 나란히 배치, 출발지 칩만 `flex: 1 1 100%`로 강제해 항상 자기 줄을 차지하게 함(flex-wrap과 조합하는 표준 줄바꿈 트릭). 결과: 좁은 폭에서는 [시간|날짜] 한 줄 + [출발지] 한 줄, 넓은 폭에서는 셋 다 시원하게 표시.

**✅ 브라우저 확인 완료 (Playwright, 모바일 390px·데스크톱 1280px 둘 다):** 시간 "09:00 AM", 날짜 "mm/dd/yyyy", 출발지 "강원특별자치도 춘천시 한림대학길 1" 전부 안 잘리고 완전히 표시됨.

### 3-7. 방문 날짜(`options.date`) 필드 자체를 제거 — 사용자 판단으로 기능 축소

바로 위 3-6을 고치고 나서 사용자가 "동선짜기에 출발일시가 필요할까? 더 복잡해지는 것 같다"고 재검토를 요청했다. 조사 결과를 보고하고 **"날짜 필드 자체를 삭제(가장 간단)"로 사용자가 직접 결정**했다.

**조사 결과 (보고한 내용):**
- **출발시간(`departTime`)은 필수** — 하루 일정 전체(도착·출발·체류 시각, 식사시간 반영, 예약 고정)의 계산 기준점이라 없앨 수 없다.
- **날짜(`date`)는 용도가 딱 하나** — "매주 O요일 휴무" 같은 요일별 정기휴무 감지. `checkVisitWindow`/`intervalsForDay`를 직접 확인해보니 "오픈 전"/"영업 종료" 같은 흔한 케이스(요일 상관없이 매일 같은 시간)는 **날짜 없이도 이미 정상 동작**하고 있었다 — 날짜가 막던 건 정기휴무 요일 감지뿐.
- 트립에 "여행 시작일" 개념 자체가 없어 일차별로 자동 계산할 방법이 없었고, 그래서 매번 손으로 입력해야 했다 — 안 넣으면 조용히 꺼지는 게 바로 3-5에서 고쳤던 버그. "번거로운데 얻는 건 좁다"는 것이 사용자 판단의 근거였다.

**제거한 것:**
1. `src/types/index.ts` — `RouteOptions.date` 필드 삭제
2. `src/components/RouteOptionsPanel.tsx` — 날짜 입력 칩(`<input type="date">`), 3-5에서 만든 "날짜 미설정" 안내 문구 삭제
3. `src/lib/planner.ts` — `annotateOpeningHours()`에서 `date`/`weekdayFromDate` 인자 제거, 항상 요일 없이 판정
4. `src/lib/openingHours.ts` — 요일 관련 기계 전체 정리:
   - `checkVisitWindow`에서 `weekday` 파라미터와 `closedDays` 검사 분기 삭제(더는 호출할 수 있는 경로가 없어 진짜 죽은 코드였다)
   - `weekdayFromDate()` 함수 삭제(유일한 호출부가 없어짐)
   - `NormalizedHours.closedDays` 필드와 그걸 채우던 `restDateText` 파싱 로직 삭제(오직 `closedDays`만을 위한 코드였다)
   - `VisitHoursStatus`에서 이제 나올 수 없는 `'offday'` 삭제, `isHoursProblem()`에서도 제거
   - 요일별 영업시간 구간(`byDay[특정 요일]`) 파싱 자체는 그대로 뒀다 — 요일을 몰라도 `EVERY_DAY` 구간과 구분해 저장해 두는 게 맞다. 여기를 `EVERY_DAY`로 합쳐버리면 실제로 쉬는 요일에 "영업중"이라고 잘못 확신하게 된다(이 파일 설계 철학: 모르면 unknown이 틀린 open보다 낫다).
5. 9개 로케일에서 `route.options.date`/`dateHint`/`dateMissingNotice`, `route.hours.offday` 키 삭제. (주의: `common.json`의 `offday` 키는 **건드리지 않았다** — 그건 검색결과·장소상세에 쓰는 완전히 별개의 실시간 영업상태 시스템(`openHoursStatus.ts`)이 쓰는 키라 이름만 같다.)

**✅ 브라우저 확인 완료 (Playwright, 모바일·데스크톱):** 날짜 입력창 0개, 미설정 안내 0개, 콘솔·페이지 에러 없음. DEPART 줄이 시간+출발지 두 칩만으로 자연스럽게 표시됨.

`tsc --noEmit`·`npm run build` 클린.

---

## 4. 플래너 검색·상세보기 UX (2026-09-05)

사용자가 화면 스크린샷으로 하나씩 지시한 건들. 전부 완료했고 **매 건 Playwright로 실제 화면을 열어 확인**했다. 검증 스크립트는 세션 스크래치패드에 있었을 뿐 저장소에는 남기지 않았다 — 재현이 필요하면 §7의 방식으로 다시 만들면 된다.

### 4-1. 장소 상세를 지도 옆에 도킹

**요구:** 검색 칩을 누르면 상세 모달을 좌측 패널 **바로 오른쪽에 붙이고**, 배경 암전 없이, 그 장소를 지도에 표시하고 적당히 자동 확대.

- `app.css` — `.wayknit-root:not(.mobile-layout) .photos-overlay`에서 암전 제거 + `pointer-events: none`(지도를 계속 조작할 수 있게). 모바일은 기존 전체화면 모달 그대로.
- `mapZoom.ts` — `KAKAO_LEVEL_PLACE_FOCUS = 4`(≈100m). **이미 그보다 확대돼 있으면 축척을 건드리지 않는다** — 사용자가 맞춰둔 화면을 상세 열 때마다 되돌리면 성가시다.
- `PlannerPage.tsx` — `mapLevelTick`(같은 레벨을 다시 지정해도 지도에 반영되게 하는 신호), `handleOpenPlacePhotos`에서 선택·중심·확대를 함께 처리.

### 4-2. 마커를 "남은 지도 영역"의 한가운데로

**요구:** 지도 전체의 중앙이 아니라, 상세 모달이 가리고 남은 오른쪽 영역의 중앙에 표시.

- `PlannerPage.tsx`의 `occludedCenterShiftPx()` — 좌측 패널 + 상세 패널이 가린 폭을 **런타임에 측정**해(`.photos-panel`의 실제 width) 남은 영역 중앙까지의 픽셀 오프셋을 낸다. 상세 폭이 바뀌어도 자동으로 따라간다.
- `MapView.tsx` / `GoogleMapView.tsx` — `centerOffsetX` prop. 투영(projection)으로 "offset만큼 왼쪽 지점"의 좌표를 구해 그것을 중심으로 삼는다.

**⚠️ 이 작업에서 걸린 함정 두 가지 — 다시 만지게 되면 반드시 볼 것:**

1. **`panBy`를 쓰면 안 된다.** 상대 이동인 데다 애니메이션이라 `setCenter`와 겹치면 이동량이 누적된다(실제로 4배까지 밀려 화면 밖으로 나갔다). 투영으로 좌표를 계산하면 동기 계산이라 몇 번을 실행해도 결과가 같다.
2. **중심 이펙트가 줌 이펙트보다 먼저 실행된다.** 그래서 `getZoom()`을 읽으면 **확대 전** 축척이 잡히고, 그 축척으로 픽셀을 환산하면 수백 km 밀린다. 곧 적용될 **목표** 줌(`kakaoLevelToGoogleZoom(level)`)으로 계산하고, 카카오는 투영 계산 전에 `setLevel(level)`을 먼저 부른다. 두 이펙트 deps에 `level`을 넣어야 한다.

**디버깅 교훈:** 세 가지 다른 구현을 넣었는데 측정값이 **정확히 2556으로 똑같이** 나왔다. 그 불변성이 코드가 아니라 *측정*이 깨졌다는 단서였다 — Playwright 셀렉터를 `.place-thumb`(존재하지 않음)로 썼고 실제 클래스는 `.result-thumb`였다. 값이 변하지 않으면 먼저 계측을 의심할 것.

### 4-3. 상세 모달 크기·세로 위치

- 크기는 **원래 모달 그대로(680×720)**. 도킹 규칙에서는 위치만 바꾸고, 좌측 패널이 차지한 만큼만 `min()`으로 줄인다. 기본 규칙의 `min-height: 720px`가 세로를 고정하지 않도록 `min-height: 0`으로 푼다.
- 세로는 **앱바 아래 남은 공간의 한가운데**: `position: fixed` + `top`/`bottom` + `margin-block: auto`.

### 4-4. 🔴 라이트박스 닫기가 로그아웃을 눌렀던 문제

사진 확대(라이트박스)에서 우상단 닫기를 누르면 **로그인 화면으로 튕겨나갔다.**

**원인:** 라이트박스(`.photo-lightbox`)도 `.photos-overlay`의 자식인데, 4-1에서 넣은 `pointer-events: none`을 `.photos-panel`에만 되돌려놔서 라이트박스 안의 모든 클릭이 뒤쪽 앱바로 통과했다. 그 좌표가 정확히 로그아웃 버튼 자리였다.

**해법:** `app.css` — 오버레이의 **모든 자식**이 클릭을 되받도록 `> *` 규칙. 오버레이에 `pointer-events: none`을 걸 때는 자식 전부를 되돌려야 한다.

같이 발견한 기존 버그: 라이트박스를 닫으면 상세 패널까지 같이 닫혔다(클릭이 오버레이의 `onClick={onClose}`까지 버블링). `PlacePhotosModal.tsx`에서 `stopPropagation()`.

### 4-5. 🔴 핀 선택이 검색 결과 마커를 지우던 문제

핀 탭에서 칩을 하나라도 선택하면 **검색 결과 아이콘이 지도에 하나도 안 떴다.**

**원인:** `MapView.tsx` / `GoogleMapView.tsx` 양쪽에 `const resultsForMarkers = pinSelectionActive ? [] : searchResults;`. 핀 선택은 "어떤 **핀**을 볼지"만 정해야 하는데 검색 결과까지 통째로 버리고 있었다.

**해법:** 두 파일 모두 `searchResults`를 그대로 쓴다. 핀 필터링(`visiblePinned`)은 그대로 유지.

같이 고친 것: `PlannerPage.tsx`의 이펙트가 "선택된 핀에 없는 모든 말풍선"을 닫고 있어서, 마커를 살려놔도 검색 결과를 클릭하면 말풍선이 즉시 닫혔다. 이제 **핀 목록에 있는 장소**의 말풍선만 닫는다.

### 4-6. 다른 장소를 고르면 앞선 상세보기 닫기

`PlannerPage.tsx`의 `closeStalePlaceDetail()`을 검색 결과 카드 선택과 지도 핀 마커 클릭 양쪽에 연결. **다른** 장소일 때만 닫고 같은 장소를 다시 누르면 유지한다.

### 4-7. 협업 초대 → 로그인창 이메일 자동입력

**요구:** 초대받은 사람이 초대에 응해 로그인 화면으로 넘어갈 때 그 이메일이 미리 채워져 있게.

**제약:** `get_trip_invite_preview()`가 `mask_email()`로 가려서 내려주고(`qhc***@daum.net`) 이 함수는 `anon`에게도 열려 있어, 클라이언트는 실제 주소를 알 수 없다.

**해법 (DB 변경 없음):** 초대 링크가 이메일을 실어 나른다. 소유자 화면은 초대 목록에서 실제 주소를 이미 갖고 있다.
- `trips.ts` — `buildInviteLink(inviteId, email?)`이 `&email=`을 붙임
- `CollaboratorsModal.tsx` — 링크 복사 시 그 초대의 이메일 전달
- `InviteBanner.tsx` — `/login?invite=..&email=..`로 이어 보내고, 배너를 닫으면 주소창에서 `email`도 함께 제거
- `LoginPage.tsx` — `email` 쿼리로 입력창 초기값

**남는 것:** 주소가 URL에 실리므로 브라우저 기록·전달 경로에는 남는다(링크를 가진 사람은 곧 초대받은 본인이라 새로 드러나는 정보는 없다). DB 마스킹은 그대로 두었으므로 **anon RPC로는 여전히 실제 주소를 읽을 수 없다.** 이 변경 **이전에 복사해 나간 링크**에는 `email`이 없어 자동입력이 안 된다.

---

## 5. 실시간 공동편집 — A안 진행 중 (1·2·3단계 완료)

사용자 질문: "협업초대를 해서 초대받은 사람이 로그인하면 실시간으로 핀업 상태를 공유할 수 있나? 초대받은 사람이 핀업하면 초대한 사람의 여행에 추가되고 로그를 남기는 것. 협업하면 그때부터 로깅·핀업·동선이 공유되는 것."

**결론: 가능하다. 기반이 이미 많이 깔려 있고, 진짜 일은 "실시간"이 아니라 "충돌 처리"다.**

### 5-1. 이미 되어 있는 것 (2026-09-05 확인)

| 항목 | 상태 |
|---|---|
| 협업자 쓰기 권한 | ✅ `20260901000000` — `owner_update` 정책이 `is_trip_editor(id)` 허용 |
| 협업자 자동저장 | ✅ `PlannerPage.tsx`의 700ms 디바운스 저장, `viewer`만 차단 |
| Realtime 채널 | ✅ `tripPresence.ts` presence 채널 가동 중 |
| `wayknit_trips` 실시간 구독 | ✅ 이미 `supabase_realtime` publication에 포함 (DB에서 직접 확인) |

즉 **초대받은 사람이 핀업하면 이미 소유자 여행에 저장은 된다.** 새로고침하면 보인다.

### 5-2. 지금 이대로 켜면 깨지는 것 — 핵심 문제

`trips.ts`의 `writeRemote`는 여행 전체를 `payload` jsonb **한 덩어리로 upsert**한다.

```
A가 핀 추가 → payload 통째 저장
B가 핀 추가 → payload 통째 저장 (A의 핀이 없는 자기 사본으로)
결과: A의 핀 소멸
```

700ms 디바운스라 몇 초 안에 발생한다. 실시간 공유의 전제 조건은 이 last-write-wins를 없애는 것.

### 5-2-1. ✅ 1단계 완료 (2026-09-06) — 핀을 행으로 분리

**사용자가 A안(정규화)을 선택**해 착수, 1단계 완료.

**스키마** — `supabase/migrations/20260906130000_trip_pins.sql` (원격 적용 완료)
`trip_pins(trip_id, day, place_id, position, data jsonb, created_by, updated_by, ...)`,
PK는 자연키 `(trip_id, day, place_id)`. 앱이 이미 같은 날 같은 장소를 `p.id === place.id`로
중복 판정하고 있어(`handleTogglePin`) 이 조합이 유일하다는 걸 확인하고 잡았다.

**이전 결과 검증:** payload 핀 252개 → 행 252개, **누락 0**, 중복 0, 일차별 `position` 1..n 무결성 위반 0건.

**충돌이 사라지는 원리 — 기준점이 핵심이다.** 저장할 때 원격 DB의 현재 상태와 비교하면 안 된다.
상대가 방금 추가한 핀이 "내가 지운 것"으로 보여 그대로 지워진다. 대신
**이 클라이언트가 마지막으로 동기화한 상태**(`pinBaselines`, trips.ts 모듈 레벨 Map)와 비교해
*내가 실제로 한 행동*만 행 단위로 반영한다. 내가 모르는 상대 핀은 diff에 안 잡히므로 손대지 않는다.

**운 좋았던 점:** 핀 변경이 `PlannerPage.setPinnedForDay` **한 곳으로 모여 있어서**(호출부 10개가
전부 이 함수를 거친다) PlannerPage를 거의 건드리지 않고 `trips.ts`의 저장 계층만 바꿔 끝났다.

**바뀐 파일:** `src/lib/trips.ts` — `readPinsRemote`/`readPinsForTrips`/`attachPins`/`syncPins` 추가,
`writeRemote`의 payload에서 `pinnedByDay` 제거, 읽기 경로 3곳(`readRemoteById`·`readRemoteLatest`·
`readBySlugRemote`)에 `attachPins` 연결.

**⚠️ payload는 지우지 않았다.** `payload.pinnedByDay`는 이전 시점 값 그대로 **롤백용 백업**으로 남아 있다.
읽기는 `trip_pins`만 본다 — payload로 폴백하면 사용자가 핀을 전부 지웠을 때 옛 백업이 되살아난다.
**롤백하려면** `trip_pins`를 drop하고 `writeRemote`에 `pinnedByDay`를 되돌리면 이전 시점으로 복귀한다
(그 사이 변경분은 잃는다).

**공유마당도 같이 고쳤다** — `rowToPlazaListing`이 payload를 읽고 있어서 그대로 두면 목록의 핀이
이전 시점에 멈춘다. `readPinsForTrips`로 **한 번의 질의**에 붙인다(건별 조회는 N+1).

**RLS 검증 완료:** SELECT는 부모 여행 가시성에 위임(`exists (select 1 from wayknit_trips ...)`)해
정책이 추가돼도 자동으로 따라온다. 쓰기는 `is_trip_owner`/`is_trip_editor`만 — 서브쿼리를 쓰면
공개 여행까지 통과해버리므로 여기선 security definer 헬퍼를 써야 한다.
실측: anon이 읽는 핀 151개 = 공개·마당등록 여행 35건의 핀과 정확히 일치, 비공개 101개는 차단,
anon INSERT는 `42501` 거부.

**알아둘 한계 (1단계 범위):**
- **순서 충돌은 나중 쓰기가 이긴다** — 두 사람이 동시에 재정렬하면 순서만 어긋난다. 핀은 안 사라진다.
- **오프라인 편집 후 삭제는 원격에 반영 안 됨** — 로컬에서만 연 여행은 기준점이 없어 `{}`로 시작하므로
  전부 insert만 하고 삭제는 하지 않는다. 데이터를 잃지 않는 쪽으로 의도한 것이다.
- **`routeOptionsByDay`·`generatedRouteByDay`·`materials`는 아직 payload 통짜 저장**이라 동시 편집 시
  덮어써진다. 핀처럼 사라지는 게 아니라 재생성하면 되는 데이터라 1단계 범위 밖으로 뒀다.
- **아직 실시간이 아니다.** 상대 변경을 보려면 새로고침해야 한다 — 그게 2단계다.
  (`trip_pins`는 이미 `supabase_realtime` publication에 넣어뒀다.)

### 5-2-2. ✅ 2단계 완료 (2026-09-06) — 실시간 반영

새로고침 없이 상대 편집이 화면에 뜬다. `trip_pins`를 `postgres_changes`로 구독한다.

**그냥 덮어쓰면 안 된다 — 3-way 병합이 필요하다.** 원격 변경 알림이 왔을 때 원격 상태로
화면을 갈아끼우면, 아직 저장 전(700ms 디바운스 안)인 내 편집이 사라진다. 그래서:

```
기준점(마지막 동기화) ── 내 미저장 편집 ──▶ 지금 화면
       │
       └── 상대 편집 ──▶ 방금 읽은 원격      병합 = 원격 + 내 미저장 편집
```

병합 뒤 **기준점을 "방금 읽은 원격"으로 옮긴다.** 그러면 다음 저장 때 `syncPins`의 diff가
정확히 내 미저장 편집만 집어낸다. 1단계의 기준점 구조를 그대로 재사용한 것이다.

**바뀐 파일:** `src/lib/trips.ts` — `subscribeTripPins`/`pendingPinEdits`/`applyPendingEdits`/
`samePinnedByDay` 추가. `src/pages/PlannerPage.tsx` — 구독 이펙트 하나(핀 상태는 `pinnedRef`로
넘겨 구독을 매 렌더 다시 걸지 않는다).

**설계에서 조심한 것:**
- **에코로 인한 무한 저장 루프.** 내 저장이 realtime으로 되돌아오면 병합 결과가 화면과 같다 —
  `samePinnedByDay`로 같으면 `setTrip`을 아예 호출하지 않는다. 호출하면 자동저장 이펙트가
  깨어나 저장 → 에코 → 저장이 돈다. 실측으로 정지 10초간 추가 쓰기 요청 **0건** 확인.
- **병합 시 `updatedAt`을 건드리지 않는다.** 갱신하면 같은 이유로 저장 루프가 생긴다.
- **순서**는 내 화면 순서를 기준으로 하고, 내가 모르던 상대 핀은 뒤에 붙인다.
- 한 번의 저장이 여러 행을 건드리면 이벤트도 여러 개 오므로 **350ms 몰아서** 한 번만 읽는다.

**브라우저 2개로 실검증 (2026-09-06, 사용자가 이번 한 번만 자체 검증을 요청):**

| 검증 | 결과 |
|---|---|
| A 삭제 → B에 전파 | ✅ 2초 |
| B 삭제 → A에 전파 (반대 방향) | ✅ 2초 |
| A가 검색해서 핀업 → B 화면에 추가 | ✅ 1초 |
| 거의 동시에 A·B가 서로 다른 핀 삭제 | ✅ 둘 다 반영, 두 화면 수렴 |
| 정지 10초간 추가 쓰기 요청 | ✅ 0건 (루프 없음) |

**남은 것:** 3단계(활동 로그 — 누가 무엇을 했는지), 4단계(presence 아바타를 협업자 있을 때도
켜기 + "누가 넣은 핀인지" 표시). `trip_pins.created_by`/`updated_by`는 이미 채워지고 있어
4단계의 재료는 준비돼 있다.

**아직 payload 통짜 저장인 것:** `routeOptionsByDay`·`generatedRouteByDay`·`materials`.
동시 편집 시 덮어써진다 — 핀처럼 사라지는 게 아니라 재생성하면 되는 데이터라 뒤로 미뤘다.

### 5-2-3. ✅ 3단계 완료 (2026-09-06) — 활동 로그

협업자 모달에 **"사람 / 활동" 탭**을 넣었다. 누가 언제 무엇을 했는지 보인다.

**기록 방식이 둘로 갈린다 — 이유가 있다.**
- **핀 변경은 DB 트리거**(`trip_pins_activity`). §2-3 감사 로그와 같은 판단이다 — 호출부마다
  로깅을 넣으면 새 경로가 생길 때 빠뜨린다. 특히 2단계의 실시간 병합처럼 우회 경로가 늘면 더 그렇다.
- **동선 생성·일차 추가는 클라이언트가 RPC**(`log_trip_activity`)로 직접. `wayknit_trips`에
  트리거를 달면 **700ms 자동저장이 로그를 뒤덮는다** — §2-5에서 같은 이유로 그 테이블을
  감사 대상에서 뺐다. RPC는 SECURITY DEFINER라 **함수 안에서 권한을 직접 확인**하고,
  호출자가 아무 action이나 심지 못하게 **화이트리스트**로 막는다.

**트리거의 UPDATE 분류 (실측 검증됨):**

| 변경 | 분류 | 검증 |
|---|---|---|
| `position`만 바뀜 | `pin_reorder` | 6건 ✅ |
| `data` 내용이 바뀜 | `pin_update` | 1건 ✅ |
| 아무것도 안 바뀜 | **기록 안 함** | 0건 ✅ |

**재정렬 로그 도배 문제.** 재정렬 한 번이 핀 개수만큼 UPDATE를 만들어 로그가 도배된다.
`listTripActivity`가 **같은 사람의 연속된 `pin_reorder`를 1분 창으로 묶어서** 내려준다
("순서 변경 (5건)"). **연속된 것만** 묶는다 — 중간에 다른 행동이 끼면 나뉜다.
추가·삭제는 어떤 장소였는지가 정보라서 묶지 않는다.

**RLS:** 조회는 소유자·협업자만. **공개 여행이라도 활동 이력은 공개하지 않는다** —
누가 언제 편집했는지는 열람자에게 줄 정보가 아니라, `trip_pins`처럼 부모 가시성에
위임하지 않고 소유·협업으로 좁혔다. INSERT/UPDATE/DELETE 정책은 **일부러 안 만들었다**(append-only,
자기 흔적을 못 지운다). 실측: anon 조회 0건, anon INSERT `42501` 거부.

**만든 파일:** `supabase/migrations/20260906140000_trip_activity.sql`(원격 적용 완료),
`src/lib/tripActivity.ts`. **고친 파일:** `CollaboratorsModal.tsx`(탭 + `ActivityList`),
`PlannerPage.tsx`(동선 생성·일차 추가 기록), `app.css`, 9개 로케일 `share.json`.

**검증 중 잡은 것 둘:**
1. **"나님이 …" 조사 깨짐.** 한국어는 이름 뒤에 조사를 붙이면 "나님이"가 된다 —
   템플릿을 로그 줄처럼 `{{actor}} · {{target}} 추가` 구분자 형식으로 바꿨다.
2. **작성자 불명이 "나"로 보이던 문제.** `actorLabel`이 null을 두 뜻으로 썼다(=나 / =모름).
   `actorKind`로 `self`·`system`·`other`를 명시적으로 구분했다. 안 고쳤으면
   **남이 남긴 기록이 "나"로 보인다.**

**남은 것 — 4단계(UX):** presence 아바타를 `isPublic`일 때만 켜는 걸 협업자 있을 때도 켜기
(`PlannerAppBar.tsx`) + "누가 넣은 핀인지" 표시. `trip_pins.created_by`/`updated_by`가
이미 채워지고 있어 재료는 준비돼 있다.

### 5-3. 단계 계획

**0단계 — 충돌 재현 (반나절).** 브라우저 2개로 핀이 실제로 사라지는지 확인. 이후 모든 단계의 회귀 기준.

**1단계 — 저장 단위 분리 (3~5일). 가장 큰 결정이고 사용자 선택이 필요하다.**
- **A안: `trip_pins` 테이블로 정규화.** 핀 1개 = 행 1개. 동시 편집이 구조적으로 안전하고 실시간도 핀 단위로 가벼워진다. 읽기/쓰기 경로 전면 수정 + 기존 여행 데이터 이전.
- **B안: payload 유지 + 병합.** `updated_at` 낙관적 잠금 + 핀 id 단위 3-way merge. 작업량은 작지만 병합 규칙이 미묘해 버그가 잘 숨는다.
- **A안 권장** — 2·3단계가 전부 그 위에 얹힌다.

**2단계 — 실시간 반영 (2일).** A안이면 `postgres_changes`로 핀 행만 구독(B안이면 broadcast 핑 + 재조회). 자기 변경 에코 무시, 원격 변경 시 로컬 미저장 편집 보존.

**3단계 — 활동 로그 (2일).** 새 테이블 `trip_activity(trip_id, actor_id, actor_email, action, target, detail jsonb, created_at)`. `action`: `pin_add`/`pin_remove`/`pin_reorder`/`route_generate`/`day_add`. RLS는 그 여행의 owner+collaborator만 조회. UI는 협업자 모달의 "활동" 탭.

**4단계 — UX (1~2일).** presence 아바타는 이미 만들어 뒀는데 `PlannerAppBar.tsx`에서 `isPublic`일 때만 켠다 — 협업자가 있을 때도 켜면 된다. 여기에 "누가 넣은 핀인지" 표시를 더한다.

### 5-4. 착수 전 결정·확인 사항

1. **공유 DB다.** 같은 Supabase 프로젝트에 `hrsupport`, `volmgnr`, `locban` 등 다른 앱 테이블이 함께 있다(publication 조회로 확인). 1·3단계 마이그레이션은 §1-2 절차 + 사용자 승인 필요.
2. **A안은 데이터 이전을 동반한다** — 기존 여행의 `payload.pinnedByDay` → 행. 롤백 절차를 같이 준비할 것.
3. **로컬 우선 저장 구조**(`tripsRepo.save`는 `writeLocal` → `writeRemote` 순)와 협업의 정합성 — 협업 중 오프라인 편집을 어떻게 다룰지.

---

## 6. 모바일 UX 감사·개선 (2026-09-06)

### 6-0. 배경

사용자 요청: "모바일화면을 직접 접속해서 현재 각 부분별 기능작동 정상여부 확인하고 사용자 입장에서 불편한점 또는 필요한점 분석해줘 그리고 ... 작은화면에서 비효율적인 기능은 뭐가 있는지 목록도 같이 분석해줘".

모바일 뷰포트(375×812)로 전 구간을 직접 눌러본 뒤 보고했고, 사용자가 개선계획을 승인해 **5단계로 나눠 진행·전부 완료.** 각 단계는 사용자가 직접 확인하고 컨펌했다.

**감사 결과 정상 동작 확인:** 로그인 / 지도·핀 목록 / 검색 / 장소 상세(사진) 모달 / 핀 목록 탭 / 동선 탭 / 내 여행 전환·삭제.

### 6-1. ① 더보기(⋯) 버튼이 위성지도 토글에 가려져 눌리지 않던 문제 — 완료

가장 심각했던 건. 모바일에서 `공유·시나리오·설정·도움말` 4개 기능이 **전부 접근 불가**였다.

- 원인: `.wayknit-root.mobile-layout .map-type-toggle`의 `top:16px; right:16px`이 상단 바 오른쪽 끝의 더보기 버튼과 겹쳤다(측정: 더보기 `317,15,44×44` / 위성 `319,16,40×40`). 위성 토글의 `z-index:40`이 상단 바(`z-index:25`)보다 높아 탭을 전부 가로챘다.
- 그 CSS의 원래 주석은 "모바일은 앱바가 따로 없이 지도가 화면 최상단부터 시작"이었다 — **그 전제가 깨진 뒤에도 좌표가 그대로 남아 있었던 것.** 나중에 상단 바 좌표를 바꿀 때 이 버튼도 같이 봐야 한다.
- 수정: `app.css` — 위성 토글을 상단 바(검색 줄 + 날짜 탭) 아래인 `top:108px`으로 내림.

### 6-2. ② 랜딩 `landing_promo` 400 에러 — 코드는 완료, **DB 적용은 사용자 몫**

랜딩 방문마다 API가 400을 뱉어 CMS 콘텐츠가 **한 번도 반영된 적이 없었다**(항상 하드코딩 폴백). 관리자 저장도 같이 깨져 있었다.

- 원인: 원격 DB에 `is_published`·`block_order` 컬럼 없음(§1-2). 나머지 16개 컬럼은 정상.
- 확인 방법(다른 테이블 드리프트 의심될 때 재사용):
  ```bash
  set -a; . ./.env.local; set +a
  K="${VITE_SUPABASE_ANON_KEY:-$VITE_SUPABASE_KEY}"
  curl -s "$VITE_SUPABASE_URL/rest/v1/landing_promo?select=*&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K"
  ```
  없는 컬럼을 `select`에 넣으면 `42703 column ... does not exist`로 바로 잡힌다.
- 적용할 SQL(= 로컬 `supabase/migrations/20260817110000_landing_promo_order.sql`). 대시보드 SQL 에디터에서 실행:
  ```sql
  alter table public.landing_promo
    add column if not exists is_published boolean not null default false;
  alter table public.landing_promo
    add column if not exists block_order jsonb not null default '["notice","copy","video","images"]'::jsonb;
  ```
- **주의:** 새 컬럼 기본값이 `is_published=false`라, SQL만 돌리고 관리자에서 **게시 토글 ON + 저장**을 안 하면 랜딩은 여전히 기본 문구가 나온다(정상 동작). 현재 DB에는 `ko` 한 행뿐이고 내용도 전부 빈 문자열이다.
- 코드 수정: `src/lib/landingPromo.ts` — 조회 실패를 아무 흔적 없이 폴백 처리하던 걸 `console.warn`으로 남기게 함. **이 무음 실패가 버그를 오래 방치한 원인이었다.**

### 6-3. ③ 랜딩페이지 가로 스크롤 — 완료

- 원인: `.landing-hero-demo-glow`(장식용 그림자, `inset:-15% -20%`)가 화면 밖으로 41px 삐져나가는데 부모에 가로 오버플로 처리가 없었다.
- 수정: `landing.css` — `.landing-page`에 `overflow-x: clip`.
- **`hidden`이 아니라 `clip`을 쓴 이유:** `hidden`은 스크롤 컨테이너를 만들어 자식인 `.landing-top`(sticky 헤더)의 고정이 풀린다. `clip`은 스크롤 컨테이너를 만들지 않는다. 나중에 누가 `hidden`으로 "정리"하지 않도록 주석도 넣어뒀다.

### 6-4. ④ 핀 카드 터치 영역 확대 — 완료

실측 결과 모바일 시트 안 버튼 52개 중 **51개가 44px 미만**이었다(드래그 핸들 17px, 택시·삭제 22px, 필수방문 24×21).

- 수정(`app.css` 맨 끝, `.mobile-planner-sheet` 안에서만): 드래그 핸들 17→32px, 필수방문·택시·삭제 22→**36px**, 카테고리 필터 배지는 겉모습 유지하고 `::after`로 히트 영역만 38px. 카드 세로 여백 10→6px로 줄여 행 높이 증가를 상쇄.
- **지도 위 오버레이 칩(`.pin-chip` 기본형)은 일부러 건드리지 않았다** — 공간이 빠듯해 키우면 도크가 깨진다.
- **36px로 절충한 이유:** 권장치 44px로 키우면 좌우 버튼이 176px를 먹어 장소 이름 칸이 150px 아래로 내려가 이름이 심하게 잘린다. 더 키우려면 이름 잘림을 감수해야 한다.

### 6-5. ⑤ 검색창 자동 검색 — 완료 (두 번 고침, 함정 주의)

입력만으로는 검색이 안 되고 매번 돋보기 버튼을 눌러야 했던 문제. `SearchPanel`에 `autoSearch` prop을 추가하고 **`MobileSearchSheet`에서만 켰다 — PC는 기존과 동일하다.**

- 최종 동작: 입력이 **1초** 멈추면 자동 검색. 2글자 이상, 같은 질의 재검색 안 함(수동 검색분도 표시), 오버레이 열 때 이미 있던 질의는 제외, 링크 추출·SNS 모드·붙여넣은 장소 목록 제외, 앞선 검색 진행 중이면 대기.
- **함정 1 — 디바운스 500ms는 한글에 너무 짧다.** 한 글자 조합에도 시간이 걸려 조금만 천천히 치면 글자마다 검색이 나갔다. → 1000ms.
- **함정 2 — `compositionstart/end`로 "조합 중엔 검색 안 함"을 걸면 안 된다.** 한글 IME는 **마지막 글자를 계속 조합 상태로 붙들고 있어서**, 입력을 끝내고 가만히 있어도 영원히 검색이 안 나가고 공백을 치거나 포커스를 벗어나야 그제서야 나갔다. 실제로 이 함정에 빠졌다가 되돌렸다. → 조합 가드 대신 **끝이 낱자(`/[\u3131-\u3163]$/`)로 끝나면 건너뛰기**만 남겼다(`강남ㅋ` 방지).

### 6-6. ⑥~⑧ 상세 모달 핀업 · 시나리오 진입 경로 · 표로 보기 — 완료

- **장소 상세 모달에 핀업 버튼**(`PlacePhotosModal.tsx`): 모달을 닫고 뒤 카드에서 다시 눌러야 했던 동선을 없앴다. 헤더 닫기 버튼 왼쪽, 검색 결과 카드와 같은 아이콘·문구(`pinPlus`/`check`, `search.pin`/`search.unpin`).
- **시나리오를 하단 탭바로 이동**(사용자 선택): 하단 탭바가 `내 여행 | 시나리오 | 계정` 3개. **더보기 메뉴에서는 뺐다**(중복 방지). 데스크톱 사이드 레일과 같은 `sparkles` 아이콘·`chrome.tabScenario` 라벨. 기존대로 `isTourScenarioConfigured()`일 때만 노출.
- **표로 보기를 더보기 메뉴에 추가**(사용자 선택 = "표 뷰만 먼저"): `MobileMoreMenu`의 `onOpenScenario` prop이 `onOpenTableView`로 교체됐다. `ItineraryTableView`는 독립 모달이라 모바일 레이아웃과 충돌 없이 그대로 뜬다. 좁은 화면용 CSS만 추가(여백 20→8px, 최대 높이 94vh, 표 글자 12.5px, `safe-area-inset-bottom`).
- **새 번역 키를 만들지 않았다** — `view.table`("표로보기")·`chrome.tabScenario`("시나리오")가 9개 로케일에 이미 있었다.

### 6-7. 남은 것 · 사용자 결정 사항

- **조감(presentation) 뷰 모바일 지원 — 사용자가 "표 뷰만 먼저"를 선택해 보류.** 착수한다면 걸림돌을 먼저 볼 것: `useMobileChrome = isMobile && !presentationMode`라서 **모바일에서 조감을 켜면 모바일 크롬이 통째로 꺼지고 데스크톱 레이아웃으로 넘어간다.** 모바일 전용 조감 레이아웃을 새로 설계해야 한다.
- ~~**§6-2의 SQL이 실제로 적용됐는지 확인 필요**~~ → **2026-09-07 확인 완료. 적용돼 있다.** `landing_promo`에 `is_published`·`block_order` 둘 다 존재한다(Supabase MCP `execute_sql`로 `information_schema.columns` 조회). 단 §6-2의 주의사항은 그대로 유효하다 — `is_published` 기본값이 `false`라 **관리자에서 게시 토글 ON + 저장**을 하기 전까지 랜딩은 계속 기본 문구가 나온다.

  > **2026-09-08 정정 — "토글만 켜면 된다"가 아니다.** 실제로 조회해 보니 `landing_promo` 에는
  > **`ko` 한 행뿐이고 그 내용이 통째로 비어 있다**(`hero_title` 빈 문자열, `images` 0개,
  > `menu_tree` `[]`, 최종수정 2026-08-17). 나머지 8개 언어는 **행 자체가 없다.**
  >
  > `LandingPage` 는 빈 값이면 i18n 기본 문구로 폴백한다
  > (`heroCopy?.heroTitle.trim() || t('hero.title')`). 그래서 **지금 게시 토글을 켜도 화면은
  > 하나도 바뀌지 않는다** — 깨지지는 않지만 아무 효과도 없다.
  >
  > 즉 남은 일은 개발이 아니라 **콘텐츠 작성**이다. 관리자에서 문구·이미지를 채운 뒤에야
  > 게시 토글이 의미를 갖는다.
- **세션에 Supabase MCP가 붙어 있다** (이전 세션 기록에는 "없다"고 적혀 있었으나 2026-09-07 기준 사용 가능). 스키마 확인은 curl보다 `execute_sql`이 빠르다. DDL은 §1-2 절차대로 사용자 승인 후에만.
- 감사에서 나왔지만 손대지 않은 것: **검색 결과 카드 밀도**(한 화면에 2~3개만 보여 스크롤이 잦음), **지도 위 경로 3종 비교선**이 좁은 화면에서 구분이 어려움.

### 6-8. 실기기 테스트 방법

`vite.config.ts`에 `server.host: true`가 이미 있어 별도 설정 없이 LAN 접속이 된다.

- 같은 Wi-Fi에서 `http://<맥 LAN IP>:5173` (IP는 `ipconfig getifaddr en0`).
- **카카오 개발자 콘솔에 그 주소를 등록해야 지도가 뜬다** (내 애플리케이션 → 플랫폼 → Web → 사이트 도메인).
- http라서 **안 되는 게 정상인 기능**: 내 위치(GPS), PWA 설치·서비스워커·공유 시트 — 전부 보안 컨텍스트(https)를 요구한다.
- 폰 화면 콘솔·네트워크: iPhone은 설정→Safari→고급→웹 속성 검사기 ON 후 맥 Safari 개발자용 메뉴, Android는 `chrome://inspect`.
- https가 필요하면 `ngrok`이 설치돼 있다. 단 Vite 5.4.21은 모르는 호스트를 차단하므로 `vite.config.ts`에 `allowedHosts` 추가가 필요하고, ngrok 주소도 카카오 콘솔에 등록해야 한다.

---

## 7. 브랜드 개명 — WayMeld → Wayknit (2026-09-06)

`waymeld.com`·`.app`이 이미 선점돼 있어 영문 서비스명을 **Wayknit**으로 바꿨다. 한글명 **여로담**은 그대로다.

**슬로건:** `Collect places. Meld your route.` → `Collect places. Knit your route.` (한글 "가고 싶은 곳을 담으면, 여행길이 됩니다"는 유지)

### 7-1. 완료된 것

| 대상 | 내용 |
|---|---|
| 로컬 폴더 | `~/Desktop/dev/waymeld2` → `~/Desktop/dev/wayknit` |
| GitHub 저장소 | `redgon99/waymeld2` → [`redgon99/wayknit`](https://github.com/redgon99/wayknit), `git remote` 갱신 |
| 코드·문서 본문 | 174개 파일 일괄 치환 (`WayMeld`→`Wayknit`, `waymeld`→`wayknit`, `WAYMELD`→`WAYKNIT`) |
| 파일명 | 30개 (`docs/` 보고서·기획서, 디자인 PNG, `src/icons/waymeld-icons.ts`→`wayknit-icons.ts`) |
| DB | `waymeld_trips` → `wayknit_trips` (+ 제약 3·인덱스 4·트리거 1·정책 1·함수 10개), `delete_waymeld_mock_mail_users` → `delete_wayknit_mock_mail_users` |
| localStorage 키 | `waymeld:*` → `wayknit:*`, `waymeld-auth` → `wayknit-auth` |

### 7-2. 일부러 바꾸지 않은 것

- **`supabase/migrations/`의 과거 마이그레이션 파일** — 당시 이력이므로 원문 유지. 개명은 새 파일 `20260906120000_rename_waymeld_to_wayknit.sql` 하나로 표현했다. 과거 파일을 고치면 이력이 거짓이 된다.
- **`src/lib/migrateStorageKeys.ts`의 구 브랜드 목록** — `waymeld`·`tripasist`가 남아 있어야 기존 사용자의 로컬 데이터를 새 키로 옮길 수 있다.
- **독일어 로케일의 `Anmeldung`/`Anmelden`/`Melden`** — "로그인·등록"이라는 정상 단어다. 슬로건의 `Meld`만 `Knit`으로 바꿀 때 반드시 **단어경계**(`\bMeld\b`)를 쓸 것. macOS `sed`는 `\b`를 지원하지 않으므로 `perl -pi -e`를 쓴다 — 실제로 sed로 시도했다가 조용히 아무것도 안 바뀐 적이 있다.

### 7-3. DB 개명에서 알아둘 것

**함수 본문은 테이블 rename을 따라가지 않는다.** PostgreSQL은 함수 본문을 파스트리가 아니라 **텍스트**로 저장하므로, `alter table ... rename to`를 해도 함수 안의 `waymeld_trips`는 그대로 남아 전부 `relation does not exist`로 깨진다. 위 마이그레이션은 `pg_get_functiondef()`로 정의를 다시 읽어 참조만 치환해 재생성하는 `do` 블록으로 이를 처리했다(권한·소유자 유지됨).

반대로 **자동으로 따라오는 것**: FK 4개(`share_plaza_imports` 2·`trip_invites`·`trip_collaborators`), `supabase_realtime` publication 멤버십, RLS 정책의 부착 대상. 적용 후 실제로 확인했다 — 47행 보존, publication 유지, REST 조회 200.

### 7-4. 배포 상태 · 남은 것 (2026-09-07 갱신)

~~**🔴 최우선 — 라이브가 개명 전 빌드다.**~~ → **2026-09-06 중 해소됐다.** 개명 커밋 `968954e`가 커밋·배포됐고, 이후 공동편집 1~3단계까지 배포됐다. 2026-09-07 라이브 번들 확인 결과 `waymeld_trips` 0회 / `wayknit_trips` 존재.

| 항목 | 상태 |
|---|---|
| Netlify 사이트 `wayknit.netlify.app` | ✅ 사용자가 확보 (2026-09-06) |
| `wayknit.com` | ⏳ 2026-09-07 기준 아직 미등록 |
| 개명 코드 배포 | ✅ **배포됨** (`968954e`, 2026-09-06 12:42) |
| 구 사이트 `waymeld.netlify.app` | 200 응답하나 `netlify sites:list`에는 안 보인다(다른 계정/팀이거나 클레임 안 된 사이트). 정리 여부 미정 |

**남은 사용자 조치:**
1. **카카오 개발자 콘솔** — 사이트 도메인에 `https://wayknit.netlify.app` 등록해야 지도가 뜬다(§6-8). `.com` 확보 후 그것도 추가. **2026-09-07 기준 등록 여부 미확인** — §9의 환경변수 문제를 고친 뒤에도 지도가 안 뜨면 이것이 원인이다.
2. **`.com` 확보 후** `public/robots.txt`·`scripts/generate-sitemap.mjs`·`.env.example`의 기준 URL을 새 도메인으로 한 번 더 갱신(현재는 `wayknit.netlify.app` 기준).
3. **Edge Function 재배포(선택)** — 18개 함수의 브랜드 문구(AI 프롬프트, `WayknitBot` User-Agent)가 바뀌었다. **DB 테이블을 참조하는 함수는 없어서 재배포 안 해도 깨지지 않는다.**

---

## 8. 실행 명령 · 프로젝트 정보

```bash
npx tsc --noEmit   # 타입체크 (배포 전 항상)
npm run build      # 프로덕션 빌드 (배포 전 항상)
npm run dev         # 개발 서버
```

Supabase 프로젝트 ref: `ainftwifvclgiookzrwm` (대시보드: `https://supabase.com/dashboard/project/ainftwifvclgiookzrwm`)

**배포는 §9를 볼 것** — `git push`로는 배포되지 않는다.

**브라우저 자동화 검증이 필요할 때:** 기본 방침은 **세션이 자체 검증하지 않는 것**이다(§0 참고 — 2026-09-06 변경). 사용자가 명시적으로 요청할 때만 쓴다: `npm install --no-save playwright && npx playwright install chromium`로 세션 내 설치 가능(프로젝트 파일에 안 남음). 스크립트는 `.pw-scratch/`(gitignore됨). 목업 로그인은 `/login`에서 이메일 `user1@mail.com`~`user30@mail.com`(약관 체크박스 2개 동의 필요) — 이미 여러 계정에 샘플 여행이 시드돼 있다(§1-1처럼 실제 네트워크 실패도 그대로 재현되니 참고).

**주의:** `supabase db push` / `supabase migration repair`는 §1-2 때문에 그대로 쓰면 안 됨.

---

## 9. 배포 구조 · 환경변수 (2026-09-07)

### 9-0. 발단

사용자 신고: 배포 사이트(`wayknit.netlify.app/plan`)에서 **지도가 안 열린다.** 콘솔에 `VITE_KAKAO_JS_KEY 환경 변수가 필요합니다`.

처음엔 §7-4의 "카카오 콘솔 도메인 미등록" 문제로 보였으나 **아니었다.** 훨씬 아래에 원인이 있었다.

### 9-1. 🔴 이 프로젝트의 Netlify 사이트에는 Git 연동이 없다 — 가장 중요한 사실 (의도된 선택)

```
getSite → build_settings: {}      deploy_hook: null      created_via: ""
```

**이건 사고가 아니라 사용자가 비용을 보고 내린 결정이다 — 연동을 권하지 말 것(§9-5-1).**

**커밋·푸시해도 아무것도 배포되지 않는다.** 지금까지의 모든 배포는 로컬에서 빌드해 CLI로 올린 **수동 배포**였다. 배포 목록에 커밋 해시와 커밋 메시지가 찍혀 있어서 Git 연동처럼 보이는데, 그건 Netlify CLI가 git 저장소 안에서 실행될 때 HEAD 정보를 붙여주기 때문이다 — **연동의 증거가 아니다.** 여기에 속아서 "푸시했으니 배포됐겠지"로 넘어가지 말 것.

파생되는 함정 둘:

1. **Netlify UI/`env:set`에 등록한 환경변수는 빌드에 안 들어간다.** Netlify가 빌드를 안 하니 그 값이 쓰일 자리가 없다. 실제로 `VITE_KAKAO_JS_KEY`가 `builds` 스코프·`all` 컨텍스트로 멀쩡히 등록돼 있는데도 번들엔 `undefined`로 박혀 있었다.
2. **빌드 훅은 200을 반환하지만 아무 일도 안 한다.** 빌드할 소스(연결된 저장소)가 없기 때문이다. 훅을 만들어 눌러보고 7분 기다렸다가 이 사실을 알았다. (만든 훅은 삭제함.)

`netlify api createSiteBuild`는 이 사이트에서 `Not Found`를 낸다 — 같은 이유다.

### 9-2. 그래서 무엇이 깨져 있었나

배포 번들의 Supabase 초기화 코드가 이렇게 컴파일돼 있었다:

```js
const kS = void 0, SS = void 0, Ke = !!kS && !!SS;   // URL·KEY 둘 다 undefined → isSupabaseConfigured=false
```

Vite는 `import.meta.env.VITE_*`를 빌드 시점에 **상수로 인라인**한다. 값이 없으면 `undefined`가 박히고, `if (!key)` 같은 분기는 통째로 상수 접힘된다. 지도 쪽은 그래서 `console.error`만 무조건 실행되는 코드로 남아 있었다 — 사용자가 본 그 에러다.

**즉 지도만의 문제가 아니었다. `VITE_*`가 하나도 없어 로그인·여행 저장·협업이 전부 죽어 있었고**, 앱은 로컬 저장 폴백으로만 돌고 있었다. 화면에 "Free 계정"·"내 여행"이 보이니 정상처럼 착각하기 쉽다.

**진단에 쓴 방법 (재사용할 것):** 라이브 번들을 받아 값이 실제로 박혔는지 직접 본다. 환경변수는 "등록했는지"가 아니라 **"번들에 들어갔는지"로 확인해야 한다.**

```bash
A=$(curl -s https://wayknit.netlify.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
curl -s "https://wayknit.netlify.app/$A" -o /tmp/live.js
tr -d '\r' < .env.local > /tmp/env.clean; set -a; . /tmp/env.clean; set +a   # CRLF 주의, §1-5
grep -qF -- "$VITE_SUPABASE_URL" /tmp/live.js && echo PRESENT || echo ABSENT
```

에러 문자열의 **존재 여부가 반대 신호**라는 점도 기억할 것: `VITE_KAKAO_JS_KEY 환경 변수가 필요합니다`가 번들에 **있으면 키가 없는 것**이고, **없으면 키가 들어간 것**(분기가 제거됨)이다.

### 9-3. 조치한 것

1. Netlify에 누락된 4개를 등록(`env:set … --context all`). 기존엔 `VITE_KAKAO_JS_KEY`·`VITE_KAKAO_REST_KEY`·`NODE_VERSION` 3개뿐이었다.

   | 추가한 변수 | 값 |
   |---|---|
   | `VITE_SUPABASE_URL` | `.env.local`과 동일 |
   | `VITE_SUPABASE_ANON_KEY` | `.env.local`과 동일 |
   | `VITE_GOOGLE_MAPS_API_KEY` | `.env.local`과 동일 |
   | `VITE_ADMIN_EMAILS` | `redgon999@gmail.com` |

2. **`.env.local`을 잠시 치우고** 프로덕션용 6개만 셸로 주입해 `npm run build` → `netlify deploy --prod --dir=dist`.

   왜 치웠나: Vite는 `process.env`가 `.env` 파일보다 **우선**하지만, `.env.local`에만 있고 셸엔 없는 키(`VITE_PORTONE_STORE_ID` 등)는 그대로 로드된다. **개발용 값이 프로덕션 번들에 섞이는 걸 막으려면 파일 자체를 치우는 게 확실하다.** 배포 후 바이트 단위로 동일하게 복원했다.

3. 검증: 라이브 번들 `index-CmmppRPE.js`에서 Supabase URL/ANON_KEY·Kakao JS 키·Google Maps 키·Admin 이메일 **전부 인라인 확인**, `const PS="https://ainftwifvclgiookzrwm.supabase.co"`로 바뀜, 카카오 에러 문자열 0회, `dapi.kakao.com/v2/maps/sdk.js?appkey=…` 경로 살아남음, PortOne 등 개발용 값 누출 없음.

### 9-4. 일부러 프로덕션에 넣지 않은 것

`.env.local`에는 있으나 라이브에 반영하지 않았다. 켜려면 사용자 결정이 필요하다.

| 변수 | 로컬 값 | 뺀 이유 |
|---|---|---|
| `VITE_MAP_PROVIDER_FORCE` | `google` | `.env.example`에 "개발 테스트용"으로 명시. 프로덕션은 `auto`여야 한다 |
| `VITE_AUTH_GOOGLE_ENABLED` | `true` | 켜면 구글 로그인 버튼이 노출된다. Supabase의 Google provider 설정 상태를 확인하지 못했다 |
| `VITE_PORTONE_STORE_ID` | 설정됨 | 켜면 Plus 결제 UI가 열린다 |

**`.env.local`을 Netlify에 통째로 붓지 말 것** — 위 세 개가 그대로 프로덕션 동작을 바꾼다.

### 9-5. 배포하는 법 — 스크립트로 한다

```bash
npm run deploy -- "무엇을 배포하는지"     # 맥·Windows 공통 (셸 무관)
npm run deploy:check                      # 배포하지 않고 빌드·검증만
```

`scripts/deploy.mjs` 가 OS 를 보고 `deploy-prod.sh` / `deploy-prod.ps1` 로 갈라 준다(§12-3).

토큰은 `NETLIFY_AUTH_TOKEN` 환경변수 또는 `.netlify-token` 파일(gitignore됨)에서 읽는다.
발급: <https://app.netlify.com/user/applications> → Personal access tokens.

**스크립트가 대신 막아주는 것 (전부 실제로 사고가 났던 것들):**

1. **프로덕션 값의 출처를 Netlify 한 곳으로 고정한다.** `.env.local`에서 "뺄 것을 고르는" 방식은
   매번 사람 판단이 필요해 `VITE_MAP_PROVIDER_FORCE=google` 같은 개발 전용 값이 새기 쉽다(§9-4).
2. **`.env` 계열 파일을 치우고 빌드한다.** 셸 변수가 우선하긴 하지만 셸에 없고 파일에만 있는 키는
   그대로 로드된다. **이 단계는 2026-09-08 까지 코드에 아예 없었다 — §13 참고.**
3. **배포 전에 번들을 열어 키가 실제로 인라인됐는지 확인**하고, 하나라도 없으면 배포를 중단한다.
   배포 후엔 라이브 번들로 다시 확인한다(§9-2의 "에러 문자열이 있으면 키가 없는 것" 신호 포함).
4. **복원을 세 겹으로 건다** — trap + 스크립트 끝의 명시 호출 + 최종 검사. 실패하면 크게 실패하고
   수동 복구 명령을 그대로 출력한다.

**⚠️ 4번이 왜 세 겹인가 (2026-09-07):** trap 하나만 걸어뒀는데 **실제 배포에서 그 trap이 돌지 않아
`.env.local`을 잃을 뻔했다.** `/var/folders`의 임시 스태시에서 찾아 복구했다(원본 그대로).
**원인은 끝내 특정하지 못했다** — 최소 스크립트, 배포 명령만 no-op으로 바꾼 사본, netlify CLI 단독,
세 가지 재현 시도에서 전부 정상 복원됐다. 그래서 원인을 추측해 덮는 대신 **조용히 잃는 것 자체가
불가능한 구조**로 바꿨다. 스태시도 `/var/folders`가 아니라 프로젝트 안 `.deploy-stash/`에 둔다 —
사고가 나도 눈에 보이고 손으로 되돌릴 수 있다.

**그 외 알아둘 것:**

- 배포하면 `deno.lock`이 바뀔 수 있다 — Netlify Edge Function의 Deno 번들러가 의존성을 **추가만** 한다. 정상이다.
- **PWA 서비스워커가 구 번들을 캐싱**한다. 배포 후 확인할 땐 강력 새로고침(맥 `Cmd+Shift+R`), 폰은
  시크릿 탭을 안내할 것. 이걸 빼먹으면 "아직도 안 된다"는 오진이 나온다.

### 9-5-1. 🔴 GitHub 연동은 **일부러 하지 않는다** — 권하지 말 것

이 문서의 이전 판은 "근본 해결(권장): 저장소를 연결하라"고 적고 있었다. **그 권고는 철회한다.**
비용 조건을 모르고 쓴 것이다.

**사용자 결정 (2026-09-08):** 연동하면 **푸시할 때마다 Netlify 서버가 빌드해 빌드 크레딧이 소모된다.**
계정은 Personal 플랜이고, 문서만 고친 커밋처럼 **배포가 전혀 필요 없는 커밋도 빌드를 부른다**
(실제로 2026-09-07 커밋 3개 중 2개가 그런 것이었다).

지금 방식(`--dir=dist`로 미리 빌드한 결과물 업로드)은 **빌드가 사용자 PC에서 돌아가므로 Netlify
빌드 시간 소모가 0분**이다. 배포 로그에 `Netlify Build completed in 26.2s`가 찍히지만 그건 CLI가
로컬에서 실행한 것이지 서버 빌드가 아니다.

검토했으나 채택하지 않은 절충안 — **전부 지금보다 비용이 같거나 더 든다:**

| 방법 | 왜 안 되나 |
|---|---|
| 릴리스 브랜치만 빌드 | 푸시는 자유로워지지만 배포마다 서버 빌드 비용은 그대로 |
| 커밋 메시지에 `[skip ci]` | 한 번 깜빡하면 빌드가 나간다. 사람 기억에 의존 |
| `netlify.toml`의 `ignore` / Stop builds | 연동해놓고 빌드를 다 막는 것 = 지금과 같은데 설정만 늘어남 |

**부수 효과로 얻는 것:** 배포 시점을 사람이 정한다. 커밋은 자유롭게 쌓고 검증이 끝난 것만 올린다.

**그래서 이 구조의 대가도 분명히 알고 있을 것:** Netlify에 등록해 둔 환경변수와 실제 배포된 번들의
값이 **언제든 어긋날 수 있다.** 그래서 §9-5의 3번(번들 검증)이 선택이 아니라 필수다.

### 9-6. 결과 — 환경변수는 해결됨, 지도·로그인은 확인 대기

라이브 번들에 `VITE_SUPABASE_URL`·`VITE_KAKAO_JS_KEY`가 인라인된 것을 **매 배포마다 자동 확인**한다
(§9-5의 스크립트). 카카오 에러 문자열 0회. 즉 §9-2의 미설정 문제는 해소됐다.

아직 사용자 확인이 안 된 것 — 강력 새로고침(맥 `Cmd+Shift+R`, 폰은 시크릿 탭) 후:

1. **지도가 뜨는지** — 안 뜨면 남은 원인은 **카카오 콘솔 도메인 미등록**(§7-4)이다. 프로덕션 Referer로
   SDK 로더를 찔러 200을 받았으나, 실제 도메인 검사는 런타임에 일어나 이것만으로 단정할 수 없다
2. **로그인이 되는지** — 한때 §10-7의 "모바일 로그인 오류"와 같은 건일까 의심했으나
   그건 Tailscale 테스트 환경 탓이었다(앱 버그 아님). 라이브 확인은 여전히 별도로 필요하다.

---

## 10. 모바일 UX 2차 · 공동편집 4단계 (2026-09-07)

사용자가 **폰으로 직접 화면을 보며** 하나씩 지시한 세션이다. 확인 → 컨펌 → 다음 순으로 진행했다.

### 10-0. 🔴 먼저 알아야 할 것 — 개발서버가 엉뚱한 폴더에서 돌고 있었다

수정을 반영해도 폰 화면이 그대로라 한참 헤맸다. 원인:

```
__vite__id = "D:/project/waymeld2/src/styles/app.css"   ← 폰이 보고 있던 것
```

`D:\project\` 안에 클론이 **셋**(`wayknit`, `waymeld2`, `waymeld`) 있고, 개명 전 이름인 `waymeld2`에서
개발서버가 **2026-09-05부터 이틀째** 떠 있었다. 테일스케일 주소가 그걸 가리키고 있었다.

**증상이 "고쳐도 반영이 안 됨"이면 배포/캐시를 의심하기 전에 서버가 어느 폴더를 보는지 먼저 확인할 것:**

```bash
curl -s "http://localhost:5173/src/styles/app.css" | grep -o '__vite__id = "[^"]*"'
```

`waymeld2`는 워킹트리가 깨끗하고 리모트도 `wayknit.git`이라 유실될 작업은 없었다.
**중복 클론을 정리하는 게 좋다** — 지우는 건 되돌리기 어려워 세션이 임의로 하지 않았다.

### 10-1. 폰에서 개발 화면 보는 법

이 PC에 Tailscale이 깔려 있고 `vite.config.ts`에 `server.host: true`가 있어, 개발서버를 띄워두면
폰에서 바로 볼 수 있다. 코드는 PC에서 고치고 눈으로 보는 건 폰으로 하는 구조라 컨펌이 빠르다.

| 경로 | 주소 |
|---|---|
| 같은 Wi-Fi | `http://192.168.0.252:5173` |
| Tailscale (어디서나) | `http://100.92.164.53:5173` |

지도가 뜨려면 그 주소를 **카카오 콘솔에 등록**해야 한다. http라서 GPS·PWA 설치는 안 되는 게 정상(§6-8).

### 10-2. ⋯ 메뉴가 위성지도 토글에 덮이던 문제

**z-index 숫자 문제가 아니었다.** 메뉴는 이미 60, 토글은 40이라 숫자만 보면 메뉴가 이긴다.

`.mobile-planner-top`이 `position + z-index:25`로 **쌓임 맥락**을 만든다. 자식은 부모 맥락의 천장을
못 넘으므로, 바깥에서 보면 메뉴는 여전히 25다. **메뉴 z-index를 올려도 안 고쳐진다 — 올려야 하는 건 상단바다.**

상시로 올리지 않고 `:has(.planner-more-menu)`로 **메뉴가 열린 동안에만** 45로 올렸다.
(당시엔 전체화면 검색 오버레이(40)를 덮게 되는 게 이유였는데, 그 오버레이는 §10-5에서 없어졌다.
그래도 지도 위 다른 오버레이와의 위아래가 통째로 뒤집히므로 조건부 유지가 맞다.)
`:has()`는 이 파일에 이미 10곳 쓰이고 있다 — `:has(.trip-select-menu.open)`이 같은 드롭다운 패턴이다.

### 10-3. 여행 자료 패널이 하단 시트에 가려지던 문제

모바일에선 이 패널이 우측 사이드패널이 아니라 **하단 시트**가 되는데(`@media (max-width:768px)`),
z-index는 데스크톱 기준 20 그대로였다. 하단에 이미 핀 시트(22)와 탭바(23)가 있어 맨 밑에 깔렸다.

**두 가지가 다 필요했다:**
1. 모바일에서만 `z-index: 24` — 탭바까지 넘겨야 시트 하단이 안 잘린다
2. 열려 있는 동안 핀 시트 감추기 — **z-index만 올리면 안 된다.** 자료가 0개면 시트가 짧아서
   그 위로 핀 시트 윗부분이 삐져나와 두 장 겹쳐 보인다

2번은 검색 오버레이가 이미 쓰던 관용구(`.mobile-search-open .mobile-planner-sheet{display:none}`)와 같은 방식이다.

### 10-4. "이 지역 검색" 버튼 — 모바일에 진입로가 아예 없던 기능

사용자 신고는 "핀업과 검색중심이 터치로 구분이 안 된다"였는데, 실제로는 **검색 중심 지정의 진입로가 0개**였다.

- 핀업 버튼(`.overlay-map-tools`)에 `desktop-only-overlay`가 붙어 모바일에선 `display:none` → 핀업은 롱프레스만 남음
- 검색 중심은 **우클릭 전용** → 터치에 우클릭이 없음

지도를 250m 이상 옮기면 상단 가운데에 **"이 지역 검색"** 버튼이 뜨게 했다(`SEARCH_AGAIN_MIN_SHIFT_M`).
거리 계산은 기존 `haversineMeters` 재사용.

- 검색 로직을 **`runSearchAtCenter(center)`로 분리**했다. 기존 `handleSetSearchCenterFromMap`은
  `mapContextMenu` 상태를 직접 읽어 다른 곳에서 부를 수 없었다. 데스크톱 우클릭과 모바일 버튼이
  같은 함수를 쓰게 해 한쪽만 고쳐지는 걸 막았다.
- **상시 노출하지 않는다** — 좁은 화면에서 지도를 계속 가린다. 검색 시트가 열렸거나 핀업 픽 모드일 때도 숨긴다.

**아직 남은 것: 모바일 핀업 버튼은 여전히 숨겨져 있다.** 롱프레스를 모르면 핀업도 못 쓴다.

### 10-5. 모바일 검색을 전면 덮개 → 하단 시트 탭으로 (이번 세션 가장 큰 변경)

사용자 요청: "검색이 전면으로 보이고 지도가 안 보이면 두 개가 따로 노는 것 같다."

검색만 유독 다른 방식이었다 — `.mobile-search-overlay`(`inset:0`, 흰 배경, `aria-modal`)로 지도를 완전히 덮었다.
`MobileSearchSheet.tsx` 주석에 "시안: top search → fullscreen overlay"라고 적혀 있어 **의도된 설계**였다.

**진짜 걸림돌은 z-index가 아니라 필터 높이였다.** 결과 앞에 7줄(검색어/제공자·범위/반경/카테고리/하위필터/요약/정렬)이
있어서 `sheet-half`(화면 48%)에 그냥 넣으면 결과가 한 장도 안 보인다. `variant="compact"`는 CSS 클래스만
붙일 뿐 구조는 그대로라 도움이 안 됐다.

**한 것:**
- 검색을 시트의 **세 번째 탭**으로(`검색 / 핀 / 동선`). 별도 시트를 만들지 않은 이유 —
  §10-3에서 겪었듯 이 앱은 하단 시트가 늘수록 겹침 사고가 난다. 시트를 하나로 유지하는 게 안전하다.
- 상단 검색 pill → `full`(입력용), **결과가 오면 `half`로 내려앉아 지도와 같이 보임**.
  단 사용자가 `full`로 펼쳐둔 상태면 그 높이를 존중한다.
- `SearchPanel`에 **`collapsibleTools`** 신설 — 범위·반경·하위필터를 `필터` 버튼 뒤로 접고
  `지도 주변 · 5 km · 2개 조건` 요약 한 줄로 대체. **검색어와 카테고리 칩은 접지 않았다**(가장 자주 만지는 조작).
  데스크톱은 이 prop을 안 켜므로 영향 없다.

**함께 죽은 코드를 지웠다:** `mobileSheet` 상태(읽는 곳이 하나도 없는 **쓰기 전용 상태**였다)·
`MobileSheetKind` 타입·`setMobileSheet(null)` 호출 5곳·`MobileSearchSheet` import.

**§1-4가 계속 경고하던 버그가 여기서 해소됐다** — `useEffect(() => { if (!useMobileChrome) setMobileSheet(null); }, [])`는
의존성 배열이 비어 원래 동작하지 않던 코드였는데, 대상 상태가 사라져 통째로 제거했다.

### 10-6. 공동편집 4단계 (§5) — presence 아바타 게이트만 완료

`useTripPresence(trip.id, Boolean(trip.isPublic))` — **공개 여행일 때만** 아바타가 켜져서,
협업자를 초대해도 비공개면 서로 접속 중인 걸 알 수 없었다. 게이트를 이렇게 넓혔다:

```
공개 여행  ||  내가 협업자  ||  (내가 소유자이고 협업자가 1명 이상)
```

- **정책 판단을 `PlannerPage`로 올렸다.** `PlannerAppBar`는 소유권도 협업자도 모르는 표시용
  컴포넌트인데 거기서 게이트를 정하고 있었다. 새 prop `presenceEnabled`.
- **협업자 본인은 조회하지 않는다** — `collaboratorRole`이 있다는 것 자체가 공유 중이라는 증거다.
  쿼리(`hasCollaborators`, `head:true`로 개수만)는 **소유자 시점에서만** 나가고,
  협업자 모달이 닫힐 때 다시 물어 초대 직후에도 아바타가 켜진다.

**아직 안 한 것:**
- **"누가 넣은 핀인지" 표시.** `trip_pins`에 `created_by`·**`created_by_email`**·`updated_by`가
  이미 채워지고 있어 재료는 준비돼 있다(2026-09-07 DB 확인).
- ~~**모바일에는 presence 아바타가 없다.**~~ → **2026-09-08 완료**(§17).
- ~~**검증 미완**~~ → 로그인 걸림돌이 사라져(§10-7) 확인 가능해졌다. 핀 작성자 표시는
  2026-09-08 사용자 확인 완료(§14-5), 양방향 실시간 동기화도 확인 완료(§15).

### 10-7. 남은 것 · 다음 세션이 먼저 볼 것

- ~~🔴 **모바일 로그인 오류**~~ → **2026-09-08 해결. 앱 버그가 아니었다.**
  개발서버를 **Tailscale로 외부 접속해서 테스트한 환경 탓**이었고, 코드에는 이상이 없다.
  나흘 동안 §5 4단계 검증을 막고 있던 걸림돌이 사실은 존재하지 않았다.

  > **교훈: "모바일에서 안 된다"를 앱 버그로 단정하지 말 것.** 실기기 테스트는 LAN·터널·
  > https 여부에 따라 앱과 무관하게 깨진다(§6-8에 이미 "http라서 안 되는 게 정상인 기능"
  > 목록이 있다). 다음에 같은 신고를 받으면 **먼저 접속 경로부터 물어볼 것** — 로컬 LAN인지,
  > Tailscale·ngrok 같은 터널인지, 배포된 https인지.
- ~~**죽은 파일 4개**~~ → **2026-09-08 사용자 승인 후 삭제 완료.**
  경로가 §10-7에 잘못 적혀 있었다 — `src/components/` 가 아니라 **`src/components/mobile/`** 다.
  `MobileSearchSheet.tsx`·`MobilePinSheet.tsx`·`MobileDock.tsx`·`MobileTopBar.tsx`,
  **넷 다 외부 참조 0건**을 실측하고 지웠다. app.css 도 두 구간 66줄을 걷어냈다.

  **CSS 를 지워도 되는 근거를 따로 확인했다** — §1-3 이 경고하는 구간이라 그냥 지우지 않았다:
  - `.mobile-search-open` 클래스를 **붙이는 TSX 가 하나도 없다**(CSS 안에서만 서로를 참조)
  - `.mobile-search-fullscreen*` 을 쓰는 유일한 파일이 **지울 대상 본인**(`MobileSearchSheet.tsx`)
  - `git diff` 로 사라진 선택자가 의도한 10개뿐임을 확인

  **주석 하나를 같이 고쳤다.** 여행자료 패널 규칙의 주석이 "검색 오버레이와 같은 방식으로
  감춘다"고 참조하고 있었다 — 오버레이가 사라졌으니 없는 걸 가리키게 된다.
  죽은 코드를 지울 때는 **그것을 가리키는 주석까지** 봐야 한다.
- ~~**모바일 핀업 버튼 노출**(§10-4)~~ → **2026-09-08 완료**(§17).
- **§9-6 라이브 확인**은 여전히 미완(지도·로그인).

---

## 11. 지금 라이브에 올라가 있는 것 (2026-09-08)

**푸시 ≠ 배포다(§9-1).** 다음 세션이 "커밋됐으니 라이브도 그렇겠지"로 넘어가지 않도록 여기 적어둔다.

| | 값 |
|---|---|
| 마지막 배포 | 2026-09-08, `npm run deploy`(§9-5)로 수동 |
| 배포된 코드 | `d166d24`(= §10 모바일 2차·공동편집 4단계 presence 게이트까지) |
| 라이브 번들 | `assets/index-BIrz1oo-.js` |

**라이브 번들에서 직접 확인한 것:** `collapsibleTools` 있음(§10-5 검색 시트화 반영),
`mobile-search-overlay` 0회(구 전면덮개 제거됨), `presenceEnabled` 있음(§10-6).
Supabase·카카오 키 인라인됨, 카카오 에러 문자열 0회.

**아직 배포되지 않은 것:** `7f27c31`(배포 스크립트·문서). 소스 변경이 없어 배포할 필요가 없다.

### 11-1. 다음 세션이 먼저 할 것

> 2026-09-08(2차) 기준: 아래 목록은 그대로 유효하다. 여기에 더해 **배포 경로 문제 두 건이
> 해결됐다** — Windows에서 `npm run deploy` 가 깨지던 것(§12)과, 스크립트가 `.env.local` 을
> 실제로는 치우지 않던 것(§13). 라이브 코드는 여전히 `d166d24` 이며 그 이후 커밋은 전부
> 스크립트·문서라 배포가 필요 없다.

> **2026-09-08(3차) 갱신 — 이 목록의 걸림돌 두 개가 모두 사라졌다.** 아래는 그 뒤 상태다.

1. ~~🔴 모바일 로그인 오류~~ → **해결.** Tailscale 테스트 환경 탓이었고 앱 버그가 아니다(§10-7).
2. ~~🔴 Anthropic 크레딧 소진~~ → **해결.** 사용자가 충전했고 200 응답을 실측했다(§1-1).
3. ~~**"누가 넣은 핀인지" 표시**~~ → **완료**(§14).
4. 🔴 **배포가 3커밋 뒤처져 있다** — 라이브는 `d166d24`. 그 뒤 소스가 바뀐 커밋은
   `2ae8efb`(핀 작성자·anon 노출 차단)·`f0777d0`(**협업자 저장 403 수정**)·
   `da7955f`(활동 로그 개방) 셋이다. **`f0777d0` 없이는 라이브에서 협업자가 핀을 추가해도
   소유자에게 가지 않는다.** 사용자가 몰아서 직접 배포하기로 함.
5. §10 작업의 폰 확인(검색 시트·겹침 3건·"이 지역 검색" 버튼) — **시크릿 탭으로** 볼 것(PWA 캐시).
6. ~~죽은 파일 4개 정리~~ → **완료**(§10-7). 파일 4개 + app.css 66줄 제거.
7. **랜딩 CMS 는 토글이 아니라 콘텐츠가 없다**(§6-7 정정) — 내용을 채우기 전엔 게시해도 무의미.

### 11-2. 새 PC에서 이어받을 때

```bash
git pull
npm install
# .env.local 은 gitignore다 — 그 PC에 없으면 다른 기기에서 복사해 올 것
# 배포하려면 .netlify-token 도 그 PC에 따로 만들 것 (§9-5)
```

**PowerShell 배포 스크립트(`scripts/deploy-prod.ps1`)는 아직 실행 검증이 안 됐다** —
맥에 PowerShell이 없어 문법만 맞춰둔 상태다. Windows에서 처음 쓸 땐 `-DryRun`으로 먼저 돌려
`.env.local`이 제대로 복원되는지 확인할 것.

---

## 12. 🔴 Windows에서 `npm run deploy` 가 깨졌던 이유 (2026-09-08)

증상: PowerShell에서 `npm run deploy -- "메모"` 실행 시

```
scripts/deploy-prod.sh: line 21: $'\r': command not found
: invalid option nameh: line 22: set: pipefail
```

**원인이 두 겹이다. 하나만 고치면 더 찾기 어려운 실패로 바뀐다.**

### 12-1. `.sh` 가 CRLF로 체크아웃됐다

`.gitattributes` 가 `* text=auto` 이고 이 PC는 `core.autocrlf=true` 라, 맥에서 LF로 커밋된
스크립트가 Windows에서 **CRLF로 변환돼** 내려온다. bash 가 `\r` 을 명령으로 읽는다.

**Git Bash(msys) 에서는 증상이 안 보인다** — CR 을 관대하게 넘긴다. 그래서 "Git Bash에서
돌려보니 되더라"는 검증은 이 문제를 못 잡는다. 실제로 그렇게 잘못 결론 낸 적이 있다.

→ `.gitattributes` 에 `*.sh text eol=lf` 를 못박았다. `*.ps1` 은 반대로 `eol=crlf`.

**확인 방법 — msys 도구를 믿지 말 것.** `sed`·`grep` 은 CR 을 걸러내 보여주고, `od -c | grep '\r'`
같은 조합도 오답을 낸다. 바이트로 직접 세는 게 유일하게 믿을 만하다:

```bash
python -c "d=open('scripts/deploy-prod.sh','rb').read(); print('CR:',d.count(b'\r'))"
```

### 12-2. PowerShell 의 `bash` 는 Git Bash 가 아니라 WSL 이다

```
C:\Windows\system32\bash.exe          ← PowerShell 이 잡는 것
```

npm 의 `script-shell` 이 설정돼 있지 않아, PowerShell 에서 `npm run deploy` 를 하면
스크립트 전체가 **WSL 안에서** 돌면서 프로젝트를 `/mnt/d/...` 로 본다. `node_modules` 는
Windows 네이티브라 rollup 이 죽는다.

**12-1만 고치면 이 실패로 넘어간다** — 실제로 그렇게 됐고, 줄바꿈 오류보다 원인 찾기가 훨씬 어렵다.
그래서 `deploy-prod.sh` 앞부분에 **WSL 감지 가드**를 넣었다(`/proc/version` 에 microsoft &&
경로가 `/mnt/` 로 시작). 걸리면 즉시 중단하고 Git Bash 로 다시 하라고 안내한다.

### 12-3. 그래서 배포하는 법 — OS 상관없이 같다

```bash
npm run deploy -- "배포 메모"     # 맥·Windows·PowerShell·Git Bash 전부 동일
npm run deploy:check              # 배포하지 않고 빌드·검증만
```

`npm run deploy` 는 `scripts/deploy.mjs` 를 거쳐 **OS 에 맞는 스크립트로 갈라진다** —
Windows 면 `deploy-prod.ps1`, 그 외엔 `deploy-prod.sh`. 예전처럼 package.json 이
`bash scripts/deploy-prod.sh` 를 직접 부르면 PowerShell 에서 WSL 로 새기 때문이다(§12-2).

`deploy-prod.sh` 에는 WSL 감지 가드가 남아 있다 — 누가 `.sh` 를 직접 호출할 때를 위한 것이다.

### 12-4. `.ps1` 을 `.sh` 와 같은 수준으로 맞췄다 (2026-09-08 해결됨)

전에는 `.ps1` 이 §9-5 의 안전장치를 받지 못한 상태였다(스태시가 `%TEMP%` 의 난수 폴더,
복원 1겹, 매니페스트 없음, 심은 환경변수가 세션에 남음). 지금은 다음이 들어가 있다.

- 스태시를 프로젝트 안 `.deploy-stash/` 로 — 사고가 나도 눈에 보인다
- `.manifest` 기록
- `finally` + `Console.CancelKeyPress`(Ctrl+C) + 최종 존재 검사 = 3겹, 실패 시 수동 복구 명령 출력
- 이전 실행이 남긴 스태시를 발견하면 지우지 않고 **먼저 되돌린다**. 작업트리와 스태시
  양쪽에 같은 파일이 있으면 사람이 판단하도록 중단한다
- 빌드용으로 심은 프로덕션 환경변수를 끝나고 **지운다**. 안 지우면 같은 창에서 이어서
  `npm run dev` 를 할 때 Vite 가 `process.env` 를 `.env.local` 보다 우선해 개발 서버가
  프로덕션 값으로 뜬다
- PS 5.1 대비 TLS 1.2 고정 (기본 프로토콜이 낮아 Netlify API 가 거절할 수 있다)

---

## 13. 🔴 배포 스크립트가 `.env.local` 을 실제로는 치우지 않고 있었다 (2026-09-08)

**§9-5 가 설명하는 동작과 코드가 달랐다.** 문서는 ".env 계열 파일을 치우고 빌드한다"고
적고 있었지만, `deploy-prod.sh` 에는 **파일을 스태시로 넣는 코드가 없었다.**

스태시 디렉터리 생성도, `restore()` 도, `trap` 도, 최종 검사도 전부 있는데 **집어넣는 단계만
빠져 있었다.** 되돌리는 쪽만 갖춰져 있으니 실행해도 아무 에러가 안 나고, `.env.local` 은
그 자리에 그대로 남아 빌드에 섞였다.

### 13-1. 어떻게 확인했나 — A/B 빌드

같은 스크립트를 `.env.local` 이 있을 때와 없을 때 각각 돌려 번들 해시를 비교했다.

| | 번들 |
|---|---|
| `.env.local` 있음 (당시 실제 동작) | `index-CQ8k2hzR.js` |
| `.env.local` 치움 (의도한 동작) | `index-BIrz1oo-.js` |

다르다 → `.env.local` 이 프로덕션 번들에 반영되고 있었다.

**라이브 번들만 보고 판단하면 안 된다.** 당시 라이브가 `index-BIrz1oo-.js`(깨끗한 쪽)이라
문제없어 보였는데, 그건 맥의 `.env.local` 에 개발 전용 키가 없어서 결과가 우연히 같았던 것이다.
**같은 스크립트를 Windows PC 에서 돌렸다면** `VITE_MAP_PROVIDER_FORCE=google` 과
`VITE_AUTH_GOOGLE_ENABLED=true` 가 프로덕션에 올라갔다.

### 13-2. 왜 검증을 통과했었나

번들 검증(§9-5 의 3번)은 **Netlify 값 3개가 인라인됐는지**만 봤다. 그 키들은 셸 변수가
파일보다 우선하므로 항상 통과한다. 문제는 **파일에만 있는 키**인데 그건 안 보고 있었다.

누출 검사도 있긴 했지만 번들에서 `PORTONE`·`MAP_PROVIDER_FORCE` 라는 **이름**을 grep 했다.
Vite 는 `import.meta.env.VITE_XXX` 를 **값으로 치환**하므로 그 이름은 애초에 번들에 남지 않는다.
사실상 아무것도 잡지 못하는 검사였다.

→ 이제 **치워둔 `.env.local` 의 실제 값**과 대조한다. Netlify 에도 있는 키는 그 값이 정본이라
제외하고, 8자 미만 값은 흔한 문자열(`true`, `auto`)이라 오탐이 나서 건너뛴다.

### 13-3. 함께 고친 것

- **`.manifest` 가 한 번도 쓰이지 않고 있었다.** 최종 검사(`grep -qx "$f" "$STASH/.manifest"`)가
  이 파일을 읽는데 아무도 만들지 않아, 그 안전장치는 **절대 발동하지 않는 죽은 코드**였다.
- **이전 실행이 남긴 스태시를 `rm -rf` 로 지우고 있었다.** 크래시로 `.env.local` 이 스태시에
  남았을 때 다음 실행이 그걸 삭제한다 — "눈에 보이고 손으로 되돌릴 수 있다"는 §9-5 의 설계가
  그 한 줄로 무력화돼 있었다. 이제 지우지 않고 먼저 되돌리며, 양쪽에 다 있으면 중단한다.
- `restore()` 가 매니페스트를 지우지 않아 `rmdir` 이 실패하고 `.deploy-stash` 가 남았다.
  다음 실행이 "이전 스태시 발견"으로 오인한다.

### 13-4. 교훈

**"스크립트가 있다"와 "스크립트가 그 일을 한다"는 다르다.** 이 스크립트는 사고 후에 급히
보강된 것이라 안전장치가 여러 겹 들어갔는데, 정작 본래 하려던 일 하나가 빠졌고 아무도
눈치채지 못했다. 되돌리는 코드만 있어도 실행은 조용히 성공한다.

**검증은 결과물로 하라.** A/B 빌드로 번들 해시를 비교하는 데 2분이 걸렸고 그것으로 끝났다.
코드를 읽어서는 "스태시 있고 restore 있고 trap 있네"로 넘어가기 쉽다 — 실제로 이 세션도
처음엔 그렇게 넘어갔다.

---

## 14. 공동편집 4단계 완료 — 핀 작성자 표시 (2026-09-08)

§5 A안의 마지막 조각. 핀 칩에 **남이 넣은 핀만** 작은 색 배지를 단다.
presence 아바타와 같은 색·이니셜 규칙이라, 상단 아바타에서 본 사람과 핀이 색으로 이어진다.

### 14-1. 작성자를 핀 객체에 붙이면 안 된다

`PinnedPlace` 는 그대로 `trip_pins.data` jsonb 로 저장되고 `canonicalPin()` 비교에도 쓰인다.
거기에 작성자를 얹으면

1. 이미 컬럼으로 있는 값이 jsonb 안에 **중복 저장**돼 시간이 지나면 어긋나고
2. 내용은 같은데 작성자 필드만 달라도 **"핀이 바뀌었다"로 잡혀 불필요한 저장**이 나간다 —
   동시 편집 중이면 충돌 면적이 넓어진다.

그래서 `pinAuthorsByTrip` 맵에 따로 둔다(키 `${day}:${placeId}`). `readPinsRemote` 가
핀과 **같은 응답**에서 채우므로 두 값이 어긋날 수 없다.

### 14-2. 🔴 표시 게이트는 `presenceEnabled` 가 아니다

처음엔 §10-6 의 `presenceEnabled` 를 재사용했는데 **틀렸다.** 거기엔 `isPublic` 이 들어 있어
공개 여행을 구경하는 아무나에게 협업자 이메일이 보인다. `isTripOwner || collaboratorRole` 로
좁혔다 — §5-2-3 에서 활동 로그를 공개 여행에서도 감춘 것과 같은 판단이다.

### 14-3. 🔴 그 과정에서 찾은 기존 노출 — anon 이 협업자 이메일을 읽고 있었다

`trip_pins` 의 SELECT 정책은 부모 여행 가시성에 위임한다. RLS 는 행 단위라 컬럼을 못 가리므로,
**공개 여행이면 비로그인 사용자가 REST 로 `created_by_email` 을 그대로 읽었다.** 실측 확인함.
1단계(핀 행 분리) 때부터 있던 노출이고 UI 에는 안 드러났을 뿐이다.

`20260908120000_trip_pins_hide_authors_from_anon.sql` 로 닫았다(원격 적용 완료).

**컬럼 단위 REVOKE 만으로는 안 된다.** anon 에 테이블 전체 SELECT 권한이 있으면 그것이 모든
컬럼을 덮어 컬럼 회수가 무효가 된다. 실제로 처음에 `revoke select (created_by_email) ...` 만
했다가 권한이 그대로 남는 걸 확인했다. 테이블 권한을 걷고 필요한 컬럼만 다시 줘야 한다.

**순서가 중요하다.** 공개 여행 열람(`readBySlugRemote` → `attachPins`)도 같은 조회를 쓴다.
컬럼을 먼저 막으면 조회 전체가 실패해 **공개 여행에 핀이 통째로 안 보인다.** 그래서
`readPinsRemote(tripId, includeAuthors)` 로 나눠 소유자·협업자 경로에서만 그 컬럼을 요청하게
고친 **뒤에** 권한을 회수했다.

검증: anon 이 `created_by_email` 요청 → `42501 permission denied`,
anon 의 공개 여행 핀 조회 → 정상(6건). authenticated·service_role 은 전 컬럼 그대로.

**남은 노출:** 로그인한 제3자는 공개 여행의 작성자를 REST 로 여전히 읽을 수 있다.
그것까지 막으려면 뷰나 SECURITY DEFINER RPC 가 필요하다. 지금은 익명 노출만 닫았다.

### 14-4. 알아둘 것

- **supabase-js 는 select 문자열의 리터럴 타입으로 결과를 추론한다.** 삼항으로 넘기면
  유니온이 되어 `ParserError` 로 타입체크가 깨진다. `const columns: string = ...` 으로 낮추고
  결과를 `as unknown as` 로 캐스팅해야 한다.
- **이니셜은 이메일 첫 글자라 약하다.** 시드의 `user1@mail.com`·`user2@mail.com` 은 둘 다 "U"다.
  구분은 **색**이 한다(이메일 해시). 실제 사용자에겐 대체로 충분하지만, 더 나은 표기가
  필요하면 여기부터 손볼 것.
- **모바일에서도 보인다** — §10-5 에서 핀 탭이 하단 시트로 들어가면서 `PinupBar` 를 공유한다.

### 14-5. 확인 방법

시드에 딱 맞는 여행이 있다 — **춘천여행**(공개, 협업자 `user2@mail.com`).

| 일차 | 핀 | 작성자 |
|---|---|---|
| 1일차 | 춘천로데오거리 · 소양강스카이워크 · 춘천 명동 닭갈비골목 | user1 (배지 없음이 정상) |
| **2일차** | **소양강댐** | **user2** ← 여기만 배지 |

`user1@mail.com` 으로 로그인 → 춘천여행 → **2일차** → 좌측 **"핀" 탭**.
1일차에 배지가 없는 건 정상이다(전부 본인 것). 2026-09-08 사용자 확인 완료.

---

## 15. 🔴 `.upsert()` 가 협업자 저장을 전부 막고 있었다 (2026-09-08)

증상: **협업자가 핀을 추가하면 본인 화면에만 보이고 소유자에게 영영 안 갔다.** 반대 방향
(소유자 → 협업자)은 멀쩡했다. 삭제도 마찬가지.

### 15-1. 원인 — upsert 는 UPDATE 정책을 무력화한다

`wayknit_trips` 정책은 이렇게 갈려 있었다.

| cmd | 정책 | 조건 |
|---|---|---|
| UPDATE | `owner_update` | `auth.uid() = owner_id` **OR `is_trip_editor(id)`** ← 협업자 허용 |
| INSERT | `owner_insert` | `auth.uid() = owner_id` **만** |

그런데 `writeRemote()` 는 `.upsert()` 로 저장한다. upsert 는 `INSERT ... ON CONFLICT DO UPDATE`
라서, **행이 이미 있어 결과가 UPDATE 가 되더라도 PostgreSQL 은 INSERT 정책의 WITH CHECK 를
먼저 검사한다.** 협업자의 uid ≠ owner_id 이므로 거기서 `42501` 로 죽는다. UPDATE 정책이
협업자를 허용해 둔 것이 **아무 소용이 없었다.**

그리고 `writeRemote()` 는 그 에러에서 `throw` 하므로 **바로 다음 줄의 `syncPins()` 가 실행조차
안 됐다.** 협업자의 핀은 DB 에 한 번도 도달하지 않았다 — 화면에 보이던 건 로컬 상태뿐이고,
소유자에게 Realtime 이벤트가 안 온 것도 당연했다. **DB 에서 아무 일도 일어나지 않았으니까.**

> **일반화해서 기억할 것:** 소유자만 INSERT 할 수 있는 테이블에 협업자가 쓰는 경로가 있으면
> **upsert 를 쓰면 안 된다.** UPDATE 정책을 아무리 열어도 INSERT WITH CHECK 에서 막힌다.
> 다른 협업 테이블을 추가할 때 같은 함정을 반복하기 쉽다.

### 15-2. 고친 방법 — 협업자는 순수 UPDATE

`writeRemote()` 에 협업자 분기를 넣었다. 여행 **행을 새로 만드는 건 소유자의 일**이므로
기능적으로도 이쪽이 맞다.

쓰는 컬럼도 좁혔다 — `title` · `total_days` · `payload` · `updated_at` 만.

- `owner_id` · `slug` — 소유권이라 건드리면 안 된다
- `is_public` · `plaza_*` — 소유자만 정하는 공개 설정. 협업자의 오래된 로컬 값이 소유자의
  설정을 되돌리는 사고를 막는다
- `current_day` — 보는 사람마다 다른 값이다. 넣으면 협업자가 날짜를 옮길 때마다 소유자의
  날짜까지 끌고 간다

0행 UPDATE 는 조용히 넘기지 않고 던진다. **저장 안 됐는데 저장된 척하는 것이 이번 증상의
본질**이었다.

### 15-3. 🔴 진단 방법에서 배운 것 — 앱 경로를 안 타는 검증은 거짓말을 한다

원인을 찾기까지 오래 걸린 이유가 있다. Node 스크립트로 user1·user2 세션을 만들어
**`trip_pins` 에 직접 INSERT** 하고 양쪽 구독을 확인했더니 **양방향 다 정상**으로 나왔다.
그래서 "Realtime 과 읽기 경로는 멀쩡하니 남은 건 브라우저 안의 병합 로직"이라고 결론냈는데,
**그 테스트가 `wayknit_trips` upsert 라는 앞단을 통째로 건너뛰고 있었다.**

결국 답은 사용자가 보내 준 **브라우저 콘솔 한 줄**에 그대로 있었다:
`42501 new row violates row-level security policy for table "wayknit_trips"`.

교훈: **협업/권한 문제는 실제 앱 경로로 재현하라.** 테이블에 직접 쓰는 진단은 RLS 를
확인해 주는 게 아니라, 확인했다는 착각만 준다. 그리고 §13 과 같은 말이다 —
**검증은 결과물로.**

### 15-4. 곁가지 확인

- 핀 작성자 도장은 DB 트리거 `stamp_trip_pin_author` 가 `auth.uid()` 로 찍는다.
  클라이언트가 `syncPins` 에서 보내는 `created_by`(소유자 id)는 무시된다 —
  **협업자 핀은 협업자 이름으로 올바르게 기록된다.** §14 배지가 의도대로 동작한다.
- `trip_pins` 정책은 INSERT/UPDATE/DELETE 모두 `is_trip_owner OR is_trip_editor` 라
  같은 함정이 없다. 문제는 `wayknit_trips` 하나뿐이었다.
- 진단용 임시 로그는 걷어냈다. 다만 **구독 실패 상태의 `console.warn` 은 남겼다** —
  구독이 조용히 죽으면 화면은 멀쩡해 보이는데 상대 편집만 영영 안 들어와서 알아챌 방법이 없다.

2026-09-08 사용자 확인 완료 (추가·삭제 양방향).

---

## 16. 활동 로그 마감 — 협업자에게도 열기 (2026-09-08)

"공동편집에 히스토리가 있었으면 좋겠다"는 요청을 받고 검토했더니 **이미 다 만들어져
있었다.** 공동편집 3단계(`20260906140000_trip_activity.sql`)에서 테이블·트리거·RPC·조회
라이브러리·UI 탭·9개 로케일까지 끝냈고, 로그도 계속 쌓이고 있었다(당시 48건).

문제는 **덜 연결된 곳 세 군데**였다. 새로 만든 게 아니라 이어 붙인 작업이다.

> 기능 요청을 받으면 만들기 전에 **이미 있는지부터 본다.** 이번엔 DB 트리거까지
> 완비돼 있었고, 실제 작업은 UI 게이트 한 줄과 호출부 두 줄이었다.

### 16-1. 🔴 협업자가 활동 탭에 들어갈 수 없었다

`CollaboratorsModal` 자체가 `isTripOwner &&` 로 막혀 있었고 여는 버튼도 소유자에게만
붙었다. **DB 정책(`trip_activity_select`)은 협업자 조회를 허용하는데 UI 가 막고 있었다.**
히스토리의 가장 큰 수요자가 협업자인데 정작 못 봤다.

같은 모달에 초대·권한변경·삭제가 들어 있어 통째로 열 수는 없다. `isOwner` prop 을 받아
관리 조작만 가린다 — 협업자에게는 초대 폼·역할 select·삭제 버튼이 사라지고 역할이
읽기 전용 배지로 나온다. 목록에서 자기 행에는 "나" 배지를 붙인다.

**화면에서 감추는 것만으로는 부족하다.** 대기 중 초대는 RLS(`invite_owner_select`)가
이미 소유자 전용이라, 협업자 경로에서는 `listPendingInvites` 를 아예 부르지 않는다.

### 16-2. RLS 도 같이 넓혀야 했다 — 안 그러면 A안이 반쪽이 된다

`collab_select` 가 `auth.uid() = user_id OR is_trip_owner(trip_id)` 였다. 즉 협업자는
**자기 행 하나만** 읽었다. 모달만 열어 주면 "사람" 탭에 자기밖에 안 보인다.

`20260908160000_collaborators_see_each_other.sql` 로 `is_trip_collaborator(trip_id)` 를
더했다(원격 적용 완료).

**재귀 걱정은 없다.** `is_trip_collaborator` 가 `trip_collaborators` 를 다시 읽지만
SECURITY DEFINER 이고, 함수 소유자와 테이블 소유자가 모두 `postgres` 이며
`relforcerowsecurity = false` 다 — 함수 안에서 RLS 를 우회하므로 정책이 재진입하지 않는다.
**적용 전에 소유자와 force_rls 를 실제로 조회해 확인했다.** 이 세 조건 중 하나라도
어긋나면 무한 재귀로 테이블 전체가 죽는다.

검증(user2 시점으로 role·jwt 를 바꿔 실측):

| 확인 | 결과 |
|---|---|
| 재귀 | 없음(정상 반환) |
| `is_trip_collaborator(춘천여행)` | `true` ← 새 분기 작동 |
| `is_trip_collaborator(남의 여행)` | `false` ← 범위 정확 |
| 테이블 전체 3행 중 조회된 것 | **1행**(자기 여행만) |

**협업자 여럿이 서로 보이는지는 2026-09-08 사용자가 직접 확인했다.**

노출 판단: 같은 여행 협업자의 이메일·역할만 열린다. §14 핀 작성자 배지가 이미 협업자
이메일을 서로 보여주고 있고 활동 로그도 소유자·협업자에게 열려 있으니, **새로 여는 정보가
아니라 같은 선을 맞추는 것**이다. anon·제3자·공개 여행 열람자에겐 변화 없다.

### 16-3. `day_remove` · `trip_rename` 이 기록되지 않고 있었다

DB 화이트리스트에도, TS 타입에도, 9개 로케일 문자열에도 다 있는데 **호출부만 없었다.**
실제로 불린 건 `route_generate` 와 `day_add` 둘뿐. 일차를 지우거나 이름을 바꿔도 흔적이
남지 않았다 — 협업 중 가장 놀라는 변경인데.

`trip_rename` 은 그냥 붙이면 안 된다. `handleTitleChange` 는 **타이핑 한 글자마다** 불려서
로그가 도배된다. 입력이 멎고 1.5초 뒤 한 번만 남긴다.

**여행을 바꿔 실을 때 거짓 기록이 나는 함정이 있다.** 이전 여행의 제목과 비교하게 되기
때문이다. 그래서 기준을 `{ tripId, title }` 로 들고 다니며 `tripId` 가 바뀌면 기록 없이
기준만 새로 잡는다.

### 16-4. 활동 탭이 열려 있는 동안 갱신되지 않았다

한 번 읽고 끝이었다. **실시간 구독은 일부러 걸지 않았다** — 상대가 편집 중이면 목록이
계속 움직여 읽던 자리를 잃는다. 히스토리는 그렇게 볼 정보가 아니다. 새로고침 버튼을
목록 **위**에 뒀다(목록이 `max-height` 로 스크롤되므로 안에 넣으면 같이 밀려 사라진다).

### 16-5. 남은 것

~~**보존 정책이 없다**~~ → **2026-09-08 완료**(§18). 재정렬을 기록 시점에 묶고,
180일·여행당 500건으로 하루 한 번 정리한다. 그 작업 중에 **핀이 있는 여행이 삭제되지 않던
버그**도 찾아 고쳤다(§18-1).

**협업자에게 소유자가 안 보인다.** 소유자는 `trip_collaborators` 에 없고
`wayknit_trips` 에는 `owner_id` 만 있어 이메일이 없다. 보여주려면 auth.users 이메일을
꺼내는 RPC 가 필요한데, 그건 별도 판단이라 이번에 하지 않았다.

---

## 17. 모바일 공동편집 마감 — presence 아바타와 지도 핀업 버튼 (2026-09-08)

공동편집을 실제로 쓰는 화면은 폰인데, 폰에만 두 가지가 없었다. 둘 다 같은 원인이다 —
**데스크톱 전용 컨테이너에 기능을 넣고 모바일 대체 입구를 만들지 않았다.**

> **일반화: `desktop-only-overlay` 안에 기능을 넣을 때는 모바일 입구를 같이 만들 것.**
> 이 클래스는 화면만 감추지 기능을 옮겨 주지 않는다. §10-4(핀업)·§10-6(아바타) 둘 다
> "숨겼는데 대체 입구를 안 만든" 같은 실수였다.

### 17-1. presence 아바타 — 훅을 올려야 했다

`useTripPresence` 를 `PlannerAppBar` 안에서 부르고 있었는데 그 앱바는
`desktop-only-overlay` 라 **모바일에서 아예 렌더되지 않는다.** 그래서 폰으로 공동편집을
하면 상대가 접속 중인지 알 방법이 없었다.

**모바일 상단바에서 훅을 한 번 더 부르면 안 된다.** 같은 여행에 채널이 두 개 열려
자기 자신이 두 명으로 세어지고, `useTripPresence` 안의 `reportedRef` 가 훅 인스턴스마다
따로라 `presence_multi_viewer` 애널리틱스도 두 번 나간다.

그래서 훅을 `PlannerPage` 로 **올리고** 아바타 목록만 내려보낸다. `PlannerAppBar` 의 prop 이
`presenceEnabled: boolean` → `presenceViewers: PresenceViewer[]` 로 바뀌었다.
§10-6 에서 `presenceEnabled` 판단을 `PlannerPage` 로 올린 것과 같은 정리다 —
**표시용 컴포넌트가 채널 수명을 쥐고 있으면 안 된다.**

기본값은 모듈 상수 `EMPTY_VIEWERS` 로 둔다. `= []` 로 쓰면 매 렌더 새 배열이라
`PresenceStack` 이 계속 리렌더된다.

모바일은 검색 알약 옆, `max={3}`(데스크톱 4). **혼자일 때는 `PresenceStack` 이 `null` 을
돌려주므로 그 자리가 비어 있다** — 좁은 화면을 상시로 잡아먹지 않는다. 알약에
`min-width: 0` 을 줘야 아바타가 늘어도 줄바꿈되지 않는다(`flex: 1` 만으로는 부족하다).

### 17-2. 지도 핀업 버튼 — 입구가 롱프레스뿐이었다

데스크톱의 `overlay-map-tools` 가 `desktop-only-overlay` 로 숨는데 대체 입구를 안 만들어,
모바일에서는 **롱프레스를 아는 사람만 쓰는 기능**이 돼 있었다(보이는 안내가 없다).

**위성지도 토글 바로 아래**(`top: 156px; right: 16px`, 40px)에 놓았다. 자리 선정 근거:
- 오른쪽 세로줄에 지도 도구를 모으면 찾기 쉽다(위성지도 토글이 `top:108px` 40px → 148px 까지)
- 가운데 정렬인 "이 지역 검색"(`top:112px`)과 **가로로 겹치지 않는다**
- `z-index` 는 위성지도 토글과 같은 **40** — 지도 위 도구끼리 같은 층에 둔다
- 검색이 지도를 덮을 때(`mobileSheetLevel === 'full'`)는 누를 대상이 없으므로 감춘다

토글 상태(`pickingPinFromMap`)를 `.active` 로 칠하고, 기존 `picking-toast` 안내가 그대로 뜬다.
롱프레스(`handleLongPressPin`)는 그대로 살아 있다 — 버튼은 대체가 아니라 추가 입구다.

2026-09-08 사용자 폰 화면으로 확인 완료(아바타 2개·핀업 버튼·안내 토스트).

---

## 18. 활동 로그 보존 정책 — 그리고 그 김에 찾은 삭제 버그 (2026-09-08)

§16-5 에 남겨 둔 숙제. 지우는 규칙이 아예 없었다.

### 18-1. 🔴 검증하다 찾은 것 — 핀이 있는 여행은 삭제가 안 됐다

보존 정책을 시험하려고 임시 여행을 만들어 지우는 순간 이게 나왔다:

```
ERROR: 23503 insert or update on table "trip_activity"
       violates foreign key constraint "trip_activity_trip_id_fkey"
CONTEXT: ... log_trip_pin_activity() ... delete from public.wayknit_trips
```

`wayknit_trips` 를 지우면 `trip_pins` 와 `trip_activity` 가 함께 cascade 된다. 그런데
핀이 cascade 로 지워질 때 활동 트리거가 깨어나 `pin_remove` 를 `trip_activity` 에
넣으려 하고, 그 시점엔 부모 여행 행이 이미 없다 → FK 위반 → **삭제 전체가 실패한다.**

**즉 핀이 하나라도 있는 여행은 지울 수 없었다.** `deleteRemote` 는 여행 행 하나만 지우고
cascade 에 전적으로 기대므로(`trips.ts`) 앱에서 그대로 터진다. 2026-09-06 활동 로그
트리거를 붙인 §5 3단계부터 있던 버그다.

고침: `DELETE` 인데 부모 여행이 이미 없으면 = 여행 삭제 cascade 중이면 기록하지 않는다.
어차피 그 로그도 같은 cascade 로 사라진다.

> **왜 두 달 가까이 안 드러났나.** 이 세션의 검증 방침(§0)은 사용자가 화면에서 확인하는
> 것인데, "여행 삭제"는 아무도 시나리오에 넣지 않았다. **파괴적 동작은 만들고 나면
> 잘 안 눌러 본다** — 트리거·cascade 를 건드렸으면 삭제 경로를 일부러 밟아 볼 것.

### 18-2. 행 폭발을 기록 시점에 막는다

핀 하나를 5번째에서 1번째로 끌면 1~5번 위치가 전부 밀려 `syncPins` 가 5행을 UPDATE 하고,
행 트리거가 `pin_reorder` 를 5건 남긴다. 그런데 화면은 `tripActivity.ts` 의 `collapse()` 로
이미 하나로 묶어 보여준다 — **남는 4건은 아무도 보지 않는 행**이다.

그래서 트리거가 화면과 **똑같은 규칙**으로 먼저 묶는다: 직전 기록이 같은 사람의
`pin_reorder` 이고 1분 안이면 새로 남기지 않는다. **보이는 결과는 달라지지 않고 행만 준다.**

**"직전 한 건"만 보는 게 중요하다.** "1분 창 안에 하나라도 있으면 건너뛴다"로 하면
재정렬 → 핀 추가 → 재정렬 순서일 때 마지막 재정렬이 사라진다. 그건 화면이 합쳐 주지
않는(사이에 다른 항목이 낀) 별개 사건이다.

같은 트랜잭션 안에서 앞선 행 트리거가 넣은 행도 보이므로 한 번의 재정렬이 정확히 1행이
된다. `created_at` 기본값이 `now()` = 트랜잭션 시작 시각이라 같은 트랜잭션의 행은 시각이
전부 같다 — **그래서 정렬에 `id` 를 함께 써야 한다.**

`collapse()` 는 그대로 남긴다(마이그레이션 이전 행, 정확히 1분을 넘긴 경계).
**두 창을 같은 60초로 맞춰 둘 것** — 어긋나면 화면과 기록이 갈린다.

화면 문구에서는 건수를 뺐다(9개 로케일). 묶은 뒤에는 늘 1이라 "순서 변경 (1건)"이 된다.

### 18-3. 보존 규칙

| 기준 | 값 |
|---|---|
| 보관 기간 | 180일 |
| 여행당 상한 | 500건(최신순) |

**두 기준을 함께 쓴다.** 날짜만 쓰면 짧은 기간에 폭주한 여행을 못 막고, 개수만 쓰면 몇 년 전
기록이 조용한 여행에 영영 남는다. 활동 탭은 한 번에 100건만 읽으므로(`listTripActivity` 의
`limit`) 500건이면 화면에서 체감되는 손실이 없다.

`prune_trip_activity(p_keep_days, p_keep_per_trip)` 는 SECURITY DEFINER 다 — 소유자가
테이블 소유자(`postgres`)와 같고 `relforcerowsecurity=false` 라 RLS 를 우회한다(적용 전
실제로 조회해 확인). **사용자에게 DELETE 권한을 주는 것이 아니다** — `trip_activity` 는
여전히 append-only 이고 자기 흔적을 지우는 경로는 생기지 않는다. `revoke all ... from public`.

크론은 `wayknit-trip-activity-retention`, `30 4 * * *`(UTC 04:30 = KST 13:30), jobid 3.
**공유 DB라 다른 서비스 잡과 섞인다** — jobid 1 `investment-intelligence-every-30-minutes`,
2 `easyshare-cleanup`. 이름에 `wayknit-` 를 붙이고 겹치지 않는 시각에 뒀다. 저 둘은
`net.http_post` 로 엣지 함수를 부르지만 이건 순수 SQL 이라 함수 배포가 필요 없다.

### 18-4. 검증 (전부 롤백되는 트랜잭션에서 실측)

| 확인 | 결과 |
|---|---|
| 핀 3개 추가 | `pin_add` 3건 (정상) |
| 한 문장으로 3행 재정렬 | **`pin_reorder` 1건** (묶기 전이면 3건) |
| 핀 있는 여행 삭제 | **성공**, 남은 활동로그 0건 |
| `prune_trip_activity()` 실행 | 0건 삭제(현재 64행 전부 3일 이내) — 함수 자체는 정상 |
| 시험 잔여물 | 없음 |

적용본과 마이그레이션 파일이 같은지 함수 본문 해시로 대조했다(차이는 줄바꿈 2개뿐).

---

## 19. payload 통짜 저장을 행으로 쪼갬 — 공동편집 5단계 (2026-09-08)

§5-2 가 경고하던 마지막 구멍. 핀만 §5-2-1 에서 행으로 쪼갰고
`routeOptionsByDay`·`generatedRouteByDay`·`materials` 는 `payload` jsonb 한 덩어리로
남아 있어, 핀에서 고쳤던 last-write-wins 가 이 셋에는 그대로였다.

**부수 효과가 예상보다 컸다.** 실측하니 payload 가 **최대 151kB**(53개 여행 합계 408kB)
인데, 700ms 자동저장이 돌 때마다 그 전체를 다시 쓰고 있었다. 이제 바뀐 일차·자료의 행만
쓴다.

### 19-1. 쪼개는 단위를 어떻게 잡았나

| 대상 | 단위 | 이유 |
|---|---|---|
| `materials` | **행 1개 = 자료 1개** | 항목마다 `id`·`createdAt` 이 있다. 핀과 같은 성격이라 3-way 병합을 그대로 쓴다 |
| `routeOptionsByDay` `generatedRouteByDay` | **행 1개 = (여행, 일차)** | 동선은 "그 일차 전체를 다시 계산한 결과"라 부분 병합이 의미를 갖지 않는다 |

**둘을 한 테이블(`trip_day_state`)에 뒀다.** 키가 같고(여행,일차) 동선 생성 시 함께 쓰인다
(`GeneratedRoute` 안에 `options` 가 들어 있다). 따로 만들면 생성 한 번에 두 테이블을 써야
한다. 옵션만 바꿀 때는 그 컬럼만 UPDATE 하면 되므로 큰 동선 blob 을 덩달아 다시 쓰지 않는다.

더 잘게(구간·정거장) 쪼갤 수도 있지만 그럴 이유가 없다. 일차 단위면 **서로 다른 날을
만지는 흔한 경우에 충돌이 아예 사라지고**, 같은 날을 동시에 생성하는 것은 나중 것이
이기는 게 의미상 맞다.

### 19-2. 🔴 이전(backfill)이 이 작업의 핵심이다

읽기가 새 테이블만 보게 되므로, 옮기지 않으면 **기존 53개 여행의 동선·옵션·자료가 통째로
사라진 것처럼 보인다.** 옮긴 뒤 payload 원본과 한 건씩 대조했다:

| | payload | 새 테이블 | 누락 | 값 불일치 |
|---|---|---|---|---|
| (여행,일차) | 61 | **61** | **0** | **0** |
| 자료 | 4 | **4** | **0** | **0** |

**`jsonb` 의 `'null'` 과 SQL `NULL` 을 섞지 않도록** `nullif(..., 'null'::jsonb)` 로 정리했다.
`generatedRouteByDay` 의 값은 "그 일차를 아직 안 만듦"을 뜻하는 null 일 수 있다.

### 19-3. payload 백업을 따로 떴다

핀 때 `payload.pinnedByDay` 를 "롤백 백업으로 남긴다"고 적어 뒀지만 **사실이 아니었다** —
`writeRemote` 는 payload 를 매번 새 객체로 만들어 통째로 덮으므로, 그 이후 한 번이라도
저장된 여행은 백업이 이미 사라진 상태였다.

같은 착각을 반복하지 않으려고 이번엔 진짜 스냅샷을 떴다:
`public.wayknit_trips_payload_backup_20260908` (53행, 512kB, RLS 켜서 클라이언트 접근 차단).
이제 `payload` 는 `{}` 로 쓴다.

> **"백업으로 남는다"고 쓰기 전에 그게 실제로 남는지 확인할 것.** 덮어쓰는 코드가 한 줄만
> 있어도 백업은 첫 저장에서 사라진다.

### 19-4. 🔴 작성자를 `trip.ownerId` 로 찍으면 안 된다

`syncPins(normalized, trip.ownerId)` 로 부르고 있었다. 핀은 DB 트리거
(`stamp_trip_pin_author`)가 `auth.uid()` 로 덮어써서 드러나지 않았지만,
`trip_day_state`·`trip_materials` 에는 그런 트리거가 없다. 그대로 뒀으면 **협업자가 올린
자료가 전부 소유자 것으로 기록됐을 것이다.**

`currentUserId()` 를 추가했다 — `getSession()` 은 로컬 저장소만 보므로 네트워크 왕복이 아니다.

### 19-5. 알아둘 것

- **기준점(baseline)은 정규화된 JSON 문자열로 들고 있는다.** 원본 객체를 들고 있으면
  화면 쪽에서 같은 참조를 변형했을 때 기준점까지 함께 바뀌어 **diff 가 항상 비어 버린다.**
- **조회에 실패하면 기준점을 세우지 않는다**(`delete`). 빈 값으로 기준을 잡으면 다음 저장이
  "전부 지워졌다"고 판단해 원격 행을 실제로 지운다. 기준점이 없으면 전량 재upsert 가 되는데,
  그건 안전한 방향이다.
- **`syncRows` 는 셋을 순차로 보낸다.** 병렬로 던지면 하나가 실패했을 때 나머지가 이미
  나가 있어 어디까지 반영됐는지 알 수 없다. 700ms 디바운스라 왕복 몇 번은 문제가 안 된다.

### 19-6. 검증 (전부 롤백되는 트랜잭션에서 실측)

| 확인 | 결과 |
|---|---|
| A가 1일차·B가 2일차 동선 생성 | **둘 다 살아남음** (1/1, 총 2행) |
| user2(협업자)로 일차상태·자료 쓰기 | **성공** (RLS 통과) |
| 시험 잔여물 | 없음 (61행/4행 그대로) |

`supabase_realtime` publication 에 두 테이블을 올려 뒀다(다른 앱 테이블이 많아 존재 여부를
보고 추가). **앱은 아직 구독하지 않는다** — 상대의 동선·자료 변경은 새로고침해야 보인다.
핀처럼 실시간으로 받으려면 `subscribeTripPins` 와 같은 구독을 하나 더 붙여야 한다. 남은 일.

---

## 20. 🔴 일차 추가·삭제가 상대에게 가지 않던 문제 (2026-09-08)

사용자 신고: **"공유편집에서 일차 추가 후 핀을 추가하면 동기화가 안 되고, 일차를 삭제해도
동기화가 안 된다."**

원인이 둘인데 둘 다 같은 구멍에서 나왔다 — **`total_days` 는 `wayknit_trips` 컬럼인데
그 테이블을 아무도 구독하지 않았다.** 구독은 `trip_pins` 하나뿐이었다.

### 20-1. 왜 "핀은 갔는데 안 보였나"

A가 3일차를 만들고 거기에 핀을 찍으면,

1. B는 `trip_pins` 이벤트를 **정상적으로 받는다.** 병합도 정상이라 `pinnedByDay[3]` 에
   핀이 들어온다.
2. 그런데 B의 `totalDays` 는 여전히 2다 → **3일차 탭이 렌더되지 않는다** →
   도착한 핀을 볼 방법이 없다.

"동기화가 안 된다"로 보이지만 실제로는 **데이터는 왔고 그릇이 없었다.**

### 20-2. 더 나쁜 것 — 서로가 상대의 일차 수를 되돌리고 있었다

저장할 때마다 각자 자기 로컬 `total_days` 를 쓴다. 그래서 A가 3일차를 만들어도 B의
자동저장이 2로 덮고, B가 지운 일차를 A가 3으로 되살린다. **§19 에서 payload 를 쪼개
없앤 것과 같은 종류의 last-write-wins 가 스칼라 컬럼에 그대로 남아 있었다.**

행으로 쪼갤 수 없는 값이라 다른 방법이 필요하다 — **스칼라에 3-way 병합을 적용했다.**
"마지막으로 원격과 맞춘 값"(`tripScalarBaselines`)을 들고 있다가,

- 지금 화면 값 == 기준점 → 내가 안 건드렸다 → **원격을 받는다**
- 지금 화면 값 != 기준점 → 내 미저장 편집이다 → **내 것을 지킨다**(다음 저장에서 내 값이 원격이 된다)

기준점은 **읽을 때**(`attachPins`)와 **쓴 직후**(`syncRows`) 양쪽에서 옮긴다. 쓴 뒤에 안
옮기면 내가 저장한 뒤에도 계속 "내 미저장 편집이 있다"고 판단해 상대의 변경을 영영 안 받는다.

### 20-3. 구독을 여행 전체로 넓혔다

`subscribeTripPins` → **`subscribeTripRealtime`**. 네 테이블을 한 채널에서 듣는다:

| 테이블 | 필터 | 받으면 |
|---|---|---|
| `trip_pins` | `trip_id=eq.` | 핀 다시 읽기 |
| `trip_day_state` | `trip_id=eq.` | 동선·옵션 다시 읽기 |
| `trip_materials` | `trip_id=eq.` | 자료 다시 읽기 |
| `wayknit_trips` | **`id=eq.`** | 일차 수·제목 다시 읽기 |

**여행 본체만 필터가 다르다.** 자연키가 `id` 라 `trip_id=eq.` 를 쓰면 아무것도 오지 않는다.

**무엇이 왔는지 기억했다가 그것만 다시 읽는다.** 상대가 제목을 타이핑하면 700ms마다
여행 행 UPDATE 가 오는데, 그때마다 핀·일차·자료까지 전부 다시 읽으면 낭비가 크다.

이로써 §19-6 에 "남은 일"로 적어 둔 일차상태·자료 구독도 함께 붙었다.

### 20-4. 🔴 무한 왕복을 막는 것이 핵심이다

콜백은 **실제로 달라진 것이 있을 때만** 부른다. 아무 때나 `setTrip` 을 하면

```
상대 저장 → 내 화면 갱신 → 내 자동저장 → 상대 화면 갱신 → 상대 자동저장 → …
```

가 끝없이 돈다. 두 클라이언트가 서로를 계속 깨우므로 **사용자는 아무것도 안 하는데
저장이 멈추지 않는다.** 패치가 비면 콜백 자체를 부르지 않는 것으로 끊는다.

Supabase Realtime 은 **자기 변경도 자기에게 돌려준다.** 그 에코도 같은 규칙으로 걸러진다 —
쓴 직후 기준점을 옮겨 뒀으므로 "원격 == 내 값"이 되어 패치가 비고, 거기서 멈춘다.

### 20-5. 일차가 줄면 보고 있던 날이 사라진다

상대가 3일차를 지웠는데 내가 그 날을 보고 있으면 빈 화면이 된다.
`patch.totalDays` 를 적용할 때 `currentDay` 를 함께 당긴다.

### 20-6. 확인한 것

네 테이블 모두 복제 식별자가 기본키(`d`)이고 **`trip_id` 가 모든 자식 테이블의 PK 에
포함**된다 — DELETE 이벤트는 PK 컬럼만 실어 오므로, 그렇지 않았다면 **삭제만 필터에
안 걸려 조용히 누락됐을 것이다.** `wayknit_trips` 는 PK 가 `id` 라 `id=eq.` 필터와 맞는다.

| 테이블 | PK | 필터 컬럼 포함 |
|---|---|---|
| `trip_pins` | trip_id, day, place_id | ✅ |
| `trip_day_state` | trip_id, day | ✅ |
| `trip_materials` | trip_id, material_id | ✅ |
| `wayknit_trips` | id | ✅ |

---

## 21. 🔴 공동편집에서 사진이 올린 사람에게만 보이던 문제 (2026-09-08)

사용자 신고: **"자료 추가 시 텍스트는 정상인데, 그림 파일은 저장한 사람만 보이고 나머지는
'그림이 입력되었다'고는 보이지만 실제로 열거나 받을 수 없다."**

정확한 관찰이다. **메타데이터와 파일이 서로 다른 곳에 살기 때문**이다:

| | 어디에 | §19 이후 공유 | 결과 |
|---|---|---|---|
| 자료 메타(제목·종류·경로) | `trip_materials` 행 | ✅ 실시간 동기화 | 항목이 보인다 |
| 실제 파일 | Supabase **Storage** | ❌ 정책이 막고 있었다 | 열 수 없다 |

### 21-1. 원인 — Storage 정책이 업로더 본인만 허용했다

```
trip_materials_select_own:
  bucket_id = 'trip-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
```

경로가 `${userId}/${tripId}/${materialId}/${fileName}` 이라 **첫 칸이 올린 사람**이다.
협업자는 `createSignedUrl` 자체가 실패한다. 그리고 앱은 그 실패를 조용히 삼킨다
(`if (url) next[id] = url`) — 그래서 깨진 이미지도 안 뜨고 그냥 안 보였다.

**삭제도 반쪽이었다.** 협업자가 남의 자료를 지우면 `trip_materials` 행은 지워지는데
(테이블 정책은 편집자를 허용한다) Storage 삭제만 막혀 **파일이 고아로 남았다.**

### 21-2. 고침 — 파일을 옮기지 않고 정책만 넓혔다

**경로 두 번째 칸이 이미 `tripId`** 다. 그래서 경로를 여행 기준(`${tripId}/...`)으로
바꾸지 않아도 된다 — 기존 객체를 전부 옮겨야 하는데 이득이 같다.

| | 전 | 후 |
|---|---|---|
| SELECT | 올린 사람만 | 올린 사람 + 소유자 + **협업자(뷰어 포함)** |
| DELETE | 올린 사람만 | 올린 사람 + 소유자 + **편집자** |
| INSERT | 자기 폴더만 | **그대로** — 넓히면 남의 폴더에 파일을 심을 수 있다 |

읽기는 협업자, 쓰기는 편집자 — `trip_materials` 테이블 정책과 같은 선이다.

### 21-3. 🔴 정책 안에서 `::uuid` 캐스팅을 하면 안 된다

경로에서 tripId 를 꺼내려면 캐스팅이 필요한데, **정책 식에서 캐스팅이 실패하면 질의 전체가
에러로 죽는다** — 규칙에 맞지 않는 파일 하나가 버킷 조회를 통째로 깨뜨린다.
그래서 `public.trip_material_path_allows(name, need_write)` 안에서
`begin ... exception when others then return false; end` 로 감쌌다.

**함수를 먼저 만들어 검증한 뒤에 정책을 바꿨다.** 순서를 뒤집으면 잘못된 정책이 버킷을
막아버린 상태에서 디버깅해야 한다.

검증(user2 시점, 실제 값으로):

| 경로 | 기대 | 결과 |
|---|---|---|
| user1이 춘천여행에 올린 파일 (읽기/삭제) | true | **true / true** |
| user2가 협업자가 아닌 여행 | false | **false** |
| `'쓰레기경로'` (칸이 모자람) | 에러 없이 false | **false** |
| `'someuser/uuid아님/m1/f.png'` | 에러 없이 false | **false** |
| 내가 올린 파일(여행 무관) | true | **true** |

실제 객체로도 확인: user2 가 보는 파일이 **2개(그중 1개는 남이 올린 것)** 이고, 자기가
협업하는 여행 것만 보인다. 다른 앱의 Storage 정책 12개는 그대로다(내 둘만 바뀜).

### 21-4. 남은 것 — 고아 파일 5개(약 9MB)

`trip_materials` 행이 없는 Storage 객체가 5개 있고 **전부 이미 삭제된 여행의 것**이다.
여행을 지우면 DB 는 cascade 로 정리되지만 **Storage 는 아무도 안 치운다.**

이번 협업자 삭제 문제와는 별개의 구멍이다. 지우려면 여행 삭제 경로에서 Storage 도 함께
비우거나(클라이언트가 목록을 알아야 한다), 크론으로 고아를 훑어야 한다(§18 의
`prune_trip_activity` 옆에 둘 자리다). **임의로 지우지 않았다.**

### 21-5. 비로그인 열람자는 여전히 못 본다

공개 여행 공유 페이지(`ShareTripPage`)는 자료를 보여주지 않으므로 지금은 드러나지 않는다.
공개 여행에서도 사진을 보여주려면 **사진을 공개한다는 뜻**이라 별도 판단이 필요하다.

---

## 22. 여행 자료 패널 재설계 · 공유받은 자료 배지 (2026-09-09)

사용자: "여행자료공유의 디자인이 좀 촌스러워 좀더 편하고 간편하게" → 3안을 그려
**A안(조용한 캔버스)** 채택 + "공유받은 파일은 배지 추가".

시안 캔버스: `trip-materials-redesign.html` (Claude Design 아티팩트).
채택 안과 현재 화면이 1페이지에, 안 고른 B·C 는 2페이지에 남아 있다.

### 22-1. 무엇이 촌스러웠나 (실측)

| | 전 | 후 |
|---|---|---|
| 입력 | 드롭존 + 메모창 + 저장 버튼 **3층**이 패널의 약 40% | **한 줄 버튼 2개**. 메모는 누를 때만 펼침 |
| 필터 | 칩 8개가 **두 줄로 접힘** + OS 기본 `<select>` | 세그먼트 1개 + `[일차▾][장소▾]` 메뉴 2개 |
| 카드 | 셀렉트 2개 + 휴지통 = **조작 3개**가 사진보다 눈에 띔 | 전부 `⋯` 안으로. 카드에는 사진·제목·회색 한 줄 |
| 드롭 | 점선 상자가 **항상** 자리를 차지 | 패널 전체가 드롭 대상, **끄는 동안에만** 오버레이 |

**일차 칩은 구조적으로 넘친다** — 여행이 길어질수록 늘어나므로 칩으로 두면 언제든
다시 두 줄이 된다. 메뉴로 바꾼 진짜 이유다.

**보기 전환(그리드/목록)은 없애지 않았다.** 시안에는 없었지만 저장된 선호값이 있는
기존 기능이라, 2버튼 세그먼트를 헤더의 **토글 버튼 하나**로 줄여 옮겼다.

### 22-2. 🔴 iOS 파랑이 남아 있었다

`.materials-dropzone:hover` 의 `rgba(0, 122, 255, .05)` 와 `.materials-text-save-btn` 의
`var(--color-primary, #007aff)`. 앱 브랜드는 앰버(`#facc15` · `#ca8a04`)다.
`--color-primary` 가 정의돼 있어 폴백은 안 탔지만 **호버 배경은 실제로 파랬다.**

> 폴백에 다른 디자인 시스템의 색을 적어 두면, 토큰이 사라지는 날 조용히 그 색이 된다.

### 22-3. 공유받은 자료 배지

핀 작성자 배지(§14)와 **같은 규칙**: 색은 `presenceColor(email)`, 글자는
`presenceInitial(email)`, 상단 presence 아바타와 색이 이어진다.

- **내가 올린 것에는 안 붙는다.** 전부 내 것이면 배지가 하나도 없는 게 정상
- 게이트는 `canSeePinAuthors`(소유자·협업자) — `presenceEnabled` 를 쓰면 **공개 여행
  열람자에게 협업자 이메일이 보인다**(§14-2 와 같은 함정)
- 사진 위에서도 읽히도록 흰 링 1.5px. 사진·파일은 타일 왼쪽 위(`⋯` 반대편),
  목록은 썸네일 모서리
- §19 이전 payload 에서 옮겨 온 자료 4건은 작성자가 비어 있어 배지가 없다 —
  모르는 사람의 이니셜을 지어내는 것보다 낫다

작성자는 `TripMaterial` jsonb 에 넣지 않았다(§14-1 과 같은 이유). `materialAuthorsByTrip`
맵에 따로 두고 `readMaterialsRemote` 가 자료와 **같은 응답**에서 채운다.

### 22-4. 🔴 트리거보다 backfill 을 먼저 해야 한다

`created_by_email` 을 채우는 UPDATE 를 트리거를 만든 **뒤에** 돌렸더니 전 행이 NULL 로
남았다. `stamp_trip_material_author` 의 UPDATE 분기가
`new.created_by_email := old.created_by_email`(= NULL) 로 되돌리기 때문이다.
**조용히 아무 효과도 없다** — 에러가 안 난다.

이미 트리거가 있는 DB 라면 `disable trigger` / `enable trigger` 로 감쌀 것.
마이그레이션 파일은 backfill 이 먼저 오도록 고쳐 뒀다.

### 22-5. 🔴 anon 이 새 컬럼을 읽을 수 있었다 — §14-3 의 재발

`trip_materials` 의 SELECT 정책도 부모 여행 가시성에 위임하고, **anon 에 테이블 전체
SELECT 권한이 있었다**(실측). 이메일 컬럼을 그냥 추가했으면 공개 여행에서 REST 로
그대로 읽혔다.

§14-3 과 똑같이 처리했다 — 테이블 권한을 걷고 필요한 컬럼만 다시 준다:
`grant select (trip_id, material_id, data, created_at, updated_at) to anon`.
공개 열람 경로(`readMaterialsRemote`)가 쓰는 것만 남겼다. 하나라도 빠지면 공개 여행에서
자료가 통째로 안 보인다.

앱도 `readMaterialsRemote(tripId, includeAuthors)` 로 나눴다(핀과 같은 구조).

> **같은 실수를 두 번 했다.** 자식 테이블을 새로 만들 때는 "부모 가시성 위임 + anon
> 테이블 권한" 조합을 **기본적으로 의심할 것.** `trip_day_state` 도 같은 상태지만
> 이메일 같은 컬럼이 없어 지금은 문제가 아니다 — 거기에 사람 관련 컬럼을 붙이는 날
> 같이 막아야 한다.

### 22-6. 작성자를 클라이언트가 보내지 않는다

`syncMaterials` 에서 `created_by` · `updated_by` 를 **빼 버렸다.** 트리거가 `auth.uid()`
로 찍고 클라이언트 값은 무시하므로, 남겨 두면 "설정하는 것처럼 보이는데 무시되는" 코드가
되어 §19-4 처럼 다음 사람을 속인다.

### 22-7. 죽은 CSS 를 같이 걷어냈다

app.css **448줄 추가 / 220줄 삭제.** §1-3 이 경고하는 구간이라 근거를 만들고 지웠다:

1. 클래스 17개가 TSX 에서 참조 0 건임을 grep 으로 확인
2. 스크립트로 **콤마로 나뉜 모든 선택자가 죽은 클래스를 포함하는 규칙만** 삭제
   (살아있는 선택자가 하나라도 섞이면 통째로 남긴다)
3. 지운 선택자 30개를 전부 출력해 눈으로 확인
4. 프로덕션 빌드 통과

지운 것: `.materials-compose` · `.materials-dropzone*` · `.materials-text-compose` ·
`.materials-text-save-btn*` · `.materials-view-toggle` · `.materials-view-btn*` ·
`.materials-filters` · `.materials-filter-chip*` · `.materials-place-filter` ·
`.materials-grid-card*` · `.materials-grid-caption` · `.materials-meta*` ·
`.materials-delete-btn*` · `.materials-album-hint` · `.materials-panel-header*` ·
`.materials-grid-text-icon`.

### 22-8. 아이콘 2개를 추가했다

`more`(가로 점 셋 — `grip` 은 세로 2열이라 좁은 자리에 안 맞는다), `pencil`.
`IconName` 유니온에도 넣어야 한다 — `WAYKNIT_ICONS` 에만 넣으면 타입 에러가 난다.

---

## 23. 마이그레이션 드리프트 감사 — C4 (2026-09-09)

§1-2가 이미 알고 있던 "버전 번호가 하나도 안 맞는다"는 제쳐두고, **로컬 마이그레이션
46개가 실제 원격 스키마와 일치하는지**를 컬럼·제약조건·함수·트리거·정책·pg_cron까지
직접 대조했다. §6-2(`landing_promo` 400 에러)가 이 종류의 드리프트가 실제로 장애를
낸 전례라 전면 감사로 진행했다.

### 23-1. 🔴 `landing_promo` 언어 제약이 4개 언어에서 멈춰 있었다 — 고침

로컬에 스페인어·프랑스어·독일어·러시아어·중국어(간체/번체) 추가 마이그레이션
4개(`20260824000000/1/2/3/4`)가 있는데, **원격 CHECK 제약은 여전히
`ko/en/ja/zh`뿐**이었다. 관리자 랜딩 페이지는 `SUPPORTED_LOCALES`(9개 언어) 탭을
전부 보여준다 — DB에 `ko` 행 하나뿐이라 아직 안 터졌을 뿐, 나머지 6개 언어 탭 중
아무거나 저장을 누르면 23514로 저장이 실패했을 것이다.

로컬 파일 내용 그대로 원격에 적용해 고쳤다(데이터 변경 없음, 행 1개 그대로):
```sql
alter table public.landing_promo drop constraint landing_promo_locale_check;
alter table public.landing_promo add constraint landing_promo_locale_check
  check (locale in ('ko','en','ja','zh-CN','zh-TW','es','fr','de','ru'));
```

### 23-2. 🔴 핀 작성자 기능(§14) 전체가 저장소에 파일이 없었다 — 재구성

`trip_pins.created_by/updated_by/created_by_email`과 `stamp_trip_pin_author()`
트리거 — 지금 라이브로 도는 §14 핀 작성자 배지 기능 전체가 로컬에 파일이 하나도
없었다. 원격 마이그레이션 이력에는 `trip_pins_creator`·
`trip_pins_creator_backfill_fix`(2026-09-06) 두 항목이 있는데, 그때 세션이 MCP로
적용만 하고 저장소에 옮겨적지 않았다.

**`trip_collaborators.sql` 파일 상단의 경고와 정확히 같은 구멍이었다** — "정작 생성
구문이 저장소에 없어서 새 환경에서는 마이그레이션이 재현되지 않는다." DB를 새로
구성해야 하는 날 이 기능이 통째로 빠질 뻔했다.

`pg_get_functiondef`로 실제 트리거 함수 정의를 그대로 읽어와
`20260906141643_trip_pins_creator.sql`로 재구성해 커밋했다(내용은
`20260909100000_trip_materials_author.sql`과 거의 동일 — 그게 이걸 베낀 것이었다).
전부 멱등하게 짜서 이미 이 상태인 DB에 다시 돌려도 안전하다. **실제 DB는 건드리지
않았다** — 문서화만.

> **자식 테이블을 만들 때마다 재발하는 패턴이다.** `trip_collaborators`(1차) →
> `trip_pins_creator`(2차, 이번에 발견) 순으로 같은 실수가 나왔다. **MCP로 원격에
> 직접 적용한 스키마 변경은, 적용한 그 세션 안에서 바로 로컬 파일로도 커밋할 것** —
> "나중에 옮겨적기"는 다음 세션이 몰라서 못 한다.

### 23-3. 낮은 우선순위 — 기록만

- `profiles.display_name` 컬럼이 원격에 있는데 만든 마이그레이션이 없다. 앱 코드
  어디서도 참조하지 않는다(휴면 드리프트) — 지금 당장 위험하지 않아 파일을 만들지
  않고 여기 기록만 해 둔다.
- `20260827000000_billing_subscriptions.sql`(`billing_customers`/`billing_events`)이
  로컬에만 있고 **원격엔 테이블 자체가 없다.** 앱 코드도 안 쓴다 — 구독 결제 기능을
  아직 시작하지 않은 상태. 사용자 결정: **그대로 둔다.** 나중에 결제 기능을 실제로
  시작할 때 적용하면 된다.

### 23-4. 문제없음 확인된 것

나머지 40여 개 파일(관리자 콘솔·마켓 인사이트·가이드·배포관리·시나리오 카탈로그·
콘텐츠 신고·통계·협업자·초대·공동편집 5단계 테이블/정책/함수/스토리지 정책/
pg_cron 3개 잡)은 전부 원격과 일치한다. `waymeld_trips→wayknit_trips` 개명
마이그레이션(`20260906120000`)이 `pg_get_functiondef` + `replace`로 **함수 본문의
테이블 참조까지 훑어 재생성**하는 방식이라, 개명 이후에도 `admin_user_rows` 등
관리자 RPC 5개가 전부 정상 참조하는 것을 실제 정의를 읽어 확인했다.
