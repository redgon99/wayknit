/**
 * AI 일정 생성 Step 3 — TripIntent(목적지+관심사)로 TourAPI 후보를 모은다.
 * tour-scenario의 "테마로 전국에서 지역을 찾는" 방향과 반대로, 여기는
 * 사용자가 이미 목적지를 정했으므로 "목적지+키워드" 조합으로 바로 검색한다.
 * 지역코드 매핑 테이블은 만들지 않는다 — searchKeyword2가 이미 지명을
 * 포함한 키워드를 알아서 처리하고, 주소 substring 필터로 결과를 한 번 더 거른다.
 */
import {
  buildScenarioKeywordUrl,
  fetchItems,
  regionPrefixOf,
  SCENARIO_THEME_QUERIES,
  type ScenarioCandidate,
  type ScenarioTheme,
} from './tourScenario.ts';
import { candidatesPerRegionCap, diversifyBySourceKeyword } from './scenarioGen.ts';
import type { TripIntent } from './tripIntent.ts';

/** 관심사(테마)를 하나도 안 골랐을 때 쓰는 기본 키워드 — 관광지/맛집/카페면 어떤 여행에도 무난히 맞음 */
const BASELINE_KEYWORDS = ['관광지', '맛집', '카페'];

/** API 호출량을 억제하기 위해 테마당 대표 키워드 1개만, 최대 3개 테마까지만 쓴다 */
const MAX_THEME_KEYWORDS = 3;

function buildSearchKeywords(intent: TripIntent): string[] {
  const base = [...BASELINE_KEYWORDS];
  const themeKeywords = intent.themes
    .slice(0, MAX_THEME_KEYWORDS)
    .map((theme: ScenarioTheme) => SCENARIO_THEME_QUERIES[theme]?.keywords[0])
    .filter((kw): kw is string => Boolean(kw));
  return [...new Set([...base, ...themeKeywords])];
}

/**
 * 후보 주소/제목이 목적지 문구와 실제로 관련 있는지 느슨하게 검사한다.
 * "속초 고성"처럼 여러 지명이 섞인 경우 공백으로 나눠 하나라도 걸리면 통과.
 * 이게 없으면 흔한 키워드(예: "맛집")가 전국구 인기 결과로 밀려 목적지와
 * 무관한 후보가 섞여 들어올 수 있다.
 */
function matchesDestination(candidate: ScenarioCandidate, destinationTokens: string[]): boolean {
  if (destinationTokens.length === 0) return true;
  const haystack = `${candidate.address} ${candidate.title}`;
  return destinationTokens.some((token) => haystack.includes(token));
}

export interface DestinationCandidateResult {
  candidates: ScenarioCandidate[];
  rawCountsByQuery: Record<string, number>;
  /** 목적지 필터를 통과 못 해 제외된 수 — 검색어가 목적지와 안 맞았는지 진단용 */
  filteredOutCount: number;
}

export async function fetchDestinationCandidates(
  intent: TripIntent,
  serviceKey: string
): Promise<DestinationCandidateResult> {
  const destinationTokens = intent.destination
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2); // "강릉" 통과, 조사만 남은 1글자 토큰은 제외

  const keywords = buildSearchKeywords(intent);
  const rawCountsByQuery: Record<string, number> = {};

  const results = await Promise.all(
    keywords.map(async (kw) => {
      const combined = `${intent.destination} ${kw}`.trim();
      const items = await fetchItems(buildScenarioKeywordUrl(combined, serviceKey));
      rawCountsByQuery[kw] = items.length;
      return items.map((item) => ({ item, sourceKeyword: kw }));
    })
  );

  const seen = new Set<string>();
  const candidates: ScenarioCandidate[] = [];
  let filteredOutCount = 0;

  for (const { item, sourceKeyword } of results.flat()) {
    if (!item.contentid || seen.has(item.contentid)) continue;
    const lat = parseFloat(item.mapy);
    const lng = parseFloat(item.mapx);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const candidate: ScenarioCandidate = {
      contentId: item.contentid,
      contentTypeId: item.contenttypeid?.trim() || '0',
      title: item.title.replace(/<[^>]+>/g, ''),
      address: item.addr1 ?? '',
      region: regionPrefixOf(item.addr1) ?? '미상',
      lat,
      lng,
      sourceKeyword,
      thumbnailUrl: item.firstimage?.trim() || undefined,
    };

    if (!matchesDestination(candidate, destinationTokens)) {
      filteredOutCount++;
      continue;
    }

    seen.add(item.contentid);
    candidates.push(candidate);
  }

  const cap = candidatesPerRegionCap(intent.days);
  const diversified = diversifyBySourceKeyword(candidates, cap);

  return { candidates: diversified, rawCountsByQuery, filteredOutCount };
}
