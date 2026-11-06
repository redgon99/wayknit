import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AccessRankBars, type AccessRankRow } from '../components/AccessRankBars';
import { AccessTrendChart } from '../components/AccessTrendChart';
import { AdminPreviewModal } from '../components/AdminPreviewModal';
import { AdminShell } from '../components/AdminShell';
import {
  ACCESS_LOG_EXPORT_LIMIT,
  ACCESS_LOG_ROW_LIMIT,
  accessLogPeriod,
  accessLogPreviewUrl,
  fetchAccessLog,
  fetchAccessLogBreakdown,
  fetchAccessLogTrend,
  type AccessLogBreakdown,
  type AccessLogRankItem,
  type AccessLogReport,
  type AccessLogSection,
  type AccessLogTrend,
} from '../lib/adminAccessLog';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv';
import '../styles/app.css';

type RangePreset = '1' | '7' | '30';

const RANGE_LABEL: Record<RangePreset, string> = {
  '1': '오늘',
  '7': '최근 7일',
  '30': '최근 30일',
};

const PREVIOUS_LABEL: Record<RangePreset, string> = {
  '1': '어제 같은 시각까지',
  '7': '이전 7일',
  '30': '이전 30일',
};

type DetailTab = 'overview' | 'paths' | 'records';

const DETAIL_TAB_LABEL: Record<DetailTab, string> = {
  overview: '구역·유입',
  paths: '인기 경로',
  records: `최근 기록 (최대 ${ACCESS_LOG_ROW_LIMIT}건)`,
};

const SECTION_LABEL: Record<AccessLogSection, string> = {
  home: '랜딩',
  guides: '가이드',
  planner: '플래너',
  plaza: '공유마당',
  info: '한국여행정보',
  admin: '관리자',
  other: '기타',
};

function sourceLabel(key: string): string {
  return key === 'direct' ? '직접 입력·북마크' : key;
}

