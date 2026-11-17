import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSM_TILE_ATTRIBUTION, OSM_TILE_URL } from '../lib/osmTiles';
import type { GuideCoursePin } from '../types/guides';

type Props = {
  pins: GuideCoursePin[];
  className?: string;
};

/*
 * 구글 지도 JS의 PhotoService.GetPhoto 주소는 세션에 묶여 며칠 뒤 열리지 않는다
 * (2026-11-17 공개 코스 핀 사진 398개가 이 형식이라 기본 그림만 보였다). 화면에서 빼고,
 * 무료인 관광공사 TourAPI 사진으로 채운다.
 */
const EXPIRING_PHOTO = /maps\.googleapis\.com\/maps\/api\/place\/js\/PhotoService\.GetPhoto/;

function usablePhotos(urls: string[] | undefined): string[] {
  return (urls ?? []).filter((u) => !EXPIRING_PHOTO.test(u));
}

function normalizePlaceName(name: string): string {
  return name
    .replace(/<[^>]+>/g, '')
    .replace(/[①-⑳]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/(본점|본관)$/u, '')
    .replace(/[\s·・,.'"’“”\-–—_/]/g, '')
    .toLowerCase();
}

function sameName(a: string, b: string): boolean {
  const x = normalizePlaceName(a);
  const y = normalizePlaceName(b);
  if (x.length < 2 || y.length < 2) return false;
  return x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)));
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * TourAPI 키워드 검색으로 같은 이름의 관광지를 찾아 대표 사진을 쓴다. 이름이 같고 핀에서 3km 안일 때만
 * (동명 장소·엉뚱한 사진 방지). 좌표 주변 조회(locationBasedList)는 결과가 적어 바로 옆 명소도 빠졌다.
 */
const TOUR_PHOTO_CACHE_KEY = 'wayknit:guide-tour-photo-v1';
const TOUR_PHOTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TourPhotoCache = Record<string, { url: string | null; at: number }>;

function readTourPhotoCache(): TourPhotoCache {
  try {
    return JSON.parse(localStorage.getItem(TOUR_PHOTO_CACHE_KEY) ?? '{}') as TourPhotoCache;
  } catch {
    return {};
  }
}

