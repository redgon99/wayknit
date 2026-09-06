import { getSupabase } from './supabase';

/**
 * 같은 여행을 보고 있는 사람을 Realtime presence 채널로 알린다.
 *
 * 서버에 아무것도 쓰지 않으므로 로그인하지 않은 방문자도 참여할 수 있고,
 * 탭을 닫으면 자동으로 사라진다.
 */

export interface PresenceIdentity {
  /** presence key — 같은 사람의 여러 탭을 하나로 묶는다 */
  id: string;
  name: string;
}

export interface PresenceViewer extends PresenceIdentity {
  color: string;
  isSelf: boolean;
}

const GUEST_ID_KEY = 'wayknit:presence-guest-id';

const COLORS = [
  '#2563eb',
  '#0d9488',
  '#c026d3',
  '#ea580c',
  '#65a30d',
  '#7c3aed',
  '#db2777',
  '#0891b2',
];

export function presenceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export function presenceInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/** 로그인하지 않은 방문자도 탭을 새로고침해도 같은 사람으로 보이게 한다 */
function guestId(): string {
  try {
    const saved = localStorage.getItem(GUEST_ID_KEY);
    if (saved) return saved;
    const next = `guest-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_ID_KEY, next);
    return next;
  } catch {
    return `guest-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function resolvePresenceIdentity(
  user: { id: string; email?: string | null } | null | undefined,
  guestLabel: string,
): PresenceIdentity {
  if (user?.id) {
    const handle = user.email?.split('@')[0]?.trim();
    return { id: user.id, name: handle || guestLabel };
  }
  const id = guestId();
  return { id, name: guestLabel };
}

/**
 * 여행 채널에 참여하고 조회자 목록이 바뀔 때마다 콜백을 부른다.
 * 반환된 함수를 호출하면 채널에서 나간다.
 */
export function joinTripPresence(
  tripId: string,
  me: PresenceIdentity,
  onChange: (viewers: PresenceViewer[]) => void,
): () => void {
  const sb = getSupabase();
  if (!sb || !tripId) return () => {};

  const channel = sb.channel(`trip-presence:${tripId}`, {
    config: { presence: { key: me.id } },
  });

  const sync = () => {
    const state = channel.presenceState<{ name?: string }>();
    const viewers = Object.entries(state).map(([id, metas]) => ({
      id,
      name: metas[0]?.name?.trim() || me.name,
      color: presenceColor(id),
      isSelf: id === me.id,
    }));
    // 본인을 항상 맨 앞에 두어 아바타 위치가 흔들리지 않게 한다
    viewers.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    onChange(viewers);
  };

  channel
    .on('presence', { event: 'sync' }, sync)
    .on('presence', { event: 'join' }, sync)
    .on('presence', { event: 'leave' }, sync)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ name: me.name });
      }
    });

  return () => {
    void sb.removeChannel(channel);
  };
}
