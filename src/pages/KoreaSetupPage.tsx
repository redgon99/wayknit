import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { KoreaSetupContent } from '../components/KoreaSetupContent';
import { normalizeLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import '../styles/app.css';

export default function KoreaSetupPage() {
  const { t } = useTranslation('planner');

  return (
    <div className="static-page korea-setup-page">
      <header className="static-page-header">
        <Link to={plannerPath(normalizeLocale(i18n.language))} className="static-page-back">
          <Icon name="chevronLeft" /> {t('setup.backToPlan')}
        </Link>
        <h1>{t('setup.title')}</h1>
        <p className="static-page-lead">{t('setup.lead')}</p>
      </header>
      <KoreaSetupContent />
    </div>
  );
}