/** 같은 방문자가 다시 볼 때 TourAPI(일일 호출 한도)를 또 부르지 않게 결과(못 찾음 포함)를 7일 보관 */
async function findTourPhoto(pin: GuideCoursePin): Promise<string | null> {
  const cacheKey = `${pin.name}|${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
  const cached = readTourPhotoCache()[cacheKey];
  // 못 찾은 결과는 일시 오류일 수 있어 하루만 기억한다
  const ttl = cached?.url ? TOUR_PHOTO_TTL_MS : 24 * 60 * 60 * 1000;
  if (cached && Date.now() - cached.at < ttl) return cached.url;
  const url = await lookupTourPhoto(pin);
  try {
    const cache = readTourPhotoCache();
    for (const [k, v] of Object.entries(cache)) if (Date.now() - v.at >= TOUR_PHOTO_TTL_MS) delete cache[k];
    cache[cacheKey] = { url, at: Date.now() };
    localStorage.setItem(TOUR_PHOTO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 실패는 무시 */
  }
  return url;
}

async function lookupTourPhoto(pin: GuideCoursePin): Promise<string | null> {
  const { searchTourPlaces } = await import('../lib/tourApi');
  const keyword = pin.name.replace(/[①-⑳]/g, '').replace(/\([^)]*\)/g, '').trim();
  if (keyword.length < 2) return null;
  const places = await searchTourPlaces(keyword);
  const names = [pin.name, pin.label].filter((n): n is string => !!n);
  const hit = places
    .filter((p) => p.thumbnailUrl && names.some((n) => sameName(n, p.name)))
    .map((p) => ({ p, d: distanceMeters(pin, p) }))
    .filter((x) => x.d <= 3000)
    .sort((x, y) => x.d - y.d)[0]?.p;
  if (!hit?.thumbnailUrl) return null;
  return hit.thumbnailUrl.replace(/^http:\/\//, 'https://');
}

function pinsSignature(pins: GuideCoursePin[]): string {
  return pins
    .map(
      (p) =>
        `${p.order}:${p.lat},${p.lng}:${p.rating ?? ''}:${p.photoUrls?.[0] ?? ''}`
    )
    .join('|');
}

function formatRating(rating: number | undefined): string | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return rating.toFixed(1);
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** 데이터의 "1일차"를 지금 언어로 바꾼다. 다른 형식이면 그대로 둔다. */
function dayText(t: Translate, dayLabel: string): string {
  const m = dayLabel.match(/^(\d+)\s*일차$/);
  return m ? t('courseMap.day', { n: Number(m[1]) }) : dayLabel;
}

function pinTag(t: Translate, pin: GuideCoursePin): string {
  if (pin.dayLabel) return dayText(t, pin.dayLabel);
  return prettyCategory(pin.categoryLabel) || (pin.time ? pin.time : t('courseMap.course'));
}

const GENERIC_CATEGORY = /^(establishment|point_of_interest|point of interest|premise|geocode|food)$/i;

function prettyCategory(label: string | undefined): string | null {
  const t = (label ?? '').trim();
  if (!t || GENERIC_CATEGORY.test(t)) return null;
  return t;
}

function prettyAddress(address: string): string {
  return address.replace(/^대한민국\s*/, '').trim();
}

function firstOpeningLine(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .find(Boolean) ?? text;
}

/** 추천 코스: OSM 지도 + 카드 캐러셀 + 사진 + 상세 패널 */
export function GuideCourseExplorer({ pins: rawPins, className }: Props) {
  const { t } = useTranslation('guides');
  const pins = useMemo(
    () => rawPins.map((p) => ({ ...p, photoUrls: usablePhotos(p.photoUrls) })),
    [rawPins]
  );
  /** 저장된 사진이 있었지만 전부 만료 주소였던 핀 — 구글 재조회(유료)는 하지 않고 TourAPI만 쓴다. */
  const expiredOrders = useMemo(
    () =>
      new Set(
        rawPins
          .filter((p) => (p.photoUrls?.length ?? 0) > 0 && usablePhotos(p.photoUrls).length === 0)
          .map((p) => p.order)
      ),
    [rawPins]
  );
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const [selectedOrder, setSelectedOrder] = useState<number | null>(
    pins[0]?.order ?? null
  );
  const [expanded, setExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const sig = pinsSignature(pins);

  const [hydrated, setHydrated] = useState<Record<number, GuideCoursePin>>({});
  const hydrateTried = useRef<Set<number>>(new Set());
  const selected = useMemo(() => {
    const base = pins.find((p) => p.order === selectedOrder) ?? pins[0] ?? null;
    if (!base) return null;
    return { ...base, ...hydrated[base.order] };
  }, [pins, selectedOrder, hydrated]);

  const displayPins = useMemo(
    () => pins.map((p) => ({ ...p, ...hydrated[p.order] })),
    [pins, hydrated]
  );

  const galleryPhotos = useMemo(
    () => selected?.photoUrls?.slice(0, 6) ?? [],
    [selected]
  );

  useEffect(() => {
    hydrateTried.current = new Set();
    setHydrated({});
  }, [sig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const googleMaps = await import('../lib/googleMaps');
      const { resolvePlaceQueryWithGoogle } = googleMaps;
      const { fetchGooglePlaceDetail } = await import('../lib/googlePlaceDetail');
      let googleReady: Promise<boolean> | null = null;
      const ensureGoogle = () => {
        googleReady ??= (async () => {
          const key = googleMaps.getGoogleMapsApiKey();
          if (!key) return false;
          await googleMaps.loadGoogleMapsSdk(key);
          return true;
        })();
        return googleReady;
      };
      for (const pin of pins) {
        if (cancelled) return;
        if ((pin.photoUrls?.length ?? 0) > 0) continue;
        if (hydrateTried.current.has(pin.order)) continue;
        hydrateTried.current.add(pin.order);
        // 1) 무료 TourAPI 사진부터
        try {
          const tourPhoto = await findTourPhoto(pin);
          if (cancelled) return;
          if (tourPhoto) {
            setHydrated((prev) => ({
              ...prev,
              [pin.order]: { ...pin, ...prev[pin.order], photoUrls: [tourPhoto] },
            }));
            continue;
          }
        } catch (e) {
          console.warn('[GuideCourseExplorer] tour photo failed', pin.name, e);
        }
        // 2) 구글 조회는 원래부터 사진이 없던 핀에만(만료 사진 핀까지 넓히면 열람마다 유료 호출이 늘어난다)
        if (expiredOrders.has(pin.order)) continue;
        if (!(await ensureGoogle())) continue;
        try {
          let placeId = pin.googlePlaceId;
          let label = pin.label || pin.name;
          if (!placeId) {
            const hit = await resolvePlaceQueryWithGoogle(pin.name, { lat: pin.lat, lng: pin.lng });
            placeId = hit?.placeId;
            if (hit?.label) label = hit.label;
          }
          if (!placeId) continue;
          const detail = await Promise.race([
            fetchGooglePlaceDetail({
              id: `g:${placeId}`,
              name: pin.name,
              category: 'other',
              categoryCode: 'OTHER',
              categoryLabel: pin.categoryLabel || '장소',
              address: pin.address || '',
              lat: pin.lat,
              lng: pin.lng,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('detail timeout')), 9000)
            ),
          ]);
          if (cancelled) return;
          setHydrated((prev) => ({
            ...prev,
            [pin.order]: {
              ...pin,
              ...prev[pin.order],
              googlePlaceId: placeId,
              label,
              photoUrls: detail.photos.slice(0, 6),
              rating: detail.summary.rating ?? pin.rating,
              reviewCount: detail.summary.reviewCount ?? pin.reviewCount,
              categoryLabel: detail.summary.categoryLabel ?? pin.categoryLabel,
              priceLevelLabel: detail.summary.priceLevelLabel ?? pin.priceLevelLabel,
              address: detail.summary.address ?? pin.address,
              phone: detail.summary.phone ?? pin.phone,
              openingText:
                detail.summary.todayHours ?? detail.summary.openingText ?? pin.openingText,
              editorialSummary: detail.summary.editorialSummary ?? pin.editorialSummary,
              reviewHighlights:
                detail.reviews
                  .map((r) => (r.text ?? '').replace(/\s+/g, ' ').trim())
                  .filter((t) => t.length >= 12)
                  .slice(0, 3)
                  .map((t) => (t.length > 90 ? `${t.slice(0, 88)}…` : t)) || pin.reviewHighlights,
            },
          }));
        } catch (e) {
          console.warn('[GuideCourseExplorer] photo hydrate failed', pin.name, e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sig, pins, expiredOrders]);

  useEffect(() => {
    setSelectedOrder(pins[0]?.order ?? null);
  }, [sig, pins]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [selectedOrder]);

  useEffect(() => {
    if (pins.length === 0 || !mapElRef.current) return;

    const map = L.map(mapElRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);
    const markers = new Map<number, L.Marker>();

    pins.forEach((pin) => {
      const rating = formatRating(pin.rating);
      const html = `
        <div class="gce-marker${pin.order === (selectedOrder ?? pins[0]?.order) ? ' is-active' : ''}">
          <span class="gce-marker-pill">${rating ? `★ ${rating}` : `#${pin.order}`}</span>
          <span class="gce-marker-name">${escapeHtml(pin.name)}</span>
        </div>
      `;
      const icon = L.divIcon({
        className: 'gce-marker-wrap',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 18],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      marker.on('click', () => setSelectedOrder(pin.order));
      markers.set(pin.order, marker);
      bounds.extend([pin.lat, pin.lng]);
    });

    markersRef.current = markers;

    if (pins.length >= 2 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18));
    } else if (pins[0]) {
      map.setView([pins[0].lat, pins[0].lng], 13);
    }

    const onResize = () => map.invalidateSize();
    requestAnimationFrame(onResize);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      markers.forEach((m) => m.remove());
      markersRef.current = new Map();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on pin content change
  }, [sig]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.panTo([selected.lat, selected.lng], { animate: true });

    markersRef.current.forEach((marker, order) => {
      const pin = pins.find((p) => p.order === order);
      if (!pin) return;
      const rating = formatRating(pin.rating);
      const active = order === selected.order;
      marker.setIcon(
        L.divIcon({
          className: 'gce-marker-wrap',
          html: `
            <div class="gce-marker${active ? ' is-active' : ''}">
              <span class="gce-marker-pill">${rating ? `★ ${rating}` : `#${pin.order}`}</span>
              <span class="gce-marker-name">${escapeHtml(pin.name)}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 18],
        })
      );
    });

    const card = document.querySelector(`.gce-card[data-order="${selected.order}"]`);
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected, pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [expanded, selectedOrder]);

  if (pins.length === 0) return null;

  const mapsUrl = selected
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        selected.address || `${selected.lat},${selected.lng}`
      )}${selected.googlePlaceId ? `&query_place_id=${encodeURIComponent(selected.googlePlaceId)}` : ''}`
    : null;

  const selectedPhotos =
    selected?.photoUrls?.length ? selected.photoUrls : galleryPhotos;
  const photoSafeIndex =
    selectedPhotos.length > 0
      ? Math.min(photoIndex, selectedPhotos.length - 1)
      : 0;
  const categoryChip = prettyCategory(selected?.categoryLabel);

  return (
    <div
      className={`guide-course-explorer${expanded ? ' is-expanded' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="gce-map-stage">
        <div ref={mapElRef} className="gce-map" role="img" aria-label={t('courseMap.mapLabel')} />
        <button
          type="button"
          className="gce-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('courseMap.collapse') : t('courseMap.expand')}
        </button>

        <div className="gce-cards" role="list">
          {displayPins.map((pin) => {
            const active = pin.order === selected?.order;
            const thumb = pin.photoUrls?.[0];
            const rating = formatRating(pin.rating);
            return (
              <button
                key={`${pin.order}-${pin.name}`}
                type="button"
                role="listitem"
                data-order={pin.order}
                className={`gce-card${active ? ' is-active' : ''}`}
                onClick={() => setSelectedOrder(pin.order)}
              >
                <div
                  className="gce-card-thumb"
                  style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                >
                  {!thumb && <span>{pin.order}</span>}
                </div>
                <div className="gce-card-body">
                  <strong className="gce-card-title">{pin.name}</strong>
                  <div className="gce-card-meta">
                    {rating && <span className="gce-card-rating">★ {rating}</span>}
                    <span className="gce-card-tag">{pinTag(t, pin)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <aside className="gce-detail" aria-label={t('courseMap.detailLabel', { name: selected.name })}>
          <div className="gce-detail-photos">
            {selectedPhotos.length > 0 ? (
              <>
                <div className="gce-detail-hero-wrap">
                  <img
                    className="gce-detail-hero"
                    src={selectedPhotos[photoSafeIndex]}
                    alt={selected.name}
                  />
                  {selectedPhotos.length > 1 && (
                    <span className="gce-detail-photo-count">
                      {photoSafeIndex + 1} / {selectedPhotos.length}
                    </span>
                  )}
                </div>
                {selectedPhotos.length > 1 && (
                  <div className="gce-detail-thumbs">
                    {selectedPhotos.slice(0, 6).map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        className={`gce-detail-thumb${photoIndex === i ? ' is-active' : ''}`}
                        onClick={() => setPhotoIndex(i)}
                      >
                        <img src={url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="gce-detail-hero-wrap">
                <div className="gce-detail-hero gce-detail-hero-empty">{selected.order}</div>
              </div>
            )}
          </div>

          <div className="gce-detail-body">
            <h3 className="gce-detail-title">{selected.name}</h3>
            <p className="gce-detail-sub">
              {formatRating(selected.rating) && (
                <span className="gce-detail-rating">★ {formatRating(selected.rating)}</span>
              )}
              {categoryChip && <span className="gce-detail-chip">{categoryChip}</span>}
              {selected.priceLevelLabel && (
                <span className="gce-detail-chip">{selected.priceLevelLabel}</span>
              )}
              {selected.dayLabel && (
                <span className="gce-detail-chip">{dayText(t, selected.dayLabel)}</span>
              )}
            </p>

            <div className="gce-detail-actions">
              {mapsUrl && (
                <a
                  className="gce-btn gce-btn-primary"
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('courseMap.directions')}
                </a>
              )}
              {selected.phone && (
                <a className="gce-btn" href={`tel:${selected.phone.replace(/\s+/g, '')}`}>
                  {t('courseMap.call')}
                </a>
              )}
            </div>

            <ul className="gce-detail-facts">
              {selected.openingText && (
                <li>
                  <span className="gce-fact-label">{t('courseMap.hours')}</span>
                  <span>{firstOpeningLine(selected.openingText)}</span>
                </li>
              )}
              {selected.address && (
                <li>
                  <span className="gce-fact-label">{t('courseMap.address')}</span>
                      <span>{prettyAddress(selected.address)}</span>
                </li>
              )}
              {selected.phone && (
                <li>
                  <span className="gce-fact-label">{t('courseMap.phone')}</span>
                  <span>{selected.phone}</span>
                </li>
              )}
              {selected.time && (
                <li>
                  <span className="gce-fact-label">{t('courseMap.schedule')}</span>
                  <span>
                    {selected.order}. {selected.time}
                  </span>
                </li>
              )}
            </ul>

            {selected.editorialSummary && (
              <p className="gce-detail-desc">{selected.editorialSummary}</p>
            )}

            {selected.reviewHighlights && selected.reviewHighlights.length > 0 && (
              <div className="gce-detail-reviews">
                <h4>{t('courseMap.reviews')}</h4>
                <ul>
                  {selected.reviewHighlights.map((line) => (
                    <li key={line.slice(0, 24)}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {(selected.googlePlaceId ||
              selected.rating != null ||
              (selected.photoUrls?.length ?? 0) > 0) && (
              <p className="gce-detail-credit">{t('detail.placeCredit')}</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
