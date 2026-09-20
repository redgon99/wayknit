import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 시나리오 카탈로그의 언어 탭처럼, 제목 아래·본문 위에 넣을 보조 컨트롤 */
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** 관리자 목록의 "미리보기" 액션이 공통으로 쓰는 모달 — 가이드 카드·시나리오·배포관리·시장 인사이트(§33) */
export function AdminPreviewModal({ open, onClose, title, subtitle, headerExtra, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card admin-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-preview-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
          <Icon name="close" />
        </button>
        <div className="admin-preview-modal-head">
          <h2 id="admin-preview-modal-title">{title}</h2>
          {subtitle && <p className="admin-cell-sub">{subtitle}</p>}
          {headerExtra}
        </div>
        <div className="admin-preview-modal-body">{children}</div>
      </div>
    </div>
  );
}
