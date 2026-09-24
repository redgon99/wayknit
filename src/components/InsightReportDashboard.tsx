import type { ParsedInsightReport } from '../lib/insightReportParser';

interface Props {
  data: ParsedInsightReport;
}

/**
 * 리서치 리포트 본문에서 규칙 기반으로 뽑은 표·그래프를 렌더링만 한다(§34).
 * 폼의 실시간 미리보기와 상세 모달 둘 다 이 컴포넌트를 재사용한다.
 */
export function InsightReportDashboard({ data }: Props) {
  const { regions, interests, signals } = data;
  const maxCount = Math.max(1, ...regions.map((r) => r.mentionCount));
  const hasSignals = Boolean(signals.positive || signals.negative);

  if (regions.length === 0 && interests.length === 0 && !hasSignals) return null;

  return (
    <div className="insight-report-dashboard">
      {regions.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>지역별 언급</h4>
          <div className="insight-report-bar-list">
            {regions.map((r) => (
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

      {hasSignals && (
        <section className="insight-report-dashboard-block">
          <h4>긍정·부정 신호</h4>
          <div className="insight-report-signals">
            {signals.positive && (
              <div className="insight-report-signal insight-report-signal-positive">
                <strong>긍정</strong>
                <p>{signals.positive}</p>
              </div>
            )}
            {signals.negative && (
              <div className="insight-report-signal insight-report-signal-negative">
                <strong>부정</strong>
                <p>{signals.negative}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
