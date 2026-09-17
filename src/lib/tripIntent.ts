import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ScenarioTheme } from './tourScenario';

/**
 * AI 일정 생성 — Step 2: 자연어 문장을 TripIntent로 구조화.
 * 후보 검색·배치(Step 3~4)는 별도 함수(trip-scenario-generate 등)에서 이어받는다.
 */

export type Companions = 'parents' | 'kids' | 'couple' | 'solo' | 'friends' | 'unknown';
export type Pace = 'relaxed' | 'normal' | 'busy';

export interface TripIntent {
  destination: string;
  days: number;
  companions: Companions;
  pace: Pace;
  avoidLongWalk: boolean;
  themes: ScenarioTheme[];
}

export function isTripIntentConfigured(): boolean {
  return isSupabaseConfigured;
}

/**
 * §31-22 Step 6 — Free 플랜 하루 무료 생성 횟수. Plus/Team/관리자는
 * `has_unlimited_access()`(서버)가 무제한으로 통과시킨다. 이 숫자는
 * `supabase/migrations/20260917130000_ai_trip_plan_cap.sql`의 하드코딩된
 * `3`과 반드시 같이 맞출 것 — 여긴 표시용, 실제 방어선은 서버 RPC다.
 */
export const FREE_DAILY_AI_TRIP_PLANS = 3;

/**
 * 로그인 필수 기능이라(trip-intent-parse/trip-candidates-search 둘 다
 * verify_jwt=true) Google 검색 캡과 달리 게스트용 localStorage 폴백이
 * 필요 없다 — RPC가 auth.uid() 없으면 그냥 false를 돌려준다.
 */
export async function canGenerateAiTripPlan(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('can_generate_ai_trip_plan');
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.warn('AI 일정 생성 한도 서버 조회 실패', e);
    return false;
  }
}

export async function recordAiTripPlanGeneration(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.rpc('record_ai_trip_plan_generation');
    if (error) throw error;
  } catch (e) {
    // 이번 한 건이 서버에 안 찍힐 뿐, 생성 자체는 이미 진행 중 — 조용히 넘어간다
    console.warn('AI 일정 생성 횟수 서버 기록 실패', e);
  }
}

export class DestinationMissingError extends Error {
  constructor() {
    super('목적지를 파악하지 못했습니다. 여행지를 조금 더 구체적으로 적어주세요.');
    this.name = 'DestinationMissingError';
  }
}

export async function parseTripIntent(text: string): Promise<TripIntent> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');

  const { data, error } = await supabase.functions.invoke<{
    intent?: TripIntent;
    error?: string;
    code?: string;
  }>('trip-intent-parse', { body: { text } });

  if (error) {
    // functions.invoke는 4xx/5xx도 FunctionsHttpError로 던지고 data엔 응답 본문이 안 실린다 —
    // trip-intent-parse가 422로 돌려주는 code를 읽으려면 context에서 다시 파싱해야 한다.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.clone().json()) as { error?: string; code?: string };
        if (body.code === 'destination_missing') throw new DestinationMissingError();
        if (body.error) throw new Error(body.error);
      } catch (parseErr) {
        if (parseErr instanceof DestinationMissingError) throw parseErr;
      }
    }
    throw error;
  }
  if (!data?.intent) throw new Error('여행 조건을 분석하지 못했습니다.');
  return data.intent;
}
