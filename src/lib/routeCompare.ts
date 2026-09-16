/**
 * 최적화 3종(최단거리·최소시간·무료도로) 경로 비교.
 *
 * 고르기 전에 세 경로가 어떻게 다른지 지도에서 바로 보이게 하고, 통행료까지
 * 함께 보여주기 위한 것이다. 눌러보고 "동선 다시 만들기"를 세 번 해야
 * 비교되던 것을 한 번에 볼 수 있게 한다.
 *
 * 비용: 카카오 **경유지 길찾기**는 전체 경로를 1회 호출로 돌려주므로
 * 3종 비교가 3회면 끝난다. 구간마다 호출하는 기존 방식(fetchLegs)으로
 * 비교하면 정류장 5곳 기준 15회가 나간다.
 */
import type { OptimizeBy, TravelMode } from '../types';

const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY;
const WAYPOINTS_URL = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions';

/** 지도에서 서로 구분되도록. 선택된 것만 진하게 그린다. */
export const COMPARE_COLORS: Record<OptimizeBy, string> = {
  distance: '#dc2626',
  time: '#16a34a',
  'no-toll': '#2563eb',
};

/**
 * 미선택 두 경로가 같은 도로를 지날 때 색만으로는 구분이 안 됐다(§6-7).
 * 굵기를 다르게 주고 얇은 쪽을 위에 그리면, 겹치는 구간에서 두꺼운 쪽의
 * 양옆 테두리가 삐져나와 보여 좁은 화면에서도 층이 구분된다.
 */
export const COMPARE_LINE_WEIGHT: Record<OptimizeBy, number> = {
  distance: 5,
  time: 4,
  'no-toll': 3,
};

export const COMPARE_ORDER: OptimizeBy[] = ['distance', 'time', 'no-toll'];

export interface RouteComparison {
  optimizeBy: OptimizeBy;
  distanceKm: number;
  durationMinutes: number;
  /** 통행료(원). 무료도로는 0이 나온다. 응답에 없으면 null */
  tollFare: number | null;
  path: Array<{ lat: number; lng: number }>;
}

interface Point {
  lat: number;
  lng: number;
}

function paramsFor(optimizeBy: OptimizeBy): { priority: string; avoid?: string[] } {
  switch (optimizeBy) {
    case 'distance':
      return { priority: 'DISTANCE' };
    case 'time':
      return { priority: 'TIME' };
    case 'no-toll':
      return { priority: 'RECOMMEND', avoid: ['toll'] };
  }
}

function extractPath(route: {
  sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }>;
}): Point[] {
  const path: Point[] = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const v = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lng: v[i], lat: v[i + 1] });
      }
    }
  }
  return path;
}

async function fetchOne(points: Point[], optimizeBy: OptimizeBy): Promise<RouteComparison | null> {
  const { priority, avoid } = paramsFor(optimizeBy);
  const body: Record<string, unknown> = {
    origin: { x: points[0].lng, y: points[0].lat },
    destination: { x: points[points.length - 1].lng, y: points[points.length - 1].lat },
    priority,
  };
  const waypoints = points.slice(1, -1);
  if (waypoints.length > 0) {
    body.waypoints = waypoints.map((p) => ({ x: p.lng, y: p.lat }));
  }
  if (avoid) body.avoid = avoid;

  const resp = await fetch(WAYPOINTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  const route = data?.routes?.[0];
  // result_code 0이 정상. 경유지가 도로에서 너무 멀면 실패 코드가 온다.
  if (!route || (route.result_code !== undefined && route.result_code !== 0)) return null;
  if (!route.summary) return null;

  const toll = route.summary.fare?.toll;
  return {
    optimizeBy,
    distanceKm: Math.round((route.summary.distance / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(route.summary.duration / 60)),
    tollFare: typeof toll === 'number' ? toll : null,
    path: extractPath(route),
  };
}

/**
 * 세 가지 기준의 경로를 한 번에 받아온다.
 * 자동차가 아니면 빈 배열 — 도보·자전거·대중교통 API는 우선순위를 받지 않는다.
 */
export async function compareRouteOptions(
  points: Point[],
  mode: TravelMode
): Promise<RouteComparison[]> {
  if (!KAKAO_REST_KEY || mode !== 'car' || points.length < 2) return [];

  const results = await Promise.all(
    COMPARE_ORDER.map((key) => fetchOne(points, key).catch(() => null))
  );
  return results.filter((r): r is RouteComparison => r !== null);
}

/** 비교 결과를 다시 부를지 판단하는 키 — 좌표·이동수단이 그대로면 재호출하지 않는다 */
export function comparisonKey(points: Point[], mode: TravelMode): string {
  return `${mode}|${points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`;
}
