import { corsHeaders } from '../_shared/cors.ts';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_PLACES = 20;
const MAX_SOURCE_CHARS = 12000;
const MAX_COMMENTS = 15;
const MAX_HTML_CHARS = 500_000;

type Platform = 'youtube' | 'web' | 'instagram' | 'tiktok' | 'unsupported';

interface PlaceItem {
  name: string;
  category: string;
}

interface ExtractResponse {
  platform: Platform;
  sourceKey: string;
  sourceUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  places: PlaceItem[];
  sourcesUsed: string[];
  extractable: boolean;
  message?: string | null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
        const id = parts[1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* ignore */
  }
  const m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

function detectPlatform(rawUrl: string): {
  platform: Platform;
  href: string;
  sourceKey: string;
  extractable: boolean;
  message?: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.includes('://') ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    throw new Error('유효한 URL이 아닙니다.');
  }
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error('http(s) URL만 지원합니다.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const href = url.toString();
  const ytId = parseVideoId(href);

  if (ytId || host === 'youtu.be' || host.endsWith('youtube.com')) {
    if (!ytId) {
      return {
        platform: 'unsupported',
        href,
        sourceKey: href,
        extractable: false,
        message: '유효한 YouTube 영상 링크가 아닙니다.',
      };
    }
    return {
      platform: 'youtube',
      href: `https://www.youtube.com/watch?v=${ytId}`,
      sourceKey: ytId,
      extractable: true,
    };
  }

  if (host === 'instagram.com' || host === 'instagr.am' || host.endsWith('.instagram.com')) {
    return {
      platform: 'instagram',
      href,
      sourceKey: href,
      extractable: false,
      message:
        '인스타그램은 URL만으로 자동 추출이 어렵습니다. 원문을 연 뒤 장소명을 복사해 검색하거나, 공개 웹·유튜브 링크를 이용해 주세요.',
    };
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com') {
    return {
      platform: 'tiktok',
      href,
      sourceKey: href,
      extractable: false,
      message:
        '틱톡은 URL만으로 자동 추출이 어렵습니다. 원문을 연 뒤 장소명을 복사해 검색하거나, 공개 웹·유튜브 링크를 이용해 주세요.',
    };
  }

  if (
    host === 'facebook.com' ||
    host.endsWith('.facebook.com') ||
    host === 'fb.watch' ||
    host === 'threads.net' ||
    host.endsWith('.threads.net') ||
    host === 'x.com' ||
    host === 'twitter.com'
  ) {
    return {
      platform: 'unsupported',
      href,
      sourceKey: href,
      extractable: false,
      message:
        '이 SNS는 자동 장소 추출을 지원하지 않습니다. 원문을 연 뒤 장소명을 검색창에 붙여 넣어 주세요.',
    };
  }

  return { platform: 'web', href, sourceKey: href, extractable: true };
}

function parsePlacesJson(text: string): PlaceItem[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { places?: unknown }).places)
      ? (parsed as { places: unknown[] }).places
      : null;
  if (!list) throw new Error('claude response is not a places array');

  const seen = new Set<string>();
  const out: PlaceItem[] = [];
  for (const item of list) {
    let name = '';
    let category = 'tour';
    if (typeof item === 'string') {
      name = item.trim();
    } else if (item && typeof item === 'object' && 'name' in item) {
      name = String((item as { name: unknown }).name).trim();
      const cat = (item as { category?: unknown }).category;
      if (typeof cat === 'string' && cat.trim()) category = cat.trim();
    }
    if (name.length < 2 || name.length > 80) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category });
    if (out.length >= MAX_PLACES) break;
  }
  return out;
}

