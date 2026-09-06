# 여행코스 DB 전환 검토보고서

작성일: 2026-09-02 · 대상: 관리자 시나리오 관리 → 여행코스 DB 축적 구조로의 전환

---

## 1. 결론

**7일 상한은 병목이 아니라 증상입니다.** 상한만 풀면 콘텐츠는 거의 늘지 않고 중복만 늘어납니다.

진짜 병목은 두 가지입니다.

1. **생성 축이 `(테마 × 일수)`** — 일수는 콘텐츠를 늘리는 축이 아니라 **같은 지역·같은 장소의 부분집합을 복제하는 축**입니다. 70개 조합을 다 채워도 실질 콘텐츠는 10테마 × 1~3지역 수준에서 멈춥니다.
2. **코스가 `content jsonb` 문서로만 저장됨** — 장소가 1급 데이터가 아니라서, 지금 구조는 DB가 아니라 **문서 저장소**입니다. "wayknit만의 여행DB"를 막고 있는 진짜 벽이 이것입니다.

제안: 생성 축을 **`지역 × 테마 × 앵글(스토리)`** 로 바꾸고, 저장 구조를 **`place / course / course_stop` 3테이블로 정규화**합니다. 이 전환 하나로 코스 상한이 70 → 1,000+ 로 열리고, 동시에 장소 랭킹·트렌드 결합·SEO 페이지·사용자 행동 조인이 **처음으로 가능해집니다.**

---

## 2. 현황 실측 (운영 DB 기준)

| 항목 | 수치 |
|---|---|
| `scenario_catalog` 전체 | **9행** (게시 7 / 초안 2) |
| 커버된 테마 | **6개 / 10개** |
| 커버된 지역 | **6개** (경기·제주·인천·경북·강원·전남광주) |
| 코스 내 스팟 슬롯 | 120개 |
| **고유 장소 수** | **97개** |
| `guide_articles` | 4건 (전량 게시) |
| `insight_raw_items` (수집된 트렌드 원문) | **597건** |
| `insight_place_mentions` (트렌드→장소 연결) | **0건** ⚠️ |
| `wayknit_trips` | 19건 (공개 2건) |

**읽어야 할 신호 두 가지**

- 오늘의 "여행DB"는 **장소 97개**입니다. 서비스의 목적("대한민국 여행정보를 최대한 많이 제공")과 현재 자산 사이의 격차가 명확합니다.
- 트렌드 수집은 597건이 쌓였는데 **장소로 연결된 건 0건**입니다. `insight_place_mentions.place_content_id` 컬럼은 이미 존재하는데, **조인할 상대(장소 테이블)가 없어서** 파이프라인이 끊겨 있습니다. 트렌드 반영이라는 목표의 배관이 이미 절반 깔려 있고 끝단이 비어 있는 상태입니다.

---

## 3. 왜 현재 구조가 스스로 발목을 잡는가

### 3-1. 일수가 콘텐츠 축이라서, 증식이 아니라 복제가 된다

`(theme, days)`가 사실상 고유키로 동작합니다. 일괄 재생성도 이 조합 단위로 dedupe합니다.

```
src/pages/AdminScenariosPage.tsx:160  const key = `${e.theme}:${e.days}`;
```

그런데 지역 선정은 **항상 전국 밀집도 상위 3개**에서 AI가 고릅니다.

```
supabase/functions/tour-scenario-catalog-generate/index.ts:25   MAX_REGIONS_OFFERED = 3
supabase/functions/_shared/tourScenario.ts:309                  .sort((a, b) => b.count - a.count)
```

즉 같은 테마라면 1일 코스든 7일 코스든 **같은 지역, 같은 상위 후보 풀**에서 뽑힙니다. 7일 코스와 3일 코스는 서로 다른 콘텐츠가 아니라 **부분집합**입니다. 실제 데이터가 이를 증명합니다 — `family` 테마는 게시 2건 + 초안 1건이 **전부 경기도 7일**입니다.

**10테마 × 7일수 = 70개 조합을 다 채워도, 실질 콘텐츠는 10테마 × 1~3지역입니다.**

### 3-2. 지역이 축이 아니라 부산물이다

`fetchThemeRegionClusters()`는 전국 키워드 검색 결과를 시도별로 묶어 **밀집도 내림차순**으로 정렬하고, 상위 3개만 AI에게 넘깁니다. 등록 데이터가 많은 경기·제주·인천이 구조적으로 계속 이깁니다.

17개 시도 · 226개 시군구를 담을 축이 **아예 존재하지 않습니다.** 관리자가 "전북 코스를 만들자"고 결정할 방법이 지금 UI/API에 없습니다.

### 3-3. 장소가 1급 데이터가 아니다 — 이것이 여행DB를 막는 벽

