/**
 * 첫 화면이 자기 데이터(랜딩: 추천 코스·홍보 문구)를 다 받았다는 신호(§70).
 * 느린 회선에서 플래너 미리 받기(약 250 KB)가 첫 화면 직후 바로 시작하면 추천 코스 조회·글꼴 파일과
 * 대역폭을 나눠 써서 코스 카드가 늦게 떴다 — 미리 받기는 이 신호(또는 최대 대기 시간) 뒤에 한다.
 */
let settle: () => void = () => {};

export const firstScreenSettled = new Promise<void>((resolve) => {
  settle = resolve;
});

export function markFirstScreenSettled(): void {
  settle();
}
