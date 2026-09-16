import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/SiteHeader';
import { SharePlazaPanel } from '../components/SharePlazaPanel';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useLandingNoticeTexts } from '../hooks/useLandingNoticeTexts';
import '../styles/app.css';

export default function SharePlazaPage() {
  const { t } = useTranslation('share');
  const noticeTexts = useLandingNoticeTexts();

  useSeoMeta({
    title: t('meta.plazaTitle'),
    description: t('meta.plazaDescription'),
    path: '/plaza',
  });

  return (
    <div className="plaza-page">
      <SiteHeader active="plaza" noticeTexts={noticeTexts} />
      <header className="plaza-header">
        <h1 className="plaza-title">{t('plaza.title')}</h1>
        <p className="plaza-subtitle">{t('meta.plazaDescription')}</p>
      </header>
      <main className="plaza-main">
        <SharePlazaPanel />
      </main>
    </div>
  );
}
