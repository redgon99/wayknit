import { Icon } from './Icon';
import { AppSheetModal } from './AppSheetModal';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { GeneratedRoute, PinnedPlace, SimpleCategory } from '../types';
import { getCategoryMeta, DEFAULT_CODE_BY_SIMPLE_CATEGORY } from '../lib/categories';
import { groupPinnedByCategory, movePinnedPlace, reorderPinnedPlaces } from '../lib/pinGroups';
import { SortableItem } from './Sortable';
import { PinExportMenu } from './PinExportMenu';
import { PinImportMenu } from './PinImportMenu';
import type { PinImportResult } from '../lib/importPins';
import { pinAuthorKey } from '../lib/trips';
import { presenceColor, presenceInitial } from '../lib/tripPresence';
import type { PinVote, VotesByPlace } from '../lib/tripVotes';

interface Props {
  pinned: PinnedPlace[];
  tripTitle?: string;
  currentDay?: number;
  totalDays?: number;
  pinnedByDay?: Record<number, PinnedPlace[]>;
  generatedRouteByDay?: Record<number, GeneratedRoute | null>;
  onExportNotify?: (message: string) => void;
  onUpgradeRequest?: () => void;
  onImportPins?: (result: PinImportResult) => void;
  mapCategoryFilter?: SimpleCategory | null;
  onToggleMapCategoryFilter?: (category: SimpleCategory) => void;
  mustVisitOnly?: boolean;
  onToggleMustVisitOnly?: () => void;
  onToggleRequired?: (id: string) => void;
  onShowTaxiCard?: (place: PinnedPlace) => void;
  onRemove: (id: string) => void;
  onReorder: (next: PinnedPlace[]) => void;
  onSelectPin?: (place: PinnedPlace) => void;
  selectedPinIds?: ReadonlySet<string>;
  onTogglePinSelection?: (id: string) => void;
  onClearAll?: () => void;
  onOpenRouteOptions: () => void;
  routeOptionsOpen: boolean;
  presentationMode?: boolean;
  onTogglePresentation?: () => void;
  variant?: 'default' | 'compact' | 'panel';
  hideTransferMenus?: boolean;
  hideHeader?: boolean;
  /**
   * 가져오기·보내기·필수만·전체해제를 한 줄 툴바 대신 아이콘 하나 뒤
   * 시트로 접는다 — F02(모바일 감사 보고서). 모바일 일정 탭의 sheet-half
   * 기본 높이에서 이 툴바 한 줄이 핀 목록 공간을 갉아먹어 첫 카드조차
   * 다 안 보였다. 데스크톱 사이드패널은 공간이 넉넉해 그대로 둔다 —
   * 모바일 호출부에서만 켠다.
   */
  compactToolbar?: boolean;
  /**
   * 핀 작성자 이메일 맵 (`pinAuthorKey(day, placeId)` → email).
   * 혼자 쓰는 여행에서는 전부 "나"라서 표시할 이유가 없다 — 협업 중일 때만 넘긴다.
   */
  pinAuthors?: Record<string, string | null>;
  /** 내 이메일. 내가 넣은 핀에는 배지를 달지 않는다. */
  currentUserEmail?: string | null;
  /**
   * 빈 일정 화면의 주 실행 버튼 — 검색 탭(모바일 시트/데스크톱 패널)으로 이동.
   * F13(모바일 감사 보고서): "읽어오기" 버튼만 있고 검색 안내는 문장이라
   * 첫 장소를 담는 가장 흔한 경로(검색)에 실행 버튼이 없었다.
   */
  onGoToSearch?: () => void;
  /**
   * U02(모바일 UX 리포트 2026-09-13) — 이미 오늘 동선이 만들어져 있으면
   * 호출부(모바일 시트)가 "오늘 동선" 요약 카드에 같은 동작("다시 짜기")을
   * 이미 보여준다. 이 하단 고정 CTA까지 남겨두면 같은 버튼이 화면에
   * 두 번(카드 안 "다시 짜기" + 패널 하단 "동선 만들기") 떠서 반보기의
   * 목록 공간만 축낸다 — 그럴 때 호출부가 이 prop으로 꺼 준다.
   */
  hideRouteCta?: boolean;
  /**
   * U14(모바일 UX 리포트 2026-09-13) — "장소 카드에서 연결 자료를 바로
   * 연다"는 요청. 장소별 연결 자료 개수가 있으면 카드에 배지를 붙이고,
   * 누르면 onOpenPlaceMaterials로 그 장소의 자료를 바로 연다.
   */
  materialCountByPlace?: Record<string, number>;
  onOpenPlaceMaterials?: (placeId: string) => void;
  /**
   * N06(모바일 UX 리포트 2026-09-13) — 동행자 투표. 협업 중인 여행에서만
   * 호출부가 넘긴다(혼자 쓰는 여행에서 나 혼자 투표하는 건 의미가 없다).
   * onVote는 토글 의미 — 같은 표를 다시 누르면 호출부가 거둔다.
   */
  pinVotes?: VotesByPlace;
  myUserId?: string | null;
  onVote?: (placeId: string, vote: PinVote) => void;
}

