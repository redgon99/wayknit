/**
 * 동적 사이트맵: 요청할 때 DB에서 공개 가이드를 읽어 만든다(새로 발행한 글이 배포 없이 바로 들어간다).
 * - 정적 페이지는 9개 언어 주소 모두, 가이드는 실제로 번역이 있는 언어 주소만 알린다(번역 없는 주소는 중복 콘텐츠).
 * - DB 조회에 실패하면 빌드 때 만든 public/sitemap.xml(scripts/generate-sitemap.mjs)을 그대로 준다.
 */

import { DEFAULT_LOCALE, LOCALES, pathWithLocale, siteOrigin, supabaseSelect } from '../edge-lib/guides.ts';

/** 정적 공개 경로 — scripts/generate-sitemap.mjs와 같게 유지 (/admin, /login 제외) */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/plan', changefreq: 'weekly', priority: '0.9' },
  { path: '/plaza', changefreq: 'daily', priority: '0.8' },
  { path: '/guides', changefreq: 'daily', priority: '0.8' },
  { path: '/info', changefreq: 'monthly', priority: '0.6' },
  { path: '/setup', changefreq: 'monthly', priority: '0.6' },
  { path: '/themes', changefreq: 'monthly', priority: '0.5' },
  { path: '/help', changefreq: 'monthly', priority: '0.4' },
];

type Route = { path: string; changefreq?: string; priority?: string; lastmod?: string; locales: string[] };

const OTHER_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

type GuideSitemapRow = { slug: string; locale: string | null; published_at: string | null; updated_at: string | null } & Record<string, string | null>;

function guideSelect(): string {
  // 번역 본문 전체 대신 언어별 제목만 받아 번역 유무를 판단한다(응답을 작게)
  const cols = OTHER_LOCALES.map((l, i) => `t${i}:translations->"${l}"->>title`).join(',');
  return `guide_articles?select=slug,locale,published_at,updated_at,${cols}&status=eq.published&order=published_at.desc&limit=1000`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlEntries(origin: string, route: Route): string {
  const fallback = route.locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : route.locales[0];
  const alternates =
    route.locales.length > 1
      ? [
          ...route.locales.map(
            (alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${escapeXml(`${origin}${pathWithLocale(route.path, alt)}`)}" />`,
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}${pathWithLocale(route.path, fallback)}`)}" />`,
        ].join('\n')
      : null;
  return route.locales
    .map((locale) =>
      [
        '  <url>',
        `    <loc>${escapeXml(`${origin}${pathWithLocale(route.path, locale)}`)}</loc>`,
        route.lastmod ? `    <lastmod>${route.lastmod}</lastmod>` : null,
        route.changefreq ? `    <changefreq>${route.changefreq}</changefreq>` : null,
        route.priority ? `    <priority>${route.priority}</priority>` : null,
        alternates,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
}

export default async (_request: Request, context: { next: () => Promise<Response> }) => {
  const rows = await supabaseSelect<GuideSitemapRow>(guideSelect(), 4000);
  if (!rows) return context.next();

  const origin = siteOrigin();
  const guideRoutes: Route[] = rows
    .filter((r) => r?.slug)
    .map((r) => {
      const base = r.locale || DEFAULT_LOCALE;
      const locales = [base, ...OTHER_LOCALES.filter((l, i) => l !== base && r[`t${i}`])];
      return {
        path: `/guides/${encodeURIComponent(r.slug)}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: (r.updated_at ?? r.published_at ?? '').slice(0, 10) || undefined,
        locales,
      };
    });
  const routes: Route[] = [...STATIC_ROUTES.map((r) => ({ ...r, locales: [...LOCALES] as string[] })), ...guideRoutes];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    routes.map((r) => urlEntries(origin, r)).join('\n'),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

export const config = { path: '/sitemap.xml' };
