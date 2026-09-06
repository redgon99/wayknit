import { DEFAULT_LOCALE, pathWithLocale, stripLocalePrefix, type AppLocale } from './locale';

const RAW_SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://wayknit.netlify.app';

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');
export const SITE_NAME = '여로담 · Wayknit';
export const DEFAULT_OG_IMAGE_PATH = '/landing/hero.png';

/** og:locale 용 BCP47 → OpenGraph underscore 표기 */
const OG_LOCALE: Record<AppLocale, string> = {
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

export function ogLocale(locale: AppLocale): string {
  return OG_LOCALE[locale] ?? OG_LOCALE[DEFAULT_LOCALE];
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export type SeoMeta = {
  title: string;
  description?: string;
  /** 절대 URL 또는 사이트 루트 기준 경로 */
  image?: string;
  type?: 'website' | 'article';
  /** locale prefix가 없는 경로. 미지정 시 현재 경로 사용 */
  path?: string;
};

/** robots.txt와 동일한 비색인 경로 — 로케일 프리픽스를 제거한 기준 */
const NOINDEX_PREFIXES = ['/admin', '/login'];

function upsertMeta(keyAttr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${keyAttr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(keyAttr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(keyAttr: 'name' | 'property', key: string): void {
  document.head.querySelectorAll(`meta[${keyAttr}="${key}"]`).forEach((el) => el.remove());
}

/**
 * 소셜 크롤러는 JS를 실행하지 않으므로 이 함수는 사람이 보는 탭 제목·앱 내 공유용이다.
 * 봇 대상 메타는 netlify/edge-functions/og-meta.ts 가 HTML 응답에 직접 주입한다.
 */
export function applySeoMeta(meta: SeoMeta, locale: AppLocale): void {
  const title = meta.title;
  const description = meta.description ?? '';
  const image = absoluteUrl(meta.image ?? DEFAULT_OG_IMAGE_PATH);
  const basePath = stripLocalePrefix(meta.path ?? window.location.pathname);
  const url = absoluteUrl(pathWithLocale(basePath, locale));

  document.title = title;
  if (description) upsertMeta('name', 'description', description);

  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:type', meta.type ?? 'website');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:locale', ogLocale(locale));
  if (description) upsertMeta('property', 'og:description', description);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:image', image);
  if (description) upsertMeta('name', 'twitter:description', description);

}

/** robots 메타의 소유자는 이 함수 하나뿐이다 (페이지별 메타와 경합하지 않도록) */
export function applyRobotsPolicy(pathname: string): void {
  const basePath = stripLocalePrefix(pathname);
  const blocked = NOINDEX_PREFIXES.some(
    (prefix) => basePath === prefix || basePath.startsWith(`${prefix}/`),
  );
  if (blocked) upsertMeta('name', 'robots', 'noindex, nofollow');
  else removeMeta('name', 'robots');
}
