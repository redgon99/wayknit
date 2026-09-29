/**
 * 관리자 시나리오 편집 UI 전용: 관리자가 고친 content.ko(지역/일자/스팟 구성 +
 * 문구)는 그대로 두고, 나머지 언어(en/ja/zh-CN/zh-TW/es/fr/de/ru)만 그 한국어
 * 문구를 번역해 다시 쓴다. tour-scenario-catalog-generate와 달리 지역/스팟을
 * 새로 고르지 않는다 — ko에 이미 확정된 contentId 집합을 그대로 그라운딩 소스로
 * 쓴다.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/insightDb.ts';
import { requireAdminCaller } from '../_shared/adminAuth.ts';
import { fetchOfficialAddress, type MultilingualLocale } from '../_shared/tourMultilingual.ts';
import {
  buildTranslatePrompt,
  callClaude,
  draftLooksKorean,
  LOCALE_LABELS,
  type ScenarioDraft,
  type TranslateSource,
} from '../_shared/scenarioGen.ts';
import type { ScenarioTheme } from '../_shared/tourScenario.ts';

const NARRATE_LOCALES = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'] as const;

interface GroundedStop {
  contentId: string;
  contentTypeId: string;
  placeId: string;
  titleKo: string;
  address: string;
  lat: number;
  lng: number;
  thumbnailUrl?: string;
  sourceApi?: 'gocamping';
  petFriendly?: boolean;
  accessible?: boolean;
}
interface GroundedDay {
  day: number;
  dayTitleKo: string;
  stops: GroundedStop[];
}

interface LocaleContent {
  regionLabel: string;
  title: string;
  intro: string;
  days: Array<{
    day: number;
    dayTitle: string;
    stops: Array<{
      placeId: string;
      contentId: string;
      contentTypeId: string;
      title: string;
      titleKo: string;
      address: string;
      lat: number;
      lng: number;
      thumbnailUrl?: string;
      sourceApi?: 'gocamping';
      petFriendly?: boolean;
      accessible?: boolean;
      reason: string;
      note: string;
    }>;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tourApiKey = Deno.env.get('TOUR_API_KEY')?.trim();
  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!tourApiKey || !claudeApiKey) {
    return new Response(
      JSON.stringify({ error: 'TOUR_API_KEY 또는 ANTHROPIC_API_KEY가 설정되지 않았습니다.' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    await requireAdminCaller(req);

    let id = '';
    try {
      const body = (await req.json()) as { id?: string };
      id = String(body.id ?? '').trim();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!id) {
      return new Response(JSON.stringify({ error: 'id가 필요합니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = getServiceClient();
    const { data: row, error: fetchError } = await sb
      .from('scenario_catalog')
      .select('id, theme, days, region, status, content, candidate_region_count, created_at')
      .eq('id', id)
      .single();
    if (fetchError || !row) {
      return new Response(JSON.stringify({ error: '항목을 찾을 수 없습니다.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const theme = row.theme as ScenarioTheme;
    const region = row.region as string;
    const content = (row.content ?? {}) as Record<string, LocaleContent>;
    const ko = content.ko;
    if (!ko || !Array.isArray(ko.days) || ko.days.length === 0) {
      return new Response(JSON.stringify({ error: '한국어(ko) 콘텐츠가 없어 재번역할 수 없습니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ko를 그라운딩 소스로 삼는다 — 편집 UI에서 장소 교체/추가/삭제/순서변경이
    // 모두 ko 기준으로 이뤄지므로, 다른 언어는 이 구성을 그대로 따라가면 된다.
    const grounded: GroundedDay[] = ko.days.map((d) => ({
      day: d.day,
      dayTitleKo: d.dayTitle,
      stops: d.stops.map((s) => ({
        contentId: s.contentId,
        contentTypeId: s.contentTypeId,
        placeId: s.placeId,
        titleKo: s.titleKo || s.title,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        thumbnailUrl: s.thumbnailUrl,
        sourceApi: s.sourceApi,
        petFriendly: s.petFriendly,
        accessible: s.accessible,
      })),
    }));

    const translateSource: TranslateSource = {
      regionLabel: ko.regionLabel,
      title: ko.title,
      intro: ko.intro,
      days: ko.days.map((d) => ({
        day: d.day,
        dayTitle: d.dayTitle,
        stops: d.stops.map((s) => ({ contentId: s.contentId, title: s.title, reason: s.reason, note: s.note })),
      })),
    };

    function localeContentFromDraft(draft: ScenarioDraft): LocaleContent {
      const noteById = new Map<string, { title: string; note: string; reason: string }>();
      for (const d of draft.days) {
        for (const s of d.stops ?? []) {
          noteById.set(s.contentId, {
            title: String(s.title ?? '').trim(),
            note: String(s.note ?? '').trim(),
            reason: String(s.reason ?? '').trim(),
          });
        }
      }
      const dayTitleById = new Map(draft.days.map((d) => [d.day, String(d.dayTitle ?? '').trim()]));
      return {
        regionLabel: String(draft.regionLabel ?? '').trim() || region,
        title: draft.title,
        intro: draft.intro,
        days: grounded.map((d) => ({
          day: d.day,
          dayTitle: dayTitleById.get(d.day) || d.dayTitleKo,
          stops: d.stops.map((s) => {
            const translated = noteById.get(s.contentId);
            return {
              placeId: s.placeId,
              contentId: s.contentId,
              contentTypeId: s.contentTypeId,
              title: translated?.title || s.titleKo,
              titleKo: s.titleKo,
              address: s.address,
              lat: s.lat,
              lng: s.lng,
              thumbnailUrl: s.thumbnailUrl,
              sourceApi: s.sourceApi,
              petFriendly: s.petFriendly,
              accessible: s.accessible,
              reason: translated?.reason || '',
              note: translated?.note || '',
            };
          }),
        })),
      };
    }

    async function overlayOfficialAddresses(localeContent: LocaleContent, locale: MultilingualLocale) {
      const stops = localeContent.days.flatMap((d) => d.stops);
      await Promise.all(
        stops.map(async (s) => {
          if (s.sourceApi) return;
          const match = await fetchOfficialAddress(locale, tourApiKey, s.titleKo, s.lat, s.lng);
          if (match) s.address = match.address;
        })
      );
    }

    // 8개 언어를 순차로 돌면(sum of 8 Claude 호출 + 8회 주소 조회) 시나리오가
    // 길 때(7일치 등) 엣지함수 실행 시간 제한을 넘겨 504가 난다 — 그러면 이미 쓴
    // Claude 크레딧은 그대로 소모되고 DB엔 아무것도 안 남는다(2026-09-29 실사용
    // 중 발견: 크레딧은 줄었는데 반영이 안 됨). 병렬로 돌려 전체 소요시간을
    // "8개 합"이 아니라 "가장 느린 1개" 수준으로 줄이고, 언어별로 개별 실패를
    // 허용해(Promise.allSettled) 한 언어가 실패해도 나머지는 저장되게 한다.
    async function translateOne(locale: (typeof NARRATE_LOCALES)[number]): Promise<LocaleContent> {
      const localeLabel = LOCALE_LABELS[locale];
      const translatePrompt = buildTranslatePrompt(theme, locale, localeLabel, region, translateSource);
      let draft = await callClaude(translatePrompt, claudeApiKey, localeLabel);
      if (draftLooksKorean(draft)) {
        console.warn(`tour-scenario-catalog-retranslate: ${locale} still Korean, retrying once`);
        draft = await callClaude(
          `${translatePrompt}\n\nRETRY: The previous JSON was in Korean. Rewrite every narrative field in ${localeLabel}.`,
          claudeApiKey,
          localeLabel
        );
      }
      const localeContent = localeContentFromDraft(draft);
      await overlayOfficialAddresses(localeContent, locale as MultilingualLocale);
      return localeContent;
    }

    const settled = await Promise.allSettled(NARRATE_LOCALES.map((locale) => translateOne(locale)));
    const newLocales: Record<string, LocaleContent> = {};
    const failedLocales: string[] = [];
    settled.forEach((result, i) => {
      const locale = NARRATE_LOCALES[i];
      if (result.status === 'fulfilled') {
        newLocales[locale] = result.value;
      } else {
        failedLocales.push(locale);
        console.error(`tour-scenario-catalog-retranslate: ${locale} failed`, result.reason);
      }
    });

    if (Object.keys(newLocales).length === 0) {
      return new Response(JSON.stringify({ error: '모든 언어 번역에 실패했습니다. 다시 시도해 주세요.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mergedContent = { ...content, ko, ...newLocales };
    const { data: updated, error: updateError } = await sb
      .from('scenario_catalog')
      .update({ content: mergedContent, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, theme, days, region, status, content, candidate_region_count, created_at, updated_at, published_at')
      .single();
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ entry: updated, failedLocales }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('tour-scenario-catalog-retranslate failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
