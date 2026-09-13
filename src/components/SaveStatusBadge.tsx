import { Icon } from './Icon';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../lib/format';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';

export type SaveStatus = 'local' | 'cloud' | 'syncing' | 'guest';

interface Props {
  status: SaveStatus;
  lastSavedAt?: number | null;
  onGuestClick?: () => void;
  /**
   * U06(모바일 UX 리포트 2026-09-13) — 모바일 상단 한 줄엔 텍스트 라벨을
   * 넣을 폭이 없어 아이콘만 남기는 모드. 대신 aria-label로 전체 상태를
   * 읽어주고, onTap으로 탭했을 때 상세 텍스트를 넘겨준다(호출부가 토스트
   * 등으로 보여줌).
   */
  compact?: boolean;
  onTap?: (message: string) => void;
}

function formatSavedAt(ts: number): string {
  return formatTime(ts, { hour: '2-digit', minute: '2-digit' }, normalizeLocale(i18n.language));
}

const ICONS: Record<SaveStatus, 'save' | 'cloudOk' | 'loader' | 'cloud'> = {
  local: 'save',
  cloud: 'cloudOk',
  syncing: 'loader',
  guest: 'cloud',
};

export function SaveStatusBadge({ status, lastSavedAt, onGuestClick, compact, onTap }: Props) {
  const { t } = useTranslation('planner');
  const labels: Record<SaveStatus, string> = {
    local: t('save.local'),
    cloud: t('save.saved'),
    syncing: t('save.saving'),
    guest: t('save.pending'),
  };
  const fullText =
    status !== 'syncing' && lastSavedAt != null
      ? `${labels[status]} · ${formatSavedAt(lastSavedAt)}`
      : labels[status];
  const isGuestClick = status === 'guest' && !!onGuestClick;
  const clickable = isGuestClick || (compact && !!onTap);
  const handleClick = isGuestClick ? onGuestClick : compact ? () => onTap?.(fullText) : undefined;
  return (
    <div
      className={`save-status-badge save-status-${status}${compact ? ' save-status-compact' : ''}${clickable ? ' save-status-clickable' : ''}`}
      title={lastSavedAt ? `마지막 저장 ${formatSavedAt(lastSavedAt)}` : undefined}
      aria-label={compact ? fullText : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick?.();
              }
            }
          : undefined
      }
    >
      <Icon name={ICONS[status]} spin={status === 'syncing'} size={14} />
      {!compact && <span>{labels[status]}</span>}
      {!compact && status !== 'syncing' && lastSavedAt != null && (
        <span className="save-status-time">{formatSavedAt(lastSavedAt)}</span>
      )}
    </div>
  );
}
