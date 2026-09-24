import { getSupabase, isSupabaseConfigured } from './supabase';
import type { InsightCollectPeriod } from './insightCollectPeriod';
import type {
  InsightAnalysis,
  InsightAudience,
  InsightCategory,
  InsightCategoryCount,
  InsightCollectionRun,
  InsightItemWithAnalysis,
  InsightKeyword,
  InsightRawItem,
  InsightSource,
  InsightSourceStat,
} from '../types/insights';

/** 관리자 UI에서 "지금 수집" 버튼이 호출하는 Edge Function 그룹 (naver_blog/naver_kin은 함수 하나로 처리) */
export type InsightCollector = 'youtube' | 'naver' | 'reddit';

/**
 * I2(관리자 검토 2026-09-16) — 수집 함수(edge function)는 이번에 디코딩하도록
 * 고쳤지만, 이미 쌓인 지난 35일치 원문엔 `&#39;`·`&amp;` 같은 HTML 엔티티가
 * 그대로 저장돼 있다. DB를 백필하는 대신 화면에서 읽을 때 디코딩해
 * 기존 데이터도 바로 깨끗하게 보이게 한다(edge function의 htmlEntities.ts와
 * 같은 로직 — 프런트/Deno 함수가 파일을 공유하지 않아 중복 구현).
 */
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtmlEntities(text: string | null): string | null {
  if (!text) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_HTML_ENTITIES[entity] ?? match;
  });
}

const COLLECTOR_FUNCTION: Record<InsightCollector, string> = {
  youtube: 'insight-collect-youtube',
  naver: 'insight-collect-naver',
  reddit: 'insight-collect-reddit',
};

/**
 * Edge Function이 실패하면 supabase-js는 `Edge Function returned a non-2xx status
 * code`라는 일반 문구만 준다. 서버가 본문에 담아 보낸 진짜 이유
 * (`{ error: "REDDIT_CLIENT_ID... not configured" }` 같은)는 응답 객체
 * (FunctionsHttpError.context)에 그대로 남아 있으니 그걸 꺼내 쓴다 — 2026-09-23에
 * Reddit 수집이 시크릿 미설정으로 죽고 있었는데 저 일반 문구에 가려 원인을
 * 못 찾고 있었다.
 */
async function describeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (body?.error) return String(body.error);
    } catch {
      /* 본문이 JSON이 아니면 아래 기본 메시지로 */
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 인사이트 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

export async function listInsightKeywords(): Promise<InsightKeyword[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('insight_keywords')
    .select('id, source, keyword, is_active, created_at')
    .order('source', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as InsightSource,
    keyword: row.keyword as string,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  }));
}

export async function addInsightKeyword(input: {
  source: InsightSource;
  keyword: string;
}): Promise<void> {
  const sb = requireSupabase();
  const keyword = input.keyword.trim();
  if (!keyword) throw new Error('키워드를 입력해 주세요.');
  const { error } = await sb
    .from('insight_keywords')
    .upsert(
      { source: input.source, keyword, is_active: true },
      { onConflict: 'source,keyword' }
    );
  if (error) throw error;
}

