import type { GuideKind } from '../lib/guideKinds';
import { DEFAULT_GUIDE_KIND } from '../lib/guideKinds';

export type GuideStatus = 'draft' | 'published' | 'archived';

export type { GuideKind };

/**
 * 가이드 다국어 통합(2026-09-20) — scenario_catalog.content와 같은 패턴.
 * 행 자체의 title/summary/bodyMd/locale이 대표(기본) 언어고, 그 외 보조
 * 언어는 여기 담는다. `pickGuideContent()`(lib/guides.ts)로 조회한다.
 */
export interface GuideTranslation {
  title: string;
  summary: string;
  bodyMd: string;
}

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
  /** 보조 언어 버전 — 키는 locale 코드('en'·'ja'·'zh-CN' 등) */
  translations: Partial<Record<string, GuideTranslation>>;
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
  /** Google place_id (g: 접두 없이) */
  googlePlaceId?: string;
  rating?: number;
  reviewCount?: number;
  categoryLabel?: string;
  priceLevelLabel?: string;
  /** 발행 시 스냅샷한 사진 URL (최대 6) */
  photoUrls?: string[];
  address?: string;
  phone?: string;
  openingText?: string;
  editorialSummary?: string;
  /** 리뷰에서 뽑은 짧은 하이라이트 */
  reviewHighlights?: string[];
  /** 예: 1일차 */
  dayLabel?: string;
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
  translations?: Partial<Record<string, GuideTranslation>>;
  slug?: string;
}

export { DEFAULT_GUIDE_KIND };
