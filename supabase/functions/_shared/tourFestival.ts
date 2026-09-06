/**
 * Tour API searchFestival2 URL (공공데이터포털 인증키) — 기간 내 축제/행사 목록
 *
 * 주의: 레거시 areaCode/sigunguCode 파라미터는 이 API 데이터셋에서 해당 컬럼이
 * 비어 있어 항상 0건을 반환한다(2026 확인). 지역 한정은 클라이언트에서
 * addr1 텍스트로 필터링한다 — src/lib/tourFestival.ts 참고.
 */
export function buildTourFestivalUrl(
  eventStartDate: string,
  eventEndDate: string | undefined,
  serviceKey: string
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    eventStartDate,
    numOfRows: '100',
    pageNo: '1',
    arrange: 'C',
  });
  if (eventEndDate) params.set('eventEndDate', eventEndDate);
  const base = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}
