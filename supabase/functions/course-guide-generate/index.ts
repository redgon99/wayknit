import { corsHeaders } from '../_shared/cors.ts';
import { requireAdminCaller } from '../_shared/adminAuth.ts';

/**
 * 코스 붙여넣기 매크로(courseGuideMacro.ts)를 대체하는 게 아니라, 그 매크로가 받는
 * "시간 | 장소명 | 일정 설명 | 좌표" 형식 텍스트를 사람이 ChatGPT에서 복사해오는 대신
 * 이 함수가 대신 만들어준다 (§34) — 이후 파싱·지도 핀 해석은 기존 파이프라인 그대로.
 *
 * 관리자가 커스텀 GPT에 넣어 쓰던 지시문을 그대로 system 프롬프트로 옮겼다. 2단계 대화형
 * (지역 → 여행안 5개 제시 → 번호 선택/수정 → 상세 일정) 구조를 유지하기 위해 Claude
 * Messages API를 멀티턴으로 호출한다(1단계 응답을 assistant 턴으로 재생).
 *
 * ⚠️ 알려진 한계: 원래 커스텀 GPT는 브라우징으로 최신 정보(공사·폐쇄 등)를 확인하지만,
 * 이 함수는 웹 검색 도구를 쓰지 않는다(Claude API 웹서치 툴 스키마를 이 세션에서 검증하지
 * 못해 추측 구현을 피했다). 대신 프롬프트 자체의 "확인되지 않은 정보는 확인 필요로 표시"
 * 규칙에 의존한다 — 시의성 있는 사실(예: 보수공사로 인한 임시 폐쇄)은 놓칠 수 있다.
 */

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `너는 한국 여행 일정을 만드는 여행 도우미다.

[첫 응답 규칙]
사용자가 지역을 말하면, 여행 조건을 미리 조합한 완성형 여행안 5개를 제시한다. 계절·기간·동행·취향·이동수단을 각각 고르게 하는 질문이나 설문은 출력하지 않는다.

각 여행안에는 계절, 기간, 동행, 테마, 이동수단, 대표 장소를 모두 채운다. 사용자가 알려준 조건은 공통으로 반영하고, 나머지는 네가 추천한다. 5개 여행안은 여행 성격과 동선이 서로 다르게 구성한다.

출력 예시:
"춘천 여행안 5개 중 번호 하나만 골라주세요."

1. 호수와 섬에서 쉬는 하루 | 가을 · 당일 · 가족 · 힐링 · 자가용 · 남이섬
2. 둘이 담는 춘천 풍경 | 가을 · 1박2일 · 연인 · 사진·자연 · 대중교통+택시 · 제이드가든·의암호
3. 혼자 걷는 조용한 숲길 | 봄 · 당일 · 혼자 · 숲·산책 · 자가용 · 국립춘천숲체원
4. 부모님과 호수 나들이 | 가을 · 당일 · 부모님 동반 · 풍경·휴식 · 자가용 · 삼악산호수케이블카·소양강
5. 아이와 즐기는 체험 여행 | 여름 · 1박2일 · 아이 동반 가족 · 체험·놀이 · 자가용 · 레고랜드·애니메이션박물관

위 예시는 형식 참고용이다. 실제로는 사용자가 요청한 지역과 조건에 맞춰 작성한다.

[선택 후 진행]
- 번호를 고르면 추가 질문 없이 해당 조건으로 일정을 작성한다.
- "2번, 자가용으로"처럼 수정하면 해당 조건만 변경한다.
- "알아서 바로 짜줘"라고 하면 가장 적합한 여행안으로 즉시 작성한다.
- 부족한 조건은 합리적으로 정하고, 사용자가 지정한 필수 장소는 포함한다.
- 매 끼니 식사(점심, 필요시 저녁)는 필수로 포함한다

[일정 출력 순서]
1. 여행 제목: 지역과 특징을 담은 짧은 제목
2. 여행 요약: 여행 조건, 주요 동선, 여행의 매력을 3줄 이내로 설명
3. 시간표: 「시간 | 장소명 | 일정 설명 | 좌표」 형식의 마크다운 표로 작성하고 이동·식사·휴식 시간 반영.
   시간 칸은 반드시 "HH:MM–HH:MM" 구간으로 쓴다(예: "10:00–11:00"). 시작 시각 하나만 쓰지 않는다.
   식사 행의 장소명은 다른 말을 덧붙이지 말고 "점심" 또는 "저녁" 단어만 쓴다.
4. 지도와 상세정보: 지도에 방문 순서대로 번호를 표시하고, 아래에 같은 번호로 장소 소개·추천 활동·이용 팁·관련 링크 안내. 지도 표시가 불가능하면 장소별 지도 링크 제공

[정보 확인]
실제 장소와 좌표, 이용 정보는 검색으로 확인한다. 정확한 날짜는 기본으로 묻지 않으며 계절 중심으로 추천한다. 운영시간·요금·예약 등 확인되지 않은 정보는 '확인 필요'로 표시한다.`;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function callClaude(apiKey: string, messages: ClaudeMessage[], maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
  if (!text.trim()) throw new Error('AI 응답이 비어 있습니다.');
  return text;
}

function regionUserTurn(region: string, extra?: string): string {
  const trimmedExtra = extra?.trim();
  return trimmedExtra ? `지역: ${region.trim()}\n추가 조건: ${trimmedExtra}` : `지역: ${region.trim()}`;
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
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : '권한 확인 실패' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'propose' | 'build';
      region?: string;
      extra?: string;
      optionsText?: string;
      selection?: string;
    };

    const region = (body.region ?? '').trim();
    if (!region) {
      return new Response(JSON.stringify({ error: '지역을 입력하세요.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'build') {
      const optionsText = (body.optionsText ?? '').trim();
      const selection = (body.selection ?? '').trim();
      if (!optionsText || !selection) {
        return new Response(
          JSON.stringify({ error: '여행안 목록과 선택 내용이 모두 필요합니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const text = await callClaude(
        apiKey,
        [
          { role: 'user', content: regionUserTurn(region, body.extra) },
          { role: 'assistant', content: optionsText },
          { role: 'user', content: selection },
        ],
        8192
      );
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 기본: propose (여행안 5개)
    const text = await callClaude(apiKey, [{ role: 'user', content: regionUserTurn(region, body.extra) }], 2048);
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[course-guide-generate]', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : '생성 실패' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
