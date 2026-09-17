import { corsHeaders } from '../_shared/cors.ts';
import { decodeHtmlEntities } from '../_shared/htmlEntities.ts';
import {
  finishRun,
  getServiceClient,
  listActiveKeywords,
  startRun,
  upsertRawItems,
  type RawItemInput,
} from '../_shared/insightDb.ts';
import {
  isWithinCollectionPeriod,
  parseCollectionPeriod,
  periodHasFilter,
  toRfc3339,
  type CollectionPeriod,
  type CollectionPeriodInput,
} from '../_shared/insightPeriod.ts';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_VIDEOS_PER_KEYWORD = 5;
const MAX_COMMENTS_PER_VIDEO = 20;

interface YoutubeSearchItem {
  id?: { videoId?: string };
  snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string };
}

interface YoutubeCommentThreadItem {
  id?: string;
  snippet?: {
    topLevelComment?: {
      snippet?: {
        textDisplay?: string;
        authorDisplayName?: string;
        publishedAt?: string;
      };
    };
  };
}

async function searchVideos(
  keyword: string,
  apiKey: string,
  period: CollectionPeriod
): Promise<YoutubeSearchItem[]> {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', keyword);
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', periodHasFilter(period) ? 'date' : 'relevance');
  url.searchParams.set('maxResults', String(MAX_VIDEOS_PER_KEYWORD));
  url.searchParams.set('key', apiKey);
  if (period.fromMs != null) url.searchParams.set('publishedAfter', toRfc3339(period.fromMs));
  if (period.toMs != null) url.searchParams.set('publishedBefore', toRfc3339(period.toMs));
  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error('youtube search failed', keyword, res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { items?: YoutubeSearchItem[] };
  return json.items ?? [];
}

async function fetchComments(
  videoId: string,
  apiKey: string
): Promise<YoutubeCommentThreadItem[]> {
  const url = new URL(`${YOUTUBE_API_BASE}/commentThreads`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('maxResults', String(MAX_COMMENTS_PER_VIDEO));
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { items?: YoutubeCommentThreadItem[] };
  return json.items ?? [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('YOUTUBE_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: CollectionPeriodInput = {};
  try {
    if (req.method === 'POST') {
      body = ((await req.json()) as CollectionPeriodInput) ?? {};
    }
  } catch {
    body = {};
  }
  const period = parseCollectionPeriod(body);

  const sb = getServiceClient();
  const runId = await startRun(sb, 'youtube');

  try {
    const keywords = await listActiveKeywords(sb, ['youtube']);
    const items = new Map<string, RawItemInput>();

    for (const { keyword } of keywords) {
      const videos = await searchVideos(keyword, apiKey, period);
      for (const video of videos) {
        const videoId = video.id?.videoId;
        if (!videoId) continue;
        const publishedAt = video.snippet?.publishedAt ?? null;
        if (!isWithinCollectionPeriod(publishedAt, period)) continue;

        items.set(`video:${videoId}`, {
          source: 'youtube',
          externalId: `video:${videoId}`,
          title: decodeHtmlEntities(video.snippet?.title ?? null),
          content: decodeHtmlEntities(video.snippet?.description ?? null),
          author: decodeHtmlEntities(video.snippet?.channelTitle ?? null),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          sourceCreatedAt: publishedAt,
          rawPayload: { keyword, kind: 'video', period: period.label },
        });

        const comments = await fetchComments(videoId, apiKey);
        for (const thread of comments) {
          const threadId = thread.id;
          const snippet = thread.snippet?.topLevelComment?.snippet;
          if (!threadId || !snippet?.textDisplay) continue;
          const commentAt = snippet.publishedAt ?? null;
          if (!isWithinCollectionPeriod(commentAt, period)) continue;
          items.set(`comment:${threadId}`, {
            source: 'youtube',
            externalId: `comment:${threadId}`,
            title: decodeHtmlEntities(video.snippet?.title ?? null),
            content: decodeHtmlEntities(snippet.textDisplay),
            author: decodeHtmlEntities(snippet.authorDisplayName ?? null),
            url: `https://www.youtube.com/watch?v=${videoId}&lc=${threadId}`,
            sourceCreatedAt: commentAt,
            rawPayload: { keyword, kind: 'comment', videoId, period: period.label },
          });
        }
      }
    }

    const itemsCollected = await upsertRawItems(sb, [...items.values()]);
    await finishRun(sb, runId, { status: 'success', itemsCollected });

    return new Response(JSON.stringify({ itemsCollected, period: period.label }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-collect-youtube failed', message);
    await finishRun(sb, runId, { status: 'error', errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
