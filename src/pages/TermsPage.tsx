import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { TermsBody } from '../components/LegalDocuments';
import i18n from '../lib/i18n';
import { normalizeLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import { TERMS_EFFECTIVE_DATE } from '../lib/legalDates';
import '../styles/app.css';

/**
 * 시험 운영용 이용약관. 유료 결제·구독 조항은 포함하지 않습니다.
 * 법률 자문을 대체하지 않는 최소 운영 버전입니다.
 */
export default function TermsPage() {
  const planPath = plannerPath(normalizeLocale(i18n.language));

  return (
    <div className="static-page legal-page">
      <header className="static-page-header">
        <Link to={planPath} className="static-page-back">
          <Icon name="chevronLeft" /> 돌아가기
        </Link>
        <h1>이용약관</h1>
        <p className="static-page-lead">시행일: {TERMS_EFFECTIVE_DATE} · 한국어가 정본입니다</p>
      </header>
      <TermsBody />
      <LegalLinks className="static-page-legal-links" />
    </div>
  );
}
