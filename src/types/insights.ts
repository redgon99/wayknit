export type InsightSource = 'youtube' | 'naver_blog' | 'naver_kin' | 'reddit';

export type InsightCategory =
  | 'pain_point'
  | 'feature_request'
  | 'praise'
  | 'competitor_mention'
  | 'useful_tip'
  | 'other';

export type InsightSentiment = 'positive' | 'neutral' | 'negative';

export type InsightRunStatus = 'running' | 'success' | 'error';

export interface InsightKeyword {
  id: string;
  source: InsightSource;
  keyword: string;
  isActive: boolean;
  createdAt: string;
}

export interface InsightRawItem {
  id: string;
  source: InsightSource;
  externalId: string;
  title: string | null;
  content: string | null;
  author: string | null;
  url: string | null;
  sourceCreatedAt: string | null;
  collectedAt: string;
}

export interface InsightAnalysis {
  id: string;
  rawItemId: string;
  category: InsightCategory;
  sentiment: InsightSentiment | null;
  summary: string | null;
  mentionedServices: string[];
  modelUsed: string | null;
  analyzedAt: string;
}

export interface InsightItemWithAnalysis extends InsightRawItem {
  analysis: InsightAnalysis | null;
}

export interface InsightCollectionRun {
  id: string;
  source: InsightSource | 'analyze' | 'place_match';
  startedAt: string;
  finishedAt: string | null;
  status: InsightRunStatus;
  itemsCollected: number;
  errorMessage: string | null;
}

export interface InsightCategoryCount {
  category: InsightCategory;
  count: number;
}

/** insight_source_stats() RPC — 소스별 미분석/미매칭 집계(I1) */
export interface InsightSourceStat {
  source: InsightSource;
  totalRaw: number;
  unanalyzed: number;
  analyzedUnmatched: number;
}

export type PlaceReactionAspect =
  | 'crowd'
  | 'price'
  | 'access'
  | 'food'
  | 'view'
  | 'service'
  | 'facility';

/** place_reactions — 게시물에서 추출한 장소 언급의 공개 집계 */
export interface PlaceReaction {
  placeKey: string;
  placeName: string;
  placeContentId: string | null;
  mentionCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  topAspects: PlaceReactionAspect[];
  updatedAt: string;
}
