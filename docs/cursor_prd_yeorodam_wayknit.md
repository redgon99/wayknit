# PRD: 여로담 / Wayknit

> Cursor 개발용 제품 요구사항 문서  
> 프로젝트 성격: 카카오맵 기반 SPA 여행계획 MVP  
> 타깃: 대한민국을 방문하는 해외 관광객  
> 현재 배포 초안: `https://wayknit.netlify.app/` / `https://wayknit.netlify.app/plan`  
> 작성 기준: 오늘 대화에서 정의한 MVP, 앱명 검토, 해외 관광객 대상 확장 전략, 기능 아이디어를 통합 정리

---

## 1. 제품 개요

### 1.1 제품명

- 한글 서비스명: **여로담**
- 영문 서비스명: **Wayknit**
- npm / 저장소명: **`wayknit`**

### 1.2 한 줄 정의

**대한민국 여행에서 가고 싶은 곳을 찾고, 모으고, 지도에 펼치고, 이동 동선과 일정으로 엮어주는 외국인용 지도형 여행 플래너.**

### 1.3 영문 포지셔닝 문장

**Plan your Korea trip on a map. Save places, create routes, and get Korean addresses for easy navigation.**

### 1.4 한국어 포지셔닝 문장

**가고 싶은 한국 여행지를 모으면, 한국어 주소와 이동 동선까지 한눈에 정리해주는 외국인용 지도 여행 플래너.**

---

## 2. 제품 배경

사용자는 한국 여행을 준비할 때 여러 앱과 정보를 오가야 한다.

- 인스타그램, 틱톡, 유튜브, 블로그에서 장소를 발견한다.
- 구글맵, 카카오맵, 네이버지도에서 각각 장소를 다시 검색한다.
- 장소명을 영어로 알고 있지만 실제 현장에서는 한국어 상호와 주소가 필요하다.
- 가고 싶은 장소는 많지만 지역 간 거리감이 부족해 동선이 비효율적이다.
- 택시, 대중교통, 도보 이동 시 앱 전환과 주소 복사가 번거롭다.
- 한국 도착 직후 공항에서 숙소까지 이동, 교통카드, eSIM, 지도앱 설치 등 기본 준비가 어렵다.

이 앱은 단순 관광정보 제공 앱이 아니라, **장소 수집 → 지도 표시 → 일정 생성 → 이동 실행**까지 이어지는 과정을 한 화면에서 처리하는 SPA 여행 어시스턴트를 목표로 한다.

---

## 3. 핵심 사용자

### 3.1 Primary Persona: 한국 첫 방문 해외 관광객

- 언어: 영어, 일본어, 중국어 사용자 우선
- 여행 기간: 서울 3~5일 또는 서울+부산/경주/제주
- 관심사: K-food, 카페, K-pop, K-drama, 쇼핑, 뷰티, 궁궐, 시장, 야경
- 문제:
  - 한국어 장소명과 주소를 모른다.
  - 동선을 어떻게 묶어야 할지 모른다.
  - 현지 지도앱 사용이 어렵다.
  - 택시기사나 식당 직원에게 목적지를 설명하기 어렵다.

### 3.2 Secondary Persona: 한국 재방문 관광객

- 이미 서울 주요 관광지는 방문했다.
- 성수, 연남, 익선, 망원, 부산, 경주, 제주 등 세부 지역을 탐색한다.
- 카페, 맛집, 팝업스토어, 뷰티, 쇼핑, 로컬 마켓 중심의 여행을 계획한다.

### 3.3 Secondary Persona: 친구/커플/가족 여행자

- 여러 명이 각자 가고 싶은 곳을 모은다.
- 후보지 투표, 필수/선택 분류, 일정 공유가 필요하다.

---

## 4. 제품 목표

### 4.1 MVP 목표

1. 카카오맵 기반 지도 중심 SPA를 제공한다.
2. 사용자가 장소를 검색하고 저장할 수 있다.
3. 저장한 장소를 카테고리별로 지도 위에 표시한다.
4. 장소 리스트를 기반으로 자동 일정과 이동 순서를 추천한다.
5. 카카오맵 길찾기 URL로 실제 이동을 연결한다.
6. 외국인 관광객에게 필요한 한국어 장소명, 주소 복사, 택시기사용 카드 기능을 제공한다.

### 4.2 확장 목표

1. 영어 중심 UI와 다국어 구조를 갖춘다.
2. K-food, K-pop, 쇼핑, 뷰티, 궁궐, 시장 등 외국인 테마 기반 추천을 제공한다.
3. 공항 → 숙소 이동 마법사를 제공한다.
4. 한국 여행 준비 체크리스트를 제공한다.
5. 오프라인 여행팩, 1330 도움 연결, 음식 제약 필터 등을 제공한다.

---

## 5. 성공 기준

### 5.1 사용자 행동 기준

- 사용자가 첫 방문에서 장소를 3개 이상 저장한다.
- 사용자가 자동 일정 생성 버튼을 클릭한다.
- 사용자가 카카오맵/네이버지도/구글맵 외부 길찾기 링크를 클릭한다.
- 사용자가 한국어 주소 복사 또는 택시기사용 카드 기능을 사용한다.

