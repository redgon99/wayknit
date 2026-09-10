import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { AuthBar } from './AuthBar';
import { SaveStatusBadge, type SaveStatus } from './SaveStatusBadge';
import { TripSelectMenu } from './TripSelectMenu';
import { PlannerDayPills } from './PlannerDayPills';
import { AppSheetModal } from './AppSheetModal';
import { HelpContent } from './HelpContent';
import { KoreaSetupContent } from './KoreaSetupContent';
import { SharePlazaPanel } from './SharePlazaPanel';
import { PresenceStack } from './PresenceStack';
import type { PresenceViewer } from '../lib/tripPresence';
import type { Trip, TripSummary } from '../lib/trips';

type AppSheet = 'plaza' | 'setup' | 'help';

/** 기본값을 매 렌더 새 배열로 만들지 않는다 — 불필요한 리렌더를 막는다. */
const EMPTY_VIEWERS: PresenceViewer[] = [];

interface Props {
  trip: Trip;
  summaries: TripSummary[];
  countsByDay: Record<number, number>;
  saveStatus: SaveStatus;
  lastSavedAt?: number | null;
  onGuestSaveClick?: () => void;
  onTitleChange: (title: string) => void;
  onSelectTrip: (tripId: string) => void;
  onSelectDay: (day: number) => void;
  onAddDay: () => void;
  onRemoveDay: (day: number) => void;
  onOpenMaterials: () => void;
  onNewTrip?: () => void;
  onDeleteTrip?: () => void;
  onShare: () => void;
  onManageCollaborators?: () => void;
  /** 협업자에게는 "관리"가 아니라 함께 편집 중인 사람을 보는 입구다. */
  collabEntryLabel?: 'manage' | 'shared';
  /** 관심 테마 편집 — §26-7. 핀 탭 위에 얹혀 있던 걸 탭 무관 더보기 메뉴로 옮겼다. */
  onOpenPreferences?: () => void;
  presentationMode: boolean;
  onTogglePresentation: () => void;
  tableViewMode?: boolean;
  onToggleTableView?: () => void;
  plazaNavVisible?: boolean;
  /**
   * 같은 여행을 보고 있는 사람들. 채널은 `PlannerPage` 가 연다 — 이 앱바는
   * 데스크톱에서만 렌더되므로 여기서 열면 모바일에 아바타가 생기지 않고,
   * 양쪽에서 각각 열면 같은 여행에 채널이 두 개 열린다.
   */
  presenceViewers?: PresenceViewer[];
}

