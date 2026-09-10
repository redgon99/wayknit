import { useRef } from 'react';
import type { TouchEvent } from 'react';

interface LongPressOptions {
  delay?: number;
  moveThreshold?: number;
}

/** 길게 누른 지점 (뷰포트 기준 픽셀) */
export interface LongPressPoint {
  x: number;
  y: number;
}

/**
 * 지도 팬(드래그)과 구분하기 위해 이동거리 임계치를 넘으면 타이머를 취소한다.
 * 지도 좌표(위경도) 변환은 하지 않는다 — 누른 지점을 화면 픽셀로만 넘겨서
 * 카카오/구글 어느 지도에서도 같은 훅을 쓸 수 있게 한다.
 * 이 좌표는 "여기를 눌렀다"고 말풍선이 가리키는 데 쓰인다.
 */
export function useLongPress(
  onLongPress: (point: LongPressPoint) => void,
  options?: LongPressOptions,
) {
  const delay = options?.delay ?? 550;
  const moveThreshold = options?.moveThreshold ?? 12;
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const point = { x: touch.clientX, y: touch.clientY };
    startRef.current = point;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      // 손가락이 임계치 안에서 미세하게 움직였을 수 있으니 최신 위치를 쓴다
      onLongPress(startRef.current ?? point);
    }, delay);
  };

  const onTouchMove = (e: TouchEvent) => {
    const start = startRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.hypot(dx, dy) > moveThreshold) clear();
  };

  const onTouchEnd = () => clear();
  const onTouchCancel = () => clear();

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
