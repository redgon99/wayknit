/** Tour API locationBasedList2 URL (공공데이터포털 인증키) — 좌표 반경 내 관광정보 목록 */
export function buildTourNearbyUrl(
  mapX: number,
  mapY: number,
  radiusMeters: number,
  serviceKey: string,
  contentTypeId?: string
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    mapX: String(mapX),
    mapY: String(mapY),
    radius: String(Math.min(Math.max(Math.round(radiusMeters), 1), 20000)),
    numOfRows: '30',
    pageNo: '1',
    arrange: 'E',
  });
  if (contentTypeId) params.set('contentTypeId', contentTypeId);
  const base = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}
