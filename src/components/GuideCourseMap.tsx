import { useEffect, useRef, useState } from 'react';
import { loadKakaoSdk } from '../lib/kakao';
import type { GuideCoursePin } from '../types/guides';

type Props = {
  pins: GuideCoursePin[];
  className?: string;
};

/** 추천 코스 가이드용 읽기 전용 핀 지도 (카카오) */
export function GuideCourseMap({ pins, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!key) {
      setError('지도 키가 설정되지 않았습니다.');
      return;
    }
    let cancelled = false;
    loadKakaoSdk(key)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('지도를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || pins.length === 0) return;
    if (!window.kakao?.maps) return;

    const center = {
      lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length,
      lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length,
    };
    const map = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      level: 7,
    });

    const bounds = new window.kakao.maps.LatLngBounds();
    const overlays: { setMap: (m: null) => void }[] = [];

    pins.forEach((pin) => {
      const position = new window.kakao.maps.LatLng(pin.lat, pin.lng);
      bounds.extend(position);

      const el = document.createElement('div');
      el.className = 'guide-course-pin';
      el.innerHTML = `<span class="guide-course-pin-num">${pin.order}</span><span class="guide-course-pin-name">${escapeHtml(
        pin.name
      )}</span>`;
      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: el,
        yAnchor: 1,
        zIndex: pin.order,
      });
      overlay.setMap(map);
      overlays.push(overlay);
    });

    if (pins.length >= 2) {
      map.setBounds(bounds, 48, 48, 48, 48);
    } else {
      map.setLevel(5);
    }

    return () => {
      overlays.forEach((o) => o.setMap(null));
    };
  }, [ready, pins]);

  if (pins.length === 0) return null;

  return (
    <div className={`guide-course-map${className ? ` ${className}` : ''}`}>
      {error ? (
        <p className="guides-muted">{error}</p>
      ) : (
        <div ref={containerRef} className="guide-course-map-canvas" role="img" aria-label="코스 지도" />
      )}
      <ol className="guide-course-map-legend">
        {pins.map((p) => (
          <li key={`${p.order}-${p.name}`}>
            <span className="guide-course-pin-num">{p.order}</span>
            <span>
              {p.time ? `${p.time} · ` : ''}
              {p.name}
            </span>
          </li>
        ))}
      </ol>
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