### 5.2 MVP 품질 기준

- 모바일 화면에서 지도, 장소 리스트, 일정표가 모두 사용 가능해야 한다.
- 장소 검색 실패, API 키 누락, 지도 로딩 실패 등 예외 상태를 안내해야 한다.
- 새로고침 후에도 localStorage 기준 저장 장소와 일정이 유지되어야 한다.
- 외국인 사용자를 위한 기본 영문 문구가 제공되어야 한다.

---

## 6. 현재 MVP 가정 상태

**코드 기준 (Wayknit / wayknit v0.2.0, 2026-06)** — PRD 초안보다 앞선 하이브리드 MVP.

- Vite + React + TypeScript SPA (`/`, `/plan`, `/trip/:slug`, `/plaza`, `/setup`, `/help`, `/themes`)
- **듀얼 지도**: Kakao Map + Google Maps (위치·사용자 선택)
- 장소 검색: 전국/주변, 카테고리 필터, 다중 검색어(첫 줄), 붙여넣기 후보 추출
- **저장**: localStorage + Supabase (선택 로그인·클라우드 동기화)
- 핀업·일차·동선 생성 (nearest-neighbor + 실도로 API 보강)
- 외국인 MVP: 택시 카드, 3종 지도 링크, 테마 칩, 피로도, 전체 일정 복사, 필수 방문·우선순위
- i18n: ko/en/ja/zh, locale URL prefix
- PWA, 공유 링크, 공유마당, 구독/관리자 콘솔
- 모바일: 상단 검색 pill, 하단 dock, 바텀시트

미완/후속: Tour API, 친구 투표, PDF 오프라인 팩, 실시간 공동 편집.

---

## 7. 핵심 제품 컨셉

이 앱의 핵심 흐름은 다음 네 단계다.

```txt
Find → Collect → Map → Route
찾기 → 담기 → 지도에 펼치기 → 동선으로 엮기
```

사용자가 해야 할 일은 최소화한다.

1. 가고 싶은 장소나 관심 키워드를 입력한다.
2. 장소 후보를 확인하고 저장한다.
3. 지도 위에서 카테고리별로 확인한다.
4. 자동 일정 생성 버튼을 누른다.
5. 필요 시 순서를 수정한다.
6. 실제 이동은 카카오맵/네이버지도/구글맵으로 연결한다.

---

## 8. 정보 구조 IA

### 8.1 주요 메뉴 (구현 라우트)

```txt
/ (Landing)
/plan (PlannerPage) — Map + Search + Pin + Route
  - SearchPanel / MobileSearchSheet + PasteCollectPanel
  - PinupBar, RouteOptionsPanel, RouteSummary
  - ThemePreferenceChips, FoodRestrictionChips

/trip/:slug — 공유 읽기 전용
/plaza — 공유마당
/setup — Korea Setup 체크리스트 (localStorage)
/help — 1330·112·119, 공항 가이드, Phrase Cards
/themes — 테마 보드 → /plan?theme=

Collect (Plan 내 통합)
- 붙여넣기 후보 추출 (PasteCollectPanel)
- 쉼표/줄바꿈 다중 검색어 (첫 항목 검색)

Help (장소 상세·/help)
- Show to Taxi Driver (TaxiDriverCardModal)
- Copy Korean name/address
- Kakao / Naver / Google 링크
- 1330 / 112 / 119
- Korean Phrase Cards
```

### 8.2 라우트 구조

```txt
/
- 랜딩 페이지
- 서비스 소개
- Start Planning 버튼

/plan
- 메인 지도형 SPA
- 장소 검색, 저장, 필터, 일정 생성, 길찾기

/setup
- Korea Setup 메뉴
- 공항 이동, 교통카드, 필수 앱, 결제 팁

/themes
- 테마별 추천 장소 보드

/help
- 택시기사용 카드, 긴급 연락처, 한국어 문장 카드
```

현재 구현: `/plan` 중심 + 독립 라우트 `/setup`, `/themes`, `/help` (2026-06).

---

## 9. 기능 요구사항

## FR-001. 지도 중심 SPA

### 설명

사용자는 하나의 큰 지도 화면에서 장소 검색, 저장, 필터링, 일정 생성, 길찾기를 수행할 수 있어야 한다.

### 요구사항

- 카카오맵을 전체 화면 또는 화면 대부분에 렌더링한다.
- 지도 위에 검색창, 필터, 저장 장소 패널, 일정 패널을 오버레이한다.
- 모바일에서는 하단 바텀시트 형태로 장소 리스트와 일정표를 표시한다.
- 지도 로딩 실패 시 안내 메시지를 표시한다.

### 수용 기준

- `/plan` 진입 시 지도가 표시된다.
- 지도 위에 장소 마커가 표시된다.
- 장소 선택 시 상세 카드가 열린다.
- 모바일에서도 주요 버튼이 가려지지 않는다.

---

## FR-002. 장소 검색

### 설명

사용자는 장소명, 키워드, 지역명을 입력해 카카오 장소 검색을 수행할 수 있어야 한다.

### 요구사항

