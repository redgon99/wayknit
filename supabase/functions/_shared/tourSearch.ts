/** Tour API searchKeyword2 URL (공공데이터포털 인증키) */
export function buildTourSearchUrl(keyword: string, serviceKey: string): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    keyword: keyword.trim(),
    numOfRows: '10',
    pageNo: '1',
    arrange: 'C',
  });
  const base = 'https://apis.data.go.kr/B551011/KorService2/searchKeyword2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}
