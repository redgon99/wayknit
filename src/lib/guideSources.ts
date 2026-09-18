export type GuideSource = {
  url: string;
  label: string;
  host: string;
  origin: boolean;
};

const TRACKING_PARAMS = /^(utm_|utm$|fbclid|gclid|ocid|ref$)/i;

const HOST_LABELS: Record<string, string> = {
  'chatgpt.com': 'ChatGPT 공유',
  'chat.openai.com': 'ChatGPT 공유',
  'diningcode.com': '다이닝코드',
  'visitkorea.or.kr': '한국관광공사',
  'korean.visitkorea.or.kr': '한국관광공사',
  'english.visitkorea.or.kr': 'Visit Korea',
  'access.visitkorea.or.kr': '한국관광공사',
  'emmaru.com': '엠마루',
  'maps.google.com': 'Google 지도',
  'google.com': 'Google',
  'blog.naver.com': '네이버 블로그',
  'naver.com': '네이버',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'instagram.com': 'Instagram',
  'tripadvisor.com': 'Tripadvisor',
  'tripadvisor.co.kr': 'Tripadvisor',
};

export function cleanSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.hash = '';
    const qs = u.searchParams.toString();
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return `${u.origin}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return trimmed;
  }
}

export function sourceHost(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function labelFromCiteAlt(alt: string): string | null {
  const t = alt.trim();
  if (!t) return null;
  const imageCite = t.match(/^Image\s+\d+\s+(.+)$/i);
  const name = (imageCite ? imageCite[1] : t).replace(/\+\d+\s*$/, '').trim();
  if (!name || /^image\s+\d+$/i.test(name)) return null;
  return name;
}

export function labelFromUrl(raw: string): string {
  const host = sourceHost(raw);
  if (!host) return raw;
  if (HOST_LABELS[host]) return HOST_LABELS[host];
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.');
    if (HOST_LABELS[suffix]) return HOST_LABELS[suffix];
  }
  if (host === 'google.com' && /\/maps/i.test(raw)) return 'Google 지도';
  return host;
}

export function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

export function isFaviconUrl(raw: string): boolean {
  return /google\.com\/s2\/favicons/i.test(raw) || /gstatic\.com\/favicon/i.test(raw);
}

/** `[![Image 1](favicon)Visit Korea+1](sourceUrl)` — ChatGPT 공유 본문 */
export const CHATGPT_CITE_RE =
  /\[!\[([^\]]*)\]\((https?:[^)\s]+)\)([^\]]*)\]\((https?:[^)\s]+)\)/g;

export function labelFromCiteCaption(caption: string, fallbackHref: string): string {
  return (
    labelFromCiteAlt(caption.trim()) ||
    caption.replace(/\+\d+\s*$/, '').trim() ||
    labelFromUrl(fallbackHref)
  );
}

export function rewriteChatGptCites(text: string): string {
  const nested = text.replace(
    /\[!\[([^\]]*)\]\((https?:[^)\s]+)\)([^\]]*)\]\((https?:[^)\s]+)\)/g,
    (_all, _alt: string, _img: string, caption: string, href: string) => {
      if (!isHttpUrl(href)) return _all;
      const label = labelFromCiteCaption(caption, href);
      return `([${label}](${cleanSourceUrl(href)}))`;
    }
  );
  return nested.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_all, alt: string, href: string) => {
    if (!isHttpUrl(href) || isFaviconUrl(href)) return _all;
    const label = labelFromCiteAlt(alt) || labelFromUrl(href);
    return `([${label}](${cleanSourceUrl(href)}))`;
  });
}

export function extractMarkdownLinks(md: string): { alt: string; href: string; image: boolean }[] {
  const out: { alt: string; href: string; image: boolean }[] = [];
  const ranges: Array<[number, number]> = [];
  const nestedRe = /\[!\[([^\]]*)\]\((https?:[^)\s]+)\)([^\]]*)\]\((https?:[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = nestedRe.exec(md)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
    out.push({
      alt: (m[3] || m[1] || '').trim(),
      href: m[4] ?? '',
      image: true,
    });
  }
  const simpleRe = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = simpleRe.exec(md)) !== null) {
    if (ranges.some(([a, b]) => m!.index >= a && m!.index < b)) continue;
    const href = m[2] ?? '';
    if (isFaviconUrl(href)) continue;
    out.push({
      alt: m[1] ?? '',
      href,
      image: m[0].startsWith('!['),
    });
  }
  return out;
}

export function collectGuideSources(bodyMd: string, sourceUrls: string[] = []): GuideSource[] {
  const seen = new Set<string>();
  const list: GuideSource[] = [];

  const push = (raw: string, labelHint: string | null, origin: boolean) => {
    if (!isHttpUrl(raw) || isFaviconUrl(raw)) return;
    const url = cleanSourceUrl(raw);
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const host = sourceHost(url);
    list.push({
      url,
      label: labelHint || labelFromUrl(url),
      host,
      origin,
    });
  };

  for (const raw of sourceUrls) {
    push(raw, null, true);
  }
  for (const link of extractMarkdownLinks(bodyMd)) {
    const hint = labelFromCiteAlt(link.alt) || (link.image ? null : link.alt.trim() || null);
    const usable =
      hint && !/^https?:/i.test(hint) && hint.length <= 40 ? hint : null;
    push(link.href, usable, false);
  }
  return list;
}
