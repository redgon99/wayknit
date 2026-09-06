import { corsHeaders } from '../_shared/cors.ts';
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
  type CollectionPeriodInput,
} from '../_shared/insightPeriod.ts';

const USER_AGENT = 'wayknit-market-insights/1.0 (admin research bot)';
const POSTS_PER_SUBREDDIT = 25;

interface RedditPostData {
  id: string;
  title: string;
  selftext?: string;
  author?: string;
  permalink?: string;
  created_utc?: number;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`reddit token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('reddit token response missing access_token');
  return json.access_token;
}

async function fetchSubredditNew(subreddit: string, token: string): Promise<RedditPostData[]> {
  const url = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new?limit=${POSTS_PER_SUBREDDIT}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    console.error('reddit fetch failed', subreddit, res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { data?: { children?: Array<{ data?: RedditPostData }> } };
  return (json.data?.children ?? []).map((c) => c.data).filter((d): d is RedditPostData => Boolean(d));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientId = Deno.env.get('REDDIT_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
  const runId = await startRun(sb, 'reddit');

  try {
    const token = await getAccessToken(clientId, clientSecret);
    const subreddits = await listActiveKeywords(sb, ['reddit']);
    const items = new Map<string, RawItemInput>();

    for (const { keyword: subreddit } of subreddits) {
      const posts = await fetchSubredditNew(subreddit, token);
      for (const post of posts) {
        const createdMs =
          typeof post.created_utc === 'number' ? post.created_utc * 1000 : null;
        if (!isWithinCollectionPeriod(createdMs, period)) continue;
        items.set(post.id, {
          source: 'reddit',
          externalId: post.id,
          title: post.title ?? null,
          content: post.selftext || null,
          author: post.author ?? null,
          url: post.permalink ? `https://www.reddit.com${post.permalink}` : null,
          sourceCreatedAt: createdMs != null ? new Date(createdMs).toISOString() : null,
          rawPayload: { subreddit, period: period.label },
        });
      }
    }

    const itemsCollected = await upsertRawItems(sb, [...items.values()]);
    await finishRun(sb, runId, { status: 'success', itemsCollected });

    return new Response(JSON.stringify({ itemsCollected, period: period.label }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('insight-collect-reddit failed', message);
    await finishRun(sb, runId, { status: 'error', errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
