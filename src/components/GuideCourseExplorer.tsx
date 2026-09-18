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

function pinTag(pin: GuideCoursePin): string {
  return pin.dayLabel || prettyCategory(pin.categoryLabel) || (pin.time ? pin.time : '코스');
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
export function GuideCourseExplorer({ pins, className }: Props) {
  const { t } = useTranslation('guides');
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
      const { getGoogleMapsApiKey, loadGoogleMapsSdk, resolvePlaceQueryWithGoogle } = await import(
        '../lib/googleMaps'
      );
      const { fetchGooglePlaceDetail } = await import('../lib/googlePlaceDetail');
      const key = getGoogleMapsApiKey();
      if (!key) return;
      await loadGoogleMapsSdk(key);
      for (const pin of pins) {
        if (cancelled) return;
        if ((pin.photoUrls?.length ?? 0) > 0) continue;
        if (hydrateTried.current.has(pin.order)) continue;
        hydrateTried.current.add(pin.order);
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
  }, [sig, pins]);

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
        <div ref={mapElRef} className="gce-map" role="img" aria-label="코스 지도" />
        <button
          type="button"
          className="gce-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '접기' : '펼치기'}
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
                    <span className="gce-card-tag">{pinTag(pin)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <aside className="gce-detail" aria-label={`${selected.name} 상세`}>
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
                <span className="gce-detail-chip">{selected.dayLabel}</span>
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
                  경로
                </a>
              )}
              {selected.phone && (
                <a className="gce-btn" href={`tel:${selected.phone.replace(/\s+/g, '')}`}>
                  전화
                </a>
              )}
            </div>

            <ul className="gce-detail-facts">
              {selected.openingText && (
                <li>
                  <span className="gce-fact-label">영업</span>
                  <span>{firstOpeningLine(selected.openingText)}</span>
                </li>
              )}
              {selected.address && (
                <li>
                  <span className="gce-fact-label">주소</span>
                      <span>{prettyAddress(selected.address)}</span>
                </li>
              )}
              {selected.phone && (
                <li>
                  <span className="gce-fact-label">전화</span>
                  <span>{selected.phone}</span>
                </li>
              )}
              {selected.time && (
                <li>
                  <span className="gce-fact-label">일정</span>
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
                <h4>방문객 평가</h4>
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
