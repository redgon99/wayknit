/**
 * ktrip(콘텐츠 기획 엔진, https://ktrip.wayknit.com) 관리 화면 링크.
 * ktrip 공개 주소는 접속 비밀번호 뒤에 있어 처음 열 때 비밀번호를 묻는다.
 */
const KTRIP_ORIGIN = 'https://ktrip.wayknit.com';

/** 이 가이드의 업데이트 버전 요청문 화면(ktrip /admin/rewrite). */
export function ktripRewriteUrl(slug: string): string {
  return `${KTRIP_ORIGIN}/admin/rewrite?slug=${encodeURIComponent(slug)}`;
}
