import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  localeFromPathname,
  writeStoredLocale,
  localeToBcp47,
  type AppLocale,
} from './locale';

import koCommon from '../locales/ko/common.json';
import koPlanner from '../locales/ko/planner.json';
import koShare from '../locales/ko/share.json';
import koAuth from '../locales/ko/auth.json';
import koBilling from '../locales/ko/billing.json';
import koLanding from '../locales/ko/landing.json';
import koGuides from '../locales/ko/guides.json';
import koKorInfo from '../locales/ko/korInfo.json';

/**
 * 한국어 말고 8개 언어는 필요할 때 받는다(2026-11-22). 예전엔 9개 언어 × 8개 파일(약 590 KB)이 전부
 * 메인 번들에 들어 있어 방문자가 쓰지도 않는 언어까지 받았다. 한국어는 기본·대체(fallback) 언어라 그대로 둔다.
 * 빌드에서는 언어마다 한 조각(`locale-en` …)으로 묶인다(vite.config.ts manualChunks).
 * 모든 언어의 문구가 동시에 필요한 곳은 `virtual:locale-cross`를 쓴다(PlannerPage 새 여행 제목, importPins).
 */
const NAMESPACES = ['common', 'planner', 'share', 'auth', 'billing', 'landing', 'guides', 'korInfo'] as const;

const resources = {
  ko: {
    common: koCommon,
    planner: koPlanner,
    share: koShare,
    auth: koAuth,
    billing: koBilling,
    landing: koLanding,
    guides: koGuides,
    korInfo: koKorInfo,
  },
};

const localeLoaders = import.meta.glob<Record<string, unknown>>(
  ['../locales/*/*.json', '!../locales/ko/*.json'],
  { import: 'default' }
);

const loading = new Map<AppLocale, Promise<void>>();

/** 그 언어 번역을 받아 i18next에 넣는다. 한국어·이미 받은 언어는 바로 끝난다. */
export function ensureLocale(locale: AppLocale): Promise<void> {
  if (locale === DEFAULT_LOCALE || i18n.hasResourceBundle(locale, 'common')) return Promise.resolve();
  let p = loading.get(locale);
  if (!p) {
    p = Promise.all(
      NAMESPACES.map(async (ns) => {
        const load = localeLoaders[`../locales/${locale}/${ns}.json`];
        if (!load) return;
        i18n.addResourceBundle(locale, ns, await load(), true, true);
      })
    ).then(() => undefined);
    // 실패(오프라인 등)하면 다음에 다시 시도할 수 있게 기억을 지운다
    p.catch(() => loading.delete(locale));
    loading.set(locale, p);
  }
  return p;
}

/**
 * 첫 화면 언어 — LocaleLayout과 같은 규칙(?lang= → 주소 앞의 언어 → 한국어).
 * 예전엔 저장된 언어로 먼저 그렸다가 LocaleLayout이 곧바로 주소 언어로 바꿨다. 이제 처음부터 주소 언어로 그린다.
 */
function initialLocaleFromUrl(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  if (fromQuery) return normalizeLocale(fromQuery);
  return localeFromPathname(window.location.pathname) ?? DEFAULT_LOCALE;
}

const initialLocale = initialLocaleFromUrl();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'zh', 'es', 'fr', 'de', 'ru'],
  nonExplicitSupportedLngs: false,
  defaultNS: 'common',
  ns: [...NAMESPACES],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

function applyDocumentLang(locale: AppLocale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = localeToBcp47(locale);
  }
}

/** main.tsx가 첫 화면을 그리기 전에 기다린다 — 주소 언어 번역이 오기 전에 한국어로 잠깐 그려지지 않게 */
export const i18nReady: Promise<void> = ensureLocale(initialLocale).catch((err) => {
  console.warn('[i18n] 번역을 받지 못해 한국어로 보여 줍니다.', err);
});

let requestedLocale: AppLocale = initialLocale;

export function setAppLocale(locale: AppLocale): void {
  const normalized = normalizeLocale(locale);
  writeStoredLocale(normalized);
  requestedLocale = normalized;
  const apply = () => {
    // 받는 사이 다른 언어를 또 골랐으면 마지막 것만 적용
    if (requestedLocale === normalized && i18n.language !== normalized) void i18n.changeLanguage(normalized);
  };
  ensureLocale(normalized).then(apply, (err) => {
    console.warn('[i18n] 번역을 받지 못했습니다:', normalized, err);
    apply(); // 화면 언어 표시는 맞추고, 문구는 한국어로 대신 보인다
  });
  applyDocumentLang(normalized);
}

i18n.on('languageChanged', (lng) => {
  applyDocumentLang(normalizeLocale(lng));
});

if (typeof document !== 'undefined') {
  applyDocumentLang(initialLocale);
}

export default i18n;
