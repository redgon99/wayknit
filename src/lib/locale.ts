export type AppLocale = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'es' | 'fr' | 'de' | 'ru';

export const SUPPORTED_LOCALES: AppLocale[] = [
  'ko',
  'en',
  'ja',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
  'ru',
];

export const DEFAULT_LOCALE: AppLocale = 'ko';

export const LOCALE_STORAGE_KEY = 'wayknit:locale-v1';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
};

/** BCP 47 for Intl APIs / html lang */
export function localeToBcp47(locale: AppLocale): string {
  return locale;
}

/** Google Maps / Places API language code */
export function googleMapsLanguage(locale: AppLocale): string {
  return localeToBcp47(locale);
}

function isTraditionalChineseTag(lower: string): boolean {
  return (
    lower.includes('hant') ||
    lower.includes('-tw') ||
    lower.endsWith('tw') ||
    lower.includes('-hk') ||
    lower.endsWith('hk') ||
    lower.includes('-mo') ||
    lower.endsWith('mo')
  );
}

export function normalizeLocale(input?: string | null): AppLocale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase().trim();

  // Legacy single "zh" and Hans/Hant tags before base split
  if (lower === 'zh' || lower.startsWith('zh-') || lower.startsWith('zh_')) {
    return isTraditionalChineseTag(lower.replace(/_/g, '-')) ? 'zh-TW' : 'zh-CN';
  }

  const base = lower.split(/[-_]/)[0];
  if (base === 'ko' || lower.startsWith('ko')) return 'ko';
  if (base === 'en') return 'en';
  if (base === 'ja') return 'ja';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'de') return 'de';
  if (base === 'ru') return 'ru';
  return DEFAULT_LOCALE;
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const lang of langs) {
    const n = normalizeLocale(lang);
    if (SUPPORTED_LOCALES.includes(n)) return n;
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(): AppLocale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!raw) return null;
    // Legacy stored value "zh" → Simplified
    if (raw === 'zh') return 'zh-CN';
    if (SUPPORTED_LOCALES.includes(raw as AppLocale)) return raw as AppLocale;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function resolveInitialLocale(): AppLocale {
  return readStoredLocale() ?? detectBrowserLocale();
}

/** URL path prefix e.g. /en/plaza → en; /zh → zh-CN (legacy) */
export function localeFromPathname(pathname: string): AppLocale | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  if (seg === 'zh') return 'zh-CN';
  if (SUPPORTED_LOCALES.includes(seg as AppLocale)) return seg as AppLocale;
  return null;
}

export function stripLocalePrefix(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (!locale) return pathname || '/';
  const seg = pathname.split('/').filter(Boolean)[0];
  const rest = pathname.replace(new RegExp(`^/${seg}`), '') || '/';
  return rest.startsWith('/') ? rest : `/${rest}`;
}

export function pathWithLocale(path: string, locale: AppLocale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  if (clean === '/') return `/${locale}`;
  return `/${locale}${clean}`;
}
