import { getSupabase, isSupabaseConfigured } from './supabase';

export type ReportTargetType = 'trip' | 'plaza_listing' | 'guide' | 'place';

export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'wrong_info'
  | 'copyright'
  | 'other';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'rejected';

export const REPORT_REASONS: ReportReason[] = [
  'spam',
  'inappropriate',
  'wrong_info',
  'copyright',
  'other',
];

export const REPORT_STATUSES: ReportStatus[] = [
  'open',
  'reviewing',
  'resolved',
  'rejected',
];

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  label?: string;
  url?: string;
}

export interface ContentReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string | null;
  targetUrl: string | null;
  reason: ReportReason;
  detail: string | null;
  reporterId: string | null;
  reporterLocale: string | null;
  status: ReportStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const REPORT_SELECT =
  'id, target_type, target_id, target_label, target_url, reason, detail, reporter_id, reporter_locale, status, admin_note, reviewed_at, created_at';

interface ReportRow {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  target_label: string | null;
  target_url: string | null;
  reason: ReportReason;
  detail: string | null;
  reporter_id: string | null;
  reporter_locale: string | null;
  status: ReportStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function rowToReport(row: ReportRow): ContentReport {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    targetUrl: row.target_url,
    reason: row.reason,
    detail: row.detail,
    reporterId: row.reporter_id,
    reporterLocale: row.reporter_locale,
    status: row.status,
    adminNote: row.admin_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 신고를 접수할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

/** 이미 같은 대상을 신고해 접수 대기 중인지 — 중복 인덱스 위반 코드 */
const UNIQUE_VIOLATION = '23505';

export class DuplicateReportError extends Error {
  constructor() {
    super('이미 접수된 신고입니다.');
    this.name = 'DuplicateReportError';
  }
}

export async function submitContentReport(params: {
  target: ReportTarget;
  reason: ReportReason;
  detail?: string;
  reporterId?: string | null;
  locale?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const detail = params.detail?.trim();
  const { error } = await sb.from('content_reports').insert({
    target_type: params.target.type,
    target_id: params.target.id,
    target_label: params.target.label ?? null,
    target_url: params.target.url ?? null,
    reason: params.reason,
    detail: detail || null,
    reporter_id: params.reporterId ?? null,
    reporter_locale: params.locale ?? null,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateReportError();
    throw error;
  }
}

export async function listContentReports(
  status?: ReportStatus | 'all',
): Promise<ContentReport[]> {
  const sb = requireSupabase();
  let query = sb
    .from('content_reports')
    .select(REPORT_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ReportRow[] | null)?.map(rowToReport) ?? [];
}

export async function updateContentReport(
  id: string,
  patch: { status?: ReportStatus; adminNote?: string },
  reviewerId?: string | null,
): Promise<void> {
  const sb = requireSupabase();
  const next: Record<string, unknown> = {};
  if (patch.status) {
    next.status = patch.status;
    next.reviewed_at = new Date().toISOString();
    next.reviewed_by = reviewerId ?? null;
  }
  if (patch.adminNote !== undefined) next.admin_note = patch.adminNote.trim() || null;
  if (Object.keys(next).length === 0) return;
  const { error } = await sb.from('content_reports').update(next).eq('id', id);
  if (error) throw error;
}

/**
 * 여러 신고를 한 번에 같은 상태로 바꾼다(§2-7 일괄 처리). 스팸 신고가 몰릴 때
 * 하나씩 눌러야 했던 것을 한 번의 UPDATE로 묶는다. 제재(콘텐츠 비공개 등)는
 * 신고마다 대상 유형·id가 달라 여기서 하지 않는다 — moderateReport()를 개별
 * 호출해야 한다. 이 함수는 신고 큐 자체의 상태값만 바꾼다.
 */
export async function bulkUpdateContentReports(
  ids: string[],
  patch: { status: ReportStatus },
  reviewerId?: string | null,
): Promise<void> {
  if (ids.length === 0) return;
  const sb = requireSupabase();
  const { error } = await sb
    .from('content_reports')
    .update({
      status: patch.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId ?? null,
    })
    .in('id', ids);
  if (error) throw error;
}

/** 신고 대상의 현재 상태 — 제재 버튼 활성/비활성과 "이미 조치됨" 표시에 쓴다 */
export interface ReportTargetState {
  reportId: string;
  targetExists: boolean;
  /** 아직 공개/게시 중이라 제재할 여지가 있는가. place처럼 제재 대상이 아니면 null */
  isActive: boolean | null;
  stateLabel: string;
}

/** 제재 액션이 있는 대상 유형 (place는 신고 UI가 없고 내릴 콘텐츠도 없다) */
export const MODERATABLE_TARGETS: ReportTargetType[] = ['trip', 'plaza_listing', 'guide'];

export const MODERATION_ACTION_LABEL: Record<string, string> = {
  trip: '비공개 전환',
  plaza_listing: '마당에서 내리기',
  guide: '게시중지',
};

export async function fetchReportTargetStates(): Promise<Map<string, ReportTargetState>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_report_target_states');
  if (error) throw error;
  const map = new Map<string, ReportTargetState>();
  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const reportId = raw.report_id as string;
    map.set(reportId, {
      reportId,
      targetExists: Boolean(raw.target_exists),
      isActive: raw.is_active === null ? null : Boolean(raw.is_active),
      stateLabel: (raw.state_label as string) ?? '-',
    });
  }
  return map;
}

/**
 * 신고 대상에 제재를 가하고 신고를 '조치 완료'로 바꾼다 — 한 트랜잭션.
 * 대상 유형은 서버가 신고 행에서 직접 읽으므로 호출자가 어긋나게 지정할 수 없다.
 */
export async function moderateReport(reportId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_moderate_report', { p_report_id: reportId });
  if (error) throw error;
}

export async function countOpenReports(): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from('content_reports')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'reviewing']);
  if (error) return 0;
  return count ?? 0;
}
