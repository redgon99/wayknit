import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import { isCurrentUserAdmin } from '../lib/admin';
import {
  AUDIT_PAGE_SIZE,
  AUDIT_TABLES,
  OPERATION_LABEL,
  auditSubject,
  auditTableLabel,
  describeAuditEntry,
  listAdminAuditLog,
  listAuditActors,
  restoreAuditEntry,
  restoreBlockReason,
  type AdminAuditEntry,
  type AuditOperation,
} from '../lib/adminAudit';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv';
import '../styles/app.css';

/** 내보내기는 화면에 불러온 페이지가 아니라 현재 필터 전체를 대상으로 한다 */
const EXPORT_LIMIT = 5000;

const OPERATIONS: AuditOperation[] = ['INSERT', 'UPDATE', 'DELETE'];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function AdminAuditPage() {
  const { configured, loading, user } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const [tableFilter, setTableFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState<AuditOperation | ''>('');
  const [actorFilter, setActorFilter] = useState('');

  const loadFirstPage = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await listAdminAuditLog({
        tableName: tableFilter || undefined,
        operation: operationFilter || undefined,
        actorEmail: actorFilter || undefined,
      });
      setEntries(rows);
      setHasMore(rows.length === AUDIT_PAGE_SIZE);
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '감사 로그를 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, [tableFilter, operationFilter, actorFilter]);

  useEffect(() => {
    if (!configured || loading || !user) {
      setCheckingAdmin(false);
      return;
    }
    let alive = true;
    (async () => {
      setCheckingAdmin(true);
      try {
        const ok = await isCurrentUserAdmin();
        if (!alive) return;
        setIsAdmin(ok);
        if (ok) {
          setActors(await listAuditActors().catch(() => []));
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '관리자 확인 실패');
      } finally {
        if (alive) setCheckingAdmin(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [configured, loading, user]);

  useEffect(() => {
    if (isAdmin) void loadFirstPage();
  }, [isAdmin, loadFirstPage]);

  const handleLoadMore = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const rows = await listAdminAuditLog({
        tableName: tableFilter || undefined,
        operation: operationFilter || undefined,
        actorEmail: actorFilter || undefined,
        beforeId: last.id,
      });
      setEntries((prev) => [...prev, ...rows]);
      setHasMore(rows.length === AUDIT_PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 로드 실패');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRestore = async (entry: AdminAuditEntry) => {
    const target = auditSubject(entry);
    const what = entry.operation === 'DELETE' ? '삭제된 항목을 되살립니다' : '이 변경을 되돌립니다';
    if (!window.confirm(`"${target}" — ${what}. 되돌린 기록도 감사 로그에 남습니다. 진행할까요?`)) {
      return;
    }
    setRestoringId(entry.id);
    setError(null);
    try {
      await restoreAuditEntry(entry.id);
      await loadFirstPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : '되돌리기 실패');
    } finally {
      setRestoringId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const rows = await listAdminAuditLog({
        tableName: tableFilter || undefined,
        operation: operationFilter || undefined,
        actorEmail: actorFilter || undefined,
        limit: EXPORT_LIMIT,
      });
      const csv = toCsv(rows, [
        { header: '시각', value: (r) => r.createdAt },
        { header: '작업자', value: (r) => r.actorEmail ?? '시스템' },
        { header: '영역', value: (r) => auditTableLabel(r.tableName) },
        { header: '테이블', value: (r) => r.tableName },
        { header: '작업', value: (r) => OPERATION_LABEL[r.operation] },
        { header: '대상', value: (r) => auditSubject(r) },
        { header: '대상 ID', value: (r) => r.rowId ?? '' },
        { header: '변경 요약', value: (r) => describeAuditEntry(r) },
        { header: '변경 컬럼', value: (r) => r.changedFields.join(' ') },
        { header: '이전', value: (r) => (r.before ? JSON.stringify(r.before) : '') },
        { header: '이후', value: (r) => (r.after ? JSON.stringify(r.after) : '') },
      ]);
      downloadCsv(csvFilename('wayknit_감사로그'), csv);
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
          <h1>감사 로그</h1>
          <p>Supabase가 설정된 환경에서만 사용할 수 있습니다.</p>
        </div>
      </main>
    );
  }
  if (!loading && !user) return <Navigate to="/login" replace />;
  if (checkingAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>감사 로그</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>감사 로그</h1>
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
          subtitle="관리자 변경 이력 — 누가·언제·무엇을 바꿨는지"
          current="audit"
          refreshing={refreshing}
          onRefresh={() => void loadFirstPage()}
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <h2>변경 이력</h2>
          <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
            DB 트리거가 기록하므로 앱·대시보드·엣지함수 어느 경로로 들어온 변경이든 남습니다. 로그는
            추가만 가능하고 수정·삭제할 수 없습니다. 값이 큰 컬럼(시나리오 본문 등)은 크기만 남기고
            생략됩니다.
          </p>

          <div className="admin-filter-row">
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              aria-label="영역 필터"
            >
              <option value="">전체 영역</option>
              {AUDIT_TABLES.map((t) => (
                <option key={t} value={t}>
                  {auditTableLabel(t)}
                </option>
              ))}
            </select>

            <select
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value as AuditOperation | '')}
              aria-label="작업 필터"
            >
              <option value="">전체 작업</option>
              {OPERATIONS.map((op) => (
                <option key={op} value={op}>
                  {OPERATION_LABEL[op]}
                </option>
              ))}
            </select>

            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              aria-label="작업자 필터"
            >
              <option value="">전체 작업자</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-link-btn"
              disabled={exporting || entries.length === 0}
              onClick={() => void handleExport()}
            >
              {exporting ? '내보내는 중…' : 'CSV 내보내기'}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>시각</th>
                  <th>작업자</th>
                  <th>영역</th>
                  <th>대상</th>
                  <th>변경 내용</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>
                        {entry.actorEmail ?? <span className="admin-cell-sub">시스템</span>}
                      </td>
                      <td>{auditTableLabel(entry.tableName)}</td>
                      <td>{auditSubject(entry)}</td>
                      <td>
                        <span className={`audit-op audit-op--${entry.operation.toLowerCase()}`}>
                          {OPERATION_LABEL[entry.operation]}
                        </span>{' '}
                        {describeAuditEntry(entry)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          aria-expanded={expanded === entry.id}
                        >
                          {expanded === entry.id ? '접기' : '보기'}
                        </button>
                      </td>
                    </tr>
                    {expanded === entry.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="audit-detail">
                            <div>
                              <h4>이전</h4>
                              <pre>
                                {entry.before ? JSON.stringify(entry.before, null, 2) : '(없음)'}
                              </pre>
                            </div>
                            <div>
                              <h4>이후</h4>
                              <pre>
                                {entry.after ? JSON.stringify(entry.after, null, 2) : '(없음)'}
                              </pre>
                            </div>
                          </div>
                          {(() => {
                            const blocked = restoreBlockReason(entry);
                            return (
                              <div className="audit-restore-row">
                                {blocked ? (
                                  <span className="admin-cell-sub">되돌릴 수 없음 — {blocked}</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-moderate-btn"
                                      disabled={restoringId === entry.id}
                                      onClick={() => void handleRestore(entry)}
                                    >
                                      {restoringId === entry.id
                                        ? '되돌리는 중…'
                                        : entry.operation === 'DELETE'
                                          ? '삭제 되살리기'
                                          : '이 변경 되돌리기'}
                                    </button>
                                    <span className="admin-cell-sub">
                                      되돌린 기록도 감사 로그에 남습니다
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {entries.length === 0 && !refreshing && (
                  <tr>
                    <td colSpan={6}>기록된 변경 이력이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="admin-action-row">
              <button
                type="button"
                className="admin-link-btn"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore ? '불러오는 중…' : '더보기'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
