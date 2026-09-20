/**
 * 「AI 자동 생성」— 관리자의 커스텀 GPT 프롬프트를 서버(course-guide-generate 함수)로
 * 옮겨 지역만 넣으면 여행안 5개 → 상세 일정 텍스트를 만든다. 결과 텍스트는 기존
 * 붙여넣기 매크로(courseGuideMacro.ts)의 parseCourseGuideText가 그대로 소화하는
 * "시간 | 장소명 | 일정 설명 | 좌표" 표 형식이라 이후 파이프라인은 공유한다(§34).
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export interface CourseOption {
  index: number;
  title: string;
  conditions: string;
  raw: string;
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 합니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

async function invokeGenerate(payload: Record<string, unknown>): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke('course-guide-generate', { body: payload });
  const result = (data ?? {}) as { text?: string; error?: string };
  if (error) throw new Error(result.error || error.message || 'AI 생성에 실패했습니다.');
  if (!result.text) throw new Error('AI 응답이 비어 있습니다.');
  return result.text;
}

export async function proposeCourseOptions(region: string, extra?: string): Promise<string> {
  return invokeGenerate({ action: 'propose', region, extra });
}

export async function buildCourseFromSelection(
  region: string,
  optionsText: string,
  selection: string,
  extra?: string
): Promise<string> {
  return invokeGenerate({ action: 'build', region, extra, optionsText, selection });
}

/** "1. 제목 | 조건들" 줄들을 선택 카드용으로 파싱. 형식이 안 맞으면 빈 배열(원문 그대로 보여주면 됨) */
export function parseCourseOptions(text: string): CourseOption[] {
  const out: CourseOption[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\.\s*(.+?)\s*\|\s*(.+)$/);
    if (!m) continue;
    out.push({ index: Number(m[1]), title: m[2].trim(), conditions: m[3].trim(), raw: line.trim() });
  }
  return out;
}
