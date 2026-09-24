import type { InsightReport } from '../types/insights';

/**
 * 여러 리서치 리포트를 하나의 통합 대시보드로 합산한다(§36, §37). 리포트별
 * `parsed`(insightReportParser.ts)는 이미 저장돼 있어 새 API 호출 없이
 * 클라이언트에서 합치기만 한다 — 리포트 수가 적어 서버 집계는 과함.
 */

export interface AggregatedRegion {
  name: string;
  mentionCount: number;
  /** 원본 리포트 중 하나라도 표 기반 언급 수를 줬는지 — false면 순위 트레일러만
   *  있었다는 뜻이라 막대 대신 태그로 보여준다(§37) */
  hasCount: boolean;
  notablePlaces: string;
  reportCount: number;
}

export interface AggregatedInterest {
  title: string;
  descriptions: string[];
  reportCount: number;
}

export interface AggregatedSignalItem {
  text: string;
  reportTitle: string;
}

export interface AggregatedFood {
  name: string;
  reportCount: number;
}

export interface AggregatedInsight {
  regions: AggregatedRegion[];
  interests: AggregatedInterest[];
  foods: AggregatedFood[];
  signals: {
    positive: AggregatedSignalItem[];
    negative: AggregatedSignalItem[];
  };
  reportCount: number;
}

function splitPlaces(text: string): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export function aggregateInsightReports(reports: InsightReport[]): AggregatedInsight {
  const regionMap = new Map<string, AggregatedRegion>();
  const interestMap = new Map<string, AggregatedInterest>();
  const foodMap = new Map<string, AggregatedFood>();
  const positive: AggregatedSignalItem[] = [];
  const negative: AggregatedSignalItem[] = [];

  const sortedByDate = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const report of sortedByDate) {
    const parsed = report.parsed;
    if (!parsed) continue;

    for (const region of parsed.regions) {
      const key = region.name.trim();
      if (!key) continue;
      const existing = regionMap.get(key);
      if (existing) {
        existing.mentionCount += region.mentionCount ?? 0;
        existing.hasCount = existing.hasCount || region.mentionCount != null;
        existing.reportCount += 1;
        const merged = new Set([...splitPlaces(existing.notablePlaces), ...splitPlaces(region.notablePlaces)]);
        existing.notablePlaces = [...merged].join(', ');
      } else {
        regionMap.set(key, {
          name: key,
          mentionCount: region.mentionCount ?? 0,
          hasCount: region.mentionCount != null,
          notablePlaces: splitPlaces(region.notablePlaces).join(', '),
          reportCount: 1,
        });
      }
    }

    for (const interest of parsed.interests) {
      const key = interest.title.trim();
      if (!key) continue;
      const existing = interestMap.get(key);
      const description = interest.description.trim();
      if (existing) {
        existing.reportCount += 1;
        if (description && !existing.descriptions.includes(description)) {
          existing.descriptions.push(description);
        }
      } else {
        interestMap.set(key, {
          title: key,
          descriptions: description ? [description] : [],
          reportCount: 1,
        });
      }
    }

    for (const food of parsed.foods) {
      const key = food.trim();
      if (!key) continue;
      const existing = foodMap.get(key);
      if (existing) existing.reportCount += 1;
      else foodMap.set(key, { name: key, reportCount: 1 });
    }

    for (const text of parsed.signals.positive) {
      positive.push({ text, reportTitle: report.title });
    }
    for (const text of parsed.signals.negative) {
      negative.push({ text, reportTitle: report.title });
    }
  }

  const regions = [...regionMap.values()].sort((a, b) => b.mentionCount - a.mentionCount);
  const interests = [...interestMap.values()].sort((a, b) => b.reportCount - a.reportCount);
  const foods = [...foodMap.values()].sort((a, b) => b.reportCount - a.reportCount);

  return {
    regions,
    interests,
    foods,
    signals: { positive, negative },
    reportCount: reports.length,
  };
}