export function PlannerAppBar({
  trip,
  summaries,
  countsByDay,
  saveStatus,
  lastSavedAt,
  onGuestSaveClick,
  onTitleChange,
  onSelectTrip,
  onSelectDay,
  onAddDay,
  onRemoveDay,
  onOpenMaterials,
  onNewTrip,
  onDeleteTrip,
  onShare,
  onManageCollaborators,
  onOpenPreferences,
  collabEntryLabel = 'manage',
  presentationMode,
  onTogglePresentation,
  tableViewMode = false,
  onToggleTableView,
  plazaNavVisible,
  presenceViewers = EMPTY_VIEWERS,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: ts } = useTranslation('share');
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheet, setSheet] = useState<AppSheet | null>(null);
  const [helpAirportFocus, setHelpAirportFocus] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const mapActive = !presentationMode && !tableViewMode;

  const handleSelectMapView = () => {
    if (tableViewMode) onToggleTableView?.();
    if (presentationMode) onTogglePresentation();
  };

  const moreItem = (label: string, action: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      className={`planner-more-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        setMoreOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <>
    <header className="planner-app-bar desktop-only-overlay">
      {/* 1. 브랜드 + 여행 */}
      <Link to="/" className="planner-brand" title="Wayknit">
        <span className="planner-brand-mark" aria-hidden>
          여
        </span>
        <span className="planner-brand-text">
          Wayknit <span className="planner-brand-ko">{t('chrome.brandKo')}</span>
        </span>
      </Link>

      <div className="planner-app-bar-divider" aria-hidden />

      <div className="planner-trip-block">
        <input
          className="planner-trip-title"
          value={trip.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label={t('trip.titleAria')}
          maxLength={60}
        />
        <TripSelectMenu
          summaries={summaries}
          currentTripId={trip.id}
          onSelect={onSelectTrip}
          compact
          onNewTrip={onNewTrip}
          onDeleteTrip={onDeleteTrip}
        />
      </div>

      <div className="planner-app-bar-divider" aria-hidden />

      {/* 2. 일정 */}
      <PlannerDayPills
        totalDays={trip.totalDays}
        currentDay={trip.currentDay}
        countsByDay={countsByDay}
        onSelectDay={onSelectDay}
        onAddDay={onAddDay}
        onRemoveDay={onRemoveDay}
      />

      <div className="planner-app-bar-spacer" />

      {/* 3. 보기 전환 */}
      <div
        className="planner-view-segment"
        role="group"
        aria-label={t('view.segmentAria', { defaultValue: '보기 전환' })}
      >
        <button
          type="button"
          className={`planner-view-segment-btn ${mapActive ? 'active' : ''}`}
          aria-pressed={mapActive}
          onClick={handleSelectMapView}
        >
          {t('view.map', { defaultValue: '지도' })}
        </button>
        <button
          type="button"
          className={`planner-view-segment-btn ${presentationMode ? 'active' : ''}`}
          aria-pressed={presentationMode}
          onClick={onTogglePresentation}
        >
          {t('view.overview')}
        </button>
        {onToggleTableView && (
          <button
            type="button"
            className={`planner-view-segment-btn ${tableViewMode ? 'active' : ''}`}
            aria-pressed={tableViewMode}
            aria-haspopup="dialog"
            onClick={onToggleTableView}
          >
            {t('view.tableShort', { defaultValue: '표' })}
          </button>
        )}
      </div>

      <div className="planner-app-bar-divider" aria-hidden />

      {/* 4. 액션 */}
      <PresenceStack viewers={presenceViewers} />

      <SaveStatusBadge
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        onGuestClick={onGuestSaveClick}
      />

      <button
        type="button"
        className="planner-bar-icon-btn"
        onClick={onOpenMaterials}
        title={t('trip.materials')}
        aria-label={t('trip.materials')}
      >
        <Icon name="folder" size={17} />
      </button>

      <button
        type="button"
        className="planner-bar-icon-btn"
        onClick={onShare}
        title={t('trip.share')}
        aria-label={t('trip.share')}
      >
        <Icon name="share" size={17} />
      </button>

      {onManageCollaborators && (
        <button
          type="button"
          className="planner-bar-icon-btn"
          onClick={onManageCollaborators}
          title={ts(collabEntryLabel === 'shared' ? 'collab.entryShared' : 'collab.entry')}
          aria-label={ts(collabEntryLabel === 'shared' ? 'collab.entryShared' : 'collab.entry')}
        >
          <Icon name="facilityGroup" size={17} />
        </button>
      )}

      <div className="planner-bar-more" ref={moreRef}>
        <button
          type="button"
          className={`planner-bar-icon-btn ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label={t('nav.more', { defaultValue: '더보기' })}
          title={t('nav.more', { defaultValue: '더보기' })}
        >
          <span className="planner-bar-more-dots" aria-hidden>
            ⋯
          </span>
        </button>
        {moreOpen && (
          <div className="planner-more-menu" role="menu">
            {plazaNavVisible &&
              moreItem(t('plazaNav'), () => {
                setHelpAirportFocus(false);
                setSheet('plaza');
              })}
            {onOpenPreferences && moreItem(t('themes.label'), onOpenPreferences)}
            {moreItem(t('nav.setup'), () => {
              setHelpAirportFocus(false);
              setSheet('setup');
            })}
            {moreItem(t('nav.help'), () => {
              setHelpAirportFocus(false);
              setSheet('help');
            })}
          </div>
        )}
      </div>

      <div className="planner-app-bar-divider" aria-hidden />

      <AuthBar />
    </header>

      <AppSheetModal
        open={sheet === 'plaza'}
        title={t('plazaNav')}
        subtitle={t('nav.plazaLead', {
          defaultValue: '다른 여행자의 일정을 둘러보고 내 여행으로 끌어오세요.',
        })}
        onClose={() => setSheet(null)}
        wide
      >
        <SharePlazaPanel />
      </AppSheetModal>

      <AppSheetModal
        open={sheet === 'setup'}
        title={t('setup.title')}
        subtitle={t('setup.lead')}
        onClose={() => setSheet(null)}
      >
        <KoreaSetupContent
          onOpenAirportHelp={() => {
            setHelpAirportFocus(true);
            setSheet('help');
          }}
        />
      </AppSheetModal>

      <AppSheetModal
        open={sheet === 'help'}
        title={t('help.title')}
        subtitle={t('help.lead')}
        onClose={() => {
          setSheet(null);
          setHelpAirportFocus(false);
        }}
      >
        <HelpContent airportFocus={helpAirportFocus} />
      </AppSheetModal>
    </>
  );
}
