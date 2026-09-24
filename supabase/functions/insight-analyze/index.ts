import { corsHeaders } from '../_shared/cors.ts';
import { finishRun, getServiceClient, startRun } from '../_shared/insightDb.ts';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_TOTAL_LIMIT = 50;
const ITEMS_PER_CLAUDE_CALL = 10;
const CONTENT_MAX_CHARS = 800;

interface RawItemRow {
  id: string;
  source: string;
  title: string | null;
  content: string | null;
  url: string | null;
}

interface AnalysisResult {
  id: string;
  category:
    | 'pain_point'
    | 'feature_request'
    | 'praise'
    | 'competitor_mention'
    | 'useful_tip'
    | 'other';
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  mentionedServices: string[];
  audience?: string;
}

const AUDIENCE_VALUES = new Set(['foreign', 'domestic', 'unclear']);
/** 네이버(블로그·지식인)는 한국 플랫폼·한국어라 소스만 보고 100% 확정 가능 —
 * AI 판단보다 더 정확해서 응답과 무관하게 덮어쓴다(§35). */
const ALWAYS_DOMESTIC_SOURCES = new Set(['naver_blog', 'naver_kin']);

function normalizeAudience(source: string, value: string | undefined): string {
  if (ALWAYS_DOMESTIC_SOURCES.has(source)) return 'domestic';
  return value && AUDIENCE_VALUES.has(value) ? value : 'unclear';
}

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildPrompt(items: RawItemRow[]): string {
  const listing = items
    .map(
      (it, idx) =>
        `${idx + 1}. id="${it.id}" source=${it.source}\n제목: ${truncate(it.title, 120)}\n내용: ${truncate(
          it.content,
          CONTENT_MAX_CHARS
        )}`
    )
    .join('\n\n');

  return `당신은 한국여행 계획/경험 관련 게시글·댓글을 분석해 (1) 여행 플래너 서비스 개선 인사이트와 (2) 여행자에게 유용한 실무 정보를 분류하는 리서치 어시스턴트입니다.
아래 항목들을 각각 분류하세요.

- category:
  - pain_point: 불편함/문제 제기만 있고 해결 절차가 거의 없음
  - feature_request: 원하는 기능/바람
  - praise: 만족/칭찬
  - competitor_mention: 특정 지도·여행 앱/서비스 언급이 핵심일 때
  - useful_tip: 사용법·How-to·준비 체크리스트·교통/결제/통신/에티켓 등 **따라 할 수 있는 실무 정보**가 본문에 포함됨 (예: 교통카드 발급, eSIM 개통, T-money 충전)
  - other: 관련 없음/판단 불가
- sentiment: positive | neutral | negative
- summary: 한국어 1문장 요약 (useful_tip이면 핵심 팁을, 그 외에는 불편함/요청/의견을 요약)
- mentionedServices: 언급된 서비스/앱 이름 배열 (예: ["Naver Map", "Kakao Map", "T-money"]), 없으면 빈 배열
- audience: 이 글의 작성자·독자층
  - foreign: 외국인이 작성했거나 외국인 여행자를 대상/관점으로 쓴 콘텐츠
  - domestic: 한국인이 한국인 대상으로 쓴 국내용 콘텐츠
  - unclear: 언어·맥락만으로 판단하기 어려움

규칙: 불편만 호소하고 방법이 없으면 pain_point. 방법이 구체적으로 있으면 useful_tip을 우선.

항목:
${listing}

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트를 추가하지 마세요.
[{"id": "...", "category": "...", "sentiment": "...", "summary": "...", "mentionedServices": ["..."], "audience": "..."}]`;
}

function parseClaudeJson(text: string): AnalysisResult[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : text;
  const parsed = JSON.parse(jsonText.trim());
  if (!Array.isArray(parsed)) throw new Error('claude response is not an array');
  return parsed as AnalysisResult[];
}

async function classifyBatch(items: RawItemRow[], apiKey: string): Promise<AnalysisResult[]> {
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
  const runId = await startRun(sb, 'analyze');

  try {
    /*
     * 예전엔 "최신 300건(CANDIDATE_POOL_SIZE)을 가져와 그중 미분석만 고르기"였다.
     * 미분석 적체가 그 창을 넘어서면 밖으로 밀려난 오래된 항목은 버튼을 몇 번
     * 눌러도 **영영 분석되지 않는다** — 2026-09-23 진단 시 유튜브 613건 중 409건이
     * 미분석이라 약 280건이 실제로 그 상태로 갇혀 있었다.
     * 이제 "분석 행이 없는 것"만 DB에서 직접 골라 오므로 적체 크기와 무관하다.
     */
    const { data: candidates, error: candidatesError } = await sb
      .from('insight_raw_items')
      .select('id, source, title, content, url, insight_analysis!left(id)')
      .is('insight_analysis', null)
      .order('collected_at', { ascending: false })
      .limit(BATCH_TOTAL_LIMIT);
    if (candidatesError) throw candidatesError;

    const unanalyzed = (candidates ?? []) as unknown as RawItemRow[];

    let itemsAnalyzed = 0;
    for (let i = 0; i < unanalyzed.length; i += ITEMS_PER_CLAUDE_CALL) {
      const chunk = unanalyzed.slice(i, i + ITEMS_PER_CLAUDE_CALL);
      const results = await classifyBatch(chunk, apiKey);

      const rows = results
        .map((r) => ({ result: r, source: chunk.find((c) => c.id === r.id)?.source }))
        .filter((x): x is { result: AnalysisResult; source: string } => x.source !== undefined)
        .map(({ result: r, source }) => ({
          raw_item_id: r.id,
          category: r.category,
          sentiment: r.sentiment,
          summary: r.summary,
          mentioned_services: r.mentionedServices ?? [],
          model_used: CLAUDE_MODEL,
          audience: normalizeAudience(source, r.audience),
        }));
      if (rows.length === 0) continue;

      const { error: upsertError } = await sb
        .from('insight_analysis')
        .upsert(rows, { onConflict: 'raw_item_id' });
      if (upsertError) throw upsertError;
      itemsAnalyzed += rows.length;
    }

    await finishRun(sb, runId, { status: 'success', itemsCollected: itemsAnalyzed });

    return new Response(JSON.stringify({ itemsAnalyzed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-analyze failed', message);
    await finishRun(sb, runId, { status: 'error', errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
