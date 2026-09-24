import { corsHeaders } from '../_shared/cors.ts';
import { decodeHtmlEntities } from '../_shared/htmlEntities.ts';
import {
  finishRun,
  getServiceClient,
  listActiveKeywords,
  recordFailedRun,
  startRun,
  upsertRawItems,
  type RawItemInput,
} from '../_shared/insightDb.ts';
import {
  isWithinCollectionPeriod,
  parseCollectionPeriod,
  type CollectionPeriodInput,
} from '../_shared/insightPeriod.ts';

const MAX_RESULTS_PER_KEYWORD = 15;

interface NaverBlogItem {
  title?: string;
  link?: string;
  description?: string;
  bloggername?: string;
  postdate?: string;
}

interface NaverKinItem {
  title?: string;
  link?: string;
  description?: string;
}

function stripHtml(text: string | undefined | null): string | null {
  if (!text) return null;
  const withoutTags = text.replace(/<\/?[a-zA-Z0-9]+>/g, '');
  return decodeHtmlEntities(withoutTags)?.trim() || null;
}

function parseNaverDate(postdate: string | undefined): string | null {
  if (!postdate || postdate.length !== 8) return null;
  const y = postdate.slice(0, 4);
  const m = postdate.slice(4, 6);
  const d = postdate.slice(6, 8);
  const iso = `${y}-${m}-${d}T00:00:00Z`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

async function searchNaver(
  endpoint: 'blog' | 'kin',
  keyword: string,
  clientId: string,
  clientSecret: string
): Promise<Array<NaverBlogItem | NaverKinItem>> {
  const url = new URL(`https://openapi.naver.com/v1/search/${endpoint}.json`);
  url.searchParams.set('query', keyword);
  url.searchParams.set('display', String(MAX_RESULTS_PER_KEYWORD));
  url.searchParams.set('sort', 'date');
  const res = await fetch(url.toString(), {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });
  if (!res.ok) {
    console.error('naver search failed', endpoint, keyword, res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { items?: Array<NaverBlogItem | NaverKinItem> };
  return json.items ?? [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientId = Deno.env.get('NAVER_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) {
    const message = 'NAVER_CLIENT_ID/NAVER_CLIENT_SECRET not configured';
    await recordFailedRun(getServiceClient(), 'naver_blog', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: CollectionPeriodInput = {};
  try {
    if (req.method === 'POST') {
      body = ((await req.json()) as CollectionPeriodInput) ?? {};
    }
  } catch {
    body = {};
  }
  const period = parseCollectionPeriod(body);

  const sb = getServiceClient();
  const runId = await startRun(sb, 'naver_blog');

  try {
    const items = new Map<string, RawItemInput>();

    const blogKeywords = await listActiveKeywords(sb, ['naver_blog']);
    for (const { keyword } of blogKeywords) {
      const results = (await searchNaver('blog', keyword, clientId, clientSecret)) as NaverBlogItem[];
      for (const r of results) {
        if (!r.link) continue;
        const createdAt = parseNaverDate(r.postdate);
        if (!isWithinCollectionPeriod(createdAt, period)) continue;
        items.set(`naver_blog:${r.link}`, {
          source: 'naver_blog',
          externalId: r.link,
          title: stripHtml(r.title),
          content: stripHtml(r.description),
          author: r.bloggername ?? null,
          url: r.link,
          sourceCreatedAt: createdAt,
          rawPayload: { keyword, period: period.label },
        });
      }
    }

    const kinKeywords = await listActiveKeywords(sb, ['naver_kin']);
    for (const { keyword } of kinKeywords) {
      const results = (await searchNaver('kin', keyword, clientId, clientSecret)) as NaverKinItem[];
      for (const r of results) {
        if (!r.link) continue;
        // 지식인은 게시일이 API에 없어, 기간 필터 시에는 제외
        if (period.fromMs != null || period.toMs != null) continue;
        items.set(`naver_kin:${r.link}`, {
          source: 'naver_kin',
          externalId: r.link,
          title: stripHtml(r.title),
          content: stripHtml(r.description),
          author: null,
          url: r.link,
          sourceCreatedAt: null,
          rawPayload: { keyword, period: period.label },
        });
      }
    }

    const itemsCollected = await upsertRawItems(sb, [...items.values()]);
    await finishRun(sb, runId, { status: 'success', itemsCollected });

    return new Response(JSON.stringify({ itemsCollected, period: period.label }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-collect-naver failed', message);
    await finishRun(sb, runId, { status: 'error', errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
