// =============================================
// WayMeld 공통 타입 정의
// =============================================

import type { VisitHoursStatus } from '../lib/openingHours';

/** 카카오 카테고리 그룹 코드 매핑 */
export type CategoryCode =
  | 'AT4'   // 관광명소
  | 'FD6'   // 음식점
  | 'CE7'   // 카페
  | 'AD5'   // 숙박
  | 'CT1'   // 문화시설
  | 'MT1'   // 대형마트
  | 'CS2'   // 편의점
  | 'PK6'   // 주차장
  | 'OTHER';

/** UI에서 사용하는 단순화된 카테고리 */
export type SimpleCategory =
  | 'tour'      // 관광지
  | 'food'      // 맛집
  | 'cafe'      // 카페
  | 'stay'      // 숙소
  | 'culture'   // 문화시설
  | 'shop'      // 쇼핑
  | 'beauty'    // 뷰티
  | 'market'    // 시장
  | 'transport' // 교통
  | 'road'      // 도로/거리
  | 'other';

/** 여행 관심 테마 */
export type TripTheme =
  | 'kfood'
  | 'kpop'
  | 'shopping'
  | 'nature'
  | 'history'
  | 'nightlife'
  | 'family';

/** 음식 제약 */
export type FoodRestriction =
  | 'halal'
  | 'vegetarian'
  | 'no_spicy'
  | 'no_pork'
  | 'gluten_free';

/** 일정 피로도 */
export type FatigueLevel = 'low' | 'medium' | 'high';

/** 카카오 Places 검색 결과 원본 */
export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: CategoryCode | '';
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
  distance: string; // meters as string
}

/** 앱 내부에서 사용하는 정규화된 장소 객체 */
export interface Place {
  id: string;
  name: string;
  category: SimpleCategory;
  categoryCode: CategoryCode | 'OTHER';
  categoryLabel: string; // "관광지", "맛집" 등
  /** 카카오 category_name 원문 (예: 음식점 > 한식) */
  categoryDetail?: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  distance?: number; // meters (검색 기준점 기준)
  /** 외부 API 연동 시에만 제공 (카카오 검색 기본 응답에는 없음) */
  rating?: number;
  reviewCount?: number;
  /** 카카오맵 대표 사진 URL (패널 API 보강) */
  thumbnailUrl?: string;
  /** 카카오맵 장소 사진 탭 URL */
  photosUrl?: string;
  placeUrl?: string;
  isOpenNow?: boolean;
  /** open=영업중, scheduled=이후 영업예정, closed=영업종료, offday=휴무일 */
  openingStatus?: 'open' | 'scheduled' | 'closed' | 'offday' | 'unknown';
  /** 영업 종료 시각 (epoch ms, KST 기준 파싱) — 마감 임박 깜빡임용 */
  closesAt?: number;
  /** 영업 시작 시각 (epoch ms, KST 기준 파싱) — 오픈 임박 깜빡임용 */
  opensAt?: number;
  /** 한국어 상호 (외국인용 복사) */
  nameKo?: string;
  /** 로마자 표기 */
  romanizedName?: string;
  /** 영업시간 원문 (수동 입력 또는 상세 조회로 채워짐) */
  openingHours?: string;
  /** 휴무일 원문 (수동 입력 또는 상세 조회로 채워짐) */
  closedDays?: string;
}

/** 핀업한 장소 (검색 결과 + 사용자 선택) */
export interface PinnedPlace extends Place {
  pinnedAt: number;       // 핀업한 시각 (정렬용)
  order: number;          // 핀업 순서 (1부터)
  stayMinutes?: number;   // 체류시간 (분)
  note?: string;          // 메모
  day: number;            // 일차 (1, 2, 3...)
  /** 중요도 1~5 (기본 3) */
  priority?: number;
  /** 필수 방문 — 일정 생성 시 우선 */
  required?: boolean;
  /**
   * 도착 시각 고정 "HH:MM" — required("빠뜨리지 마라")와 달리 "이 시각을 지켜라".
   * itemKind가 'reserved'이면 하드 앵커(내가 늦어도 그 시각에 시작)로 다뤄진다.
   */
  fixedArrival?: string;
  /**
   * 'reserved' = 이미 예약한 일정. stayMinutes는 예약 소요시간을 뜻하고,
   * fixedArrival 시각의 블록은 일정 재계산에도 움직이지 않는다.
   */
  itemKind?: 'place' | 'reserved';
}

