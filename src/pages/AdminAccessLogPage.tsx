import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminShell } from '../components/AdminShell';
import {
  ACCESS_LOG_LIMIT,
  listAccessLog,
  topPaths,
  uniqueVisitors,
  type AccessLogEntry,
} from '../lib/adminAccessLog';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv';
import '../styles/app.css';

type RangePreset = '1' | '7' | '30';

const RANGE_LABEL: Record<RangePreset, string> = {
  '1': '오늘',
  '7': '최근 7일',
  '30': '최근 30일',
};

function sinceIsoFor(preset: RangePreset): string {
  const days = Number(preset);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

const ROW_LIMIT = 300;

export default function AdminAccessLogPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<AccessLogEntry[]>([]);
  const [range, setRange] = useState<RangePreset>('7');
  const [pathFilter, setPathFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await listAccessLog({ since: sinceIsoFor(range), path: pathFilter || undefined });
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '접속 로그를 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, [range, pathFilter]);

  useEffect(() => {
    if (access === 'ok') void load();
  }, [access, load]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = toCsv(entries, [
        { header: '시각', value: (r) => r.createdAt },
        { header: '경로', value: (r) => r.path },
        { header: '언어', value: (r) => r.locale ?? '' },
        { header: '로그인 여부', value: (r) => (r.userId ? '로그인' : '비로그인') },
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

  const top = topPaths(entries, 10);
  const visitors = uniqueVisitors(entries);
  const atLimit = entries.length >= ACCESS_LOG_LIMIT;

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
        <p className="admin-cell-sub" style={{ marginTop: 0 }}>
          모든 페이지 이동 시 언어 접두사를 뗀 경로로 기록됩니다(관리자 페이지 포함). IP·User-Agent·이메일은
          수집하지 않습니다 — 로그인 여부만 구분하고, 비로그인 방문자는 브라우저에 저장된 임의 세션 값으로
          집계합니다.
          {atLimit && ` 이 기간 기록이 ${ACCESS_LOG_LIMIT}건을 넘어 최신 ${ACCESS_LOG_LIMIT}건만 표시합니다.`}
        </p>

        <div className="admin-filter-row">
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
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="경로 검색 (예: /guides)"
            aria-label="경로 검색"
            style={{ minWidth: 200 }}
          />
          <button
            type="button"
            className="admin-link-btn"
            disabled={exporting || entries.length === 0}
            onClick={() => void handleExport()}
          >
            {exporting ? '내보내는 중…' : 'CSV 내보내기'}
          </button>
        </div>

        <div className="admin-stats-grid">
          <article className="admin-stat-card">
            <span>총 조회수 ({RANGE_LABEL[range]})</span>
            <strong>{entries.length}</strong>
          </article>
          <article className="admin-stat-card">
            <span>고유 방문자(로그인+비로그인 세션)</span>
            <strong>{visitors}</strong>
          </article>
          <article className="admin-stat-card">
            <span>가장 많이 본 경로</span>
            <strong>{top[0] ? `${top[0].path} (${top[0].count})` : '-'}</strong>
          </article>
        </div>
      </section>

      {top.length > 0 && (
        <section className="admin-section">
          <h2>경로별 조회수 TOP {top.length}</h2>
          <div className="admin-table-wrap">
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
                    <td>{t.path}</td>
                    <td>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="admin-section">
        <h2>최근 기록 (최대 {ROW_LIMIT}건 표시)</h2>
        <div className="admin-table-wrap">
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
              {entries.slice(0, ROW_LIMIT).map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.createdAt)}</td>
                  <td>{e.path}</td>
                  <td>{e.locale ?? '-'}</td>
                  <td>{e.userId ? '로그인' : <span className="admin-cell-sub">비로그인</span>}</td>
                  <td>{e.sessionId ? e.sessionId.slice(0, 8) : '-'}</td>
                </tr>
              ))}
              {entries.length === 0 && !refreshing && (
                <tr>
                  <td colSpan={5}>이 기간에 기록된 접속이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
