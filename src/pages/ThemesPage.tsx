import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { TRIP_THEMES } from '../lib/themes';
import { normalizeLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import '../styles/app.css';

export default function ThemesPage() {
  const { t } = useTranslation('planner');
  const planPath = plannerPath(normalizeLocale(i18n.language));

  return (
    <div className="static-page themes-page">
      <header className="static-page-header">
        <Link to={planPath} className="static-page-back">
          <Icon name="chevronLeft" /> {t('themes.backToPlan')}
        </Link>
        <h1>{t('themes.boardTitle')}</h1>
        <p className="static-page-lead">{t('themes.boardLead')}</p>
      </header>

      <div className="themes-board-grid">
        {TRIP_THEMES.map((theme) => (
          <Link
            key={theme.id}
            to={`${planPath}?theme=${theme.id}`}
            className="themes-board-card"
          >
            <Icon name={theme.icon} size={28} />
            <h2>{t(theme.labelKey)}</h2>
            <p>{t(`themes.desc.${theme.id}`)}</p>
            <span className="themes-board-cta">{t('themes.startPlanning')}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