/** 정렬 기준 */
export type SortKey = 'distance' | 'rating' | 'review';

/** 장소 검색 범위 */
export type SearchScope = 'nationwide' | 'nearby';

/** 검색 API 카테고리 필터 (null = 전체) */
export type SearchCategoryFilter = CategoryCode | null;

/** 지도 주변 검색 반경 (미터) */
export type SearchRadiusMeters = 1000 | 3000 | 5000 | 10000 | 20000;

/** 이동수단 */
export type TravelMode = 'car' | 'walk' | 'transit' | 'bike';

/** 최적화 기준 */
export type OptimizeBy = 'distance' | 'time' | 'no-toll';

/** 출발지 입력 방식 */
export type OriginType = 'current' | 'map-click' | 'address';

/** 출발지 */
export interface Origin {
  type: OriginType;
  label: string;
  lat?: number;
  lng?: number;
  address?: string;
}

/** 경로 설정 옵션 */
export interface RouteOptions {
  origin: Origin;
  departTime: string;             // "09:00"
  travelMode: TravelMode;
  optimizeBy: OptimizeBy;
  autoOrder: boolean;             // true=자동 최적화, false=핀업 순서
  reflectMealTime: boolean;       // 식사 시간 반영
  autoStayTime: boolean;          // 체류시간 자동 추천
  useHighway: boolean;
  useRealTimeTraffic: boolean;
  /** 여행 테마 (일정 생성 가중치) */
  preferences?: TripTheme[];
}

/** 생성된 경로 한 구간 */
export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationMinutes: number;
  /** 실제 API 사용 여부 */
  source?: 'api' | 'estimate';
}

/** 여행 자료 종류 */
export type TripMaterialKind = 'text' | 'image' | 'file';

/** 여행 자료 (메타데이터; 바이너리는 Supabase Storage) */
export interface TripMaterial {
  id: string;
  kind: TripMaterialKind;
  title: string;
  body?: string;
  storagePath?: string;
  mimeType?: string;
  fileName?: string;
  byteSize?: number;
  day?: number;
  pinnedPlaceId?: string;
  pinnedPlaceName?: string;
  /** 한 번에 올린 여러 사진을 묶는 앨범 ID */
  albumId?: string;
  createdAt: number;
  updatedAt: number;
}

/** 일정에 배치된 한 정거장 */
export interface RouteStop extends PinnedPlace {
  arriveAt: string;
  leaveAt: string;
  /** 고정 도착 시각까지 기다리는 시간(분) */
  waitMinutes?: number;
  /** 고정 도착 시각보다 늦어지는 시간(분) — 지킬 수 없는 일정 표시용 */
  timingConflict?: number;
  /** 예정 방문 시각의 영업 여부 (영업시간 원문을 읽어낸 경우에만) */
  hoursStatus?: VisitHoursStatus;
  /** 그날 영업 시작·종료 "HH:MM" */
  hoursOpensAt?: string;
  hoursClosesAt?: string;
}

/** 생성된 전체 경로 */
export interface GeneratedRoute {
  origin: Origin;
  stops: RouteStop[];
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalTravelMinutes: number;
  totalStayMinutes: number;
  finishAt: string; // "13:50"
  options: RouteOptions;
  /** 카카오 모빌리티 등으로 계산된 도로 경로 좌표 (없으면 직선 연결) */
  routePath?: Array<{ lat: number; lng: number }>;
  /** 피로도 점수 0~100 */
  fatigueScore?: number;
  fatigueLevel?: FatigueLevel;
}
