import { corsHeaders } from '../_shared/cors.ts';

/**
 * 카카오모빌리티 길찾기 REST 키 서버 프록시(2026-09-29).
 *
 * `VITE_KAKAO_REST_KEY`가 클라이언트 번들에 그대로 박혀 있어 브라우저가
 * `Authorization: KakaoAK <키>`를 카카오 서버로 직접 보냈다 — Network
 * 탭에서 누구나 키를 볼 수 있었다(§31-25). 지도 SDK용 `VITE_KAKAO_JS_KEY`는
 * 카카오가 도메인 제한을 걸어 공개돼도 되는 키라 그대로 두고, REST 키만
 * 여기로 옮긴다. 카카오 응답은 가공 없이 그대로 돌려준다 — 파싱 로직은
 * 이미 검증된 클라이언트 코드(mobility.ts/routeCompare.ts)에 그대로 둬서
 * 이번 변경 범위를 "키 위치 이동"으로만 좁힌다.
 */

const DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions';
const WAYPOINTS_URL = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions';

interface LatLng {
  lat: number;
  lng: number;
}

type RequestBody =
  | {
      kind: 'single';
      origin: LatLng;
      destination: LatLng;
      priority: string;
      avoid?: string;
    }
  | {
      kind: 'waypoints';
      origin: LatLng;
      destination: LatLng;
      waypoints?: LatLng[];
      priority: string;
      avoid?: string[];
    };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('KAKAO_REST_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'KAKAO_REST_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let kakaoRes: Response;

    if (body.kind === 'single') {
      const params = new URLSearchParams({
        origin: `${body.origin.lng},${body.origin.lat}`,
        destination: `${body.destination.lng},${body.destination.lat}`,
        priority: body.priority,
      });
      if (body.avoid) params.set('avoid', body.avoid);
      kakaoRes = await fetch(`${DIRECTIONS_URL}?${params.toString()}`, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
      });
    } else if (body.kind === 'waypoints') {
      const kakaoBody: Record<string, unknown> = {
        origin: { x: body.origin.lng, y: body.origin.lat },
        destination: { x: body.destination.lng, y: body.destination.lat },
        priority: body.priority,
      };
      if (body.waypoints && body.waypoints.length > 0) {
        kakaoBody.waypoints = body.waypoints.map((p) => ({ x: p.lng, y: p.lat }));
      }
      if (body.avoid) kakaoBody.avoid = body.avoid;
      kakaoRes = await fetch(WAYPOINTS_URL, {
        method: 'POST',
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kakaoBody),
      });
    } else {
      return new Response(JSON.stringify({ error: 'invalid kind' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = await kakaoRes.text();
    return new Response(text, {
      status: kakaoRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('kakao-directions failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
