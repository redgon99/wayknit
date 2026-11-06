import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { normalizeLocale, type AppLocale } from '../lib/locale';
import { fetchLandingPromo, type LandingPromo } from '../lib/landingPromo';
import { findFirstEnabledOfType, type LandingMenuNode } from '../lib/landingMenu';
import { collectNoticeTexts, landingNavItems } from '../components/LandingCms';

/**
 * 공개 페이지 상단(SiteHeader)과 랜딩 본문이 함께 쓰는 랜딩 CMS 데이터.
 *
 * F06(2026-09-10)에서 공지 문구만 네 페이지가 같은 출처를 보게 맞췄는데
 * (`useLandingNoticeTexts`), CMS가 만드는 **상단 메뉴**는 여전히
 * `LandingPage`만 조회해 `SiteHeader`에 끼워
 * 넣고 있었다 — 홈에선 보이던 메뉴가 공유마당·여행 팁·한국여행정보로
 * 가면 사라졌다(2026-10-27 사용자 지적). 이제 `SiteHeader`가 이 훅으로
 * 직접 읽어 어느 페이지에서나 같은 메뉴·공지를 그린다.
 *
 * 랜딩에선 헤더와 본문이 같은 데이터를 동시에 요청하므로 locale별로 짧게
 * 캐시해 요청을 한 번으로 묶는다. 관리자가 게시한 변경이 공개 페이지에 늦게
 * 반영되지 않도록 캐시는 1분만 쓴다.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<AppLocale, { at: number; promise: Promise<LandingPromo | null> }>();

function loadPublishedPromo(locale: AppLocale): Promise<LandingPromo | null> {
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = fetchLandingPromo(locale, { publishedOnly: true }).catch(() => null);
  cache.set(locale, { at: Date.now(), promise });
  return promise;
}

export interface LandingCms {
  /** 조회가 끝났는지 — 랜딩이 해시(#섹션) 스크롤을 이 시점까지 미룬다 */
  loaded: boolean;
  menu: LandingMenuNode[];
  /** 히어로 문구로 쓰는 첫 copy 블록 — 메뉴에선 빠진다 */
  heroCopy: LandingMenuNode | null;
  /**
   * 로딩 중엔 `undefined` — `SiteHeader`가 자기 기본 공지를 먼저 보여주다
   * CMS 값이 오면 바꾼다(문구가 없다가 갑자기 생기지 않게).
   */
  noticeTexts: string[] | undefined;
  navItems: LandingMenuNode[];
}

export function useLandingCms(): LandingCms {
  const { t } = useTranslation('landing');
  const locale = normalizeLocale(i18n.language);
  const [state, setState] = useState<{ locale: AppLocale; promo: LandingPromo | null } | null>(
    null
  );

  useEffect(() => {
    let alive = true;
    void loadPublishedPromo(locale).then((promo) => {
      if (alive) setState({ locale, promo });
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  // 언어를 바꾼 직후엔 이전 언어의 결과를 쓰지 않는다.
  const loaded = state !== null && state.locale === locale;
  const menu = loaded ? (state.promo?.menu ?? []) : [];
  const heroCopy = findFirstEnabledOfType(menu, 'copy');

  return {
    loaded,
    menu,
    heroCopy,
    noticeTexts: !loaded
      ? undefined
      : menu.length > 0
        ? collectNoticeTexts(menu)
        : [t('notice.trial')],
    navItems: landingNavItems(menu, heroCopy?.id),
  };
}
