/**
 * 동행자 후보 투표 — N06(모바일 UX 리포트 2026-09-13).
 *
 * 공동편집은 "누가 뭘 담았나"까지만 알려준다. 담긴 후보 중 **뭘 정말 갈지**는
 * 채팅으로 정해야 했다 — 그 왕복을 줄이려고 핀마다 "가고 싶음 / 보류"를 남기게
 * 한다. 결정 자체는 여전히 소유자가 한다(필수 표시·삭제). 이 모듈은 표를
 * 세어 보여주는 데까지다.
 *
 * 저장소는 `trip_pin_votes`(투표자마다 한 행) — 핀 data에 넣으면 동시 투표가
 * 서로 덮어쓴다(마이그레이션 20260915120000 주석 참고).
 */
import { getSupabase, isSupabaseConfigured } from './supabase';

export type PinVote = 'want' | 'hold';

export interface PinVoteTally {
  want: string[]; // user ids
  hold: string[];
}

export type VotesByPlace = Record<string, PinVoteTally>;

interface VoteRow {
  place_id: string;
  user_id: string;
  vote: PinVote;
}

function tally(rows: VoteRow[]): VotesByPlace {
  const out: VotesByPlace = {};
  for (const r of rows) {
    const t = (out[r.place_id] ??= { want: [], hold: [] });
    t[r.vote].push(r.user_id);
  }
  return out;
}

export async function listTripVotes(tripId: string): Promise<VotesByPlace> {
  const sb = getSupabase();
  if (!sb || !tripId) return {};
  const { data, error } = await sb
    .from('trip_pin_votes')
    .select('place_id, user_id, vote')
    .eq('trip_id', tripId);
  if (error || !data) return {};
  return tally(data as VoteRow[]);
}

/** null이면 표를 거둔다. 같은 표를 다시 누르면 호출부가 null로 보낸다(토글). */
export async function setTripVote(
  tripId: string,
  placeId: string,
  userId: string,
  vote: PinVote | null
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !tripId || !userId) return;
  if (vote === null) {
    const { error } = await sb
      .from('trip_pin_votes')
      .delete()
      .eq('trip_id', tripId)
      .eq('place_id', placeId)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from('trip_pin_votes').upsert(
    { trip_id: tripId, place_id: placeId, user_id: userId, vote, updated_at: new Date().toISOString() },
    { onConflict: 'trip_id,place_id,user_id' }
  );
  if (error) throw error;
}

/**
 * 상대의 표가 바로 보이게. 이벤트마다 전체를 다시 읽는다 — 표는 한 여행에
 * 많아야 수십 개라 증분 병합보다 단순한 쪽이 낫다.
 */
export function subscribeTripVotes(
  tripId: string,
  onChange: (votes: VotesByPlace) => void
): () => void {
  const sb = getSupabase();
  if (!sb || !tripId || !isSupabaseConfigured) return () => {};
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void listTripVotes(tripId).then((v) => {
        if (!disposed) onChange(v);
      });
    }, 150);
  };
  const channel = sb
    .channel(`trip-votes:${tripId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_pin_votes', filter: `trip_id=eq.${tripId}` },
      refresh
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED' || status === 'CLOSED') return;
      console.warn(`투표 실시간 구독 실패(${status})`, err ?? '');
    });
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    void sb.removeChannel(channel);
  };
}
