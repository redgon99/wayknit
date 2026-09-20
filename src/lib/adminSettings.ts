import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * 관리자 설정 키-값 저장소(admin_settings, §32-19) 접근. 첫 용도는 가이드 카드
 * "AI 자동 생성"의 AI 공급자 — Claude API(기존, 기본값)와 로컬 LLM 중에서
 * 관리자가 재배포 없이 고를 수 있게 한다. 설정 행이 아예 없어도(마이그레이션
 * 직후) provider가 'claude'로 잡혀 기존 동작이 그대로 유지된다.
 */

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 관리자 설정을 쓸 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

export type AiProvider = 'claude' | 'local';

export interface CourseGuideAiSettings {
  provider: AiProvider;
  /** 로컬 LLM의 OpenAI 호환 chat completions 엔드포인트(전체 URL) */
  localEndpoint: string;
  localModel: string;
  /** 로컬 서버가 인증을 요구하면 Bearer 토큰으로 씀(선택) */
  localApiKey: string;
}

export const DEFAULT_COURSE_GUIDE_AI_SETTINGS: CourseGuideAiSettings = {
  provider: 'claude',
  localEndpoint: '',
  localModel: '',
  localApiKey: '',
};

const COURSE_GUIDE_AI_SETTINGS_KEY = 'course_guide_ai_provider';

export async function getCourseGuideAiSettings(): Promise<CourseGuideAiSettings> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_settings')
    .select('value')
    .eq('key', COURSE_GUIDE_AI_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value as Partial<CourseGuideAiSettings> | undefined) ?? {};
  return { ...DEFAULT_COURSE_GUIDE_AI_SETTINGS, ...value };
}

export async function saveCourseGuideAiSettings(
  patch: Partial<CourseGuideAiSettings>
): Promise<CourseGuideAiSettings> {
  const sb = requireSupabase();
  const current = await getCourseGuideAiSettings();
  const next: CourseGuideAiSettings = { ...current, ...patch };
  const { error } = await sb
    .from('admin_settings')
    .upsert({ key: COURSE_GUIDE_AI_SETTINGS_KEY, value: next, updated_at: new Date().toISOString() });
  if (error) throw error;
  return next;
}
