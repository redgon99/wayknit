import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/insightDb.ts';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TIP_ITEMS = 40;
const CONTENT_MAX = 500;

interface TipRow {
  analysisId: string;
  summary: string | null;
  title: string | null;
  content: string | null;
  url: string | null;
}

interface DraftGuide {
  title: string;
  summary: string;
  bodyMd: string;
  kind: string;
  topicTags: string[];
  sourceAnalysisIds: string[];
  sourceUrls: string[];
}

const GUIDE_KINDS = [
  'course',
  'practical',
  'prepare',
  'food',
  'culture',
  'shopping',
  'safety',
] as const;

function normalizeKind(value: unknown): (typeof GUIDE_KINDS)[number] {
  const v = String(value ?? '').trim();
  return (GUIDE_KINDS as readonly string[]).includes(v)
    ? (v as (typeof GUIDE_KINDS)[number])
    : 'practical';
}

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base || 'guide'}-${suffix}`;
}

function parseDraftsJson(text: string): DraftGuide[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { guides?: unknown }).guides)
      ? (parsed as { guides: unknown[] }).guides
      : null;
  if (!list) throw new Error('claude response is not a guides array');

  const out: DraftGuide[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    const title = String(g.title ?? '').trim();
    if (!title) continue;
    out.push({
      title,
      summary: String(g.summary ?? '').trim(),
      bodyMd: String(g.bodyMd ?? g.body_md ?? '').trim(),
      kind: normalizeKind(g.kind),
      topicTags: Array.isArray(g.topicTags)
        ? g.topicTags.map(String)
        : Array.isArray(g.topic_tags)
          ? (g.topic_tags as unknown[]).map(String)
          : [],
      sourceAnalysisIds: Array.isArray(g.sourceAnalysisIds)
        ? g.sourceAnalysisIds.map(String)
        : Array.isArray(g.source_analysis_ids)
          ? (g.source_analysis_ids as unknown[]).map(String)
          : [],
      sourceUrls: Array.isArray(g.sourceUrls)
        ? g.sourceUrls.map(String).filter(Boolean)
        : Array.isArray(g.source_urls)
          ? (g.source_urls as unknown[]).map(String).filter(Boolean)
          : [],
    });
  }
  return out;
}

async function buildDrafts(tips: TipRow[], apiKey: string): Promise<DraftGuide[]> {
  const listing = tips
    .map(
      (t, i) =>
        `${i + 1}. analysisId="${t.analysisId}"\n요약: ${truncate(t.summary, 200)}\n제목: ${truncate(
          t.title,
          120
        )}\n내용: ${truncate(t.content, CONTENT_MAX)}\nurl: ${t.url ?? ''}`
    )
    .join('\n\n');

  const prompt = `당신은 한국 방문 여행자를 위한 실용 가이드 에디터입니다.
아래는 외부에서 수집·분류된 useful_tip(유용한 정보) 항목들입니다.
같은 주제끼리 묶어 **1~5개의 가이드 초안**을 만드세요.

규칙:
- 원문을 복사하지 말고 여로담(Wayknit) 톤으로 **재작성**
- 제목은 SEO형 한국어 (예: "한국여행시 교통카드 발급방법")
- summary: 2~3문장
- bodyMd: 마크다운, 단계(1. 2. 3.) 위주, 변동 가능 요금/정책 고지 한 줄 포함
- kind: 아래 7개 중 정확히 하나
  - course: 추천 여행코스·일정·동선 제안
  - practical: 교통·편의시설·공항 이동 등 실무 How-to
  - prepare: 입국·환전·짐·출발 전 체크리스트
  - food: 맛집·카페·식사 팁
  - culture: 문화·에티켓·축제
  - shopping: 쇼핑·면세·환급
  - safety: 안전·응급·분실
- topicTags: 보조 키워드 배열 (예: ["tmoney","metro"])
- sourceAnalysisIds: 이 가이드에 사용한 analysisId 배열
- sourceUrls: 참고할 원문 url (있으면)
- 정보가 부족하면 해당 주제는 만들지 말 것

항목:
${listing}

반드시 JSON만 응답: {"guides":[{"title":"...","summary":"...","bodyMd":"...","kind":"practical","topicTags":["transport"],"sourceAnalysisIds":["..."],"sourceUrls":["..."]}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
  return parseDraftsJson(text);
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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sb = getServiceClient();

  try {
    let body: { analysisIds?: string[] } = {};
    try {
      body = (await req.json()) as { analysisIds?: string[] };
    } catch {
      body = {};
    }
    const requestedIds = Array.isArray(body.analysisIds)
      ? [...new Set(body.analysisIds.map(String).filter(Boolean))].slice(0, MAX_TIP_ITEMS)
      : [];

    // 관리자가 선택한 분석 id가 있으면 해당 건만(카테고리를 useful_tip으로 맞춤). 없으면 기존 useful_tip 전체.
    if (requestedIds.length > 0) {
      const { error: markError } = await sb
        .from('insight_analysis')
        .update({ category: 'useful_tip' })
        .in('id', requestedIds);
      if (markError) throw markError;
    }

    let query = sb
      .from('insight_analysis')
      .select('id, summary, raw_item_id, insight_raw_items(title, content, url)')
      .order('analyzed_at', { ascending: false })
      .limit(MAX_TIP_ITEMS);

    if (requestedIds.length > 0) {
      query = query.in('id', requestedIds);
    } else {
      query = query.eq('category', 'useful_tip');
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const tips: TipRow[] = (rows ?? []).map((row) => {
      const raw = Array.isArray(row.insight_raw_items)
        ? row.insight_raw_items[0]
        : row.insight_raw_items;
      const r = (raw ?? {}) as { title?: string; content?: string; url?: string };
      return {
        analysisId: row.id as string,
        summary: (row.summary as string | null) ?? null,
        title: r.title ?? null,
        content: r.content ?? null,
        url: r.url ?? null,
      };
    });

    if (tips.length === 0) {
      return new Response(
        JSON.stringify({
          created: 0,
          ids: [],
          message:
            requestedIds.length > 0
              ? '선택한 분석 항목을 찾을 수 없습니다.'
              : 'useful_tip 분석 결과가 없습니다.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const drafts = await buildDrafts(tips, apiKey);
    const tipIdSet = new Set(tips.map((t) => t.analysisId));
    const tipUrlById = new Map(tips.map((t) => [t.analysisId, t.url]));

    const ids: string[] = [];
    for (const draft of drafts) {
      const analysisIds = draft.sourceAnalysisIds.filter((id) => tipIdSet.has(id));
      const urls = [
        ...new Set([
          ...draft.sourceUrls,
          ...analysisIds.map((id) => tipUrlById.get(id)).filter((u): u is string => Boolean(u)),
        ]),
      ];
      const { data: inserted, error: insertError } = await sb
        .from('guide_articles')
        .insert({
          slug: slugify(draft.title),
          title: draft.title,
          summary: draft.summary,
          body_md: draft.bodyMd,
          kind: draft.kind,
          topic_tags: draft.topicTags,
          status: 'draft',
          source_analysis_ids: analysisIds,
          source_urls: urls,
          locale: 'ko',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      if (inserted?.id) ids.push(inserted.id as string);
    }

    return new Response(JSON.stringify({ created: ids.length, ids }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-guide-draft failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