export async function setInsightKeywordActive(id: string, isActive: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('insight_keywords').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function deleteInsightKeyword(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('insight_keywords').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 잘못 수집된 원문을 지운다(§2-7). insight_analysis · insight_place_mentions 의
 * raw_item_id FK가 on delete cascade라 분석·장소 언급도 함께 지워진다.
 * place_reactions 집계는 자동으로 다시 계산되지 않는다 — refresh_place_reactions()
 * 는 서비스 롤 전용(RPC 권한 회수됨)이라 관리자 화면에서 직접 부를 수 없다.
 * 이미 집계에 반영된 원문을 지우면 그 집계가 다음 수집 전까지 부풀어 있을 수
 * 있다는 뜻 — 분석 전(아직 place_reactions에 안 들어간) 원문 정리 용도로 우선 쓴다.
 */
/**
 * 수동 등록(§34) — 인스타그램·틱톡처럼 API로 못 긁는 플랫폼이나 기타 웹페이지에서
 * 관리자가 직접 복사한 텍스트를 넣는다. source는 항상 'manual'(INSERT 정책이
 * 이것만 허용). external_id는 자동수집처럼 플랫폼 고유 id가 없어 클라이언트에서
 * uuid로 생성 — (source, external_id) unique 제약만 지키면 된다.
 * 이후 AI 분석(insight-analyze)·장소 매칭(insight-place-match)은 source를
 * 가리지 않아 그대로 파이프라인을 탄다.
 */
export async function addInsightManualItem(input: {
  content: string;
  url?: string;
  title?: string;
  author?: string;
  sourceCreatedAt?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const content = input.content.trim();
  if (!content) throw new Error('내용을 입력해 주세요.');
  const { error } = await sb.from('insight_raw_items').insert({
    source: 'manual',
    external_id: `manual-${crypto.randomUUID()}`,
    title: input.title?.trim() || null,
    content,
    author: input.author?.trim() || null,
    url: input.url?.trim() || null,
    source_created_at: input.sourceCreatedAt || null,
  });
  if (error) throw error;
}

export async function deleteInsightRawItem(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('insight_raw_items').delete().eq('id', id);
  if (error) throw error;
}

/** AI가 잘못 분류한 카테고리를 관리자가 고친다(§2-7). */
export async function updateInsightAnalysisCategory(
  analysisId: string,
  category: InsightCategory
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('insight_analysis')
    .update({ category })
    .eq('id', analysisId);
  if (error) throw error;
}

export async function listInsightItems(filter: {
  source?: InsightSource;
  category?: InsightCategory;
  audience?: InsightAudience;
  limit?: number;
} = {}): Promise<InsightItemWithAnalysis[]> {
  const sb = requireSupabase();
  const analysisJoin = filter.category || filter.audience ? 'insight_analysis!inner' : 'insight_analysis';
  let query = sb
    .from('insight_raw_items')
    .select(
      `id, source, external_id, title, content, author, url, source_created_at, collected_at, ${analysisJoin}(id, category, sentiment, summary, mentioned_services, audience, model_used, analyzed_at)`
    )
    .order('collected_at', { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.source) query = query.eq('source', filter.source);
  if (filter.category) query = query.eq('insight_analysis.category', filter.category);
  if (filter.audience) query = query.eq('insight_analysis.audience', filter.audience);

  const { data, error } = await query;
  if (error) throw error;

  const items: InsightItemWithAnalysis[] = (data ?? []).map((row) => {
    const analysisRow = Array.isArray(row.insight_analysis)
      ? row.insight_analysis[0]
      : row.insight_analysis;
    const analysis: InsightAnalysis | null = analysisRow
      ? {
          id: analysisRow.id as string,
          rawItemId: row.id as string,
          category: analysisRow.category as InsightCategory,
          sentiment: (analysisRow.sentiment as InsightAnalysis['sentiment']) ?? null,
          summary: (analysisRow.summary as string | null) ?? null,
          mentionedServices: (analysisRow.mentioned_services as string[] | null) ?? [],
          audience: (analysisRow.audience as InsightAudience | null) ?? null,
          modelUsed: (analysisRow.model_used as string | null) ?? null,
          analyzedAt: analysisRow.analyzed_at as string,
        }
      : null;
    const raw: InsightRawItem = {
      id: row.id as string,
      source: row.source as InsightSource,
      externalId: row.external_id as string,
      title: decodeHtmlEntities((row.title as string | null) ?? null),
      content: decodeHtmlEntities((row.content as string | null) ?? null),
      author: decodeHtmlEntities((row.author as string | null) ?? null),
      url: (row.url as string | null) ?? null,
      sourceCreatedAt: (row.source_created_at as string | null) ?? null,
      collectedAt: row.collected_at as string,
    };
    return { ...raw, analysis };
  });

  return items;
}

export async function listInsightCategoryCounts(): Promise<InsightCategoryCount[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('insight_analysis').select('category');
  if (error) throw error;
  const counts = new Map<InsightCategory, number>();
  for (const row of data ?? []) {
    const category = row.category as InsightCategory;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

export async function listInsightCollectionRuns(limit = 20): Promise<InsightCollectionRun[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('insight_collection_runs')
    .select('id, source, started_at, finished_at, status, items_collected, error_message')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as InsightCollectionRun['source'],
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    status: row.status as InsightCollectionRun['status'],
    itemsCollected: (row.items_collected as number) ?? 0,
    errorMessage: (row.error_message as string | null) ?? null,
  }));
}

/** I1 나머지 — 소스별 미분석/미매칭 집계(insight_source_stats RPC) */
export async function listInsightSourceStats(): Promise<InsightSourceStat[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('insight_source_stats');
  if (error) throw error;
  type Row = { source: string; total_raw: number; unanalyzed: number; analyzed_unmatched: number };
  return ((data ?? []) as Row[]).map((row) => ({
    source: row.source as InsightSource,
    totalRaw: Number(row.total_raw) || 0,
    unanalyzed: Number(row.unanalyzed) || 0,
    analyzedUnmatched: Number(row.analyzed_unmatched) || 0,
  }));
}

export async function triggerInsightCollection(
  collector: InsightCollector,
  period?: InsightCollectPeriod
): Promise<{
  itemsCollected: number;
  period?: string;
}> {
  const sb = requireSupabase();
  const body: InsightCollectPeriod = period ?? {};
  const { data, error } = await sb.functions.invoke(COLLECTOR_FUNCTION[collector], {
    body,
  });
  if (error) throw new Error(await describeFunctionError(error));
  return {
    itemsCollected: (data?.itemsCollected as number) ?? 0,
    period: typeof data?.period === 'string' ? data.period : undefined,
  };
}

export async function triggerInsightAnalysis(): Promise<{ itemsAnalyzed: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke('insight-analyze', { body: {} });
  if (error) throw new Error(await describeFunctionError(error));
  return { itemsAnalyzed: (data?.itemsAnalyzed as number) ?? 0 };
}

/** 분석된 게시물에서 장소 언급을 뽑아 place_reactions 집계를 갱신 */
export async function triggerInsightPlaceMatch(): Promise<{
  itemsProcessed: number;
  mentionsAdded: number;
  placesTouched: number;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke('insight-place-match', { body: {} });
  if (error) throw new Error(await describeFunctionError(error));
  return {
    itemsProcessed: (data?.itemsProcessed as number) ?? 0,
    mentionsAdded: (data?.mentionsAdded as number) ?? 0,
    placesTouched: (data?.placesTouched as number) ?? 0,
  };
}
