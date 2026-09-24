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

/**
 * DB의 `parsed`는 저장 시점 파서가 만든 스냅샷이라, 파서 스키마가 바뀌면
 * 예전에 저장된 행은 옛 모양 그대로 남는다(§37에서 실제로 겪음 —
 * signals.positive가 string|null이던 옛 행을 새 컴포넌트가 배열로 가정하고
 * `.length`를 읽다가 흰 화면으로 죽었다). 화면단에서 매번 타입을 믿지 않고
 * 여기서 한 번 정규화해 어떤 모양이 들어와도 안전한 값으로 맞춘다 —
 * 이후 리포트를 다시 저장하면 새 파서가 다시 계산해 자연히 갱신된다.
 */
function normalizeParsed(raw: unknown): ParsedInsightReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const toStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string' && v) return [v];
    return [];
  };

  const regions = Array.isArray(r.regions)
    ? r.regions
        .map((x) => {
          const item = (x ?? {}) as Record<string, unknown>;
          const name = typeof item.name === 'string' ? item.name : '';
          return {
            name,
            mentionCount: typeof item.mentionCount === 'number' ? item.mentionCount : null,
            notablePlaces: typeof item.notablePlaces === 'string' ? item.notablePlaces : '',
          };
        })
        .filter((x) => x.name)
    : [];

  const interests = Array.isArray(r.interests)
    ? r.interests
        .map((x) => {
          const item = (x ?? {}) as Record<string, unknown>;
          return {
            title: typeof item.title === 'string' ? item.title : '',
            description: typeof item.description === 'string' ? item.description : '',
          };
        })
        .filter((x) => x.title && x.description)
    : [];

  const signalsRaw = (r.signals ?? {}) as Record<string, unknown>;

  return {
    regions,
    interests,
    signals: {
      positive: toStringArray(signalsRaw.positive),
      negative: toStringArray(signalsRaw.negative),
    },
    foods: toStringArray(r.foods),
  };
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
    parsed: normalizeParsed(row.parsed),
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
