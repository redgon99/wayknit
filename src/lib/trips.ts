import type {
  PinnedPlace,
  RouteOptions,
  GeneratedRoute,
  TripMaterial,
  TripTheme,
  FoodRestriction,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { normalizeTrip, DEFAULT_ROUTE_OPTIONS } from './tripRouteOptions';
import { computeTripCenter } from './tripGeo';
import i18n from './i18n';
import { normalizeLocale } from './locale';

export interface Trip {
  id: string;
  slug: string;
  title: string;
  totalDays: number;
  currentDay: number;
  pinnedByDay: Record<number, PinnedPlace[]>;
  /** 일차별 경로 옵션 (출발지·이동수단 등) */
  routeOptionsByDay: Record<number, RouteOptions>;
  /** 현재 일차 옵션 미러 (저장 호환) */
  routeOptions?: RouteOptions;
  generatedRouteByDay: Record<number, GeneratedRoute | null>;
  /** 여행 자료 (텍스트·사진·파일 메타) */
  materials?: TripMaterial[];
  createdAt: number;
  updatedAt: number;
  ownerId?: string;
  isPublic?: boolean;
  listedInPlaza?: boolean;
  plazaDisplayName?: string;
  plazaContactEmail?: string;
  plazaCenterLat?: number;
  plazaCenterLng?: number;
  plazaListedAt?: number;
  plazaLocale?: string;
  /** 관심 테마 (K-food, K-pop 등) */
  preferences?: TripTheme[];
  /** 음식 제약 */
  foodRestrictions?: FoodRestriction[];
  /** 여행 지역 (서울, 부산 등) */
  region?: string;
  /** 내가 소유자가 아니라 협업자로 접근 중일 때만 채워짐 (owner면 undefined) */
  collaboratorRole?: CollaboratorRole;
}

export type CollaboratorRole = 'editor' | 'viewer';

export interface TripCollaborator {
  userId: string;
  email: string | null;
  role: CollaboratorRole;
  createdAt: number;
}

export interface TripInvite {
  id: string;
  email: string;
  role: CollaboratorRole;
  createdAt: number;
}

export interface PlazaListing {
  id: string;
  slug: string;
  title: string;
  displayName: string | null;
  contactEmail: string | null;
  center: { lat: number; lng: number } | null;
  listedAt: number;
  totalDays: number;
  pinSummary: string;
  pinnedByDay: Record<number, PinnedPlace[]>;
  locale?: string | null;
}

export interface TripSummary {
  id: string;
  slug: string;
  title: string;
  updatedAt: number;
  totalDays: number;
  /** 내가 소유자가 아니라 협업자로 접근 중일 때만 채워짐 */
  collaboratorRole?: CollaboratorRole;
}

const LS_STORE = 'wayknit:trips-store:v2';
const LS_PLAZA_IMPORTED = 'wayknit:plaza-imported-ids';

interface LocalStore {
  activeId: string | null;
  trips: Trip[];
}

function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LS_STORE);
    if (!raw) return { activeId: null, trips: [] };
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      activeId: parsed.activeId ?? null,
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
    };
  } catch {
    return { activeId: null, trips: [] };
  }
}

function writeStore(store: LocalStore) {
  try {
    localStorage.setItem(LS_STORE, JSON.stringify(store));
  } catch (e) {
    console.warn('localStorage 저장 실패', e);
  }
}

function rowToTrip(data: {
  id: string;
  slug: string;
  title: string;
  total_days: number;
  current_day: number;
  payload: unknown;
  created_at: string;
  updated_at: string;
  owner_id?: string | null;
  is_public?: boolean | null;
  listed_in_plaza?: boolean | null;
  plaza_display_name?: string | null;
  plaza_contact_email?: string | null;
  plaza_center_lat?: number | null;
  plaza_center_lng?: number | null;
  plaza_listed_at?: string | null;
  plaza_locale?: string | null;
}, collaboratorRole?: CollaboratorRole): Trip {
  const payload = data.payload as {
    pinnedByDay?: Trip['pinnedByDay'];
    routeOptions?: RouteOptions;
    routeOptionsByDay?: Record<number, RouteOptions>;
    generatedRouteByDay?: Trip['generatedRouteByDay'];
    materials?: TripMaterial[];
  };
  return normalizeTrip({
    id: data.id,
    slug: data.slug,
    title: data.title,
    totalDays: data.total_days,
    currentDay: data.current_day,
    pinnedByDay: payload?.pinnedByDay ?? { 1: [] },
    routeOptionsByDay: payload?.routeOptionsByDay ?? {},
    routeOptions: payload?.routeOptions,
    generatedRouteByDay: payload?.generatedRouteByDay ?? {},
    materials: payload?.materials ?? [],
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    ownerId: data.owner_id ?? undefined,
    isPublic: data.is_public ?? false,
    listedInPlaza: data.listed_in_plaza ?? false,
    plazaDisplayName: data.plaza_display_name ?? undefined,
    plazaContactEmail: data.plaza_contact_email ?? undefined,
    plazaCenterLat: data.plaza_center_lat ?? undefined,
    plazaCenterLng: data.plaza_center_lng ?? undefined,
    plazaListedAt: data.plaza_listed_at
      ? new Date(data.plaza_listed_at).getTime()
      : undefined,
    plazaLocale: data.plaza_locale ?? undefined,
    collaboratorRole,
  });
}

const TRIP_SELECT =
  'id, slug, title, total_days, current_day, payload, created_at, updated_at, owner_id, is_public, listed_in_plaza, plaza_display_name, plaza_contact_email, plaza_center_lat, plaza_center_lng, plaza_listed_at, plaza_locale';

const PLAZA_LIST_SELECT =
  'id, slug, title, total_days, payload, listed_in_plaza, plaza_display_name, plaza_contact_email, plaza_center_lat, plaza_center_lng, plaza_listed_at, plaza_locale';

