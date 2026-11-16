/**
 * 링크 공유: 휴대폰 등 공유창이 있으면 그걸 열고, 없으면(대부분의 PC) 클립보드에 복사한다.
 * 복사도 막히면 주소를 prompt로 보여 준다.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';

export async function shareLink(title: string, url: string, promptLabel: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'; // 사용자가 공유창을 닫음
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    window.prompt(promptLabel, url);
    return 'manual';
  }
}
