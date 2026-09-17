import { corsHeaders } from '../_shared/cors.ts';
import { decodeHtmlEntities } from '../_shared/htmlEntities.ts';
import { finishRun, getServiceClient, startRun } from '../_shared/insightDb.ts';
import { placeKey } from '../_shared/placeKey.ts';

/**
 * insight_analysis 는 게시물 단위라 장소와 연결돼 있지 않다.
 * 이 함수는 분석이 끝난 게시물 본문에서 "구체적인 장소"만 뽑아
 * insight_place_mentions 에 적재하고 place_reactions 집계를 갱신한다.
 */

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_TOTAL_LIMIT = 40;
const ITEMS_PER_CLAUDE_CALL = 8;
const CONTENT_MAX_CHARS = 900;
const CANDIDATE_POOL_SIZE = 300;
const MAX_PLACES_PER_ITEM = 5;

const ASPECTS = [
  'crowd',
  'price',
  'access',
  'food',
  'view',
  'service',
  'facility',
  'other',
] as const;
type Aspect = (typeof ASPECTS)[number];

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
type Sentiment = (typeof SENTIMENTS)[number];

interface CandidateRow {
  analysis_id: string;
  raw_item_id: string;
  title: string | null;
  content: string | null;
  url: string | null;
}

interface ExtractedPlace {
  name: string;
  sentiment?: string;
  aspect?: string;
  quote?: string;
}

interface ExtractionResult {
  id: string;
  places: ExtractedPlace[];
}

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildPrompt(items: CandidateRow[]): string {
  const listing = items
    .map(
      (it, idx) =>
        `${idx + 1}. id="${it.analysis_id}"\n제목: ${truncate(it.title, 140)}\n내용: ${truncate(
          it.content,
          CONTENT_MAX_CHARS,
        )}`,
    )
    .join('\n\n');

  return `당신은 한국여행 게시글·댓글에서 **구체적인 장소**에 대한 여행자 반응만 추출하는 어시스턴트입니다.

추출 규칙:
- "서울", "부산", "제주도" 같은 도시·광역 지명은 장소가 아닙니다. 제외하세요.
- "경복궁", "광장시장", "감천문화마을"처럼 지도에서 한 점으로 찍히는 장소만 추출합니다.
- 언급이 없으면 places를 빈 배열로 두세요. 억지로 만들지 마세요.
- 한 항목당 최대 ${MAX_PLACES_PER_ITEM}개.
- name: 한국어 정식 명칭을 우선하고, 원문이 영문뿐이면 원문 표기를 그대로 씁니다.
- sentiment: positive | neutral | negative (그 장소에 대한 글쓴이의 태도)
- aspect: 반응의 핵심 축 하나 — ${ASPECTS.join(' | ')}
  (crowd=혼잡/대기, price=가격, access=교통/접근성, food=음식맛, view=경관/사진,
   service=응대, facility=시설/청결, other=그 외)
- quote: 근거가 되는 원문 문장 1개, 80자 이내. 없으면 생략.

항목:
${listing}

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트를 추가하지 마세요.
[{"id": "...", "places": [{"name": "...", "sentiment": "...", "aspect": "...", "quote": "..."}]}]`;
}

function parseClaudeJson(text: string): ExtractionResult[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : text;
  const parsed = JSON.parse(jsonText.trim());
  if (!Array.isArray(parsed)) throw new Error('claude response is not an array');
  return parsed as ExtractionResult[];
}

async function extractBatch(items: CandidateRow[], apiKey: string): Promise<ExtractionResult[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(items) }],
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
  return parseClaudeJson(text);
}

function normalizeSentiment(value: string | undefined): Sentiment | null {
  return (SENTIMENTS as readonly string[]).includes(value ?? '') ? (value as Sentiment) : null;
}

