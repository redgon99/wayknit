/**
 * /llms.txt — AI 도구가 사이트를 이해하도록 돕는 안내 파일(llmstxt.org 제안 형식).
 * 아직 표준이 아니어서 효과는 불확실하지만 비용이 거의 없어 둔다. 공개 가이드 목록을 요청할 때 DB에서 만든다.
 */

import { DEFAULT_LOCALE, guideListSelect, guideUrl, siteOrigin, supabaseSelect, truncate, type GuideListItem } from '../edge-lib/guides.ts';

export default async (_request: Request, context: { next: () => Promise<Response> }) => {
  const rows = await supabaseSelect<GuideListItem>(guideListSelect('en'), 4000);
  if (!rows) return context.next();
  const origin = siteOrigin();

  const items = rows.map((r) => {
    const english = (r.locale || DEFAULT_LOCALE) === 'en' ? { title: r.title, summary: r.summary } : r.lt ? { title: r.lt, summary: r.ls } : null;
    const title = english?.title ?? r.title;
    const summary = english ? english.summary : r.summary;
    const loc = english ? 'en' : r.locale || DEFAULT_LOCALE;
    return `- [${title.replace(/[[\]]/g, '')}](${guideUrl(origin, r.slug, loc)})${summary ? `: ${truncate(summary, 220)}` : ''}`;
  });

  const body = [
    '# Wayknit (여로담)',
    '',
    '> Wayknit is a Korea trip planner for foreign visitors: save the places you want to visit, then turn them into a multi-day itinerary with real travel times. The travel guides below are written for foreign travelers and published after review by the Wayknit editors; many use Korea Tourism Organization data for addresses and photos. Most guides are available in Korean, English, Japanese and Simplified Chinese (URL prefixes /en, /ja, /zh-CN; Korean has no prefix).',
    '',
    '## Travel guides',
    '',
    ...items,
    '',
    '## Optional',
    '',
    `- [All guides](${origin}/en/guides)`,
    `- [Trip planner](${origin}/en/plan)`,
    `- [Sitemap](${origin}/sitemap.xml)`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};

export const config = { path: '/llms.txt' };
