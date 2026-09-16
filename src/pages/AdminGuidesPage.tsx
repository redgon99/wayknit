import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import { GUIDE_KIND_META, GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import {
  archiveGuide,
  getAdminGuide,
  listAdminGuides,
  publishGuide,
  unpublishGuide,
  updateGuide,
} from '../lib/guides';
import type { GuideArticle, GuideStatus } from '../types/guides';
import '../styles/app.css';

const STATUS_LABEL: Record<GuideStatus, string> = {
  draft: '초안',
  published: '발행됨',
  archived: '보관',
};

export default function AdminGuidesPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [guides, setGuides] = useState<GuideArticle[]>([]);
  const [statusFilter, setStatusFilter] = useState<GuideStatus | ''>('');
  const [kindFilter, setKindFilter] = useState<GuideKind | ''>('');
  const [editing, setEditing] = useState<GuideArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadList = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await listAdminGuides({
        status: statusFilter || undefined,
        kind: kindFilter || undefined,
      });
      setGuides(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가이드 목록을 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, [statusFilter, kindFilter]);

  useEffect(() => {
    if (access === 'ok') void loadList();
  }, [access, loadList]);

  const openEdit = async (id: string) => {
    try {
      const g = await getAdminGuide(id);
      if (!g) {
        setError('가이드를 찾을 수 없습니다.');
        return;
      }
      setEditing(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가이드를 열 수 없습니다.');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateGuide(editing.id, {
        title: editing.title,
        summary: editing.summary,
        bodyMd: editing.bodyMd,
        summaryEn: editing.summaryEn,
        kind: editing.kind,
        topicTags: editing.topicTags,
        sourceUrls: editing.sourceUrls,
        slug: editing.slug,
      });
      await loadList();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>가이드 카드</h1>
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
          <h1>가이드 카드</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>가이드 카드</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/admin" className="admin-link-btn">
            관리자 페이지로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          title="가이드 카드"
          subtitle="종류별 초안을 검수·발행합니다. 추천 여행코스는 플래너 자동 동선과 연동됩니다."
          current="guides"
          refreshing={refreshing}
          onRefresh={() => void loadList()}
          extraActions={
            <Link to="/guides" className="admin-link-btn">
              공개 가이드 보기
            </Link>
          }
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.currentTarget.value as GuideStatus | '')}
            >
              <option value="">전체 상태</option>
              <option value="draft">초안</option>
              <option value="published">발행됨</option>
              <option value="archived">보관</option>
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.currentTarget.value as GuideKind | '')}
            >
              <option value="">전체 종류</option>
              {GUIDE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {GUIDE_KIND_META[k].labelKo}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>종류</th>
                  <th>상태</th>
                  <th>태그</th>
                  <th>갱신</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div>{g.title}</div>
                      <div className="admin-cell-sub">{g.summary.slice(0, 80)}</div>
                    </td>
                    <td>
                      <span className="admin-pill">{GUIDE_KIND_META[g.kind].labelKo}</span>
                    </td>
                    <td>
                      <span className={`admin-pill ${g.status === 'published' ? 'ok' : ''}`}>
                        {STATUS_LABEL[g.status]}
                      </span>
                    </td>
                    <td>{g.topicTags.join(', ') || '-'}</td>
                    <td>{new Date(g.updatedAt).toLocaleString('ko-KR', { hour12: false })}</td>
                    <td>
                      <div className="admin-action-row">
                        <button type="button" onClick={() => void openEdit(g.id)}>
                          편집
                        </button>
                        {g.status !== 'published' ? (
                          <button
                            type="button"
                            className="admin-create-btn"
                            onClick={() =>
                              void publishGuide(g.id)
                                .then(loadList)
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : '발행 실패')
                                )
                            }
                          >
                            발행
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void unpublishGuide(g.id)
                                .then(loadList)
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : '발행 취소 실패')
                                )
                            }
                          >
                            발행 취소
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            void archiveGuide(g.id)
                              .then(loadList)
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : '보관 실패')
                              )
                          }
                        >
                          보관
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {guides.length === 0 && (
                  <tr>
                    <td colSpan={6} className="admin-cell-sub">
                      가이드가 없습니다. 인사이트 소스리스트에서 「가이드카드」로 초안을 만드세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {editing && (
          <section className="admin-section admin-guide-editor">
            <h2>편집</h2>
            <label className="admin-guide-field">
              종류
              <select
                value={editing.kind}
                onChange={(e) =>
                  setEditing({ ...editing, kind: e.currentTarget.value as GuideKind })
                }
              >
                {GUIDE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {GUIDE_KIND_META[k].labelKo} — {GUIDE_KIND_META[k].descriptionKo}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-guide-field">
              슬러그
              <input
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.currentTarget.value })}
              />
            </label>
            <label className="admin-guide-field">
              제목
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.currentTarget.value })}
              />
            </label>
            <label className="admin-guide-field">
              요약
              <textarea
                rows={3}
                value={editing.summary}
                onChange={(e) => setEditing({ ...editing, summary: e.currentTarget.value })}
              />
            </label>
            <label className="admin-guide-field">
              본문 (Markdown)
              <textarea
                rows={14}
                value={editing.bodyMd}
                onChange={(e) => setEditing({ ...editing, bodyMd: e.currentTarget.value })}
              />
            </label>
            <label className="admin-guide-field">
              보조 태그 (쉼표 구분)
              <input
                value={editing.topicTags.join(', ')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    topicTags: e.currentTarget.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label className="admin-guide-field">
              출처 URL (줄바꿈)
              <textarea
                rows={3}
                value={editing.sourceUrls.join('\n')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    sourceUrls: e.currentTarget.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="admin-action-row">
              <button
                type="button"
                className="admin-create-btn"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                취소
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
