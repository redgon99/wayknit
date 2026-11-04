/**
 * 검색엔진·AI 크롤러용 가이드 공용 코드 (Netlify Edge, Deno).
 *
 * - 앱은 CSR SPA라 JS를 실행하지 않는 봇(ChatGPT·Claude·Perplexity 크롤러 등)은 본문을 못 본다.
 *   og-meta.ts가 봇 요청에 한해 이 파일로 만든 본문 HTML·구조화 데이터(JSON-LD)를 넣어 준다.
 * - 마크다운 규칙은 화면 렌더러(src/lib/guideMarkdown.tsx)를, 언어 선택은 pickGuideContent(src/lib/guides.ts)를 따른다.
 *   사람이 보는 화면과 같은 내용만 담는다(다른 내용을 봇에만 보여 주면 검색엔진 정책 위반).
 * - FAQ 추출 규칙은 ktrip 콘텐츠 에이전트(lib/content/seo.ts)와 같다. 바꿀 때 함께 바꾼다.
 */

declare const Netlify: { env: { get(key: string): string | undefined } };

export const SITE_NAME = '여로담 · Wayknit';
export const LOCALES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

/**
 * 검색엔진에 알릴 대표 주소. wayknit.netlify.app과 wayknit.com이 같은 사이트를 보여 주므로
 * canonical·사이트맵 주소를 하나로 모은다(바꾸려면 Netlify 환경변수 CANONICAL_SITE_URL).
 */