export function buildPlazaPinSummary(
  pinnedByDay: Record<number, PinnedPlace[]>,
  totalDays: number
): string {
  const parts: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const pins = pinnedByDay[d] ?? [];
    if (pins.length === 0) continue;
    const names = pins
      .slice(0, 3)
      .map((p) => p.name)
      .join(', ');
    const more = pins.length > 3 ? ` 외 ${pins.length - 3}곳` : '';
    parts.push(`${d}일차: ${names}${more}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '등록된 장소 없음';
}

function rowToPlazaListing(data: {
  id: string;
  slug: string;
  title: string;
  total_days: number;
  payload: unknown;
  plaza_display_name?: string | null;
  plaza_contact_email?: string | null;
  plaza_center_lat?: number | null;
  plaza_center_lng?: number | null;
  plaza_listed_at?: string | null;
  plaza_locale?: string | null;
}): PlazaListing {
  const payload = data.payload as { pinnedByDay?: Record<number, PinnedPlace[]> };
  const pinnedByDay = payload?.pinnedByDay ?? { 1: [] };
  const center =
    data.plaza_center_lat != null && data.plaza_center_lng != null
      ? { lat: data.plaza_center_lat, lng: data.plaza_center_lng }
      : null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    displayName: data.plaza_display_name ?? null,
    contactEmail: data.plaza_contact_email ?? null,
    center,
    listedAt: data.plaza_listed_at
      ? new Date(data.plaza_listed_at).getTime()
      : Date.now(),
    totalDays: data.total_days,
    pinSummary: buildPlazaPinSummary(pinnedByDay, data.total_days),
    pinnedByDay,
    locale: data.plaza_locale ?? 'ko',
  };
}

function readLocalPlazaImported(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_PLAZA_IMPORTED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeLocalPlazaImported(ids: Set<string>) {
  try {
    localStorage.setItem(LS_PLAZA_IMPORTED, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function applyPlazaPublish(
  trip: Trip,
  opts: { displayName?: string; email: string; listInPlaza: boolean }
): Trip {
  const base: Trip = {
    ...trip,
    isPublic: true,
    updatedAt: Date.now(),
  };
  if (!opts.listInPlaza) {
    return base;
  }
  const center = computeTripCenter(trip);
  const now = Date.now();
  return {
    ...base,
    listedInPlaza: true,
    plazaDisplayName: opts.displayName?.trim() || undefined,
    plazaContactEmail: opts.email.trim(),
    plazaCenterLat: center?.lat,
    plazaCenterLng: center?.lng,
    plazaListedAt: now,
    plazaLocale: normalizeLocale(i18n.language),
  };
}

/**
 * 내가 협업자로 접근 가능한 trip_id → role 맵.
 * wayknit_trips 조회에서 owner_id 필터를 뺀 만큼(RLS가 owner OR collaborator를
 * 이미 허용) 여기서 role만 UI 표시용으로 별도 조회한다.
 */
async function fetchCollaboratorRoles(userId: string): Promise<Map<string, CollaboratorRole>> {
  const sb = getSupabase();
  if (!sb) return new Map();
  const { data, error } = await sb
    .from('trip_collaborators')
    .select('trip_id, role')
    .eq('user_id', userId);
  if (error || !data) return new Map();
  return new Map(data.map((r) => [r.trip_id as string, r.role as CollaboratorRole]));
}

/**
 * "내 여행" 범위를 쿼리에서 명시적으로 좁힌다.
 *
 * RLS에 맡기면 안 된다. wayknit_trips에는 SELECT 정책이 4개 있고 PostgreSQL은
 * permissive 정책을 OR로 합치므로, 필터를 빼면 `public_slug_select`(is_public)와
 * `wayknit_trips_admin_select`(is_admin)까지 열려 남의 여행이 내 목록에 섞인다.
 * RLS는 "접근해도 되는가"를 정하고, 내 목록은 그보다 의도적으로 좁은 질의다.
 */
function collaboratorIdsOf(roles: Map<string, CollaboratorRole>): string[] {
  return [...roles.keys()];
}

async function listRemote(userId: string): Promise<TripSummary[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const roles = await fetchCollaboratorRoles(userId);
  const collabIds = collaboratorIdsOf(roles);

  const base = sb.from('wayknit_trips').select('id, slug, title, total_days, updated_at');
  const scoped =
    collabIds.length > 0
      ? base.or(`owner_id.eq.${userId},id.in.(${collabIds.join(',')})`)
      : base.eq('owner_id', userId);

  const { data, error } = await scoped.order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    totalDays: row.total_days,
    updatedAt: new Date(row.updated_at).getTime(),
    collaboratorRole: roles.get(row.id),
  }));
}

async function readRemoteById(userId: string, tripId: string): Promise<Trip | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const roles = await fetchCollaboratorRoles(userId);

  // 협업자로 등록된 여행이면 소유자 조건 없이, 아니면 내 것만.
  // 공개 여행 열람은 /trip/:slug 공유 페이지와 "끌어오기"가 담당한다.
  const base = sb.from('wayknit_trips').select(TRIP_SELECT).eq('id', tripId);
  const scoped = roles.has(tripId) ? base : base.eq('owner_id', userId);

  const { data, error } = await scoped.maybeSingle();
  if (error || !data) return null;
  return attachPins(rowToTrip(data, roles.get(tripId)), true);
}

async function readRemoteLatest(userId: string): Promise<Trip | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const roles = await fetchCollaboratorRoles(userId);
  const collabIds = collaboratorIdsOf(roles);

  // 범위를 좁히지 않으면 "전체에서 가장 최근 수정된 여행"이 잡혀,
  // 남의 여행이 앱을 열자마자 내 플래너로 열린다.
  const base = sb.from('wayknit_trips').select(TRIP_SELECT);
  const scoped =
    collabIds.length > 0
      ? base.or(`owner_id.eq.${userId},id.in.(${collabIds.join(',')})`)
      : base.eq('owner_id', userId);

  const { data, error } = await scoped
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return attachPins(rowToTrip(data, roles.get(data.id)), true);
}

async function readBySlugRemote(slug: string): Promise<Trip | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('wayknit_trips')
    .select(TRIP_SELECT)
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  if (error || !data) return null;
  return attachPins(rowToTrip(data));
}

/* ══════════════════════════════════════════════════════════════════════
 * 핀 행(trip_pins) — 공동편집 1단계
 *
 * 핀은 더 이상 payload에 저장하지 않는다. payload 통짜 upsert는 두 사람이
 * 같은 여행을 편집할 때 나중에 저장한 쪽이 상대 핀을 덮어써서 지웠다.
 * 핀 1개 = 행 1개로 쪼개고, 저장할 때 "이 클라이언트가 마지막으로 동기화한
 * 상태"와의 차이만 행 단위로 반영한다. 내가 모르는 상대 핀은 손대지 않으므로
 * 서로의 편집이 살아남는다.
 *
 * 기존 payload.pinnedByDay는 이전 시점 그대로 남겨뒀다(롤백용 백업).
 * 읽기는 trip_pins만 본다 — payload로 폴백하면 사용자가 핀을 전부 지웠을 때
 * 옛 백업이 되살아난다.
 * ══════════════════════════════════════════════════════════════════════ */

interface TripPinRow {
  day: number;
  place_id: string;
  position: number;
  data: PinnedPlace;
  created_by_email: string | null;
}

/**
 * 핀을 누가 넣었는지 — 핀 객체가 아니라 여기에 따로 둔다.
 *
 * PinnedPlace 에 얹으면 안 된다. 그 객체는 그대로 `trip_pins.data` jsonb 로
 * 저장되고 canonicalPin() 비교에도 쓰이므로,
 *   1. 이미 컬럼으로 존재하는 값이 jsonb 안에 중복 저장돼 시간이 지나면 어긋나고
 *   2. 내용은 그대로인데 작성자 필드만 달라도 "핀이 바뀌었다"로 잡혀
 *      불필요한 저장이 나간다 — 동시 편집 중이면 충돌 면적이 넓어진다.
 *
 * 키는 `${day}:${placeId}` (trip_pins 의 자연키에서 trip_id 를 뺀 것).
 */
const pinAuthorsByTrip = new Map<string, Record<string, string | null>>();

export function pinAuthorKey(day: number, placeId: string): string {
  return `${day}:${placeId}`;
}

/** 핀 작성자 이메일 맵. readPinsRemote 가 갱신하므로 핀 목록과 항상 같은 시점이다. */
export function getPinAuthors(tripId: string): Record<string, string | null> {
  return pinAuthorsByTrip.get(tripId) ?? {};
}

/**
 * 이 클라이언트가 마지막으로 원격과 맞춘 핀 상태. 저장 시 diff의 기준점이다.
 * 원격 DB의 현재 상태와 비교하면 안 된다 — 상대가 방금 추가한 핀이
 * "내가 지운 것"으로 보여 그대로 삭제된다.
 */
const pinBaselines = new Map<string, Record<number, PinnedPlace[]>>();

/** 키 순서에 흔들리지 않는 비교용 직렬화 */
function canonicalPin(pin: PinnedPlace): string {
  return JSON.stringify(
    Object.keys(pin)
      .sort()
      .map((k) => [k, (pin as unknown as Record<string, unknown>)[k]])
  );
}

function clonePinnedByDay(src: Record<number, PinnedPlace[]>): Record<number, PinnedPlace[]> {
  const out: Record<number, PinnedPlace[]> = {};
  for (const [day, list] of Object.entries(src)) out[Number(day)] = [...(list ?? [])];
  return out;
}

/**
 * @param includeAuthors 작성자 이메일까지 읽을지.
 *   공개 여행을 구경하는 비로그인 열람자는 이 컬럼을 읽을 권한이 없다
 *   (anon 에서 회수했다). 요청에 넣으면 조회 전체가 실패해 핀이 통째로
 *   안 보이므로, 볼 자격이 있을 때만 넣는다.
 */
async function readPinsRemote(
  tripId: string,
  includeAuthors = false
): Promise<Record<number, PinnedPlace[]> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // supabase-js 는 select 문자열의 리터럴 타입으로 결과를 추론한다.
  // 삼항으로 넘기면 유니온이 되어 파싱에 실패하므로 string 으로 낮춘다.
  const columns: string = includeAuthors
    ? 'day, place_id, position, data, created_by_email'
    : 'day, place_id, position, data';
  const { data, error } = await sb
    .from('trip_pins')
    .select(columns)
    .eq('trip_id', tripId)
    .order('day', { ascending: true })
    .order('position', { ascending: true })
    // position은 클라이언트가 자기 관점으로 매기므로 동시 편집 중엔 겹치거나
    // 틈이 생긴다. 겹쳤을 때 정렬이 클라이언트마다 달라지지 않도록 2차 기준을 둔다.
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('핀 조회 실패 — payload 값으로 진행한다', error);
    return null;
  }
  const byDay: Record<number, PinnedPlace[]> = {};
  const authors: Record<string, string | null> = {};
  for (const row of (data ?? []) as unknown as TripPinRow[]) {
    (byDay[row.day] ??= []).push({ ...row.data, id: row.place_id, day: row.day });
    authors[pinAuthorKey(row.day, row.place_id)] = row.created_by_email ?? null;
  }
  if (includeAuthors) pinAuthorsByTrip.set(tripId, authors);
  // order 필드는 화면이 쓰는 표시용 번호 — 행 순서대로 다시 매긴다.
  for (const list of Object.values(byDay)) list.forEach((p, i) => (p.order = i + 1));
  return byDay;
}

/** 여러 여행의 핀을 한 번에 읽는다 (목록 화면의 N+1 방지). */
async function readPinsForTrips(
  tripIds: string[]
): Promise<Map<string, Record<number, PinnedPlace[]>>> {
  const out = new Map<string, Record<number, PinnedPlace[]>>();
  const sb = getSupabase();
  if (!sb || tripIds.length === 0) return out;
  const { data, error } = await sb
    .from('trip_pins')
    .select('trip_id, day, place_id, position, data')
    .in('trip_id', tripIds)
    .order('day', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('핀 목록 조회 실패', error);
    return out;
  }
  for (const row of (data ?? []) as Array<TripPinRow & { trip_id: string }>) {
    const byDay = out.get(row.trip_id) ?? {};
    (byDay[row.day] ??= []).push({ ...row.data, id: row.place_id, day: row.day });
    out.set(row.trip_id, byDay);
  }
  for (const byDay of out.values()) {
    for (const list of Object.values(byDay)) list.forEach((p, i) => (p.order = i + 1));
  }
  return out;
}

/** 여행 한 건에 핀 행을 붙이고, 이후 저장 diff의 기준점을 기록한다. */
/* ── 2단계: 실시간 반영 ────────────────────────────────────────────────
 *
 * 원격 변경 알림이 오면 핀을 다시 읽어 화면에 반영한다. 그런데 그냥 덮어쓰면
 * 아직 저장 전(700ms 디바운스 안)인 내 편집이 사라진다. 그래서 3-way 병합을 한다:
 *
 *   기준점(마지막 동기화) ── 내 미저장 편집 ──▶ 지금 화면
 *          │
 *          └── 상대 편집 ──▶ 방금 읽은 원격
 *
 *   병합 결과 = 원격 + (내 미저장 편집)
 *
 * 병합 뒤 기준점을 "방금 읽은 원격"으로 옮긴다. 그러면 다음 저장 때
 * syncPins의 diff가 정확히 내 미저장 편집만 집어낸다.
 * ─────────────────────────────────────────────────────────────────── */

interface PendingPinEdits {
  /** 내가 추가했거나 내용을 바꾼 핀 (일차별) */
  upserts: Map<number, PinnedPlace[]>;
  /** 내가 지운 핀 id (일차별) */
  removals: Map<number, Set<string>>;
}

/** 기준점 대비 지금 화면에서 내가 한 편집 */
function pendingPinEdits(
  baseline: Record<number, PinnedPlace[]>,
  local: Record<number, PinnedPlace[]>
): PendingPinEdits {
  const upserts = new Map<number, PinnedPlace[]>();
  const removals = new Map<number, Set<string>>();
  const days = new Set<number>([...Object.keys(baseline), ...Object.keys(local)].map(Number));
  for (const day of days) {
    const before = new Map((baseline[day] ?? []).map((p) => [p.id, p]));
    const after = local[day] ?? [];
    const added = after.filter((p) => {
      const prev = before.get(p.id);
      return !prev || canonicalPin(prev) !== canonicalPin(p);
    });
    if (added.length > 0) upserts.set(day, added);
    const afterIds = new Set(after.map((p) => p.id));
    const gone = [...before.keys()].filter((id) => !afterIds.has(id));
    if (gone.length > 0) removals.set(day, new Set(gone));
  }
  return { upserts, removals };
}

/** 원격 상태 위에 내 미저장 편집을 다시 얹는다. */
function applyPendingEdits(
  remote: Record<number, PinnedPlace[]>,
  pending: PendingPinEdits,
  localOrder: Record<number, PinnedPlace[]>
): Record<number, PinnedPlace[]> {
  const out: Record<number, PinnedPlace[]> = {};
  const days = new Set<number>([
    ...Object.keys(remote),
    ...pending.upserts.keys(),
    ...pending.removals.keys(),
  ].map(Number));

  for (const day of days) {
    const removed = pending.removals.get(day) ?? new Set<string>();
    const byId = new Map<string, PinnedPlace>();
    for (const pin of remote[day] ?? []) {
      if (!removed.has(pin.id)) byId.set(pin.id, pin);
    }
    // 내 편집이 원격보다 우선한다 — 아직 저장 안 됐을 뿐 사용자가 방금 한 행동이다.
    for (const pin of pending.upserts.get(day) ?? []) byId.set(pin.id, pin);

    // 순서는 내 화면 순서를 기준으로 하고, 내가 모르던 상대 핀은 뒤에 붙인다.
    const localIds = (localOrder[day] ?? []).map((p) => p.id);
    const ordered: PinnedPlace[] = [];
    for (const id of localIds) {
      const pin = byId.get(id);
      if (pin) { ordered.push(pin); byId.delete(id); }
    }
    for (const pin of byId.values()) ordered.push(pin);
    out[day] = ordered.map((p, i) => ({ ...p, order: i + 1 }));
  }
  return out;
}

function samePinnedByDay(a: Record<number, PinnedPlace[]>, b: Record<number, PinnedPlace[]>): boolean {
  const days = new Set<number>([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const day of days) {
    const la = a[day] ?? [], lb = b[day] ?? [];
    if (la.length !== lb.length) return false;
    for (let i = 0; i < la.length; i++) {
      if (canonicalPin(la[i]) !== canonicalPin(lb[i])) return false;
    }
  }
  return true;
}

/**
 * 이 여행의 핀 변경을 실시간으로 받아 병합 결과를 돌려준다.
 * `getLocal`은 항상 최신 화면 상태를 돌려줘야 한다(ref 등으로 넘길 것).
 * 반환값은 구독 해제 함수.
 */
export function subscribeTripPins(
  tripId: string,
  getLocal: () => Record<number, PinnedPlace[]>,
  onMerged: (next: Record<number, PinnedPlace[]>) => void
): () => void {
  const sb = getSupabase();
  if (!sb || !tripId) return () => {};

  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const refresh = async () => {
    if (disposed) return;
    const remote = await readPinsRemote(tripId, true);
    if (disposed || !remote) return;
    const local = getLocal();
    const pending = pendingPinEdits(pinBaselines.get(tripId) ?? {}, local);
    const merged = applyPendingEdits(remote, pending, local);
    // 기준점을 원격으로 옮긴다 — 다음 저장의 diff가 내 미저장 편집만 담게 된다.
    pinBaselines.set(tripId, clonePinnedByDay(remote));
    const changed = !samePinnedByDay(merged, local);
    // 내 저장이 되돌아온 에코면 화면이 그대로다 — 불필요한 리렌더를 막는다.
    if (changed) onMerged(merged);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    // 한 번의 저장이 여러 행을 건드리면 이벤트도 여러 개 온다 — 몰아서 한 번만 읽는다.
    timer = setTimeout(() => void refresh(), 350);
  };

  const channel = sb
    .channel(`trip-pins:${tripId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_pins', filter: `trip_id=eq.${tripId}` },
      () => schedule()
    )
    // 구독은 조용히 죽을 수 있다. 그러면 화면은 멀쩡해 보이는데 상대 편집만
    // 영영 안 들어온다 — 알 방법이 없으니 실패 상태만이라도 남긴다.
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED' || status === 'CLOSED') return;
      console.warn(`핀 실시간 구독 실패(${status})`, err ?? '');
    });

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    void sb.removeChannel(channel);
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * 일차 상태(trip_day_state) · 여행 자료(trip_materials) — 공동편집 5단계
 *
 * §5-2에서 핀만 먼저 행으로 쪼갰고, `routeOptionsByDay`·`generatedRouteByDay`·
 * `materials`는 payload jsonb 한 덩어리로 남아 있었다. 그래서 핀에서 고쳤던
 * last-write-wins가 이 셋에는 그대로 있었다 — 두 사람이 각자 동선을 만들면
 * 나중에 저장한 쪽이 상대 것을 지웠다.
 *
 * 쪼개는 단위:
 *   자료   → 행 1개 = 자료 1개 (항목마다 id가 있다. 핀과 같다)
 *   일차   → 행 1개 = (여행, 일차). 동선은 "그 일차 전체를 다시 계산한 결과"라
 *            부분 병합이 의미를 갖지 않는다. 일차 단위면 서로 다른 날을 만지는
 *            흔한 경우에 충돌이 사라지고, 같은 날을 동시에 생성하는 것은
 *            나중 것이 이기는 게 의미상 맞다.
 *
 * 읽기는 새 테이블만 본다. payload로 폴백하면 사용자가 자료를 전부 지웠을 때
 * 옛 백업이 되살아난다 — 핀에서와 같은 판단이다.
 * ══════════════════════════════════════════════════════════════════════ */

