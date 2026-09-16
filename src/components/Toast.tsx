interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Props {
  message: string | null;
  /**
   * N02(모바일 UX 리포트 2026-09-13, 신규 제안) — 재계획 직후 "되돌리기".
   * 기본 토스트는 pointer-events:none(클릭 통과)이라 버튼을 못 누른다 —
   * action이 있을 때만 상호작용 가능한 변형으로 렌더링한다.
   */
  action?: ToastAction | null;
}

export function Toast({ message, action }: Props) {
  if (!message) return null;
  return (
    <div className={`app-toast ${action ? 'with-action' : ''}`} role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button type="button" className="app-toast-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
