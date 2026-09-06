/**
 * 소셜 크롤러용 OG 메타 주입.
 *
 * 앱은 CSR SPA라 모든 경로가 동일한 index.html을 받는다. 카카오톡·페이스북 등
 * 미리보기 봇은 JS를 실행하지 않으므로, 봇 요청에 한해 HTML 응답의 data-seo 메타를
 * 실제 콘텐츠 기반 값으로 교체한다. 사람 요청은 그대로 통과시킨다.
 */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BOT_UA =
  /(facebookexternalhit|facebookcatalog|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Line\/|Pinterest|redditbot|Applebot|SkypeUriPreview|vkShare|embedly|Iframely|kakaotalk|kakaostory|Daum|Yeti|NaverBot|Googlebot|Google-InspectionTool|bingbot|Bytespider|Slurp)/i;

const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'ko';

const OG_LOCALE: Record<Locale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  ja: 'ja_JP',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  ru: 'ru_RU',
};

const SITE_NAME = '여로담 · Wayknit';
const DEFAULT_OG_IMAGE = '/og-default.png';

type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
};

function localeFromPathname(pathname: string): Locale | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  if (seg === 'zh') return 'zh-CN';
  return (SUPPORTED_LOCALES as readonly string[]).includes(seg) ? (seg as Locale) : null;
}