interface DayStateRow {
  day: number;
  route_options: RouteOptions | null;
  generated_route: GeneratedRoute | null;
}

interface MaterialRow {
  material_id: string;
  data: TripMaterial;
}

interface DayStateSnapshot {
  routeOptionsByDay: Record<number, RouteOptions>;
  generatedRouteByDay: Record<number, GeneratedRoute | null>;
}

/**
 * 마지막으로 원격과 맞춘 상태. 저장 시 diff의 기준점이다.
 * 핀과 같은 이유로 원격의 "지금" 상태와 비교하면 안 된다 — 상대가 방금 만든
 * 동선이 "내가 지운 것"으로 보인다.
 *
 * 값은 정규화된 JSON 문자열로 들고 있는다. 원본 객체를 들고 있으면 화면 쪽에서
 * 같은 참조를 변형했을 때 기준점까지 함께 바뀌어 diff가 항상 비어 버린다.
 */
const dayStateBaselines = new Map<string, Map<number, string>>();
const materialBaselines = new Map<string, Map<string, string>>();

/** 키 순서에 흔들리지 않는 비교용 직렬화 (canonicalPin과 같은 방식) */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

/** 한 일차 행의 비교 키 — 옵션과 동선을 함께 본다 */
function dayStateKey(options: RouteOptions | undefined, route: GeneratedRoute | null): string {
  return `${canonicalJson(options ?? null)}|${canonicalJson(route ?? null)}`;
}

