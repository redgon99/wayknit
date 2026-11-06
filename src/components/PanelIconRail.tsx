import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { PlannerPanelTab } from './PlannerSidePanel';

interface Props {
  visible: boolean;
  pinCount: number;
  activeTab?: PlannerPanelTab | null;
  onOpen: (tab: PlannerPanelTab) => void;
}

export function PanelIconRail({ visible, pinCount, activeTab, onOpen }: Props) {
  const { t } = useTranslation('planner');
  if (!visible) return null;

  return (
    <nav className="planner-icon-rail desktop-only-overlay" aria-label={t('chrome.railAria')}>
      <button
        type="button"
        className={`planner-rail-btn ${activeTab === 'search' ? 'active' : ''}`}
        onClick={() => onOpen('search')}
        data-tour="search"
        title={t('chrome.tabSearch')}
        aria-label={t('chrome.openSearch')}
      >
        <Icon name="search" size={18} />
      </button>
      <button
        type="button"
        className={`planner-rail-btn ${activeTab === 'pins' ? 'active' : ''}`}
        onClick={() => onOpen('pins')}
        data-tour="pins"
        title={t('chrome.tabPins', { count: pinCount })}
        aria-label={t('chrome.openPins')}
      >
        <Icon name="pin" size={18} />
        {pinCount > 0 && <span className="planner-rail-badge">{pinCount}</span>}
      </button>
      <button
        type="button"
        className={`planner-rail-btn ${activeTab === 'route' ? 'active' : ''}`}
        onClick={() => onOpen('route')}
        data-tour="route"
        title={t('chrome.tabRoute')}
        aria-label={t('chrome.openRoute')}
      >
        <Icon name="route" size={18} />
      </button>
      <button
        type="button"
        className={`planner-rail-btn ${activeTab === 'scenario' ? 'active' : ''}`}
        onClick={() => onOpen('scenario')}
        data-tour="scenario"
        title={t('chrome.tabScenario')}
        aria-label={t('chrome.openScenario')}
      >
        <Icon name="sparkles" size={18} />
      </button>
    </nav>
  );
}
