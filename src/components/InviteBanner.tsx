import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../hooks/useAuth';
import { fetchInvitePreview, type TripInvitePreview } from '../lib/trips';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import i18n from '../lib/i18n';

/**
 * 초대 링크(/plan?invite=<id>)로 들어온 사람에게 상황을 알려준다.
 *
 * 아직 초대 메일을 보낼 수단이 없어 소유자가 링크를 직접 전달하는데, 링크만
 * 받아서는 "무엇을, 어느 계정으로" 해야 하는지 알 수 없다. 특히 다른 계정으로
 * 로그인해 있으면 아무 일도 일어나지 않고 조용히 실패하므로 그 경우를
 * 명시적으로 알려주는 것이 이 배너의 핵심이다.
 *
 * 실제 연결은 AuthContext의 acceptPendingInvites()가 한다 — 로그인 계정의
 * 이메일이 초대 이메일과 일치할 때만.
 */
export function InviteBanner() {
  const { t } = useTranslation('share');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const inviteId = params.get('invite');
  /* 초대 링크가 실어 온 주소. 미리보기 RPC의 주소는 마스킹돼 있어 로그인창을
   * 채울 수 없으므로, 링크에 있을 때만 그대로 넘긴다. */
  const invitedEmailFromLink = params.get('email');

  const [preview, setPreview] = useState<TripInvitePreview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    let alive = true;
    void fetchInvitePreview(inviteId).then((p) => {
      if (!alive) return;
      setPreview(p);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [inviteId, user?.id]);

  if (!inviteId || !loaded) return null;

  const dismiss = () => {
    const next = new URLSearchParams(params);
    next.delete('invite');
    // 주소를 주소창에 계속 남겨둘 이유가 없다
    next.delete('email');
    setParams(next, { replace: true });
  };

  // 초대 이메일은 마스킹되어 오므로(gwf***@gmail.com) 로그인 계정과 정확히
  // 비교할 수 없다. 앞 3글자와 도메인으로 같은 주소인지 가늠한다.
  const looksLikeMe = (() => {
    const masked = preview?.invitedEmail;
    const mine = user?.email?.trim().toLowerCase();
    if (!masked || !mine) return false;
    const [maskedLocal, maskedDomain] = masked.split('@');
    const [mineLocal, mineDomain] = mine.split('@');
    return (
      maskedDomain === mineDomain && mineLocal.startsWith(maskedLocal.replace('***', ''))
    );
  })();

  let body: string;
  let action: { label: string; run: () => void } | null = null;

  if (!preview) {
    body = t('invite.notFound');
  } else if (preview.accepted) {
    body = t('invite.alreadyJoined', { trip: preview.tripTitle });
  } else if (!user) {
    body = t('invite.needLogin', {
      inviter: preview.inviterEmail ?? '',
      trip: preview.tripTitle,
      email: preview.invitedEmail ?? '',
    });
    action = {
      label: t('invite.loginCta'),
      run: () => {
        const q = new URLSearchParams({ invite: inviteId });
        if (invitedEmailFromLink) q.set('email', invitedEmailFromLink);
        navigate(`${pathWithLocale('/login', normalizeLocale(i18n.language))}?${q.toString()}`);
      },
    };
  } else if (!looksLikeMe) {
    body = t('invite.wrongAccount', {
      email: preview.invitedEmail ?? '',
      current: user.email ?? '',
    });
  } else {
    body = t('invite.connecting', { trip: preview.tripTitle });
  }

  return (
    <div className="invite-banner" role="status">
      <Icon name="mailOk" size={18} />
      <div className="invite-banner-body">
        <strong>{t('invite.heading')}</strong>
        <span>{body}</span>
      </div>
      {action && (
        <button type="button" className="invite-banner-cta" onClick={action.run}>
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="invite-banner-close"
        onClick={dismiss}
        aria-label={t('invite.dismiss')}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
