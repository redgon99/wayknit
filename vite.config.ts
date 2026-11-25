import { defineConfig, loadEnv, normalizePath, type Plugin } from 'vite';
import postcss from 'postcss';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ClientRequest } from 'http';
import type { ServerOptions as HttpsServerOptions } from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { execSync } from 'node:child_process';

/**
 * 빌드 식별자 — 모바일 기기에서 "지금 열린 앱이 방금 배포한 그 빌드인가"를
 * 눈으로 확인할 수단이 없었다(§29-32). 계정 시트 하단에 이 값을 띄운다.
 * 커밋 해시는 빌드 시점의 HEAD다. git이 없는 환경(예: 소스 압축본)에서도
 * 빌드가 깨지면 안 되므로 실패는 조용히 'unknown'으로 떨어뜨린다.
 */
function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

type CertPair = { cert: Buffer; key: Buffer };

function readCertPair(certDir: string, baseName: string): CertPair | undefined {
  const crtPath = path.join(certDir, `${baseName}.crt`);
  const keyPath = path.join(certDir, `${baseName}.key`);
  if (!fs.existsSync(crtPath) || !fs.existsSync(keyPath)) return undefined;
  return { cert: fs.readFileSync(crtPath), key: fs.readFileSync(keyPath) };
}

/**
 * HTTPS 인증서 — .certs/(gitignore됨)에서 두 종류를 찾는다.
 * ① `tailscale cert <이 기기의 MagicDNS 이름>`으로 발급한 태일스케일 인증서 —
 *    다른 기기(휴대폰 등)에서 태일넷 호스트명으로 접속할 때 경고 없이 신뢰됨.
 * ② `.certs/localhost.crt`/`.key` — openssl로 만든 자체서명 인증서(SAN에 localhost·
 *    127.0.0.1·::1). 태일스케일 인증서는 그 호스트명에만 유효해서 예전엔 localhost로
 *    접속하면 인증서 이름 불일치로 막혔다(§32) — 이 로컬 인증서가 그 구멍을 메운다.
 * 하나만 있으면 그걸로 전부 서빙(기존 동작 그대로), 없으면 그냥 http로 뜬다 —
 * 인증서가 없는 다른 머신에서도 npm run dev가 그대로 동작해야 하므로.
 * GPS·PWA 설치처럼 보안 컨텍스트가 필요한 기능은 http로는 절대 테스트할 수 없다(§6-8/§9-4/§27-3).
 */
function loadHttpsOptions(): HttpsServerOptions | undefined {
  const certDir = path.resolve(process.cwd(), '.certs');
  if (!fs.existsSync(certDir)) return undefined;

  const localhostPair = readCertPair(certDir, 'localhost');
  const tailscaleCrtFile = fs
    .readdirSync(certDir)
    .find((f) => f.endsWith('.crt') && f !== 'localhost.crt');
  const tailscalePair = tailscaleCrtFile
    ? readCertPair(certDir, tailscaleCrtFile.replace(/\.crt$/, ''))
    : undefined;

  if (tailscalePair && localhostPair) {
    const tailscaleCtx = tls.createSecureContext(tailscalePair);
    const localhostCtx = tls.createSecureContext(localhostPair);
    return {
      ...tailscalePair, // SNI를 안 보내는 클라이언트를 위한 기본값
      SNICallback: (servername, cb) => {
        const isLocalhost = servername === 'localhost' || servername === '127.0.0.1';
        cb(null, isLocalhost ? localhostCtx : tailscaleCtx);
      },
    };
  }

  return tailscalePair ?? localhostPair;
}

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

/**
 * 번역 파일은 언어별로 필요할 때 받는다(2026-11-22, src/lib/i18n.ts). 그런데 "모든 언어"의 문구가 동시에
 * 필요한 곳이 두 군데 있다 — 기본 일정 제목 "새 여행" 알아보기(PlannerPage)와 다른 언어 화면에서 내보낸
 * 파일 다시 읽기(importPins). 그 몇 줄만 9개 언어에서 뽑아 `virtual:locale-cross` 모듈로 메인 번들에 넣는다.
 */
function localeCrossPlugin() {
  const id = 'virtual:locale-cross';
  const resolved = '\0' + id;
  // 랜딩 테마 칩이 쓰는 한국어 planner.themes만 — 나머지 한국어 planner.json은 페이지와 함께 받는다(§68, i18n.ts)
  const koThemesId = 'virtual:ko-planner-themes';
  const koThemesResolved = '\0' + koThemesId;
  const localesDir = path.resolve(process.cwd(), 'src/locales');
  return {
    name: 'locale-cross',
    resolveId(source: string) {
      if (source === koThemesId) return koThemesResolved;
      return source === id ? resolved : null;
    },
    load(loadId: string) {
      if (loadId === koThemesResolved) {
        const planner = JSON.parse(fs.readFileSync(path.join(localesDir, 'ko', 'planner.json'), 'utf8'));
        return `export default ${JSON.stringify(planner.themes ?? {})};\n`;
      }
      if (loadId !== resolved) return null;
      const newTripTitles: string[] = [];
      const exportLabels: Record<string, unknown> = {};
      for (const loc of fs.readdirSync(localesDir)) {
        const file = path.join(localesDir, loc, 'planner.json');
        if (!fs.existsSync(file)) continue;
        const planner = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (typeof planner?.trip?.newTrip === 'string') newTripTitles.push(planner.trip.newTrip);
        if (planner?.export) exportLabels[loc] = planner.export;
      }
      return (
        `export const NEW_TRIP_TITLES = ${JSON.stringify(newTripTitles)};\n` +
        `export const EXPORT_LABELS = ${JSON.stringify(exportLabels)};\n`
      );
    },
  };
}

