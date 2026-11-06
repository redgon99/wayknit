/**
 * /api/geo — 접속 국가 코드만 돌려준다(접속 로그의 국가별 집계용).
 * Netlify가 판별한 값을 그대로 전달할 뿐 IP는 읽지도 저장하지도 않는다.
 */

interface GeoContext {
  geo?: { country?: { code?: string } };
}

export default (_request: Request, context: GeoContext) =>
  Response.json(
    { country: context.geo?.country?.code ?? null },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );

export const config = { path: '/api/geo' };
