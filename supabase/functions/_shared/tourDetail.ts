const BASE = 'https://apis.data.go.kr/B551011/KorService2';

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

function commonParams(): URLSearchParams {
  return new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
  });
}

/** 공통정보조회 — 개요/홈페이지/전화/주소 */
export function buildTourDetailCommonUrl(contentId: string, serviceKey: string): string {
  const params = commonParams();
  params.set('contentId', contentId);
  params.set('defaultYN', 'Y');
  params.set('firstImageYN', 'Y');
  params.set('areacodeYN', 'Y');
  params.set('catcodeYN', 'Y');
  params.set('addrinfoYN', 'Y');
  params.set('mapinfoYN', 'Y');
  params.set('overviewYN', 'Y');
  return `${BASE}/detailCommon2?${keyParam(serviceKey)}&${params.toString()}`;
}

/** 소개정보조회 — 이용시간/쉬는날/주차/문의처 등 (contentTypeId별 필드명이 다름) */
export function buildTourDetailIntroUrl(
  contentId: string,
  contentTypeId: string,
  serviceKey: string
): string {
  const params = commonParams();
  params.set('contentId', contentId);
  params.set('contentTypeId', contentTypeId);
  return `${BASE}/detailIntro2?${keyParam(serviceKey)}&${params.toString()}`;
}

/** 이미지정보조회 — 추가 사진 목록 */
export function buildTourDetailImageUrl(contentId: string, serviceKey: string): string {
  const params = commonParams();
  params.set('contentId', contentId);
  params.set('imageYN', 'Y');
  params.set('subImageYN', 'Y');
  return `${BASE}/detailImage2?${keyParam(serviceKey)}&${params.toString()}`;
}
