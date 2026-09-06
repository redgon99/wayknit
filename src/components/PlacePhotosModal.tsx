import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Place } from '../types';
import { buildKakaoPhotosUrl } from '../lib/kakaoPlaceUrls';
import { proxiedThumbnailUrl } from '../lib/kakaoPlaceApi';
import {
  fetchPlacePanelDetail,
  placePanelTabI18nKey,
  type PlacePanelTab,
  type PlacePanelTabId,
} from '../lib/placePanelTabs';
import { googlePlaceDetailModalPayload } from '../lib/googlePlaceDetail';
import { fetchGooglePlaceDetail } from '../lib/googleMaps';
import { fetchTourPlaceDetail } from '../lib/tourPlaceDetail';
import { getPlaceReaction } from '../lib/placeReactions';
import { readPanelHours, type PlaceHoursText } from '../lib/placeHours';
import { PlaceDetailTabPanel } from './PlaceDetailTabPanels';
import { PlaceReactionBadge } from './PlaceReactionBadge';
import { PlaceActionBar } from './PlaceActionBar';

interface Props {
  open: boolean;
  place: Place | null;
  onClose: () => void;
  onShowTaxiCard?: (place: Place) => void;
  /** 상세를 닫았다가 다시 목록에서 핀을 누르는 번거로움을 줄이기 위해 모달 안에서도 핀업한다 */
  pinned?: boolean;
  onTogglePin?: (place: Place) => void;
  /** 상세에서 읽어낸 영업시간 원문 — 핀에 저장해 일정 검증에 쓴다 */
  onHoursResolved?: (placeId: string, hours: PlaceHoursText) => void;
}

const DEFAULT_TABS: PlacePanelTab[] = [
  { id: 'PHOTO', label: 'PHOTO' },
  { id: 'SUMMARY', label: 'SUMMARY' },
];

