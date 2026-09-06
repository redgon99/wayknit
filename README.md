# Wayknit (여로담)

**가고 싶은 곳을 담으면, 여행길이 됩니다.**  
*Collect places. Knit your route.*

카카오·Google 지도 기반 여행 동선 플래너. npm 패키지명: `wayknit`.

심플하고 직관적인 단방향 사용 흐름으로 설계된 여행 계획 도구입니다.

## ✨ 핵심 기능

| 기능 | 설명 |
|------|------|
| **카테고리별 핀업 그룹화** | 핀업한 장소가 맛집/카페/관광 등 카테고리별로 묶여 상단 바에 표시 |
| **드래그 앤 드롭 정렬** | 핀 칩과 동선 리스트 모두 드래그로 순서 변경 (@dnd-kit) |
| **다일정 (N일차)** | 1일차/2일차/3일차 탭으로 멀티데이 여행 계획 |
| **3가지 출발지 입력** | 현재 위치(GPS) · 지도에서 클릭 · 주소·장소명 입력 |
| **AI 체류시간 자동 추천** | 카테고리별 기본 체류시간 (관광 90분, 맛집 60분, 카페 45분 등) |
| **식사시간 자동 보정** | 점심 시간대(11:30~13:30)에 맛집 도착하도록 일정 슬라이드 |
| **실제 도로 길찾기** | 카카오 모빌리티 API로 실제 거리·시간 (없으면 직선 추정 폴백) |
| **클라우드 동기화** | Supabase 매직 링크 로그인 + 자동 저장 (없으면 localStorage 폴백) |
| **공유 링크** | `/trip/{slug}` 형식의 읽기 전용 공유 |
| **모바일/태블릿 반응형** | 화면 크기에 따라 패널 레이아웃 자동 조정 |

## 사용 흐름

```
검색 → 결과 정렬(거리/별점/리뷰) → 핀업(카테고리별 누적)
  → 드래그로 순서 조정 → 일정 만들기 → 우측 패널에서 옵션 설정
  → 경로 생성 → 카카오맵 길찾기 위임 → 클라우드/로컬 자동 저장
```

## 폴더 구조

```
src/
  types/index.ts            전체 도메인 타입
  hooks/useAuth.ts          Supabase 인증 훅
  lib/
    categories.ts           카카오 카테고리 매핑, 체류시간 추천
    kakao.ts                Kakao Maps SDK 로더, 검색, 좌표→주소
    planner.ts              경로 계산, NN 최적화, 식사시간 보정
    mobility.ts             카카오 모빌리티 길찾기 API (자동 폴백)
    supabase.ts             Supabase 클라이언트
    trips.ts                Trip 저장 (Supabase/localStorage 통합)
  components/
    SearchPanel.tsx         좌상단 검색 패널
    PinupBar.tsx            상단 가운데 핀업 바 (카테고리 그룹 + 드래그)
    DayTabs.tsx             일차 탭 (멀티데이)
    AuthBar.tsx             우상단 인증 바
    RouteOptionsPanel.tsx   우측 슬라이드 패널 (옵션)
    MapView.tsx             카카오 지도 + 마커 + 폴리라인
    RouteSummary.tsx        좌하단 동선 요약 + 드래그 정렬
    Sortable.tsx            dnd-kit 공용 래퍼
  styles/app.css            전체 스타일
  App.tsx                   상태 관리 + 통합
  main.tsx                  React 진입점
supabase/migrations/        DB 스키마 + RLS
```

## 설치 및 실행

```bash
npm install
cp .env.example .env
# .env에 VITE_KAKAO_JS_KEY 값 입력
npm run dev
```

### 필수/선택 환경변수

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `VITE_KAKAO_JS_KEY` | ✓ | 카카오 JS 키 (지도/검색) |
| `VITE_KAKAO_REST_KEY` |   | 카카오 REST 키 (실제 도로 길찾기) |
| `VITE_SUPABASE_URL` |   | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` |   | Supabase Anon 키 |

카카오 개발자 콘솔에서 `http://localhost:5173`을 JavaScript SDK 도메인으로 등록하세요.

