import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  lat: number;
  lng: number;
  placeName?: string;
  /** 카카오 로드뷰 vs 구글 스트리트뷰 — 현재 지도 provider에 맞춰 렌더링 */
  provider?: 'kakao' | 'google';
  onClose: () => void;
}

const GOOGLE_SEARCH_RADIUS_M = 80;

export function RoadviewModal({
  open,
  lat,
  lng,
  placeName,
  provider = 'kakao',
  onClose,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) {
      setUnavailable(false);
      setLoading(true);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setUnavailable(false);

    if (provider === 'google') {
      if (!window.google?.maps?.StreetViewPanorama) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      const service = new window.google.maps.StreetViewService();
      service.getPanorama(
        { location: { lat, lng }, radius: GOOGLE_SEARCH_RADIUS_M },
        (data: any, status: string) => {
          if (cancelled) return;
          setLoading(false);
          if (status !== 'OK' || !data?.location?.pano) {
            setUnavailable(true);
            return;
          }
          setUnavailable(false);
          new window.google.maps.StreetViewPanorama(container, {
            pano: data.location.pano,
            visible: true,
            addressControl: false,
            fullscreenControl: false,
          });
        }
      );
      return () => {
        cancelled = true;
      };
    }

    if (!window.kakao?.maps?.Roadview) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    const position = new window.kakao.maps.LatLng(lat, lng);
    const roadview = new window.kakao.maps.Roadview(container);
    const client = new window.kakao.maps.RoadviewClient();

    client.getNearestPanoId(position, 80, (panoId: number | null) => {
      if (cancelled) return;
      setLoading(false);
      if (panoId === null) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      roadview.setPanoId(panoId, position);
    });

    return () => {
      cancelled = true;
    };
  }, [open, lat, lng, provider]);

  if (!open) return null;

  const isGoogle = provider === 'google';
  const title = t(isGoogle ? 'roadviewModal.streetview' : 'roadviewModal.roadview');
  const externalUrl = isGoogle
    ? `https://www.google.com/maps?layer=c&cbll=${lat},${lng}`
    : `https://map.kakao.com/link/roadview/${lat},${lng}`;

  return (
    <div className="roadview-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="roadview-panel">
        <header className="roadview-header">
          <span className="roadview-title">
            <Icon name="roadview" /> {title}
            {placeName ? ` · ${placeName}` : ''}
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tc('close')}>
            <Icon name="close" />
          </button>
        </header>

        {loading && <p className="roadview-status">{t('roadviewModal.loading', { title })}</p>}

        {unavailable && !loading && (
          <div className="roadview-unavailable">
            <p>{t('roadviewModal.none', { title })}</p>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              {t(isGoogle ? 'roadviewModal.openGoogle' : 'roadviewModal.openKakao')}
            </a>
          </div>
        )}

        <div
          ref={containerRef}
          className={`roadview-canvas ${unavailable ? 'hidden' : ''}`}
        />
      </div>
    </div>
  );
}