export function PlacePhotosModal({
  open,
  place,
  onClose,
  onShowTaxiCard,
  onHoursResolved,
  pinned = false,
  onTogglePin,
}: Props) {
  const { t } = useTranslation('planner');
  const [tabs, setTabs] = useState<PlacePanelTab[]>(DEFAULT_TABS);
  const [activeTab, setActiveTab] = useState<PlacePanelTabId>('PHOTO');
  const [panel, setPanel] = useState<Record<string, unknown> | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isGooglePlace = Boolean(place?.id?.startsWith('g:'));
  const isTourPlace = Boolean(place?.id?.startsWith('tour:'));
  // 상세 로딩 effect가 콜백 변경으로 다시 돌지 않도록 ref로 붙든다
  const onHoursResolvedRef = useRef(onHoursResolved);
  onHoursResolvedRef.current = onHoursResolved;

  useEffect(() => {
    if (!open || !place) {
      setTabs(DEFAULT_TABS);
      setActiveTab('PHOTO');
      setPanel(null);
      setPhotos([]);
      setActiveIndex(0);
      setLoading(false);
      setPhotoError(false);
      setLoadError(false);
      setLightboxOpen(false);
      return;
    }

    const current = place;
    const fallback = current.thumbnailUrl
      ? [proxiedThumbnailUrl(current.thumbnailUrl) ?? current.thumbnailUrl]
      : [];

    setTabs(DEFAULT_TABS);
    setActiveTab('PHOTO');
    setPhotos(fallback);
    setActiveIndex(0);
    setPhotoError(false);
    setLoadError(false);
    setLoading(true);

    let cancelled = false;
    const load = isGooglePlace
      ? fetchGooglePlaceDetail(current).then((detail) =>
          googlePlaceDetailModalPayload(detail, current.placeUrl)
        )
      : isTourPlace
        ? fetchTourPlaceDetail(current.id).then((detail) => ({
            ...detail,
            placeUrl: current.placeUrl,
          }))
        : fetchPlacePanelDetail(current.id).then((detail) => ({
            ...detail,
            placeUrl: current.placeUrl,
          }));

    load
      .then(({ panel: p, tabs: nextTabs, photos: urls, placeUrl }) => {
        if (cancelled) return;
        const hasPanel = p != null && Object.keys(p).length > 0;
        setPanel(placeUrl ? { ...(p ?? {}), place_url: placeUrl } : p);
        setTabs(nextTabs.length > 0 ? nextTabs : DEFAULT_TABS);
        const hours = readPanelHours(p);
        if (hours) onHoursResolvedRef.current?.(current.id, hours);
        if (urls.length > 0) {
          setPhotos(urls);
          setActiveIndex(0);
        } else if (fallback.length === 0) {
          setPhotoError(true);
          if (!hasPanel) setLoadError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        if (fallback.length === 0) setPhotoError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, place?.id, isGooglePlace, isTourPlace]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) {
          setLightboxOpen(false);
        } else {
          onClose();
        }
        return;
      }
      if (activeTab !== 'PHOTO' || photos.length === 0) return;
      if (e.key === 'ArrowLeft') {
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'ArrowRight') {
        setActiveIndex((i) => Math.min(photos.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, lightboxOpen, photos.length, activeTab]);

  const openLightbox = () => {
    if (photos.length > 0 && photos[activeIndex]) setLightboxOpen(true);
  };

  if (!open || !place) return null;

  const placeExternalUrl = isGooglePlace
    ? (panel?.place_url as string | undefined) ??
      place.placeUrl ??
      `https://www.google.com/maps/place/?q=place_id:${place.id.replace(/^g:/, '')}`
    : isTourPlace
      ? (place.placeUrl ?? 'https://korean.visitkorea.or.kr/')
      : (place.photosUrl ?? buildKakaoPhotosUrl(place.id, place.placeUrl));
  const active = photos[activeIndex];
  const isPhotoTab = activeTab === 'PHOTO';

  return (
    <div
      className="photos-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={place.name}
      onClick={onClose}
    >
      <div className="photos-panel place-detail-panel" onClick={(e) => e.stopPropagation()}>
        <header className="photos-header place-detail-header">
          <span className="photos-title">{place.name}</span>
          <PlaceReactionBadge reaction={getPlaceReaction(place)} />
          {onTogglePin && (
            <button
              type="button"
              className={`place-detail-pin-btn ${pinned ? 'pinned' : ''}`}
              onClick={() => onTogglePin(place)}
              aria-label={pinned ? t('search.unpin') : t('search.pin')}
              title={pinned ? t('search.unpin') : t('search.pin')}
            >
              <Icon name={pinned ? 'check' : 'pinPlus'} size={20} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t('place.detail.close')}
          >
            <Icon name="close" />
          </button>
        </header>

        <nav className="place-detail-tabs" role="tablist" aria-label={t('place.detail.tabsAria')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`place-detail-tab ${activeTab === tab.id ? 'active' : ''}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(placePanelTabI18nKey(tab.id, panel), { defaultValue: tab.label })}
            </button>
          ))}
        </nav>

        <div
          className={`place-detail-body ${isPhotoTab ? 'place-detail-body-photos' : ''}`}
          role="tabpanel"
        >
          {loading && isPhotoTab && photos.length === 0 && (
            <p className="photos-status">{t('place.detail.loading')}</p>
          )}

          {isPhotoTab ? (
            <>
              {photoError && !loading && (
                <div className="photos-empty">
                  <p>
                    {loadError
                      ? t('place.detail.loadFailed')
                      : t('place.detail.noPhotos')}
                  </p>
                  <a href={placeExternalUrl} target="_blank" rel="noopener noreferrer">
                    {isGooglePlace
                      ? t('place.detail.openOnGoogle')
                      : isTourPlace
                        ? t('place.detail.openOnTour')
                        : t('place.detail.openOnKakao')}
                  </a>
                </div>
              )}
              {active && (
                <div className="photos-main">
                  <button
                    type="button"
                    className="photos-main-zoom"
                    onClick={openLightbox}
                    aria-label={t('place.detail.zoomAria', { name: place.name })}
                  >
                    <img
                      key={active}
                      src={active}
                      alt=""
                      className="photos-main-img"
                      referrerPolicy="no-referrer"
                    />
                    <span className="photos-zoom-hint" aria-hidden="true">
                      <Icon name="zoomIn" />
                      {t('place.detail.zoom')}
                    </span>
                  </button>
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="photos-nav photos-nav-prev"
                        disabled={activeIndex <= 0}
                        onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                        aria-label={t('place.detail.prevPhoto')}
                      >
                        <Icon name="chevronLeft" />
                      </button>
                      <button
                        type="button"
                        className="photos-nav photos-nav-next"
                        disabled={activeIndex >= photos.length - 1}
                        onClick={() =>
                          setActiveIndex((i) => Math.min(photos.length - 1, i + 1))
                        }
                        aria-label={t('place.detail.nextPhoto')}
                      >
                        <Icon name="chevronRight" />
                      </button>
                      <span className="photos-counter">
                        {activeIndex + 1} / {photos.length}
                      </span>
                    </>
                  )}
                </div>
              )}
              {photos.length > 1 && (
                <div className="photos-thumbs" role="list">
                  {photos.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      role="listitem"
                      className={`photos-thumb ${i === activeIndex ? 'active' : ''}`}
                      onClick={() => setActiveIndex(i)}
                      aria-label={t('place.detail.photoN', { n: i + 1 })}
                      aria-current={i === activeIndex}
                    >
                      <img src={url} alt="" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="place-detail-tab-scroll">
              {loading && !panel ? (
                <p className="photos-status">{t('place.detail.loading')}</p>
              ) : (
                <PlaceDetailTabPanel tabId={activeTab} panel={panel} place={place} />
              )}
            </div>
          )}
        </div>

        <PlaceActionBar
          place={place}
          onShowTaxiCard={onShowTaxiCard ? () => onShowTaxiCard(place) : undefined}
        />
        <footer className="photos-footer">
          <a href={placeExternalUrl} target="_blank" rel="noopener noreferrer">
            {isGooglePlace
              ? t('place.detail.moreOnGoogle')
              : t('place.detail.moreOnKakao')}
            <Icon name="externalLink" />
          </a>
        </footer>
      </div>

      {lightboxOpen && active && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t('place.detail.lightboxAria')}
          /* 라이트박스는 오버레이의 자식이라, 막지 않으면 여기서 닫는 클릭이
           * 오버레이까지 올라가 상세 패널도 같이 닫힌다. */
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(false);
          }}
        >
          <button
            type="button"
            className="photo-lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label={t('place.detail.close')}
          >
            <Icon name="close" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="photo-lightbox-nav photo-lightbox-nav-prev"
                disabled={activeIndex <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((i) => Math.max(0, i - 1));
                }}
                aria-label={t('place.detail.prevPhoto')}
              >
                <Icon name="chevronLeft" />
              </button>
              <button
                type="button"
                className="photo-lightbox-nav photo-lightbox-nav-next"
                disabled={activeIndex >= photos.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((i) => Math.min(photos.length - 1, i + 1));
                }}
                aria-label={t('place.detail.nextPhoto')}
              >
                <Icon name="chevronRight" />
              </button>
              <span className="photo-lightbox-counter">
                {activeIndex + 1} / {photos.length}
              </span>
            </>
          )}
          <img
            src={active}
            alt={t('place.detail.photoAlt', {
              name: place.name,
              n: activeIndex + 1,
            })}
            className="photo-lightbox-img"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
