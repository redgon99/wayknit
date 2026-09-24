import { getSupabase, isSupabaseConfigured } from './supabase';
import { parseInsightReportBody, type ParsedInsightReport } from './insightReportParser';
import type { InsightReport } from '../types/insights';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 인사이트 리포트 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

function mapRow(row: Record<string, unknown>): InsightReport {
  return {
    id: row.id as string,
    title: row.title as string,
    summary: (row.summary as string | null) ?? null,
    bodyMd: row.body_md as string,
    keywords: (row.keywords as string[] | null) ?? [],
    periodFrom: (row.period_from as string | null) ?? null,
    periodTo: (row.period_to as string | null) ?? null,
    sourceNote: (row.source_note as string | null) ?? null,
    parsed: (row.parsed as ParsedInsightReport | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface InsightReportInput {
  title: string;
  summary?: string | null;
  bodyMd: string;
  keywords: string[];
  periodFrom?: string | null;
  periodTo?: string | null;
  sourceNote?: string | null;
}

function toRow(input: InsightReportInput) {
  return {
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    body_md: input.bodyMd,
    keywords: input.keywords.map((k) => k.trim()).filter(Boolean),
    period_from: input.periodFrom || null,
    period_to: input.periodTo || null,
    source_note: input.sourceNote?.trim() || null,
    /** LLM 호출 없이 규칙 기반으로 뽑은 표·그래프용 데이터(§34) — 저장 시점에 계산 */
    parsed: parseInsightReportBody(input.bodyMd),
  };
}

/** q는 제목/요약/본문 ilike OR 검색, keyword는 keywords 배열 포함 검색(둘 다 줄 수 있음, AND) */
export async function listInsightReports(filter: {
  q?: string;
  keyword?: string;
  limit?: number;
} = {}): Promise<InsightReport[]> {
  const sb = requireSupabase();
  let query = sb
    .from('insight_reports')
    .select('id, title, summary, body_md, keywords, period_from, period_to, source_note, parsed, created_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);

  const q = filter.q?.trim();
  if (q) {
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,body_md.ilike.%${q}%`);
  }
  if (filter.keyword?.trim()) {
    query = query.contains('keywords', [filter.keyword.trim()]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getInsightReport(id: string): Promise<InsightReport | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('insight_reports').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function createInsightReport(input: InsightReportInput): Promise<InsightReport> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('insight_reports')
    .insert({ ...toRow(input), created_by: user?.id ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateInsightReport(id: string, input: InsightReportInput): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('insight_reports').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

export async function deleteInsightReport(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('insight_reports').delete().eq('id', id);
  if (error) throw error;
}

/** 키워드 입력 자동완성용 — 지금까지 쓰인 키워드 전부를 중복 제거해 반환 */
export async function listInsightReportKeywords(): Promise<string[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('insight_reports').select('keywords');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    for (const k of (row.keywords as string[] | null) ?? []) set.add(k);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}
