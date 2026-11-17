/**
 * 카테고리별로 "예약할 만한 곳"에 예약 사이트 검색 버튼을 미리 보여주기 위한 매핑.
 *
 * bookingLinks.ts(사용자가 이미 예약한 링크를 인식)와 반대 방향 — 아직 예약 전인
 * 사용자에게 어디서 찾아보면 되는지 안내만 한다. 정확한 상품 딥링크가 아니라
 * 이름 기반 검색 결과로 보내므로, 실제로 그 장소가 맞는지는 사용자가 검색 결과에서
 * 직접 확인해야 한다.
 */

import type { SimpleCategory } from '../types';
import { normalizeLocale, type AppLocale } from './locale';

/*
 * 예약 사이트를 사용자 언어로 연다. 외국인이 한국어 페이지로 가지 않게 하려는 것이다(2026-11 해외 사용자 평가).
 * 언어 경로가 확실한 언어만 직접 넣고, 나머지는 영어 페이지로 보낸다 — Klook은 언어 경로가 없으면 404다.
 */
const KLOOK_PATH: Partial<Record<AppLocale, string>> = {
  ko: 'ko',
  ja: 'ja',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
};
const KKDAY_PATH: Partial<Record<AppLocale, string>> = {
  ko: 'ko',
  ja: 'ja',
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
};

export type BookingSearchProviderId =
  | 'naverMap'
  | 'agoda'
  | 'booking'
  | 'airbnb'
  | 'klook'
  | 'kkday';

export interface BookingSearchLink {
  id: BookingSearchProviderId;
  brand: string;
  href: string;
}

const PROVIDERS: Record<
  BookingSearchProviderId,
  { brand: string; buildUrl: (name: string, locale: AppLocale) => string }
> = {
  naverMap: {
    brand: '네이버지도',
    buildUrl: (name) => `https://map.naver.com/p/search/${encodeURIComponent(name)}`,
  },
  agoda: {
    brand: 'Agoda',
    buildUrl: (name) => `https://www.agoda.com/search?q=${encodeURIComponent(name)}`,
  },
  booking: {
    brand: 'Booking.com',
    buildUrl: (name) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(name)}`,
  },
  airbnb: {
    brand: 'Airbnb',
    buildUrl: (name, locale) =>
      `https://www.airbnb.${locale === 'ko' ? 'co.kr' : 'com'}/s/${encodeURIComponent(name)}/homes`,
  },
  klook: {
    brand: 'Klook',
    buildUrl: (name, locale) =>
      `https://www.klook.com/${KLOOK_PATH[locale] ?? 'en-US'}/search-result/?query=${encodeURIComponent(name)}`,
  },
  kkday: {
    brand: 'KKday',
    buildUrl: (name, locale) =>
      `https://www.kkday.com/${KKDAY_PATH[locale] ?? 'en'}/search?keyword=${encodeURIComponent(name)}`,
  },
};

/** 예약 검색 버튼을 보여줄 카테고리와, 카테고리별 제공처 우선순위 */
const PROVIDERS_BY_CATEGORY: Partial<Record<SimpleCategory, BookingSearchProviderId[]>> = {
  food: ['naverMap'],
  stay: ['agoda', 'booking', 'airbnb'],
  tour: ['klook', 'kkday'],
  culture: ['klook', 'kkday'],
};

export function getBookingSearchLinks(
  category: SimpleCategory | undefined,
  placeName: string | undefined,
  locale?: string,
): BookingSearchLink[] {
  if (!category || !placeName) return [];
  const ids = PROVIDERS_BY_CATEGORY[category];
  if (!ids) return [];
  return ids.map((id) => {
    const p = PROVIDERS[id];
    const lc = normalizeLocale(locale);
    // 브랜드명은 번역하지 않지만, 한글 표기 '네이버지도'는 외국인이 읽을 수 없어 영문 공식 표기로 바꾼다.
    const brand = id === 'naverMap' && lc !== 'ko' ? 'Naver Map' : p.brand;
    return { id, brand, href: p.buildUrl(placeName, lc) };
  });
}
