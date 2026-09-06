import type { Place } from '../types';
import type { PlacePanelTab } from './placePanelTabs';
import i18n from './i18n';
import { googleMapsLanguage, normalizeLocale } from './locale';
import {
  googlePlaceDetailCacheKey,
  readGooglePlaceDetailCache,
  writeGooglePlaceDetailCache,
} from './googlePlaceDetailCache';

export interface GoogleServiceOption {
  label: string;
  available: boolean;
}

export interface GooglePlaceReview {
  authorName: string;
  authorUri?: string;
  rating?: number;
  text?: string;
  relativeTime?: string;
  profilePhotoUrl?: string;
}

export interface GooglePlaceDetail {
  summary: {
    name?: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    openingNow?: boolean;
    openingText?: string;
    todayHours?: string;
    editorialSummary?: string;
    priceLevel?: number;
    priceLevelLabel?: string;
    categoryLabel?: string;
    businessStatusLabel?: string;
  };
  serviceOptions: GoogleServiceOption[];
  reviews: GooglePlaceReview[];
  photos: string[];
  photoAttributions?: string[];
  placeUrl?: string;
  googlePlaceId?: string;
  mapEmbedUrl?: string;
  apiSource?: 'new' | 'legacy';
}

function placesLanguage(): string {
  return googleMapsLanguage(normalizeLocale(i18n.language));
}

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return key ? String(key) : undefined;
}

