import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import {
  deriveAlerts,
  fetchDashboardSummary,
  type DashboardSummary,
} from '../lib/adminDashboard';
import '../styles/app.css';

function formatDate(iso: string | null): string {
  if (!iso) return '없음';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '없음';
  return d.toLocaleDateString('ko-KR');
}

/** 지표 한 덩어리 — 큰 숫자 하나와 곁들이는 설명들 */
function MetricCard({
  title,
  to,
  primary,
  primaryLabel,
  details,
}: {
  title: string;
  to: string;
  primary: number;
  primaryLabel: string;
  details: Array<{ label: string; value: string | number }>;
}) {
  return (
    <Link to={to} className="dash-card">
      <span className="dash-card-title">{title}</span>
      <span className="dash-card-primary">
        {primary.toLocaleString('ko-KR')}
        <small>{primaryLabel}</small>
      </span>
      <span className="dash-card-details">
        {details.map((d) => (
          <span key={d.label}>
            <em>{d.label}</em>
            {typeof d.value === 'number' ? d.value.toLocaleString('ko-KR') : d.value}
          </span>
        ))}
      </span>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setSummary(await fetchDashboardSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : '대시보드를 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (access !== 'ok') return;
    void load();
  }, [access, load]);

  const alerts = useMemo(() => (summary ? deriveAlerts(summary) : []), [summary]);

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>대시보드</h1>
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
          <h1>대시보드</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>대시보드</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/plan" className="admin-link-btn">
            플래너로 이동
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          subtitle="전 영역 지표를 한눈에 — 조치가 필요한 것부터"
          current="dashboard"
          refreshing={refreshing}
          onRefresh={() => void load()}
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <h2>조치가 필요한 것 ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <p className="admin-cell-sub">
              {summary ? '지금 바로 손댈 일은 없습니다.' : '불러오는 중…'}
            </p>
          ) : (
            <ul className="dash-alerts">
              {alerts.map((a) => (
                <li key={a.id} className={`dash-alert dash-alert--${a.level}`}>
                  <span className="dash-alert-msg">{a.message}</span>
                  <Link to={a.to} className="admin-link-btn">
                    {a.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {summary && (
          <section className="admin-section">
            <h2>영역별 현황</h2>
            <div className="dash-grid">
              <MetricCard
                title="여행 · 가입자"
                to="/admin"
                primary={summary.trips.total}
                primaryLabel="여행"
                details={[
                  { label: '가입자', value: summary.users.total },
                  { label: '여행 소유자', value: summary.trips.owners },
                  { label: '테스트 계정', value: summary.users.test },
                  { label: '공개', value: summary.trips.public },
                  { label: '최근 7일', value: summary.trips.created_7d },
                ]}
              />
              <MetricCard
                title="공유마당"
                to="/admin"
                primary={summary.trips.listed}
                primaryLabel="등록"
                details={[{ label: '전체 공개 여행', value: summary.trips.public }]}
              />
              <MetricCard
                title="신고 검수"
                to="/admin/reports"
                primary={summary.reports.open}
                primaryLabel="미처리"
                details={[{ label: '누적', value: summary.reports.total }]}
              />
              <MetricCard
                title="시나리오 카탈로그"
                to="/admin/scenarios"
                primary={summary.scenarios.published}
                primaryLabel="게시중"
                details={[
                  { label: '초안', value: summary.scenarios.draft },
                  { label: '테마', value: `${summary.scenarios.themes_covered}/10` },
                  { label: '지역', value: summary.scenarios.regions_covered },
                ]}
              />
              <MetricCard
                title="가이드 카드"
                to="/admin/guides"
                primary={summary.guides.published}
                primaryLabel="게시중"
                details={[{ label: '초안', value: summary.guides.draft }]}
              />
              <MetricCard
                title="시장 인사이트"
                to="/admin/insights"
                primary={summary.insights.raw_items}
                primaryLabel="수집 원문"
                details={[
                  { label: '키워드', value: summary.insights.keywords },
                  { label: '장소 연결', value: summary.insights.place_mentions },
                  { label: '최근 수집', value: formatDate(summary.insights.last_run_at) },
                ]}
              />
              <MetricCard
                title="배포관리"
                to="/admin/distribution"
                primary={summary.distribution.posted}
                primaryLabel="게시됨"
                details={[
                  { label: '계정', value: summary.distribution.accounts },
                  { label: '초안', value: summary.distribution.draft },
                  { label: '실패', value: summary.distribution.failed },
                ]}
              />
              <MetricCard
                title="감사 로그"
                to="/admin/audit"
                primary={summary.audit.today}
                primaryLabel="오늘 변경"
                details={[
                  { label: '누적', value: summary.audit.total },
                  { label: '관리자', value: summary.admins },
                  { label: '공지', value: `${summary.notices.published}/${summary.notices.total}` },
                ]}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
