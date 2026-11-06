import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import {
  KOREA_SETUP_ITEMS,
  readSetupProgress,
  toggleSetupItem,
} from '../lib/koreaSetup';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import i18n from '../lib/i18n';

interface Props {
  onOpenAirportHelp?: () => void;
}

interface SetupItemLink {
  label: string;
  url: string;
}

export function KoreaSetupContent({ onOpenAirportHelp }: Props) {
  const { t } = useTranslation('planner');
  const [done, setDone] = useState(() => readSetupProgress());
  const [openId, setOpenId] = useState<string | null>(null);
  const completed = KOREA_SETUP_ITEMS.filter((item) => done[item.id]).length;

  return (
    <div className="korea-setup-content">
      <p className="setup-progress">
        {t('setup.progress', { done: completed, total: KOREA_SETUP_ITEMS.length })}
      </p>
      <ul className="setup-checklist">
        {KOREA_SETUP_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <li key={item.id} className={`setup-item ${isOpen ? 'open' : ''}`}>
              <div className="setup-item-row">
                <label className="setup-check-item">
                  <input
                    type="checkbox"
                    checked={!!done[item.id]}
                    onChange={() => setDone(toggleSetupItem(item.id))}
                  />
                  <span>{t(item.labelKey)}</span>
                </label>
                <button
                  type="button"
                  className="setup-item-toggle"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t('setup.collapse') : t('setup.expand')}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                >
                  <Icon name="chevronDown" size={16} />
                </button>
              </div>
              {isOpen && (
                <div className="setup-item-detail">
                  <p>{t(`setup.details.${item.id}.body`)}</p>
                  <ul className="setup-item-tips">
                    <li>{t(`setup.details.${item.id}.tip1`)}</li>
                    <li>{t(`setup.details.${item.id}.tip2`)}</li>
                    <li>{t(`setup.details.${item.id}.tip3`)}</li>
                  </ul>
                  {(() => {
                    const links = t(`setup.details.${item.id}.links`, {
                      returnObjects: true,
                      defaultValue: [],
                    }) as SetupItemLink[];
                    if (!Array.isArray(links) || links.length === 0) return null;
                    return (
                      <ul className="setup-item-links">
                        {links.map((link) => (
                          <li key={link.url}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              <Icon name="externalLink" size={13} />
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {item.id === 'airport' && (
                    onOpenAirportHelp ? (
                      <button
                        type="button"
                        className="setup-item-hint-btn"
                        onClick={onOpenAirportHelp}
                      >
                        {t('setup.airportWizardLink')}
                      </button>
                    ) : (
                      <a
                        className="setup-item-hint-btn"
                        href={`${pathWithLocale('/help', normalizeLocale(i18n.language))}#airport`}
                      >
                        {t('setup.airportWizardLink')}
                      </a>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
