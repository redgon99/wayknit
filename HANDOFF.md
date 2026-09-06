# HANDOFF — Wayknit(여로담) 작업 인계 문서

최신 갱신: 2026-09-06 / 브랜치 `main`

이 문서는 같은 사용자가 다른 장소·다른 세션에서 작업을 이어받기 위한 인계 문서다. 아래 순서대로 읽으면 된다: **0(지금 상태) → 1(주의사항) → 필요한 상세는 2~7에서 찾아보기**.

---

## 0. 지금 상태 한눈에 보기

여섯 작업 트랙이 있다.

1. **관리자 페이지 개선** (§2) — 사용자가 요청한 감사에서 나온 우선순위 4건 전부 완료, 확장 백로그도 대부분 완료. 남은 건 페이지별 세부 미비점(§2-7, 아직 착수 안 함).
2. **동선짜기 UX 검토** (§3) — 발견 5건 **전부 완료.**
3. **플래너 검색·상세보기 UX** (§4) — 2026-09-05 세션. 사용자가 화면을 보며 지시한 6건 전부 완료·브라우저 검증됨.
4. **실시간 공동편집** (§5) — **A안 1~3단계 완료**(핀 행 분리·실시간 반영·활동 로그). 4단계(UX)가 남았다.
5. **모바일 UX 감사·개선** (§6) — 2026-09-06 세션. 실제 모바일 화면을 전수 점검해 버그·불편 목록을 뽑고, 합의된 5단계를 **전부 완료.** 남은 결정 사항 있음(§6-7).

6. **브랜드 개명** (§7) — 2026-09-06. `WayMeld` → `Wayknit`으로 폴더·저장소·코드·DB·스토리지 키 전부 전환 **완료.** 사용자 조치가 남아 있음(Netlify 사이트명·도메인 확보, §7-4).

**검증은 사용자가 직접 한다 (2026-09-06 사용자 지시로 변경됨):** 이전 방침("크로미움 설치해서 직접 접속해 확인해줘", 2026-09-05)은 **폐기됐다.** 세션이 Playwright로 자체 검증하지 말고, 각 단계 끝에 **"어디서 무엇을 눌러 어떤 결과가 나와야 정상인지" 확인 절차를 설명**하고 사용자의 확인을 기다린다. 이유: 스크린샷·DOM 스냅샷·스크립트 결과가 실제 코드 수정보다 토큰을 더 많이 먹는다는 걸 사용자가 확인했다. 브라우저 자동화가 정말 필요할 때의 설치법은 §8에 남겨둔다.

**작업 방식 (반드시 지킬 것):** 사용자와 "하나씩 완료 → 브리핑 → 컨펌 → 다음"으로 진행하기로 합의했다. 사용자 확답 없이 다음 항목으로 앞서가지 말 것.

**커밋 정책 (2026-09-04 사용자 지시):** git commit/push는 **사용자가 명시적으로 요청할 때만** 한다. 항목을 하나 완료했다고 자동으로 커밋하지 말 것 — 완료 확인과 커밋 요청은 별개다.

---

## 1. ⚠️ 반드시 알아야 할 주의사항

### 1-1. 🔴 Anthropic API 크레딧 소진 — 실서비스 장애, 미해결

2026-09-04 Playwright로 AI 체류시간 추천을 테스트하다가 발견. `route-stay-suggest` Edge Function이 **502**를 반환하고, 실제 응답 본문은:

> `"claude api failed: 400 ... Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."`

이 Supabase 프로젝트가 쓰는 **Anthropic API 키의 크레딧이 소진**된 상태다. 코드 문제가 아니라 결제 문제라 세션에서 고칠 수 없다. 같은 키를 쓰는 다른 Edge Function도 전부 막혀 있을 가능성이 크다(확인 필요): `tour-scenario`, `tour-scenario-catalog-generate`, `insight-analyze`, `insight-guide-draft`, `distribution-draft`, `link-places-extract`, `youtube-places-extract`, `route-stay-suggest`, `_shared/scenarioGen.ts`를 참조하는 곳 전부. **사실상 이 앱의 AI 기능 대부분.**

→ **사용자가 Anthropic 콘솔에서 크레딧을 충전해야 한다.** 다음 세션에서 해결됐는지 먼저 확인할 것.

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
- **§6-2의 SQL이 실제로 적용됐는지 확인 필요** — 세션에는 Supabase MCP도 서비스 롤 키도 없어 DDL을 못 돌렸다. 위 curl로 컬럼 존재를 먼저 확인하고 시작할 것.
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

### 7-4. 배포 상태 · 남은 것 (2026-09-06 갱신)

**🔴 최우선 — 라이브가 개명 전 빌드다.** `wayknit.netlify.app`은 응답 200이지만 올라가 있는 번들이 `waymeld_trips`를 참조한다(라이브 `assets/index-CPELGVbz.js`에서 7회 확인). DB는 이미 `wayknit_trips`로 바뀌었으므로 **여행 조회·저장이 전부 실패하는 상태**다. 스토리지 키도 아직 `waymeld:*`. → **개명 커밋을 배포하면 즉시 해소된다.** DB를 코드 배포보다 먼저 바꾼 순서 때문에 생긴 공백이다.

| 항목 | 상태 |
|---|---|
| Netlify 사이트 `wayknit.netlify.app` | ✅ 사용자가 확보 (2026-09-06) |
| `wayknit.com` | ⏳ 2026-09-07 중 등록 예정 |
| 개명 코드 배포 | 🔴 **미배포** — 워킹트리에 미커밋 |
| 구 사이트 `waymeld.netlify.app` | 아직 살아 있음(별개 사이트). 정리 여부 미정 |

**남은 사용자 조치:**
1. **카카오 개발자 콘솔** — 사이트 도메인에 `https://wayknit.netlify.app` 등록해야 지도가 뜬다(§6-8). `.com` 확보 후 그것도 추가.
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

**브라우저 자동화 검증이 필요할 때:** 기본 방침은 **세션이 자체 검증하지 않는 것**이다(§0 참고 — 2026-09-06 변경). 사용자가 명시적으로 요청할 때만 쓴다: `npm install --no-save playwright && npx playwright install chromium`로 세션 내 설치 가능(프로젝트 파일에 안 남음). 스크립트는 `.pw-scratch/`(gitignore됨). 목업 로그인은 `/login`에서 이메일 `user1@mail.com`~`user30@mail.com`(약관 체크박스 2개 동의 필요) — 이미 여러 계정에 샘플 여행이 시드돼 있다(§1-1처럼 실제 네트워크 실패도 그대로 재현되니 참고).

**주의:** `supabase db push` / `supabase migration repair`는 §1-2 때문에 그대로 쓰면 안 됨.
