/**
 * 테마 여행 시나리오 — 테마별 후보 장소 수집 전략
 *
 * TourAPI에는 "의료관광/명상관광/웰빙관광" 같은 라이프스타일 테마 카테고리가
 * 없다. 대신 키워드 검색(searchKeyword2, 전국 대상)으로 후보를 모은다.
 *
 * 이 기능은 "지도 근처 둘러보기"가 아니라 "전국에서 테마에 가장 적합한
 * 지역을 찾아 시나리오를 만드는" 것이므로 좌표/반경으로 후보를 제한하지
 * 않는다. 대신 전국 후보를 지역(시도)별로 클러스터링해 밀집 지역을 찾고,
 * 그 지역을 시나리오의 무대로 삼는다.
 */

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

interface ThemeQuerySpec {
  keywords: string[];
}

export const SCENARIO_THEME_QUERIES: Record<ScenarioTheme, ThemeQuerySpec> = {
  // '산사'는 '황병산사냥'처럼 부분 문자열로 오탐되어 '사찰'/'수련원'으로 교체
  meditation: { keywords: ['템플스테이', '한옥스테이', '사찰', '수련원'] },
  // '스파'는 의류 브랜드 '스파오'와 충돌하여 제외, '휴양림' 추가
  wellbeing: { keywords: ['온천', '찜질방', '힐링', '휴양림'] },
  // 좌표 기반 cat1(A04) 조회를 뺀 대신 '백화점' 키워드로 보완
  shopping: { keywords: ['아울렛', '전통시장', '면세점', '백화점'] },
  family: { keywords: ['키즈카페', '동물원', '과학관', '테마파크'] },
  honeymoon: { keywords: ['리조트', '오션뷰', '전망대', '스카이워크'] },
  // KTO 데이터랩 "특화관광 테마" 분류 참고해 추가
  night: { keywords: ['야시장', '야경', '야간개장'] },
  // '한류' 단독 검색은 결과가 거의 없어 '촬영지'/'케이팝' 위주로 구성
  hallyu: { keywords: ['촬영지', '케이팝', '아이돌'] },
  camping: { keywords: ['캠핑장', '글램핑', '오토캠핑'] },
  walking: { keywords: ['둘레길', '트레킹', '올레길'] },
  marine: { keywords: ['해수욕장', '마리나', '요트'] },
};

/**
 * WellnessTursmService(wellnessThemaCd)로 보강 가능한 테마.
 * KorService2 키워드 검색은 '수련원'이 청소년 캠프시설을 오탐하는 등 노이즈가 있는데,
 * 이 서비스는 KTO가 직접 큐레이션한 웰니스 시설 목록이라 오탐이 없다. 기존 키워드
 * 후보를 대체하지 않고 합쳐서(중복 제거) 커버리지를 넓히는 용도로 쓴다.
 */
const WELLNESS_THEME_CODES: Partial<Record<ScenarioTheme, string[]>> = {
  meditation: ['EX050400'], // 힐링명상
  wellbeing: ['EX050100', 'EX050200', 'EX050700'], // 온천/사우나/스파, 찜질방, 자연치유
};

/**
 * GoCamping(고캠핑) 큐레이션 야영장 DB로 보강 가능한 테마. GoCamping은 자체 ID 체계를
 * 쓰므로(KorService2와 불일치) contentId에 'gocamping:' 접두어를 붙여 후보 병합 시
 * ID 충돌을 막는다 — sourceApi 필드로 하류(placeUrl 생성 등)에서 구분해서 처리한다.
 */
const GOCAMPING_ENABLED_THEMES: ScenarioTheme[] = ['camping'];

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const WELLNESS_BASE = 'https://apis.data.go.kr/B551011/WellnessTursmService';
const GOCAMPING_BASE = 'https://apis.data.go.kr/B551011/GoCamping';

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