- 단일 검색어 검색을 지원한다.
- 쉼표, 줄바꿈 기준 다중 검색어 입력을 지원한다.
- 검색 결과는 리스트와 지도 마커로 표시한다.
- 사용자가 결과를 클릭하면 지도 중심을 해당 장소로 이동한다.
- 검색 결과에서 장소를 저장할 수 있다.

### 예시 입력

```txt
Gyeongbokgung, Bukchon Hanok Village, Gwangjang Market, Myeongdong, N Seoul Tower
```

### 수용 기준

- 검색어 입력 후 결과가 표시된다.
- 여러 장소명을 붙여 넣으면 각각 검색 후보가 생성된다.
- 결과에서 장소 저장 버튼을 누르면 내 장소 목록에 추가된다.

---

## FR-003. 장소 저장 및 관리

### 설명

사용자는 검색한 장소를 여행 계획에 저장하고, 카테고리, 메모, 중요도, 필수 여부, 체류시간을 편집할 수 있어야 한다.

### 요구사항

- 장소 저장
- 장소 삭제
- 메모 작성
- 중요도 1~5 설정
- 필수 방문 여부 설정
- 체류시간 설정
- 카테고리 수동 변경
- localStorage 저장

### 기본 체류시간

```txt
restaurant: 60분
cafe: 45분
tour: 90분
hotel: 0분
road: 30분
shopping: 90분
etc: 60분
```

### 수용 기준

- 장소 저장 후 새로고침해도 유지된다.
- 사용자가 카테고리와 메모를 수정할 수 있다.
- 필수 방문 장소는 자동 일정 생성 시 우선 반영된다.

---

## FR-004. 카테고리 자동 분류

### 설명

카카오 카테고리 정보와 장소명 키워드를 기반으로 앱 내부 카테고리를 자동 지정한다.

### 기본 카테고리

```ts
type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'tour'
  | 'hotel'
  | 'road'
  | 'shopping'
  | 'beauty'
  | 'market'
  | 'transport'
  | 'etc'
```

### 카카오 카테고리 매핑 예시

```ts
const kakaoCategoryMap = {
  FD6: 'restaurant',
  CE7: 'cafe',
  AT4: 'tour',
  AD5: 'hotel',
  CT1: 'tour',
  MT1: 'shopping',
  CS2: 'etc',
}
```

### 추가 키워드 매핑 예시

```txt
palace, hanok, museum, tower → tour
market, street food → market
olive young, beauty, skincare → beauty
station, airport, terminal → transport
beach, coast, trail, road → road
```

### 수용 기준

- 장소 저장 시 기본 카테고리가 자동 지정된다.
- 사용자가 카테고리를 수정할 수 있다.
- 필터 UI에서 카테고리별 표시/숨김이 가능하다.

---

## FR-005. 카테고리 필터

### 설명

지도와 장소 리스트에서 카테고리별 표시를 제어할 수 있어야 한다.

### 필터 항목

```txt
All
Restaurants
Cafes
Tourist Spots
Hotels
Roads / Trails
Shopping
Beauty
Markets
Transport
Must Visit
Maybe
```

### 수용 기준

- 필터를 끄면 해당 카테고리 마커가 지도에서 사라진다.
- 필터 상태는 장소 리스트에도 반영된다.
- 필수 방문지만 보기 필터를 제공한다.

---

## FR-006. 장소 상세 카드: 외국인용 정보

### 설명

외국인 관광객이 실제 이동과 현장 커뮤니케이션에 사용할 수 있는 정보를 제공한다.

### 표시 정보

```txt
English Name
Korean Name
Romanized Name
Category
Korean Address
Road-name Address
Phone Number
Memo
Stay Time
Priority
Required / Maybe
```

### 버튼

```txt
Copy Korean Name
Copy Korean Address
Show to Taxi Driver
Open in KakaoMap
Open in Naver Map
Open in Google Maps
Add to Itinerary
Remove
```

### 수용 기준

- 한국어 주소를 버튼으로 복사할 수 있다.
- 지도앱 링크 버튼이 표시된다.
- 택시기사용 카드 버튼이 표시된다.

---

## FR-007. Show to Taxi Driver 카드

### 설명

택시기사나 현지인에게 목적지를 큰 글씨로 보여주는 화면을 제공한다.

### 화면 예시

```txt
기사님, 여기로 가주세요.

경복궁
서울특별시 종로구 사직로 161

전화번호: 02-3700-3900

Please take me here.
```

### 요구사항

- 전체 화면 모달로 표시한다.
- 한국어 장소명과 주소를 크게 표시한다.
- 복사 버튼을 제공한다.
- 닫기 버튼을 제공한다.

### 수용 기준

- 장소 카드에서 Show to Taxi Driver 버튼 클릭 시 모달이 열린다.
- 모바일에서 글씨가 충분히 크게 표시된다.

---

## FR-008. 자동 일정 생성

### 설명

저장한 장소와 관심 키워드를 기반으로 Day별 여행 일정과 이동 순서를 생성한다.

### 입력값

```txt
여행 일수
출발 장소
종료 장소
저장 장소 목록
관심 키워드
이동수단
하루 시작 시간
하루 종료 시간
```

### 기본 규칙

