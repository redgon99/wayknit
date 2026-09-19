import { getSupabase } from './supabase';
import { AuthRequiredError, type TripIntent } from './tripIntent';

/**
 * AI 일정 생성 Step 3 — TripIntent로 TourAPI 후보를 모은다.
 * 서버 응답 형태는 supabase/functions/_shared/tourScenario.ts의
 * ScenarioCandidate와 동일(필드만 클라이언트에 복제, 로직은 서버에만 있음).
 */
export interface TripCandidate {
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  sourceKeyword: string;
  thumbnailUrl?: string;
}

export interface TripCandidateSearchResult {
  candidates: TripCandidate[];
  totalCandidates: number;
  rawCountsByQuery: Record<string, number>;
  filteredOutCount: number;
}

export async function searchTripCandidates(intent: TripIntent): Promise<TripCandidateSearchResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');

  const { data, error } = await supabase.functions.invoke<TripCandidateSearchResult>(
    'trip-candidates-search',
    { body: { intent } }
  );
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.clone().json()) as { error?: string; code?: string };
        if (body.code === 'auth_required') throw new AuthRequiredError();
      } catch (parseErr) {
        if (parseErr instanceof AuthRequiredError) throw parseErr;
      }
    }
    throw error;
  }
  if (!data) throw new Error('후보 장소를 찾지 못했습니다.');
  return data;
}
