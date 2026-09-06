# 「해외 여행지 Google Maps POI 확장」검토보고서

> 검토 대상: 한국 외 지역 여행 계획에서 Google Maps 기반 POI 검색·표시가 가능한지 여부
> 검토일: 2026-08-25
> 검토 관점: "새로 만들어야 하는가"가 아니라 "이미 있는 것이 왜 사용자에게 도달하지 않는가" — 코드베이스 실태 대비 실행 가능성과 비용/정책 리스크

---

## 0. 결론 먼저

**해외 지역 Google Maps POI 지원은 이미 코드베이스에 상당 부분 구현되어 있다.** 신규 구축 프로젝트가 아니라, 좌표 기반으로 카카오/구글을 자동 분기하는 아키텍처(`src/lib/mapProvider.ts`)가 이미 존재하고, 구글 장소 검색(`searchPlacesUnifiedWithGoogle`)·상세정보(`fetchGooglePlaceDetail`)·지도 렌더링(`GoogleMapView.tsx`)·다국어 요청까지 한 세트로 갖춰져 있다.

그런데도 사용자 입장에서 "한국만 POI가 뜬다"고 느끼는 이유는 기능이 없어서가 아니라 **① 새 여행 계획을 만들면 지도 중심이 항상 서울로 시작하고, ② 지도를 명시적으로 해외로 옮기기 전까지는 좌표 기반 판정이 한국으로 잡히며, ③ 한 번 "카카오"로 저장된 브라우저 설정이 지역 판정보다 우선**하기 때문이다(§2). 즉 기능 부재가 아니라 진입 UX 부재의 문제다.

다만 이걸 그대로 켜서 정식으로 마케팅하기 전에 짚어야 할 리스크가 있다: **Google Places API 비용 통제가 클라이언트 단(localStorage) 카운터 하나뿐**이라 시크릿 모드나 저장소 삭제로 즉시 우회되고(§3), **검색 경로가 2025년 3월부로 신규 고객에게 차단된 레거시 PlacesService에만 의존**하고 있어 지금 쓰는 구글 키의 발급 시점에 따라 실제로 동작하지 않을 수도 있다(§3). 이 두 가지는 라이브 테스트로 먼저 확인해야 "해외 확장이 가능하다"는 결론을 안전하게 낼 수 있다.

**핵심 권고 3가지**:
1. 여행 계획 생성 시 "여행지 검색" 진입점을 추가해 지도 중심을 목적지로 즉시 이동시킬 것 — 좌표 기반 분기가 제대로 작동하려면 애초에 지도가 목적지에 가 있어야 한다.
2. 구글 검색/상세조회 비용 통제를 서버 측으로 옮기거나, 최소한 지금 쓰는 API 키가 레거시 PlacesService 접근 권한이 있는지부터 콘솔에서 확인할 것.
3. Free 티어에 해외 검색을 전면 개방하기 전에 실제 단가(§3)를 근거로 무료/유료 티어 분리 정책을 먼저 정할 것.

---

## 1. 현재 이미 구현되어 있는 것 (사실관계)

