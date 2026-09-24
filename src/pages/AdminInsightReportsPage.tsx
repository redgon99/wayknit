import { useCallback, useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminShell } from '../components/AdminShell';
import { AdminPreviewModal } from '../components/AdminPreviewModal';
import { InsightReportDashboard } from '../components/InsightReportDashboard';
import {
  createInsightReport,
  deleteInsightReport,
  listInsightReportKeywords,
  listInsightReports,
  updateInsightReport,
  type InsightReportInput,
} from '../lib/adminInsightReports';
import { hasParsedContent, parseInsightReportBody } from '../lib/insightReportParser';
import { renderGuideMarkdown } from '../lib/guideMarkdown';
import type { InsightReport } from '../types/insights';
import '../styles/app.css';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR');
}

/** 폼 입력은 controlled input이라 전부 string으로 두고, 저장 시에만 null로 변환한다(handleSave) */
interface ReportFormState {
  title: string;
  summary: string;
  bodyMd: string;
  keywordsRaw: string;
  periodFrom: string;
  periodTo: string;
  sourceNote: string;
}

const EMPTY_FORM: ReportFormState = {
  title: '',
  summary: '',
  bodyMd: '',
  keywordsRaw: '',
  periodFrom: '',
  periodTo: '',
  sourceNote: '',
};

