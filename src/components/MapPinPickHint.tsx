import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import type { LongPressPoint } from '../hooks/useLongPress';

interface Props {
  point: LongPressPoint;
  label: string;
}

const VIEWPORT_PAD = 12;
/** 말풍선과 누른 지점 사이 여백 — 롱프레스 도중엔 손가락이 그 자리를 덮고 있어, 넉넉히 띄워야 말풍선이 가려지지 않는다 */
const POINT_GAP = 28;
/** 위쪽에 이만큼 공간이 없으면 아래로 뒤집는다 */
const MIN_SPACE_ABOVE = 72;

/**
 * 롱프레스로 지도 핀업 모드에 들어갔을 때, 누른 지점을 말풍선 꼬리로 정확히
 * 가리키는 힌트. `MapContextMenu.tsx`와 같은 패턴(레이아웃 측정 + 뷰포트
 * 클램프 + body 포털)을 쓰되, 꼬리가 달린 말풍선이라는 점이 다르다.
 */
export function MapPinPickHint({ point, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ left: number; top: number; tailShift: number; below: boolean }>({
    left: point.x,
    top: point.y - POINT_GAP,
    tailShift: 0,
    below: false,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const halfWidth = width / 2;

    let left = point.x;
    if (left - halfWidth < VIEWPORT_PAD) left = halfWidth + VIEWPORT_PAD;
    else if (left + halfWidth > window.innerWidth - VIEWPORT_PAD) {
      left = window.innerWidth - VIEWPORT_PAD - halfWidth;
    }
    const tailShift = point.x - left;

    const below = point.y - height - POINT_GAP < MIN_SPACE_ABOVE;
    const top = below ? point.y + POINT_GAP : point.y - POINT_GAP;

    setLayout({ left, top, tailShift, below });
  }, [point.x, point.y]);

  return createPortal(
    <div
      ref={ref}
      className={`map-pin-pick-hint ${layout.below ? 'below' : 'above'}`}
      style={
        {
          left: layout.left,
          top: layout.top,
          '--map-pin-pick-tail-shift': `${layout.tailShift}px`,
        } as React.CSSProperties
      }
    >
      <Icon name="pinPlus" size={15} />
      {label}
    </div>,
    document.body
  );
}
