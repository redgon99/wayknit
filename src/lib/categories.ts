import type { CategoryCode, SearchCategoryFilter, SearchRadiusMeters, SimpleCategory } from '../types';
import type { IconName } from '../icons/wayknit-icons';

// =============================================
// 카카오 카테고리 코드 → UI 카테고리 매핑
// =============================================

export const CATEGORY_MAP: Record<CategoryCode, {
  category: SimpleCategory;
  label: string;
  icon: IconName;
  bgColor: string;    // 마커/배지 배경
  iconColor: string;  // 아이콘 색상
}> = {
  AT4:   { category: 'tour',    label: '관광지', icon: 'catTour',    bgColor: '#0e7490', iconColor: '#ffffff' },
  FD6:   { category: 'food',    label: '맛집',   icon: 'catFood',    bgColor: '#c2410c', iconColor: '#ffffff' },
  CE7:   { category: 'cafe',    label: '카페',   icon: 'catCafe',    bgColor: '#b45309', iconColor: '#ffffff' },
  AD5:   { category: 'stay',    label: '숙소',   icon: 'catStay',    bgColor: '#475569', iconColor: '#ffffff' },
  CT1:   { category: 'culture', label: '문화',   icon: 'catCulture', bgColor: '#7c3aed', iconColor: '#ffffff' },
  MT1:   { category: 'shop',    label: '쇼핑',   icon: 'catShop',    bgColor: '#4d7c0f', iconColor: '#ffffff' },
  CS2:   { category: 'shop',    label: '편의점', icon: 'catCart',    bgColor: '#4d7c0f', iconColor: '#ffffff' },
  PK6:   { category: 'other',   label: '주차장', icon: 'catParking', bgColor: '#64748b', iconColor: '#ffffff' },
  OTHER: { category: 'other',   label: '기타',   icon: 'mapPin',     bgColor: '#64748b', iconColor: '#ffffff' },
};

/** PRD 확장 카테고리 (수동·필터용) */
export const EXTENDED_CATEGORY_META: Record<
  Extract<SimpleCategory, 'beauty' | 'market' | 'transport' | 'road'>,
  { label: string; icon: IconName; bgColor: string; iconColor: string; category: SimpleCategory }
> = {
  beauty:    { category: 'beauty',    label: '뷰티',   icon: 'catCulture', bgColor: '#be185d', iconColor: '#ffffff' },
  market:    { category: 'market',    label: '시장',   icon: 'catShop',    bgColor: '#4d7c0f', iconColor: '#ffffff' },
  transport: { category: 'transport', label: '교통', icon: 'transportBus', bgColor: '#0e7490', iconColor: '#ffffff' },
  road:      { category: 'road',      label: '거리',   icon: 'mapPin',     bgColor: '#64748b', iconColor: '#ffffff' },
};

/** SimpleCategory → 대표 카카오 categoryCode */
export const DEFAULT_CODE_BY_SIMPLE_CATEGORY: Record<SimpleCategory, CategoryCode> = {
  food: 'FD6',
  cafe: 'CE7',
  tour: 'AT4',
  culture: 'CT1',
  shop: 'MT1',
  stay: 'AD5',
  beauty: 'OTHER',
  market: 'MT1',
  transport: 'OTHER',
  road: 'OTHER',
  other: 'OTHER',
};

export function getCategoryMeta(
  code: CategoryCode | string | undefined,
  simpleCategory?: SimpleCategory
) {
  if (simpleCategory && simpleCategory in EXTENDED_CATEGORY_META) {
    return EXTENDED_CATEGORY_META[simpleCategory as keyof typeof EXTENDED_CATEGORY_META];
  }
  if (code && code !== 'OTHER' && code in CATEGORY_MAP) {
    return CATEGORY_MAP[code as CategoryCode];
  }
  if (simpleCategory) {
    const fallback = DEFAULT_CODE_BY_SIMPLE_CATEGORY[simpleCategory];
    if (fallback && fallback !== 'OTHER') return CATEGORY_MAP[fallback];
  }
  if (code && code in CATEGORY_MAP) return CATEGORY_MAP[code as CategoryCode];
  return CATEGORY_MAP.OTHER;
}

/** 검색 카테고리 칩·결과 썸네일 공통 강조색 */
export function getSearchCategoryAccent(code: SearchCategoryFilter): string {
  if (!code) return '#64748b';
  return getCategoryMeta(code).bgColor;
}

