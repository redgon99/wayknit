import type { AggregatedInsight } from '../lib/insightReportAggregate';

interface Props {
  data: AggregatedInsight;
}

/**
 * 여러 리서치 리포트를 합산한 통합 대시보드(§36) — InsightReportDashboard와
 * 같은 시각 언어(같은 CSS 클래스)를 쓰되, 리포트별이 아니라 합산 데이터를
 * 그린다는 점만 다르다.
 */
export function InsightAggregateDashboard({ data }: Props) {
  const { regions, interests, foods, signals } = data;
  const regionsWithCount = regions.filter((r) => r.hasCount);
  const regionsTagOnly = regions.filter((r) => !r.hasCount);
  const maxCount = Math.max(1, ...regionsWithCount.map((r) => r.mentionCount));
  const hasSignals = signals.positive.length > 0 || signals.negative.length > 0;

  if (regions.length === 0 && interests.length === 0 && !hasSignals && foods.length === 0) {
    return (
      <p className="admin-cell-sub">
        집계할 리포트가 없습니다. 검색·키워드 필터를 확인하거나 리포트를 먼저 등록해 주세요.
      </p>
    );
  }

  return (
    <div className="insight-report-dashboard">
      <p className="admin-cell-sub">리포트 {data.reportCount}건을 합산했습니다.</p>

      {regionsWithCount.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>지역별 언급 (합산)</h4>
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
                <span className="insight-report-bar-places">
                  <span className="admin-pill insight-report-bar-count">{r.reportCount}개 리포트</span>
                  {r.notablePlaces && ` · ${r.notablePlaces}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {regionsTagOnly.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>그 외 언급 지역 (합산)</h4>
          <p className="admin-cell-sub">언급 수 집계가 없어 등장 리포트 수만 배지로 표시합니다.</p>
          <div className="insight-report-tag-list">
            {regionsTagOnly.map((r) => (
              <span key={r.name} className="admin-pill">
                {r.name} · {r.reportCount}개 리포트
              </span>
            ))}
          </div>
        </section>
      )}

      {interests.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>관심사 (반복 주제 순)</h4>
          <div className="insight-report-interest-list">
            {interests.map((it) => (
              <div key={it.title} className="insight-report-interest-card">
                <strong>
                  {it.title} <span className="admin-pill">{it.reportCount}개 리포트</span>
                </strong>
                <ul className="insight-report-interest-descriptions">
                  {it.descriptions.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {foods.length > 0 && (
        <section className="insight-report-dashboard-block">
          <h4>음식 (합산)</h4>
          <div className="insight-report-tag-list">
            {foods.map((f) => (
              <span key={f.name} className="admin-pill">
                {f.name} · {f.reportCount}개 리포트
              </span>
            ))}
          </div>
        </section>
      )}

      {hasSignals && (
        <section className="insight-report-dashboard-block">
          <h4>긍정·부정 신호 (리포트별)</h4>
          <div className="insight-report-signals">
            {signals.positive.length > 0 && (
              <div className="insight-report-signal insight-report-signal-positive">
                <strong>긍정</strong>
                <ul className="insight-report-signal-list">
                  {signals.positive.map((item, i) => (
                    <li key={i}>
                      {item.text}
                      <span className="admin-cell-sub"> — {item.reportTitle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {signals.negative.length > 0 && (
              <div className="insight-report-signal insight-report-signal-negative">
                <strong>부정</strong>
                <ul className="insight-report-signal-list">
                  {signals.negative.map((item, i) => (
                    <li key={i}>
                      {item.text}
                      <span className="admin-cell-sub"> — {item.reportTitle}</span>
                    </li>
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