모든 콘텐츠가 `content jsonb` 안에 들어 있습니다. 같은 장소가 5개 코스에 등장하면 **텍스트가 5벌 복제**됩니다. 그 결과 다음이 전부 불가능합니다.

- "성산일출봉이 포함된 코스" 조회 → 불가
- 장소 상세 페이지 / 장소별 랭킹 → 불가
- 장소 정보 1건 수정 → 모든 코스 반영 불가 (코스마다 복제본을 고쳐야 함)
- 트렌드 신호(`insight_place_mentions`)와 조인 → 불가 (3-1 항목의 0건 원인)
- **사용자 핀 로그와 조인 → 불가** ← 가장 뼈아픈 손실

마지막 항목이 특히 중요합니다. 확인해보면 **ID 공간은 이미 통일되어 있습니다.**

```
src/lib/tourApi.ts:159                                   id: `tour:${contentTypeId}:${item.contentid}`
tour-scenario-catalog-generate/index.ts:158   placeId: `tour:${candidate.contentTypeId}:${candidate.contentId}`
```

사용자가 핀업하는 장소와 코스가 참조하는 장소가 **같은 식별자 체계**를 쓰고 있는데, 이를 물리 테이블로 만들어두지 않아서 "가장 많이 핀업된 장소" 같은 **자체 랭킹 데이터를 한 건도 축적하지 못하고 있습니다.** 이건 TourAPI를 그대로 쓰는 경쟁자가 복제할 수 없는 유일한 자산인데, 지금은 매일 버려지고 있습니다.

### 3-4. 일수 상한 로직이 엉뚱한 것을 측정한다

```
src/lib/tourScenario.ts:154   const maxDays = Math.min(MAX_DAYS_CEILING, Math.max(1, Math.floor(top.count / STOPS_PER_DAY_ESTIMATE)));
```

"며칠까지 만들 수 있나"를 후보 밀집도로 계산해 관리자에게 *"이 테마는 최대 N일까지 만들 수 있어요"* 라고 안내합니다. **희소 자원이 '일수'라고 말하는 셈**인데, 실제로 희소한 것은 *지역 커버리지와 이야기*이지 일수가 아닙니다. 관리자의 사고를 잘못된 축에 묶어두는 UI입니다.

7일 상한은 3곳에 박혀 있습니다.

```
src/lib/tourScenario.ts:127                              MAX_DAYS_CEILING = 7
supabase/migrations/20260814000000_scenario_catalog.sql:15   days int not null check (days between 1 and 7)
tour-scenario-catalog-generate/index.ts:101              Math.min(Math.max(..., 1), 7)
```

### 3-5. 탐색 UX가 일수로만 갈라진다

```
src/lib/scenarioCatalog.ts:94   .order('days', { ascending: true })
```

플래너에서 테마를 고르면 "N일 코스" 목록만 나옵니다. 지역·계절·동행·트렌드로 찾을 수 없습니다. 코스가 100개만 되어도 이 UI는 무너집니다.

---

## 4. 제안 구조

### 4-1. 3테이블 정규화

```sql
-- 1) 장소 마스터 — 모든 출처를 하나의 ID 공간으로
create table public.place (
  id uuid primary key default gen_random_uuid(),
  source text not null,          -- korservice2 | gocamping | wellness | odii | manual
  source_id text not null,       -- contentId
  place_key text generated always as (source || ':' || source_id) stored unique,
  content_type_id text,
  name_ko text not null,
  sido text not null,            -- 17개 시도
  sigungu text,                  -- 226개 시군구
  lat double precision, lng double precision,
  address text, thumbnail_url text,
  tags text[],                   -- pet_friendly | accessible | night_open | indoor ...
  i18n jsonb default '{}',       -- {en:{name,address}, ja:{...}} — 코스가 아니라 장소에 귀속
  pin_count int default 0,       -- 사용자 핀업 누적 (자체 랭킹)
  course_count int default 0
);

-- 2) 코스 — 일수는 이제 그냥 속성
create table public.course (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,     -- /courses/jeju-honeymoon-oceanview  (SEO)
  theme text not null,
  angle text,                    -- 스토리 축: season_autumn | companion_pet | transport_transit ...
  sido text not null, sigungu text,
  days int not null,             -- 상한 제거 (결과값)
  season text[], companion text, transport text,
  source text not null default 'ai',   -- ai | editorial | user(공유마당 승격)
  status text not null default 'draft',
  i18n jsonb not null default '{}',    -- 서술문만: {ko:{title,intro,dayTitles}}
  quality_score numeric, view_count int default 0, pin_count int default 0,
  created_at timestamptz default now()
);

-- 3) 코스 ↔ 장소 — 여기가 DB의 심장
create table public.course_stop (
  course_id uuid references public.course(id) on delete cascade,
  day int not null, seq int not null,
  place_id uuid not null references public.place(id),
  note_i18n jsonb default '{}',
  reason_i18n jsonb default '{}',
  primary key (course_id, day, seq)
);
```

