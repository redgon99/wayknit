/**
 * 봇(소셜 미리보기·검색엔진·AI 크롤러)용 메타·본문 주입.
 *
 * 앱은 CSR SPA라 모든 경로가 동일한 index.html을 받는다. JS를 실행하지 않는 봇에게도
 * 내용이 보이도록, 봇 요청에 한해
 *  - data-seo 메타(제목·설명·이미지)를 실제 콘텐츠 값으로 교체하고
 *  - 대표 주소(canonical)·언어별 주소(hreflang)를 넣고
 *  - 가이드 상세·목록은 화면과 같은 본문 HTML과 구조화 데이터(JSON-LD)를 #root 안에 넣는다
 *    (React가 뜨면 이 HTML은 화면 렌더링으로 바뀐다).
 * 사람 요청은 그대로 통과시킨다.
 */

import {
  DEFAULT_LOCALE,
  GUIDE_SELECT,
  LOCALES,
  SITE_NAME,
  escapeHtml,
  guideArticleHtml,
  guideJsonLd,
  guideListHtml,
  guideListSelect,
  guideLocales,
  guidePhotos,
  guidesDescription,
  guidesLabel,
  isLocale,
  jsonLdScript,
  pathWithLocale,
  pickContent,
  siteOrigin,
  supabaseSelect,
  truncate,
  type GuideListItem,
  type GuideRecord,
  type Locale,
} from '../edge-lib/guides.ts';

const BOT_UA =
  /(facebookexternalhit|facebookcatalog|meta-externalagent|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Line\/|Pinterest|redditbot|Applebot|SkypeUriPreview|vkShare|embedly|Iframely|kakaotalk|kakaostory|Daum|Yeti|NaverBot|Googlebot|Google-InspectionTool|GoogleOther|bingbot|DuckDuckBot|YandexBot|Bytespider|Slurp|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Amazonbot|MistralAI-User|CCBot|cohere-ai)/i;

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

const DEFAULT_OG_IMAGE = '/og-default.png';

type PageMeta = {
  title?: string;
  description?: string;
  /** 절대 URL 또는 사이트 루트 기준 경로 */
  image?: string;
  type?: 'website' | 'article';
  /** 화면에 실제로 보이는 언어(번역이 없으면 대표 언어로 돌아감) */
  lang?: string;
  /** 로케일 프리픽스 없는 경로 — canonical·hreflang 계산용 */
  basePath?: string;
  /** hreflang으로 알릴 언어. 없으면 hreflang을 넣지 않는다 */
  alternates?: string[];
  /** #root 안에 넣을 봇용 본문 HTML */
  bodyHtml?: string;
  jsonLd?: unknown;
};

function localeFromPathname(pathname: string): Locale | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  if (seg === 'zh') return 'zh-CN';
  return isLocale(seg) ? seg : null;
}

function stripLocalePrefix(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return '/';
  if (seg !== 'zh' && !isLocale(seg)) return pathname;
  const rest = pathname.replace(`/${seg}`, '') || '/';
  return rest.startsWith('/') ? rest : `/${rest}`;
}

const escapeAttr = escapeHtml;

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