function snapshotDayState(snap: DayStateSnapshot): Map<number, string> {
  const out = new Map<number, string>();
  const days = new Set<number>([
    ...Object.keys(snap.routeOptionsByDay).map(Number),
    ...Object.keys(snap.generatedRouteByDay).map(Number),
  ]);
  for (const day of days) {
    out.set(day, dayStateKey(snap.routeOptionsByDay[day], snap.generatedRouteByDay[day] ?? null));
  }
  return out;
}

async function readDayStateRemote(tripId: string): Promise<DayStateSnapshot | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('trip_day_state')
    .select('day, route_options, generated_route')
    .eq('trip_id', tripId)
    .order('day', { ascending: true });
  if (error || !data) return null;

  const routeOptionsByDay: Record<number, RouteOptions> = {};
  const generatedRouteByDay: Record<number, GeneratedRoute | null> = {};
  for (const row of data as unknown as DayStateRow[]) {
    if (row.route_options) routeOptionsByDay[row.day] = row.route_options;
    // null도 담는다 — "그 일차는 동선이 없다"는 것도 상태다.
    generatedRouteByDay[row.day] = row.generated_route ?? null;
  }
  return { routeOptionsByDay, generatedRouteByDay };
}

async function readMaterialsRemote(tripId: string): Promise<TripMaterial[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('trip_materials')
    .select('material_id, data')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error || !data) return null;
  return (data as unknown as MaterialRow[]).map((r) => r.data);
}

