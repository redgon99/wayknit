# Wayknit 수익화 분석 — Claude 대화 요약

> 작성 기준: 2026-06-06  
> 출처: Claude Code 대화 (수익화 관점 분석 + 멀티플랫폼 전략)

---

## 1. 현재 프로젝트 수익화 장단점

### 강점

1. **수익화 인프라가 이미 구축됨**
   - DB에 `plan`, `subscription_status`, `subscription_expires_at` 필드 존재
   - `subscription.ts`에 Free/Plus/Team 제한 로직 구현 완료
   - `UpgradeModal` 컴포넌트, `VITE_PLUS_CHECKOUT_URL` 환경변수 연결 지점 준비됨
   - 결제 연동(Toss/Stripe)만 붙이면 수익화 시작 가능한 상태

2. **제한 기준이 명확하고 사용자가 체감하기 쉬움**
   - Free 3개 trip, Google 검색 일 40회, export 불가 — 기능 차이가 뚜렷함
   - "더 쓰고 싶다" 욕구를 자연스럽게 만드는 캡 구조

3. **예약·커머스 경쟁 없이 도구 포지션 유지**
   - 트리플·마이리얼트립과 정면충돌 없이 "동선 도구"로 차별화
   - 구독 단가가 낮아도 낮은 CAC(바이럴·공유마당)으로 커버 가능

4. **다국어(ko/en/ja/zh) + 이중 지도(카카오+Google)**
   - 해외 인바운드 여행자 대상 영어·일어 export가 Plus 킬러 기능
   - 국내 외국인 관광객(방한 시장)이라는 명확한 유료 타겟 세그먼트 존재

5. **공유마당(SharePlaza)으로 인바운드 유입**
   - UGC 코스 공유 → SEO → 신규 유저 유입 → 전환 퍼널로 작동 가능

### 약점

1. **결제 연동이 전혀 없음 (MVP의 가장 큰 구멍)**
   - `VITE_PLUS_CHECKOUT_URL`이 비어있으면 "준비 중" 안내만 뜸
   - Toss Billing 또는 Stripe 웹훅 → `profiles.plan` 자동 반영까지 연결 안 됨
   - **지금 당장 유료 사용자 받을 수 없는 상태**

2. **Google 검색 캡이 클라이언트 사이드(localStorage)**
   - 브라우저 개발자 도구로 `wayknit:google-search-count` 삭제하면 무력화
   - 서버 사이드 카운터(Supabase RLS 기반)로 이전 필요

3. **export 기능 자체가 미완성**
   - Plus의 핵심 가치인 "다국어 일정 export"가 아직 구현되지 않음
   - 유료화 이유를 설명하지만 실제로 제공하지 못하면 전환 후 이탈 발생

4. **클라우드 동기화도 Plus 전용 → 로그인 혜택이 없음**
   - 로그인해도 Free면 동기화 안 됨 → "왜 로그인하죠?" 유저 혼란 가능
   - 로그인 유도 → 클라우드 저장 → Plus 업셀 퍼널이 끊겨 있음

5. **Team 플랜 기능이 전혀 없음**
   - 가격 테이블에 Team이 있지만 실제 공동편집·좌석관리·화이트라벨 없음

6. **카카오 API 의존도 높음**
   - 카카오 장소 데이터가 한국 중심 → 영문 export 시 POI명이 한글로 나올 수 있음
   - Google Places 비용을 Free에서 누가 부담하는지 명확한 기준 없음

### 즉시 해결해야 할 우선순위

| 순위 | 이슈 | 임팩트 |
|------|------|--------|
| 1 | **결제 연동 (Toss or Stripe)** | 수익 0원 → 첫 수익 |
| 2 | **export 기능 구현** | Plus 전환 이유 완성 |
| 3 | **Google 검색 캡 서버 사이드 이전** | 제한 신뢰도 확보 |
| 4 | **Free 로그인 혜택 추가** | 로그인 퍼널 → 업셀 연결 |

---

## 2. 윈도우·태블릿·모바일 전방위 수익화 전략

### 핵심 전제: 코드 한 벌, 플랫폼 여러 개

현재 Wayknit는 PWA가 이미 세팅되어 있어 이를 최대한 활용하는 것이 가장 빠른 길이다.

### 플랫폼별 배포 전략

