import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { dismissFirstItineraryGuide } from '../lib/onboarding';

type MobileSheetLevel = 'peek' | 'half' | 'full';

interface Props {
  mobile?: boolean;
  /** 모바일에서만 의미 있음 — 시트 바로 위에 뜨도록 높이를 맞추는 데 쓴다. */
  sheetLevel?: MobileSheetLevel;
  pinCount: number;
  pinGoal: number;
  routeReady: boolean;
  onOpenSearch?: () => void;
  onOpenRoute?: () => void;
}

/**
 * N08(모바일 UX 리포트 2026-09-13) — "빈 여행에서 장소 3곳 수집 → 이동수단 →
 * 시간표를 실제 상태에 맞춰 안내".
 *
 * 기존 [OnboardingCoach](./OnboardingCoach.tsx)는 탭 3개(검색/핀/동선)가
 * 뭘 하는지 한 번 보여주는 **안내 투어**다 — 핀을 하나라도 담으면 영영
 * 사라진다. 그런데 리포트가 원하는 건 "지금 몇 곳 담았고 다음에 뭘 해야
 * 하는지"를 **실제 진행 상태에 맞춰** 보여주는 것이다. 투어가 끝난 자리를
 * 이 컴포넌트가 이어받는다(PlannerPage에서 `showOnboarding ? <OnboardingCoach>
 * : <FirstItineraryGuide>`로 배타적으로 그린다 — 동시에 뜨지 않는다).
 *
 * "반복 팝업을 더하는 제안이 아니다"(리포트 원문) — 그래서 이건 팝업이
 * 아니라 화면 아래 고정된 얇은 띠다. 언제 뜨고 접히는지는 호출부
 * (`lib/onboarding.ts`의 `shouldShowFirstItineraryGuide`)가 정한다:
 * 목표(핀 3+동선 1)를 채우면 **매번 그 자리에서 자동으로 사라진다**(여행에
 * 저장된 핀·동선 자체가 근거라 따로 "완료했음"을 기록해 둘 필요가 없다 —
 * 나중에 핀을 3개 밑으로 줄이면 다시 나타나는 것도 자연스러운 동작이다).
 * 사용자가 X로 접으면 그때만 별도로 기억해 그 여행에서 다시 안 뜬다.
 */
export function FirstItineraryGuide({
  mobile = false,
  sheetLevel,
  pinCount,
  pinGoal,
  routeReady,
  onOpenSearch,
  onOpenRoute,
}: Props) {
  const { t } = useTranslation('planner');
  const pinsDone = pinCount >= pinGoal;

  return (
    <div
      className={`onboarding-coach first-itinerary-guide ${mobile ? 'onboarding-coach-mobile' : ''} ${
        mobile && sheetLevel ? `first-itinerary-guide-sheet-${sheetLevel}` : ''
      }`}
      role="status"
      aria-label={t('firstGuide.title')}
    >
      <div className="first-itinerary-guide-head">
        <strong>{t('firstGuide.title')}</strong>
        <button
          type="button"
          className="first-itinerary-guide-close"
          onClick={dismissFirstItineraryGuide}
          aria-label={t('firstGuide.dismiss')}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <ul className="first-itinerary-guide-steps">
        <li className={pinsDone ? 'done' : ''}>
          <span className="first-itinerary-guide-check" aria-hidden>
            {pinsDone ? <Icon name="check" size={12} /> : '1'}
          </span>
          <span className="first-itinerary-guide-text">
            {t('firstGuide.step1', { count: pinCount, goal: pinGoal })}
          </span>
          {!pinsDone && onOpenSearch && (
            <button type="button" className="first-itinerary-guide-cta" onClick={onOpenSearch}>
              {t('firstGuide.step1Cta')}
            </button>
          )}
        </li>
        <li className={routeReady ? 'done' : !pinsDone ? 'muted' : ''}>
          <span className="first-itinerary-guide-check" aria-hidden>
            {routeReady ? <Icon name="check" size={12} /> : '2'}
          </span>
          <span className="first-itinerary-guide-text">{t('firstGuide.step2')}</span>
          {!routeReady && pinsDone && onOpenRoute && (
            <button type="button" className="first-itinerary-guide-cta" onClick={onOpenRoute}>
              {t('firstGuide.step2Cta')}
            </button>
          )}
        </li>
        <li className={!pinsDone || !routeReady ? 'muted' : ''}>
          <span className="first-itinerary-guide-check" aria-hidden>
            3
          </span>
          <span className="first-itinerary-guide-text">{t('firstGuide.step3')}</span>
        </li>
      </ul>
    </div>
  );
}