- 필수 방문 장소를 우선 포함한다.
- 관심 키워드와 맞는 카테고리를 우선 포함한다.
- 지리적으로 가까운 장소끼리 같은 날 묶는다.
- 점심/저녁 시간대에 음식점을 배치한다.
- 중간 휴식 시간에 카페를 배치한다.
- 하루 장소 수가 너무 많으면 경고한다.
- 너무 먼 장소는 다른 날로 분리한다.

### 일정 예시

```txt
Day 1
09:00 Hotel
10:00 Gyeongbokgung Palace
11:30 Bukchon Hanok Village
12:40 Gwangjang Market
14:30 Ikseon-dong Cafe
16:00 Myeongdong Shopping
18:30 N Seoul Tower
```

### 수용 기준

- 저장 장소 3개 이상일 때 자동 일정 생성이 가능하다.
- Day별 일정이 표시된다.
- 각 일정 항목에 예상 시작/종료 시간이 표시된다.
- 사용자가 순서를 수정할 수 있다.

---

## FR-009. 일정 피로도 점수

### 설명

초행 관광객이 무리한 일정을 짜지 않도록 일정 난이도를 표시한다.

### 계산 요소

```txt
하루 장소 수
예상 이동거리
예상 이동시간
체류시간 합계
도보가 많은지 여부
식사 간격
밤늦은 이동 여부
지역 간 이동 과다 여부
```

### 표시 예시

```txt
Day 1 Fatigue: High
Total places: 7
Estimated movement: 2h 40m
Suggestion: Move N Seoul Tower to Day 2.
```

### 수용 기준

- 각 Day별 피로도 Low / Medium / High를 표시한다.
- 장소 수가 많거나 이동거리가 길면 경고 문구를 표시한다.

---

## FR-010. 길찾기 링크 생성

### 설명

앱 내부에서 내비게이션을 직접 구현하지 않고, 카카오맵 등 외부 지도앱으로 연결한다.

### 요구사항

- 카카오맵 길찾기 URL 생성
- 네이버지도 검색/길찾기 URL 생성
- 구글맵 검색 URL 생성
- 각 구간별 길찾기 버튼 제공
- 하루 일정 전체 길찾기 버튼 제공

### 정책

- 카카오맵 경유지 제한을 고려해 하루 일정이 너무 길면 여러 구간으로 나눈다.
- 대중교통은 구간별 길찾기 중심으로 제공한다.

### 수용 기준

- 장소 A → 장소 B 구간 길찾기 버튼이 동작한다.
- 하루 일정 길찾기 버튼이 동작한다.
- 주소 복사 버튼이 함께 제공된다.

---

## FR-011. 텍스트 붙여넣기 장소 추출

### 설명

사용자가 여행 후보 목록, 블로그 텍스트, 친구가 보낸 메시지 등을 붙여 넣으면 장소 후보를 추출한다.

### MVP 방식

- 쉼표, 줄바꿈, bullet 문자를 기준으로 1차 분리한다.
- 각 문장을 카카오 장소검색에 넣어 후보를 찾는다.
- 결과가 애매하면 사용자에게 후보 선택을 요청한다.

### 예시

```txt
I want to visit Gyeongbokgung, Bukchon Hanok Village, Onion Anguk, Gwangjang Market, and N Seoul Tower.
```

### 수용 기준

- 쉼표/줄바꿈 기반 장소 후보 추출이 가능하다.
- 추출된 장소별 검색 결과가 표시된다.
- 사용자가 원하는 후보를 저장할 수 있다.

---

## FR-012. 외국인 테마 키워드

### 설명

관심 키워드를 한국 방문 외국인 관점으로 재구성한다.

### 기본 테마

```txt
First-time in Korea
K-food
Cafes & Desserts
K-pop / K-drama
Palaces & Hanbok
Shopping
Beauty & Skincare
Traditional Markets
Night View
Nature & Trails
Rainy Day
Family-friendly
Muslim-friendly
Vegetarian-friendly
Not Spicy Food
```

### 수용 기준

- 사용자가 여러 테마를 선택할 수 있다.
- 자동 일정 생성 시 테마가 점수 계산에 반영된다.
- 테마별 추천 장소 패널을 표시할 수 있다.

---

## FR-013. Korea Setup 메뉴

### 설명

한국 도착 전/직후 필요한 정보를 체크리스트로 제공한다.

### 메뉴 항목

```txt
Airport to Hotel
SIM / eSIM / Wi-Fi
Tmoney / Transportation Card
KakaoMap / Naver Map / Kakao T
Payment Tips
Emergency Numbers
Basic Korean Phrases
```

### 수용 기준

- `/setup` 또는 사이드 패널에서 체크리스트를 볼 수 있다.
- 사용자가 완료 체크를 할 수 있다.
- 체크 상태는 localStorage에 저장된다.

---

## FR-014. 공항 → 숙소 이동 마법사

### 설명

외국인 관광객의 첫 이동 문제를 해결한다.

### 입력값

```txt
Arrival Airport: Incheon / Gimpo / Gimhae / Jeju
Hotel Area or Address
Arrival Time
Luggage: Light / Heavy
Preference: Cheapest / Easiest / Fastest / Late Night
```

