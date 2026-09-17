/**
 * AI 일정 생성 Step 3 — TripIntent(목적지+관심사)로 TourAPI 후보를 모은다.
 *
 * 🔴(2026-09-17, 사용자 실사용 테스트에서 발견) 처음엔 "목적지+키워드"를
 * 한 문자열로 합쳐(예: "강릉 카페") searchKeyword2에 넘겼는데, 이 API는
 * 그 문자열을 제목/개요에 대한 리터럴 부분일치로 처리한다. "강릉 카페"라는
 * 글자가 그대로 들어간 상호는 사실상 없어서(실제 업체명은 그냥 "OO카페")
 * 거의 항상 0건이 돌아왔다 — 화면에서 "조건에 맞는 후보를 찾지 못했어요"로
 * 나타난 버그.
 *
 * 고침: tour-scenario(테마 카탈로그)와 같은 패턴으로 되돌린다 — 키워드는
 * 단독으로 전국 검색하고(제목에 그 단어가 실제로 들어간 업체를 찾음),
 * 주소/제목에 목적지 토큰이 있는지로 사후 필터링한다. 추가로 목적지
 * 이름 자체도 검색어로 한 번 더 넣는다 — "경포대"처럼 지명이 상호에
 * 직접 들어간 관광지를 놓치지 않기 위해서다.
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

/**
 * contentTypeId 25(여행코스)는 개별 방문지가 아니라 "코스 전체"를 가리키는
 * 항목이라 제목이 "신사임당과 허난설헌을 낳은 고장 강릉에 가다"처럼 기사·
 * 블로그 형태라 실제 장소명이 아니다(사용자 실사용 테스트에서 발견, 2026-09-17).
 * 기존 테마 카탈로그 흐름은 Claude가 이런 후보를 걸러내며 고르지만, 이
 * Step 4 플래너는 의도적으로 AI를 안 쓰므로(PRD §17) 소스 단계에서 제외한다.
 */
const EXCLUDED_CONTENT_TYPES = new Set(['25']);

/** API 호출량을 억제하기 위해 테마당 대표 키워드 1개만, 최대 3개 테마까지만 쓴다 */
const MAX_THEME_KEYWORDS = 3;

/** 목적지 이름 자체 + 단독 관심사 키워드 — 절대 destination과 합쳐서 검색하지 않는다(위 주석 참고) */
function buildSearchTerms(intent: TripIntent): string[] {
  const base = [...BASELINE_KEYWORDS];
  const themeKeywords = intent.themes
    .slice(0, MAX_THEME_KEYWORDS)
    .map((theme: ScenarioTheme) => SCENARIO_THEME_QUERIES[theme]?.keywords[0])
    .filter((kw): kw is string => Boolean(kw));
  return [...new Set([intent.destination, ...base, ...themeKeywords])];
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

  const terms = buildSearchTerms(intent);
  const rawCountsByQuery: Record<string, number> = {};

  const results = await Promise.all(
    terms.map(async (term) => {
      const items = await fetchItems(buildScenarioKeywordUrl(term, serviceKey));
      rawCountsByQuery[term] = items.length;
      return items.map((item) => ({ item, sourceKeyword: term }));
    })
  );

  const seen = new Set<string>();
  const candidates: ScenarioCandidate[] = [];
  let filteredOutCount = 0;

  for (const { item, sourceKeyword } of results.flat()) {
    if (!item.contentid || seen.has(item.contentid)) continue;
    if (item.contenttypeid && EXCLUDED_CONTENT_TYPES.has(item.contenttypeid.trim())) continue;
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