### 4-2. 이 3테이블이 생기는 순간 가능해지는 것 (지금은 전부 불가)

| 기능 | 쿼리 |
|---|---|
| 장소 페이지 "이 장소가 포함된 코스 12개" | `course_stop JOIN course` |
| 지역 페이지 `/courses/제주` | `course WHERE sido='제주특별자치도'` |
| 트렌드 결합 | `insight_place_mentions.place_content_id ↔ place.source_id` |
| **자체 인기 장소 랭킹** | `place ORDER BY pin_count DESC` |
| 중복 코스 방지 | 코스 간 장소 집합 자카드 유사도 |
| 장소 정보 1회 수정 → 전 코스 반영 | `place` 1행 UPDATE |

특히 **장소 페이지 + 지역 페이지는 SEO 대량 페이지**가 됩니다. 장소 3,000개 × 지역 226개 = 검색 유입 표면이 지금(코스 7개)의 수백 배가 됩니다.

---

## 5. 생성 축 재설계 — 무엇을 곱해서 늘릴 것인가

**지금:** 10테마 × 7일수 = 70 (실질 중복)
**제안:** 지역 × 테마 × 앵글

앵글(angle)은 스토리텔링의 실제 재료이고, 상당수는 **이미 시스템에 데이터가 있습니다.**

| 앵글 축 | 값 | 데이터 출처 (현재 보유) |
|---|---|---|
| 계절 | 봄 벚꽃 / 여름 바다 / 가을 단풍 / 겨울 온천 | 축제 API (`tour-festival`) |
| 동행 | 혼자 / 커플 / 아이동반 / 부모님 / **반려동물** / **무장애** | `KorPetTourService2`, `KorWithService2` (이미 태그 수집 중) |
| 이동수단 | 뚜벅이(대중교통) / 렌터카 / 자전거 | 기존 동선 엔진 |
| 기간감 | 당일치기 / 1박2일 / 주말 / 장기 | 일수의 새 역할 |
| 트렌드 | 드라마 촬영지, 러닝, 차박 … | **`insight_raw_items` 597건** |
| 스토리 | 오디오 가이드 내러티브 | **`tour-odii`** (KTO 오디오 스토리) |
| 길 | 둘레길·올레길 코스 | **`tour-trails`** (두루누비) |

```
17개 시도 × 10테마 × 6앵글 ≈ 1,020 코스
226개 시군구까지 내려가면          수천 코스
```

핵심은 **지역이 다르면 장소 집합이 실제로 다르다**는 것입니다. 일수 축과 달리 이건 진짜 증식입니다.

### 이미 잘 되어 있는 것 (유지할 것)

- **그라운딩**: AI가 후보 `contentId` 화이트리스트 밖의 장소를 만들면 버립니다 (`index.ts:154`). 환각 방지가 제대로 되어 있습니다.
- **select / narrate 분리**: 장소 선정은 한국어로 1회, 언어별 서술문은 그 결과에 고정. 언어마다 다른 장소가 나오는 문제를 이미 막았습니다.
- **`days: grounded.length`** (`index.ts:281`) — 요청 일수가 아니라 **실제 생성된 일수**를 저장합니다. 일수를 결과값으로 보는 설계가 이미 절반 들어와 있습니다. 입력만 바꾸면 됩니다.

---

## 6. 7일 상한 처리

- DB CHECK를 `days between 1 and 14` 정도로 완화 (완전 제거는 비추천 — 데이터 오류 방어선)
- **일수를 생성 입력에서 제거**하고 규모 프리셋으로 대체: `당일치기 / 1박2일 / 주말(2~3일) / 장기(4일+)`
- 실제 일수는 선정된 장소 수 ÷ 하루 2~4곳으로 자연 결정 (이미 그렇게 저장 중)
- 긴 코스는 오히려 뒷날이 공허해지는 품질 리스크가 있습니다. **짧고 밀도 높은 코스를 많이** 만들고, 긴 여행은 **코스 이어붙이기(체이닝)** 로 커버하는 편이 콘텐츠 총량·품질 모두 유리합니다.

---

## 7. "모든 메뉴의 초점을 코스 DB로" — 메뉴별 재정렬

