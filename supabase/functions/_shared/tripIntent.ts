/**
 * 자연어 여행 조건 → 구조화된 TripIntent (AI 일정 생성 1단계).
 * 스타일은 scenarioGen.ts의 callClaude/parseScenarioJson 패턴을 그대로 따른다
 * (JSON 파싱 실패 시 1회 재시도, haiku 기본 모델).
 */
import type { ScenarioTheme } from './tourScenario.ts';

export const INTENT_THEMES: ScenarioTheme[] = [
  'meditation',
  'wellbeing',
  'shopping',
  'family',
  'honeymoon',
  'night',
  'hallyu',
  'camping',
  'walking',
  'marine',
];

export type Companions = 'parents' | 'kids' | 'couple' | 'solo' | 'friends' | 'unknown';
export type Pace = 'relaxed' | 'normal' | 'busy';

export interface TripIntent {
  /** 사용자가 말한 목적지 원문(예: "강릉"). 지역코드로 변환하지 않고 검색 키워드에 그대로 결합한다 */
  destination: string;
  /** 1~7일로 clamp */
  days: number;
  companions: Companions;
  pace: Pace;
  /** v1 범위 — "많이 안 걷기" 한 가지만 지원 */
  avoidLongWalk: boolean;
  /** SCENARIO_THEME_QUERIES와 같은 10종 중 0개 이상 */
  themes: ScenarioTheme[];
}

const COMPANIONS_VALUES: Companions[] = ['parents', 'kids', 'couple', 'solo', 'friends', 'unknown'];
const PACE_VALUES: Pace[] = ['relaxed', 'normal', 'busy'];

export class DestinationMissingError extends Error {
  constructor() {
    super('목적지를 파악하지 못했습니다.');
    this.name = 'DestinationMissingError';
  }
}

export function buildIntentPrompt(text: string): string {
  return `당신은 한국 국내여행 요청을 구조화된 JSON으로 변환하는 파서입니다.
아래 여행자의 자연어 요청을 분석해 정확히 아래 스키마의 JSON 객체 하나만 출력하세요.
스키마에 없는 필드를 추가하지 말고, 모르는 값은 명시된 기본값을 쓰세요. 절대 관광지 이름을 지어내지 마세요 — 이 단계는 조건 추출만 합니다.

스키마:
{
  "destination": string,   // 여행지 지명(예: "강릉", "속초 고성"). 문장에 명시된 원문 그대로. 전혀 언급이 없으면 빈 문자열 ""
  "days": number,          // 1~7. 명시 안 됐으면 2
  "companions": "parents" | "kids" | "couple" | "solo" | "friends" | "unknown",  // 부모님=parents, 아이/자녀=kids, 애인/신혼=couple, 혼자=solo, 친구=friends, 불명=unknown
  "pace": "relaxed" | "normal" | "busy",  // "여유롭게"/"천천히"=relaxed, "빡빡하게"/"많이 돌아보고"=busy, 불명=normal
  "avoidLongWalk": boolean,  // "많이 안 걷게", "걷는 거 싫어함" 등이 있으면 true, 아니면 false
  "themes": string[]  // 아래 10개 중 해당하는 것만 0개 이상 선택 (문자열 그대로): meditation, wellbeing, shopping, family, honeymoon, night, hallyu, camping, walking, marine
}

여행자 요청:
"""
${text}
"""

반드시 JSON 객체 하나만 출력하세요. 다른 설명 텍스트를 추가하지 마세요.`;
}

function clampDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.min(Math.max(Math.round(n), 1), 7);
}

function normalizeCompanions(value: unknown): Companions {
  const v = String(value ?? '').trim();
  return (COMPANIONS_VALUES as readonly string[]).includes(v) ? (v as Companions) : 'unknown';
}

function normalizePace(value: unknown): Pace {
  const v = String(value ?? '').trim();
  return (PACE_VALUES as readonly string[]).includes(v) ? (v as Pace) : 'normal';
}

function normalizeThemes(value: unknown): ScenarioTheme[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(INTENT_THEMES);
  const out: ScenarioTheme[] = [];
  for (const raw of value) {
    const v = String(raw).trim() as ScenarioTheme;
    if (set.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export function parseIntentJson(text: string): TripIntent {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('claude response is not a valid intent object');
  }
  return {
    destination: String(parsed.destination ?? '').trim(),
    days: clampDays(parsed.days),
    companions: normalizeCompanions(parsed.companions),
    pace: normalizePace(parsed.pace),
    avoidLongWalk: Boolean(parsed.avoidLongWalk),
    themes: normalizeThemes(parsed.themes),
  };
}

async function requestIntentText(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system:
        'Return JSON only, matching the exact schema in the prompt. The JSON must be strictly valid: escape every double-quote and newline inside a string value. No markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return json.content?.find((b) => b.type === 'text')?.text ?? '';
}

/** 실패 시 1회 재시도 후 그래도 실패하면 던진다 — 호출부(edge function)가 502로 응답 */
export async function parseTripIntent(
  text: string,
  apiKey: string,
  model = 'claude-haiku-4-5-20251001'
): Promise<TripIntent> {
  const prompt = buildIntentPrompt(text);
  const raw = await requestIntentText(prompt, apiKey, model);
  let intent: TripIntent;
  try {
    intent = parseIntentJson(raw);
  } catch (firstError) {
    const retryPrompt = `${prompt}\n\nRETRY: Your previous response was not valid JSON (parser error: ${
      firstError instanceof Error ? firstError.message : String(firstError)
    }). Output ONLY a single valid JSON object matching the schema.`;
    const retryRaw = await requestIntentText(retryPrompt, apiKey, model);
    intent = parseIntentJson(retryRaw);
  }
  if (!intent.destination) throw new DestinationMissingError();
  return intent;
}
