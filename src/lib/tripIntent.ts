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
