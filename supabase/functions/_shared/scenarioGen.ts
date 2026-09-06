/**
 * 테마 시나리오 생성 공용 로직 (select: 지역/스팟 선정, narrate: 확정된 스팟의 언어별 서술문 생성)
 * tour-scenario(라이브 단일언어 생성)와 tour-scenario-catalog-generate(관리자 4개국어 일괄 생성)가 공유한다.
 */
import type { ScenarioCandidate, ScenarioTheme } from './tourScenario.ts';

type ThemeLabelLocale = 'ko' | 'en' | 'es' | 'fr' | 'de' | 'ru';

export const THEME_LABELS: Record<ScenarioTheme, Record<ThemeLabelLocale, string>> = {
  meditation: {
    ko: '명상관광 (사찰, 한옥스테이, 산사 등 정적이고 내면에 집중하는 여행)',
    en: 'meditation & temple stays (temples, hanok stays, quiet reflective travel)',
    es: 'meditación y estancias en templos (templos, hanok, viaje quieto y reflexivo)',
    fr: 'méditation et séjours en temple (temples, hanok, voyage calme et introspectif)',
    de: 'Meditation und Tempelaufenthalte (Tempel, Hanok, ruhige Reise nach innen)',
    ru: 'медитация и храмовые ретриты (храмы, ханок, тихое созерцательное путешествие)',
  },
  wellbeing: {
    ko: '웰빙관광 (온천, 찜질방, 힐링, 자연휴양림 등 몸과 마음의 회복에 초점)',
    en: 'wellness (hot springs, jjimjilbang, healing forests)',
    es: 'bienestar (aguas termales, jjimjilbang, bosques de descanso)',
    fr: 'bien-être (sources chaudes, jjimjilbang, forêts de ressourcement)',
    de: 'Wellness (Thermalquellen, Jjimjilbang, Heilwälder)',
    ru: 'велнес (термы, ччимчильбан, целебные леса)',
  },
  shopping: {
    ko: '쇼핑관광 (아울렛, 백화점, 전통시장, 면세점 등)',
    en: 'shopping (outlets, department stores, traditional markets, duty-free)',
    es: 'compras (outlets, grandes almacenes, mercados tradicionales, duty-free)',
    fr: 'shopping (outlets, grands magasins, marchés traditionnels, duty-free)',
    de: 'Shopping (Outlets, Kaufhäuser, traditionelle Märkte, Duty-free)',
    ru: 'шопинг (аутлеты, универмаги, традиционные рынки, duty-free)',
  },
  family: {
    ko: '대가족관광 (여러 세대가 함께 즐길 수 있는 키즈카페, 동물원, 과학관, 테마파크 등)',
    en: 'multi-generation family (kids cafes, zoos, science museums, theme parks)',
    es: 'familia de varias generaciones (cafés infantiles, zoos, museos de ciencia, parques temáticos)',
    fr: 'famille multi-générations (cafés enfants, zoos, musées scientifiques, parcs à thème)',
    de: 'Mehrgenerationen-Familie (Kindercafés, Zoos, Science Center, Freizeitparks)',
    ru: 'семья нескольких поколений (детские кафе, зоопарки, научные музеи, парки)',
  },
  honeymoon: {
    ko: '허니문관광 (리조트, 오션뷰, 전망대, 스카이워크 등 로맨틱한 커플 여행)',
    en: 'honeymoon (resorts, ocean views, observatories, skywalks)',
    es: 'luna de miel (resorts, vistas al mar, observatorios, skywalks)',
    fr: 'lune de miel (resorts, vues mer, observatoires, skywalks)',
    de: 'Flitterwochen (Resorts, Meerblick, Aussichtspunkte, Skywalks)',
    ru: 'медовый месяц (куроты, вид на море, смотровые, скайвоки)',
  },
  night: {
    ko: '야간관광 (야시장, 야경 명소, 야간개장 등 밤에 즐기는 여행)',
    en: 'night tourism (night markets, night views, late-night attractions)',
    es: 'turismo nocturno (mercados nocturnos, vistas de noche, aperturas tardías)',
    fr: 'tourisme de nuit (marchés nocturnes, vues nocturnes, ouvertures tardives)',
    de: 'Nacht-Tourismus (Nachtmärkte, Nachtblicke, späte Öffnungen)',
    ru: 'ночной туризм (ночные рынки, ночные виды, поздние открытия)',
  },
  hallyu: {
    ko: '한류관광 (드라마·영화 촬영지, 케이팝 관련 명소 등)',
    en: 'Hallyu / K-culture (drama filming locations, K-pop related spots)',
    es: 'Hallyu / cultura K (localizaciones de dramas, sitios de K-pop)',
    fr: 'Hallyu / culture K (lieux de tournage, spots K-pop)',
    de: 'Hallyu / K-Kultur (Drama-Drehorte, K-Pop-Spots)',
    ru: 'Халлю / K-культура (локации дорам, места K-pop)',
  },
  camping: {
    ko: '캠핑관광 (캠핑장, 글램핑, 오토캠핑 등 야외 숙영 여행)',
    en: 'camping (campgrounds, glamping, auto camping)',
    es: 'camping (campings, glamping, autocaravana)',
    fr: 'camping (campings, glamping, camping-car)',
    de: 'Camping (Campingplätze, Glamping, Autocamping)',
    ru: 'кемпинг (кемпинги, глэмпинг, автокемпинг)',
  },
  walking: {
    ko: '걷기여행 (둘레길, 트레킹 코스, 올레길 등 도보 여행)',
    en: 'walking trails (dulle-gil, trekking courses, olle trails)',
    es: 'senderismo (dulle-gil, rutas de trekking, caminos olle)',
    fr: 'randonnée (dulle-gil, sentiers de trekking, chemins olle)',
    de: 'Wandern (Dulle-gil, Trekkingkurse, Olle-Wege)',
    ru: 'пешие маршруты (туллегиль, трекинг, тропы олле)',
  },
  marine: {
    ko: '해양관광 (해수욕장, 마리나, 요트 등 바다를 즐기는 여행)',
    en: 'marine & coast (beaches, marinas, yacht experiences)',
    es: 'costa y mar (playas, marinas, yates)',
    fr: 'mer et côte (plages, marinas, yachts)',
    de: 'Küste und Meer (Strände, Marinas, Yachten)',
    ru: 'море и побережье (пляжи, марины, яхты)',
  },
};