### 출력값

```txt
Recommended Option
Estimated Time
Estimated Cost Range
Transfer Notes
Taxi Korean Address Card
Open Map Button
```

### MVP 구현

- 실제 실시간 교통 API 없이 정적 가이드 + 주소 복사 + 지도앱 연결로 시작한다.
- 인천공항 → 서울 주요 지역 중심으로 우선 지원한다.

### 수용 기준

- 사용자가 공항과 숙소 지역을 선택할 수 있다.
- 추천 이동 옵션이 표시된다.
- 숙소 주소를 택시기사에게 보여줄 수 있다.

---

## FR-015. 오프라인 여행팩

### 설명

인터넷이 불안정하거나 배터리 문제가 있을 때를 대비해 오늘 일정을 이미지/PDF/텍스트로 저장할 수 있게 한다.

### 포함 정보

```txt
Day별 일정
장소명 영문/한국어
한국어 주소
전화번호
메모
택시기사용 문장
지도앱 링크
비상 연락처
숙소 주소
```

### MVP 구현

- 우선 `Copy full itinerary`와 `Save as text` 기능부터 구현한다.
- 이후 이미지/PDF 내보내기로 확장한다.

### 수용 기준

- 오늘 일정 전체를 클립보드에 복사할 수 있다.
- 모바일에서 공유 시트로 공유할 수 있다.

---

## FR-016. Help / 1330 / 비상 도움 메뉴

### 설명

한국 여행 중 문제가 생겼을 때 바로 도움 정보를 볼 수 있게 한다.

### 항목

```txt
1330 Korea Travel Helpline
Emergency: 112 / 119
Tourist Police
Show My Current Location
Copy Hotel Address
Korean Phrase Cards
```

### 수용 기준

- Help 메뉴에서 긴급 연락처를 볼 수 있다.
- 현재 위치 공유 또는 복사용 텍스트를 제공한다.
- 한국어 문장 카드를 볼 수 있다.

---

## FR-017. 음식 취향·제약 필터

### 설명

한국 음식 여행을 원하는 외국인을 위해 식사 제약과 취향을 필터로 제공한다.

### 필터

```txt
No pork
No beef
Vegetarian
Vegan
Halal-friendly
Seafood
Not spicy
Very spicy
Korean BBQ
Street food
Cafe dessert
Local market food
```

### MVP 구현

- 장소 메모/태그 기반 수동 필터로 시작한다.
- 이후 외부 데이터 또는 사용자 리뷰 데이터로 보강한다.

### 수용 기준

- 음식 관련 장소에 태그를 붙일 수 있다.
- 선택한 음식 제약에 맞는 장소를 우선 표시한다.

---

## FR-018. 영업시간·휴무일 메모

### 설명

여행 실패를 줄이기 위해 영업시간, 휴무일, 예약 필요 여부를 장소별로 기록한다.

### 필드

```txt
Opening Hours
Closed Days
Last Order
Reservation Needed
Ticket Needed
User Note
```

### MVP 구현

- 자동 수집이 아니라 사용자가 직접 입력하는 필드로 시작한다.

### 수용 기준

- 장소 상세에서 영업시간/휴무일 메모를 입력할 수 있다.
- 일정 생성 시 사용자가 입력한 휴무일과 충돌하면 경고한다.

---

## 10. 데이터 모델

**Single source of truth:** `src/types/index.ts`, `src/lib/trips.ts`

### 10.1 Trip (`src/lib/trips.ts`)

```ts
export interface Trip {
  id: string;
  slug: string;
  title: string;
  totalDays: number;
  currentDay: number;
  pinnedByDay: Record<number, PinnedPlace[]>;
  routeOptionsByDay: Record<number, RouteOptions>;
  generatedRouteByDay: Record<number, GeneratedRoute | null>;
  materials?: TripMaterial[];
  preferences?: TripTheme[];       // kfood, kpop, shopping, …
  foodRestrictions?: FoodRestriction[];
  region?: string;
  // Supabase / plaza / owner fields …
  createdAt: number;
  updatedAt: number;
}
```

### 10.2 Place / PinnedPlace

```ts
export type SimpleCategory =
  | 'tour' | 'food' | 'cafe' | 'stay' | 'culture' | 'shop'
  | 'beauty' | 'market' | 'transport' | 'road' | 'other';

export interface Place {
  id: string;
  name: string;
  nameKo?: string;
  romanizedName?: string;
  category: SimpleCategory;
  lat: number;
  lng: number;
  address: string;
  roadAddress?: string;
  openingHours?: string;
  closedDays?: string;
  // … rating, openingStatus, thumbnailUrl
}

export interface PinnedPlace extends Place {
  pinnedAt: number;
  order: number;
  day: number;
  stayMinutes?: number;
  note?: string;
  priority?: number;   // 1–5
  required?: boolean;
}
```

### 10.3 GeneratedRoute

```ts
export interface GeneratedRoute {
  stops: Array<PinnedPlace & { arriveAt: string; leaveAt: string }>;
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalTravelMinutes: number;
  fatigueScore?: number;
  fatigueLevel?: 'low' | 'medium' | 'high';
  options: RouteOptions;  // includes preferences?: TripTheme[]
}
```

