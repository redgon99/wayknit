import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import {
  listCollaborators,
  listPendingInvites,
  inviteCollaboratorByEmail,
  updateCollaboratorRole,
  removeCollaborator,
  cancelInvite,
  buildInviteLink,
  type TripCollaborator,
  type TripInvite,
  type CollaboratorRole,
} from '../lib/trips';
import {
  listTripActivity,
  actorKind,
  type TripActivityEntry,
} from '../lib/tripActivity';

interface Props {
  open: boolean;
  tripId: string;
  tripTitle: string;
  currentUserId: string;
  onClose: () => void;
}

export function CollaboratorsModal({ open, tripId, tripTitle, currentUserId, onClose }: Props) {
  const { t } = useTranslation('share');
  const { t: tc } = useTranslation('common');
  const [collaborators, setCollaborators] = useState<TripCollaborator[]>([]);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'people' | 'activity'>('people');
  const [activity, setActivity] = useState<TripActivityEntry[] | null>(null);

  /**
   * 아직 초대 메일을 보내는 수단이 없어서, 소유자가 링크를 복사해
   * 직접(카톡·문자 등) 전달한다. 링크만으로는 권한이 생기지 않고
   * 초대한 이메일로 로그인해야 연결된다.
   */
  const handleCopyLink = async (inviteId: string, email: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(inviteId, email));
      setCopiedId(inviteId);
      window.setTimeout(() => setCopiedId((prev) => (prev === inviteId ? null : prev)), 2000);
    } catch {
      setError(t('collab.copyFailed'));
    }
  };

  const refresh = async () => {
    setLoading(true);
    const [c, i] = await Promise.all([listCollaborators(tripId), listPendingInvites(tripId)]);
    setCollaborators(c);
    setInvites(i);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('editor');
    setError(null);
    setTab('people');
    setActivity(null);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId]);

  // 활동 탭을 열 때만 읽는다 — 사람 탭만 쓰는 경우가 대부분이라 미리 받지 않는다.
  useEffect(() => {
    if (!open || tab !== 'activity' || activity !== null) return;
    void listTripActivity(tripId).then(setActivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, tripId]);

  if (!open) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    setError(null);
    try {
      await inviteCollaboratorByEmail(tripId, trimmed, role, currentUserId);
      setEmail('');
      await refresh();
    } catch {
      setError(t('collab.inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, nextRole: CollaboratorRole) => {
    await updateCollaboratorRole(tripId, userId, nextRole);
    await refresh();
  };

  const handleRemove = async (userId: string) => {
    await removeCollaborator(tripId, userId);
    await refresh();
  };

  const handleCancelInvite = async (inviteId: string) => {
    await cancelInvite(inviteId);
    await refresh();
  };

  return (
    <div className="share-trip-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="share-trip-modal collab-modal"
        role="dialog"
        aria-labelledby="collab-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="share-trip-modal-header">
          <h2 id="collab-modal-title">{t('collab.title')}</h2>
          <button type="button" className="share-trip-modal-close" onClick={onClose} aria-label={tc('close')}>
            <Icon name="close" />
          </button>
        </header>

        <div className="share-trip-modal-body">
          <label className="share-trip-modal-field">
            <span>{t('modal.tripName')}</span>
            <input type="text" value={tripTitle} readOnly className="share-trip-modal-readonly" />
          </label>

          <div className="collab-tabs" role="tablist">
            {(['people', 'activity'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`collab-tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                {id === 'people' ? t('collab.activity.tabPeople') : t('collab.activity.tabActivity')}
              </button>
            ))}
          </div>

          {tab === 'activity' ? (
            <ActivityList entries={activity} currentUserId={currentUserId} />
          ) : (
          <>
          <p className="share-trip-modal-hint">{t('collab.hint')}</p>

          <form className="collab-invite-row" onSubmit={handleInvite}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('collab.emailPlaceholder')}
              required
              disabled={inviting}
              className="collab-invite-email"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CollaboratorRole)}
              disabled={inviting}
              className="collab-invite-role"
            >
              <option value="editor">{t('collab.roleEditor')}</option>
              <option value="viewer">{t('collab.roleViewer')}</option>
            </select>
            <button type="submit" className="share-trip-modal-btn primary" disabled={inviting}>
              {inviting ? t('collab.inviting') : t('collab.invite')}
            </button>
          </form>
          {error && <p className="share-trip-modal-warn">{error}</p>}

          {loading ? (
            <p className="share-trip-modal-hint">{tc('loading')}</p>
          ) : (
            <>
              {collaborators.length > 0 && (
                <ul className="collab-list">
                  {collaborators.map((c) => (
                    <li key={c.userId} className="collab-list-item">
                      <span className="collab-list-email">{c.email ?? c.userId}</span>
                      <select
                        value={c.role}
                        onChange={(e) => handleRoleChange(c.userId, e.target.value as CollaboratorRole)}
                        className="collab-invite-role"
                      >
                        <option value="editor">{t('collab.roleEditor')}</option>
                        <option value="viewer">{t('collab.roleViewer')}</option>
                      </select>
                      <button
                        type="button"
                        className="collab-remove-btn"
                        onClick={() => handleRemove(c.userId)}
                        aria-label={t('collab.remove')}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {invites.length > 0 && (
                <>
                  <p className="share-trip-modal-hint collab-pending-label">{t('collab.pendingLabel')}</p>
                  <ul className="collab-list">
                    {invites.map((i) => (
                      <li key={i.id} className="collab-list-item collab-list-item--pending">
                        <span className="collab-list-email">{i.email}</span>
                        <span className="collab-role-badge">
                          {i.role === 'editor' ? t('collab.roleEditor') : t('collab.roleViewer')}
                        </span>
                        <button
                          type="button"
                          className="collab-copy-link-btn"
                          onClick={() => void handleCopyLink(i.id, i.email)}
                        >
                          {copiedId === i.id ? t('collab.linkCopied') : t('collab.copyLink')}
                        </button>
                        <button
                          type="button"
                          className="collab-remove-btn"
                          onClick={() => handleCancelInvite(i.id)}
                          aria-label={t('collab.cancelInvite')}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {collaborators.length === 0 && invites.length === 0 && (
                <p className="share-trip-modal-hint">{t('collab.empty')}</p>
              )}
            </>
          )}
          </>
          )}
        </div>

        <footer className="share-trip-modal-footer">
          <button type="button" className="share-trip-modal-btn secondary" onClick={onClose}>
            {t('modal.ok')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * 활동 목록. 재정렬은 lib에서 이미 묶어서 내려오므로 여기선 그대로 그린다.
 */
function ActivityList({
  entries,
  currentUserId,
}: {
  entries: TripActivityEntry[] | null;
  currentUserId: string;
}) {
  const { t, i18n } = useTranslation('share');
  // 브라우저 언어가 아니라 앱에서 고른 언어를 따라야 한다.
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language]
  );

  if (entries === null) {
    return <p className="share-trip-modal-hint">{t('collab.activity.loading')}</p>;
  }
  if (entries.length === 0) {
    return <p className="share-trip-modal-hint">{t('collab.activity.empty')}</p>;
  }
  return (
    <ul className="collab-activity-list">
      {entries.map((e) => {
        const actor = actorKind(e, currentUserId);
        const who =
          actor.kind === 'self'
            ? t('collab.activity.you')
            : actor.kind === 'system'
              ? t('collab.activity.system')
              : actor.name;
        const day = e.detail?.day;
        return (
          <li key={e.id} className="collab-activity-item">
            <span className="collab-activity-text">
              {t(`collab.activity.${e.action}`, {
                actor: who,
                target: e.target ?? '',
                count: e.count,
                defaultValue: e.action,
              })}
            </span>
            <span className="collab-activity-meta">
              {typeof day === 'number' && (
                <span className="collab-activity-day">{t('collab.activity.dayBadge', { day })}</span>
              )}
              <time dateTime={new Date(e.createdAt).toISOString()}>{fmt.format(e.createdAt)}</time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