function themeLabelFor(theme: ScenarioTheme, locale: string): string {
  const labels = THEME_LABELS[theme];
  if (
    locale === 'ko' ||
    locale === 'en' ||
    locale === 'es' ||
    locale === 'fr' ||
    locale === 'de' ||
    locale === 'ru'
  ) {
    return labels[locale];
  }
  return labels.en;
}

export const LOCALE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  zh: '简体中文', // legacy
  es: 'español',
  fr: 'français',
  de: 'Deutsch',
  ru: 'русский',
};

export function normalizeRequestLocale(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/_/g, '-');
  if (s.startsWith('ko')) return 'ko';
  if (s.startsWith('ja')) return 'ja';
  if (s.startsWith('zh')) {
    if (
      s.includes('hant') ||
      s.includes('-tw') ||
      s.endsWith('tw') ||
      s.includes('-hk') ||
      s.endsWith('hk') ||
      s.includes('-mo') ||
      s.endsWith('mo')
    ) {
      return 'zh-TW';
    }
    return 'zh-CN';
  }
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('en')) return 'en';
  return 'en';
}

export interface StopDraft {
  contentId: string;
  note: string;
  reason?: string;
  title?: string;
}
export interface DayDraft {
  day: number;
  dayTitle: string;
  stops: StopDraft[];
}
export interface ScenarioDraft {
  region: string;
  regionLabel?: string;
  title: string;
  intro: string;
  days: DayDraft[];
}

export function parseScenarioJson(text: string): ScenarioDraft {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(jsonText) as ScenarioDraft;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.days)) {
    throw new Error('claude response is not a valid scenario object');
  }
  return parsed;
}

function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

export function draftLooksKorean(draft: ScenarioDraft): boolean {
  return hasHangul(String(draft.title ?? '')) || hasHangul(String(draft.intro ?? ''));
}

/**
 * 지역당 Claude에 넘기는 후보 수는 요청 일수에 비례해야 한다. 고정값이면
 * 일수가 늘어도 후보가 그대로라 뒷날짜가 채워지지 못하고 조용히 사라진다.
 */
export function candidatesPerRegionCap(days: number): number {
  return Math.min(days * 5, 40);
}

/**
 * 지역별 후보를 단순히 앞에서부터 자르면 키워드 배열의 첫 항목이 나머지를
 * 밀어내 한 유형(예: 숙박)으로만 도배되는 문제가 있다. 키워드별로
 * 라운드로빈으로 섞어서 다양한 유형이 골고루 후보에 들어가게 한다.
 */
