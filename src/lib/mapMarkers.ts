import { iconSvgMarkup } from '../icons/wayknit-icons';
import { getCategoryMeta } from './categories';
import type { Place, PinnedPlace } from '../types';

/** 검색 결과 마커 아이콘 (기본 16px 대비 +30%) */
export const SEARCH_MARKER_ICON_SIZE = 21;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** 테마 배경색보다 진한 테두리·음영용 */
function darkenHex(hex: string, amount = 0.38): string {
  const [r, g, b] = parseHex(hex);
  const f = 1 - amount;
  const to = (n: number) => Math.round(n * f).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 지도 주변 검색 중심 — 원형 링 + 십자(crosshair) 마커 */
export function renderSearchCenterMarkerHtml(): string {
  return `
    <div class="search-center-marker" title="검색 중심">
      <div class="search-center-ring" aria-hidden="true">
        ${iconSvgMarkup('crosshair', { size: 22, color: '#6d28d9' })}
      </div>
    </div>
  `;
}

/** 검색·핀업 장소 마커 (카카오 CustomOverlay / Google HTML overlay 공용) */
export function renderPlaceMarkerHtml(options: {
  place: Place;
  pinned?: PinnedPlace;
  isSelected: boolean;
}): string {
  const { place, pinned, isSelected } = options;
  const isPinned = !!pinned;
  const meta = getCategoryMeta(place.categoryCode);
  const themeBorder = darkenHex(meta.bgColor);
  const borderColor = isSelected ? '#1d4ed8' : themeBorder;
  const iconSize = SEARCH_MARKER_ICON_SIZE;
  const markerShadow = `0 3px 12px ${hexToRgba(themeBorder, 0.48)}, 0 1px 4px rgba(15, 23, 42, 0.22)`;

  return `
    <div class="map-marker ${isPinned ? 'pinned' : 'search'} ${isSelected ? 'selected' : ''}">
      ${
        isPinned
          ? `<div class="marker-pin-circle" style="background:${meta.bgColor};border-color:#fff;box-shadow:0 2px 8px rgba(15,23,42,0.3)">
          <span class="marker-order-num">${pinned!.order}</span>
        </div>
        <div class="marker-label marker-label-below">${escapeHtml(place.name)}</div>`
          : `<div class="marker-dot" style="background:${meta.bgColor};border-color:${borderColor}${markerShadow ? `;box-shadow:${markerShadow}` : ''}">
        ${iconSvgMarkup(meta.icon, {
          size: iconSize,
          color: meta.iconColor,
        })}
      </div>`
      }
    </div>
  `;
}
