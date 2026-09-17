import { corsHeaders } from '../_shared/cors.ts';
import {
  extractCourseTextFromShareHtml,
  isChatGptShareUrl,
} from '../_shared/chatgptShare.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchShareHtml(shareUrl: string): Promise<{ html: string; via: string }> {
  // 1) 직접 조회 (짧으면 성공, ChatGPT가 막으면 타임아웃)
  try {
    const res = await fetchWithTimeout(
      shareUrl,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      },
      8_000
    );
    if (res.ok) {
      const html = await res.text();
      if (html.length > 2_000 && (html.includes('streamController') || /[가-힣]{10,}/.test(html))) {
        return { html, via: 'direct' };
      }
    }
  } catch {
    /* fall through */
  }

  // 2) Jina Reader 폴백 — ChatGPT가 봇/데이터센터 IP를 막을 때
  const jinaUrl = `https://r.jina.ai/${shareUrl}`;
  const jina = await fetchWithTimeout(
    jinaUrl,
    {
      headers: {
        Accept: 'text/plain',
        'User-Agent': BROWSER_UA,
        'X-Return-Format': 'markdown',
      },
      redirect: 'follow',
    },
    25_000
  );
  if (!jina.ok) {
    throw new Error(
      `공유 페이지를 가져오지 못했습니다 (jina ${jina.status}). 잠시 후 다시 시도하거나 「본문 붙여넣기」 탭을 사용하세요.`
    );
  }
  const text = await jina.text();
  if (!text.trim()) {
    throw new Error('공유 본문이 비어 있습니다. 공개 공유인지 확인하세요.');
  }
  return { html: text, via: 'jina' };
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
    const body = (await req.json()) as { url?: string };
    const url = (body.url ?? '').trim();
    if (!url) throw new Error('url이 필요합니다.');
    if (!isChatGptShareUrl(url)) {
      throw new Error('chatgpt.com/share/… 형식의 공개 공유 링크만 지원합니다.');
    }

    const normalized = (url.includes('://') ? url : `https://${url}`).split('?')[0];
    const { html, via } = await fetchShareHtml(normalized);
    if (html.length > 2_500_000) {
      throw new Error('공유 페이지가 너무 큽니다.');
    }

    const { cleanedText, titleHint } = extractCourseTextFromShareHtml(html);
    return new Response(
      JSON.stringify({
        sourceUrl: normalized,
        titleHint: titleHint ?? null,
        cleanedText,
        via,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === 'AbortError'
          ? '공유 페이지 응답이 너무 오래 걸립니다. 「본문 붙여넣기」 탭을 사용하거나 잠시 후 다시 시도하세요.'
          : e.message
        : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
