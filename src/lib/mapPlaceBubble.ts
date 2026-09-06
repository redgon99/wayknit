import type { Place } from '../types';
import { iconSvgMarkup } from '../icons/wayknit-icons';
import i18n from './i18n';
import { getCategoryMeta } from './categories';
import { getPlaceEmoji } from './categoryEmoji';
import { buildPlaceMapLinks } from './mapLinks';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 구글맵 POI 말풍선과 유사한 상세 보기 링크 (외부 폴백용) */
export function getPlaceDetailUrl(place: Place): string {
  if (place.placeUrl?.trim()) return place.placeUrl.trim();
  const links = buildPlaceMapLinks({
    name: place.nameKo ?? place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.roadAddress || place.address,
  });
  return links.kakao;
}

/** 검색결과 칩 PlaceThumb(variant=emoji)와 동일한 미리보기 */
function thumbInnerHtml(place: Place): string {
  const meta = getCategoryMeta(place.categoryCode, place.category);
  const accent = escapeHtml(meta.bgColor);
  const emoji = escapeHtml(getPlaceEmoji(place));
  const label = escapeHtml(i18n.t('map.viewPhoto', { ns: 'planner', name: place.name }));

  return `
    <button
      type="button"
      class="result-thumb result-thumb-emoji map-place-bubble-thumb"
      style="border-color:${accent}"
      title="${label}"
      aria-label="${label}"
    >
      <span class="result-thumb-fallback result-thumb-emoji-face" aria-hidden="true">${emoji}</span>
    </button>
  `;
}

function bubbleInnerHtml(place: Place, isPinned = false): string {
  const addr = place.roadAddress || place.address || '';
  const pinLabel = isPinned
    ? i18n.t('map.pinned', { ns: 'planner' })
    : i18n.t('map.pin', { ns: 'planner' });
  const roadviewLabel = i18n.t('search.roadview', { ns: 'planner' });
  return `
    <div class="map-place-bubble-card">
      ${thumbInnerHtml(place)}
      <div class="map-place-bubble-text">
        <div class="map-place-bubble-title">${escapeHtml(place.name)}</div>
        ${
          addr
            ? `<div class="map-place-bubble-addr">${escapeHtml(addr)}</div>`
            : ''
        }
      </div>
      <button
        type="button"
        class="map-place-bubble-roadview"
        title="${escapeHtml(roadviewLabel)}"
        aria-label="${escapeHtml(roadviewLabel)}"
      >
        ${iconSvgMarkup('roadview', { size: 18, color: '#334155' })}
      </button>
      <button
        type="button"
        class="map-place-bubble-pin${isPinned ? ' pinned' : ''}"
        title="${pinLabel}"
        aria-label="${pinLabel}"
      >
        ${iconSvgMarkup(isPinned ? 'check' : 'pinPlus', { size: 22, color: '#fff' })}
      </button>
    </div>
    <div class="map-place-bubble-tail" aria-hidden="true"></div>
  `;
}

/** 구글맵 스타일 대상물 상세 말풍선 (카카오 CustomOverlay용 DOM) */
export function createMapPlaceBubbleElement(
  place: Place,
  opts?: {
    onClose?: () => void;
    onOpenDetail?: (place: Place) => void;
    onTogglePin?: (place: Place) => void;
    onOpenRoadview?: (place: Place) => void;
    isPinned?: boolean;
  }
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'map-place-bubble';
  root.innerHTML = bubbleInnerHtml(place, opts?.isPinned);

  const openDetail = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    opts?.onOpenDetail?.(place);
  };
  const togglePin = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    opts?.onTogglePin?.(place);
  };
  const openRoadview = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    opts?.onOpenRoadview?.(place);
  };

  root.querySelector('.map-place-bubble-thumb')?.addEventListener('click', openDetail);
  root.querySelector('.map-place-bubble-pin')?.addEventListener('click', togglePin);
  root.querySelector('.map-place-bubble-roadview')?.addEventListener('click', openRoadview);

  root.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  void opts?.onClose;

  return root;
}

/** GoogleHtmlMarker용 HTML 문자열 */
export function createMapPlaceBubbleHtml(place: Place, isPinned = false): string {
  return `<div class="map-place-bubble">${bubbleInnerHtml(place, isPinned)}</div>`;
}

/** 말풍선에서 미리보기(좌측) 클릭인지 판별 */
export function isMapPlaceBubbleDetailClick(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element && target.closest('.map-place-bubble-thumb')
  );
}

/** 말풍선에서 핀업(우측) 클릭인지 판별 */
export function isMapPlaceBubblePinClick(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element && target.closest('.map-place-bubble-pin')
  );
}

/** 말풍선에서 로드뷰/스트리트뷰 버튼 클릭인지 판별 */
export function isMapPlaceBubbleRoadviewClick(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element && target.closest('.map-place-bubble-roadview')
  );
}
