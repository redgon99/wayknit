import { getSupabase, isSupabaseConfigured } from './supabase';
import { applyImportRows, type PinImportResult, type RawPinRow } from './importPins';
import { CATEGORY_MAP, DEFAULT_CODE_BY_SIMPLE_CATEGORY } from './categories';
import type { Place, PinnedPlace, SimpleCategory } from '../types';

export type ScenarioTheme =
  | 'meditation'
  | 'wellbeing'
  | 'shopping'
  | 'family'
  | 'honeymoon'
  | 'night'
  | 'hallyu'
  | 'camping'
  | 'walking'
  | 'marine';

export const SCENARIO_THEMES: ScenarioTheme[] = [
  'meditation',
  'wellbeing',
  'shopping',
  'family',
  'honeymoon',
  'night',
  'hallyu',
  'camping',
  'walking',
  'marine',
];

export interface ScenarioStop {
  placeId: string;
  contentId: string;
  contentTypeId: string;
  title: string;
  titleKo?: string;
  address: string;
  lat: number;
  lng: number;
  thumbnailUrl?: string;
  note: string;
  /** 이 장소를 이 시나리오에 넣은 이유를 요약한 짧은 한 줄(카탈로그 탐색 화면 전용 표시, 핀에는 반영되지 않음) */
  reason?: string;
  /** 'gocamping'이면 contentId가 GoCamping 자체 ID 공간이라 visitkorea가 아닌 gocamping.or.kr로 링크해야 함 */
  sourceApi?: 'gocamping';
  /** KorPetTourService2/KorWithService2에 등록된 스팟인지 (반려동물 동반가능/무장애 시설) */
  petFriendly?: boolean;
  accessible?: boolean;
}

export interface ScenarioDay {
  day: number;
  dayTitle: string;
  stops: ScenarioStop[];
}

export interface TourScenario {
  theme: ScenarioTheme;
  region: string;
  regionLabel?: string;
  title: string;
  intro: string;
  days: ScenarioDay[];
  offeredRegions: Array<{ region: string; candidateCount: number }>;
  droppedStopContentIds: string[];
}

/** contentTypeId(TourAPI) → 기존 가져오기 파이프라인이 이해하는 한글 카테고리 라벨. tripPlanner.ts(§31-22 Step 4)도 재사용 */
export const CONTENT_TYPE_TO_CATEGORY_LABEL: Record<string, string> = {
  '12': '관광지',
  '14': '문화',
  '15': '문화',
  '25': '관광지',
  '28': '관광지',
  '32': '숙소',
  '38': '쇼핑',
  '39': '맛집',
};

/** contentTypeId(TourAPI) → 앱 내부 SimpleCategory (지도 마커·아이콘용) */
const CONTENT_TYPE_TO_SIMPLE_CATEGORY: Record<string, SimpleCategory> = {
  '12': 'tour',
  '14': 'culture',
  '15': 'culture',
  '25': 'tour',
  '28': 'tour',
  '32': 'stay',
  '38': 'shop',
  '39': 'food',
};

/** GoCamping은 contentId가 "gocamping:<원본ID>" 형태 — visitkorea가 아닌 자체 상세페이지로 연결한다 */
function scenarioStopDetailUrl(stop: Pick<ScenarioStop, 'contentId' | 'sourceApi'>): string {
  if (stop.sourceApi === 'gocamping') {
    const rawId = stop.contentId.replace(/^gocamping:/, '');
    return `https://www.gocamping.or.kr/bsite/camp/info/read.do?c_no=${rawId}`;
  }
  return `https://www.visitkorea.or.kr/detail/ms_detail.do?contentId=${stop.contentId}`;
}

/** 시나리오 스팟 카드를 클릭했을 때 지도 이동·정보창 표시에 쓸 Place로 변환 */
export function scenarioStopToPlace(stop: ScenarioStop): Place {
  const category = CONTENT_TYPE_TO_SIMPLE_CATEGORY[stop.contentTypeId] ?? 'tour';
  const categoryCode = DEFAULT_CODE_BY_SIMPLE_CATEGORY[category];
  return {
    id: stop.placeId,
    name: stop.title,
    nameKo: stop.titleKo,
    category,
    categoryCode,
    categoryLabel: CATEGORY_MAP[categoryCode].label,
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
    thumbnailUrl: stop.thumbnailUrl,
    placeUrl: scenarioStopDetailUrl(stop),
  };
}

export function isTourScenarioConfigured(): boolean {
  return isSupabaseConfigured;
}

/** 하루 일정에 배치하는 평균 스팟 수 — 서버 프롬프트의 "하루 2~4곳" 지침과 일치 */
const STOPS_PER_DAY_ESTIMATE = 3;
/** 데이터가 아무리 풍부해도 하루 단위 AI 시나리오는 이 이상 늘리지 않음(비용·현실성) */
export const MAX_DAYS_CEILING = 7;
/** 후보 밀집도를 확인 못했을 때(오류 등) 쓰는 보수적 기본값 */
const FALLBACK_MAX_DAYS = 5;

export interface ScenarioAvailability {
  maxDays: number;
  topRegion?: string;
  topRegionCount: number;
}

/**
 * 테마 선택 시 실제 후보 밀집도를 미리 조회해 "며칠까지 만들 수 있는지"를 계산한다.
 * 정적으로 일수 상한을 걸어두면(예: 무조건 5일) 데이터가 부족한 테마는 뒷날짜가
 * 조용히 비어버리고, 데이터가 풍부한 테마는 불필요하게 제한된다 — 실제 밀집도
 * 기반으로 상한을 매겨야 두 문제를 동시에 해결한다.
 */
export async function fetchScenarioAvailability(theme: ScenarioTheme): Promise<ScenarioAvailability> {
  const supabase = getSupabase();
  if (!supabase) return { maxDays: FALLBACK_MAX_DAYS, topRegionCount: 0 };

  const { data, error } = await supabase.functions.invoke<{
    regionClusters?: Array<{ region: string; count: number }>;
  }>('tour-scenario-candidates', { body: { theme } });

  const top = data?.regionClusters?.[0];
  if (error || !top) return { maxDays: FALLBACK_MAX_DAYS, topRegionCount: 0 };

  const maxDays = Math.min(
    MAX_DAYS_CEILING,
    Math.max(1, Math.floor(top.count / STOPS_PER_DAY_ESTIMATE))
  );
  return { maxDays, topRegion: top.region, topRegionCount: top.count };
}

/**
 * 생성된 시나리오를 기존 핀 가져오기 파이프라인(importPins.ts)에 태워
 * 일자별 PinnedPlace로 변환한다. 새 매핑 로직을 만들지 않고 검증된
 * applyImportRows()를 그대로 재사용해 day/order/카테고리 처리 일관성을 유지한다.
 */
export function applyScenarioToTrip(
  scenario: TourScenario,
  options: { currentDay: number; totalDays: number; existingByDay: Record<number, PinnedPlace[]> }
): PinImportResult {
  const rows: RawPinRow[] = scenario.days.flatMap((day) =>
    day.stops.map((stop, i) => ({
      day: day.day,
      order: i + 1,
      name: stop.titleKo || stop.title,
      categoryLabel: CONTENT_TYPE_TO_CATEGORY_LABEL[stop.contentTypeId] ?? '기타',
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
      note: stop.note,
      placeUrl: scenarioStopDetailUrl(stop),
    }))
  );

  return applyImportRows(rows, {
    currentDay: options.currentDay,
    totalDays: options.totalDays,
    existingByDay: options.existingByDay,
    scope: 'all',
    mode: 'merge',
  });
}
