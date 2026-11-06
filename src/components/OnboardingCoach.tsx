import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { dismissOnboarding } from '../lib/onboarding';

/**
 * 플래너 첫 진입 코치마크 — 앱 설치 직후 보이는 "손가락이 메뉴를 가리키며
 * 설명하는" 1회성 안내(2026-10-27 사용자 요청).
 *
 * 예전 이 자리는 화면 아래 고정된 텍스트 카드 3장(검색/핀업/동선)이었다 —
 * 무엇을 설명하는지는 말해도 그게 화면 어디에 있는지는 보여주지 못했다.
 * 지금은 실제 화면 요소를 찾아 그 자리만 밝히고(나머지는 어둡게), 손가락
 * 그래픽이 그 요소를 톡톡 누르는 동작을 반복하고, 옆에 말풍선을 붙인다.
 *
 * 단계 목록은 호출부(PlannerPage)가 정한다. 각 단계는 가리킬 CSS 선택자와,
 * 필요하면 그 요소가 화면에 나타나게 하는 `prepare`(예: 검색 결과의 지도
 * 말풍선을 연다)와 다음 단계로 넘어갈 때 되돌리는 `cleanup`(예: 상세 패널을
 * 닫는다)을 가진다. 같은 선택자가 데스크톱·모바일 양쪽에 있으면 지금 실제로
 * 보이는 쪽을 고른다. `waitMs` 안에 대상이 안 나타나면(시나리오 미설정,
 * 검색 결과 없음 등) 그 단계는 건너뛴다 — 안 보이는 걸 가리키지 않는다.
 *
 * 안내 중에는 바깥 클릭을 막는다(오버레이가 이벤트를 먹는다). 사용자가 직접
 * 탭을 바꾸면 다음 단계의 대상 위치가 바뀌어 손가락이 엉뚱한 곳을 가리킬 수
 * 있다 — 화면을 움직이는 건 각 단계의 prepare만 한다.
 */

export interface CoachStep {
  /** i18n 키 `onboarding.coach.<id>Title` / `<id>Body` 에도 쓰인다 */
  id: string;
  /** 함수면 측정할 때마다 다시 구한다 — 검색이 끝나야 정해지는 대상(특정 결과 카드)이나,
   *  사진이 로드되면 탭 줄에서 사진 영역으로 옮겨 가는 대상에 쓴다. */
  selector: string | (() => string);
  /** 대상이 나타나길 기다리는 최대 시간(ms). prepare가 검색·패널 열기를 하는 단계만 길게 준다. */
  waitMs?: number;
  /** 이 단계를 시작하기 전 쉬는 시간(ms). 앞 단계의 연출(핀이 탭으로 날아가는 애니메이션)이
   *  어두운 막에 가리지 않고 보이게 그동안은 아무것도 그리지 않는다. */
  delayMs?: number;
  /** `false`를 돌려주면 기다리지 않고 바로 건너뛴다(보여줄 장소가 없을 때 등). */
  prepare?: () => boolean | void;
  /** [다음]을 눌렀을 때만 — [건너뛰기]·Esc로 끝낼 땐 부르지 않는다(실제로 핀을 담는 단계용). */
  onNext?: () => void;
  cleanup?: () => void;
}