function countryLabel(code: string): string {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function rankRows(
  items: AccessLogRankItem[],
  total: number,
  unit: string,
  label: (key: string) => string
): AccessRankRow[] {
  return items.map((item) => ({
    key: item.key,
    label: label(item.key),
    value: item.count,
    detail: `${unit} · ${percentOf(item.count, total)}`,
  }));
}

function percentOf(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '-';
}

/** 이전 기간 대비 증감 문구. 기록이 모자라면 비율을 만들지 않는다. */
function deltaText(current: number, previous: number, label: string, complete: boolean): string {
  if (!complete) return '이전 기간 기록 부족';
  const base = `${label} ${previous.toLocaleString('ko-KR')}`;
  if (previous === 0) return base;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return `변동 없음 · ${base}`;
  return `${percent > 0 ? '▲' : '▼'} ${Math.abs(percent)}% · ${base}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

interface PagePreview {
  path: string;
  url: string;
}

/** 열 수 있는 경로만 버튼이 된다. 나머지는 글자로 둔다. */
function PathCell({
  path,
  locale,
  onPreview,
}: {
  path: string;
  locale: string | null;
  onPreview: (preview: PagePreview) => void;
}) {
  const url = accessLogPreviewUrl(path, locale);
  if (!url) return <>{path}</>;
  return (
    <button type="button" className="access-path-btn" onClick={() => onPreview({ path, url })}>
      {path}
    </button>
  );
}

export default function AdminAccessLogPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<AccessLogReport | null>(null);
  const [trend, setTrend] = useState<AccessLogTrend | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<AccessLogBreakdown | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [range, setRange] = useState<RangePreset>('7');
  const [pathInput, setPathInput] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [includeInternal, setIncludeInternal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const latestRequest = useRef(0);

  // 집계가 DB로 옮겨가 글자마다 조회하면 낭비다 — 입력이 멈추면 조회한다.
  useEffect(() => {
    const timer = window.setTimeout(() => setPathFilter(pathInput), 300);
    return () => window.clearTimeout(timer);
  }, [pathInput]);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setRefreshing(true);
    setError(null);
    setTrendError(null);
    setBreakdownError(null);
    const period = accessLogPeriod(Number(range));
    const path = pathFilter || undefined;
    // 추세가 실패해도 합계와 기록 표는 보여줄 수 있다.
    const trendRequest = fetchAccessLogTrend(period, { path, includeInternal }).catch((e: unknown) => {
      if (request === latestRequest.current) {
        setTrendError(e instanceof Error ? e.message : '추세를 불러오지 못했습니다.');
      }
      return null;
    });
    // 경로 검색 중엔 보여주지 않으므로 조회하지 않는다.
    const breakdownRequest = path
      ? Promise.resolve(null)
      : fetchAccessLogBreakdown(period, includeInternal).catch((e: unknown) => {
          if (request === latestRequest.current) {
            setBreakdownError(e instanceof Error ? e.message : '구역별 집계를 불러오지 못했습니다.');
          }
          return null;
        });
    try {
      const [next, nextTrend, nextBreakdown] = await Promise.all([
        fetchAccessLog({ since: period.since, path, includeInternal }),
        trendRequest,
        breakdownRequest,
      ]);
      // 늦게 도착한 이전 조건의 응답이 최신 결과를 덮어쓰지 않게 한다.
      if (request === latestRequest.current) {
        setReport(next);
        setTrend(nextTrend);
        setBreakdown(nextBreakdown);
      }
    } catch (e) {
      if (request === latestRequest.current) {
        // 이전 수치가 남아 있으면 지금 조건의 결과로 오해하게 된다.
        setReport(null);
        setTrend(null);
        setBreakdown(null);
        setError(e instanceof Error ? e.message : '접속 로그를 불러오지 못했습니다.');
      }
    } finally {
      if (request === latestRequest.current) setRefreshing(false);
    }
  }, [range, pathFilter, includeInternal]);

  useEffect(() => {
    if (access === 'ok') void load();
  }, [access, load]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { rows } = await fetchAccessLog({
        since: accessLogPeriod(Number(range)).since,
        path: pathFilter || undefined,
        includeInternal,
        rowLimit: ACCESS_LOG_EXPORT_LIMIT,
      });
      const csv = toCsv(rows, [
        { header: '시각', value: (r) => r.createdAt },
        { header: '경로', value: (r) => r.path },
        { header: '언어', value: (r) => r.locale ?? '' },
        { header: '로그인 여부', value: (r) => (r.loggedIn ? '로그인' : '비로그인') },
        { header: '세션', value: (r) => r.sessionId ?? '' },
      ]);
      downloadCsv(csvFilename('wayknit_접속로그'), csv);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setExporting(false);
    }
  };

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>접속 로그</h1>
          <p>Supabase가 설정된 환경에서만 사용할 수 있습니다.</p>
        </div>
      </main>
    );
  }
  if (access === 'anon') return <Navigate to="/login" replace />;
  if (access === 'loading') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>접속 로그</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>접속 로그</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/plan" className="admin-link-btn">
            플래너로 이동
          </Link>
        </div>
      </main>
    );
  }

  const total = report?.total ?? 0;
  const top = report?.topPaths ?? [];
  const rows = report?.rows ?? [];
  const excluded = report?.excluded ?? 0;
  // 구역·유입은 경로 검색 중 조회하지 않으므로 그동안만 인기 경로를 보여준다.
  const activeTab = pathFilter && detailTab === 'overview' ? 'paths' : detailTab;
  const compare = (pick: 'views' | 'visitors') =>
    trend &&
    deltaText(trend.current[pick], trend.previous[pick], PREVIOUS_LABEL[range], trend.previousComplete);

  return (
    <AdminShell
      subtitle="페이지 방문 기록 — 접속 시각·경로·언어 (개인정보는 담지 않음)"
      current="access-log"
      refreshing={refreshing}
      onRefresh={() => void load()}
      wide
    >
      {error && <div className="admin-error">{error}</div>}

      <section className="admin-section">
        <div className="admin-filter-row access-filter-row">
          {(Object.keys(RANGE_LABEL) as RangePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`admin-link-btn${range === p ? ' active' : ''}`}
              onClick={() => setRange(p)}
            >
              {RANGE_LABEL[p]}
            </button>
          ))}
          <input
            type="search"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="경로 검색 (예: /guides)"
            aria-label="경로 검색"
            style={{ minWidth: 200 }}
          />
          <label className="admin-cell-sub">
            <input
              type="checkbox"
              checked={includeInternal}
              onChange={(e) => setIncludeInternal(e.target.checked)}
            />{' '}
            내부 접속 포함
            {excluded > 0 && ` (${excluded.toLocaleString('ko-KR')}건 제외 중)`}
          </label>
          <button
            type="button"
            className="admin-link-btn"
            disabled={exporting || total === 0}
            onClick={() => void handleExport()}
          >
            {exporting ? '내보내는 중…' : 'CSV 내보내기'}
          </button>
        </div>

        <div className="admin-stats-grid access-kpis">
          <article className="admin-stat-card">
            <span>총 조회수</span>
            <strong>{report ? total.toLocaleString('ko-KR') : '-'}</strong>
            {trend && <small className="admin-stat-delta">{compare('views')}</small>}
          </article>
          <article className="admin-stat-card">
            <span>고유 방문자</span>
            <strong>{report ? report.visitors.toLocaleString('ko-KR') : '-'}</strong>
            {trend && <small className="admin-stat-delta">{compare('visitors')}</small>}
          </article>
          {!pathFilter && breakdown && (
            <>
              <article className="admin-stat-card">
                <span>방문 수</span>
                <strong>{breakdown.visits.toLocaleString('ko-KR')}</strong>
                <small className="admin-stat-delta">30분 이상 쉬면 새 방문</small>
              </article>
              <article className="admin-stat-card">
                <span>방문당 페이지 수</span>
                <strong>
                  {breakdown.visits > 0 ? (breakdown.views / breakdown.visits).toFixed(1) : '-'}
                </strong>
                <small className="admin-stat-delta">
                  조회 {breakdown.views.toLocaleString('ko-KR')} ÷ 방문{' '}
                  {breakdown.visits.toLocaleString('ko-KR')}
                </small>
              </article>
              <article className="admin-stat-card">
                <span>한 페이지만 보고 나간 비율</span>
                <strong>{percentOf(breakdown.bouncedVisits, breakdown.visits)}</strong>
                <small className="admin-stat-delta">
                  방문 {breakdown.visits.toLocaleString('ko-KR')}회 중{' '}
                  {breakdown.bouncedVisits.toLocaleString('ko-KR')}회
                </small>
              </article>
              <article className="admin-stat-card">
                <span>재방문 비율</span>
                <strong>{percentOf(breakdown.returningVisitors, breakdown.visitors)}</strong>
                <small className="admin-stat-delta">
                  방문자 {breakdown.visitors.toLocaleString('ko-KR')}명 중 2번 이상{' '}
                  {breakdown.returningVisitors.toLocaleString('ko-KR')}명
                </small>
              </article>
            </>
          )}
        </div>
        {breakdownError && <p className="admin-cell-sub">{breakdownError}</p>}
        {pathFilter && (
          <p className="admin-cell-sub">
            한 번의 방문은 여러 경로에 걸치므로 경로 검색 중에는 방문 지표와 구역·유입을 표시하지 않습니다.
          </p>
        )}

        <details className="access-criteria">
          <summary>집계 기준</summary>
          <p className="admin-cell-sub">
            모든 페이지 이동 시 언어 접두사를 뗀 경로로 기록됩니다. IP·User-Agent·이메일은 수집하지 않습니다 —
            로그인 여부만 구분하고, 비로그인 방문자는 브라우저에 저장된 임의 세션 값으로 집계합니다. 유입은 직전 사이트의
            도메인과 캠페인 코드만, 국가는 두 글자 코드만 남깁니다. 유입은 외부에서 처음 들어온 횟수, 국가는 방문자
            수이며 수집을 시작한 뒤의 기록만 집계됩니다. 내부 접속(관리자 페이지, 관리자·테스트 계정, 그 계정을 쓴
            브라우저)은 기본으로 제외합니다.
            {total > ACCESS_LOG_EXPORT_LIMIT &&
              ` CSV에는 최신 ${ACCESS_LOG_EXPORT_LIMIT.toLocaleString('ko-KR')}건까지만 담깁니다.`}
          </p>
        </details>
      </section>

      {(trend || trendError) && (
        <section className="admin-section">
          <h2>{range === '1' ? '시간대별 추이' : '일별 추이'}</h2>
          {trendError && <p className="admin-cell-sub">{trendError}</p>}
          {trend && (
            <AccessTrendChart
              points={trend.points}
              bucket={range === '1' ? 'hour' : 'day'}
              dimmed={refreshing}
            />
          )}
        </section>
      )}

      <section className="admin-section">
        <div className="admin-filter-row">
          {(Object.keys(DETAIL_TAB_LABEL) as DetailTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`admin-link-btn${activeTab === tab ? ' active' : ''}`}
              aria-pressed={activeTab === tab}
              disabled={tab === 'overview' && Boolean(pathFilter)}
              onClick={() => setDetailTab(tab)}
            >
              {DETAIL_TAB_LABEL[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'overview' &&
          (breakdown ? (
            <div className="access-rank-columns">
              <div>
                <h3>구역별 조회수</h3>
                {breakdown.sections.length > 0 ? (
                  <AccessRankBars
                    rows={breakdown.sections.map((s) => ({
                      key: s.key,
                      label: SECTION_LABEL[s.key],
                      value: s.views,
                      detail: `회 · ${percentOf(s.views, breakdown.views)} · 방문자 ${s.visitors.toLocaleString('ko-KR')}명`,
                    }))}
                  />
                ) : (
                  <p className="admin-cell-sub">이 기간에 기록된 접속이 없습니다.</p>
                )}
              </div>
              <div>
                <h3>유입 경로</h3>
                {breakdown.sources.length > 0 ? (
                  <AccessRankBars
                    rows={rankRows(breakdown.sources, breakdown.sourceTotal, '회', sourceLabel)}
                  />
                ) : (
                  <p className="admin-cell-sub">아직 수집된 기록이 없습니다.</p>
                )}
              </div>
              <div>
                <h3>접속 국가</h3>
                {breakdown.countries.length > 0 ? (
                  <AccessRankBars
                    rows={rankRows(breakdown.countries, breakdown.countryTotal, '명', countryLabel)}
                  />
                ) : (
                  <p className="admin-cell-sub">아직 수집된 기록이 없습니다.</p>
                )}
              </div>
            </div>
          ) : (
            !refreshing && <p className="admin-cell-sub">표시할 집계가 없습니다.</p>
          ))}

        {activeTab === 'paths' && (
          <div className="admin-table-wrap access-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>경로</th>
                  <th>조회수</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.path}>
                    <td>
                      <PathCell path={t.path} locale={null} onPreview={setPreview} />
                    </td>
                    <td>{t.count}</td>
                  </tr>
                ))}
                {report && top.length === 0 && !refreshing && (
                  <tr>
                    <td colSpan={2}>이 기간에 기록된 접속이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="admin-table-wrap access-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>시각</th>
                  <th>경로</th>
                  <th>언어</th>
                  <th>로그인</th>
                  <th>세션</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.createdAt)}</td>
                    <td>
                      <PathCell path={e.path} locale={e.locale} onPreview={setPreview} />
                    </td>
                    <td>{e.locale ?? '-'}</td>
                    <td>{e.loggedIn ? '로그인' : <span className="admin-cell-sub">비로그인</span>}</td>
                    <td>{e.sessionId ? e.sessionId.slice(0, 8) : '-'}</td>
                  </tr>
                ))}
                {report && rows.length === 0 && !refreshing && (
                  <tr>
                    <td colSpan={5}>이 기간에 기록된 접속이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && (
        <AdminPreviewModal
          open
          onClose={() => setPreview(null)}
          title={preview.path}
          className="access-preview-modal"
          headerExtra={
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-link-btn access-preview-open"
            >
              새 탭에서 열기
            </a>
          }
        >
          <iframe key={preview.url} title={`${preview.path} 미리보기`} src={preview.url} />
        </AdminPreviewModal>
      )}
    </AdminShell>
  );
}