async function extractPlacesWithClaude(
  sourceText: string,
  pageTitle: string,
  apiKey: string,
  kind: 'youtube' | 'web'
): Promise<PlaceItem[]> {
  const sourceLabel =
    kind === 'youtube'
      ? '유튜브 영상 텍스트(제목·설명·자막·댓글 일부)'
      : '웹 페이지 텍스트(제목·본문·메타)';
  const prompt = `당신은 여행 콘텐츠에서 실제 방문·추천 장소명을 추출하는 어시스턴트입니다.
아래 ${sourceLabel}에서 **구체적인 장소명**과 **카테고리**를 뽑으세요.

category 허용값 (반드시 하나):
- food: 식당·맛집
- cafe: 카페·베이커리
- tour: 관광지·자연·명소·타워·섬·공원·해변
- stay: 호텔·숙소·게스트하우스
- culture: 박물관·미술관·궁·사찰·문화재
- shop: 마트·시장·쇼핑몰·백화점
- other: 위에 해당 없음

규칙:
- 상호·관광지·고유 장소명만. "한국", "제주", "서울" 같은 광역 지명은 제외(단 특정 명소는 포함)
- 스폰서 앱/일반 명사/인물명/해시태그 단독 제외
- 실제로 언급된 것만. 추측하지 말 것
- 최대 ${MAX_PLACES}개
- 애매하면 tour

제목: ${pageTitle || '(없음)'}

텍스트:
${sourceText}

반드시 JSON만 응답하세요. 형식: {"places":[{"name":"장소1","category":"tour"}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
  return parsePlacesJson(text);
}

function heuristicPlaces(description: string, title: string): PlaceItem[] {
  const lines = `${title}\n${description}`
    .split(/[\n,|•·]+/)
    .map((s) => s.replace(/^[\s\-*\d.)📍]+/, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
    .filter((s) => !/^https?:\/\//i.test(s));
  const seen = new Set<string>();
  const out: PlaceItem[] = [];
  for (const item of lines) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: item, category: 'tour' });
    if (out.length >= MAX_PLACES) break;
  }
  return out;
}

async function fetchVideoMeta(videoId: string, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`youtube videos.list failed: ${res.status}`);
  const json = (await res.json()) as {
    items?: Array<{ snippet?: { title?: string; description?: string; tags?: string[] } }>;
  };
  const snippet = json.items?.[0]?.snippet;
  if (!snippet) return null;
  return {
    title: snippet.title ?? '',
    description: snippet.description ?? '',
    tags: snippet.tags ?? [],
  };
}

async function fetchTopComments(videoId: string, apiKey: string): Promise<string[]> {
  const url = new URL(`${YOUTUBE_API_BASE}/commentThreads`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('maxResults', String(MAX_COMMENTS));
  url.searchParams.set('textFormat', 'plainText');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: Array<{ snippet?: { topLevelComment?: { snippet?: { textDisplay?: string } } } }>;
  };
  return (json.items ?? [])
    .map((it) => it.snippet?.topLevelComment?.snippet?.textDisplay?.trim() ?? '')
    .filter(Boolean);
}

async function fetchCaptionsText(videoId: string): Promise<string | null> {
  try {
    const listRes = await fetch(
      `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`,
      { headers: { 'Accept-Language': 'ko,en;q=0.8' } }
    );
    if (!listRes.ok) return null;
    const listXml = await listRes.text();
    const tracks = [...listXml.matchAll(/<track\b[^>]*>/gi)].map((m) => m[0]);
    if (tracks.length === 0) return null;
    const pick =
      tracks.find((t) => /\blang_code="ko"/i.test(t)) ??
      tracks.find((t) => /\blang_code="en"/i.test(t)) ??
      tracks[0];
    const lang = pick.match(/\blang_code="([^"]+)"/i)?.[1];
    const name = pick.match(/\bname="([^"]*)"/i)?.[1] ?? '';
    if (!lang) return null;
    const capUrl = new URL('https://www.youtube.com/api/timedtext');
    capUrl.searchParams.set('v', videoId);
    capUrl.searchParams.set('lang', lang);
    if (name) capUrl.searchParams.set('name', name);
    capUrl.searchParams.set('fmt', 'srv3');
    const capRes = await fetch(capUrl.toString());
    if (!capRes.ok) return null;
    const xml = await capRes.text();
    const texts = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
      .map((m) =>
        m[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]+>/g, '')
          .trim()
      )
      .filter(Boolean);
    return texts.length ? truncate(texts.join(' '), 8000) : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const propRe = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const propRe2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      'i'
    );
    const m = html.match(propRe) ?? html.match(propRe2);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function extractWebContent(html: string): {
  title: string;
  description: string;
  imageUrl: string | null;
  bodyText: string;
} {
  const clipped = html.slice(0, MAX_HTML_CHARS);
  const titleTag = clipped.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const title =
    metaContent(clipped, ['og:title', 'twitter:title']) ??
    decodeHtmlEntities(titleTag.replace(/\s+/g, ' ').trim());
  const description =
    metaContent(clipped, ['og:description', 'twitter:description', 'description']) ?? '';
  const imageUrl = metaContent(clipped, ['og:image', 'twitter:image']);

  let body = clipped
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const article = body.match(/<article[\s\S]*?<\/article>/i)?.[0];
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0];
  body = article ?? main ?? body;
  const bodyText = decodeHtmlEntities(
    body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );

  return {
    title,
    description,
    imageUrl,
    bodyText: truncate(bodyText, 10000),
  };
}

async function extractYoutube(
  videoId: string,
  youtubeKey: string,
  anthropicKey: string | undefined
): Promise<ExtractResponse> {
  const meta = await fetchVideoMeta(videoId, youtubeKey);
  if (!meta) throw new Error('영상을 찾을 수 없습니다.');

  const sourcesUsed = ['title', 'description'];
  const parts = [`제목: ${meta.title}`, `설명:\n${meta.description}`];
  if (meta.tags.length) {
    parts.push(`태그: ${meta.tags.join(', ')}`);
    sourcesUsed.push('tags');
  }
  const [captions, comments] = await Promise.all([
    fetchCaptionsText(videoId),
    fetchTopComments(videoId, youtubeKey),
  ]);
  if (captions) {
    parts.push(`자막:\n${captions}`);
    sourcesUsed.push('captions');
  }
  if (comments.length) {
    parts.push(`댓글:\n${comments.map((c) => `- ${c}`).join('\n')}`);
    sourcesUsed.push('comments');
  }

  const sourceText = truncate(parts.join('\n\n'), MAX_SOURCE_CHARS);
  let places: PlaceItem[];
  if (anthropicKey) {
    places = await extractPlacesWithClaude(sourceText, meta.title, anthropicKey, 'youtube');
  } else {
    places = heuristicPlaces(meta.description, meta.title);
    sourcesUsed.push('heuristic');
  }

  return {
    platform: 'youtube',
    sourceKey: videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: meta.title || null,
    description: truncate(meta.description, 280) || null,
    imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    places,
    sourcesUsed,
    extractable: true,
  };
}

async function extractWeb(
  href: string,
  anthropicKey: string | undefined
): Promise<ExtractResponse> {
  const res = await fetch(href, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; WayknitBot/1.0; +https://wayknit.app; place-extract)',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko,en;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`페이지를 가져오지 못했습니다. (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(contentType) && contentType) {
    throw new Error('HTML 웹 페이지만 추출할 수 있습니다.');
  }
  const html = await res.text();
  const web = extractWebContent(html);
  const sourcesUsed = ['og', 'body'];
  const sourceText = truncate(
    `제목: ${web.title}\n설명: ${web.description}\n본문:\n${web.bodyText}`,
    MAX_SOURCE_CHARS
  );

  let places: PlaceItem[];
  if (anthropicKey) {
    places = await extractPlacesWithClaude(sourceText, web.title, anthropicKey, 'web');
  } else {
    places = heuristicPlaces(`${web.description}\n${web.bodyText}`, web.title);
    sourcesUsed.push('heuristic');
  }

  return {
    platform: 'web',
    sourceKey: href,
    sourceUrl: href,
    title: web.title || null,
    description: web.description || null,
    imageUrl: web.imageUrl,
    places,
    sourcesUsed,
    extractable: true,
  };
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

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const detected = detectPlatform(body.url ?? '');
    if (!detected.extractable) {
      const payload: ExtractResponse = {
        platform: detected.platform,
        sourceKey: detected.sourceKey,
        sourceUrl: detected.href,
        title: null,
        description: null,
        imageUrl: null,
        places: [],
        sourcesUsed: [],
        extractable: false,
        message: detected.message ?? null,
      };
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();

    if (detected.platform === 'youtube') {
      const youtubeKey = Deno.env.get('YOUTUBE_API_KEY')?.trim();
      if (!youtubeKey) {
        return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY not configured' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const payload = await extractYoutube(detected.sourceKey, youtubeKey, anthropicKey);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await extractWeb(detected.href, anthropicKey);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('link-places-extract failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
