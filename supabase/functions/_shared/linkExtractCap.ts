import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * link-places-extract 전용 IP 기준 하루 사용량 캡 — 2026-09-20 보안 점검 후속.
 * verify_jwt:true는 anon 키만으로도 통과되고(로그인 여부와 무관), 이 기능은
 * 게스트도 써야 해서 로그인 게이트를 걸 수 없다 — 그래서 IP 캡으로 대체.
 */
function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * true면 호출을 허용하고 이번 호출을 카운트에 반영했다는 뜻(원자적 증가+확인).
 * false면 오늘 이 IP의 한도를 넘었다는 뜻 — 아무것도 더 안 하고 바로 거절할 것.
 * 설정 오류(SUPABASE_URL/SERVICE_ROLE_KEY 없음) 시에는 막지 않고 통과시킨다
 * (가용성 우선 — 캡이 주 방어선이 아니라 보조 장치라서).
 */
export async function checkAndRecordIpUsage(req: Request, dailyLimit: number): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return true;

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const ipHash = await hashIp(getClientIp(req));

  const { data, error } = await sb.rpc('check_and_record_link_extract', {
    p_ip_hash: ipHash,
    p_daily_limit: dailyLimit,
  });
  if (error) {
    console.warn('link extract IP 캡 확인 실패 — 통과시킴', error);
    return true;
  }
  return data === true;
}
