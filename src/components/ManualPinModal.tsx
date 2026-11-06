import { Icon } from './Icon';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  lat: number;
  lng: number;
  address: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function ManualPinModal({
  open,
  lat,
  lng,
  address,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName(address);
    }
  }, [open, address]);

  if (!open) return null;

  return (
    <div
      className="roadview-overlay manual-pin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('manualPin.aria')}
      onClick={onClose}
    >
      <div className="manual-pin-panel" onClick={(e) => e.stopPropagation()}>
        <header className="manual-pin-header">
          <span className="manual-pin-title">
            <Icon name="pinPlus" /> {t('manualPin.title')}
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tc('close')}>
            <Icon name="close" />
          </button>
        </header>

        <div className="manual-pin-body">
          <label className="manual-pin-label" htmlFor="manual-pin-name">
            {t('manualPin.nameLabel')}
          </label>
          <input
            id="manual-pin-name"
            type="text"
            className="manual-pin-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('manualPin.namePlaceholder')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onConfirm(name.trim());
            }}
          />

          <p className="manual-pin-address">
            <Icon name="mapPin" />
            {address}
          </p>
          <p className="manual-pin-coords">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>

        <footer className="manual-pin-footer">
          <button type="button" className="manual-pin-cancel" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button
            type="button"
            className="generate-btn manual-pin-confirm"
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
          >
            {t('manualPin.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}