function DroppableGroupChips({
  category,
  children,
}: {
  category: SimpleCategory;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${category}` });
  return (
    <div
      ref={setNodeRef}
      className={`group-chips ${isOver ? 'group-chips-drop-over' : ''}`}
    >
      {children}
    </div>
  );
}

export function PinupBar({
  pinned,
  tripTitle: tripTitleProp,
  currentDay = 1,
  totalDays = 1,
  pinnedByDay = {},
  generatedRouteByDay,
  onExportNotify,
  onUpgradeRequest,
  onImportPins,
  mapCategoryFilter = null,
  onToggleMapCategoryFilter,
  mustVisitOnly = false,
  onToggleMustVisitOnly,
  onToggleRequired,
  onShowTaxiCard,
  onRemove,
  onReorder,
  onSelectPin,
  selectedPinIds = new Set(),
  onTogglePinSelection,
  onClearAll,
  onOpenRouteOptions,
  routeOptionsOpen,
  presentationMode = false,
  onTogglePresentation,
  variant = 'default',
  hideTransferMenus = false,
  hideHeader = false,
  compactToolbar = false,
  pinAuthors,
  currentUserEmail,
  onGoToSearch,
  hideRouteCta = false,
  materialCountByPlace,
  onOpenPlaceMaterials,
  pinVotes,
  myUserId,
  onVote,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const tripTitle = tripTitleProp ?? t('export.tripName');
  const categoryLabel = (category: SimpleCategory) => tc(`category.${category}`);
  const compact = variant === 'compact';
  const panel = variant === 'panel';
  const [dragActive, setDragActive] = useState(false);
  const [toolbarSheetOpen, setToolbarSheetOpen] = useState(false);
  // U07(모바일 UX 리포트 2026-09-13) — 방문순서를 기본값으로.
  const [sortMode, setSortMode] = useState<'visit' | 'category'>('visit');
  const ids = pinned.map((p) => p.id);
  const selectionCount = selectedPinIds.size;
  const routeTargetCount = selectionCount > 0 ? selectionCount : pinned.length;
  const visiblePinned = mustVisitOnly ? pinned.filter((p) => p.required) : pinned;
  const groups = groupPinnedByCategory(visiblePinned, dragActive);
  const transferMenus = hideTransferMenus ? null : onImportPins ? (
    <div className="pin-transfer-actions">
      <PinImportMenu
        currentDay={currentDay}
        totalDays={totalDays}
        pinnedByDay={pinnedByDay}
        onImport={onImportPins}
        onNotify={onExportNotify}
      />
      <PinExportMenu
        tripTitle={tripTitle}
        currentDay={currentDay}
        totalDays={totalDays}
        pinnedByDay={pinnedByDay}
        generatedRouteByDay={generatedRouteByDay}
        onNotify={onExportNotify}
        onUpgradeRequest={onUpgradeRequest}
      />
    </div>
  ) : (
    <PinExportMenu
      tripTitle={tripTitle}
      currentDay={currentDay}
      totalDays={totalDays}
      pinnedByDay={pinnedByDay}
      generatedRouteByDay={generatedRouteByDay}
      onNotify={onExportNotify}
      onUpgradeRequest={onUpgradeRequest}
    />
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(_event: DragStartEvent) {
    setDragActive(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragActive(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // 방문순서 모드는 그룹 드롭존이 없으니 순서만 바꾼다 — movePinnedPlace를
    // 쓰면 넘어간 자리의 이웃 카테고리로 조용히 재분류돼 버린다(U07).
    const next =
      sortMode === 'visit'
        ? reorderPinnedPlaces(pinned, String(active.id), String(over.id))
        : movePinnedPlace(pinned, String(active.id), String(over.id));
    onReorder(next);
  }

  function handleDragCancel() {
    setDragActive(false);
  }

  const presentationBtn =
    pinned.length > 0 && onTogglePresentation ? (
      <button
        type="button"
        className={`pinup-presentation-btn ${presentationMode ? 'active' : ''}`}
        onClick={onTogglePresentation}
        title={
          presentationMode ? t('pinup.presentationExitTitle') : t('pinup.presentation')
        }
        aria-pressed={presentationMode}
        aria-label={
          presentationMode ? t('pinup.presentationExit') : t('pinup.presentation')
        }
      >
        <Icon name={presentationMode ? 'minimize' : 'presentation'} />
      </button>
    ) : null;

  if (pinned.length === 0) {
    return (
      <div
        className={`pinup-bar empty ${panel ? 'pinup-bar-panel' : ''} ${presentationMode ? 'presentation-active' : ''}`}
      >
        <div className="pinup-empty-message">
          <Icon name="pin" />
          <span>{t('trip.emptyPins')}</span>
        </div>
        {onGoToSearch && (
          <button type="button" className="pinup-empty-search-btn" onClick={onGoToSearch}>
            <Icon name="search" size={15} />
            {t('search.ariaLabel')}
          </button>
        )}
        {transferMenus}
      </div>
    );
  }

  function renderChip(p: PinnedPlace) {
    const meta = getCategoryMeta(p.categoryCode);
    const borderColor = meta.bgColor;
    const isSelected = selectedPinIds.has(p.id);
    // 남이 넣은 핀만 표시한다. 내 것까지 달면 전부 배지가 붙어
    // "누가 넣었나"라는 정보가 오히려 안 보인다.
    const authorEmail = pinAuthors?.[pinAuthorKey(p.day, p.id)] ?? null;
    const showAuthor = !!authorEmail && authorEmail !== (currentUserEmail ?? '');
    return (
      <SortableItem key={p.id} id={p.id}>
        {({ listeners, setActivatorNodeRef, isDragging }) => (
          <div
            className={`pin-chip ${isDragging ? 'dragging' : ''} ${isSelected ? 'is-selected' : ''}`}
            style={{
              borderColor,
              boxShadow: isSelected
                ? `0 0 0 2px var(--color-primary), 0 0 0 3px ${borderColor}55`
                : `0 0 0 1px ${borderColor}40`,
            }}
            title={p.name}
          >
            {/*
              U01(모바일 UX 리포트 2026-09-13) — 순번·작성자·깃발·이름·
              잠금·별점·택시·삭제가 한 줄에서 경쟁해 이름이 "육…"·"어…"처럼
              한두 글자로 잘렸다. 이름을 최우선으로 두는 줄(chip-row-main)과
              나머지 메타 정보(chip-row-meta)를 담는 줄로 나눈다. 잠금 배지
              (구 chip-required-badge)는 깃발 토글(chip-required)과 같은
              상태를 중복 표시했을 뿐이라 없앴다 — 필수 표시는 깃발 하나로.
            */}
            <div className="chip-row-main">
              <span
                ref={setActivatorNodeRef}
                {...listeners}
                className="chip-order chip-drag"
                style={{
                  background: `${borderColor}22`,
                  color: meta.iconColor,
                }}
                title={t('pinup.dragOrder')}
              >
                {p.order}
              </span>
              <button
                type="button"
                className="chip-body"
                aria-pressed={isSelected}
                onClick={() => {
                  onTogglePinSelection?.(p.id);
                  onSelectPin?.(p);
                }}
                onDoubleClick={() => onSelectPin?.(p)}
              >
                <span className="chip-name">{p.name}</span>
              </button>
              {onToggleRequired && (
                <button
                  type="button"
                  className={`chip-required ${p.required ? 'active' : ''}`}
                  onClick={() => onToggleRequired(p.id)}
                  title={p.required ? t('pinup.unmarkRequired') : t('pinup.markRequired')}
                  aria-pressed={!!p.required}
                >
                  <Icon name="flag" />
                </button>
              )}
            </div>
            <div className="chip-row-meta">
              <div className="chip-meta-left">
                {showAuthor && (
                  <span
                    className="chip-author"
                    style={{ background: presenceColor(authorEmail) }}
                    title={t('pinup.addedBy', {
                      who: authorEmail,
                      defaultValue: '{{who}} 님이 추가',
                    })}
                    aria-label={t('pinup.addedBy', {
                      who: authorEmail,
                      defaultValue: '{{who}} 님이 추가',
                    })}
                  >
                    {presenceInitial(authorEmail)}
                  </span>
                )}
                {p.fixedArrival && (
                  <span
                    className={`chip-fixed-arrival ${p.itemKind === 'reserved' ? 'reserved' : ''}`}
                    title={
                      p.itemKind === 'reserved'
                        ? t('pinup.reservedAt', { time: p.fixedArrival })
                        : t('pinup.fixedArrivalAt', { time: p.fixedArrival })
                    }
                  >
                    <Icon
                      name={p.itemKind === 'reserved' ? 'facilityReservation' : 'clock'}
                    />
                    {p.fixedArrival}
                  </span>
                )}
                {p.rating !== undefined && (
                  <span className="chip-rating">
                    <Icon name="star" />
                    {p.rating.toFixed(1)}
                  </span>
                )}
                {/*
                  U14(모바일 UX 리포트 2026-09-13) — 자료 화면 자체엔 필터가
                  있었지만 "이 장소에 연결된 자료"로 바로 가는 길이 없었다.
                  개수가 있을 때만 배지를 보여준다.
                */}
                {onOpenPlaceMaterials && !!materialCountByPlace?.[p.id] && (
                  <button
                    type="button"
                    className="chip-materials"
                    onClick={() => onOpenPlaceMaterials(p.id)}
                    title={t('pinup.placeMaterials', { count: materialCountByPlace[p.id] })}
                  >
                    <Icon name="folder" size={11} />
                    {materialCountByPlace[p.id]}
                  </button>
                )}
                {/* N06 — 동행자 투표: 가고 싶음 / 보류. 표 수는 있을 때만 숫자로. */}
                {onVote && (() => {
                  const tv = pinVotes?.[p.id];
                  const wantN = tv?.want.length ?? 0;
                  const holdN = tv?.hold.length ?? 0;
                  const mine: PinVote | null = !myUserId
                    ? null
                    : tv?.want.includes(myUserId)
                      ? 'want'
                      : tv?.hold.includes(myUserId)
                        ? 'hold'
                        : null;
                  return (
                    <span className="chip-votes" role="group" aria-label={t('vote.groupAria')}>
                      <button
                        type="button"
                        className={`chip-vote want ${mine === 'want' ? 'active' : ''}`}
                        onClick={() => onVote(p.id, 'want')}
                        aria-pressed={mine === 'want'}
                        title={t('vote.want')}
                      >
                        <Icon name="check" size={11} />
                        {wantN > 0 && <span className="chip-vote-n">{wantN}</span>}
                      </button>
                      <button
                        type="button"
                        className={`chip-vote hold ${mine === 'hold' ? 'active' : ''}`}
                        onClick={() => onVote(p.id, 'hold')}
                        aria-pressed={mine === 'hold'}
                        title={t('vote.hold')}
                      >
                        <Icon name="clock" size={11} />
                        {holdN > 0 && <span className="chip-vote-n">{holdN}</span>}
                      </button>
                    </span>
                  );
                })()}
              </div>
              <div className="chip-meta-right">
                {onShowTaxiCard && (
                  <button
                    type="button"
                    className="chip-taxi"
                    onClick={() => onShowTaxiCard(p)}
                    title={t('taxi.showCard')}
                    aria-label={t('taxi.showCard')}
                  >
                    <Icon name="transportCar" />
                  </button>
                )}
                <button
                  type="button"
                  className="chip-delete"
                  onClick={() => onRemove(p.id)}
                  aria-label={t('pinup.removePin', { name: p.name })}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
          </div>
        )}
      </SortableItem>
    );
  }

  /*
   * U07(모바일 UX 리포트 2026-09-13) — 카테고리별 묶음이 기본이라 화면
   * 번호(순번 배지)가 방문 순서처럼 보이지만 실제로는 아니었다("음식점
   * 2·3·4, 마트 1"). 방문순서(정렬만, 그룹 없음)를 기본으로 바꾸고,
   * 기존 카테고리별 묶음은 명시적으로 전환하는 보기 옵션으로 남긴다.
   * 카테고리가 하나뿐이면 두 모드가 똑같아 보여 전환 UI 자체를 숨긴다.
   */
  const hasMultipleCategories = groups.length > 1;

  const flatContent = (
    <div className="pinup-groups pinup-flat-list">
      {[...visiblePinned].sort((a, b) => a.order - b.order).map((p) => renderChip(p))}
    </div>
  );

  const groupsContent = (
    <div className="pinup-groups">
      {groups.map((group) => {
        const label = categoryLabel(group.category);
        const headMeta = getCategoryMeta(
          group.items[0]?.categoryCode ?? DEFAULT_CODE_BY_SIMPLE_CATEGORY[group.category],
        );
        return (
          <section
            key={group.category}
            className={`pinup-group ${group.items.length === 0 ? 'pinup-group-empty' : ''}`}
            aria-label={label}
          >
            <div className="pinup-group-row">
              <div className="pinup-group-head">
                <button
                  type="button"
                  className={`group-icon group-icon-toggle ${mapCategoryFilter === group.category ? 'active' : ''}`}
                  style={{ background: headMeta.bgColor, color: headMeta.iconColor }}
                  onClick={() => onToggleMapCategoryFilter?.(group.category)}
                  title={
                    mapCategoryFilter === group.category
                      ? t('pinup.filterClear', { label })
                      : t('pinup.filterOnly', { label })
                  }
                  aria-pressed={mapCategoryFilter === group.category}
                >
                  <Icon name={headMeta.icon} />
                </button>
                <span className="group-label">{label}</span>
                <span className="group-count">{group.items.length}</span>
              </div>
              <DroppableGroupChips category={group.category}>
                {group.items.map((p) => renderChip(p))}
              </DroppableGroupChips>
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className={`pinup-bar ${presentationMode ? 'presentation-active' : ''} ${compact ? 'pinup-bar-compact' : ''} ${panel ? 'pinup-bar-panel' : ''}`}>
      {!hideHeader && !panel && (
      <div className="pinup-header">
        <div className="pinup-title-block">
          <Icon name="pin" />
          <span className="pinup-title">
            {compact ? t('pinup.titleShort') : t('pinup.title')}
          </span>
          <span className="pinup-count">{pinned.length}</span>
          {presentationBtn}
        </div>
        {!compact && (
          <span className="pinup-hint">
            {selectionCount > 0
              ? t('pinup.hintSelection', { count: selectionCount })
              : t('pinup.hintDefault')}
          </span>
        )}
        {onToggleMustVisitOnly && pinned.some((p) => p.required) && !compact && (
          <button
            type="button"
            className={`pinup-must-visit-btn ${mustVisitOnly ? 'active' : ''}`}
            onClick={onToggleMustVisitOnly}
            aria-pressed={mustVisitOnly}
          >
            <Icon name="flag" /> {t('pinup.mustVisitOnly')}
          </button>
        )}
        {onClearAll && pinned.length > 0 && !compact && (
          <button type="button" className="pinup-clear-btn" onClick={onClearAll}>
            {t('pinup.clearAll')}
          </button>
        )}
        {transferMenus}
        <button
          className={`route-cta ${routeOptionsOpen ? 'active' : ''}`}
          onClick={onOpenRouteOptions}
          disabled={routeTargetCount < 2}
          title={
            selectionCount > 0
              ? t('pinup.routeTitleSelected', { count: selectionCount })
              : t('pinup.routeTitleAll')
          }
        >
          <Icon name="route" />
          {compact
            ? t('pinup.routeCtaShort')
            : selectionCount > 0
              ? t('pinup.routeCtaCount', { count: selectionCount })
              : t('pinup.routeCta')}
        </button>
      </div>
      )}

      {panel ? (
        <>
          {(() => {
            const hasToolbar =
              transferMenus ||
              (onClearAll && pinned.length > 0) ||
              (onToggleMustVisitOnly && pinned.some((p) => p.required));
            if (!hasToolbar) return null;

            const trailingActions = (
              <>
                {onToggleMustVisitOnly && pinned.some((p) => p.required) && (
                  <button
                    type="button"
                    className={`pinup-must-visit-btn ${mustVisitOnly ? 'active' : ''}`}
                    onClick={onToggleMustVisitOnly}
                    aria-pressed={mustVisitOnly}
                  >
                    <Icon name="flag" /> {t('pinup.mustVisitOnly')}
                  </button>
                )}
                {onClearAll && pinned.length > 0 && (
                  <button type="button" className="pinup-clear-btn" onClick={onClearAll}>
                    {t('pinup.clearAll')}
                  </button>
                )}
              </>
            );

            if (compactToolbar) {
              // 한 줄 툴바 대신 아이콘 하나. 목록이 첫 화면부터 보이는 걸
              // 우선한다 — 이 도구들은 자주 쓰는 조작이 아니다. 가로 배치용
              // spacer는 세로로 쌓는 시트 안에서는 필요 없다.
              return (
                <>
                  <div className="pinup-panel-toolbar pinup-panel-toolbar-compact">
                    <button
                      type="button"
                      className="pinup-toolbar-trigger"
                      onClick={() => setToolbarSheetOpen(true)}
                      aria-label={t('pinup.toolbarMore')}
                      title={t('pinup.toolbarMore')}
                    >
                      <Icon name="more" size={18} />
                    </button>
                  </div>
                  <AppSheetModal
                    open={toolbarSheetOpen}
                    title={t('pinup.toolbarMore')}
                    onClose={() => setToolbarSheetOpen(false)}
                  >
                    <div className="pinup-toolbar-sheet-items">
                      {transferMenus}
                      {trailingActions}
                    </div>
                  </AppSheetModal>
                </>
              );
            }

            return (
              <div className="pinup-panel-toolbar">
                {transferMenus}
                <div className="pinup-panel-toolbar-spacer" />
                {trailingActions}
              </div>
            );
          })()}
          <div className="pinup-panel-scroll">
            {hasMultipleCategories && (
              <div className="mobile-view-toggle pinup-sort-toggle">
                <button
                  type="button"
                  className={`mobile-view-toggle-btn ${sortMode === 'visit' ? 'active' : ''}`}
                  onClick={() => setSortMode('visit')}
                >
                  {t('pinup.sortVisit')}
                </button>
                <button
                  type="button"
                  className={`mobile-view-toggle-btn ${sortMode === 'category' ? 'active' : ''}`}
                  onClick={() => setSortMode('category')}
                >
                  {t('pinup.sortCategory')}
                </button>
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {sortMode === 'visit' ? flatContent : groupsContent}
              </SortableContext>
            </DndContext>
          </div>
          {!hideRouteCta && (
            <div className="pinup-panel-footer">
              <button
                type="button"
                className={`route-cta panel-route-cta ${routeOptionsOpen ? 'active' : ''}`}
                onClick={onOpenRouteOptions}
                disabled={routeTargetCount < 2}
              >
                {selectionCount > 0
                  ? t('pinup.routeCtaCount', { count: selectionCount })
                  : t('pinup.routeCta')}
              </button>
            </div>
          )}
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {groupsContent}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