```
웹 브라우저 (현재) ─────── Netlify 배포 → 즉시 접근 가능
       │
       ├── PWA (이미 구축) ─── 홈 화면 추가 → 모바일·태블릿 앱처럼 동작
       │
       ├── Tauri ───────────── 윈도우 .exe 패키지 → MS Store 등록
       │
       └── Capacitor ──────── iOS .ipa / Android .apk → 앱스토어 등록
```

**권장 우선순위:**

| 단계 | 플랫폼 | 방법 | 기간 |
|------|--------|------|------|
| 1단계 | **웹 + 모바일 PWA** | 현재 코드 그대로, 결제만 붙이기 | 즉시 |
| 2단계 | **Android/iOS 앱** | Capacitor로 현재 웹앱 래핑 | 2~4주 |
| 3단계 | **윈도우 앱** | Tauri로 패키징 → MS Store | 4~8주 |

### 플랫폼별 수익화 방법의 차이 (중요)

```
웹 (Toss/Stripe)    → 수수료 2~3%, 자유로운 가격 정책
Android (Play)      → 인앱결제 강제, 수수료 15~30%
iOS (App Store)     → 인앱결제 강제, 수수료 15~30%
Windows (MS Store)  → 앱 내 웹결제 허용 가능, 수수료 15%
```

**전략:** 웹에서 구독 가입하면 앱에서도 동일하게 사용 가능한 구조를 만들면 앱 수수료를 합법적으로 회피할 수 있다. Supabase `profiles.plan`이 이걸 가능하게 해준다.

### 구체적인 실행 로드맵

#### Phase 1 — 웹 수익화 완성

1. **Toss Payments 결제 연동** → `VITE_PLUS_CHECKOUT_URL` 설정
2. **웹훅 → Supabase `profiles.plan` 갱신** → Netlify Edge Function 하나 추가
3. **export 기능 구현** → PNG 스크린샷 or HTML→PDF (jsPDF)

#### Phase 2 — 모바일 앱 (Capacitor 추천)

Capacitor를 추천하는 이유:
- 현재 React 코드를 거의 그대로 사용
- Vite 빌드 결과물을 그대로 래핑
- Electron보다 모바일에 훨씬 최적화

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npx cap init
npx cap add android
npx cap add ios
```

앱스토어 인앱결제 대신 "웹에서 구독" 유도 문구를 앱 내에 넣으면 수수료 없이 운영 가능. (iOS는 외부 결제 링크 정책 주의 필요)

#### Phase 3 — 윈도우 앱 (Tauri 추천)

Tauri를 추천하는 이유:
- Electron보다 번들 크기가 10배 이상 작음 (설치파일 ~3MB)
- Rust 기반으로 성능·보안 우수
- MS Store 배포 가능, 웹결제 링크 그대로 열 수 있어 수수료 이슈 없음

```bash
npm install @tauri-apps/cli
npm run tauri init
```

### 플랫폼 통합 핵심 — Supabase Auth가 열쇠

```
유저가 웹에서 Plus 구독
       ↓
Supabase profiles.plan = 'plus'
       ↓
앱(Capacitor), PWA, 윈도우(Tauri) 어디서든 동일 계정으로 로그인
       ↓
모든 플랫폼에서 Plus 기능 사용
```

이미 Supabase Auth가 구축되어 있으므로 **계정 동기화는 추가 작업 없이** 된다.

### 수익화 모델별 플랫폼 적합도

| 수익 모델 | 웹 | 모바일 앱 | 윈도우 |
|-----------|:--:|:---------:|:------:|
| 구독 (Plus/Team) | ✅ 최적 | ⚠️ 수수료 주의 | ✅ 웹결제 가능 |
| 일회성 export 구매 | ✅ | ⚠️ | ✅ |
| B2B 라이선스 (Team) | ✅ | — | ✅ 기업용 |
| 광고 (Free tier) | ✅ | ✅ | ⚠️ 경험 저하 |

### 한 줄 요약

**지금 당장은 웹 결제를 완성하고, 그 다음 Capacitor로 앱 래핑.** Supabase 계정이 모든 플랫폼을 하나로 묶어주기 때문에, 결제 인프라를 웹 하나에 집중시키면 나머지 플랫폼은 껍데기만 씌우는 작업이 된다. 윈도우는 여행 플래너 특성상 시장이 작으니 가장 마지막으로 두는 것이 적절하다.
