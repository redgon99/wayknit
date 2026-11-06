import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

export type PlannerPanelTab = 'search' | 'pins' | 'route' | 'scenario';

interface Props {
  open: boolean;
  tab: PlannerPanelTab;
  pinCount: number;
  onTabChange: (tab: PlannerPanelTab) => void;
  onCollapse: () => void;
  searchSlot: ReactNode;
  pinsSlot: ReactNode;
  routeSlot: ReactNode;
  scenarioSlot?: ReactNode;
}

export function PlannerSidePanel({
  open,
  tab,
  pinCount,
  onTabChange,
  onCollapse,
  searchSlot,
  pinsSlot,
  routeSlot,
  scenarioSlot,
}: Props) {
  const { t } = useTranslation('planner');
  if (!open) return null;

  const tabs = scenarioSlot
    ? (['search', 'pins', 'route', 'scenario'] as const)
    : (['search', 'pins', 'route'] as const);

  return (
    <aside className="planner-side-panel desktop-only-overlay" aria-label={t('chrome.panelAria')}>
      <div className="planner-side-tabs">
        <div className="planner-side-tabs-track" role="tablist">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              // 핀업 애니메이션이 착지할 지점을 찾는 데 쓴다 (lib/pinFlyAnimation.ts)
              data-tab={id}
              // 첫 진입 코치마크가 가리킬 대상 (components/OnboardingCoach.tsx)
              data-tour={id}
              className={`planner-side-tab ${tab === id ? 'active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              {id === 'search' && t('chrome.tabSearch')}
              {id === 'pins' && t('chrome.tabPins', { count: pinCount })}
              {id === 'route' && t('chrome.tabRoute')}
              {id === 'scenario' && t('chrome.tabScenario')}
            </button>
          ))}
        </div>
      </div>

      <div className="planner-side-body">
        {tab === 'search' && searchSlot}
        {tab === 'pins' && pinsSlot}
        {tab === 'route' && routeSlot}
        {tab === 'scenario' && scenarioSlot}
      </div>

      <button
        type="button"
        className="planner-side-collapse"
        onClick={onCollapse}
        aria-label={t('chrome.panelCollapse')}
        title={t('chrome.panelCollapse')}
      >
        <Icon name="chevronLeft" size={16} />
      </button>
    </aside>
  );
}
