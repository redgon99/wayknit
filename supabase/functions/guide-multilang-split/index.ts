import { corsHeaders } from '../_shared/cors.ts';
import { requireAdminCaller } from '../_shared/adminAuth.ts';

/**
 * 다국어 가이드 붙여넣기(2026-09-20) — AI 보조 경로.
 *
 * 클라이언트(multiLangGuideMacro.ts)가 먼저 국기 이모지+언어명 헤더로
 * 무료 규칙 기반 분리를 시도하고, 그게 실패할 때만(형식이 다르거나
 * 헤더를 못 찾을 때) 이 함수를 부른다 — 매번 AI를 쓰지 않는다.
 *
 * §31-26의 교훈(verify_jwt=true만으론 로그인 여부를 못 가린다)을 반영해
 * requireAdminCaller()로 호출자의 실제 관리자 권한을 다시 확인한다.
 */

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'];
const MAX_INPUT_CHARS = 20000;

interface Section {
  locale: string;
  title: string;
  bodyMd: string;
}

function parseSectionsJson(text: string): Section[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as { sections?: unknown };
  const list = Array.isArray(parsed.sections) ? parsed.sections : [];
  const out: Section[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const locale = String((item as Record<string, unknown>).locale ?? '');
    const title = String((item as Record<string, unknown>).title ?? '').trim();
    const bodyMd = String((item as Record<string, unknown>).bodyMd ?? '').trim();
    if (!SUPPORTED_LOCALES.includes(locale) || !title || !bodyMd) continue;
    out.push({ locale, title, bodyMd });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await requireAdminCaller(req);

    const body = (await req.json().catch(() => ({}))) as { text?: string };
    const text = (body.text ?? '').trim();
    if (!text) throw new Error('text가 필요합니다.');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `아래는 같은 여행 가이드 내용을 여러 언어로 반복해서 적은 원문입니다.
언어별 구간으로 나눠 제목과 본문을 뽑으세요.

규칙:
- locale은 반드시 다음 중 하나만 사용: ${SUPPORTED_LOCALES.join(', ')}
- 특정 언어에 속하지 않는 잡담·편집 메모(예: 글쓴이가 남긴 활용 제안)는
  어느 섹션에도 넣지 말고 버릴 것
- title은 그 언어 섹션의 제목 한 줄(마크다운 기호 없이)
- bodyMd는 제목을 뺀 본문 전체 — 원문의 문장·서식을 그대로 유지(요약하지 말 것)
- 같은 언어가 여러 번 나오면 하나로만 합치지 말고 실제로 다른 섹션이면
  각각의 title/bodyMd로 분리

원문:
${text.slice(0, MAX_INPUT_CHARS)}

반드시 JSON만 응답하세요. 형식: {"sections":[{"locale":"ko","title":"...","bodyMd":"..."}]}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textOut = json.content?.find((b) => b.type === 'text')?.text ?? '';
    const sections = parseSectionsJson(textOut);

    return new Response(JSON.stringify({ sections }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('guide-multilang-split failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
