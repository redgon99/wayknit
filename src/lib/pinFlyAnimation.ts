/**
 * 지도에서 핀업할 때 "장소가 핀 목록으로 날아가는" 연출.
 *
 * 지도 말풍선의 핀업 버튼을 누르면 목록에 조용히 한 줄이 추가될 뿐이라,
 * 특히 다른 탭을 보고 있으면 방금 누른 것이 어디로 갔는지 알기 어렵다.
 * 눌린 자리에서 핀 탭까지 날아가 착지하면서 탭 개수가 튀도록 해 시선을
 * 이어준다.
 *
 * DOM을 직접 다루는 이유: 출발점이 지도 SDK가 그리는 오버레이(React 밖)라
 * 컴포넌트 트리로 좌표를 넘기기 어렵고, 연출용 요소가 리렌더에 얽힐 이유도 없다.
 */
import { iconSvgMarkup, type IconName } from '../icons/wayknit-icons';

const FLIGHT_MS = 620;
const TAB_POP_MS = 420;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** 핀 탭 버튼. 사이드 패널이 닫혀 있으면 없을 수 있다. */
function findPinTab(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.planner-side-tab[data-tab="pins"]');
}

/** 착지 지점에서 개수가 올라간 것을 눈에 띄게 한다 */
function popPinTab(tab: HTMLElement): void {
  tab.classList.remove('pin-tab-pop');
  // 클래스를 곧바로 다시 붙이면 애니메이션이 재시작되지 않는다 — 리플로우로 끊어준다
  void tab.offsetWidth;
  tab.classList.add('pin-tab-pop');
  window.setTimeout(() => tab.classList.remove('pin-tab-pop'), TAB_POP_MS);
}

export interface PinFlyOptions {
  /** 출발 지점 — 보통 눌린 핀업 버튼 */
  from: DOMRect;
  label: string;
  iconName: IconName;
}

/**
 * 출발 지점에서 핀 탭까지 고스트 하나를 날린다.
 * 핀 탭을 못 찾으면(패널이 닫힌 경우) 아무 것도 하지 않는다.
 */
export function flyPinToTab({ from, label, iconName }: PinFlyOptions): void {
  const tab = findPinTab();
  if (!tab) return;

  if (prefersReducedMotion()) {
    popPinTab(tab);
    return;
  }

  const to = tab.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const ghost = document.createElement('div');
  ghost.className = 'pin-fly-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.innerHTML = `
    <span class="pin-fly-ghost-icon">${iconSvgMarkup(iconName, { size: 16 })}</span>
    <span class="pin-fly-ghost-label"></span>
  `;
  // 장소명은 사용자·외부 API에서 오므로 textContent로 넣는다 (HTML 주입 방지)
  const labelEl = ghost.querySelector<HTMLElement>('.pin-fly-ghost-label');
  if (labelEl) labelEl.textContent = label;

  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;
  document.body.appendChild(ghost);

  // 살짝 위로 솟았다가 떨어지는 포물선 — 직선보다 눈이 따라가기 쉽다
  const dx = endX - startX;
  const dy = endY - startY;
  const arc = Math.min(90, Math.abs(dx) * 0.22 + 40);

  const animation = ghost.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.12 },
      {
        transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - arc}px)) scale(1)`,
        opacity: 1,
        offset: 0.6,
      },
      {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)`,
        opacity: 0,
      },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  );

  animation.onfinish = () => {
    ghost.remove();
    popPinTab(tab);
  };
  // 애니메이션이 중간에 취소돼도 고스트가 화면에 남지 않게 한다
  animation.oncancel = () => ghost.remove();
}

/**
 * 지금 열려 있는 지도 말풍선의 핀업 버튼 위치.
 * 말풍선은 핀업 직후 닫히므로 클릭 시점에 바로 읽어야 한다.
 */
export function currentBubblePinRect(): DOMRect | null {
  const btn = document.querySelector<HTMLElement>('.map-place-bubble-pin');
  return btn ? btn.getBoundingClientRect() : null;
}