| 메뉴 | 현재 | 코스 DB 중심 재정렬 |
|---|---|---|
| 플래너 시나리오 탭 | 테마 → 일수 목록 | 지역/테마/앵글 필터 탐색 → **전체 핀업 + 스팟 단위 부분 핀업** |
| 공유마당 (`/plaza`) | 사용자 공개 여행 2건 | 우수 코스를 `course(source='user')`로 **승격** |
| 여행 팁 (`/guides`) | 독립 아티클 4건 | 코스·장소와 연결 (`guide ↔ course`, `guide ↔ place`) |
| 한국여행정보 (`/info`) | 정적 안내 | 지역 페이지의 실용 정보 레이어로 편입 |
| 관리자 인사이트 | 597건 수집, 활용 0 | 트렌드 키워드 → **앵글 생성 소스** + `place_mention` 복구 |
| 배포 (distribution) | 콘텐츠 배포 | **코스 단위** SNS 배포 |
| 랜딩 | 기능 소개 | 인기 코스 쇼케이스 (`view_count`, `pin_count` 기반) |

**핵심 루프**: 코스 노출 → 핀업 → `place.pin_count` 증가 → 인기 장소 랭킹 → 다음 코스 생성 품질 향상. **콘텐츠가 팔릴수록 DB가 좋아지는 구조**이고, 이것이 TourAPI를 똑같이 쓰는 누구도 복제할 수 없는 해자입니다.

---

## 8. 단계별 이행안

| 단계 | 내용 | 예상 |
|---|---|---|
| **Phase 0** | 7일 상한 완화(3곳), 일수 입력 → 규모 프리셋 | 0.5일 |
| **Phase 1** ★ | `place / course / course_stop` 신설 + 기존 9행 백필(jsonb→정규화). 기존 읽기 경로는 호환 뷰로 유지 | 2~3일 |
| **Phase 2** | 생성기 축 변경 — **지역 지정 생성**(`areaBasedList` 기반 시도/시군구 파라미터) + 앵글 파라미터 + 관리자 배치 큐 | 3~4일 |
| **Phase 3** | 공개 페이지: 코스 목록 / 코스 상세 / **장소 페이지** / 지역 페이지 + sitemap | 3일 |
| **Phase 4** | 트렌드 연결 복구(`insight_place_mentions`) + 핀 로그 → `pin_count` 집계 | 2일 |
| **Phase 5** | 공유마당 우수 코스 승격 파이프라인 | 2일 |

Phase 1이 전체의 성패를 가릅니다. **Phase 1 없이 Phase 2를 하면 중복 jsonb 문서만 1,000개 쌓이고 여행DB는 여전히 안 생깁니다.**

---

## 9. 비용 · 리스크

### AI 생성 비용 — 지금 방식은 확장 불가

코스 1건당 Claude 호출이 **9회**입니다 (ko 선정 1 + narrate 8: en/ja/zh-CN/zh-TW/es/fr/de/ru).

```
tour-scenario-catalog-generate/index.ts:26  NARRATE_LOCALES = ['en','ja','zh-CN','zh-TW','es','fr','de','ru']
```

1,000 코스 → **9,000회 호출**. 조회되지도 않을 코스의 러시아어 서술문까지 선결제하는 구조입니다.

**대응**: 생성 시엔 `ko + en`만(2회), 나머지 7개 언어는 **해당 로케일 조회가 실제 발생했을 때 lazy 생성**. 1,000코스 기준 9,000회 → 2,000회로 **78% 절감**하고, 인기 코스에만 다국어 비용을 씁니다. 장소명·주소 번역은 `place.i18n`으로 옮기면 코스 간 재사용되어 추가 절감됩니다.

### 그 외 리스크

| 리스크 | 대응 |
|---|---|
| TourAPI 데이터 지역 편중 | 지역 지정 생성으로 강제 분산 (밀집도 정렬 의존 탈피) |
| 중복 코스 양산 | `(sido, theme, angle)` 유니크 + 장소 집합 자카드 유사도 임계 |
| 대량 생성 시 품질 저하 | `quality_score` 도입, 게시 전 검토 유지(현행 draft→published 워크플로 그대로) |
| 마이그레이션 중 기존 코스 노출 중단 | 호환 뷰로 읽기 경로 유지, 신규 경로 병행 후 전환 |
| `region` 값 표기 흔들림 (예: `전남광주통합특별시`) | `place.sido`를 표준 코드로 정규화 (`koreaAreaCodes.ts` 재사용) |

---

## 10. 지금 결정할 것

1. **축 전환 승인 여부** — `(테마×일수)` → `(지역×테마×앵글)`
2. **Phase 1 정규화 승인 여부** — 이게 "wayknit만의 여행DB"의 전제. 나머지는 이것 위에 올라갑니다.
3. **다국어 lazy 전략 승인 여부** — 대량 생성으로 가는 순간 필수

가장 작게 시작하려면 **Phase 0 + Phase 1**만 먼저 해도 됩니다. 상한이 풀리고 정규화가 끝나면, 그 다음부터는 코스를 얼마나 빨리 찍어내느냐의 문제로 바뀝니다.
