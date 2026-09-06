import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ClientRequest } from 'http';

function kakaoProxyHeaders(proxyReq: ClientRequest, _req: IncomingMessage) {
  proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
  proxyReq.setHeader('Origin', 'https://place.map.kakao.com');
  proxyReq.setHeader('Referer', 'https://place.map.kakao.com/');
  proxyReq.setHeader(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  proxyReq.setHeader('Pf', 'web');
}

function buildTourSearchUrl(keyword: string, serviceKey: string): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    keyword: keyword.trim(),
    numOfRows: '10',
    pageNo: '1',
    arrange: 'C',
  });
  const base = 'https://apis.data.go.kr/B551011/KorService2/searchKeyword2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}

function buildTourFestivalUrl(
  eventStartDate: string,
  eventEndDate: string | undefined,
  serviceKey: string
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    eventStartDate,
    numOfRows: '100',
    pageNo: '1',
    arrange: 'C',
  });
  if (eventEndDate) params.set('eventEndDate', eventEndDate);
  const base = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}

function buildTourNearbyUrl(
  mapX: number,
  mapY: number,
  radiusMeters: number,
  serviceKey: string
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    mapX: String(mapX),
    mapY: String(mapY),
    radius: String(Math.min(Math.max(Math.round(radiusMeters), 1), 20000)),
    numOfRows: '30',
    pageNo: '1',
    arrange: 'E',
  });
  const base = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2';
  const keyPart = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
  return `${base}?${keyPart}&${params.toString()}`;
}

function tourDetailKeyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

function tourDetailCommonParams(): URLSearchParams {
  return new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'Wayknit', _type: 'json' });
}

const TOUR_DETAIL_BASE = 'https://apis.data.go.kr/B551011/KorService2';

function buildTourDetailCommonUrl(contentId: string, serviceKey: string): string {
  const params = tourDetailCommonParams();
  params.set('contentId', contentId);
  params.set('defaultYN', 'Y');
  params.set('firstImageYN', 'Y');
  params.set('areacodeYN', 'Y');
  params.set('catcodeYN', 'Y');
  params.set('addrinfoYN', 'Y');
  params.set('mapinfoYN', 'Y');
  params.set('overviewYN', 'Y');
  return `${TOUR_DETAIL_BASE}/detailCommon2?${tourDetailKeyParam(serviceKey)}&${params.toString()}`;
}

function buildTourDetailIntroUrl(contentId: string, contentTypeId: string, serviceKey: string): string {
  const params = tourDetailCommonParams();
  params.set('contentId', contentId);
  params.set('contentTypeId', contentTypeId);
  return `${TOUR_DETAIL_BASE}/detailIntro2?${tourDetailKeyParam(serviceKey)}&${params.toString()}`;
}

function buildTourDetailImageUrl(contentId: string, serviceKey: string): string {
  const params = tourDetailCommonParams();
  params.set('contentId', contentId);
  params.set('imageYN', 'Y');
  params.set('subImageYN', 'Y');
  return `${TOUR_DETAIL_BASE}/detailImage2?${tourDetailKeyParam(serviceKey)}&${params.toString()}`;
}

/** tour-detail 엣지함수와 동일한 응답 모양을 만들기 위한 dev 전용 파서 (중복은 감수) */
function tourDetailFirstItem(json: unknown): Record<string, unknown> {
  const raw = (json as { response?: { body?: { items?: { item?: unknown } } } })?.response?.body
    ?.items?.item;
  if (Array.isArray(raw)) return (raw[0] as Record<string, unknown>) ?? {};
  return (raw as Record<string, unknown>) ?? {};
}

function tourDetailAllItems(json: unknown): Record<string, unknown>[] {
  const raw = (json as { response?: { body?: { items?: { item?: unknown } } } })?.response?.body
    ?.items?.item;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : raw ? [raw as Record<string, unknown>] : [];
}

function tourDetailStripHtml(text: unknown): string {
  if (typeof text !== 'string' || !text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

function tourDetailExtractHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = raw.match(/href="([^"]+)"/i);
  if (match) return match[1];
  const trimmed = tourDetailStripHtml(raw);
  return /^https?:\/\//.test(trimmed) ? trimmed : null;
}

function tourDetailPickFirst(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return tourDetailStripHtml(v);
  }
  return '';
}

function mergeTourDetailResponse(
  commonJson: unknown,
  introJson: unknown,
  imageJson: unknown
): Record<string, unknown> {
  const common = tourDetailFirstItem(commonJson);
  const intro = tourDetailFirstItem(introJson);
  const images = tourDetailAllItems(imageJson);

  const overview = tourDetailStripHtml(common.overview);
  const homepage = tourDetailExtractHref(common.homepage);
  const tel = typeof common.tel === 'string' && common.tel.trim() ? common.tel.trim() : null;
  const address =
    [common.addr1, common.addr2]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .join(' ') || null;

  const hours =
    tourDetailPickFirst(intro, [
      'usetime',
      'usetimeculture',
      'usetimefestival',
      'usetimeleports',
      'opentimefood',
    ]) ||
    (tourDetailPickFirst(intro, ['checkintime']) && tourDetailPickFirst(intro, ['checkouttime'])
      ? `체크인 ${tourDetailPickFirst(intro, ['checkintime'])} · 체크아웃 ${tourDetailPickFirst(intro, ['checkouttime'])}`
      : '');
  const restDate = tourDetailPickFirst(intro, [
    'restdate',
    'restdateculture',
    'restdatefestival',
    'restdateleports',
    'restdatefood',
  ]);
  const parking = tourDetailPickFirst(intro, [
    'parking',
    'parkingculture',
    'parkingfestival',
    'parkingleports',
    'parkinglodging',
    'parkingfood',
  ]);
  const infoCenter = tourDetailPickFirst(intro, [
    'infocenter',
    'infocenterculture',
    'infocenterfestival',
    'infocenterleports',
    'infocenterlodging',
    'infocenterfood',
  ]);
  const fee = tourDetailPickFirst(intro, ['usefee', 'usetimefestival']);

  const imageUrls = [
    ...new Set(
      [
        typeof common.firstimage === 'string' ? common.firstimage.trim() : undefined,
        ...images.map((img) => (typeof img.originimgurl === 'string' ? img.originimgurl.trim() : undefined)),
      ].filter((u): u is string => Boolean(u))
    ),
  ];

  return {
    overview: overview || null,
    homepage,
    tel,
    address,
    images: imageUrls,
    intro: {
      ...(hours ? { hours } : {}),
      ...(restDate ? { restDate } : {}),
      ...(parking ? { parking } : {}),
      ...(infoCenter ? { infoCenter } : {}),
      ...(fee && fee !== hours ? { fee } : {}),
    },
  };
}

