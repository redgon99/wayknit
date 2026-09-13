import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ScenarioTheme, TourScenario } from './tourScenario';
import type {
  ScenarioCatalogEntry,
  ScenarioCatalogLocaleContent,
  ScenarioCatalogStatus,
} from '../types/scenarioCatalog';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 시나리오 카탈로그 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

function mapRow(row: Record<string, unknown>): ScenarioCatalogEntry {
  return {
    id: row.id as string,
    theme: row.theme as string,
    days: row.days as number,
    region: row.region as string,
    status: row.status as ScenarioCatalogStatus,
    content: (row.content as ScenarioCatalogEntry['content']) ?? {},
    candidateRegionCount: (row.candidate_region_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
    publishedAt: (row.published_at as string | null) ?? null,
  };
}

/** content jsonb에서 요청 로케일 → en → ko → 아무 값이나 순으로 폴백.
 *  중국어는 zh-CN/zh-TW/레거시 zh 를 서로 폴백한다. */
function pickLocaleContent(
  content: ScenarioCatalogEntry['content'],
  locale: string
): ScenarioCatalogLocaleContent | undefined {
  if (locale === 'zh-CN' || locale === 'zh') {
    return (
      content['zh-CN'] ??
      content.zh ??
      content['zh-TW'] ??
      content.en ??
      content.ko ??
      Object.values(content)[0]
    );
  }
  if (locale === 'zh-TW') {
    return (
      content['zh-TW'] ??
      content['zh-CN'] ??
      content.zh ??
      content.en ??
      content.ko ??
      Object.values(content)[0]
    );
  }
  return content[locale] ?? content.en ?? content.ko ?? Object.values(content)[0];
}

function entryToScenario(entry: ScenarioCatalogEntry, locale: string): TourScenario | null {
  const localeContent = pickLocaleContent(entry.content, locale);
  if (!localeContent) return null;
  return {
    theme: entry.theme as ScenarioTheme,
    region: entry.region,
    regionLabel: localeContent.regionLabel,
    title: localeContent.title,
    intro: localeContent.intro,
    days: localeContent.days,
    offeredRegions: [],
    droppedStopContentIds: [],
  };
}

export function isScenarioCatalogConfigured(): boolean {
  return isSupabaseConfigured;
}

/** 플래너: 특정 테마의 공개된 시나리오 옵션 목록(일수별) — 라이브 AI 호출 없이 즉시 조회 */
export async function listPublishedScenarios(
  theme: ScenarioTheme,
  locale: string
): Promise<Array<{ id: string; days: number; scenario: TourScenario }>> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('scenario_catalog')
    .select('id, theme, days, region, status, content, candidate_region_count, created_at, updated_at, published_at')
    .eq('theme', theme)
    .eq('status', 'published')
    .order('days', { ascending: true });
  if (error || !data) return [];
  const out: Array<{ id: string; days: number; scenario: TourScenario }> = [];
  for (const raw of data as Record<string, unknown>[]) {
    const entry = mapRow(raw);
    const scenario = entryToScenario(entry, locale);
    if (scenario) out.push({ id: entry.id, days: entry.days, scenario });
  }
  return out;
}

/**
 * U13(모바일 UX 리포트 2026-09-13) — 테마를 눌러야만 시나리오가 있는지
 * 알 수 있었다("걷기여행 → 없음"). 테마 카드에 개수를 미리 보여주려고
 * theme 컬럼만 가볍게 조회해 전체 테마의 개수를 한 번에 센다.
 */
export async function listPublishedScenarioCounts(): Promise<Partial<Record<ScenarioTheme, number>>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb
    .from('scenario_catalog')
    .select('theme')
    .eq('status', 'published');
  if (error || !data) return {};
  const counts: Partial<Record<ScenarioTheme, number>> = {};
  for (const row of data as { theme: string }[]) {
    const theme = row.theme as ScenarioTheme;
    counts[theme] = (counts[theme] ?? 0) + 1;
  }
  return counts;
}

// ---- 관리자 전용 ----

export async function listAdminScenarioCatalog(filter: {
  theme?: ScenarioTheme;
  status?: ScenarioCatalogStatus;
} = {}): Promise<ScenarioCatalogEntry[]> {
  const sb = requireSupabase();
  let query = sb
    .from('scenario_catalog')
    .select('id, theme, days, region, status, content, candidate_region_count, created_at, updated_at, published_at')
    .order('created_at', { ascending: false });
  if (filter.theme) query = query.eq('theme', filter.theme);
  if (filter.status) query = query.eq('status', filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

/**
 * supabase-js는 Edge Function이 non-2xx를 반환하면 error.message를 일반 문구
 * ("Edge Function returned a non-2xx status code")로 덮어써 실제 서버 에러
 * 본문을 숨긴다. 실제 메시지는 FunctionsHttpError.context(Response)에 있어
 * 별도로 읽어야 사용자에게 원인을 보여줄 수 있다.
 */
async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* 본문이 JSON이 아니면 기본 메시지로 폴백 */
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export async function generateScenarioCatalogEntry(
  theme: ScenarioTheme,
  days: number
): Promise<ScenarioCatalogEntry> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke<{
    entry?: Record<string, unknown>;
    error?: string;
  }>('tour-scenario-catalog-generate', { body: { theme, days } });
  if (error) throw new Error(await describeFunctionError(error));
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  if (!data?.entry) throw new Error('생성 결과가 비어 있습니다.');
  return mapRow(data.entry);
}

export async function publishScenarioCatalogEntry(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('scenario_catalog')
    .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function unpublishScenarioCatalogEntry(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('scenario_catalog')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteScenarioCatalogEntry(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('scenario_catalog').delete().eq('id', id);
  if (error) throw error;
}