/** 대상 둘레 여백(px) — 버튼 테두리에 딱 붙으면 밝힌 영역이 답답해 보인다 */
const SPOT_PAD = 6;
const GUTTER = 16;
const BUBBLE_MAX_W = 300;
/** 말풍선 대략 높이 — 화면 밖으로 밀려나지 않게 위치를 자를 때만 쓴다 */
const BUBBLE_EST_H = 190;
/** 지도·시트가 막 그려지는 중이라 첫 프레임엔 대상 크기가 0일 수 있다 */
const START_DELAY_MS = 600;
const MIN_WAIT_MS = 300;
const POLL_MS = 150;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findVisibleTarget(selector: CoachStep['selector']): Rect | null {
  const resolved = typeof selector === 'function' ? selector() : selector;
  if (!resolved) return null;
  const nodes = document.querySelectorAll<HTMLElement>(resolved);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
    if (r.right <= 0 || r.left >= window.innerWidth) continue;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** 위를 가리키는 손가락. 손끝이 viewBox (15, 2) 지점이다 — 배치 계산이 이 점을 기준으로 한다. */
function PointingHand() {
  return (
    <svg className="coachmark-hand-svg" viewBox="0 0 44 56" width="44" height="56" aria-hidden>
      <path
        d="M15 2c-3 0-5 2.2-5 5v20.5l-2.6-2.4c-2-1.8-5-1.6-6.6.5-1.4 1.8-1.1 4.3.5 5.9l9.3 9.6C13 44.4 17 47 22.4 47h4.1C34 47 40 41 40 33.4V24c0-2.6-2-4.6-4.5-4.6-1 0-1.9.3-2.6.8-.6-1.9-2.4-3.2-4.4-3.2-1.1 0-2.1.4-2.9 1-.7-1.7-2.4-2.9-4.3-2.9-.9 0-1.7.2-2.3.6V7c0-2.8-2-5-5-5z"
        fill="#fff"
        stroke="#1f2937"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M26 20v9M33 24v6M20 18v10" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  steps: CoachStep[];
  onDone: () => void;
}

export function OnboardingCoach({ steps, onDone }: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');

  // 호출부가 매 렌더 새 배열을 넘겨도 진행 중인 단계가 다시 시작되지 않게 ref로 잡는다.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const total = steps.length;

  const [index, setIndex] = useState(0);
  /** 지금 단계의 대상을 찾았는지 — 찾기 전엔 아무것도 그리지 않는다 */
  const [ready, setReady] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const step: CoachStep | undefined = steps[index];

  const finish = useCallback(() => {
    stepsRef.current[index]?.cleanup?.();
    dismissOnboarding();
    onDone();
  }, [index, onDone]);

  const goNext = useCallback(() => {
    stepsRef.current[index]?.onNext?.();
    stepsRef.current[index]?.cleanup?.();
    setReady(false);
    setRect(null);
    setIndex((i) => i + 1);
  }, [index]);

  // 단계 진입: prepare → 대상이 나타날 때까지 짧게 폴링 → 못 찾으면 건너뛴다.
  useEffect(() => {
    const current = stepsRef.current[index];
    if (!current) {
      // 마지막 단계까지 다 건너뛰었으면(대상이 하나도 없는 화면) 조용히 끝낸다.
      dismissOnboarding();
      onDone();
      return;
    }
    let cancelled = false;
    const startDelay = index === 0 ? START_DELAY_MS : current.delayMs ?? 0;
    const deadline = Date.now() + startDelay + Math.max(MIN_WAIT_MS, current.waitMs ?? 0);
    let timer = 0;

    const skip = () => {
      current.cleanup?.();
      setSkippedCount((n) => n + 1);
      setIndex((i) => i + 1);
    };

    const poll = () => {
      if (cancelled) return;
      const found = findVisibleTarget(current.selector);
      if (found) {
        setRect(found);
        setReady(true);
        return;
      }
      if (Date.now() >= deadline) {
        skip();
        return;
      }
      timer = window.setTimeout(poll, POLL_MS);
    };

    timer = window.setTimeout(() => {
      if (cancelled) return;
      if (current.prepare?.() === false) {
        skip();
        return;
      }
      poll();
    }, startDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // onDone은 호출부에서 매 렌더 새로 만들어도 단계를 다시 시작할 이유가 아니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const measure = useCallback(() => {
    if (!ready || !step) return;
    const next = findVisibleTarget(step.selector);
    if (next) setRect((prev) => (sameRect(prev, next) ? prev : next));
    setViewport((prev) =>
      prev.w === window.innerWidth && prev.h === window.innerHeight
        ? prev
        : { w: window.innerWidth, h: window.innerHeight }
    );
  }, [ready, step]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // 리사이즈·회전·시트 애니메이션·지도 이동으로 대상이 움직여도 따라간다. 안내는
  // 몇 초뿐이라 가벼운 주기 측정으로 충분하다(ResizeObserver로는 위치 이동을 못 잡는다).
  useEffect(() => {
    if (!ready) return;
    window.addEventListener('resize', measure);
    const timer = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(timer);
    };
  }, [ready, measure]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const layout = useMemo(() => {
    if (!rect) return null;
    const spot = {
      top: rect.top - SPOT_PAD,
      left: rect.left - SPOT_PAD,
      width: rect.width + SPOT_PAD * 2,
      height: rect.height + SPOT_PAD * 2,
    };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // 대상이 화면 아래쪽(모바일 하단 탭바·시트 탭)이면 손가락과 말풍선을 위로 뒤집는다.
    const below = cy < viewport.h * 0.55;
    const bubbleW = Math.min(BUBBLE_MAX_W, viewport.w - GUTTER * 2);
    const bubbleLeft = Math.max(
      GUTTER,
      Math.min(cx - bubbleW / 2, viewport.w - GUTTER - bubbleW)
    );
    // 손끝은 대상 아래(또는 위) 가장자리 살짝 안쪽에 닿는다. 큰 대상(결과 카드·
    // 상세 탭 줄)은 가장자리에서 일정 거리만 들어가게 해 손이 대상 한가운데를 덮지 않게 한다.
    const inset = Math.min(rect.height * 0.3, 14);
    const tipY = below ? rect.top + rect.height - inset : rect.top + inset;
    const handGap = 58; // 손 그래픽 높이만큼 말풍선을 더 띄운다
    // 사진 영역처럼 큰 대상은 그 밖에 말풍선 자리가 없을 수 있다 — 화면 안으로 끌어올리고
    // (대상과 조금 겹쳐도) 잘리지 않는 쪽을 택한다.
    const maxEdge = viewport.h - GUTTER - BUBBLE_EST_H;
    return {
      spot,
      below,
      hand: { x: cx, y: tipY },
      ripple: { x: cx, y: tipY },
      bubble: below
        ? {
            left: bubbleLeft,
            top: Math.min(spot.top + spot.height + handGap, maxEdge),
            width: bubbleW,
          }
        : {
            left: bubbleLeft,
            bottom: Math.min(viewport.h - spot.top + handGap, maxEdge),
            width: bubbleW,
          },
    };
  }, [rect, viewport]);

  if (!step || !ready || !layout) return null;

  const visibleTotal = total - skippedCount;
  // 지금까지 건너뛴 단계는 모두 현재 단계 앞에 있다(뒤 단계는 아직 시도 전).
  const position = index - skippedCount + 1;
  const isLast = index >= total - 1;
  const title = t(`onboarding.coach.${step.id}Title`);

  return createPortal(
    <div className="coachmark-layer" role="dialog" aria-modal="true" aria-label={title}>
      {/* 바깥 클릭을 막는 투명 막 — 그림자 구멍 너머 실제 버튼도 이번엔 누를 수 없다(파일 상단 주석) */}
      <div className="coachmark-blocker" />
      <div
        className="coachmark-spot"
        style={{
          top: layout.spot.top,
          left: layout.spot.left,
          width: layout.spot.width,
          height: layout.spot.height,
        }}
      />
      <span
        key={`ripple-${step.id}`}
        className="coachmark-ripple"
        style={{ top: layout.ripple.y, left: layout.ripple.x }}
        aria-hidden
      />
      <div
        key={`hand-${step.id}`}
        className={`coachmark-hand ${layout.below ? '' : 'coachmark-hand-flip'}`}
        style={{ top: layout.hand.y, left: layout.hand.x }}
        aria-hidden
      >
        <PointingHand />
      </div>
      <div
        key={`bubble-${step.id}`}
        className="coachmark-bubble"
        style={layout.bubble}
        aria-live="polite"
      >
        <span className="coachmark-progress">
          {t('onboarding.coach.progress', { n: position, total: visibleTotal })}
        </span>
        <strong className="coachmark-title">{title}</strong>
        <p className="coachmark-body">{t(`onboarding.coach.${step.id}Body`)}</p>
        <div className="coachmark-actions">
          {!isLast && (
            <button type="button" className="coachmark-skip" onClick={finish}>
              {t('onboarding.coach.skip')}
            </button>
          )}
          <button
            type="button"
            className="coachmark-next"
            onClick={() => (isLast ? finish() : goNext())}
            autoFocus
          >
            {isLast ? t('onboarding.coach.start') : tc('next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
