import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { IconName } from '../icons/wayknit-icons';
import { dismissShareOnboarding } from '../lib/onboarding';

/** 문구는 share 번역의 `coach.<id>Title` / `coach.<id>Body` */
const STEPS: Array<{ id: 'view' | 'add' | 'edit'; icon: IconName }> = [
  { id: 'view', icon: 'mapPin' },
  { id: 'add', icon: 'plus' },
  { id: 'edit', icon: 'route' },
];

interface Props {
  onComplete: () => void;
}

export function ShareOnboardingCoach({ onComplete }: Props) {
  const { t } = useTranslation('share');
  const { t: tc } = useTranslation('common');
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  function finish() {
    dismissShareOnboarding();
    onComplete();
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <>
      <div className="share-onboarding-backdrop" aria-hidden="true" />
      <div
        className="onboarding-coach share-onboarding-coach"
        role="dialog"
        aria-modal="true"
        aria-label={t('coach.aria')}
      >
        <div className="onboarding-coach-body">
          <Icon name={current.icon} size={20} />
          <div>
            <strong>{t(`coach.${current.id}Title`)}</strong>
            {/* 3단계 본문은 실제 버튼 이름을 따옴표로 가리킨다 — 버튼과 같은 번역을 끼워 넣는다 */}
            <p>{t(`coach.${current.id}Body`, { editButton: t('trip.editMine') })}</p>
          </div>
        </div>
        <div className="onboarding-coach-actions">
          <button type="button" className="onboarding-dismiss" onClick={finish}>
            {t('coach.dontShow')}
          </button>
          <button type="button" className="onboarding-next" onClick={handleNext}>
            {isLast ? tc('confirm') : tc('next')}
          </button>
        </div>
        <div className="onboarding-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
      </div>
    </>
  );
}
