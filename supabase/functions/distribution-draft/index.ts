import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/insightDb.ts';
import { requireAdminCaller } from '../_shared/adminAuth.ts';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_GUIDES = 5;

const PLATFORMS = ['x', 'reddit', 'youtube', 'tiktok', 'weibo', 'xiaohongshu'] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_SPEC: Record<Platform, string> = {
  x: '280자 이내, 캐주얼한 톤, 관련 해시태그 1~3개, 과도한 광고 문구 지양',
  reddit: '제목(title)은 커뮤니티 게시글 형식(자연스러운 질문/정보 공유 톤), 본문(body)은 300~600자, 노골적 광고 대신 유용한 정보 공유처럼 작성',
  youtube: '영상 설명란용 — 제목(title)은 SEO형, 본문(body)은 3~5문단, 타임스탬프/요약 형태',
  tiktok: '짧은 캡션(150자 이내), 트렌디한 톤, 해시태그 2~4개',
  weibo: '중국어(간체) 짧은 게시글, 150자 이내, 이모지 1~2개 허용',
  xiaohongshu: '중국어(간체) 라이프스타일 노트 톤, 제목은 후킹형, 본문은 200~400자, 태그(#) 포함',
};

function countryToLocale(country: string): string {
  const c = country.trim().toUpperCase();
  if (c === 'KR') return 'ko';
  if (c === 'JP') return 'ja';
  if (c === 'CN' || c === 'SG') return 'zh-CN';
  if (['TW', 'HK', 'MO'].includes(c)) return 'zh-TW';
  return 'en';
}

interface GuideRow {
  id: string;
  title: string;
  summary: string;
  bodyMd: string;
}

interface DraftItem {
  guideId: string;
  platform: Platform;
  country: string;
  title: string;
  body: string;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function parseDraftsJson(text: string): Array<Record<string, unknown>> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { posts?: unknown }).posts)
      ? (parsed as { posts: unknown[] }).posts
      : null;
  if (!list) throw new Error('claude response is not a posts array');
  return list.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object');
}

async function buildDrafts(
  guides: GuideRow[],
  targets: Array<{ platform: Platform; country: string }>,
  apiKey: string
): Promise<DraftItem[]> {
  const guideListing = guides
    .map(
      (g, i) =>
        `${i + 1}. guideId="${g.id}"\n제목: ${g.title}\n요약: ${g.summary}\n본문: ${truncate(g.bodyMd, 800)}`
    )
    .join('\n\n');

  const targetListing = targets
    .map((t) => `- platform="${t.platform}" country="${t.country}" (${countryToLocale(t.country)}) — 규칙: ${PLATFORM_SPEC[t.platform]}`)
    .join('\n');

  const prompt = `당신은 여로담(Wayknit, 한국여행 플래너 앱)의 소셜미디어 콘텐츠 에디터입니다.
아래 여행 가이드 콘텐츠를 소스로 삼아, 지정된 각 (플랫폼, 국가) 조합마다 게시글 초안을 하나씩 작성하세요.

규칙:
- 원문을 그대로 복사하지 말고 플랫폼 성격에 맞게 재작성
- 국가에 맞는 언어로 작성 (country와 매핑된 언어 표기 참고)
- 가장 관련성 높은 가이드 1개를 선택해 사용 (guideId를 결과에 포함)
- 노골적인 광고 문구·과장 금지, 실제 유용한 정보 제공 톤 유지
- reddit/youtube처럼 title이 필요한 플랫폼은 title을 채우고, 필요없는 플랫폼(x/tiktok/weibo/xiaohongshu)은 title을 빈 문자열로

소스 가이드:
${guideListing}

게시 대상 (플랫폼/국가):
${targetListing}

반드시 JSON만 응답:
{"posts":[{"guideId":"...","platform":"x","country":"US","title":"","body":"..."}]}`;

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
  const raw = parseDraftsJson(text);

  const guideIdSet = new Set(guides.map((g) => g.id));
  const out: DraftItem[] = [];
  for (const item of raw) {
    const platform = String(item.platform ?? '') as Platform;
    if (!PLATFORMS.includes(platform)) continue;
    const guideId = String(item.guideId ?? '');
    if (!guideIdSet.has(guideId)) continue;
    const country = String(item.country ?? '').trim().toUpperCase();
    if (!country) continue;
    out.push({
      guideId,
      platform,
      country,
      title: String(item.title ?? '').trim(),
      body: String(item.body ?? '').trim(),
    });
  }
  return out;
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
    await requireAdminCaller(req);
    const body = (await req.json().catch(() => ({}))) as {
      guideIds?: string[];
      platforms?: string[];
      countries?: string[];
    };

    const platforms = (body.platforms ?? []).filter((p): p is Platform =>
      (PLATFORMS as readonly string[]).includes(p)
    );
    const countries = (body.countries ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (platforms.length === 0 || countries.length === 0) {
      return new Response(JSON.stringify({ error: 'platforms와 countries를 1개 이상 지정하세요.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guideIds = Array.isArray(body.guideIds) ? body.guideIds.filter(Boolean) : [];
    let guideQuery = sb
      .from('guide_articles')
      .select('id, title, summary, body_md')
      .order('updated_at', { ascending: false })
      .limit(MAX_GUIDES);
    if (guideIds.length > 0) {
      guideQuery = sb
        .from('guide_articles')
        .select('id, title, summary, body_md')
        .in('id', guideIds)
        .limit(MAX_GUIDES);
    } else {
      guideQuery = guideQuery.eq('status', 'published');
    }
    const { data: guideRows, error: guideError } = await guideQuery;
    if (guideError) throw guideError;

    const guides: GuideRow[] = (guideRows ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as string) ?? '',
      summary: (row.summary as string) ?? '',
      bodyMd: (row.body_md as string) ?? '',
    }));

    if (guides.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, ids: [], message: '초안 생성에 사용할 가이드가 없습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targets = platforms.flatMap((platform) =>
      countries.map((country) => ({ platform, country }))
    );

    const drafts = await buildDrafts(guides, targets, apiKey);

    const ids: string[] = [];
    for (const draft of drafts) {
      const { data: inserted, error: insertError } = await sb
        .from('distribution_posts')
        .insert({
          platform: draft.platform,
          country: draft.country,
          locale: countryToLocale(draft.country),
          source_guide_id: draft.guideId,
          title: draft.title || null,
          body: draft.body,
          status: 'draft',
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
    console.error('distribution-draft failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
