import { corsHeaders } from '../_shared/cors.ts';
import { DestinationMissingError, parseTripIntent } from '../_shared/tripIntent.ts';

/**
 * AI 일정 생성 Step 2 — 자연어 문장을 TripIntent로 구조화한다.
 * 이 함수는 조건 추출만 한다(장소 검색·배치는 이후 단계에서 별도 함수로 진행).
 */
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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { text?: string } = {};
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: '여행 조건 문장이 필요합니다.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (text.length > 500) {
    return new Response(JSON.stringify({ error: '문장이 너무 깁니다(500자 이하).' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const intent = await parseTripIntent(text, apiKey);
    return new Response(JSON.stringify({ intent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof DestinationMissingError) {
      return new Response(JSON.stringify({ error: e.message, code: 'destination_missing' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error('trip-intent-parse failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