### 10.4 SetupChecklistItem (localStorage `wayknit:korea-setup:v1`)

```ts
export type SetupChecklistItem = {
  id: string;
  category: 'arrival' | 'connectivity' | 'transport' | 'payment' | 'apps' | 'emergency';
  title: string;
  description: string;
  completed: boolean;
  url?: string;
};
```

---

## 11. 자동 일정 생성 알고리즘

### 11.1 기본 처리 흐름

```txt
1. 저장 장소 목록 가져오기
2. 필수 장소와 선택 장소 분리
3. 관심 키워드/테마 기반 점수 계산
4. 거리 기반으로 가까운 장소끼리 그룹화
5. 여행 일수에 맞게 Day별 분배
6. 각 Day 안에서 nearest-neighbor 방식으로 순서 정렬
7. 점심/저녁 시간대에 음식점 배치
8. 중간 휴식 시간대에 카페 배치
9. 하루 일정 시간 초과 여부 확인
10. 피로도 점수 계산
11. 일정표 생성
```

### 11.2 점수 계산

```ts
function scorePlace(place: Place, trip: Trip): number {
  let score = 0;

  if (place.required) score += 100;
  score += place.priority * 10;

  if (trip.preferences.includes('K-food') && place.category === 'restaurant') score += 30;
  if (trip.preferences.includes('Cafes & Desserts') && place.category === 'cafe') score += 25;
  if (trip.preferences.includes('Shopping') && place.category === 'shopping') score += 25;
  if (trip.preferences.includes('Beauty & Skincare') && place.category === 'beauty') score += 25;
  if (trip.preferences.includes('Palaces & Hanbok') && place.category === 'tour') score += 20;
  if (trip.preferences.includes('Traditional Markets') && place.category === 'market') score += 20;
  if (trip.preferences.includes('Nature & Trails') && place.category === 'road') score += 20;

  return score;
}
```

### 11.3 거리 계산

```ts
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
```

### 11.4 일정 피로도 계산

```txt
Low:
- 하루 장소 4개 이하
- 총 직선거리 10km 이하
- 총 체류+이동시간 8시간 이하

Medium:
- 하루 장소 5~6개
- 총 직선거리 10~25km
- 총 체류+이동시간 8~10시간

High:
- 하루 장소 7개 이상
- 총 직선거리 25km 이상
- 총 체류+이동시간 10시간 이상
```

---

## 12. UI/UX 요구사항

### 12.1 메인 `/plan` 레이아웃

```txt
┌──────────────────────────────────────────────┐
│ Top Search / Paste Places / Preferences       │
├──────────────┬───────────────────────────────┤
│ Saved Places │                               │
│ Filters      │                               │
│              │           Kakao Map            │
│ Place Cards  │                               │
│              │                               │
├──────────────┴───────────────────────────────┤
│ Day Plan Bottom Sheet                         │
│ [Generate Itinerary] [Open Route] [Copy]      │
└──────────────────────────────────────────────┘
```

### 12.2 모바일 레이아웃

- 지도는 전체 화면 유지
- 검색창은 상단 고정
- 저장 장소와 일정은 하단 바텀시트
- 카테고리 필터는 가로 스크롤 칩
- 장소 상세는 하단 모달
- 택시기사용 카드는 전체 화면 모달

### 12.3 카피라이팅

#### Landing Hero

```txt
Plan your Korea trip on a map.
Save places, organize routes, and get Korean addresses for easy navigation.
```

#### Empty State

```txt
Start by searching places you want to visit in Korea.
Try: Gyeongbokgung, Hongdae, Gwangjang Market, Seongsu Cafe Street.
```

#### Generate Button

```txt
Create My Korea Route
```

#### Taxi Card Button

```txt
Show to Taxi Driver
```

---

## 13. 컴포넌트 구조

**실제 코드베이스 (2026-06)** — PRD 초안의 `app/map/search/places` 폴더 대신 flat + feature 페이지 구조.

```txt
src/
  App.tsx                    # BrowserRouter, locale routes
  pages/
    LandingPage.tsx
    PlannerPage.tsx          # /plan 메인 SPA
    ShareTripPage.tsx        # /trip/:slug
    SharePlazaPage.tsx       # /plaza
    KoreaSetupPage.tsx       # /setup
    HelpPage.tsx             # /help
    ThemesPage.tsx           # /themes
    LoginPage.tsx, AdminPage.tsx
  components/
    MapView.tsx, GoogleMapView.tsx
    SearchPanel.tsx, PinupBar.tsx, RouteSummary.tsx
    RouteOptionsPanel.tsx, PlacePhotosModal.tsx
    TaxiDriverCardModal.tsx, ThemePreferenceChips.tsx
    FoodRestrictionChips.tsx, PlaceActionBar.tsx
    PasteCollectPanel.tsx
    mobile/                  # MobileDock, MobileSearchSheet, MobilePinSheet, …
    ShareTripModal.tsx, TripMaterialsPanel.tsx, …
  lib/
    kakao.ts, googleMaps.ts, mapLinks.ts, mapInfoCard.ts
    planner.ts, fatigue.ts, themes.ts, foodRestrictions.ts
    tourApi.ts               # VITE_TOUR_API_KEY (선택)
    trips.ts, importPins.ts, exportPins.ts, itineraryExport.ts
    pasteCollect.ts, searchQueries.ts, koreaSetup.ts
    i18n.ts, locale.ts, categories.ts
  types/index.ts
  locales/{ko,en,ja,zh}/
  styles/app.css, landing.css
  contexts/AuthContext.tsx
  hooks/useAuth.ts, useIsMobile.ts, usePwaInstall.ts
```

