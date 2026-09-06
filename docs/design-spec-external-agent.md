# Wayknit (여로담) — 외부 디자인 에이전트용 서비스 명세서

> **문서 목적**: 현재 구현된 웹 서비스의 제품·UX·비주얼 현황을 한 파일에 정리하여, 외부 디자인 에이전트가 **리디자인·브랜딩·UI 시스템·화면 시안** 작업을 수행할 수 있도록 한다.  
> **작성 기준**: 코드베이스 `wayknit` v0.2.0 (2026-06)  
> **라이브 URL**: https://wayknit.netlify.app/  
> **플래너 URL**: https://wayknit.netlify.app/plan

---

## 목차

1. [한 줄 요약](#1-한-줄-요약)
2. [브랜드 & 포지셔닝](#2-브랜드--포지셔닝)
3. [타깃 사용자](#3-타깃-사용자)
4. [핵심 가치 & 차별점](#4-핵심-가치--차별점)
5. [제품 흐름](#5-제품-흐름)
6. [정보 구조 & 화면 목록](#6-정보-구조--화면-목록)
7. [화면별 상세 명세](#7-화면별-상세-명세)
8. [레이아웃 패턴](#8-레이아웃-패턴)
9. [현재 디자인 시스템](#9-현재-디자인-시스템)
10. [카테고리 컬러 시스템](#10-카테고리-컬러-시스템)
11. [컴포넌트 인벤토리](#11-컴포넌트-인벤토리)
12. [인터랙션 & 상태](#12-인터랙션--상태)
13. [카피라이팅 가이드](#13-카피라이팅-가이드)
14. [다국어 & 접근성](#14-다국어--접근성)
15. [경쟁·벤치마크](#15-경쟁벤치마크)
16. [구현 현황 vs 미완](#16-구현-현황-vs-미완)
17. [디자인 에이전트 산출물 요청](#17-디자인-에이전트-산출물-요청)
18. [제약 & 범위 외](#18-제약--범위-외)
19. [참고 자료](#19-참고-자료)

---

## 1. 한 줄 요약

**Wayknit(여로담)** 는 대한민국을 방문하는 외국인 관광객을 주 타깃으로 한 **지도 중심 여행 동선 플래너**다. 사용자는 장소를 검색·핀업하고, 카테고리별로 정리한 뒤, 드래그로 순서를 바꾸고 **시간표가 포함된 일정·동선**을 생성한다. 실제 이동은 카카오맵·네이버지도·구글맵 링크와 **택시기사용 카드**로 연결한다.

```
Find → Collect → Map → Route
찾기 → 담기 → 지도에 펼치기 → 동선으로 엮기
```

---

## 2. 브랜드 & 포지셔닝

### 2.1 공식 명칭

| 구분 | 이름 |
|------|------|
| **영문 서비스명** | Wayknit |
| **한글 서비스명** | 여로담 |
| **npm / 저장소명** | `wayknit` |
| **영문 슬로건** | Collect places. Knit your route. |
| **한글 슬로건** | 가고 싶은 곳을 담으면, 여행길이 됩니다. |

### 2.2 포지셔닝 한 줄

| 언어 | 문장 |
|------|------|
| **한국어** | 방문 지도가 아니라, **오늘 갈 동선**. |
| **English** | Not a visited map—**your route for today**. |

### 2.3 영문 제품 정의 (해외 마케팅용)

> Plan your Korea trip on a map. Save places, create routes, and get Korean addresses for easy navigation.

### 2.4 메시지 기둥 (3 Pillars)

1. **검색 & 핀업** — 카테고리 칩, 지도·검색에서 즉시 핀
2. **동선 만들기** — 체류·점심·실도로 반영 시간표
3. **공유 & 템플릿** — 링크 공유, 공유마당에서 코스 가져오기

### 2.5 피해야 할 표현

- "세계 지도에 핀을 꽂아 보세요" (Pin Traveler 톤)
- "AI가 모든 일정을 대신" (과장된 AI 포지션)
- "예약·할인·패키지" (OTA·트리플류 포지션)

---

## 3. 타깃 사용자

### Primary: 한국 첫 방문 해외 관광객

- **언어**: 영어, 일본어, 중국어 우선
- **여행 기간**: 서울 3~5일, 또는 서울+부산/경주/제주
- **관심**: K-food, 카페, K-pop, K-drama, 쇼핑, 뷰티, 궁궐, 시장, 야경
- **Pain points**:
  - 한국어 장소명·주소를 모름
  - 동선을 어떻게 묶을지 모름
  - 카카오맵·네이버지도 사용이 어려움
  - 택시기사·식당 직원에게 목적지 설명이 어려움

### Secondary

- **한국 재방문 관광객**: 성수·연남·익선·망원·부산·제주 등 세부 지역 탐색
- **친구/커플/가족 여행자**: 여러 명이 후보지를 모으고 공유

---

## 4. 핵심 가치 & 차별점

| # | 차별점 |
|---|--------|
| 1 | 외국어로 찾고, **한국어 주소**로 이동 |
| 2 | 가고 싶은 곳을 **지도에 모음** |
| 3 | 모은 장소를 **자동 일정·동선**으로 엮음 |
| 4 | 카카오/네이버/구글맵 + **택시기사용 카드**로 실제 이동 지원 |
| 5 | 공항 이동, 교통카드, 1330 등 **한국 여행 실전 정보** 제공 |

### Pin Traveler vs Wayknit

| | Pin Traveler | Wayknit |
|--|--------------|---------|
| 핵심 질문 | 어디를 가 봤나? | 다음에 어떻게 돌아다닐까? |
| 산출물 | 방문 지도, 버킷리스트, 사진·통계 | **시간표 동선**, 다일차 일정 |
| 사용자 | 추억·기록 | 당일·멀티데이 **코스 플래너** |

---

## 5. 제품 흐름

### 5.1 메인 사용 흐름

```
검색 → 결과 확인·정렬 → 핀업(카테고리별 누적)
  → 드래그로 순서 조정 → 동선 옵션 설정
  → 경로 생성 → 외부 지도앱 길찾기 → 저장·공유
```

### 5.2 성공 기준 (UX 목표)

- 첫 방문에서 장소 **3개 이상** 저장
- **자동 일정 생성** 버튼 클릭
- **외부 지도 링크** 클릭 (카카오/네이버/구글)
- **한국어 주소 복사** 또는 **택시기사용 카드** 사용

---

## 6. 정보 구조 & 화면 목록

### 6.1 라우트 구조

| 경로 | 페이지 | 역할 |
|------|--------|------|
| `/` | LandingPage | 마케팅 랜딩, CTA |
| `/plan` | PlannerPage | **메인 지도형 SPA** (핵심) |
| `/trip/:slug` | ShareTripPage | 공유 링크 읽기 전용 |
| `/plaza` | SharePlazaPage | 공유마당 (코스 탐색·가져오기) |
| `/setup` | KoreaSetupPage | 한국 여행 준비 체크리스트 |
| `/help` | HelpPage | 1330·112·119, 공항 가이드, 한국어 문장 카드 |
| `/themes` | ThemesPage | 테마별 추천 보드 |
| `/login` | LoginPage | 매직 링크 로그인 |
| `/admin` | AdminPage | 관리자 콘솔 |

**다국어 URL**: `/{ko|en|ja|zh}/...` prefix 지원 (기본 locale은 prefix 없음)

### 6.2 플래너(`/plan`) 내 오버레이·모달

| UI | 유형 | 설명 |
|----|------|------|
| SearchPanel | 좌측 패널 (데스크톱) | 검색·필터·결과 리스트 |
| PinupBar | 상단 오버레이 | 카테고리별 핀 칩, 드래그 정렬 |
| TripBar + DayTabs | 상단 오버레이 | 여행 제목, 일차 탭 |
| RouteOptionsPanel | 우측 슬라이드 패널 | 출발지·이동수단·시간 옵션 |
| RouteSummary | 좌하단 패널 | 생성된 동선, 구간별 길찾기 |
| Place 상세 | 인포 카드 / 시트 | 장소 정보·액션 버튼 |
| TaxiDriverCardModal | 전체화면 모달 | 택시기사용 대형 카드 |
| ShareTripModal | 모달 | 공유 링크 생성 |
| TripMaterialsPanel | 패널 | 여행 자료함 (사진·메모) |
| UpgradeModal | 모달 | Plus 구독 안내 |
| OnboardingCoach | 코치마크 | 첫 사용 가이드 |

### 6.3 모바일 전용 UI

| 컴포넌트 | 설명 |
|----------|------|
| MobileTopBar | 상단 검색 pill, 여행·일차 요약 |
| MobileDock | 하단 4버튼: 검색 / 핀 / 동선 / 지도핀 FAB |
| MobileSearchSheet | 검색 바텀시트 (~38vh, 확장 시 ~55vh) |
| MobilePinSheet | 핀·동선 바텀시트 |

**참고 목업**: `docs/mobile-mockups/` (3종 PNG)

---

## 7. 화면별 상세 명세

### 7.1 랜딩 페이지 (`/`)

**목적**: 서비스 소개, 플래너 진입 유도

**섹션 구성**:
- Sticky 네비게이션 (브랜드, Features, How it works, Share plaza, CTA)
- Hero: eyebrow + 타이틀 + 서브타이틀 + Primary/Secondary CTA
- Three pillars (검색·동선·공유)
- Features grid (멀티데이, 카테고리 핀바, 듀얼 지도, 프레젠테이션 모드)
- Positioning 비교표 (Wayknit vs Visit tracker)
- How to start (4단계)
- Final CTA
- Footer

**주요 CTA 카피**:
| 용도 | English | 한국어 |
|------|---------|--------|
| 주 CTA | Start free | 무료로 시작하기 |
| 보조 | Browse share plaza | 공유마당 둘러보기 |
| 플래너 | Open route planner | 동선 플래너 열기 |

---

### 7.2 플래너 (`/plan`) — 핵심 화면

**목적**: 지도 위에서 검색·핀업·동선 생성의 모든 작업 수행

#### 데스크톱 레이아웃 (≥ breakpoint)

```
┌──────────────────────────────────────────────────────────────┐
│ [SearchPanel]     │  TripBar + DayTabs + Theme/Food chips    │
│  좌측 고정 패널    │  PinupBar (카테고리 칩)                    │
│  ~352px           │                                          │
│                   │              지도 (Kakao / Google)        │
│  검색 결과 리스트   │                                          │
│                   │                                          │
│                   │  [RouteSummary] 좌하단                     │
├───────────────────┴──────────────────────────────────────────┤
│ AuthBar 우상단 · SaveStatus · MapProviderPicker              │
└──────────────────────────────────────────────────────────────┘
```

- **RouteOptionsPanel**: 우측에서 슬라이드 인 (~360px)
- **지도**: 전체 viewport 배경 (`100vw × 100vh`)
- **플로팅 패널**: glassmorphism (`backdrop-filter: blur(18px)`)

#### 모바일 레이아웃

```
┌─────────────────────────────┐
│ MobileTopBar (검색 pill)     │
│                             │
│         전체 화면 지도        │
│                             │
│                             │
├─────────────────────────────┤
│ MobileDock: 검색|핀|동선|+  │
└─────────────────────────────┘
     ↑ 바텀시트 열리면 지도 dim
```

#### 검색 패널 기능

- 검색어 입력 (단일 / 쉼표·줄바꿈 다중, 최대 5개)
- 범위: 전국(Nationwide) / 주변(Near map)
- 반경 선택 (주변 검색 시)
- 카테고리 필터
- 내 위치(GPS) 기준 검색
- 결과: 거리·별점·리뷰 정렬
- 각 결과: 핀업, 로드뷰, 사진, 거리 표시
- **PasteCollectPanel**: 텍스트 붙여넣기로 장소 후보 추출

#### 핀업 바 (PinupBar)

- 카테고리별 그룹 칩 (색상 코딩)
- 드래그 앤 드롭 정렬 (`@dnd-kit`)
- 칩 클릭 → 지도 필터 / 동선 선택 토글
- "Must visit" 필터
- **Build route** CTA (선택 또는 전체 핀 기준)
- **Presentation mode**: 발표·가이드용 큰 UI

#### 동선 생성 (Route)

**입력 옵션**:
- 출발지: GPS / 지도 클릭 / 주소·장소명
- 이동수단: 도보 / 대중교통 / 자동차
- 하루 시작·종료 시간
- 일차별 옵션

**출력**:
- 시간표 (도착·출발 시각)
- 구간별 이동거리·시간 (실도로 API 또는 추정)
- 피로도 점수: Low / Medium / High
- 구간별 카카오맵 길찾기 버튼
- 전체 일정 복사 (클립보드)

#### 장소 상세 카드

**표시 정보**:
- English Name / Korean Name / Romanized Name
- Category, Address (도로명·지번)
- Phone, Memo, Stay Time, Priority (1~5)
- Required / Maybe
- Opening status badge (영업중/휴무 등)
- Thumbnail, Photos

**액션 버튼**:
- Copy Korean Name / Copy Korean Address
- Show to Taxi Driver
- Open in KakaoMap / Naver Map / Google Maps
- Add to Itinerary / Remove
- Roadview, Photos

---

### 7.3 택시기사용 카드 (TaxiDriverCardModal)

**목적**: 택시기사·현지인에게 목적지를 큰 글씨로 표시

**콘텐츠 예시**:
```
기사님, 여기로 가주세요.

경복궁
서울특별시 종로구 사직로 161

전화번호: 02-3700-3900

Please take me here.
```

**요구사항**:
- 전체 화면 모달
- 한국어 장소명·주소 **대형 타이포**
- 복사 버튼
- 모바일에서 가독성 최우선

---

### 7.4 Korea Setup (`/setup`)

**목적**: 한국 도착 전/직후 준비 체크리스트

**체크리스트 항목**:
- Airport to Hotel
- SIM / eSIM / Wi-Fi
- Tmoney / Transportation Card
- KakaoMap / Naver Map / Kakao T
- Payment Tips
- Emergency Numbers
- Basic Korean Phrases

**UI**: 체크박스 리스트 + 정보 카드 (Tmoney, eSIM, 앱 안내)  
**상태 저장**: localStorage

---

### 7.5 Help (`/help`)

**섹션**:
- 긴급 연락처 카드: 1330 / 112 / 119 (탭하여 전화)
- 공항 → 숙소 가이드 (정적 단계)
- Korean Phrase Cards (한국어 + 영문 + 복사 버튼)

---

### 7.6 Themes (`/themes`)

**7개 테마 보드** (카드 그리드):

| ID | 테마 | 관련 카테고리 |
|----|------|--------------|
| kfood | K-food | food, market |
| kpop | K-pop / K-drama | culture, shop |
| shopping | Shopping | shop, beauty, market |
| nature | Nature & Trails | tour, road |
| history | Palaces & Hanbok | tour, culture |
| nightlife | Night View | food, cafe, road |
| family | Family-friendly | tour, culture, food |

클릭 시 `/plan?theme={id}` 로 이동

---

### 7.7 Share Plaza (`/plaza`)

**목적**: 공개된 여행 코스 탐색·가져오기

**탭**: Board (리스트) / Map (지도)
- 언어 필터
- 코스 카드: 제목, 일수, 지역, 작성자, 가져오기 버튼
- 가져오기 → 내 플래너에 복제

---

### 7.8 공유 Trip (`/trip/:slug`)

**목적**: 읽기 전용 공유 링크
- 지도 + 핀 + 동선 표시
- 편집 불가, 가져오기 CTA

---

### 7.9 로그인 & 구독

**인증**: Supabase Magic Link (이메일)  
**플랜**:

| 플랜 | 주요 제한 |
|------|----------|
| Free | 여행 N개 제한, 일일 검색 제한 |
| Plus | 무제한 여행, 클라우드 동기화, 다국어 export, 실도로 무제한 |
| Team | (향후) |

**UpgradeModal**: Plus 기능 소개 + CTA

---

## 8. 레이아웃 패턴

### 8.1 지도 우선 (Map-first)

- 지도가 **항상 전체 화면 배경**
- 모든 UI는 지도 위 **플로팅 오버레이**
- 패널·시트 열릴 때 지도는 유지 (dim 처리)

### 8.2 플로팅 표면 (Surface Float)

```css
background: rgba(255, 255, 255, 0.97);
backdrop-filter: blur(18px) saturate(1.15);
border: 1px solid rgba(15, 23, 42, 0.14);
box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
border-radius: 14px;
```

### 8.3 Presentation Mode

- 발표·가이드·수업용 **큰 핀 칩·동선 UI**
- 부가 패널 숨김, 핀업 바 강조
- Esc로 종료

### 8.4 반응형 브레이크포인트

- **모바일**: `useIsMobile()` 훅 기준 (~768px 이하 추정)
- 모바일: `mobile-layout` 클래스 → 데스크톱 오버레이 숨김, Mobile* 컴포넌트 표시

---

## 9. 현재 디자인 시스템

### 9.1 컬러 토큰 (`:root`)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-primary` | `#1f2937` | 주 버튼, 브랜드 다크 |
| `--color-accent` | `#facc15` | 강조 (노란색) |
| `--color-primary-soft` | `#fef9c3` | 소프트 강조 배경 |
| `--color-text-primary` | `#0f172a` | 본문 |
| `--color-text-secondary` | `#475569` | 보조 텍스트 |
| `--color-text-tertiary` | `#94a3b8` | 힌트·비활성 |
| `--color-bg` | `#ffffff` | 기본 배경 |
| `--color-bg-secondary` | `#f1f5f9` | 보조 배경 |
| `--color-map` | `#eaeee8` | 지도 로딩 배경 |
| `--color-info` | `#2563eb` | 정보·링크 |
| `--color-success-bg/text` | `#dcfce7` / `#166534` | 성공 |
| `--color-danger-bg/text` | `#fee2e2` / `#991b1b` | 위험·삭제 |

### 9.2 랜딩 전용 토큰

| 토큰 | 값 |
|------|-----|
| `--landing-bg` | `#fafaf8` |
| `--landing-accent` | `#facc15` |
| `--landing-accent-dark` | `#ca8a04` |
| 브랜드 마크 | `#1f2937` → `#374151` 그라데이션, accent 아이콘 |

### 9.3 Border Radius

| 토큰 | 값 |
|------|-----|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 14px |
| `--radius-xl` | 18px |
| Pill 버튼 | 999px |

### 9.4 Shadow

| 토큰 | 용도 |
|------|------|
| `--shadow-sm` | 칩, 작은 카드 |
| `--shadow-md` | 드롭다운 |
| `--shadow-lg` | 모달 |
| `--shadow-float` | 지도 위 플로팅 패널 |
| `--shadow-float-lg` | 바텀시트, 큰 패널 |

### 9.5 Typography

```css
font-family: -apple-system, BlinkMacSystemFont, 'Pretendard',
  'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;
```

- **현재**: 시스템 폰트 스택 (별도 웹폰트 미로드)
- **권장 검토**: Pretendard 또는 Inter + Noto Sans 계열 통일

### 9.6 아이콘

- **커스텀 SVG 세트**: `src/icons/wayknit-icons.ts`
- 24×24, stroke 1.75, `currentColor`
- 카테고리·검색·핀·동선·자료함 등 50+ 아이콘

### 9.7 UI 라이브러리

- **사용 안 함**: MUI, Chakra, Tailwind 등
- **순수 CSS** (`app.css` ~7,600줄, `landing.css` ~545줄)
- **드래그**: `@dnd-kit`
- **라우팅**: `react-router-dom`
- **i18n**: `react-i18next`

---

## 10. 카테고리 컬러 시스템

지도 마커·핀 칩·배지에 사용되는 카테고리별 색상:

| 카테고리 | 라벨 | 배경색 | 아이콘색 |
|----------|------|--------|----------|
| tour (관광지) | 관광지 | `#facc15` | `#1f2937` |
| food (맛집) | 맛집 | `#fca5a5` | `#7f1d1d` |
| cafe (카페) | 카페 | `#bfdbfe` | `#1e3a8a` |
| stay (숙소) | 숙소 | `#c4b5fd` | `#4c1d95` |
| culture (문화) | 문화 | `#fdba74` | `#7c2d12` |
| shop (쇼핑) | 쇼핑 | `#86efac` | `#14532d` |
| beauty (뷰티) | 뷰티 | `#fbcfe8` | `#9d174d` |
| market (시장) | 시장 | `#fde68a` | `#92400e` |
| transport (교통) | 교통 | `#a5f3fc` | `#155e75` |
| road (거리) | 거리 | `#d1d5db` | `#374151` |
| other (기타) | 기타 | `#e5e7eb` | `#374151` |

**디자인 시 참고**: 카테고리 색은 지도 위에서 동시에 다수 표시되므로 **서로 구분 가능**하면서 **브랜드 톤과 조화**되어야 함.

---

## 11. 컴포넌트 인벤토리

### 페이지

| 파일 | 역할 |
|------|------|
| `LandingPage.tsx` | 랜딩 |
| `PlannerPage.tsx` | 메인 플래너 |
| `ShareTripPage.tsx` | 공유 읽기 |
| `SharePlazaPage.tsx` | 공유마당 |
| `KoreaSetupPage.tsx` | 준비 체크리스트 |
| `HelpPage.tsx` | 도움말 |
| `ThemesPage.tsx` | 테마 보드 |
| `LoginPage.tsx` | 로그인 |
| `AdminPage.tsx` | 관리자 |

### 플래너 핵심 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| `MapView.tsx` | 카카오 지도 |
| `GoogleMapView.tsx` | 구글 지도 |
| `SearchPanel.tsx` | 검색 패널 |
| `PinupBar.tsx` | 핀업 바 |
| `DayTabs.tsx` | 일차 탭 |
| `TripBar.tsx` | 여행 제목·메뉴 |
| `RouteOptionsPanel.tsx` | 동선 옵션 |
| `RouteSummary.tsx` | 동선 요약 |
| `PlaceActionBar.tsx` | 장소 액션 |
| `PlaceDetailTabPanels.tsx` | 장소 상세 탭 |
| `TaxiDriverCardModal.tsx` | 택시 카드 |
| `ThemePreferenceChips.tsx` | 테마 칩 |
| `FoodRestrictionChips.tsx` | 음식 제약 칩 |
| `PasteCollectPanel.tsx` | 붙여넣기 수집 |
| `ShareTripModal.tsx` | 공유 모달 |
| `UpgradeModal.tsx` | 구독 모달 |
| `OnboardingCoach.tsx` | 온보딩 |
| `AuthBar.tsx` | 인증 바 |
| `SaveStatusBadge.tsx` | 저장 상태 |
| `MapProviderPicker.tsx` | 지도 선택 |
| `OpenStatusBadge.tsx` | 영업 상태 |
| `PwaInstallButton.tsx` | PWA 설치 |

### 모바일

| 컴포넌트 | 역할 |
|----------|------|
| `MobileTopBar.tsx` | 상단 바 |
| `MobileDock.tsx` | 하단 도크 |
| `MobileSearchSheet.tsx` | 검색 시트 |
| `MobilePinSheet.tsx` | 핀 시트 |
| `MobileSheet.tsx` | 공통 시트 래퍼 |

---

## 12. 인터랙션 & 상태

### 12.1 드래그 앤 드롭

- 핀 칩, 동선 리스트 모두 `@dnd-kit` 기반
- 드래그 시 grip 아이콘, ghost 상태
- 사용자가 순서 변경 시 자동 최적화 OFF

### 12.2 Empty State

| 위치 | 메시지 (EN) |
|------|-------------|
| 검색 | Find places by keyword or category. |
| 핀 없음 | Search or pin places on the map |
| 검색 결과 없음 | No results found. |

**힌트 예시**: Gyeongbokgung, Hongdae, Gwangjang Market, Seongsu Cafe Street

### 12.3 Loading / Error

- 지도 로딩 실패 → 안내 메시지 (API 키 누락 등)
- 검색 중 → "Searching…"
- 실도로 보강 중 → "Applying real roads…"
- 저장 상태 → SaveStatusBadge (저장 중 / 저장됨 / 오류)

### 12.4 Toast

- 복사 완료, 가져오기 완료 등 짧은 피드백

### 12.5 피로도 표시

| Level | 조건 (대략) |
|-------|------------|
| Low | 장소 ≤4, 거리 ≤10km, 총시간 ≤8h |
| Medium | 장소 5~6, 거리 10~25km |
| High | 장소 ≥7, 거리 ≥25km |

색상: Low=green, Medium=amber, High=red 계열 권장

---

## 13. 카피라이팅 가이드

### 13.1 톤 & 보이스

- **친근하고 실용적** (관광객 동반자 느낌)
- **과장 없음** (AI·예약 앱처럼 들리지 않게)
- **행동 유도 명확** (Pin, Build route, Copy, Show to taxi driver)
- 플래너 화면은 **영어 우선**, 한국어는 현지 이동용 정보로 제공

### 13.2 핵심 CTA

| EN | KO |
|----|-----|
| Start free | 무료로 시작하기 |
| Build route | 동선 만들기 |
| Generate route | 경로 생성 |
| Show to Taxi Driver | 택시기사에게 보여주기 |
| Copy full itinerary | 전체 일정 복사 |
| Create My Korea Route | (레거시) 한국 동선 만들기 |

### 13.3 SEO 키워드

- **국내**: 여행 동선, 일정 짜기, 코스 플래너, 다일차 여행, 카카오맵 일정
- **해외**: trip route planner, itinerary map, Korea travel planner

---

## 14. 다국어 & 접근성

### 14.1 지원 언어

| Locale | URL prefix | 상태 |
|--------|------------|------|
| ko | (기본) | 완료 |
| en | `/en/` | 완료 |
| ja | `/ja/` | 완료 |
| zh | `/zh/` | 완료 |

번역 파일: `src/locales/{locale}/{namespace}.json`  
네임스페이스: `common`, `planner`, `landing`, `share`, `auth`, `billing`

### 14.2 접근성 요구사항

- 버튼·링크에 `aria-label` (특히 아이콘 전용 버튼)
- 모달: `role="dialog"`, `aria-modal`, Esc 닫기
- 탭·도크: `aria-pressed` 상태
- **택시 카드**: 고령 택시기사도 읽을 수 있는 **큰 글씨** (최소 24px+ 권장)
- 색상 대비 WCAG AA 이상 목표
- 터치 타깃 최소 44×44px (모바일)

---

## 15. 경쟁·벤치마크

| 앱 | 관계 | 참고 포인트 |
|----|------|------------|
| **Pin Traveler** | 기능 대비 | 방문 기록 vs 동선 — 우리는 후자 |
| **Wayby** | 직접 경쟁 | 카카오 검색·동선 최적화 |
| **Wanderlog** | 간접 경쟁 | 글로벌 여행 플래너 UX |
| **Triple (트리플)** | 국내 경쟁 | 일정+예약 슈퍼앱 — 우리는 코스 짜기만 |
| **Google Maps** | 도구 | Saved lists — 우리는 시간표 동선 |

**벤치마크 URL**:
- https://pintraveler.net/
- https://wayby.me/
- https://wanderlog.com/

---

## 16. 구현 현황 vs 미완

### ✅ 구현 완료

- 듀얼 지도 (Kakao + Google)
- 장소 검색·핀업·카테고리 필터
- 드래그 정렬, 멀티데이 탭
- 자동 동선 생성 (NN + 실도로 보강)
- 피로도 점수
- 택시기사용 카드
- 3종 지도 링크 (카카오/네이버/구글)
- 테마·음식 제약 칩
- i18n (ko/en/ja/zh)
- Supabase 클라우드 저장·공유 링크
- 공유마당
- Korea Setup / Help / Themes 페이지
- PWA
- 모바일 레이아웃 (도크 + 바텀시트)
- PasteCollect (붙여넣기 수집)
- 프레젠테이션 모드
- 구독 UI (Free/Plus)

### ⏳ 미완 / 후속

- Tour API 연동 (관광공사 데이터)
- 친구 투표·공동 편집
- PDF 오프라인 팩 (텍스트 복사는 제공)
- 실시간 영업시간 100% 자동 수집
- 결제 체크아웃 실연동
- 앱 스토어 네이티브 앱

### 🎨 디자인 개선이 필요한 영역 (에이전트 우선 검토 권장)

1. **브랜드·비주얼 시스템 강화** — 로고·워드마크·컬러 토큰 정리
2. **디자인 토큰 체계화** — 현재 CSS 변수 산재, Figma 토큰화 필요
3. **모바일 UX polish** — 도크·시트 전환, 제스처, 스냅 포인트
4. **장소 상세 카드** — 정보 밀도·액션 버튼 계층
5. **택시 카드** — 가독성·브랜드 일관성
6. **랜딩 페이지** — 스크린샷·일러스트·신뢰 요소
7. **Empty / Error / Loading** — 일관된 일러스트·메시지
8. **다크 모드** — 미구현
9. **아이콘 세트** — 통일성 검토 또는 외부 아이콘 팩 도입
10. **온보딩 코치마크** — 시각적 가이드 개선

---

## 17. 디자인 에이전트 산출물 요청

### 17.1 필수 산출물

| # | 산출물 | 설명 |
|---|--------|------|
| 1 | **브랜드 가이드** | 로고, 컬러, 타이포, 톤앤매너 |
| 2 | **디자인 토큰** | Figma Variables 또는 JSON |
| 3 | **컴포넌트 라이브러리** | Button, Chip, Card, Sheet, Modal, Input, Badge 등 |
| 4 | **데스크톱 와이어/하이파이** | `/plan` 메인 (검색·핀·동선·상세) |
| 5 | **모바일 하이파이** | 지도+도크, 검색시트, 핀시트, 택시카드 |
| 6 | **랜딩 페이지** | Hero ~ Footer 전체 |
| 7 | **서브 페이지** | Setup, Help, Themes, Plaza, Share |
| 8 | **상태 시안** | Empty, Loading, Error, Disabled |
| 9 | **카테고리 컬러 팔레트** | 11개 카테고리 재정의 |
| 10 | **프로토타입** | 핵심 플로우 3개 (검색→핀→동선, 택시카드, 공유) |

### 17.2 핵심 플로우 (프로토타입 필수)

1. **서울 첫 방문 코스 만들기**: 검색 5곳 → 핀업 → 동선 생성 → 길찾기
2. **택시 이동**: 장소 선택 → Show to Taxi Driver → 복사
3. **공유마당에서 가져오기**: Plaza 탐색 → Import → 플래너 편집

### 17.3 파일 형식

- Figma (선호) 또는 Sketch
- 컴포넌트는 Auto Layout + Variants
- 아이콘: SVG export
- 스크린: `@2x` PNG 또는 Figma Dev Mode
- 컬러·타이포: CSS custom properties 호환 JSON

### 17.4 디자인 원칙 (에이전트 준수 사항)

1. **지도가 주인공** — UI는 지도를 가리지 않도록 반투명·컴팩트
2. **모바일 퍼스트** — 해외 관광객의 주 사용 환경은 스마트폰
3. **한 손 조작** — 하단 도크·FAB, 엄지 영역 CTA
4. **정보 계층** — 영문 이름 > 한국어 주소 > 부가 정보
5. **즉시 행동** — Copy, Open map, Show to driver는 1탭 이내
6. **경량 UI** — 무거운 UI 프레임워크 룩앤필 지양, 네이티브 앱 느낌

---

## 18. 제약 & 범위 외

### 기술 제약

- React SPA (Vite), 별도 UI 라이브러리 없음
- 지도: Kakao Maps SDK + Google Maps JS API (임베드, 커스텀 스타일 제한)
- CSS 기반 스타일링 (Tailwind 도입 여부는 개발팀 결정)
- `@dnd-kit` 드래그 UX 유지

### 디자인 범위 외

- 네이티브 iOS/Android 앱 UI
- 결제 PG 화면 상세
- 관리자 콘솔 전체 리디자인 (낮은 우선순위)
- 이메일 템플릿
- 소셜 미디어 배너 (별도 요청 시)

### MVP 제외 기능 (디자인 불필요)

- 앱 내 턴바이턴 내비게이션
- 실시간 교통 완전 최적화
- 예약·결제 직접 처리
- AI 채팅 인터페이스
- 친구 실시간 공동 편집

---

## 19. 참고 자료

### 내부 문서

| 파일 | 내용 |
|------|------|
| `docs/cursor_prd_yeorodam_wayknit.md` | 개발용 PRD (기능 상세) |
| `docs/positioning-copy.md` | 포지셔닝·카피 |
| `docs/mobile-mockups/` | 모바일 UI 목업 3종 |
| `name.md` | 브랜드명 확정·네이밍 아카이브 |
| `README.md` | 기술 개요·알고리즘 |

### 코드 참조

| 경로 | 내용 |
|------|------|
| `src/styles/app.css` | 플래너 스타일 (~7,600줄) |
| `src/styles/landing.css` | 랜딩 스타일 |
| `src/lib/categories.ts` | 카테고리 색상·아이콘 |
| `src/locales/en/planner.json` | 영문 UI 카피 |
| `src/locales/en/landing.json` | 영문 랜딩 카피 |
| `src/icons/wayknit-icons.ts` | 아이콘 세트 |

### 라이브 서비스

- **랜딩**: https://wayknit.netlify.app/
- **플래너**: https://wayknit.netlify.app/plan
- **공유마당**: https://wayknit.netlify.app/plaza
- **Setup**: https://wayknit.netlify.app/setup
- **Help**: https://wayknit.netlify.app/help
- **Themes**: https://wayknit.netlify.app/themes

---

## 부록 A. 데이터 모델 요약 (UI 이해용)

### Trip

```
id, slug, title, totalDays, currentDay
pinnedByDay: { [day]: PinnedPlace[] }
routeOptionsByDay: { [day]: RouteOptions }
generatedRouteByDay: { [day]: GeneratedRoute }
preferences?: TripTheme[]
foodRestrictions?: FoodRestriction[]
materials?: TripMaterial[]
```

### Place / PinnedPlace

```
id, name, nameKo?, romanizedName?, category, lat, lng
address, roadAddress?, phone?, stayMinutes?, note?
priority? (1-5), required?, day, order
openingHours?, closedDays?, rating?, thumbnailUrl?
```

### GeneratedRoute

```
stops: [{ ...place, arriveAt, leaveAt }]
legs: [{ from, to, distanceKm, travelMinutes }]
fatigueLevel: 'low' | 'medium' | 'high'
totalDistanceKm, totalTravelMinutes
```

---

## 부록 B. 체류시간 기본값

| 카테고리 | 기본 시간 |
|----------|----------|
| tour (관광) | 90분 |
| food (맛집) | 60분 |
| cafe (카페) | 45분 |
| culture (문화) | 75분 |
| shop (쇼핑) | 30분 |
| stay (숙소) | 0분 |

---

*이 문서는 Wayknit 개발팀이 유지·갱신합니다. 질문은 프로젝트 저장소 이슈 또는 담당자에게 문의하세요.*