function stripLocalePrefix(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return '/';
  if (seg !== 'zh' && !(SUPPORTED_LOCALES as readonly string[]).includes(seg)) return pathname;
  const rest = pathname.replace(`/${seg}`, '') || '/';
  return rest.startsWith('/') ? rest : `/${rest}`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = Netlify.env.get('VITE_SUPABASE_URL') ?? Netlify.env.get('SUPABASE_URL');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY') ?? Netlify.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

async function supabaseSelect<T>(path: string): Promise<T[] | null> {
  const config = supabaseConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

type TripRow = {
  title: string | null;
  total_days: number | null;
  payload: { pinnedByDay?: Record<string, unknown[]> } | null;
};

async function tripMeta(slug: string, locale: Locale): Promise<PageMeta | null> {
  const rows = await supabaseSelect<TripRow>(
    `wayknit_trips?select=title,total_days,payload&slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&limit=1`,
  );
  const row = rows?.[0];
  if (!row) return null;

  const pinned = row.payload?.pinnedByDay ?? {};
  const placeCount = Object.values(pinned).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  );
  const days = row.total_days ?? Object.keys(pinned).length ?? 1;
  const title = row.title?.trim() || tripFallbackTitle(locale);

  return {
    title: `${title} · ${SITE_NAME}`,
    description: tripDescription(locale, days, placeCount),
    type: 'article',
  };
}

function tripFallbackTitle(locale: Locale): string {
  switch (locale) {
    case 'en':
      return 'Shared trip';
    case 'ja':
      return '共有された旅程';
    case 'zh-CN':
      return '共享行程';
    case 'zh-TW':
      return '共享行程';
    case 'es':
      return 'Viaje compartido';
    case 'fr':
      return 'Voyage partagé';
    case 'de':
      return 'Geteilte Reise';
    case 'ru':
      return 'Общий маршрут';
    default:
      return '공유된 여행';
  }
}

function tripDescription(locale: Locale, days: number, places: number): string {
  switch (locale) {
    case 'en':
      return `${days}-day itinerary with ${places} places — travel times, stay durations and daily order included.`;
    case 'ja':
      return `${days}日間・${places}か所の旅程。移動時間と滞在時間、日ごとの順序まで含まれています。`;
    case 'zh-CN':
      return `${days}天 ${places} 个地点的行程，包含通行时间、停留时间与每日顺序。`;
    case 'zh-TW':
      return `${days}天 ${places} 個地點的行程，包含通行時間、停留時間與每日順序。`;
    case 'es':
      return `Itinerario de ${days} días con ${places} lugares: tiempos de viaje, duración de estancia y orden diario.`;
    case 'fr':
      return `Itinéraire de ${days} jours avec ${places} lieux : temps de trajet, durées de visite et ordre quotidien.`;
    case 'de':
      return `${days}-Tage-Reiseplan mit ${places} Orten – inklusive Fahrzeiten, Aufenthaltsdauer und Tagesreihenfolge.`;
    case 'ru':
      return `Маршрут на ${days} дн. с ${places} местами: время в пути, длительность посещения и порядок по дням.`;
    default:
      return `${days}일 ${places}곳 일정 — 이동시간·체류시간·일차별 순서까지 담긴 여행길입니다.`;
  }
}

type GuideRow = { title: string | null; summary: string | null; summary_en: string | null };

async function guideMeta(slug: string, locale: Locale): Promise<PageMeta | null> {
  const rows = await supabaseSelect<GuideRow>(
    `guide_articles?select=title,summary,summary_en&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
  );
  const row = rows?.[0];
  if (!row?.title) return null;

  const summary = locale === 'ko' ? row.summary : row.summary_en || row.summary;
  return {
    title: `${row.title} · ${SITE_NAME}`,
    description: summary ? truncate(summary) : undefined,
    type: 'article',
  };
}

async function resolvePageMeta(basePath: string, locale: Locale): Promise<PageMeta | null> {
  const tripMatch = basePath.match(/^\/trip\/([^/]+)\/?$/);
  if (tripMatch) return tripMeta(decodeURIComponent(tripMatch[1]), locale);

  const guideMatch = basePath.match(/^\/guides\/([^/]+)\/?$/);
  if (guideMatch) return guideMeta(decodeURIComponent(guideMatch[1]), locale);

  return null;
}

function buildMetaTags(meta: PageMeta, url: string, locale: Locale, image: string): string {
  const tags: string[] = [
    `<meta data-seo property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta data-seo property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta data-seo property="og:locale" content="${OG_LOCALE[locale]}" />`,
    `<meta data-seo property="og:url" content="${escapeAttr(url)}" />`,
    `<meta data-seo property="og:image" content="${escapeAttr(image)}" />`,
    `<meta data-seo property="og:image:width" content="1200" />`,
    `<meta data-seo property="og:image:height" content="630" />`,
    `<meta data-seo name="twitter:card" content="summary_large_image" />`,
    `<meta data-seo name="twitter:image" content="${escapeAttr(image)}" />`,
  ];

  if (meta.title) {
    tags.push(`<meta data-seo property="og:title" content="${escapeAttr(meta.title)}" />`);
    tags.push(`<meta data-seo name="twitter:title" content="${escapeAttr(meta.title)}" />`);
  }
  if (meta.description) {
    tags.push(
      `<meta data-seo property="og:description" content="${escapeAttr(meta.description)}" />`,
    );
    tags.push(
      `<meta data-seo name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    );
  }
  return tags.join('\n    ');
}

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!BOT_UA.test(userAgent)) return;

  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const url = new URL(request.url);
  const locale = localeFromPathname(url.pathname) ?? DEFAULT_LOCALE;
  const basePath = stripLocalePrefix(url.pathname);

  const dynamicMeta = await resolvePageMeta(basePath, locale);
  const image = `${url.origin}${dynamicMeta?.image ?? DEFAULT_OG_IMAGE}`;
  const canonical = `${url.origin}${url.pathname}`;

  let html = await response.text();

  // 기본 태그를 남겨두면 봇이 먼저 만난 값을 쓰는 경우가 있어 전부 걷어낸 뒤 다시 넣는다
  const staticTitle = html.match(/<meta data-seo property="og:title" content="([^"]*)"/)?.[1];
  const staticDescription = html.match(
    /<meta data-seo property="og:description" content="([^"]*)"/,
  )?.[1];

  const meta: PageMeta = {
    title: dynamicMeta?.title ?? staticTitle,
    description: dynamicMeta?.description ?? staticDescription,
    type: dynamicMeta?.type,
  };

  html = html.replace(/\s*<meta data-seo [^>]*>/g, '');
  html = html.replace(
    '</head>',
    `    ${buildMetaTags(meta, canonical, locale, image)}\n    <link rel="canonical" href="${escapeAttr(canonical)}" />\n  </head>`,
  );

  if (dynamicMeta?.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(dynamicMeta.title)}</title>`);
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Vary', 'User-Agent');

  return new Response(html, { status: response.status, headers });
};

export const config = {
  path: '/*',
  excludedPath: ['/assets/*', '/api/*', '/landing/*', '/*.png', '/*.svg', '/*.xml', '/*.txt', '/*.webmanifest', '/*.js', '/*.css'],
};