function normalizeAspect(value: string | undefined): Aspect {
  return (ASPECTS as readonly string[]).includes(value ?? '') ? (value as Aspect) : 'other';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sb = getServiceClient();
  const runId = await startRun(sb, 'place_match');

  try {
    const { data: matchedRows, error: matchedError } = await sb
      .from('insight_place_mentions')
      .select('analysis_id');
    if (matchedError) throw matchedError;
    const matchedIds = new Set((matchedRows ?? []).map((r) => r.analysis_id as string));

    // 장소 언급이 있을 법한 카테고리만 대상으로 삼는다 (feature_request 등은 제외)
    const { data: rows, error: rowsError } = await sb
      .from('insight_analysis')
      .select('id, raw_item_id, insight_raw_items(title, content, url)')
      .in('category', ['praise', 'pain_point', 'useful_tip'])
      .order('analyzed_at', { ascending: false })
      .limit(CANDIDATE_POOL_SIZE);
    if (rowsError) throw rowsError;

    type JoinedRow = {
      id: string;
      raw_item_id: string;
      insight_raw_items: { title: string | null; content: string | null; url: string | null } | null;
    };

    const candidates: CandidateRow[] = ((rows ?? []) as unknown as JoinedRow[])
      .filter((row) => !matchedIds.has(row.id))
      .map((row) => ({
        analysis_id: row.id,
        raw_item_id: row.raw_item_id,
        /* I2 — 기존 원문의 미디코딩 HTML 엔티티가 장소명 추출 프롬프트를
         * 왜곡하지 않도록 여기서도 디코딩한다 */
        title: decodeHtmlEntities(row.insight_raw_items?.title ?? null),
        content: decodeHtmlEntities(row.insight_raw_items?.content ?? null),
        url: row.insight_raw_items?.url ?? null,
      }))
      .filter((row) => (row.title ?? '').length + (row.content ?? '').length >= 40)
      .slice(0, BATCH_TOTAL_LIMIT);

    const touchedKeys = new Set<string>();
    let mentionsAdded = 0;
    let itemsProcessed = 0;

    for (let i = 0; i < candidates.length; i += ITEMS_PER_CLAUDE_CALL) {
      const chunk = candidates.slice(i, i + ITEMS_PER_CLAUDE_CALL);
      const results = await extractBatch(chunk, apiKey);
      itemsProcessed += chunk.length;

      const rowsToInsert: Array<Record<string, unknown>> = [];
      const seen = new Set<string>();

      for (const result of results) {
        const source = chunk.find((c) => c.analysis_id === result.id);
        if (!source || !Array.isArray(result.places)) continue;

        for (const place of result.places.slice(0, MAX_PLACES_PER_ITEM)) {
          const name = place?.name?.trim();
          if (!name) continue;
          const key = placeKey(name);
          if (key.length < 2) continue;

          // unique(analysis_id, place_key) — 같은 배치 안 중복을 먼저 걸러야 upsert가 깨지지 않는다
          const dedupeKey = `${result.id}:${key}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          touchedKeys.add(key);

          rowsToInsert.push({
            analysis_id: result.id,
            raw_item_id: source.raw_item_id,
            place_key: key,
            place_name: name,
            sentiment: normalizeSentiment(place.sentiment),
            aspect: normalizeAspect(place.aspect),
            quote: place.quote?.trim()?.slice(0, 200) ?? null,
            source_url: source.url,
          });
        }
      }

      if (rowsToInsert.length === 0) continue;

      const { error: insertError } = await sb
        .from('insight_place_mentions')
        .upsert(rowsToInsert, { onConflict: 'analysis_id,place_key' });
      if (insertError) throw insertError;
      mentionsAdded += rowsToInsert.length;
    }

    if (touchedKeys.size > 0) {
      const { error: refreshError } = await sb.rpc('refresh_place_reactions', {
        keys: [...touchedKeys],
      });
      if (refreshError) throw refreshError;
    }

    await finishRun(sb, runId, { status: 'success', itemsCollected: mentionsAdded });

    return new Response(
      JSON.stringify({ itemsProcessed, mentionsAdded, placesTouched: touchedKeys.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-place-match failed', message);
    await finishRun(sb, runId, { status: 'error', errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
