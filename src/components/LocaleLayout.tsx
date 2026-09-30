import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { setAppLocale } from '../lib/i18n';
import { applyRobotsPolicy } from '../lib/seo';
import { trackEvent } from '../lib/analytics';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localeFromPathname,
  normalizeLocale,
  pathWithLocale,
  stripLocalePrefix,
  type AppLocale,
} from '../lib/locale';

const SITE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

export function LocaleLayout() {
  const { lang } = useParams<{ lang?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Legacy /zh/... → /zh-CN/...
    if (lang === 'zh') {
      const rest = stripLocalePrefix(location.pathname);
      navigate(`${pathWithLocale(rest, 'zh-CN')}${location.search}${location.hash}`, {
        replace: true,
      });
      return;
    }

    const fromPath = lang ? normalizeLocale(lang) : localeFromPathname(location.pathname);
    const fromQuery = new URLSearchParams(location.search).get('lang');
    const locale: AppLocale = fromQuery
      ? normalizeLocale(fromQuery)
      : fromPath ?? DEFAULT_LOCALE;
    setAppLocale(locale);
  }, [lang, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (lang === 'zh') return;
    const current = lang ? normalizeLocale(lang) : localeFromPathname(location.pathname);
    const locale = current ?? normalizeLocale(document.documentElement.lang);
    const basePath = stripLocalePrefix(location.pathname);
    const canonical = `${SITE_ORIGIN}${pathWithLocale(basePath, locale)}`;

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = canonical;

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    SUPPORTED_LOCALES.forEach((loc) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = loc;
      link.href = `${SITE_ORIGIN}${pathWithLocale(basePath, loc)}`;
      document.head.appendChild(link);
    });
    const xDefault = document.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.hreflang = 'x-default';
    xDefault.href = `${SITE_ORIGIN}${pathWithLocale(basePath, DEFAULT_LOCALE)}`;
    document.head.appendChild(xDefault);

    applyRobotsPolicy(location.pathname);
  }, [lang, location.pathname]);

  /* 접속 로그(§42) — 이동할 때마다 언어 접두사를 뗀 경로로 기록.
   * search/hash 변화로는 재발화하지 않도록 pathname만 의존성에 둔다. */
  useEffect(() => {
    if (lang === 'zh') return; // 레거시 리다이렉트 직전 — 위 이펙트가 곧 새 경로로 옮긴다
    const current = lang ? normalizeLocale(lang) : localeFromPathname(location.pathname);
    const locale = current ?? DEFAULT_LOCALE;
    trackEvent('page_view', { path: stripLocalePrefix(location.pathname), locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return <Outlet />;
}

/** locale prefix가 없는 경로를 현재 언어 경로로 이동 */
export function useLocaleNavigate() {
  const navigate = useNavigate();
  const { lang } = useParams<{ lang?: string }>();
  const current = lang ? normalizeLocale(lang) : DEFAULT_LOCALE;

  return (path: string, options?: { replace?: boolean }) => {
    navigate(pathWithLocale(path, current), options);
  };
}