/**
 * 기준점 대비 바뀐 일차만 쓴다.
 * 상대가 그 사이에 만든 다른 일차의 동선은 diff에 안 잡히므로 건드리지 않는다.
 */
async function syncDayState(trip: Trip, userId: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const baseline = dayStateBaselines.get(trip.id) ?? new Map<number, string>();
  const next = snapshotDayState({
    routeOptionsByDay: trip.routeOptionsByDay ?? {},
    generatedRouteByDay: trip.generatedRouteByDay ?? {},
  });

  const upserts: Array<Record<string, unknown>> = [];
  for (const [day, key] of next) {
    if (baseline.get(day) === key) continue;
    upserts.push({
      trip_id: trip.id,
      day,
      route_options: trip.routeOptionsByDay?.[day] ?? null,
      generated_route: trip.generatedRouteByDay?.[day] ?? null,
      updated_by: userId,
    });
  }
  const removedDays = [...baseline.keys()].filter((d) => !next.has(d));

  if (upserts.length > 0) {
    const { error } = await sb
      .from('trip_day_state')
      .upsert(upserts, { onConflict: 'trip_id,day' });
    if (error) throw error;
  }
  if (removedDays.length > 0) {
    const { error } = await sb
      .from('trip_day_state')
      .delete()
      .eq('trip_id', trip.id)
      .in('day', removedDays);
    if (error) throw error;
  }

  dayStateBaselines.set(trip.id, next);
}

/** 기준점 대비 바뀐 자료만 행 단위로 반영한다 (핀과 같은 방식). */
async function syncMaterials(trip: Trip, userId: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const baseline = materialBaselines.get(trip.id) ?? new Map<string, string>();
  const list = trip.materials ?? [];
  const next = new Map<string, string>();
  const upserts: Array<Record<string, unknown>> = [];

  for (const m of list) {
    const key = canonicalJson(m);
    next.set(m.id, key);
    if (baseline.get(m.id) === key) continue;
    upserts.push({
      trip_id: trip.id,
      material_id: m.id,
      data: m,
      ...(baseline.has(m.id) ? {} : { created_by: userId }),
      updated_by: userId,
    });
  }
  const removed = [...baseline.keys()].filter((id) => !next.has(id));

  if (upserts.length > 0) {
    const { error } = await sb
      .from('trip_materials')
      .upsert(upserts, { onConflict: 'trip_id,material_id' });
    if (error) throw error;
  }
  if (removed.length > 0) {
    const { error } = await sb
      .from('trip_materials')
      .delete()
      .eq('trip_id', trip.id)
      .in('material_id', removed);
    if (error) throw error;
  }

  materialBaselines.set(trip.id, next);
}

/**
 * 여행 본체 행에 붙어 있지 않은 것들(핀·일차 상태·자료)을 한 번에 읽어 붙인다.
 * 셋은 서로를 기다릴 이유가 없으므로 병렬로 나간다.
 */
async function attachPins(trip: Trip, includeAuthors = false): Promise<Trip> {
  const [pins, dayState, materials] = await Promise.all([
    readPinsRemote(trip.id, includeAuthors),
    readDayStateRemote(trip.id),
    readMaterialsRemote(trip.id),
  ]);

  const pinnedByDay = pins ?? trip.pinnedByDay;
  pinBaselines.set(trip.id, clonePinnedByDay(pinnedByDay));

  // 조회가 실패했으면 기준점을 세우지 않는다. 빈 값으로 기준을 잡으면
  // 다음 저장이 "전부 지워졌다"고 판단해 원격 행을 실제로 지운다.
  const routeOptionsByDay = dayState?.routeOptionsByDay ?? trip.routeOptionsByDay;
  const generatedRouteByDay = dayState?.generatedRouteByDay ?? trip.generatedRouteByDay;
  if (dayState) {
    dayStateBaselines.set(trip.id, snapshotDayState(dayState));
  } else {
    dayStateBaselines.delete(trip.id);
  }

  const nextMaterials = materials ?? trip.materials ?? [];
  if (materials) {
    materialBaselines.set(
      trip.id,
      new Map(materials.map((m) => [m.id, canonicalJson(m)]))
    );
  } else {
    materialBaselines.delete(trip.id);
  }

  return {
    ...trip,
    pinnedByDay,
    routeOptionsByDay,
    generatedRouteByDay,
    materials: nextMaterials,
  };
}

/**
 * 기준점 대비 바뀐 핀만 행 단위로 반영한다.
 * 상대가 그 사이에 넣은 핀은 diff에 안 잡히므로 건드리지 않는다.
 */
async function syncPins(trip: Trip, userId: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const baseline = pinBaselines.get(trip.id) ?? {};
  const next = trip.pinnedByDay ?? {};
  const days = new Set<number>([...Object.keys(baseline), ...Object.keys(next)].map(Number));

  const upserts: Array<Record<string, unknown>> = [];
  const deletions: Array<{ day: number; placeId: string }> = [];

  for (const day of days) {
    const beforeList = baseline[day] ?? [];
    const afterList = next[day] ?? [];
    const before = new Map(beforeList.map((p) => [p.id, p]));
    const after = new Map(afterList.map((p) => [p.id, p]));

    afterList.forEach((pin, idx) => {
      const prev = before.get(pin.id);
      const position = idx + 1;
      // 순서가 그대로이고 내용도 같으면 보내지 않는다 — 상대와의 충돌 면적을 줄인다.
      if (prev && canonicalPin(prev) === canonicalPin(pin) && beforeList.indexOf(prev) + 1 === position) {
        return;
      }
      upserts.push({
        trip_id: trip.id,
        day,
        place_id: pin.id,
        position,
        data: pin,
        ...(prev ? {} : { created_by: userId }),
        updated_by: userId,
      });
    });

    for (const id of before.keys()) {
      if (!after.has(id)) deletions.push({ day, placeId: id });
    }
  }

  if (upserts.length > 0) {
    const { error } = await sb
      .from('trip_pins')
      .upsert(upserts, { onConflict: 'trip_id,day,place_id' });
    if (error) throw error;
  }
  for (const [day, ids] of groupDeletionsByDay(deletions)) {
    const { error } = await sb
      .from('trip_pins')
      .delete()
      .eq('trip_id', trip.id)
      .eq('day', day)
      .in('place_id', ids);
    if (error) throw error;
  }

  pinBaselines.set(trip.id, clonePinnedByDay(next));
}

