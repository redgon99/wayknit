import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { PrivacyBody } from '../components/LegalDocuments';
import i18n from '../lib/i18n';
import { PRIVACY_EFFECTIVE_DATE } from '../lib/legalDates';
import { normalizeLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import '../styles/app.css';

/**
 * 시험 운영용 개인정보처리방침. 결제 대행·구독 관련 수집은 포함하지 않습니다.
 * 법률 자문을 대체하지 않는 최소 운영 버전입니다.
 */
export default function PrivacyPage() {
  const planPath = plannerPath(normalizeLocale(i18n.language));

  return (
    <div className="static-page legal-page">
      <header className="static-page-header">
        <Link to={planPath} className="static-page-back">
          <Icon name="chevronLeft" /> 돌아가기
        </Link>
        <h1>개인정보처리방침</h1>
        <p className="static-page-lead">시행일: {PRIVACY_EFFECTIVE_DATE} · 한국어가 정본입니다</p>
      </header>
      <PrivacyBody />
      <LegalLinks className="static-page-legal-links" />
    </div>
  );
}
