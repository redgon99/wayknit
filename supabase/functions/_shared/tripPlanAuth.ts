import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * AI 일정 생성 — 호출자의 실제 세션 JWT로 동작하는 클라이언트.
 * service role이 아니라 이걸 써야 can_generate_ai_trip_plan() 등의
 * auth.uid()가 "이 요청을 보낸 사람"으로 정확히 채워진다.
 *
 * 🔴(2026-09-20 보안 검토 후속) verify_jwt:true만으로는 공개 anon 키를
 * 가진 누구나 통과한다(Supabase 공식 문서로 확인) — 로그인 여부와 무관.
 * trip-intent-parse/trip-candidates-search를 클라이언트 UI 없이 직접
 * 호출하면 §31-23의 캡 확인(ThemeScenarioPanel.tsx)을 건너뛸 수 있었다.
 * 이 파일의 함수들로 서버 쪽에서 직접 로그인 여부·캡을 확인한다.
 */
function scopedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new AuthRequiredError();
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL/SUPABASE_ANON_KEY not configured');
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

export class AuthRequiredError extends Error {
  constructor() {
    super('로그인이 필요합니다.');
    this.name = 'AuthRequiredError';
  }
}

export class DailyCapReachedError extends Error {
  constructor() {
    super('오늘 무료 AI 일정 생성 횟수를 다 썼습니다.');
    this.name = 'DailyCapReachedError';
  }
}

/** anon 키만으로는 통과 못 함 — 실제 로그인된 사용자인지 확인. 통과 시 user id 반환 */
export async function requireAuthenticatedUser(req: Request): Promise<string> {
  const sb = scopedClient(req);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return data.user.id;
}

/**
 * 로그인 확인 + 캡 확인 + 기록을 한 번에. can_generate_ai_trip_plan()/
 * record_ai_trip_plan_generation()은 호출자의 auth.uid()를 내부에서
 * 직접 읽으므로(SECURITY DEFINER) 반드시 scopedClient로 호출해야 한다.
 */
export async function requireTripPlanQuota(req: Request): Promise<void> {
  await requireAuthenticatedUser(req);
  const sb = scopedClient(req);
  const { data, error } = await sb.rpc('can_generate_ai_trip_plan');
  if (error) throw error;
  if (data !== true) throw new DailyCapReachedError();
  const { error: recordError } = await sb.rpc('record_ai_trip_plan_generation');
  if (recordError) throw recordError;
}
