import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppSheetModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /*
   * U18(모바일 UX 리포트 2026-09-13) — 이 컴포넌트가 이 세션에서만도
   * §27-6(PinupBar 더보기), U11(공유 선택), U18 이전 여러 곳에 재사용된
   * 공통 시트라, 여기 하나에 포커스 트랩·초기 포커스·닫은 뒤 포커스
   * 복원을 넣는 게 개별 모달마다 흩어져 고치는 것보다 효과가 크다
   * (리포트가 요청한 "공통 처리로 통일"). `open` 하나만 의존성으로 둬야
   * 한다 — onClose를 넣으면 부모가 매 렌더마다 새 인라인 함수를 넘길
   * 때마다 이 이펙트가 재실행돼 열려 있는 동안에도 포커스를 복원했다가
   * 다시 뺏는 깜빡임이 생긴다. 그래서 최신 onClose는 ref로만 읽는다.
   */
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const modal = modalRef.current;
    const focusables = () =>
      Array.from(modal?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (el) => el.offsetParent !== null
      );
    (focusables()[0] ?? modal)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !modal) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        modal.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modal.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="app-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={modalRef}
        className={`app-sheet-modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-sheet-header">
          <div className="app-sheet-heading">
            <h2 id="app-sheet-title">{title}</h2>
            {subtitle ? <p className="app-sheet-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="app-sheet-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="app-sheet-body">{children}</div>
      </div>
    </div>
  );
}