export function diversifyBySourceKeyword(
  candidates: ScenarioCandidate[],
  cap: number
): ScenarioCandidate[] {
  const groups = new Map<string, ScenarioCandidate[]>();
  for (const c of candidates) {
    const list = groups.get(c.sourceKeyword);
    if (list) list.push(c);
    else groups.set(c.sourceKeyword, [c]);
  }
  const queues = Array.from(groups.values());
  const out: ScenarioCandidate[] = [];
  let i = 0;
  while (out.length < cap && queues.some((q) => q.length > 0)) {
    const q = queues[i % queues.length];
    if (q.length > 0) out.push(q.shift()!);
    i++;
  }
  return out;
}

/** 지역/스팟을 새로 고르는 프롬프트 (기존 tour-scenario 라이브 생성용) */
export function buildSelectPrompt(
  theme: ScenarioTheme,
  days: number,
  locale: string,
  localeLabel: string,
  regions: Array<{ region: string; candidates: ScenarioCandidate[] }>
): string {
  const themeLabel = themeLabelFor(theme, locale);
  const regionListing = regions
    .map((r) => {
      const items = r.candidates
        .map((c) => `  - contentId="${c.contentId}" koreanTitle="${c.title}" address="${c.address}"`)
        .join('\n');
      return `[region: ${r.region}] (${r.candidates.length} candidates)\n${items}`;
    })
    .join('\n\n');

  if (locale === 'ko') {
    return `당신은 여로담(Wayknit)의 여행 시나리오 작가입니다.
테마 "${themeLabel}"에 맞는 ${days}일 여행 시나리오를 한국어로 작성하세요.

절대 규칙:
- 아래 제공된 지역 후보 목록 중 정확히 하나의 지역만 선택하고, 모든 일정을 그 지역 안에서만 구성하세요.
- 각 날의 stops에는 반드시 목록에 있는 contentId만 사용하세요. 목록에 없는 장소를 새로 지어내면 안 됩니다.
- 하루에 2~4곳을 배치하고, 하루 흐름(오전→오후→저녁)이 자연스럽게 이어지도록 순서를 정하세요.
- 같은 contentId를 여러 날에 중복 배치하지 마세요.
- title, intro, dayTitle, regionLabel, 각 stop의 title·reason·note는 모두 한국어로 작성하세요.
- stop.title은 여행자가 읽기 쉬운 장소명(공식 한글명 가능)입니다.
- stop.reason은 note와 별개로, 이 장소를 이 일정에 넣은 핵심 이유를 8~20자 내외의 짧은 한 줄로 씁니다(완전한 문장 아니어도 됨. 예: "테마를 대표하는 장소", "전날 숙소에서 도보 이동").

지역별 후보:
${regionListing}

반드시 JSON만 응답하세요:
{"region":"선택한 지역명(목록에 있는 이름 그대로)","regionLabel":"표시용 지역명","title":"여행 시나리오 제목","intro":"3~5문장 도입부","days":[{"day":1,"dayTitle":"1일차 소제목","stops":[{"contentId":"...","title":"장소명","reason":"이 장소를 넣은 이유 한 줄","note":"..."}]}]}`;
  }

  return `You are the travel-scenario writer for Wayknit, a Korea trip planner.
Write a ${days}-day itinerary for the theme "${themeLabel}".

LANGUAGE LOCK (critical):
- Write title, intro, dayTitle, regionLabel, every stop.title, and every stop.note entirely in ${localeLabel}.
- Do not write those fields in Korean. Korean appears only in the candidate list as koreanTitle for reference.
- stop.title must be a natural ${localeLabel} place name a traveler would recognize (common local name, not a letter-by-letter romanization unless that is the usual name).
- regionLabel is the traveler-facing region name in ${localeLabel} (e.g. Seoul, Jeju, Busan).
- reason: a short one-line phrase in ${localeLabel} (5-10 words, does not need to be a full sentence) giving the single clearest reason this stop was picked for this itinerary — separate from note, punchier and more specific (e.g. "the theme's must-see anchor spot", "steps from the previous stop").
- notes: 1–2 useful sentences in ${localeLabel} explaining why this stop fits the theme and the day's flow.

Hard rules:
- Pick exactly one region from the list. Every stop must be in that region.
- Use only contentId values from the list. Never invent places.
- 2–4 stops per day, morning→afternoon→evening flow.
- Do not reuse the same contentId across days.

Candidates:
${regionListing}

Respond with JSON only:
{"region":"exact region key from the list","regionLabel":"region name in ${localeLabel}","title":"scenario title in ${localeLabel}","intro":"3-5 sentence intro in ${localeLabel}","days":[{"day":1,"dayTitle":"day subtitle in ${localeLabel}","stops":[{"contentId":"...","title":"place name in ${localeLabel}","reason":"short one-line reason in ${localeLabel}","note":"..."}]}]}`;
}

