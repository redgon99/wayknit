/**
 * Deno Edge용 — src/lib/chatgptShareParse.ts 와 동일 로직 유지.
 */
export function isChatGptShareUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim().includes('://') ? raw.trim() : `https://${raw.trim()}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'chatgpt.com' && host !== 'chat.openai.com') return false;
    return /^\/share\/[0-9a-fA-F-]{8,}/.test(u.pathname);
  } catch {
    return false;
  }
}

export function cleanChatGptMarkup(text: string): string {
  return text
    .replace(/genui[\s\S]*?/g, '')
    .replace(/image_group[\s\S]*?/g, '')
    .replace(/entity\[[^\]]*,\s*"([^"]+)"\]/g, '$1')
    .replace(/cite[\s\S]*?/g, '')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unescapeFlightChunk(escaped: string): string {
  let out = '';
  for (let i = 0; i < escaped.length; i++) {
    if (escaped[i] === '\\' && i + 1 < escaped.length) {
      const n = escaped[i + 1];
      if (n === 'n') {
        out += '\n';
        i++;
        continue;
      }
      if (n === 'r') {
        out += '\r';
        i++;
        continue;
      }
      if (n === 't') {
        out += '\t';
        i++;
        continue;
      }
      if (n === '"' || n === '\\' || n === '/') {
        out += n;
        i++;
        continue;
      }
      if (n === 'u' && /^[0-9a-fA-F]{4}/.test(escaped.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(escaped.slice(i + 2, i + 6), 16));
        i += 5;
        continue;
      }
    }
    out += escaped[i];
  }
  return out;
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (/[가-힣]/.test(value) && value.length >= 40) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
}

function scoreItineraryText(t: string): number {
  let score = t.length;
  if (/시간표|하루 일정|추천 일정|일차/.test(t)) score += 5000;
  if (/\d{1,2}:\d{2}/.test(t)) score += 2000;
  if (/\|.*시간.*\|/.test(t) || /\| --- \|/.test(t)) score += 3000;
  if (/If you want/i.test(t)) score -= 500;
  return score;
}

function extractFromFlightHtml(html: string): string | null {
  const marker = 'streamController.enqueue("';
  let from = 0;
  const candidates: string[] = [];
  while (true) {
    const start = html.indexOf(marker, from);
    if (start < 0) break;
    let i = start + marker.length;
    let raw = '';
    while (i < html.length) {
      if (html[i] === '\\' && html[i + 1] === '"') {
        raw += '\\"';
        i += 2;
        continue;
      }
      if (html[i] === '\\' && html[i + 1] === '\\') {
        raw += '\\\\';
        i += 2;
        continue;
      }
      if (html[i] === '"') break;
      raw += html[i];
      i++;
    }
    from = i + 1;
    try {
      const jsonText = unescapeFlightChunk(raw);
      const data = JSON.parse(jsonText);
      const strings: string[] = [];
      collectStrings(data, strings);
      candidates.push(...strings);
    } catch {
      /* ignore */
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => scoreItineraryText(b) - scoreItineraryText(a));
  return candidates[0] ?? null;
}

function extractTitleHint(html: string, body: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) {
    const t = m[1].replace(/\s*[|·\-].*$/, '').replace(/^ChatGPT\s*-\s*/i, '').trim();
    if (t && t.length >= 2 && t.length <= 80) return t;
  }
  const h = body.match(/^#\s+(.+)$/m);
  return h?.[1]?.trim();
}

export function extractCourseTextFromShareHtml(html: string): {
  cleanedText: string;
  titleHint?: string;
} {
  // Jina markdown / 이미 일정 본문인 경우
  if (
    !html.includes('<html') &&
    !html.includes('streamController.enqueue') &&
    /\d{1,2}:\d{2}/.test(html) &&
    /[가-힣]/.test(html)
  ) {
    let cleaned = cleanChatGptMarkup(html);
    cleaned = cleaned.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').trim();
    cleaned = cleaned.replace(/^Markdown Content:\s*/i, '').trim();
    cleaned = cleaned.replace(/If you want[\s\S]*$/i, '').trim();
    if (/\d{1,2}:\d{2}/.test(cleaned)) {
      return {
        cleanedText: cleaned,
        titleHint: extractTitleHint(html, cleaned),
      };
    }
  }

  const flight = extractFromFlightHtml(html);
  let raw = flight;
  if (!raw) {
    const blocks = html.match(/[\uac00-\ud7a3][^<]{80,}/g) ?? [];
    raw = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  }
  if (!raw.trim()) {
    throw new Error('공유 페이지에서 일정 본문을 찾지 못했습니다. 공개 공유 링크인지 확인하세요.');
  }
  let cleaned = cleanChatGptMarkup(raw);
  cleaned = cleaned.replace(/If you want[\s\S]*$/i, '').trim();
  cleaned = cleaned.replace(/\n-\s*[가-힣].*제안해줘[\s\S]*$/m, '').trim();
  if (!/\d{1,2}:\d{2}/.test(cleaned)) {
    throw new Error('시간표(예: 09:00~10:00)를 찾지 못했습니다. 일정 표가 있는 공유인지 확인하세요.');
  }
  return {
    cleanedText: cleaned,
    titleHint: extractTitleHint(html, cleaned),
  };
}