---

## 14. 상태관리 요구사항

Zustand 또는 유사한 단순 상태관리 사용.

```ts
export type TripState = {
  trip: Trip;
  places: Place[];
  itinerary: ItineraryItem[];
  selectedPlaceId?: string;
  filters: Record<PlaceCategory | 'mustVisit', boolean>;
  searchResults: Place[];

  setTrip: (patch: Partial<Trip>) => void;
  addPlace: (place: Place) => void;
  removePlace: (placeId: string) => void;
  updatePlace: (placeId: string, patch: Partial<Place>) => void;
  selectPlace: (placeId?: string) => void;
  setFilter: (key: string, value: boolean) => void;
  setSearchResults: (places: Place[]) => void;
  generateItinerary: () => void;
  reorderItinerary: (day: number, fromIndex: number, toIndex: number) => void;
  resetTrip: () => void;
};
```

---

## 15. 외부 API 및 환경변수

### 15.1 필수

```env
VITE_KAKAO_JS_KEY=YOUR_KAKAO_JAVASCRIPT_KEY
```

### 15.2 향후 확장

```env
VITE_TOUR_API_KEY=YOUR_KTO_TOUR_API_KEY
VITE_APP_BASE_URL=https://wayknit.netlify.app
```

### 15.3 API 정책

- MVP에서는 카카오맵 JavaScript SDK의 장소 검색을 우선 사용한다.
- 서버 사이드 API가 필요해지면 Netlify Functions 또는 Next.js API Routes로 분리한다.
- 키가 노출되면 안 되는 API는 클라이언트에서 직접 호출하지 않는다.

---

## 16. 지도 URL 생성 정책

### 16.1 카카오맵

```ts
function buildKakaoMapSearchUrl(place: Place) {
  return place.kakaoPlaceId
    ? `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(place.nameKo || place.name)}`;
}
```

### 16.2 구글맵

```ts
function buildGoogleMapUrl(place: Place) {
  const query = encodeURIComponent(`${place.nameEn || place.name} ${place.address || ''}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
```

### 16.3 네이버지도

```ts
function buildNaverMapUrl(place: Place) {
  const query = encodeURIComponent(place.nameKo || place.name);
  return `https://map.naver.com/p/search/${query}`;
}
```

---

## 17. 개발 우선순위

### Phase 1. 외국인용 MVP 보강 — **구현 완료 (2026-06)**

1. ✅ i18n 영문 카피
2. ✅ 한국어 이름·주소 복사
3. ✅ `TaxiDriverCardModal`
4. ✅ Kakao/Naver/Google 링크
5. ✅ `ThemePreferenceChips`
6. ✅ 카테고리 `beauty|market|transport|road`
7. ✅ 피로도 점수
8. ✅ 전체 일정 복사

### Phase 2. 한국 여행 준비 — **MVP 구현**

1. ✅ `/setup` 체크리스트
2. ✅ `/help` 공항→숙소 가이드
3. ✅ Tmoney/eSIM/앱 안내 카드
4. ✅ 1330·112·119
5. ✅ Phrase Cards

### Phase 3. 수집·추천 — **1차 구현**

1. ✅ `PasteCollectPanel`
2. ✅ `/themes` 보드
3. ⏳ Tour API
4. ✅ `openingHours`/`closedDays` 타입
5. ✅ `FoodRestrictionChips`

### Phase 4. 공유·서비스화 — **대부분 완료**

1. ✅ Supabase
2. ✅ 공유 링크
3. ⏳ 친구 투표
4. ⏳ PDF 오프라인 팩
5. ✅ i18n ko/en/ja/zh

---

## 18. 이번 Cursor 작업 지시안

Cursor에 다음 순서로 작업을 요청한다.

```txt
You are working on a Vite + React + TypeScript travel planning SPA using Kakao Maps.
The product is a Korea travel map planner for foreign tourists.
Please refactor and extend the current MVP based on this PRD.

Primary goal:
Make the /plan page useful for foreign visitors to Korea.

Implement first:
1. English-first UI copy for the plan page.
2. Place detail card with Korean name, English name, Korean address, copy buttons.
3. Show to Taxi Driver full-screen modal.
4. External map buttons: KakaoMap, Naver Map, Google Maps.
5. Theme preference chips: K-food, Cafes, K-pop/K-drama, Shopping, Beauty, Palaces, Markets, Night View, Rainy Day, Muslim-friendly.
6. Expanded place categories: restaurant, cafe, tour, hotel, road, shopping, beauty, market, transport, etc.
7. Fatigue score on generated day itinerary.
8. Copy full itinerary button.