| 영역 | 파일 | 상태 |
|---|---|---|
| 지역 판정 · 프로바이더 분기 | [mapProvider.ts](../../src/lib/mapProvider.ts) | 위경도가 한국 영역(위도 32.5~39.5, 경도 123.0~132.5)을 벗어나고 구글 키가 있으면 자동으로 `'google'` 선택 |
| 구글 SDK 로더 | [googleMaps.ts:38-72](../../src/lib/googleMaps.ts) | `<script>` 동적 주입으로 `maps.googleapis.com/maps/api/js?libraries=places` 로드. 별도 npm 패키지(`@googlemaps/js-api-loader`) 없이 직접 구현 |
| 통합 POI 검색 | [googleMaps.ts:242-337](../../src/lib/googleMaps.ts) `searchPlacesUnifiedWithGoogle` | `textSearch`/`nearbySearch`를 카카오와 동일한 `Place` 타입으로 정규화. 카카오 카테고리코드(FD6/CE7/AT4/AD5/CT1/MT1/CS2/PK6) ↔ 구글 place types 매핑 함수 존재 |
| 실제 호출 지점 | [PlannerPage.tsx:671, 736, 789](../../src/pages/PlannerPage.tsx) | `mapProvider === 'google' ? searchPlacesUnifiedWithGoogle(...) : searchPlacesUnified(...)` — POI 검색 자체가 이미 지역별로 분기되어 있음 |
| 장소 상세정보 | [googlePlaceDetail.ts](../../src/lib/googlePlaceDetail.ts) | 신규 Place API(`importLibrary('places')`) 우선 시도 → 실패 시 레거시 `PlacesService.getDetails` 폴백. 사진·리뷰·영업시간·가격대·서비스옵션까지 커버 |
| 지도 렌더링 | `GoogleMapView.tsx`, `MapView.tsx`, `MapProviderPicker.tsx` | provider 전환 시 `key={mapProvider}`로 컴포넌트 자체가 리마운트되어([PlannerPage.tsx:1873](../../src/pages/PlannerPage.tsx)) 상태 꼬임 없이 전환됨 |
| 다국어 | [locale.ts](../../src/lib/locale.ts) `googleMapsLanguage` | 9개 로케일(`de/en/es/fr/ja/ko/ru/zh-CN/zh-TW`)에 맞춰 구글 API 요청 언어도 이미 로케일 매핑됨 |
| 환경변수 | `.env.local`, `.env.example` | `VITE_GOOGLE_MAPS_API_KEY`, `VITE_MAP_PROVIDER_FORCE` 모두 키 이름 존재 — 로컬 환경에는 실제로 값이 채워져 있고 `VITE_MAP_PROVIDER_FORCE=google`로 설정되어 있음 |

정리하면, "해외에서 구글맵으로 여행 계획을 세울 수 있는가"라는 질문의 기술적 답은 **"이미 대부분 가능하도록 짜여 있다"**이다.

---

## 2. "한국만 보인다"의 실제 원인

기능이 없는 게 아니라, 다음 네 가지가 겹쳐서 해외 지역에서도 사실상 카카오(=한국 데이터)로 남아있게 만든다.

**원인 A — 새 여행 계획의 지도 시작점이 항상 서울이다.**
`DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 }` ([mapViewport.ts:6](../../src/lib/mapViewport.ts))가 서울 좌표로 고정되어 있고, 새 Plan을 만들면 이 좌표에서 시작한다([PlannerPage.tsx:280-281](../../src/pages/PlannerPage.tsx)). `isKoreaRegion` 판정은 "현재 지도 중심"만 보므로, 사용자가 검색창에 파리나 도쿄를 직접 입력해 지도를 옮기기 **전까지는** 무조건 한국으로 판정되어 카카오가 선택된다. 여행 계획 데이터 모델(`src/types`)에 국가/목적지 필드가 없어서, 앱이 "이 여행은 해외"라는 사용자 의도를 사전에 알 방법이 좌표 외에는 없다.

**원인 B — 프로바이더 선택이 브라우저 전역으로 저장되고, 좌표 판정보다 우선한다.**
[mapProvider.ts:31-32](../../src/lib/mapProvider.ts)의 `resolveMapProvider`는 `choice === 'kakao'`이면 좌표나 `VITE_MAP_PROVIDER_FORCE`를 확인하기도 전에 즉시 `'kakao'`를 반환한다. 이 `choice`는 `localStorage`(`wayknit:map-provider-choice-v1`, [mapProviderPreference.ts](../../src/lib/mapProviderPreference.ts))에 브라우저 단위로 저장되므로, 한 번이라도 수동으로 카카오를 선택한 사용자는 이후 지도를 해외로 옮겨도 자동 전환되지 않는다. 국내 여행 A와 해외 여행 B를 같은 브라우저에서 오가는 사용자에게는 이 전역 설정 하나가 계속 꼬인다.

**원인 C — 관광공사(TourAPI) 보조 레이어는 설계상 한국 전용이다.**
`isTourApiConfigured()` 게이트로 조건부 호출되는 TourAPI(`tourApi.ts`, `tourFestival.ts`)는 한국관광공사 데이터이므로 해외에서 자연히 빠진다. 이건 결함이 아니라 원래 그렇게 설계된 것이지만, "국내 여행보다 해외 여행의 정보량이 상대적으로 적어 보인다"는 체감에는 기여한다.

