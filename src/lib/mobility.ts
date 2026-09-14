import type { OptimizeBy, TravelMode } from '../types';
import { estimateLegDistance, estimateLegMinutes, haversineMeters } from './planner';

const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY;
const CAR_URL = 'https://apis-navi.kakaomobility.com/v1/directions';

/**
 * 실제 길찾기 API를 쓸 수 있는 이동수단은 **자동차뿐이다.**
 *
 * 2026-09-14 확인(N02 브라우저 검증 중 콘솔 404 18건으로 발견):
 * - 공개 Navi API(`apis-navi.kakaomobility.com/v1/...`) 제품군은 자동차
 *   길찾기 5종(단일/다중경유지/다중출발지/다중목적지/미래운행)뿐이다.
 * - 예전에 여기 있던 `/v1/walking/directions`·`/v1/transit/directions`는
 *   **존재하지 않는 경로**였다 — 어떤 좌표를 넣어도(서울시청→명동 같은
 *   당연한 도보 구간조차) `{"code":-404,"msg":"route not found"}`가 온다.
 *   같은 키로 자동차 엔드포인트는 200이라 키 문제도 아니다.
 * - 진짜 도보 API는 `/affiliate/walking/v1/directions`인데 **제휴 계약이
 *   있어야 쓸 수 있는 파트너 전용**이라 일반 REST 키로는 못 쓴다.
 *
 * 그래서 도보·자전거·대중교통은 호출을 아예 하지 않고 곧장 추정치를 쓴다.
 * 결과 수치는 예전과 같다(어차피 전부 실패 후 추정으로 폴백됐다) — 대신
 * 구간마다 실패를 기다리던 왕복(6구간 기준 18회, 재시도 대기까지 수 초)이
 * 사라진다. 제휴 계약이 생기면 그때 위 affiliate 주소로 되살릴 것.
 */
function hasDirectionsApi(mode: TravelMode): boolean {
  return mode === 'car';
}

export interface LegResult {
  distanceMeters: number;
  durationMinutes: number;
  polyline?: Array<{ lat: number; lng: number }>;
  source: 'api' | 'estimate';
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 최적화 기준 → 카카오 자동차 길찾기 파라미터.
 *
 * 이 화면의 "최단거리·최소시간·무료도로" 버튼은 원래 저장만 되고 아무 데도
 * 쓰이지 않아 눌러도 결과가 같았다. 카카오 길찾기가 priority/avoid를 받으므로
 * 여기서 실제로 연결한다. 도보·자전거·대중교통 API는 이 파라미터를 받지
 * 않으므로 자동차에서만 의미가 있다.
 */
function carParamsFor(optimizeBy: OptimizeBy | undefined): {
  priority: string;
  avoid?: string;
} {
  switch (optimizeBy) {
    case 'distance':
      return { priority: 'DISTANCE' };
    case 'time':
      return { priority: 'TIME' };
    case 'no-toll':
      // 무료도로 = 유료도로 회피. 우선순위는 카카오 기본 추천을 그대로 둔다.
      return { priority: 'RECOMMEND', avoid: 'toll' };
    default:
      return { priority: 'RECOMMEND' };
  }
}

async function tryFetchApiLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
  optimizeBy?: OptimizeBy
): Promise<LegResult | null> {
  if (!KAKAO_REST_KEY) return null;
  if (mode === 'car') return fetchCarLegFromKakao(from, to, optimizeBy);
  return null;
}

/**
 * 단일 구간 길찾기. REST 키가 있으면 카카오 모빌리티 API 우선.
 */
export async function fetchLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
  optimizeBy?: OptimizeBy
): Promise<LegResult> {
  if (!KAKAO_REST_KEY || !hasDirectionsApi(mode)) {
    return estimateLeg(from, to, mode);
  }

  try {
    const result = await tryFetchApiLeg(from, to, mode, optimizeBy);
    if (result) return result;
  } catch (e) {
    console.warn(`카카오 길찾기(${mode}) 1차 실패, 재시도합니다`, e);
    try {
      await wait(250);
      const retried = await tryFetchApiLeg(from, to, mode, optimizeBy);
      if (retried) return retried;
    } catch (retryError) {
      console.warn(`카카오 길찾기(${mode}) 재시도 실패, 추정으로 폴백`, retryError);
    }
  }
  return estimateLeg(from, to, mode);
}

function estimateLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode
): LegResult {
  let distanceMeters = estimateLegDistance(from, to);
  if (mode === 'transit') {
    // 대중교통은 직선×1.6 보정 (환승·노선 우회 반영)
    distanceMeters = Math.round(haversineMeters(from, to) * 1.6);
  }
  const durationMinutes = estimateLegMinutes(distanceMeters, mode);
  return { distanceMeters, durationMinutes, source: 'estimate' };
}

async function fetchCarLegFromKakao(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  optimizeBy?: OptimizeBy
): Promise<LegResult> {
  const { priority, avoid } = carParamsFor(optimizeBy);
  const params = new URLSearchParams({
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
    priority,
  });
  if (avoid) params.set('avoid', avoid);
  const route = await fetchMobilityRoute(`${CAR_URL}?${params.toString()}`);
  const dist = route.summary.distance as number;
  const durSec = route.summary.duration as number;
  return {
    distanceMeters: dist,
    durationMinutes: Math.max(1, Math.round(durSec / 60)),
    polyline: extractPolylineFromRoute(route),
    source: 'api',
  };
}

async function fetchMobilityRoute(url: string): Promise<{
  summary: { distance: number; duration: number };
  sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }>;
}> {
  const resp = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
  });
  if (!resp.ok) {
    throw new Error(`Kakao Mobility ${resp.status}`);
  }
  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route?.summary) {
    throw new Error('Invalid Mobility response');
  }
  return route;
}

function extractPolylineFromRoute(route: {
  sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }>;
}): Array<{ lat: number; lng: number }> | undefined {
  const path: Array<{ lat: number; lng: number }> = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const v = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lng: v[i], lat: v[i + 1] });
      }
    }
  }
  return path.length > 0 ? path : undefined;
}

export async function fetchLegs(
  points: Array<{ lat: number; lng: number }>,
  mode: TravelMode,
  optimizeBy?: OptimizeBy
): Promise<LegResult[]> {
  if (points.length < 2) return [];
  const pairs: Array<[typeof points[number], typeof points[number]]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    pairs.push([points[i], points[i + 1]]);
  }
  const firstPass = await Promise.all(pairs.map(([a, b]) => fetchLeg(a, b, mode, optimizeBy)));

  // 실패(estimate) 구간만 한 번 더 보강 시도 — API가 없는 이동수단은 재시도도 무의미하다
  if (!KAKAO_REST_KEY || !hasDirectionsApi(mode)) return firstPass;

  const retryIndices = firstPass
    .map((leg, idx) => (leg.source === 'estimate' ? idx : -1))
    .filter((idx) => idx >= 0);
  if (retryIndices.length === 0) return firstPass;

  const secondPass = [...firstPass];
  for (const idx of retryIndices) {
    const [from, to] = pairs[idx];
    try {
      await wait(180);
      const retried = await tryFetchApiLeg(from, to, mode, optimizeBy);
      if (retried) {
        secondPass[idx] = retried;
      }
    } catch {
      // keep estimate leg
    }
  }

  return secondPass;
}