/** searchKeyword2 — 키워드 전국 검색 */
export function buildScenarioKeywordUrl(
  keyword: string,
  serviceKey: string,
  numOfRows = 100
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    keyword,
    numOfRows: String(numOfRows),
    pageNo: '1',
    arrange: 'C',
  });
  return `${BASE}/searchKeyword2?${keyParam(serviceKey)}&${params.toString()}`;
}

/** WellnessTursmService/areaBasedList — 큐레이션된 웰니스 시설 전국 목록 (wellnessThemaCd 필터) */
export function buildWellnessAreaUrl(
  wellnessThemaCd: string,
  serviceKey: string,
  numOfRows = 100
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    langDivCd: 'KOR',
    wellnessThemaCd,
    numOfRows: String(numOfRows),
    pageNo: '1',
    arrange: 'C',
  });
  return `${WELLNESS_BASE}/areaBasedList?${keyParam(serviceKey)}&${params.toString()}`;
}

/** GoCamping/searchList — 큐레이션 야영장 DB 키워드 검색 */
export function buildGoCampingSearchUrl(keyword: string, serviceKey: string, numOfRows = 100): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    keyword,
    numOfRows: String(numOfRows),
    pageNo: '1',
  });
  return `${GOCAMPING_BASE}/searchList?${keyParam(serviceKey)}&${params.toString()}`;
}

/** 주소 첫 토큰(시도 단위)으로 지역 그룹핑 — src/lib/koreaAreaCodes.ts의 regionPrefixOf와 동일 로직 */
export function regionPrefixOf(address: string | undefined | null): string | undefined {
  if (!address) return undefined;
  const first = address.trim().split(/\s+/)[0];
  return first || undefined;
}

interface RawItem {
  contentid: string;
  contenttypeid?: string;
  title: string;
  addr1?: string;
  mapx: string;
  mapy: string;
  firstimage?: string;
}

export interface ScenarioCandidate {
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  sourceKeyword: string;
  thumbnailUrl?: string;
  /**
   * GoCamping은 KorService2/WellnessTursmService와 ID 공간이 다르다(별도 자체 등록번호).
   * 'gocamping'이면 contentId가 "gocamping:<원본ID>" 형태이며, visitkorea 상세링크 대신
   * gocamping.or.kr 자체 상세페이지로 연결해야 한다.
   */
  sourceApi?: 'gocamping';
}

export interface ScenarioRegionCluster {
  region: string;
  count: number;
  candidates: ScenarioCandidate[];
}

async function fetchItems(url: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: RawItem | RawItem[] } } };
  };
  const raw = json.response?.body?.items?.item;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

/** WellnessTursmService 응답 필드는 KorService2와 다른 카멜케이스를 쓴다 */
interface WellnessRawItem {
  contentId: string;
  contentTypeId?: string;
  title: string;
  baseAddr?: string;
  mapX: string;
  mapY: string;
  firstimage?: string;
}

async function fetchWellnessItems(url: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: WellnessRawItem | WellnessRawItem[] } } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // 이후 클러스터링 로직이 RawItem(KorService2 소문자 필드) 형태를 기대하므로 변환
  return list.map((it) => ({
    contentid: it.contentId,
    contenttypeid: it.contentTypeId,
    title: it.title,
    addr1: it.baseAddr,
    mapx: it.mapX,
    mapy: it.mapY,
    firstimage: it.firstimage,
  }));
}

/** GoCamping 응답 필드 — WellnessTursmService와도 다른 자체 스키마(facltNm, firstImageUrl 등) */
interface GoCampingRawItem {
  contentId: string;
  facltNm: string;
  addr1?: string;
  mapX: string;
  mapY: string;
  firstImageUrl?: string;
}