async function guideMeta(slug: string, locale: Locale, origin: string): Promise<PageMeta | null> {
  const rows = await supabaseSelect<GuideRecord>(
    `guide_articles?select=${GUIDE_SELECT}&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
  );
  const row = rows?.[0];
  if (!row?.title) return null;

  const content = pickContent(row, locale);
  const photo = guidePhotos(content.bodyMd)[0];
  return {
    title: `${content.title} · ${SITE_NAME}`,
    description: content.summary ? truncate(content.summary) : undefined,
    image: photo,
    type: 'article',
    lang: content.locale,
    basePath: `/guides/${encodeURIComponent(row.slug)}`,
    alternates: guideLocales(row),
    bodyHtml: guideArticleHtml(row, content, origin),
    jsonLd: guideJsonLd(row, content, origin),
  };
}

async function guideListMeta(locale: Locale, origin: string): Promise<PageMeta | null> {
  const rows = await supabaseSelect<GuideListItem>(guideListSelect(locale));
  if (!rows) return null;
  return {
    title: `${guidesLabel(locale)} · ${SITE_NAME}`,
    description: guidesDescription(locale),
    type: 'website',
    lang: locale,
    basePath: '/guides',
    alternates: [...LOCALES],
    bodyHtml: guideListHtml(rows, locale, origin),
  };
}

async function resolvePageMeta(basePath: string, locale: Locale, origin: string): Promise<PageMeta | null> {
  const tripMatch = basePath.match(/^\/trip\/([^/]+)\/?$/);
  if (tripMatch) return tripMeta(decodeURIComponent(tripMatch[1]), locale);

  const guideMatch = basePath.match(/^\/guides\/([^/]+)\/?$/);
  if (guideMatch) return guideMeta(decodeURIComponent(guideMatch[1]), locale, origin);

  if (/^\/guides\/?$/.test(basePath)) return guideListMeta(locale, origin);

  return null;
}

function buildMetaTags(meta: PageMeta, url: string, locale: string, image: string): string {
  const tags: string[] = [
    `<meta data-seo property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta data-seo property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta data-seo property="og:locale" content="${OG_LOCALE[locale as Locale] ?? OG_LOCALE[DEFAULT_LOCALE]}" />`,
    `<meta data-seo property="og:url" content="${escapeAttr(url)}" />`,
    `<meta data-seo property="og:image" content="${escapeAttr(image)}" />`,
    `<meta data-seo name="twitter:card" content="summary_large_image" />`,
    `<meta data-seo name="twitter:image" content="${escapeAttr(image)}" />`,
  ];
  // 기본 이미지만 크기를 알고 있다(가이드 사진은 크기가 제각각)
  if (image.endsWith(DEFAULT_OG_IMAGE)) {
    tags.push(`<meta data-seo property="og:image:width" content="1200" />`);
    tags.push(`<meta data-seo property="og:image:height" content="630" />`);
  }

  if (meta.title) {
    tags.push(`<meta data-seo property="og:title" content="${escapeAttr(meta.title)}" />`);
    tags.push(`<meta data-seo name="twitter:title" content="${escapeAttr(meta.title)}" />`);
  }
  if (meta.description) {
    tags.push(`<meta data-seo name="description" content="${escapeAttr(meta.description)}" />`);
    tags.push(
      `<meta data-seo property="og:description" content="${escapeAttr(meta.description)}" />`,
    );
    tags.push(
      `<meta data-seo name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    );
  }
  return tags.join('\n    ');
}

function hreflangTags(origin: string, basePath: string, locales: string[]): string {
  if (locales.length < 2) return '';
  const tags = locales.map(
    (loc) => `<link rel="alternate" hreflang="${loc}" href="${escapeAttr(`${origin}${pathWithLocale(basePath, loc)}`)}" />`,
  );
  const fallback = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
  tags.push(`<link rel="alternate" hreflang="x-default" href="${escapeAttr(`${origin}${pathWithLocale(basePath, fallback)}`)}" />`);
  return tags.join('\n    ');
}

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!BOT_UA.test(userAgent)) return;

  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const url = new URL(request.url);
  const origin = siteOrigin();
  const locale = localeFromPathname(url.pathname) ?? DEFAULT_LOCALE;
  const basePath = stripLocalePrefix(url.pathname);

  const dynamicMeta = await resolvePageMeta(basePath, locale, origin);
  const rawImage = dynamicMeta?.image ?? DEFAULT_OG_IMAGE;
  const image = /^https?:\/\//i.test(rawImage) ? rawImage : `${origin}${rawImage}`;
  // 번역이 없어 대표 언어로 보이는 주소(/es/guides/x 등)는 실제 언어 주소를 대표로 알려 중복을 막는다
  const lang = dynamicMeta?.lang ?? locale;
  const canonical = dynamicMeta?.basePath
    ? `${origin}${pathWithLocale(dynamicMeta.basePath, lang)}`
    : `${origin}${url.pathname}`;

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
  if (meta.description) html = html.replace(/\s*<meta name="description" [^>]*>/g, '');
  const head = [
    buildMetaTags(meta, canonical, lang, image),
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    dynamicMeta?.basePath && dynamicMeta.alternates
      ? hreflangTags(origin, dynamicMeta.basePath, dynamicMeta.alternates)
      : '',
    dynamicMeta?.jsonLd ? jsonLdScript(dynamicMeta.jsonLd) : '',
  ].filter(Boolean);
  html = html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);

  if (dynamicMeta?.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(dynamicMeta.title)}</title>`);
  }
  if (dynamicMeta?.lang) {
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${escapeAttr(dynamicMeta.lang)}"`);
  }
  if (dynamicMeta?.bodyHtml) {
    html = html.replace('<div id="root"></div>', `<div id="root">${dynamicMeta.bodyHtml}</div>`);
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Vary', 'User-Agent');

  return new Response(html, { status: response.status, headers });
};

export const config = {
  path: '/*',
  excludedPath: ['/assets/*', '/api/*', '/landing/*', '/*.png', '/*.svg', '/*.xml', '/*.txt', '/*.webmanifest', '/*.js', '/*.css'],
};
