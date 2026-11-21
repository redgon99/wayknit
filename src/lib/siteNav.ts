import { pathWithLocale, type AppLocale } from './locale';
import { plannerPath } from './routes';

/**
 * 공개 페이지 메뉴 3묶음(개편 2단계, 2026-11-21) — 코스 · 여행 정보 · 내 여행.
 * 예전 메뉴 8곳(소개·공유마당·여행 팁·한국여행정보·테마 보드·여행 준비·도움말·CMS)을
 * 여행자가 찾는 일 기준으로 묶었다. "지역 방문자 통계"는 메뉴에 넣지 않는다
 * (한국여행정보 탭에는 그대로 있다 — 공개 페이지에서 뺄지는 사용자 결정 대기, HANDOFF §56).
 */
export type SiteNavGroupId = 'courses' | 'info' | 'trip';
export type SiteNavActive = 'home' | SiteNavGroupId;

export interface SiteNavItem {
  id: string;
  to: string;
}

export interface SiteNavGroup {
  id: SiteNavGroupId;
  items: SiteNavItem[];
}

export function siteNavGroups(locale: AppLocale): SiteNavGroup[] {
  return [
    {
      id: 'courses',
      items: [
        { id: 'recommended', to: `${pathWithLocale('/guides', locale)}?kind=course` },
        { id: 'shared', to: pathWithLocale('/plaza', locale) },
        { id: 'themes', to: pathWithLocale('/themes', locale) },
      ],
    },
    {
      id: 'info',
      items: [
        { id: 'prep', to: pathWithLocale('/setup', locale) },
        { id: 'tips', to: pathWithLocale('/guides', locale) },
        { id: 'resources', to: pathWithLocale('/info', locale) },
      ],
    },
    {
      id: 'trip',
      items: [
        { id: 'planner', to: plannerPath(locale) },
        { id: 'help', to: pathWithLocale('/help', locale) },
      ],
    },
  ];
}
