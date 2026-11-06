import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';

export type MobileSheetHeight = 'tall' | 'medium';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  height?: MobileSheetHeight;
  children: ReactNode;
}

export function MobileSheet({
  open,
  onClose,
  title,
  height = 'tall',
  children,
}: Props) {
  const { t } = useTranslation('common');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-sheet-root" role="presentation">
      <button
        type="button"
        className="mobile-sheet-backdrop"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div
        className={`mobile-sheet panel ${height === 'medium' ? 'mobile-sheet-medium' : 'mobile-sheet-tall'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <header className="mobile-sheet-header">
          <span className="mobile-sheet-title">{title ?? ''}</span>
          <button type="button" className="mobile-sheet-close" onClick={onClose}>
            <Icon name="close" size={18} />
            {t('close')}
          </button>
        </header>
        <div className="mobile-sheet-body">{children}</div>
      </div>
    </div>
  );
}
