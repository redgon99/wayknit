import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

const PHRASES = [
  { ko: '여기로 가주세요', key: 'goHere' },
  { ko: '이 주소로 가주세요', key: 'goToAddress' },
  { ko: '천천히 가주세요', key: 'driveSlowly' },
  { ko: '영수증 주세요', key: 'receipt' },
  { ko: '카드 됩니까?', key: 'acceptCards' },
  { ko: '화장실이 어디예요?', key: 'restroom' },
  { ko: '맵아요 (안 맵게)', key: 'notSpicy' },
  { ko: '감사합니다', key: 'thankYou' },
] as const;

export function HelpContent({ airportFocus = false }: { airportFocus?: boolean }) {
  const { t } = useTranslation('planner');

  useEffect(() => {
    if (!airportFocus) return;
    document.getElementById('airport')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [airportFocus]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="help-content">
      <section className="help-emergency">
        <h2>{t('help.emergencyTitle')}</h2>
        <div className="help-emergency-grid">
          <a href="tel:1330" className="help-emergency-card">
            <strong>1330</strong>
            <span>{t('help.travelHotline')}</span>
          </a>
          <a href="tel:112" className="help-emergency-card">
            <strong>112</strong>
            <span>{t('help.police')}</span>
          </a>
          <a href="tel:119" className="help-emergency-card">
            <strong>119</strong>
            <span>{t('help.fireAmbulance')}</span>
          </a>
        </div>
      </section>

      <section
        id="airport"
        className={`help-section ${airportFocus ? 'help-section-focus' : ''}`}
      >
        <h2>{t('help.airportTitle')}</h2>
        <ol className="help-steps">
          <li>{t('help.airportStep1')}</li>
          <li>{t('help.airportStep2')}</li>
          <li>{t('help.airportStep3')}</li>
          <li>{t('help.airportStep4')}</li>
        </ol>
      </section>

      <section className="help-section">
        <h2>{t('help.phrasesTitle')}</h2>
        <ul className="phrase-cards">
          {PHRASES.map((p) => (
            <li key={p.ko} className="phrase-card">
              <p className="phrase-ko">{p.ko}</p>
              <p className="phrase-en">{t(`help.phrases.${p.key}`)}</p>
              <button type="button" className="phrase-copy-btn" onClick={() => void copy(p.ko)}>
                <Icon name="note" size={14} /> {t('help.copyPhrase')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