export function buildGoogleMapEmbedUrl(googlePlaceId: string): string | null {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const lang = placesLanguage();
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=place_id:${encodeURIComponent(googlePlaceId)}&language=${encodeURIComponent(lang)}`;
}

function extractGooglePlaceId(placeId: string): string {
  return placeId.startsWith('g:') ? placeId.slice(2) : placeId;
}

function createPlacesService(): any {
  const container = document.createElement('div');
  return new window.google.maps.places.PlacesService(container);
}

function formatGooglePriceLevel(level: number | undefined): string | undefined {
  if (level == null || level < 0) return undefined;
  const labels = ['무료', '₩10,000 미만', '₩10,000–20,000', '₩20,000–30,000', '₩30,000+'];
  return labels[Math.min(level, labels.length - 1)];
}

function pushServiceOption(
  list: GoogleServiceOption[],
  label: string,
  value: boolean | null | undefined
): void {
  if (typeof value !== 'boolean') return;
  list.push({ label, available: value });
}

function readLocalizedText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'text' in value) {
    const text = (value as { text?: string }).text;
    return text ? String(text) : undefined;
  }
  return undefined;
}

function mapLegacyReviews(detail: Record<string, unknown>): GooglePlaceReview[] {
  return ((detail.reviews as Array<Record<string, unknown>>) ?? [])
    .slice(0, 5)
    .map((r) => ({
      authorName: String(r.author_name ?? 'Google 사용자'),
      authorUri: r.author_url ? String(r.author_url) : undefined,
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      text: r.text ? String(r.text) : undefined,
      relativeTime: r.relative_time_description
        ? String(r.relative_time_description)
        : undefined,
      profilePhotoUrl: r.profile_photo_url ? String(r.profile_photo_url) : undefined,
    }))
    .filter((r) => r.text || r.rating != null);
}

async function fetchGooglePlaceDetailLegacy(
  place: Place,
  googlePlaceId: string
): Promise<GooglePlaceDetail> {
  const service = createPlacesService();
  const detail = await new Promise<Record<string, unknown>>((resolve, reject) => {
    service.getDetails(
      {
        placeId: googlePlaceId,
        language: placesLanguage(),
        fields: [
          'name',
          'formatted_address',
          'international_phone_number',
          'website',
          'url',
          'rating',
          'user_ratings_total',
          'opening_hours',
          'photos',
          'editorial_summary',
          'types',
          'price_level',
          'business_status',
          'reviews',
          'dine_in',
          'takeout',
          'delivery',
          'curbside_pickup',
          'reservable',
          'serves_breakfast',
          'serves_lunch',
          'serves_dinner',
          'serves_beer',
          'serves_wine',
          'serves_vegetarian_food',
          'wheelchair_accessible_entrance',
        ],
      },
      (result: Record<string, unknown> | null, status: string) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && result) {
          resolve(result);
          return;
        }
        reject(new Error(`Google getDetails failed: ${status}`));
      }
    );
  });

  const photos = ((detail.photos as Array<{ getUrl?: (o: object) => string }>) ?? [])
    .map((p) => p?.getUrl?.({ maxWidth: 1400, maxHeight: 1400 }))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  const openingHours = detail.opening_hours as
    | { weekday_text?: string[]; isOpen?: () => boolean }
    | undefined;
  const weekdayText = openingHours?.weekday_text;
  const openingText = Array.isArray(weekdayText) ? weekdayText.join('\n') : undefined;

  const serviceOptions: GoogleServiceOption[] = [];
  pushServiceOption(serviceOptions, '매장 내 식사', detail.dine_in as boolean | undefined);
  pushServiceOption(serviceOptions, '테이크아웃', detail.takeout as boolean | undefined);
  pushServiceOption(serviceOptions, '배달', detail.delivery as boolean | undefined);
  pushServiceOption(serviceOptions, '매장 외 픽업', detail.curbside_pickup as boolean | undefined);
  pushServiceOption(serviceOptions, '예약', detail.reservable as boolean | undefined);

  const priceLevel =
    typeof detail.price_level === 'number' ? detail.price_level : undefined;

  return {
    apiSource: 'legacy',
    googlePlaceId,
    mapEmbedUrl: buildGoogleMapEmbedUrl(googlePlaceId) ?? undefined,
    summary: {
      name: String(detail.name ?? place.name),
      address: String(detail.formatted_address ?? place.roadAddress ?? place.address),
      phone: detail.international_phone_number
        ? String(detail.international_phone_number)
        : place.phone,
      website: detail.website ? String(detail.website) : undefined,
      rating: typeof detail.rating === 'number' ? detail.rating : place.rating,
      reviewCount:
        typeof detail.user_ratings_total === 'number'
          ? detail.user_ratings_total
          : place.reviewCount,
      openingNow:
        typeof openingHours?.isOpen === 'function'
          ? Boolean(openingHours.isOpen())
          : undefined,
      openingText,
      todayHours: Array.isArray(weekdayText) ? weekdayText[0] : undefined,
      editorialSummary: (detail.editorial_summary as { overview?: string } | undefined)
        ?.overview,
      priceLevel,
      priceLevelLabel: formatGooglePriceLevel(priceLevel),
    },
    serviceOptions,
    reviews: mapLegacyReviews(detail),
    photos,
    placeUrl: detail.url ? String(detail.url) : place.placeUrl,
  };
}

async function fetchGooglePlaceDetailNew(
  place: Place,
  googlePlaceId: string
): Promise<GooglePlaceDetail> {
  if (!window.google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary unavailable');
  }
  const { Place: PlaceCtor } = await window.google.maps.importLibrary('places');
  const p = new PlaceCtor({ id: googlePlaceId });

  await p.fetchFields({
    fields: [
      'displayName',
      'formattedAddress',
      'internationalPhoneNumber',
      'websiteURI',
      'googleMapsURI',
      'rating',
      'userRatingCount',
      'regularOpeningHours',
      'currentOpeningHours',
      'photos',
      'editorialSummary',
      'primaryTypeDisplayName',
      'priceLevel',
      'businessStatus',
      'reviews',
      'hasDineIn',
      'hasTakeout',
      'hasDelivery',
      'hasCurbsidePickup',
      'isReservable',
    ],
  });

  const serviceOptions: GoogleServiceOption[] = [];
  pushServiceOption(serviceOptions, '매장 내 식사', p.hasDineIn);
  pushServiceOption(serviceOptions, '테이크아웃', p.hasTakeout);
  pushServiceOption(serviceOptions, '배달', p.hasDelivery);
  pushServiceOption(serviceOptions, '매장 외 픽업', p.hasCurbsidePickup);
  pushServiceOption(serviceOptions, '예약', p.isReservable);

  const photos: string[] = [];
  for (const photo of (p.photos as Array<{ getURI?: (o: object) => string }>) ?? []) {
    const uri = photo?.getURI?.({ maxWidth: 1400, maxHeight: 1400 });
    if (typeof uri === 'string' && uri.length > 0) photos.push(uri);
  }

  const hours = p.currentOpeningHours ?? p.regularOpeningHours;
  const weekdayText = hours?.weekdayDescriptions as string[] | undefined;
  const openingText = Array.isArray(weekdayText) ? weekdayText.join('\n') : undefined;
  const openingNow =
    typeof hours?.openNow === 'boolean'
      ? hours.openNow
      : typeof hours?.isOpen === 'function'
        ? Boolean((hours.isOpen as () => boolean)())
        : undefined;

  const reviews: GooglePlaceReview[] = ((p.reviews as Array<Record<string, unknown>>) ?? [])
    .slice(0, 5)
    .map((r) => ({
      authorName: String(
        (r.authorAttribution as { displayName?: string } | undefined)?.displayName ??
          'Google 사용자'
      ),
      authorUri: (r.authorAttribution as { uri?: string } | undefined)?.uri
        ? String((r.authorAttribution as { uri?: string }).uri)
        : undefined,
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      text: readLocalizedText(r.text),
      relativeTime: r.relativePublishTimeDescription
        ? String(r.relativePublishTimeDescription)
        : undefined,
      profilePhotoUrl: (r.authorAttribution as { photoURI?: string } | undefined)?.photoURI
        ? String((r.authorAttribution as { photoURI?: string }).photoURI)
        : undefined,
    }))
    .filter((r) => r.text || r.rating != null);

  return {
    apiSource: 'new',
    googlePlaceId,
    mapEmbedUrl: buildGoogleMapEmbedUrl(googlePlaceId) ?? undefined,
    summary: {
      name: readLocalizedText(p.displayName) ?? place.name,
      address: p.formattedAddress ?? place.roadAddress ?? place.address,
      phone: p.internationalPhoneNumber ?? place.phone,
      website: p.websiteURI,
      rating: typeof p.rating === 'number' ? p.rating : place.rating,
      reviewCount:
        typeof p.userRatingCount === 'number' ? p.userRatingCount : place.reviewCount,
      openingNow,
      openingText,
      todayHours: Array.isArray(weekdayText) ? weekdayText[0] : undefined,
      editorialSummary: readLocalizedText(p.editorialSummary),
      categoryLabel: readLocalizedText(p.primaryTypeDisplayName) ?? place.categoryLabel,
      priceLevelLabel: formatGooglePriceLevel(
        typeof p.priceLevel === 'number' ? p.priceLevel : undefined
      ),
    },
    serviceOptions,
    reviews,
    photos,
    placeUrl: p.googleMapsURI ?? place.placeUrl,
  };
}

export async function fetchGooglePlaceDetail(place: Place): Promise<GooglePlaceDetail> {
  if (!window.google?.maps?.places) {
    throw new Error('Google Maps SDK not loaded');
  }

  const cacheKey = googlePlaceDetailCacheKey(place.id, placesLanguage());
  const cached = readGooglePlaceDetailCache(cacheKey);
  if (cached) return cached;

  const googlePlaceId = extractGooglePlaceId(place.id);
  let detail: GooglePlaceDetail;
  try {
    detail = await fetchGooglePlaceDetailNew(place, googlePlaceId);
  } catch (err) {
    console.warn('[Wayknit] Places API (New) unavailable, using legacy PlacesService', err);
    detail = await fetchGooglePlaceDetailLegacy(place, googlePlaceId);
  }

  writeGooglePlaceDetailCache(cacheKey, detail);
  return detail;
}

export function buildGooglePlaceTabs(detail: GooglePlaceDetail): PlacePanelTab[] {
  const tabs: PlacePanelTab[] = [
    { id: 'PHOTO', label: '사진' },
    { id: 'SUMMARY', label: '요약' },
  ];
  if (detail.reviews.length > 0 || (detail.summary.reviewCount ?? 0) > 0) {
    tabs.push({ id: 'REVIEW', label: '리뷰' });
  }
  if (detail.mapEmbedUrl) {
    tabs.push({ id: 'MAP', label: '지도' });
  }
  if (detail.serviceOptions.length > 0) {
    tabs.push({ id: 'INFO', label: '정보' });
  }
  return tabs;
}

export function buildGooglePlacePanel(
  detail: GooglePlaceDetail,
  placeUrl?: string
): Record<string, unknown> {
  return {
    provider: 'google',
    api_source: detail.apiSource ?? 'legacy',
    summary: detail.summary,
    serviceOptions: detail.serviceOptions,
    reviews: detail.reviews,
    photo_attributions: detail.photoAttributions ?? [],
    map_embed_url: detail.mapEmbedUrl,
    google_place_id: detail.googlePlaceId,
    place_url: placeUrl ?? detail.placeUrl,
  };
}

export function googlePlaceDetailModalPayload(
  detail: GooglePlaceDetail,
  placeUrl?: string
) {
  return {
    panel: buildGooglePlacePanel(detail, placeUrl),
    tabs: buildGooglePlaceTabs(detail),
    photos: detail.photos,
    placeUrl: placeUrl ?? detail.placeUrl,
  };
}