/** 로컬 dev: Tour API CORS 우회 (VITE_TOUR_API_KEY 필요) */
function tourApiDevProxyPlugin(tourApiKey: string) {
  return {
    name: 'tour-api-dev-proxy',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use(
        '/api/tour-search',
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== 'GET') {
            next();
            return;
          }
          if (!tourApiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'VITE_TOUR_API_KEY not set' }));
            return;
          }
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const keyword = url.searchParams.get('keyword') ?? '';
            const upstream = await fetch(buildTourSearchUrl(keyword, tourApiKey), {
              headers: { Accept: 'application/json' },
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(text);
          } catch (e) {
            console.error('[tour-api-dev-proxy]', e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Tour API proxy failed' }));
          }
        }
      );
      server.middlewares.use(
        '/api/tour-festival',
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== 'GET') {
            next();
            return;
          }
          if (!tourApiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'VITE_TOUR_API_KEY not set' }));
            return;
          }
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const eventStartDate = url.searchParams.get('eventStartDate') ?? '';
            const eventEndDate = url.searchParams.get('eventEndDate') ?? undefined;
            const upstream = await fetch(
              buildTourFestivalUrl(eventStartDate, eventEndDate, tourApiKey),
              { headers: { Accept: 'application/json' } }
            );
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(text);
          } catch (e) {
            console.error('[tour-api-dev-proxy]', e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Tour Festival API proxy failed' }));
          }
        }
      );
      server.middlewares.use(
        '/api/tour-nearby',
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== 'GET') {
            next();
            return;
          }
          if (!tourApiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'VITE_TOUR_API_KEY not set' }));
            return;
          }
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const mapX = Number(url.searchParams.get('mapX'));
            const mapY = Number(url.searchParams.get('mapY'));
            const radius = Number(url.searchParams.get('radius') ?? '3000');
            if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'mapX/mapY required' }));
              return;
            }
            const upstream = await fetch(buildTourNearbyUrl(mapX, mapY, radius, tourApiKey), {
              headers: { Accept: 'application/json' },
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(text);
          } catch (e) {
            console.error('[tour-api-dev-proxy]', e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Tour Nearby API proxy failed' }));
          }
        }
      );
      server.middlewares.use(
        '/api/tour-detail',
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== 'GET') {
            next();
            return;
          }
          if (!tourApiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'VITE_TOUR_API_KEY not set' }));
            return;
          }
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const contentId = url.searchParams.get('contentId') ?? '';
            const contentTypeId = url.searchParams.get('contentTypeId') ?? '';
            if (!contentId) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'contentId required' }));
              return;
            }
            const [commonRes, introRes, imageRes] = await Promise.all([
              fetch(buildTourDetailCommonUrl(contentId, tourApiKey), {
                headers: { Accept: 'application/json' },
              }),
              contentTypeId && contentTypeId !== '0'
                ? fetch(buildTourDetailIntroUrl(contentId, contentTypeId, tourApiKey), {
                    headers: { Accept: 'application/json' },
                  })
                : Promise.resolve(null),
              fetch(buildTourDetailImageUrl(contentId, tourApiKey), {
                headers: { Accept: 'application/json' },
              }),
            ]);
            const common = await commonRes.json().catch(() => ({}));
            const intro = introRes ? await introRes.json().catch(() => ({})) : {};
            const image = await imageRes.json().catch(() => ({}));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mergeTourDetailResponse(common, intro, image)));
          } catch (e) {
            console.error('[tour-api-dev-proxy]', e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Tour API proxy failed' }));
          }
        }
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tourApiKey = env.VITE_TOUR_API_KEY ?? '';

  return {
  plugins: [
    react(),
    tourApiDevProxyPlugin(tourApiKey),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '여로담 — 가고 싶은 곳을 담으면, 여행길이 됩니다',
        short_name: '여로담',
        description: '장소를 담고 여행길을 엮는 Wayknit',
        theme_color: '#1f2937',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        // 공유 시트에서 받은 링크를 /share 라우트가 받아 장소를 추출한다
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/kakao-place': {
        target: 'https://place-api.map.kakao.com/places',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao-place/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', kakaoProxyHeaders);
        },
      },
      '/api/kakao-img-t1': {
        target: 'https://t1.daumcdn.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao-img-t1/, ''),
      },
      '/api/kakao-img-cdn': {
        target: 'https://img1.kakaocdn.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao-img-cdn/, ''),
      },
      '/api/kakao-img-naver': {
        target: 'https://postfiles.pstatic.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao-img-naver/, ''),
      },
    },
  },
  };
});
