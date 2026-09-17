import type { Pace, TripIntent } from './tripIntent';
import type { TripCandidate } from './tripCandidates';
import type { RawPinRow } from './importPins';
import { CONTENT_TYPE_TO_CATEGORY_LABEL } from './tourScenario';

/**
 * AI 일정 생성 Step 4 — Ranking + Planner.
 * Claude를 쓰지 않는다(PRD §17·§20 원칙 그대로: 평가·거리계산은 LLM에게 맡기지 않는다).
 * Step 3 후보(TripCandidate[])를 조건별로 점수화하고, 대략적인 지리 분할 +
 * 최근접 이웃 순서로 날짜별 배치한다. 출력은 RawPinRow[]라 기존
 * importPins.ts의 applyImportRows()에 바로 넘길 수 있다 — 새 적용 경로를
 * 만들지 않는다.
 */

export interface GeneratedTripPlan {
  title: string;
  intro: string;
  rows: RawPinRow[];
  /** 점수가 낮거나 pace 상한 초과로 빠진 후보 — "이런 후보도 있었지만 뺐다" 투명성용 */
  droppedCandidateIds: string[];
  /** 후보가 부족해 아무것도 못 채운 날짜(1부터) — UI가 "n일차는 후보 부족" 경고에 사용 */
  emptyDays: number[];
}

const PACE_EVENTS_PER_DAY: Record<Pace, [number, number]> = {
  relaxed: [3, 4],
  normal: [4, 6],
  busy: [5, 8],
};

/** contentTypeId별 평균 체류시간(분) — TourAPI에 실제 체류시간 데이터가 없어 경험적 기본값 사용 */
const STAY_MINUTES: Record<string, number> = {
  '12': 90, // 관광지
  '14': 60, // 문화시설
  '15': 90, // 축제/행사
  '25': 90, // 여행코스
  '28': 120, // 레포츠
  '38': 60, // 쇼핑
  '39': 70, // 음식점
};
const DEFAULT_STAY_MINUTES = 60;

const LONG_WALK_PATTERN = /둘레길|트레킹|올레길|등산|산행/;

function isLongWalkCandidate(c: TripCandidate): boolean {
  return LONG_WALK_PATTERN.test(c.sourceKeyword) || LONG_WALK_PATTERN.test(c.title);
}

/** PRD §18 수준의 가벼운 휴리스틱 — 절대 규칙이 아니라 정렬 우선순위일 뿐, 사용자 조건을 덮어쓰지 않는다 */
function scoreCandidate(c: TripCandidate, intent: TripIntent): number {
  let score = 0;
  if (intent.companions === 'parents') {
    if (c.contentTypeId === '28') score -= 3; // 레포츠 — 체력 부담
    if (c.contentTypeId === '39') score += 1; // 식사·휴식 장소 가점
  } else if (intent.companions === 'kids') {
    if (c.contentTypeId === '14') score += 1; // 문화시설(체험형이 많음)
    if (c.contentTypeId === '28') score -= 1;
  } else if (intent.companions === 'couple') {
    if (c.contentTypeId === '39' || c.contentTypeId === '12') score += 1;
  }
  return score;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 하루 묶음 안에서 지그재그를 줄이는 단순 최근접 이웃 순서 — 실제 도로 이동시간 API는 안 씀(PRD §20) */
function orderByNearestNeighbor(items: TripCandidate[]): TripCandidate[] {
  if (items.length <= 2) return items;
  const remaining = [...items];
  const ordered: TripCandidate[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((c, i) => {
      const d = haversineMeters(last, c);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

const COMPANIONS_LABEL: Record<TripIntent['companions'], string> = {
  parents: '부모님과',
  kids: '아이와',
  couple: '연인과',
  solo: '혼자',
  friends: '친구와',
  unknown: '',
};

const PACE_LABEL: Record<Pace, string> = {
  relaxed: '여유롭게',
  normal: '적당한 속도로',
  busy: '알차게',
};

function buildIntro(intent: TripIntent): string {
  const parts = [
    COMPANIONS_LABEL[intent.companions],
    `${intent.destination} ${intent.days}일`,
    PACE_LABEL[intent.pace],
    intent.avoidLongWalk ? '많이 걷지 않는 코스로' : '',
  ].filter(Boolean);
  return `${parts.join(' ')} 돌아보는 일정이에요.`;
}

export function generateTripPlan(intent: TripIntent, candidates: TripCandidate[]): GeneratedTripPlan {
  const [minEvents, maxEvents] = PACE_EVENTS_PER_DAY[intent.pace];

  const usable = intent.avoidLongWalk
    ? candidates.filter((c) => !isLongWalkCandidate(c))
    : candidates;

  const scored = usable
    .map((c) => ({ c, score: scoreCandidate(c, intent) }))
    .sort((a, b) => b.score - a.score);

  const poolSize = Math.min(scored.length, intent.days * maxEvents);
  const pool = scored.slice(0, poolSize).map((s) => s.c);
  const poolIds = new Set(pool.map((c) => c.contentId));
  const droppedCandidateIds = candidates.filter((c) => !poolIds.has(c.contentId)).map((c) => c.contentId);

  // 지리적으로 대략 균등 분할 — 정교한 클러스터링 대신 경도 정렬 후 day 개수만큼 chunk (v1 단순화)
  const sortedByLng = [...pool].sort((a, b) => a.lng - b.lng);
  const perDay = Math.max(minEvents, Math.min(maxEvents, Math.ceil(sortedByLng.length / intent.days) || minEvents));

  const rows: RawPinRow[] = [];
  const emptyDays: number[] = [];
  for (let dayIdx = 0; dayIdx < intent.days; dayIdx++) {
    const group = sortedByLng.slice(dayIdx * perDay, (dayIdx + 1) * perDay);
    if (group.length === 0) {
      emptyDays.push(dayIdx + 1);
      continue;
    }
    const ordered = orderByNearestNeighbor(group);
    ordered.forEach((c, i) => {
      rows.push({
        day: dayIdx + 1,
        order: i + 1,
        name: c.title,
        categoryLabel: CONTENT_TYPE_TO_CATEGORY_LABEL[c.contentTypeId] ?? '기타',
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        stayMinutes: STAY_MINUTES[c.contentTypeId] ?? DEFAULT_STAY_MINUTES,
        note: `AI 추천 · ${c.sourceKeyword}`,
        placeUrl: `https://www.visitkorea.or.kr/detail/ms_detail.do?contentId=${c.contentId}`,
      });
    });
  }

  return {
    title: `${intent.destination} ${intent.days}일 여행`,
    intro: buildIntro(intent),
    rows,
    droppedCandidateIds,
    emptyDays,
  };
}