export default function AdminInsightReportsPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [reports, setReports] = useState<InsightReport[]>([]);
  const [keywordOptions, setKeywordOptions] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');

  const [viewingReport, setViewingReport] = useState<InsightReport | null>(null);
  const [modalView, setModalView] = useState<'dashboard' | 'raw'>('dashboard');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* 검색어는 타이핑마다 쿼리를 보내지 않고 300ms 멈췄을 때만 반영(AdminAuditPage와 동일 패턴) */
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [reportRows, keywordRows] = await Promise.all([
        listInsightReports({ q: search || undefined, keyword: filterKeyword || undefined }),
        listInsightReportKeywords(),
      ]);
      setReports(reportRows);
      setKeywordOptions(keywordRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '리포트를 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, [search, filterKeyword]);

  useEffect(() => {
    if (access !== 'ok') return;
    void loadAll();
  }, [access, loadAll]);

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>리서치 리포트</h1>
          <p>Supabase가 설정된 환경에서만 사용할 수 있습니다.</p>
          <Link to="/admin" className="admin-link-btn">
            관리자 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }
  if (access === 'anon') return <Navigate to="/login" replace />;
  if (access === 'loading') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>리서치 리포트</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>리서치 리포트</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/admin" className="admin-link-btn">
            관리자 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId('new');
  };

  const openEdit = (report: InsightReport) => {
    setForm({
      title: report.title,
      summary: report.summary ?? '',
      bodyMd: report.bodyMd,
      keywordsRaw: report.keywords.join(', '),
      periodFrom: report.periodFrom ?? '',
      periodTo: report.periodTo ?? '',
      sourceNote: report.sourceNote ?? '',
    });
    setEditingId(report.id);
    setViewingReport(null);
  };

  const openView = (report: InsightReport) => {
    setModalView('dashboard');
    setViewingReport(report);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.bodyMd.trim()) {
      setError('제목과 본문은 필수입니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const keywords = form.keywordsRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const input: InsightReportInput = {
        title: form.title,
        summary: form.summary || null,
        bodyMd: form.bodyMd,
        keywords,
        periodFrom: form.periodFrom || null,
        periodTo: form.periodTo || null,
        sourceNote: form.sourceNote || null,
      };
      if (editingId === 'new') {
        await createInsightReport(input);
      } else if (editingId) {
        await updateInsightReport(editingId, input);
      }
      closeForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 리포트를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteInsightReport(id);
      setViewingReport(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminShell
      subtitle="레딧·블로그 등에서 정리한 리서치 요약을 쌓아두고 키워드로 다시 찾습니다(관리자 전용)."
      current="insight-reports"
      refreshing={refreshing}
      onRefresh={() => void loadAll()}
    >
      {error && <div className="admin-error">{error}</div>}

      <section className="admin-section">
        <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
          <input
            className="admin-notice-title"
            style={{ flex: 2 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            placeholder="제목·요약·본문 검색"
          />
          <input
            className="admin-notice-title"
            style={{ flex: 1 }}
            list="insight-report-keywords"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.currentTarget.value)}
            placeholder="키워드로 좁히기 (예: 서울)"
          />
          <datalist id="insight-report-keywords">
            {keywordOptions.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <button type="button" className="admin-create-btn" onClick={openCreate}>
            + 새 리포트
          </button>
        </div>

        {editingId && (
          <div className="admin-section" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>
              {editingId === 'new' ? '새 리포트' : '리포트 수정'}
            </h3>
            <input
              className="admin-notice-title"
              value={form.title}
              onChange={(e) => {
                const title = e.currentTarget.value;
                setForm((f) => ({ ...f, title }));
              }}
              placeholder="제목 (필수)"
            />
            <input
              className="admin-notice-title"
              style={{ marginTop: 8 }}
              value={form.summary}
              onChange={(e) => {
                const summary = e.currentTarget.value;
                setForm((f) => ({ ...f, summary }));
              }}
              placeholder="한 줄 요약 (선택)"
            />
            <div className="admin-notice-form-row" style={{ marginTop: 8 }}>
              <input
                className="admin-notice-title"
                style={{ flex: 2 }}
                list="insight-report-keywords"
                value={form.keywordsRaw}
                onChange={(e) => {
                  const keywordsRaw = e.currentTarget.value;
                  setForm((f) => ({ ...f, keywordsRaw }));
                }}
                placeholder="키워드 (쉼표로 구분, 예: 서울, 부산, itinerary)"
              />
              <input
                className="admin-notice-title"
                style={{ flex: 1 }}
                value={form.sourceNote}
                onChange={(e) => {
                  const sourceNote = e.currentTarget.value;
                  setForm((f) => ({ ...f, sourceNote }));
                }}
                placeholder="출처 메모 (예: 레딧 r/koreatravel)"
              />
            </div>
            <div className="admin-notice-form-row" style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                대상 기간
                <input
                  type="date"
                  value={form.periodFrom}
                  onChange={(e) => {
                    const periodFrom = e.currentTarget.value;
                    setForm((f) => ({ ...f, periodFrom }));
                  }}
                />
              </label>
              <span>~</span>
              <input
                type="date"
                value={form.periodTo}
                onChange={(e) => {
                  const periodTo = e.currentTarget.value;
                  setForm((f) => ({ ...f, periodTo }));
                }}
              />
              <span className="admin-cell-sub">(선택)</span>
            </div>
            <textarea
              className="admin-notice-body"
              style={{ marginTop: 8 }}
              rows={14}
              value={form.bodyMd}
              onChange={(e) => {
                const bodyMd = e.currentTarget.value;
                setForm((f) => ({ ...f, bodyMd }));
              }}
              placeholder="본문 (마크다운 그대로 붙여넣기)"
            />
            <div style={{ marginTop: 12 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                분석 미리보기
              </h4>
              {(() => {
                const preview = parseInsightReportBody(form.bodyMd);
                return hasParsedContent(preview) ? (
                  <InsightReportDashboard data={preview} />
                ) : (
                  <p className="admin-cell-sub">
                    구조화된 표를 찾지 못했습니다 — 저장은 원문 그대로 됩니다.
                  </p>
                );
              })()}
            </div>
            <div className="admin-action-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="admin-create-btn"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button type="button" disabled={saving} onClick={closeForm}>
                취소
              </button>
            </div>
          </div>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>기간</th>
                <th>키워드</th>
                <th>등록일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      type="button"
                      className="admin-link-btn"
                      onClick={() => openView(r)}
                    >
                      {r.title}
                    </button>
                    {r.summary && <div className="admin-cell-sub">{r.summary}</div>}
                  </td>
                  <td className="admin-cell-sub">
                    {r.periodFrom || r.periodTo ? `${formatDate(r.periodFrom)} ~ ${formatDate(r.periodTo)}` : '-'}
                  </td>
                  <td>
                    {r.keywords.map((k) => (
                      <span key={k} className="admin-pill" style={{ marginRight: 4 }}>
                        {k}
                      </span>
                    ))}
                  </td>
                  <td className="admin-cell-sub">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="admin-action-row">
                      <button type="button" onClick={() => openEdit(r)}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={deletingId === r.id}
                        onClick={() => void handleDelete(r.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && !refreshing && (
                <tr>
                  <td colSpan={5} className="admin-cell-sub">
                    등록된 리포트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AdminPreviewModal
        open={!!viewingReport}
        onClose={() => setViewingReport(null)}
        title={viewingReport?.title ?? ''}
        subtitle={
          viewingReport
            ? [
                viewingReport.sourceNote,
                viewingReport.periodFrom || viewingReport.periodTo
                  ? `${formatDate(viewingReport.periodFrom)} ~ ${formatDate(viewingReport.periodTo)}`
                  : null,
                formatDate(viewingReport.createdAt),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        headerExtra={
          viewingReport && (
            <div className="admin-action-row" style={{ marginTop: 8 }}>
              {hasParsedContent(viewingReport.parsed) && (
                <>
                  <button
                    type="button"
                    className={modalView === 'dashboard' ? 'admin-tab-btn active' : 'admin-tab-btn'}
                    onClick={() => setModalView('dashboard')}
                  >
                    표·그래프 보기
                  </button>
                  <button
                    type="button"
                    className={modalView === 'raw' ? 'admin-tab-btn active' : 'admin-tab-btn'}
                    onClick={() => setModalView('raw')}
                  >
                    원문 보기
                  </button>
                </>
              )}
              <button type="button" onClick={() => openEdit(viewingReport)}>
                수정
              </button>
              <button
                type="button"
                className="danger"
                disabled={deletingId === viewingReport.id}
                onClick={() => void handleDelete(viewingReport.id)}
              >
                삭제
              </button>
            </div>
          )
        }
      >
        {viewingReport &&
          (hasParsedContent(viewingReport.parsed) && modalView === 'dashboard' ? (
            <InsightReportDashboard data={viewingReport.parsed!} />
          ) : (
            <div className="guides-body">{renderGuideMarkdown(viewingReport.bodyMd)}</div>
          ))}
      </AdminPreviewModal>
    </AdminShell>
  );
}
