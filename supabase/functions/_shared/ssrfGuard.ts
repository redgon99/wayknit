/**
 * 사용자가 준 URL을 서버가 대신 fetch하기 전에 내부망/예약 주소로 가는 걸
 * 막는다(SSRF 방어). link-places-extract의 extractWeb(href)에서 발견
 * (2026-09-20 보안 검토) — guide-course-from-share는 chatgpt.com/
 * chat.openai.com 허용목록이라 이미 안전하지만, 이쪽은 호스트 제한이
 * 전혀 없어 http://169.254.169.254/ 같은 내부 주소를 그대로 요청했다.
 *
 * URL의 호스트가 리터럴 IP면 바로 검사하고, 도메인이면 DNS로 풀어서
 * 나온 IP들도 검사한다(도메인이 내부 IP를 가리키도록 설정된 경우 방어).
 * ⚠️ 완벽한 방어는 아니다 — 검사 시점과 실제 fetch 시점 사이에 DNS 응답이
 * 바뀌는 "DNS 리바인딩" 공격까지는 막지 못한다(연결을 직접 특정 IP에
 * 고정하려면 Deno fetch로는 상당한 추가 작업이 필요해 이번 범위 밖으로
 * 뒀다). 일반적인 "URL에 내부 IP를 직접 넣는" 공격은 막는다.
 */

function isPrivateOrReservedV4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (클라우드 메타데이터 포함)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // 224.0.0.0/4 멀티캐스트 + 240.0.0.0/4 예약
  return false;
}

function isPrivateOrReservedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7 unique local
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPrivateOrReservedV4(v4);
  }
  return false;
}

export class UnsafeUrlError extends Error {
  constructor(message = '허용되지 않는 주소입니다.') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** http(s) 프로토콜 + 내부망/예약 주소가 아닌지 확인. 문제 있으면 UnsafeUrlError를 던진다 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (!/^https?:$/i.test(url.protocol)) {
    throw new UnsafeUrlError('http(s) URL만 지원합니다.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateOrReservedV4(hostname)) throw new UnsafeUrlError();
    return;
  }
  if (hostname.includes(':')) {
    if (isPrivateOrReservedV6(hostname)) throw new UnsafeUrlError();
    return;
  }
  if (hostname === 'localhost') throw new UnsafeUrlError();

  let v4: string[] = [];
  let v6: string[] = [];
  try {
    v4 = await Deno.resolveDns(hostname, 'A');
  } catch {
    /* A 레코드 없음 — AAAA만 있을 수 있음 */
  }
  try {
    v6 = await Deno.resolveDns(hostname, 'AAAA');
  } catch {
    /* AAAA 레코드 없음 */
  }
  if (v4.length === 0 && v6.length === 0) {
    throw new UnsafeUrlError('호스트를 확인할 수 없습니다.');
  }
  if (v4.some(isPrivateOrReservedV4) || v6.some(isPrivateOrReservedV6)) {
    throw new UnsafeUrlError();
  }
}