export function getSimpleCategoryMeta(category: SimpleCategory) {
  if (category in EXTENDED_CATEGORY_META) {
    return EXTENDED_CATEGORY_META[category as keyof typeof EXTENDED_CATEGORY_META];
  }
  const code = DEFAULT_CODE_BY_SIMPLE_CATEGORY[category];
  return getCategoryMeta(code, category);
}

export function applySimpleCategory<T extends { category: SimpleCategory; categoryCode: CategoryCode | 'OTHER'; categoryLabel: string }>(
  place: T,
  category: SimpleCategory,
): T {
  const code = DEFAULT_CODE_BY_SIMPLE_CATEGORY[category];
  const meta = getCategoryMeta(code);
  return {
    ...place,
    category,
    categoryCode: code,
    categoryLabel: meta.label,
  };
}

// =============================================
// 카테고리별 체류시간 추천 (분)
// =============================================

export const STAY_TIME_BY_CATEGORY: Record<SimpleCategory, {
  minutes: number;
  reason: string;
}> = {
  tour:    { minutes: 90, reason: '평균 산책 90분 추천' },
  food:    { minutes: 60, reason: '식사 60분 추천' },
  cafe:    { minutes: 45, reason: '카페 휴식 45분 추천' },
  stay:    { minutes: 0,  reason: '숙소 체크인/아웃' },
  culture: { minutes: 75, reason: '관람 75분 추천' },
  shop:    { minutes: 30, reason: '쇼핑 30분 추천' },
  beauty:  { minutes: 60, reason: '뷰티 60분 추천' },
  market:  { minutes: 45, reason: '시장 45분 추천' },
  transport: { minutes: 15, reason: '이동·환승 15분' },
  road:    { minutes: 40, reason: '거리 산책 40분 추천' },
  other:   { minutes: 30, reason: '체류 30분' },
};

export function suggestStayMinutes(category: SimpleCategory) {
  return STAY_TIME_BY_CATEGORY[category] ?? STAY_TIME_BY_CATEGORY.other;
}

// =============================================
// 정렬 기준 라벨
// =============================================

export const SORT_LABELS = {
  distance: '거리순',
  rating: '평점순',
  review: '리뷰순',
} as const;

export const SORT_FILTER_KEYS = ['distance', 'rating', 'review'] as const;

/** 검색 패널 카테고리 칩 (카카오 category_group_code) — 시안 4+전체 */
export const SEARCH_CATEGORY_FILTERS: Array<{
  code: SearchCategoryFilter;
  label: string;
  icon: IconName;
}> = [
  { code: null, label: '전체', icon: 'catAll' },
  { code: 'FD6', label: '맛집', icon: 'catFood' },
  { code: 'AT4', label: '관광', icon: 'catTour' },
  { code: 'AD5', label: '숙소', icon: 'catStay' },
  { code: 'MT1', label: '마트', icon: 'catShop' },
];

/** 확장 필터(카페·문화·주차) — 필요 시 사용 */
export const SEARCH_CATEGORY_FILTERS_EXTENDED: Array<{
  code: SearchCategoryFilter;
  label: string;
  icon: IconName;
}> = [
  ...SEARCH_CATEGORY_FILTERS,
  { code: 'CE7', label: '카페', icon: 'catCafe' },
  { code: 'CT1', label: '문화', icon: 'catCulture' },
  { code: 'PK6', label: '주차', icon: 'catParking' },
];

export const SEARCH_RADIUS_OPTIONS: Array<{ value: SearchRadiusMeters; label: string }> = [
  { value: 1000, label: '1km' },
  { value: 3000, label: '3km' },
  { value: 5000, label: '5km' },
  { value: 10000, label: '10km' },
  { value: 20000, label: '20km' },
];

// =============================================
// 이동수단 메타
// =============================================

export const TRAVEL_MODE_META = {
  car:     { label: '자동차',   icon: 'transportCar',  speedKmh: 40 },
  walk:    { label: '도보',     icon: 'transportWalk', speedKmh: 4 },
  transit: { label: '대중교통', icon: 'transportBus',  speedKmh: 25 },
  bike:    { label: '자전거',   icon: 'transportBike', speedKmh: 15 },
} as const;
