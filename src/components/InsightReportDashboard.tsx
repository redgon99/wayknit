import type { ParsedInsightReport, ParsedReportRegion } from '../lib/insightReportParser';

interface Props {
  data: ParsedInsightReport;
}

/** 태그만 나열하는 작은 목록 — 언급 수 없는 지역, 음식 키워드 등에 공용으로 쓴다 */
function TagList({ items }: { items: string[] }) {
  return (
    <div className="insight-report-tag-list">
      {items.map((item) => (
        <span key={item} className="admin-pill">
          {item}
        </span>
      ))}
    </div>
  );
}

/**
 * 리서치 리포트 본문에서 규칙 기반으로 뽑은 표·그래프를 렌더링만 한다(§34, §37).
 * 폼의 실시간 미리보기와 상세 모달 둘 다 이 컴포넌트를 재사용한다.
 */
export function InsightReportDashboard({ data }: Props) {
  const { regions, interests, signals, foods } = data;
  const regionsWithCount = regions.filter((r): r is ParsedReportRegion & { mentionCount: number } => r.mentionCount != null);
  const regionsTagOnly = regions.filter((r) => r.mentionCount == null);
  const maxCount = Math.max(1, ...regionsWithCount.map((r) => r.mentionCount));
  const hasSignals = signals.positive.length > 0 || signals.negative.length > 0;

  if (regions.length === 0 && interests.length === 0 && !hasSignals && foods.length === 0) return null;

  return (
    <div className="insight-report-dashboard">
      {regionsWithCount.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>지역별 언급</h4>
          <div className="insight-report-bar-list">
            {regionsWithCount.map((r) => (
              <div key={r.name} className="insight-report-bar-row">
                <span className="insight-report-bar-label">{r.name}</span>
                <div className="insight-report-bar-track">
                  <div
                    className="insight-report-bar-fill"
                    style={{ width: `${(r.mentionCount / maxCount) * 100}%` }}
                  >
                    <span className="insight-report-bar-value">{r.mentionCount}</span>
                  </div>
                </div>
                {r.notablePlaces && <span className="insight-report-bar-places">{r.notablePlaces}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {regionsTagOnly.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>그 외 언급 지역</h4>
          <p className="admin-cell-sub">본문에 언급 수 집계가 없어 태그로만 표시합니다.</p>
          <TagList items={regionsTagOnly.map((r) => r.name)} />
        </section>
      )}

      {interests.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>관심사</h4>
          <div className="insight-report-interest-list">
            {interests.map((it) => (
              <div key={it.title} className="insight-report-interest-card">
                <strong>{it.title}</strong>
                <p>{it.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {foods.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>음식</h4>
          <TagList items={foods} />
        </section>
      )}

      {hasSignals && (
        <section className="insight-report-dashboard-block">
          <h4>긍정·부정 신호</h4>
          <div className="insight-report-signals">
            {signals.positive.length > 0 && (
              <div className="insight-report-signal insight-report-signal-positive">
                <strong>긍정</strong>
                <ul className="insight-report-signal-list">
                  {signals.positive.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
            {signals.negative.length > 0 && (
              <div className="insight-report-signal insight-report-signal-negative">
                <strong>부정</strong>
                <ul className="insight-report-signal-list">
                  {signals.negative.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
