import type { GuideKind } from '../lib/guideKinds';
import { DEFAULT_GUIDE_KIND } from '../lib/guideKinds';

export type GuideStatus = 'draft' | 'published' | 'archived';

export type { GuideKind };

export interface GuideArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  summaryEn: string | null;
  kind: GuideKind;
  topicTags: string[];
  status: GuideStatus;
  sourceAnalysisIds: string[];
  sourceUrls: string[];
  /** 추천 여행코스 지도 핀 (발행 시 저장된 좌표) */
  coursePins: GuideCoursePin[];
  locale: string;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 가이드 상세·매크로용 코스 핀 */
export interface GuideCoursePin {
  order: number;
  name: string;
  time?: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface GuideArticleInput {
  title: string;
  summary: string;
  bodyMd: string;
  summaryEn?: string | null;
  kind?: GuideKind;
  topicTags?: string[];
  sourceAnalysisIds?: string[];
  sourceUrls?: string[];
  coursePins?: GuideCoursePin[];
  locale?: string;
  slug?: string;
}

export { DEFAULT_GUIDE_KIND };
