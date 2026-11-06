import type { AnalyticsProps } from './analytics';

/**
 * 접속 로그에 덧붙이는 방문 맥락 — 어디서 왔는지(유입)와 접속 국가.
 *
 * 개인을 알아볼 수 없는 값만 남긴다: 직전 사이트는 주소 전체가 아니라 도메인만
 * (주소엔 검색어 등이 섞일 수 있다), 국가는 두 글자 코드만, IP는 다루지 않는다.
 */

const ENTRY_KEY = 'wayknit:visit-entry';
const COUNTRY_KEY = 'wayknit:visit-country';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
const MAX_UTM_LENGTH = 64;
/** 응답이 늦어도 이벤트 전송을 오래 붙잡지 않는다 */
const GEO_TIMEOUT_MS = 1500;

let entryTaken = false;
let countryRequest: Promise<string | null> | null = null;

/** google.co.kr, www.google.com처럼 갈라지는 표기를 하나로 묶는다. */
function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^(www|m|l|lm)\./, '')
    .replace(/^google\.[a-z.]+$/, 'google');
}

function referrerHost(): string | null {
  try {
    return document.referrer ? new URL(document.referrer).hostname : null;
  } catch {
    return null;
  }
}

/**
 * 탭의 첫 조회에만 유입 정보를 준다. 이후 내부 이동·새로고침이나 로그인에서 돌아온
 * 경우(외부 도메인이 referrer가 된다)가 유입으로 세어지면 안 되기 때문이다.
 */
export function takeEntryProps(search: string): AnalyticsProps {
  if (entryTaken) return {};
  entryTaken = true;
  try {
    if (sessionStorage.getItem(ENTRY_KEY)) return {};
    sessionStorage.setItem(ENTRY_KEY, '1');
  } catch {
    /* 저장소가 막힌 브라우저는 이 페이지 수명 동안만 구분한다 */
  }

  const host = referrerHost();
  // 사이트 안의 링크를 새 탭으로 연 경우 — 외부에서 들어온 것이 아니다.
  if (host === window.location.hostname) return {};

  const props: AnalyticsProps = { entry: true };
  if (host) props.ref = normalizeHost(host);
  const params = new URLSearchParams(search);
  for (const field of UTM_FIELDS) {
    const value = params.get(field)?.trim().toLowerCase();
    if (value) props[field] = value.slice(0, MAX_UTM_LENGTH);
  }
  return props;
}

async function fetchCountry(): Promise<string | null> {
  try {
    const saved = sessionStorage.getItem(COUNTRY_KEY);
    if (saved) return saved;
  } catch {
    /* 저장소 없이도 조회는 할 수 있다 */
  }
  try {
    const res = await fetch('/api/geo', { signal: AbortSignal.timeout(GEO_TIMEOUT_MS) });
    if (!res.ok) return null;
    // 개발 서버엔 이 경로가 없어 HTML이 온다 — json()이 실패해 아래 catch로 간다.
    const { country } = (await res.json()) as { country?: unknown };
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return null;
    try {
      sessionStorage.setItem(COUNTRY_KEY, country);
    } catch {
      /* 다음 탭에서 다시 조회하면 된다 */
    }
    return country;
  } catch {
    return null;
  }
}

/** 탭마다 한 번만 조회한다. 실패하면 국가 없이 기록된다. */
export function loadVisitCountry(): Promise<string | null> {
  countryRequest ??= fetchCountry();
  return countryRequest;
}