function groupDeletionsByDay(
  deletions: Array<{ day: number; placeId: string }>
): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const d of deletions) {
    const list = out.get(d.day);
    if (list) list.push(d.placeId);
    else out.set(d.day, [d.placeId]);
  }
  return out;
}

async function writeRemote(trip: Trip): Promise<void> {
  const sb = getSupabase();
  if (!sb || !trip.ownerId) return;
  const normalized = normalizeTrip(trip);
  // payload는 이제 비어 있다. 여기 있던 것이 전부 자기 행으로 옮겨갔다:
  //   pinnedByDay          → trip_pins        (공동편집 1단계)
  //   routeOptionsByDay    ┐
  //   generatedRouteByDay  ├→ trip_day_state  (5단계)
  //   materials            → trip_materials   (5단계)
  //
  // 컬럼 자체는 남긴다 — NOT NULL 이고, 나중에 여행 본체에 붙는 작은 값이
  // 생기면 다시 쓸 자리다. 기존 값은 `20260908200000` 마이그레이션이 새 테이블로
  // 옮긴 뒤이고, 되돌릴 근거는 `wayknit_trips_payload_backup_20260908` 에 있다.
  //
  // 부수 효과: 자동저장이 700ms마다 다시 쓰던 덩어리가 사라졌다(실측 최대 151kB).
  // 이제 저장은 바뀐 일차·자료·핀의 행만 건드린다.
  const payload = {};
  // 협업자는 upsert를 쓸 수 없다.
  //
  // `.upsert()`는 INSERT ... ON CONFLICT DO UPDATE 다. 행이 이미 있어서
  // 결과적으로 UPDATE가 되더라도 PostgreSQL은 INSERT 정책의 WITH CHECK를
  // 먼저 본다. wayknit_trips의 정책은 이렇게 갈린다:
  //   owner_insert  WITH CHECK (auth.uid() = owner_id)          ← 소유자만
  //   owner_update  USING/CHECK (auth.uid() = owner_id OR is_trip_editor(id))
  // 그래서 협업자가 저장하면 UPDATE는 허용되는데 INSERT에서 42501로 막혀
  // "new row violates row-level security policy" 가 났다. 그리고 이 함수는
  // 여기서 throw 하므로 아래 syncPins()까지 못 가서 — 협업자가 찍은 핀이
  // 서버에 아예 안 써졌고, 소유자 화면에 Realtime 이벤트도 오지 않았다.
  // (협업자 본인 화면에만 보였던 이유다.)
  //
  // 협업자 경로는 순수 UPDATE로 보낸다. 여행 행을 새로 만드는 건 소유자의
  // 일이므로 이게 기능적으로도 맞다. 쓰는 컬럼도 공동편집이 실제로 바꾸는
  // 것만 남긴다 — 소유권(owner_id·slug)과 공개 설정(is_public·plaza_*)은
  // 소유자만 정한다. current_day는 보는 사람마다 다른 값이라 협업자가
  // 소유자의 날짜를 끌고 가지 않도록 뺀다.
  const isCollaborator = Boolean(trip.collaboratorRole);
  if (isCollaborator) {
    if (trip.collaboratorRole === 'viewer') return;
    const { data, error } = await sb
      .from('wayknit_trips')
      .update({
        title: trip.title,
        total_days: trip.totalDays,
        payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id)
      .select('id');
    if (error) throw error;
    // 0행이면 RLS나 삭제로 조용히 아무것도 안 써진 것이다. 저장된 척하는
    // 것보다 시끄럽게 실패하는 편이 낫다.
    if (!data || data.length === 0) {
      throw new Error(`협업 저장이 어떤 행에도 적용되지 않았다 (trip ${trip.id})`);
    }
    await syncRows(normalized);
    return;
  }

  const { error } = await sb.from('wayknit_trips').upsert(
    {
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      total_days: trip.totalDays,
      current_day: trip.currentDay,
      payload,
      owner_id: trip.ownerId,
      is_public: trip.isPublic ?? false,
      listed_in_plaza: trip.listedInPlaza ?? false,
      plaza_display_name: trip.plazaDisplayName ?? null,
      plaza_contact_email: trip.plazaContactEmail ?? null,
      plaza_center_lat: trip.plazaCenterLat ?? null,
      plaza_center_lng: trip.plazaCenterLng ?? null,
      plaza_listed_at: trip.plazaListedAt
        ? new Date(trip.plazaListedAt).toISOString()
        : null,
      plaza_locale: trip.plazaLocale ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;

  // 여행 행이 확실히 존재한 뒤에 자식 행을 쓴다 — 셋 다 trip_id가 FK다.
  await syncRows(normalized);
}

/**
 * 여행 본체 밖에 사는 것들을 한 번에 맞춘다.
 *
 * 셋은 서로 독립이지만 **순차로 보낸다.** 병렬로 던지면 하나가 실패했을 때
 * 나머지가 이미 나가 있어, 어디까지 반영됐는지 알 수 없는 상태가 된다.
 * 저장은 700ms 디바운스라 왕복 몇 번이 문제가 되지 않는다.
 */
async function syncRows(normalized: Trip): Promise<void> {
  const actorId = await currentUserId();
  await syncPins(normalized, actorId);
  await syncDayState(normalized, actorId);
  await syncMaterials(normalized, actorId);
}

/**
 * 지금 로그인한 사람.
 *
 * `trip.ownerId`를 쓰면 안 된다 — 협업자가 저장할 때도 소유자 id가 찍혀
 * 자료를 누가 올렸는지가 통째로 틀어진다. 핀은 DB 트리거
 * (`stamp_trip_pin_author`)가 `auth.uid()`로 덮어써서 드러나지 않았지만,
 * `trip_day_state`·`trip_materials`에는 그런 트리거가 없다.
 *
 * `getSession()`은 로컬 저장소만 본다 — 네트워크 왕복이 아니다.
 */
async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

// =============================================
// 공동편집 협업자 관리
// =============================================

export async function listCollaborators(tripId: string): Promise<TripCollaborator[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('trip_collaborators')
    .select('user_id, email, role, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    userId: r.user_id,
    email: r.email,
    role: r.role as CollaboratorRole,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

/**
 * 협업자가 있는지만 알면 되는 곳을 위한 가벼운 조회.
 *
 * presence 채널을 열지 말지 정하는 데 쓴다 — 목록 자체는 필요 없고 0인지
 * 아닌지만 보면 되므로 `head: true`로 행을 받지 않는다. 소유자만 이 질문을
 * 한다(협업자는 자기 `collaboratorRole`만 봐도 공유 중임을 안다).
 */
export async function hasCollaborators(tripId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { count, error } = await sb
    .from('trip_collaborators')
    .select('user_id', { count: 'exact', head: true })
    .eq('trip_id', tripId);
  if (error) return false;
  return (count ?? 0) > 0;
}

/** 초대 링크. 아직 이메일 발송 수단이 없어 소유자가 직접 전달한다. */
/**
 * 초대 링크.
 *
 * 초대받은 주소를 함께 실어 로그인창에 미리 채워준다 — 초대는 그 주소로
 * 로그인해야만 연결되는데, 미리보기 RPC는 주소를 마스킹해 내려주므로
 * (anon도 호출할 수 있어서) 받는 쪽에서는 전체 주소를 알 길이 없다.
 * 링크를 가진 사람은 곧 초대받은 본인이라 새로 드러나는 정보는 없다.
 */
export function buildInviteLink(inviteId: string, email?: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({ invite: inviteId });
  if (email) params.set('email', email);
  return `${origin}/plan?${params.toString()}`;
}

export interface TripInvitePreview {
  tripTitle: string;
  role: CollaboratorRole;
  accepted: boolean;
  /** 마스킹된 주소 — 어느 계정으로 로그인해야 하는지 알아볼 정도만 */
  invitedEmail: string | null;
  inviterEmail: string | null;
}

/**
 * 초대 링크로 들어온 사람에게 보여줄 최소 정보.
 * trip_invites는 소유자만 읽을 수 있어 SECURITY DEFINER 함수를 거친다.
 * 링크만으로는 권한이 생기지 않는다 — 실제 연결은 로그인 계정의 이메일이
 * 초대 이메일과 일치할 때 accept_trip_invites()가 수행한다.
 */
export async function fetchInvitePreview(inviteId: string): Promise<TripInvitePreview | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_trip_invite_preview', { p_invite_id: inviteId });
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    tripTitle: (row.trip_title as string) ?? '',
    role: (row.role as CollaboratorRole) ?? 'editor',
    accepted: Boolean(row.accepted),
    invitedEmail: (row.invited_email as string | null) ?? null,
    inviterEmail: (row.inviter_email as string | null) ?? null,
  };
}

export async function listPendingInvites(tripId: string): Promise<TripInvite[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('trip_invites')
    .select('id, email, role, created_at')
    .eq('trip_id', tripId)
    .is('accepted_at', null)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as CollaboratorRole,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

/** 이메일로 편집/보기 권한 초대 — 이미 가입된 이메일이면 바로 collaborator로, 아니면 보류 초대로 남는다 */
export async function inviteCollaboratorByEmail(
  tripId: string,
  email: string,
  role: CollaboratorRole,
  invitedBy: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 미설정');
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await sb.from('trip_invites').insert({
    trip_id: tripId,
    email: normalizedEmail,
    role,
    invited_by: invitedBy,
  });
  if (error) throw error;
}

export async function updateCollaboratorRole(
  tripId: string,
  userId: string,
  role: CollaboratorRole
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 미설정');
  const { error } = await sb
    .from('trip_collaborators')
    .update({ role })
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeCollaborator(tripId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 미설정');
  const { error } = await sb
    .from('trip_collaborators')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 미설정');
  const { error } = await sb.from('trip_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

/** 로그인 직후 호출 — 내 이메일로 온 보류 초대를 협업자로 승격시킨다. 수락된 개수를 반환 */
export async function acceptPendingInvites(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('accept_trip_invites');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

async function listPlazaRemote(localeFilter?: string | null): Promise<PlazaListing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let query = sb
    .from('wayknit_trips')
    .select(PLAZA_LIST_SELECT)
    .eq('listed_in_plaza', true)
    .eq('is_public', true);
  if (localeFilter) {
    // Legacy plaza rows may still have plaza_locale = 'zh'
    if (localeFilter === 'zh-CN') {
      query = query.in('plaza_locale', ['zh-CN', 'zh']);
    } else {
      query = query.eq('plaza_locale', localeFilter);
    }
  }
  const { data, error } = await query.order('plaza_listed_at', { ascending: false });
  if (error || !data) return [];
  const listings = data.map((row) => rowToPlazaListing(row));
  // 핀은 payload가 아니라 trip_pins가 진실이다. 목록이므로 건별 조회(N+1) 대신
  // 한 번에 받아 붙인다.
  const pinsByTrip = await readPinsForTrips(listings.map((l) => l.id));
  return listings.map((l) => {
    const pinnedByDay = pinsByTrip.get(l.id);
    if (!pinnedByDay) return l;
    return {
      ...l,
      pinnedByDay,
      pinSummary: buildPlazaPinSummary(pinnedByDay, l.totalDays),
    };
  });
}

function listPlazaLocal(): PlazaListing[] {
  const store = readStore();
  return store.trips
    .filter((t) => t.isPublic && t.listedInPlaza)
    .sort((a, b) => (b.plazaListedAt ?? 0) - (a.plazaListedAt ?? 0))
    .map((t) => {
      const center =
        t.plazaCenterLat != null && t.plazaCenterLng != null
          ? { lat: t.plazaCenterLat, lng: t.plazaCenterLng }
          : computeTripCenter(t);
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        displayName: t.plazaDisplayName ?? null,
        contactEmail: t.plazaContactEmail ?? null,
        center,
        listedAt: t.plazaListedAt ?? t.updatedAt,
        totalDays: t.totalDays,
        pinSummary: buildPlazaPinSummary(t.pinnedByDay, t.totalDays),
        pinnedByDay: t.pinnedByDay,
        locale: t.plazaLocale ?? 'ko',
      };
    });
}

function listPlazaLocalFiltered(localeFilter?: string | null): PlazaListing[] {
  const all = listPlazaLocal();
  if (!localeFilter) return all;
  return all.filter((e) => (e.locale ?? 'ko') === localeFilter);
}

async function getImportedSourceIdsRemote(userId: string): Promise<Set<string>> {
  const sb = getSupabase();
  if (!sb) return new Set();
  const { data, error } = await sb
    .from('share_plaza_imports')
    .select('source_trip_id')
    .eq('importer_id', userId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.source_trip_id as string));
}

async function recordPlazaImportRemote(
  sourceTripId: string,
  clonedTripId: string,
  userId: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb.from('share_plaza_imports').upsert(
    {
      source_trip_id: sourceTripId,
      importer_id: userId,
      cloned_trip_id: clonedTripId,
    },
    { onConflict: 'source_trip_id,importer_id' }
  );
  if (error) throw error;
}

export async function listPlazaEntries(
  localeFilter?: string | null
): Promise<PlazaListing[]> {
  if (isSupabaseConfigured) {
    const remote = await listPlazaRemote(localeFilter);
    if (remote.length > 0) return remote;
  }
  return listPlazaLocalFiltered(localeFilter);
}

export async function getImportedSourceIds(
  userId?: string | null
): Promise<Set<string>> {
  if (isSupabaseConfigured && userId) {
    return getImportedSourceIdsRemote(userId);
  }
  return readLocalPlazaImported();
}

export async function recordPlazaImport(
  sourceTripId: string,
  clonedTripId: string,
  userId?: string | null
): Promise<void> {
  if (isSupabaseConfigured && userId) {
    await recordPlazaImportRemote(sourceTripId, clonedTripId, userId);
    return;
  }
  const ids = readLocalPlazaImported();
  ids.add(sourceTripId);
  writeLocalPlazaImported(ids);
}

/** 마당 항목을 Trip으로 조립 (끌어오기용) */
export function plazaListingToTrip(listing: PlazaListing): Trip {
  return normalizeTrip({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    totalDays: listing.totalDays,
    currentDay: 1,
    pinnedByDay: listing.pinnedByDay,
    routeOptionsByDay: {},
    generatedRouteByDay: {},
    isPublic: true,
    createdAt: listing.listedAt,
    updatedAt: listing.listedAt,
  });
}

/**
 * 로컬 캐시(localStorage)는 브라우저 하나에 저장되므로 같은 기기에서 다른
 * 계정으로 로그인해도 물리적으로는 같은 저장소를 공유한다. 계정 간 데이터가
 * 섞이지 않도록 트립 자체의 ownerId로 걸러낸다: 로그인 상태면 본인 소유만,
 * 비로그인(게스트) 상태면 아직 아무 계정에도 귀속되지 않은 트립만 보여준다.
 */
function ownedBy(trip: Trip, userId?: string | null): boolean {
  return userId ? trip.ownerId === userId : !trip.ownerId;
}

function listLocal(userId?: string | null): TripSummary[] {
  const store = readStore();
  return store.trips
    .filter((t) => ownedBy(t, userId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      totalDays: t.totalDays,
      updatedAt: t.updatedAt,
    }));
}

function readLocal(tripId?: string, userId?: string | null): Trip | null {
  const store = readStore();
  const pool = store.trips.filter((t) => ownedBy(t, userId));
  if (pool.length === 0) return null;
  const id = tripId ?? store.activeId ?? pool[0]?.id;
  return pool.find((t) => t.id === id) ?? null;
}

function readLocalBySlug(slug: string): Trip | null {
  const store = readStore();
  const trip = store.trips.find((t) => t.slug === slug && t.isPublic);
  return trip ?? null;
}

function writeLocal(trip: Trip) {
  const normalized = normalizeTrip(trip);
  const store = readStore();
  const idx = store.trips.findIndex((t) => t.id === normalized.id);
  const nextTrips =
    idx >= 0
      ? store.trips.map((t, i) => (i === idx ? normalized : t))
      : [...store.trips, normalized];
  writeStore({ activeId: normalized.id, trips: nextTrips });
}

function deleteLocal(tripId: string): string | null {
  const store = readStore();
  const nextTrips = store.trips.filter((t) => t.id !== tripId);
  let activeId = store.activeId;
  if (activeId === tripId) {
    activeId = nextTrips[0]?.id ?? null;
  }
  writeStore({ activeId, trips: nextTrips });
  return activeId;
}

async function deleteRemote(userId: string, tripId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from('wayknit_trips')
    .delete()
    .eq('id', tripId)
    .eq('owner_id', userId);
  if (error) throw error;
}

export interface TripsRepo {
  list(userId?: string | null): Promise<TripSummary[]>;
  load(userId?: string | null, tripId?: string): Promise<Trip | null>;
  loadBySlug(slug: string): Promise<Trip | null>;
  save(trip: Trip): Promise<void>;
  delete(userId: string | null | undefined, tripId: string): Promise<void>;
  reset(): Promise<void>;
  migrateLocalToUser(userId: string): Promise<number>;
}

export const tripsRepo: TripsRepo = {
  async list(userId) {
    if (isSupabaseConfigured && userId) {
      const remote = await listRemote(userId);
      if (remote.length > 0) return remote;
    }
    return listLocal(userId);
  },

  async load(userId, tripId) {
    if (isSupabaseConfigured && userId) {
      if (tripId) {
        const byId = await readRemoteById(userId, tripId);
        if (byId) return byId;
      }
      const latest = await readRemoteLatest(userId);
      if (latest) return latest;
    }
    return readLocal(tripId, userId);
  },

  async loadBySlug(slug) {
    if (isSupabaseConfigured) {
      const remote = await readBySlugRemote(slug);
      if (remote) return remote;
    }
    return readLocalBySlug(slug);
  },

  async save(trip) {
    writeLocal(trip);
    if (isSupabaseConfigured && trip.ownerId) {
      await writeRemote(trip);
    }
  },

  async delete(userId, tripId) {
    deleteLocal(tripId);
    if (isSupabaseConfigured && userId) {
      await deleteRemote(userId, tripId);
    }
  },

  async reset() {
    localStorage.removeItem(LS_STORE);
  },

  async migrateLocalToUser(userId) {
    if (!isSupabaseConfigured) return 0;
    const store = readStore();
    /* 이미 다른 계정 소유로 찍힌 로컬 트립은 절대 이 계정으로 끌어오지 않는다 —
     * 아직 아무 계정에도 귀속되지 않은(순수 게스트) 트립만 첫 로그인 계정에 준다. */
    const unclaimed = store.trips.filter((t) => !t.ownerId);
    if (unclaimed.length === 0) return 0;

    let migrated = 0;
    for (const trip of unclaimed) {
      const normalized = normalizeTrip({ ...trip, ownerId: userId });
      try {
        await writeRemote(normalized);
        writeLocal(normalized);
        migrated++;
      } catch (e) {
        console.warn('로컬 여행 클라우드 업로드 실패', trip.id, e);
      }
    }
    return migrated;
  },
};

export function createSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export function createTripId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 공유 여행을 내 계정/로컬 저장소에 복사 */
export function cloneTripFromShare(source: Trip, ownerId?: string): Trip {
  const pinnedByDay: Trip['pinnedByDay'] = {};
  for (const [dayKey, list] of Object.entries(source.pinnedByDay ?? {})) {
    pinnedByDay[Number(dayKey)] = list.map((p) => ({ ...p }));
  }
  const routeOptionsByDay: Trip['routeOptionsByDay'] = {};
  for (const [dayKey, opts] of Object.entries(source.routeOptionsByDay ?? {})) {
    routeOptionsByDay[Number(dayKey)] = {
      ...opts,
      origin: { ...opts.origin },
    };
  }
  const generatedRouteByDay: Trip['generatedRouteByDay'] = {
    ...(source.generatedRouteByDay ?? {}),
  };

  return normalizeTrip({
    id: createTripId(),
    slug: createSlug(),
    title: source.title,
    totalDays: source.totalDays,
    currentDay: source.currentDay,
    pinnedByDay,
    routeOptionsByDay,
    generatedRouteByDay,
    materials: (source.materials ?? []).map((m) => ({ ...m })),
    ownerId,
    isPublic: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