export interface FixedStop {
  contentId: string;
  koreanTitle: string;
  address: string;
}
export interface FixedDay {
  day: number;
  dayTitle: string;
  stops: FixedStop[];
}

/**
 * 이미 확정된(그라운딩 완료된) 지역·일자·스팟 구성은 그대로 두고,
 * 서술문(title/intro/dayTitle/regionLabel/stop.title/stop.note)만 대상 언어로 새로 쓴다.
 * 카탈로그 항목이 언어마다 다른 장소를 가리키는 일이 없도록 select 단계와 분리한 것.
 */
export function buildNarratePrompt(
  theme: ScenarioTheme,
  locale: string,
  localeLabel: string,
  regionKey: string,
  fixedDays: FixedDay[]
): string {
  const themeLabel = themeLabelFor(theme, locale);
  const dayListing = fixedDays
    .map((d) => {
      const items = d.stops
        .map((s) => `  - contentId="${s.contentId}" koreanName="${s.koreanTitle}" address="${s.address}"`)
        .join('\n');
      return `Day ${d.day} (Korean day subtitle: "${d.dayTitle}"):\n${items}`;
    })
    .join('\n\n');

  return `You are the travel-scenario writer for Wayknit, a Korea trip planner.
This exact "${themeLabel}" itinerary in region "${regionKey}" was already finalized — the region, day grouping, stop order, and contentId set are FINAL and must not change:

${dayListing}

Task: write the narrative text for this already-chosen itinerary entirely in ${localeLabel}.

LANGUAGE LOCK (critical):
- Write title, intro, dayTitle, regionLabel, every stop.title, stop.reason, and stop.note entirely in ${localeLabel}. Do not use Korean.
- stop.title must be a natural ${localeLabel} place name a traveler would recognize for that koreanName (common local name, not a letter-by-letter romanization unless that is the usual name).
- regionLabel is the traveler-facing region name in ${localeLabel}.
- reason: a short one-line phrase in ${localeLabel} (5-10 words, does not need to be a full sentence) giving the single clearest reason this stop was picked for this itinerary — separate from note, punchier and more specific (e.g. "the theme's must-see anchor spot", "steps from the previous stop").
- notes: 1-2 useful sentences in ${localeLabel} explaining why this stop fits the theme and the day's flow.

Hard rules:
- Return exactly the same days and the exact same contentId set given above, in the same day grouping. Do not add, remove, reorder across days, or invent any contentId.
- "region" in your JSON response must be exactly "${regionKey}" (unchanged).

Respond with JSON only:
{"region":"${regionKey}","regionLabel":"region name in ${localeLabel}","title":"scenario title in ${localeLabel}","intro":"3-5 sentence intro in ${localeLabel}","days":[{"day":1,"dayTitle":"day subtitle in ${localeLabel}","stops":[{"contentId":"...","title":"place name in ${localeLabel}","reason":"short one-line reason in ${localeLabel}","note":"..."}]}]}`;
}

async function requestClaudeText(prompt: string, apiKey: string, localeLabel: string, model: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: `Output language: ${localeLabel} only for narrative JSON fields (title, intro, dayTitle, regionLabel, stop.title, stop.reason, stop.note). Return JSON only. The JSON must be strictly valid: escape every double-quote and newline that appears inside a string value.`,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`claude api failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return json.content?.find((b) => b.type === 'text')?.text ?? '';
}

/**
 * Claude가 문자열 값 내부의 따옴표/줄바꿈을 이스케이프하지 않아 JSON.parse가
 * 실패하는 경우가 드물게 있다(카탈로그 생성은 요청당 최대 4회 호출이라 라이브
 * 단일 호출보다 이 실패를 만날 확률이 높다). 한 번은 그대로, 실패하면 "이전
 * 응답이 유효하지 않은 JSON이었다"는 지적과 함께 한 번 더 시도한다.
 */
export async function callClaude(
  prompt: string,
  apiKey: string,
  localeLabel: string,
  model = 'claude-haiku-4-5-20251001'
): Promise<ScenarioDraft> {
  const text = await requestClaudeText(prompt, apiKey, localeLabel, model);
  try {
    return parseScenarioJson(text);
  } catch (firstError) {
    const retryPrompt = `${prompt}\n\nRETRY: Your previous response was not valid JSON (parser error: ${
      firstError instanceof Error ? firstError.message : String(firstError)
    }). Output ONLY a single valid JSON object with the same shape — escape every double-quote and newline inside string values, and do not wrap it in markdown fences.`;
    const retryText = await requestClaudeText(retryPrompt, apiKey, localeLabel, model);
    return parseScenarioJson(retryText);
  }
}
