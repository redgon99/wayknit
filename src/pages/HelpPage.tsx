import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { HelpContent } from '../components/HelpContent';
import { LegalLinks } from '../components/LegalLinks';
import { normalizeLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import '../styles/app.css';

export default function HelpPage() {
  const { t, i18n } = useTranslation('planner');
  const planPath = plannerPath(normalizeLocale(i18n.language));

  return (
    <>
    <SiteHeader active="trip" />
    <div className="static-page help-page">
      <header className="static-page-header">
        <Link to={planPath} className="static-page-back">
          <Icon name="chevronLeft" /> {t('help.backToPlan')}
        </Link>
        <h1>{t('help.title')}</h1>
        <p className="static-page-lead">{t('help.lead')}</p>
      </header>
      <HelpContent />
      <LegalLinks className="static-page-legal-links" />
    </div>
    </>
  );
}
