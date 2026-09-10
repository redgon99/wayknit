import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { normalizeLocale } from '../lib/locale';
import { fetchLandingPromo } from '../lib/landingPromo';
import { collectNoticeTexts } from '../components/LandingCms';

/**
 * F06(모바일 감사 보고서, 2026-09-10) — 홈은 랜딩 CMS 공지 문구("9월
 * 테스트기간입니다.")를 보여주는데, 공유마당·가이드·한국여행정보는
 * `SiteHeader`의 하드코딩 기본값("8월 한 달간 시범 운영하며, 9월부터
 * 정식 운영합니다.")을 그대로 보여주고 있었다 — `LandingPage.tsx`만
 * CMS를 fetch해서 `noticeTexts`를 채워 넘겼고, 나머지 세 페이지는
 * `<SiteHeader>`를 그냥 호출해 그 기본값 폴백에 걸렸다.
 *
 * 네 페이지가 같은 출처를 보게, `LandingPage`가 하던 조회+계산을
 * 훅 하나로 뽑아 재사용한다. 관리자가 공지 문구를 바꾸면 이제 네
 * 페이지 전부 같이 바뀐다 — "공통 운영 상태 데이터"가 사실 이미
 * 있었고(랜딩 CMS), 세 페이지가 그걸 안 쓰고 있었을 뿐이었다.
 *
 * 로딩 중엔 `undefined`를 돌려준다 — `SiteHeader`의 `noticeTexts` prop이
 * `undefined`면 자기 기본값을 쓰므로, 짧은 로딩 순간에도 문구가 없다가
 * 갑자기 나타나는 대신 기본값이 먼저 보이고 CMS 값이 오면 자연스럽게
 * 바뀐다(랜딩 CMS 미설정 프로젝트에서도 그대로 동작).
 */
export function useLandingNoticeTexts(): string[] | undefined {
  const { t } = useTranslation('landing');
  const locale = normalizeLocale(i18n.language);
  const [texts, setTexts] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void fetchLandingPromo(locale, { publishedOnly: true })
      .then((promo) => {
        if (!alive) return;
        const menu = promo?.menu ?? [];
        setTexts(menu.length > 0 ? collectNoticeTexts(menu) : [t('notice.trial')]);
      })
      .catch(() => {
        if (alive) setTexts([t('notice.trial')]);
      });
    return () => {
      alive = false;
    };
  }, [locale, t]);

  return texts;
}
