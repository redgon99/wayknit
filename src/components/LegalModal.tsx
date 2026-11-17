import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { PrivacyBody, TermsBody } from './LegalDocuments';
import { PRIVACY_EFFECTIVE_DATE, TERMS_EFFECTIVE_DATE } from '../lib/legalDates';

export type LegalModalKind = 'terms' | 'privacy';

interface Props {
  kind: LegalModalKind | null;
  onClose: () => void;
}

export function LegalModal({ kind, onClose }: Props) {
  const { t } = useTranslation('common');
  const open = kind !== null;
  const title = kind === 'privacy' ? t('legal.privacy') : t('legal.terms');

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
        className="modal-card legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('close')}>
          <Icon name="close" />
        </button>
        <h2 id="legal-modal-title">{title}</h2>
        <p className="legal-modal-lead">
          시행일: {kind === 'privacy' ? PRIVACY_EFFECTIVE_DATE : TERMS_EFFECTIVE_DATE} · 한국어가 정본입니다
        </p>
        <div className="legal-modal-body legal-page">
          {kind === 'privacy' ? <PrivacyBody /> : <TermsBody />}
        </div>
      </div>
    </div>
  );
}