## Supabase 설정 (선택)

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/20250522000000_init.sql` 실행
3. Authentication > Providers에서 Email (Magic Link) 활성화
4. Authentication > URL Configuration에 사이트 URL 추가:
   - `http://localhost:5173`
   - 프로덕션 도메인

Supabase env가 없으면 자동으로 **로컬 저장 모드**로 동작합니다.

## 관리자 기능 (`/admin`)

`VITE_ADMIN_EMAILS` 또는 `admin_users` 테이블에 등록된 계정만 접근 가능. 여행자에게는 노출되지 않음.

- `/admin` — 사용자 확인, 공유마당 현황, 공지사항 관리
- `/admin/insights` — **시장 인사이트**: 한국여행 계획자·경험자의 니즈/불편함을 YouTube 댓글·네이버 블로그/지식인·Reddit에서 수집해 Claude로 분류/요약. `supabase/migrations/20260805000000_market_insights.sql` 적용 + Edge Functions(`insight-collect-youtube`, `insight-collect-naver`, `insight-collect-reddit`, `insight-analyze`) 배포 필요. 시크릿 설정은 `.env.example` 하단 참고. 관리자 UI의 "지금 수집"/"AI 분석 실행" 버튼으로 수동 실행하거나, Supabase `pg_cron`으로 주기 실행 가능.

### YouTube 장소 추출 (플래너 MVP)

검색창에 YouTube·웹 페이지 URL을 넣으면 장소명 후보를 추출합니다. 인스타·틱톡 등은 원문 열기·안내만 제공합니다.

```bash
supabase functions deploy link-places-extract
# 시크릿: YOUTUBE_API_KEY (YouTube), ANTHROPIC_API_KEY (권장)
```

## 주요 알고리즘

### 자동 순서 최적화

`planner.ts`의 `optimizeOrderByNearestNeighbor`는 출발지에서 가장 가까운 장소부터 차례로 방문하는 NN 방식입니다. 소수 장소(2~10개)에서 충분히 만족스러운 결과를 제공합니다.

사용자가 핀업 바나 동선 리스트에서 **드래그로 순서를 변경**하면 자동 최적화가 OFF로 전환되고, 사용자가 지정한 순서가 유지됩니다.

### 체류시간 자동 추천

| 카테고리 | 기본 체류시간 | 근거 |
|---|---|---|
| 관광지 (AT4) | 90분 | 산책·관람 평균 |
| 맛집 (FD6) | 60분 | 식사 시간 |
| 카페 (CE7) | 45분 | 휴식 |
| 문화시설 (CT1) | 75분 | 관람 |
| 쇼핑 (MT1) | 30분 | 둘러보기 |
| 숙소 (AD5) | 0분 | 체크인/아웃만 |

### 식사 시간 반영

가장 먼저 등장하는 `category === 'food'` 장소의 도착시각이 11:30 이전이면, 그 장소부터 뒤로 11:30에 맞춰 일정 전체를 슬라이드합니다.

### 이동시간 추정 → 실제 길찾기 보강

1. **1차 (즉시)**: Haversine 직선거리 × 1.3 (도로 보정) ÷ 이동수단 속도
2. **2차 (백그라운드)**: `VITE_KAKAO_REST_KEY`가 있으면 카카오 모빌리티 API로 실제 도로 거리·시간 계산
3. **결과**: 실제 도로 정보로 거리·시간·도착시각 재계산

## 다음 작업 후보

- 영업시간·별점 **실데이터** 연동 (현재 mock)
- 카카오 **대중교통 API** 앱 내 경로 계산 (현재 추정 + 카카오맵 링크)
- 경로 옵션 **일차별 출발지** 분리
