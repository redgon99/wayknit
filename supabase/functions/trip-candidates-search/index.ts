import { corsHeaders } from '../_shared/cors.ts';
import { fetchDestinationCandidates } from '../_shared/tripCandidates.ts';
import type { Companions, Pace, TripIntent } from '../_shared/tripIntent.ts';

/**
 * AI 일정 생성 Step 3 — TripIntent를 받아 TourAPI 후보를 모은다.
 * Step 2(trip-intent-parse)와 분리된 별도 함수: intent를 직접 넘길 수 있어
 * Step 2 없이도(자연어 대신 UI 입력으로 만든 intent로도) 독립적으로 테스트/재사용 가능.
 */

const COMPANIONS_VALUES: Companions[] = ['parents', 'kids', 'couple', 'solo', 'friends', 'unknown'];
const PACE_VALUES: Pace[] = ['relaxed', 'normal', 'busy'];

function isValidIntent(value: unknown): value is TripIntent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.destination === 'string' &&
    v.destination.trim().length > 0 &&
    typeof v.days === 'number' &&
    v.days >= 1 &&
    v.days <= 7 &&
    (COMPANIONS_VALUES as string[]).includes(String(v.companions)) &&
    (PACE_VALUES as string[]).includes(String(v.pace)) &&
    typeof v.avoidLongWalk === 'boolean' &&
    Array.isArray(v.themes)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const serviceKey = Deno.env.get('TOUR_API_KEY')?.trim();
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'TOUR_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { intent?: unknown } = {};
  try {
    body = (await req.json()) as { intent?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isValidIntent(body.intent)) {
    return new Response(JSON.stringify({ error: '유효한 TripIntent가 필요합니다.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await fetchDestinationCandidates(body.intent, serviceKey);
    return new Response(
      JSON.stringify({
        candidates: result.candidates,
        totalCandidates: result.candidates.length,
        rawCountsByQuery: result.rawCountsByQuery,
        filteredOutCount: result.filteredOutCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('trip-candidates-search failed', e);
    return new Response(JSON.stringify({ error: 'Proxy fetch failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