export function siteOrigin(): string {
  return (Netlify.env.get('CANONICAL_SITE_URL') ?? 'https://wayknit.com').replace(/\/+$/, '');
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function pathWithLocale(path: string, locale: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  if (clean === '/') return `/${locale}`;
  return `/${locale}${clean}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

// ---------- Supabase (anon, 공개 행만) ----------

function supabaseConfig(): { url: string; key: string } | null {
  const url = Netlify.env.get('VITE_SUPABASE_URL') ?? Netlify.env.get('SUPABASE_URL');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY') ?? Netlify.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

export async function supabaseSelect<T>(path: string, timeoutMs = 3000): Promise<T[] | null> {
  const config = supabaseConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

// ---------- 가이드 ----------

export type GuideText = { title: string; summary: string; bodyMd: string };
export type GuidePin = { order: number; name: string; lat: number; lng: number };
export type GuideRecord = {
  slug: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  locale: string | null;
  kind: string | null;
  topic_tags: string[] | null;
  translations: Record<string, Partial<GuideText>> | null;
  course_pins: GuidePin[] | null;
  source_urls: string[] | null;
  published_at: string | null;
  updated_at: string | null;
};

export const GUIDE_SELECT =
  'slug,title,summary,body_md,locale,kind,topic_tags,translations,course_pins,source_urls,published_at,updated_at';

const baseLocale = (row: GuideRecord) => row.locale || DEFAULT_LOCALE;

function translationOf(row: GuideRecord, locale: string): GuideText | null {
  const t = row.translations?.[locale];
  if (!t?.title || !t.bodyMd) return null;
  return { title: t.title, summary: t.summary ?? '', bodyMd: t.bodyMd };
}

/** 이 글이 실제로 가진 언어(대표 언어 + 번역). 사이트맵·hreflang에는 이 언어만 알린다. */
export function guideLocales(row: GuideRecord): string[] {
  const out = [baseLocale(row)];
  for (const loc of Object.keys(row.translations ?? {})) {
    if (!out.includes(loc) && translationOf(row, loc)) out.push(loc);
  }
  return out;
}

/** pickGuideContent와 같은 규칙: 요청 언어 → (중국어 간체·번체 서로) → 대표 언어. */
export function pickContent(row: GuideRecord, locale: string): GuideText & { locale: string } {
  const base = { locale: baseLocale(row), title: row.title, summary: row.summary ?? '', bodyMd: row.body_md ?? '' };
  if (locale === base.locale) return base;
  const exact = translationOf(row, locale);
  if (exact) return { locale, ...exact };
  if (locale === 'zh-CN' || locale === 'zh-TW') {
    const alt = locale === 'zh-CN' ? 'zh-TW' : 'zh-CN';
    const t = translationOf(row, alt);
    if (t) return { locale: alt, ...t };
  }
  return base;
}

// ---------- 마크다운 → HTML (화면 렌더러와 같은 규칙) ----------

const GUIDE_PHOTO_HOSTS = ['tong.visitkorea.or.kr'];

const isHttpUrl = (raw: string) => /^https?:\/\//i.test(raw.trim());
const isFaviconUrl = (raw: string) => /google\.com\/s2\/favicons/i.test(raw) || /gstatic\.com\/favicon/i.test(raw);

export function guidePhotoUrl(raw: string): string | null {
  if (!isHttpUrl(raw)) return null;
  try {
    const u = new URL(raw.trim());
    if (!GUIDE_PHOTO_HOSTS.includes(u.hostname)) return null;
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return null;
  }
}

function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

function linkLabel(alt: string, href: string): string {
  const named = alt.trim();
  if (named && !/^https?:/i.test(named) && named.length <= 40) return named;
  return hostLabel(href);
}

function anchor(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" rel="noopener nofollow">${escapeHtml(label)}</a>`;
}

function inline(text: string): string {
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[!\[[^\]]*\]\([^)]+\)[^\]]*\]\([^)]+\)|!?\[[^\]]*\]\([^)]+\))/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      out += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith('*') && !token.startsWith('*[')) {
      out += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    } else {
      const nested = token.match(/^\[!\[([^\]]*)\]\(([^)]+)\)([^\]]*)\]\(([^)]+)\)$/);
      const simple = nested ? null : token.match(/^!?\[([^\]]*)\]\(([^)]+)\)$/);
      if (nested && isHttpUrl(nested[4])) {
        out += anchor(nested[4].trim(), linkLabel(nested[3], nested[4].trim()));
      } else if (simple) {
        const href = simple[2].trim();
        if (isHttpUrl(href) && !isFaviconUrl(href)) out += anchor(href, linkLabel(simple[1], href));
        else if (href.startsWith('/') && !href.startsWith('//')) out += anchor(href, simple[1] || href);
        else out += escapeHtml(simple[1]);
      }
    }
    last = m.index + token.length;
  }
  return out + escapeHtml(text.slice(last));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    const tag = ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`);
    list = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const t = lines[idx].trim();
    if (!t) {
      flush();
      continue;
    }
    if (t.includes('|') && idx + 1 < lines.length && isTableSeparator(lines[idx + 1].trim())) {
      flush();
      const headers = splitTableRow(t);
      idx += 2;
      const rows: string[][] = [];
      while (idx < lines.length && lines[idx].trim().includes('|')) {
        rows.push(splitTableRow(lines[idx].trim()));
        idx++;
      }
      idx--;
      out.push(
        `<table><thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${headers.map((_, ci) => `<td>${inline(r[ci] ?? '')}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    const photo = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    const photoSrc = photo ? guidePhotoUrl(photo[2]) : null;
    if (photo && photoSrc) {
      flush();
      const alt = photo[1].trim();
      out.push(
        `<figure><img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(alt)}" loading="lazy" />${
          alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''
        }</figure>`,
      );
      continue;
    }
    const ol = t.match(/^\d+\.\s+(.*)$/);
    const ul = t.match(/^[-*]\s+(.*)$/);
    if (ol || ul) {
      if (list.length && ordered !== Boolean(ol)) flush();
      ordered = Boolean(ol);
      list.push((ol ?? ul)![1]);
      continue;
    }
    flush();
    if (t.startsWith('### ')) out.push(`<h3>${inline(t.slice(4))}</h3>`);
    else if (t.startsWith('## ')) out.push(`<h2>${inline(t.slice(3))}</h2>`);
    else if (t.startsWith('# ')) out.push(`<h1>${inline(t.slice(2))}</h1>`);
    else out.push(`<p>${inline(t)}</p>`);
  }
  flush();
  return out.join('\n');
}

/** 본문의 한국관광공사 사진 주소(공유 미리보기 이미지·구조화 데이터용). */
export function guidePhotos(md: string): string[] {
  const urls: string[] = [];
  for (const line of md.split('\n')) {
    const m = line.trim().match(/^!\[[^\]]*\]\(([^)\s]+)\)$/);
    const url = m ? guidePhotoUrl(m[1]) : null;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

// ---------- FAQ (ktrip lib/content/seo.ts와 같은 규칙) ----------

const FAQ_HEADING = /faq|frequently asked|자주\s*묻는|よくある質問|常见问题|常見問題/i;
const stripInline = (s: string) =>
  s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();

export function extractFaq(md: string): { q: string; a: string }[] {
  const items: { q: string; a: string[] }[] = [];
  let inFaq = false;
  let cur: { q: string; a: string[] } | null = null;
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (/^#{1,2}\s/.test(t)) {
      inFaq = FAQ_HEADING.test(t);
      cur = null;
      continue;
    }
    if (!inFaq || !t || /^!\[/.test(t) || /^\[\[photo:/i.test(t)) continue;
    const h3 = t.match(/^###\s+(.+)$/);
    const boldInline = t.match(/^\*\*(.+?[?？])\*\*\s*(.*)$/);
    let q: string | null = null;
    let rest = '';
    if (h3) q = h3[1];
    else if (boldInline) [q, rest] = [boldInline[1], boldInline[2]];
    else if (/[?？]$/.test(t) && t.length <= 200 && !/^[-*]\s/.test(t)) q = t;
    if (q) {
      cur = { q: stripInline(q.replace(/^(Q\d*[.:)]|질문\s*\d*[.:])\s*/i, '')), a: [] };
      items.push(cur);
      if (rest) cur.a.push(stripInline(rest));
    } else if (cur) {
      cur.a.push(stripInline(t.replace(/^[-*]\s+/, '').replace(/^(A[.:)]|답[.:])\s*/i, '')));
    }
  }
  return items
    .filter((i) => i.q && i.a.length)
    .slice(0, 10)
    .map((i) => ({ q: i.q, a: i.a.join(' ').slice(0, 1000) }));
}

// ---------- 화면 문구(봇용 HTML) ----------

const GUIDES_LABEL: Record<string, string> = {
  ko: '여행 가이드',
  en: 'Korea travel guides',
  ja: '韓国旅行ガイド',
  'zh-CN': '韩国旅行指南',
  'zh-TW': '韓國旅行指南',
  es: 'Guías de viaje por Corea',
  fr: 'Guides de voyage en Corée',
  de: 'Korea-Reiseführer',
  ru: 'Путеводители по Корее',
};
const GUIDES_DESCRIPTION: Record<string, string> = {
  ko: '외국인 여행자를 위한 한국 여행 가이드 — 코스, 음식, 준비, 실용 정보를 한국관광공사 자료와 함께 정리했습니다.',
  en: 'Korea travel guides for foreign visitors: routes, food, preparation and practical tips, checked against Korea Tourism Organization data.',
  ja: '外国人旅行者のための韓国旅行ガイド。コース、グルメ、準備、実用情報をまとめました。',
  'zh-CN': '面向外国游客的韩国旅行指南：路线、美食、出行准备与实用信息。',
  'zh-TW': '為外國旅客整理的韓國旅行指南：路線、美食、行前準備與實用資訊。',
};
const UPDATED_LABEL: Record<string, string> = { ko: '마지막 업데이트', en: 'Last updated', ja: '最終更新', 'zh-CN': '最后更新', 'zh-TW': '最後更新' };
const SOURCES_LABEL: Record<string, string> = { ko: '출처', en: 'Sources', ja: '出典', 'zh-CN': '来源', 'zh-TW': '來源' };

export const guidesLabel = (locale: string) => GUIDES_LABEL[locale] ?? GUIDES_LABEL.en;
export const guidesDescription = (locale: string) => GUIDES_DESCRIPTION[locale] ?? GUIDES_DESCRIPTION.en;
const label = (map: Record<string, string>, locale: string) => map[locale] ?? map.en;

export function guideUrl(origin: string, slug: string, locale: string): string {
  return `${origin}${pathWithLocale(`/guides/${encodeURIComponent(slug)}`, locale)}`;
}

/** 글 상세의 봇용 본문(제목·요약·본문·업데이트 날짜·출처). 화면과 같은 내용. */
export function guideArticleHtml(row: GuideRecord, content: GuideText & { locale: string }, origin: string): string {
  const updated = (row.updated_at ?? row.published_at ?? '').slice(0, 10);
  const photos = new Set(guidePhotos(content.bodyMd));
  const sources = (row.source_urls ?? []).filter((u) => isHttpUrl(u) && !photos.has(u)).slice(0, 8);
  return [
    '<article class="guides-shell guides-detail">',
    `<nav><a href="${escapeHtml(`${origin}${pathWithLocale('/guides', content.locale)}`)}">${escapeHtml(guidesLabel(content.locale))}</a></nav>`,
    `<h1>${escapeHtml(content.title)}</h1>`,
    content.summary ? `<p class="guides-detail-summary">${escapeHtml(content.summary)}</p>` : '',
    updated ? `<p><time datetime="${updated}">${escapeHtml(label(UPDATED_LABEL, content.locale))}: ${updated}</time></p>` : '',
    `<div class="guides-body">${markdownToHtml(content.bodyMd)}</div>`,
    sources.length
      ? `<section class="guides-sources"><h2>${escapeHtml(label(SOURCES_LABEL, content.locale))}</h2><ul>${sources
          .map((u) => `<li>${anchor(u, hostLabel(u))}</li>`)
          .join('')}</ul></section>`
      : '',
    '</article>',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 구조화 데이터: Article + BreadcrumbList + (FAQ가 있으면) FAQPage. 장소는 좌표와 함께 TouristAttraction으로. */
export function guideJsonLd(row: GuideRecord, content: GuideText & { locale: string }, origin: string): Record<string, unknown> {
  const url = guideUrl(origin, row.slug, content.locale);
  const photos = guidePhotos(content.bodyMd);
  const faq = extractFaq(content.bodyMd);
  const org = { '@type': 'Organization', '@id': `${origin}/#org`, name: 'Wayknit', alternateName: '여로담', url: origin };
  const places = (row.course_pins ?? [])
    .filter((p) => p?.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 12)
    .map((p) => ({
      '@type': 'TouristAttraction',
      name: p.name,
      geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    }));
  const article: Record<string, unknown> = {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: truncate(content.title, 110),
    description: content.summary ? truncate(content.summary, 300) : undefined,
    inLanguage: content.locale,
    url,
    mainEntityOfPage: url,
    datePublished: row.published_at ?? undefined,
    dateModified: row.updated_at ?? row.published_at ?? undefined,
    image: photos.length ? photos.slice(0, 4) : undefined,
    author: org,
    publisher: org,
    keywords: (row.topic_tags ?? []).filter((t) => t && t !== 'ktrip').join(', ') || undefined,
    mentions: places.length ? places : undefined,
    citation: (row.source_urls ?? []).filter((u) => isHttpUrl(u) && !photos.includes(u)).slice(0, 8),
  };
  const graph: Record<string, unknown>[] = [
    article,
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wayknit', item: `${origin}${pathWithLocale('/', content.locale)}` },
        { '@type': 'ListItem', position: 2, name: guidesLabel(content.locale), item: `${origin}${pathWithLocale('/guides', content.locale)}` },
        { '@type': 'ListItem', position: 3, name: content.title, item: url },
      ],
    },
  ];
  if (faq.length >= 2) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: content.locale,
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** <script type="application/ld+json"> — 본문 문자열이 스크립트를 닫지 못하게 '<'를 이스케이프. */
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** 가이드 목록(봇용): 각 글로 가는 링크. 크롤러가 사이트맵 없이도 새 글을 찾게 한다. */
export type GuideListItem = { slug: string; title: string; summary: string | null; locale: string | null; lt: string | null; ls: string | null };

export function guideListSelect(locale: string): string {
  const key = `"${locale.replace(/"/g, '')}"`;
  return `guide_articles?select=slug,title,summary,locale,lt:translations->${key}->>title,ls:translations->${key}->>summary&status=eq.published&order=published_at.desc&limit=100`;
}

export function guideListHtml(rows: GuideListItem[], locale: string, origin: string): string {
  const items = rows.map((r) => {
    const own = (r.locale || DEFAULT_LOCALE) === locale;
    const translated = !own && r.lt;
    const title = translated ? r.lt! : r.title;
    const summary = translated ? r.ls : r.summary;
    const loc = own || translated ? locale : r.locale || DEFAULT_LOCALE;
    return `<li><a href="${escapeHtml(guideUrl(origin, r.slug, loc))}">${escapeHtml(title)}</a>${
      summary ? `<p>${escapeHtml(truncate(summary, 200))}</p>` : ''
    }</li>`;
  });
  return [
    '<main class="guides-page"><section class="guides-shell">',
    `<h1>${escapeHtml(guidesLabel(locale))}</h1>`,
    `<p>${escapeHtml(guidesDescription(locale))}</p>`,
    `<ul>${items.join('\n')}</ul>`,
    '</section></main>',
  ].join('\n');
}
