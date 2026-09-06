import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://wayknit.netlify.app').replace(/\/+$/, '');

const DEFAULT_LOCALE = 'ko';
const LOCALES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'];

/** 정적 공개 경로 — /admin, /login 은 robots.txt와 동일하게 제외 */
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

function pathWithLocale(path, locale) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  if (clean === '/') return `/${locale}`;
  return `/${locale}${clean}`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 로케일별 URL 하나마다 전체 언어 alternate를 붙인다.
 * (구글은 각 URL이 자기 자신을 포함한 alternate 집합을 갖기를 요구한다)
 */
function urlEntries({ path, changefreq, priority, lastmod }) {
  return LOCALES.map((locale) => {
    const loc = `${SITE_URL}${pathWithLocale(path, locale)}`;
    const alternates = [
      ...LOCALES.map(
        (alt) =>
          `    <xhtml:link rel="alternate" hreflang="${alt}" href="${escapeXml(
            `${SITE_URL}${pathWithLocale(path, alt)}`,
          )}" />`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
        `${SITE_URL}${pathWithLocale(path, DEFAULT_LOCALE)}`,
      )}" />`,
    ].join('\n');

    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
      priority ? `    <priority>${priority}</priority>` : null,
      alternates,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n');
  }).join('\n');
}

/** 발행된 가이드 아티클 — Supabase env가 있을 때만 포함 (없으면 정적 경로만) */
async function fetchGuideRoutes() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/guide_articles?select=slug,published_at,updated_at&status=eq.published&order=published_at.desc&limit=1000`;
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] guide_articles 조회 실패 (${res.status}) — 정적 경로만 생성`);
      return [];
    }
    const rows = await res.json();
    return rows
      .filter((row) => row?.slug)
      .map((row) => ({
        path: `/guides/${row.slug}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: (row.updated_at ?? row.published_at ?? '').slice(0, 10) || undefined,
      }));
  } catch (err) {
    console.warn('[sitemap] guide_articles 조회 중 오류 — 정적 경로만 생성', err);
    return [];
  }
}

const guideRoutes = await fetchGuideRoutes();
const routes = [...STATIC_ROUTES, ...guideRoutes];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  routes.map(urlEntries).join('\n'),
  '</urlset>',
  '',
].join('\n');

const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sitemap.xml'), xml, 'utf8');

console.log(
  `wrote public/sitemap.xml (${routes.length} routes × ${LOCALES.length} locales = ${
    routes.length * LOCALES.length
  } urls)`,
);