async function fetchGoCampingItems(url: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: GoCampingRawItem | GoCampingRawItem[] } } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((it) => ({
    // GoCamping은 KorService2와 ID 공간이 달라 접두어로 네임스페이스를 분리한다.
    contentid: `gocamping:${it.contentId}`,
    // KorService2 contentTypeId 체계엔 '야영장' 전용 코드가 없다 — 숙박(32, 스테이) 카테고리로 근사한다.
    contenttypeid: '32',
    title: it.facltNm,
    addr1: it.addr1,
    mapx: it.mapX,
    mapy: it.mapY,
    firstimage: it.firstImageUrl,
  }));
}

/** 테마 후보를 전국에서 모아 지역(시도)별로 클러스터링한다. 밀집도 내림차순 정렬. */
export async function fetchThemeRegionClusters(
  theme: ScenarioTheme,
  serviceKey: string
): Promise<{ regionClusters: ScenarioRegionCluster[]; rawCountsByQuery: Record<string, number> }> {
  const spec = SCENARIO_THEME_QUERIES[theme];
  const rawCountsByQuery: Record<string, number> = {};

  const keywordResults = await Promise.all(
    spec.keywords.map(async (kw) => {
      const items = await fetchItems(buildScenarioKeywordUrl(kw, serviceKey));
      rawCountsByQuery[kw] = items.length;
      return items.map((it) => ({ item: it, sourceKeyword: kw, sourceApi: undefined as 'gocamping' | undefined }));
    })
  );

  const wellnessThemeCodes = WELLNESS_THEME_CODES[theme] ?? [];
  const wellnessResults = await Promise.all(
    wellnessThemeCodes.map(async (code) => {
      const items = await fetchWellnessItems(buildWellnessAreaUrl(code, serviceKey));
      const sourceKeyword = `wellness:${code}`;
      rawCountsByQuery[sourceKeyword] = items.length;
      return items.map((it) => ({ item: it, sourceKeyword, sourceApi: undefined as 'gocamping' | undefined }));
    })
  );

  const goCampingResults = GOCAMPING_ENABLED_THEMES.includes(theme)
    ? await Promise.all(
        spec.keywords.map(async (kw) => {
          const items = await fetchGoCampingItems(buildGoCampingSearchUrl(kw, serviceKey));
          const sourceKeyword = `gocamping:${kw}`;
          rawCountsByQuery[sourceKeyword] = items.length;
          return items.map((it) => ({ item: it, sourceKeyword, sourceApi: 'gocamping' as const }));
        })
      )
    : [];

  const seen = new Set<string>();
  const clusters = new Map<string, ScenarioCandidate[]>();

  for (const { item, sourceKeyword, sourceApi } of [
    ...keywordResults.flat(),
    ...wellnessResults.flat(),
    ...goCampingResults.flat(),
  ]) {
    if (!item.contentid || seen.has(item.contentid)) continue;
    // '수련원' 검색어가 청소년 단체캠프 시설을 오탐하는 문제 — 명상 테마 취지와 무관하므로 제외
    if (sourceKeyword === '수련원' && item.title.includes('청소년')) continue;
    const lat = parseFloat(item.mapy);
    const lng = parseFloat(item.mapx);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const region = regionPrefixOf(item.addr1) ?? '미상';
    if (region === '미상') continue;
    seen.add(item.contentid);
    const candidate: ScenarioCandidate = {
      contentId: item.contentid,
      contentTypeId: item.contenttypeid?.trim() || '0',
      title: item.title.replace(/<[^>]+>/g, ''),
      address: item.addr1 ?? '',
      region,
      lat,
      lng,
      sourceKeyword,
      thumbnailUrl: item.firstimage?.trim() || undefined,
      sourceApi,
    };
    const list = clusters.get(region);
    if (list) list.push(candidate);
    else clusters.set(region, [candidate]);
  }

  const regionClusters: ScenarioRegionCluster[] = Array.from(clusters.entries())
    .map(([region, candidates]) => ({ region, count: candidates.length, candidates }))
    .sort((a, b) => b.count - a.count);

  return { regionClusters, rawCountsByQuery };
}