/**
 * 첫 화면 CSS 줄이기(§67) — app.css(gzip 약 42 kB)는 플래너·가이드·관리자 화면용이라 랜딩은 그중 수십 줄만 쓴다.
 * main.tsx는 `app.css?main`을 가져오고, 이 플러그인이 그 자리에 app.css에서 "메인 묶음(main.tsx에서 정적
 * import로 닿는 파일 + index.html)에 나오는 낱말로만 된 선택자"의 규칙만 원래 순서대로 남겨 넣는다.
 * 다른 화면은 각 페이지 파일이 app.css 원본을 그대로 가져오므로 그 화면에 들어가면 원본이 뒤에 붙는다.
 * 원본 안의 같은 규칙이 더 뒤에 오니 겹침 결과는 예전(landing.css → app.css 전체)과 똑같다.
 * 클래스 이름을 이어 붙여 만들면(`foo-${x}`, 'foo-' + x) 앞부분('foo-')으로 잡는다. 그 밖의 방법으로
 * 만든 이름은 못 잡으니, 메인 묶음 컴포넌트에서는 app.css의 클래스 이름을 문자 그대로 쓴다.
 */
function mainCssSubsetPlugin(): Plugin {
  const root = process.cwd();
  const key = (f: string) => normalizePath(f).toLowerCase();
  const isSubsetId = (id: string) => normalizePath(id).endsWith('/src/styles/app.css?main');
  let graph = new Set<string>();

  // main.tsx에서 정적 import(`import … from`, `export … from`, `import '…'`)로 닿는 소스 파일. 동적 import()는 지연 조각이라 뺀다.
  function collectGraph(): string[] {
    const seen = new Map<string, string>();
    const stack = [path.resolve(root, 'src/main.tsx')];
    const importRe = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g;
    while (stack.length) {
      const file = stack.pop()!;
      if (seen.has(key(file))) continue;
      seen.set(key(file), file);
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(importRe)) {
        const spec = m[1] || m[2];
        const base = path.resolve(path.dirname(file), spec);
        const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(
          (c) => /\.tsx?$/.test(c) && fs.existsSync(c) && fs.statSync(c).isFile(),
        );
        if (hit) stack.push(hit);
      }
    }
    return [...seen.values()];
  }

  function subset(files: string[]): string {
    const words = new Set<string>();
    const prefixes: string[] = [];
    for (const file of [...files, path.resolve(root, 'index.html')]) {
      const src = fs.readFileSync(file, 'utf8');
      for (const w of src.match(/[A-Za-z_][\w-]*/g) ?? []) words.add(w);
      for (const m of src.matchAll(/([A-Za-z_][\w-]*-)(?:\$\{|['"`]\s*\+)/g)) prefixes.push(m[1]);
    }
    const known = (name: string) => words.has(name) || prefixes.some((p) => name.startsWith(p));
    // :not(.x) 안의 클래스는 "없어야 맞는" 조건이라 보지 않는다
    const usable = (selector: string) =>
      [...selector.replace(/:not\([^()]*\)/g, '').matchAll(/\.((?:\\.|[\w-])+)/g)].every((m) =>
        known(m[1].replace(/\\/g, '')),
      );
    const css = postcss.parse(fs.readFileSync(path.resolve(root, 'src/styles/app.css'), 'utf8'));
    css.walkComments((c) => {
      c.remove();
    });
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as postcss.AtRule).name)) return;
      if (!rule.selectors.some(usable)) rule.remove();
    });
    // 안이 비어 버린 @media 등은 바깥쪽까지 지운다
    let emptied = true;
    while (emptied) {
      emptied = false;
      css.walkAtRules((at) => {
        if (at.nodes && at.nodes.length === 0) {
          at.remove();
          emptied = true;
        }
      });
    }
    return css.toString();
  }

  return {
    name: 'main-css-subset',
    enforce: 'pre',
    load(id) {
      if (!isSubsetId(id)) return null;
      const files = collectGraph();
      graph = new Set(files.map(key));
      return subset(files);
    },
    // dev: 메인 묶음 파일의 클래스 이름이 바뀌면 골라 넣은 CSS도 다시 만든다(app.css 자체 수정은 Vite가 알아서 다시 읽는다)
    handleHotUpdate(ctx) {
      if (!graph.has(key(ctx.file))) return;
      const mods = [...ctx.server.moduleGraph.idToModuleMap.values()].filter((m) => m.id && isSubsetId(m.id));
      for (const m of mods) ctx.server.moduleGraph.invalidateModule(m);
      return mods.length ? [...ctx.modules, ...mods] : undefined;
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
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __APP_COMMIT__: JSON.stringify(gitShortHash()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      output: {
        // 언어별 번역 8개 파일을 언어마다 한 조각으로(요청 1번). 한국어는 기본·대체 언어라 메인 번들에 남는다.
        manualChunks(id: string) {
          const m = id.replace(/\\/g, '/').match(/\/src\/locales\/([^/]+)\/[^/]+\.json$/);
          if (m && m[1] !== 'ko') return `locale-${m[1]}`;
          // 한국어는 첫 화면 묶음(common·landing·guides)만 메인에, 나머지는 한 조각으로(§68)
          if (m && !/\/(common|landing|guides)\.json$/.test(id.replace(/\\/g, '/'))) return 'locale-ko';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    localeCrossPlugin(),
    mainCssSubsetPlugin(),
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
        // 메인 번들이 기본 한도(2 MiB)를 넘으면 빌드가 실패하고, 한도를 넘는 파일은 오프라인 캐시에서 빠진다.
        // 2026-11-21 랜딩 개편으로 2.01 MiB가 되어 3 MiB로 올렸다. 근본 해결은 관리자 화면 지연 로딩(코드 분할).
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    https: loadHttpsOptions(),
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