**결론**: 사용자가 검색창에 목적지를 입력하는 순간부터는 구글 경로가 이미 작동한다. 문제는 "그 순간이 오기 전"까지 앱이 계속 한국 기준으로 남아있다는 것 — 즉 기능 결함이 아니라 **초기 진입 경험**의 문제다.

---

## 3. 비용·정책 리스크 (정식으로 켜기 전에 반드시 확인할 것)

**단가.** 2026년 기준 Google Places API는 Text Search/Nearby Search가 Pro SKU 기준 1,000건당 $32이며, 평점·영업시간 등을 요청하면 Enterprise($35/1,000건), 리뷰·사진까지 포함하면 Enterprise+Atmosphere($40/1,000건) 구간으로 올라간다. 월 무료 한도는 2025년 3월 정책 변경 이후 SKU별로 1,000~5,000건 수준으로 축소되었다. ([Google Places API Pricing 2026 – SafeGraph](https://www.safegraph.com/guides/google-places-api-pricing/), [Google Places API Cost Calculator – Open Places API](https://openplacesapi.com/google-places-api-cost-calculator))

현재 코드의 `fetchGooglePlaceDetail`([googlePlaceDetail.ts:230-253](../../src/lib/googlePlaceDetail.ts))은 `reviews`, `photos`, `priceLevel`, `regularOpeningHours`를 모두 요청하고 있어 **가장 비싼 Enterprise+Atmosphere 구간으로 확정 과금**된다. 검색(`textSearch`/`nearbySearch`)도 결과당 사진·평점을 포함해 Pro~Enterprise 구간이다.

**비용 통제가 클라이언트 단뿐이다.** `canRunGoogleSearch`/`recordGoogleSearch`([subscription.ts:41-63](../../src/lib/subscription.ts))는 Free 티어 일일 40회 한도를 두고 있지만, 이 카운트는 `localStorage`에만 저장된다. 시크릿 모드, 저장소 삭제, 다른 브라우저·기기 사용만으로 즉시 우회된다. 카카오 검색은 `/api/kakao-place` 서버 프록시를 경유하지만, 구글 검색·상세조회는 브라우저에서 직접 Google SDK를 호출하므로 서버 측 집계 지점 자체가 없다. `VITE_` 접두사 환경변수는 빌드 시 번들에 그대로 포함되므로 API 키 자체도 클라이언트에 노출된다(구글 콘솔의 HTTP 리퍼러 제한 설정 여부는 코드베이스 조사만으로는 확인 불가 — 별도 확인 필요).

**레거시 API 의존.** `searchPlacesUnifiedWithGoogle`이 쓰는 `PlacesService.textSearch`/`nearbySearch`는 2025년 3월 1일부로 **신규 발급 고객에게는 차단**되었고, 기존 고객도 최소 12개월 사전 고지 후 단계적으로 폐지될 예정이다([Google for Developers 공식 문서](https://developers.google.com/maps/documentation/javascript/legacy/places-migration-overview)). 상세정보 조회(`fetchGooglePlaceDetail`)는 이미 신규 Place API를 우선 시도하고 레거시로 폴백하는 이원화 구조가 되어 있는데(§1), **검색 경로는 레거시 하나에만 의존**한다. 지금 `.env.local`의 구글 키가 언제 발급됐는지에 따라 검색 기능 자체가 이미 동작하지 않을 수 있다 — 코드 리뷰만으로는 알 수 없고 **라이브로 실제 해외 좌표 검색을 한 번 실행해 확인이 필요**하다.

---

## 4. 권고 (우선순위 순)

1. **여행지 검색 진입점 신설(가장 저비용·고효과)**: Plan 생성 또는 첫 진입 시 "어디로 여행가세요?" 형태의 목적지 검색을 추가해 `mapCenter`를 즉시 목적지로 세팅. 이것만으로 §2의 원인 A가 해소되고, 이미 있는 좌표 기반 분기가 의도대로 작동한다.
2. **라이브 검증부터**: 실제 구글 키로 해외 좌표(예: 도쿄, 파리)에서 `searchPlacesUnifiedWithGoogle`이 정상 응답하는지 먼저 확인. 레거시 PlacesService 차단 대상 키라면 검색 자체가 실패할 수 있다(§3).
3. **비용 통제를 서버 측으로 이관**: 최소한 일일 총 호출수를 Supabase(이미 사용 중)에 집계하거나, Edge Function 프록시를 경유하도록 구조 변경. 구글 콘솔에서 API 키에 HTTP 리퍼러/API 제한이 걸려 있는지 직접 확인.
4. **`mapProviderChoice`를 브라우저 전역이 아닌 Plan 단위로 저장**: 국내·해외 여행을 함께 쓰는 사용자의 설정 충돌(§2 원인 B) 방지.
5. **Place Details 요청 필드 다이어트**: 현재 UI가 실제로 쓰지 않는 필드가 있다면 제거해 Enterprise+Atmosphere 단가 구간을 피할 여지가 있는지 재검토.
6. **검색 경로도 신규 Place API로 이관**: `textSearch`/`nearbySearch` → `Place.searchByText`/`searchNearby`로 우선 시도 + 레거시 폴백 구조를 상세조회와 동일하게 맞출 것.
7. **(선택) Plan 데이터 모델에 목적지 필드 추가**: 있으면 좌표 재계산 없이 UI 초기 상태·통화·언어 등을 한 번에 결정할 수 있어 이후 확장에도 재사용 가치가 있다.

---

## 5. 사용자 판단이 필요한 사항

- 해외 검색을 Free 티어에 그대로 열지, Plus/Team 전용으로 제한할지 — §3의 단가를 볼 때 Free 티어 전면 개방은 비용 리스크가 상당히 크다.
- 구글 API 키의 실제 발급 시점과 콘솔상 PlacesService(Legacy) 접근 권한 — 코드베이스만으로는 확인 불가, 직접 라이브 테스트 또는 콘솔 확인 필요.

---

## 6. 라이브 테스트 결과 (2026-08-26, 로컬 `localhost:5173`)

실제 키로 `/plan`에서 도쿄·파리를 검색·상세 조회했다. **검색(레거시 PlacesService)과 상세(Places API New) 모두 동작한다.** 레거시 차단 키 가설은 이 환경에서는 기각.

| 시나리오 | 결과 |
|---|---|
| 새 계획 진입 | 지도 중심이 서울(`37.56, 126.98`). `localStorage` `wayknit:map-provider-choice-v1` = `kakao`라 `VITE_MAP_PROVIDER_FORCE=google`이 무시됨 → **원인 A·B 재현** |
| 카카오 상태에서 `도쿄타워` 전국 검색 | Kakao SDK는 로드됐으나 **결과 0건**. 프로바이더가 카카오면 해외 키워드가 구글로 자동 전환되지 않음 |
| Google로 수동 전환 후 `도쿄타워` | 레거시 `PlacesService.textSearch` status **OK**. UI 1건: 도쿄 타워 ★4.5 · 99,766 · 도쿄 좌표. 거리는 서울 기준 **1157.3km**로 표시 |
| 도쿄 타워 상세보기 | 사진 10장, 요약/후기/지도 탭. 주소·전화·영업시간·웹사이트 정상. 패널에 **「Places API (New) 데이터」** 표기 |
| Google에서 `에펠탑` 전국 검색 | 1건: 에펠탑 ★4.7 · 493,995. 지도가 파리로 이동. 거리는 당시 지도 중심(도쿄) 기준 **9719.5km** |

**정리**: 해외 POI 파이프라인은 이미 산다. 막히는 지점은 API가 아니라 (1) 카카오로 저장된 전역 선택이 해외 검색을 카카오에 묶어 두는 것, (2) 새 계획이 서울에서 시작해 거리·주변검색이 한국 기준으로 남는 것이다. 권고 1(여행지 진입점)·4(Plan 단위 프로바이더)가 라이브로도 우선순위가 맞다.

비용 쪽은 이번 세션에서 구글 검색 약 3회 + 상세 1회만 호출했다. Free 일일 40회 `localStorage` 카운터는 그대로이며, 서버 집계는 확인하지 않았다.