Constraints:
- Do not introduce a backend yet.
- Persist data in localStorage.
- Keep Kakao Maps as the primary map.
- Keep code TypeScript-safe.
- Avoid large UI libraries unless already installed.
- Keep mobile usability in mind.
- Handle missing Kakao API key gracefully.
```

---

## 19. MVP 제외 범위

다음은 당장 구현하지 않거나 최소화한다.

```txt
실시간 교통 기반 완전 최적화
앱 내부 턴바이턴 내비게이션
결제/예약 직접 처리
복잡한 AI 채팅
리뷰 크롤링
상표/도메인 최종 검증
모든 언어의 완전 번역
실시간 영업시간 100% 보장
친구 공동 편집 실시간 동기화
친구 투표
PDF 오프라인 팩 (clipboard 텍스트는 제공)
```

**이미 구현되어 제외 목록에서 제외한 항목:** Supabase 저장, 선택 로그인, 공유 링크, 공유마당, 다국어 i18n, PWA.

---

## 20. 리스크와 대응

### 20.1 지도 데이터 언어 문제

- 리스크: 카카오 장소 데이터가 한국어 중심일 수 있다.
- 대응:
  - 영어 입력 검색을 지원하되, 한국어 이름/주소를 반드시 표시한다.
  - 사용자가 수동으로 English name을 수정할 수 있게 한다.

### 20.2 길찾기 제한

- 리스크: 카카오맵 URL 길찾기는 경유지 제한이 있다.
- 대응:
  - 하루 일정 전체 길찾기가 불가능하면 구간별 길찾기로 나눈다.
  - 대중교통은 구간별 길찾기 중심으로 제공한다.

### 20.3 API 키/도메인 설정 문제

- 리스크: Netlify 배포 주소와 카카오 개발자 콘솔 도메인 설정이 불일치하면 지도가 뜨지 않을 수 있다.
- 대응:
  - `.env.example` 제공
  - 지도 로딩 실패 UI 제공
  - README에 카카오 JavaScript 키와 Web 플랫폼 도메인 등록 안내 작성

### 20.4 외국인 타깃 UX 문제

- 리스크: 기능은 있어도 한국어 중심이면 외국인이 쓰기 어렵다.
- 대응:
  - Plan 화면은 영어 우선
  - 한국어는 현지 이동용 정보로 제공
  - 카피, 버튼, 빈 상태, 도움말을 영어로 구성

---

## 21. 테스트 시나리오

### Scenario 1. 첫 방문자가 서울 여행 코스 만들기

```txt
입력:
Gyeongbokgung, Bukchon Hanok Village, Gwangjang Market, Myeongdong, N Seoul Tower

기대 결과:
- 각 장소 검색 결과 표시
- 장소 저장 가능
- 지도에 카테고리별 마커 표시
- 자동 일정 생성
- Day 1 일정 표시
- 한국어 주소 복사 가능
- 택시기사용 카드 표시
- 카카오/네이버/구글 지도 열기 가능
```

### Scenario 2. K-food 중심 여행

```txt
선택 테마:
K-food, Markets, Not Spicy Food

장소:
Gwangjang Market, Myeongdong Kyoja, Tosokchon, Mangwon Market

기대 결과:
- 음식점/시장 카테고리로 분류
- 점심/저녁 시간에 음식점 우선 배치
- 음식 제약 메모 가능
```

### Scenario 3. 무리한 일정 경고

```txt
장소:
Seoul Station, Gyeongbokgung, Lotte World, Suwon Hwaseong, Incheon Chinatown, Hongdae, N Seoul Tower

기대 결과:
- 피로도 High 표시
- 일정 분리 제안
- 하루 장소 수 과다 경고
```

### Scenario 4. 공항 도착 후 이동

```txt
입력:
Airport: Incheon
Hotel Area: Hongdae
Arrival Time: 22:30
Luggage: Heavy
Preference: Easiest

기대 결과:
- 공항철도/리무진/택시 옵션 표시
- 밤 도착 주의 문구 표시
- 호텔 주소 택시기사용 카드 표시
```

---

## 22. 최종 제품 방향

이 앱은 전 세계 여행지를 다루는 범용 여행 앱으로 시작하지 않는다.  
초기에는 **대한민국 방문 해외 관광객**에 집중한다.

핵심 차별화는 다음이다.

```txt
1. 외국어로 찾고 한국어 주소로 이동한다.
2. 가고 싶은 곳을 지도에 모은다.
3. 모은 장소를 자동으로 일정과 동선으로 엮는다.
4. 카카오맵, 네이버지도, 구글맵, 택시기사용 카드로 실제 이동을 돕는다.
5. 공항 이동, 교통카드, 긴급 도움 등 한국 여행의 실전 문제를 해결한다.
```

제품 최종 문장:

> **Wayknit helps foreign travelers turn saved places into clear Korea travel routes, with Korean addresses, map links, taxi cards, and day-by-day plans.**

한글 문장:

> **여로담은 한국을 방문하는 외국인 여행자가 가고 싶은 곳을 모아 지도 위에서 일정과 이동 동선으로 엮을 수 있게 도와주는 여행 플래너입니다.**
