import { useState } from 'react';
import { Icon } from './Icon';
import type { IconName } from '../icons/wayknit-icons';
import { dismissShareOnboarding } from '../lib/onboarding';

const STEPS: Array<{ title: string; body: string; icon: IconName }> = [
  {
    title: '공유된 여행 보기',
    body: '지도에서 핀업한 장소와 만든 동선을 확인할 수 있습니다. 상단 탭으로 일차를 바꿀 수 있어요.',
    icon: 'mapPin',
  },
  {
    title: '내 여행에 추가',
    body: '녹색 버튼을 누르면 이 일정이 내 여행 목록에 복사됩니다. 이후 자유롭게 수정할 수 있어요.',
    icon: 'plus',
  },
  {
    title: '편집 화면으로 이동',
    body: '「내 여행 편집하기」로 검색·핀업·동선 만들기 화면으로 바로 갈 수 있습니다.',
    icon: 'route',
  },
];

interface Props {
  onComplete: () => void;
}

export function ShareOnboardingCoach({ onComplete }: Props) {
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
        aria-label="공유 보기 안내"
      >
        <div className="onboarding-coach-body">
          <Icon name={current.icon} size={20} />
          <div>
            <strong>{current.title}</strong>
            <p>{current.body}</p>
          </div>
        </div>
        <div className="onboarding-coach-actions">
          <button type="button" className="onboarding-dismiss" onClick={finish}>
            다시 보지 않기
          </button>
          <button type="button" className="onboarding-next" onClick={handleNext}>
            {isLast ? '확인' : '다음'}
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
