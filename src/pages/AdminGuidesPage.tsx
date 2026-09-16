import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import { GUIDE_KIND_META, GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import {
  archiveGuide,
  buildGuideRow,
  getAdminGuide,
  listAdminGuides,
  publishGuide,
  unpublishGuide,
  updateGuide,
} from '../lib/guides';
import {
  discardDraft as discardContentDraft,
  listDraftKeys,
  listVersions,
  loadDraft,
  publishDraft,
  restoreVersion,
  saveDraft,
  type ContentVersion,
} from '../lib/adminContentDrafts';
import { normalizeGuideKind } from '../lib/guideKinds';
import type { GuideArticle, GuideStatus } from '../types/guides';
import '../styles/app.css';

/** 초안(admin_content_drafts)에 저장된 snake_case 행 일부를 편집 상태(camelCase)에 얹는다 */
function applyGuideDraftRow(base: GuideArticle, row: Record<string, unknown>): GuideArticle {
  return {
    ...base,
    title: (row.title as string | undefined) ?? base.title,
    summary: (row.summary as string | undefined) ?? base.summary,
    bodyMd: (row.body_md as string | undefined) ?? base.bodyMd,
    summaryEn: row.summary_en !== undefined ? ((row.summary_en as string | null) ?? null) : base.summaryEn,
    kind: row.kind !== undefined ? normalizeGuideKind(row.kind) : base.kind,
    topicTags: (row.topic_tags as string[] | undefined) ?? base.topicTags,
    sourceUrls: (row.source_urls as string[] | undefined) ?? base.sourceUrls,
    slug: (row.slug as string | undefined) ?? base.slug,
  };
}

const STATUS_LABEL: Record<GuideStatus, string> = {
  draft: '초안',
  published: '발행됨',
  archived: '보관',
};

export default function AdminGuidesPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [guides, setGuides] = useState<GuideArticle[]>([]);
  const [statusFilter, setStatusFilter] = useState<GuideStatus | ''>('');
  const [kindFilter, setKindFilter] = useState<GuideKind | ''>('');
  const [editing, setEditing] = useState<GuideArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /* C4(관리자 검토 2026-09-16) — 발행된 글은 초안/버전 경로로, draft·archived는 기존 직접수정 그대로 */
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());
  const [hasDraft, setHasDraft] = useState(false);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rows, keys] = await Promise.all([
        listAdminGuides({
          status: statusFilter || undefined,
          kind: kindFilter || undefined,
        }),
        listDraftKeys('guide_articles').catch(() => []),
      ]);
      setGuides(rows);
      setDraftKeys(new Set(keys));
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
    setShowVersions(false);
    try {
      const g = await getAdminGuide(id);
      if (!g) {
        setError('가이드를 찾을 수 없습니다.');
        return;
      }
      if (g.status === 'published') {
        const [draftRow, versionRows] = await Promise.all([
          loadDraft('guide_articles', id),
          listVersions('guide_articles', id),
        ]);
        setHasDraft(Boolean(draftRow));
        setVersions(versionRows);
        setEditing(draftRow ? applyGuideDraftRow(g, draftRow) : g);
      } else {
        setHasDraft(false);
        setVersions([]);
        setEditing(g);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '가이드를 열 수 없습니다.');
    }
  };

  /* R1(관리자 검토 2026-09-16)에서 신고 큐의 "관리 화면에서 열기" 링크가
   * 실제로는 죽어 있던 걸 고치며 같이 뚫음 — adminAudit.ts의
   * auditTargetHref도 이미 `/admin/guides?id=` 를 가리키고 있었는데
   * 이 페이지가 쿼리 파라미터를 읽은 적이 없었다(distribution 페이지의
   * ?account=/?post= 와 같은 종류의 죽은 링크, §31-8 참고). */
  useEffect(() => {
    if (access !== 'ok') return;
    const id = searchParams.get('id');
    if (!id) return;
    void openEdit(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('id');
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, searchParams]);

  function editableGuidePatch(g: GuideArticle) {
    return {
      title: g.title,
      summary: g.summary,
      bodyMd: g.bodyMd,
      summaryEn: g.summaryEn,
      kind: g.kind,
      topicTags: g.topicTags,
      sourceUrls: g.sourceUrls,
      slug: g.slug,
    };
  }

  /** draft/archived 글 — 예전처럼 바로 라이브 행을 고친다(운영본 개념이 없음) */
  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateGuide(editing.id, editableGuidePatch(editing));
      await loadList();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  /** 발행된 글 — 초안 저장. 운영본(guide_articles)은 안 바뀐다 */
  const handleSaveGuideDraft = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await saveDraft('guide_articles', editing.id, buildGuideRow(editableGuidePatch(editing)));
      setHasDraft(true);
      setDraftKeys((prev) => new Set(prev).add(editing.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '초안 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /** 발행된 글 — 지금 내용을 초안으로 저장한 뒤, 그 초안을 운영본에 반영한다 */
  const handlePublishGuideDraft = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await saveDraft('guide_articles', editing.id, buildGuideRow(editableGuidePatch(editing)));
      await publishDraft('guide_articles', editing.id);
      await loadList();
      await openEdit(editing.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardGuideDraft = async () => {
    if (!editing) return;
    if (!window.confirm('초안을 버리고 운영본으로 되돌릴까요?')) return;
    setSaving(true);
    setError(null);
    try {
      await discardContentDraft('guide_articles', editing.id);
      setDraftKeys((prev) => {
        const next = new Set(prev);
        next.delete(editing.id);
        return next;
      });
      await openEdit(editing.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '초안 버리기에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreGuideVersion = async (versionId: number) => {
    if (!editing) return;
    setRestoringVersionId(versionId);
    setError(null);
    try {
      await restoreVersion(versionId);
      await openEdit(editing.id);
      setDraftKeys((prev) => new Set(prev).add(editing.id));
      setShowVersions(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '버전 복원에 실패했습니다.');
    } finally {
      setRestoringVersionId(null);
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
                      {draftKeys.has(g.id) && <span className="admin-pill">수정 초안 있음</span>}
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
            {editing.status === 'published' && (
              <div className="admin-landing-actions">
                <span className={`admin-pill${hasDraft ? '' : ' ok'}`}>
                  {hasDraft ? '수정 초안 있음(운영본과 다름)' : '운영본과 동일'}
                </span>
                {versions.length > 0 && (
                  <button type="button" onClick={() => setShowVersions((v) => !v)}>
                    이전 버전 ({versions.length})
                  </button>
                )}
              </div>
            )}
            {showVersions && (
              <div className="admin-section admin-landing-versions">
                <h2>이전 버전</h2>
                <ul>
                  {versions.map((v) => (
                    <li key={v.id}>
                      <span>
                        v{v.version} · {new Date(v.publishedAt).toLocaleString('ko-KR', { hour12: false })}
                      </span>
                      <button
                        type="button"
                        disabled={restoringVersionId === v.id}
                        onClick={() => void handleRestoreGuideVersion(v.id)}
                      >
                        {restoringVersionId === v.id ? '불러오는 중…' : '초안으로 복원'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
              {editing.status === 'published' ? (
                <>
                  {hasDraft && (
                    <button type="button" disabled={saving} onClick={() => void handleDiscardGuideDraft()}>
                      초안 버리기
                    </button>
                  )}
                  <button type="button" disabled={saving} onClick={() => void handleSaveGuideDraft()}>
                    {saving ? '저장 중…' : '초안 저장'}
                  </button>
                  <button
                    type="button"
                    className="admin-create-btn"
                    disabled={saving}
                    onClick={() => void handlePublishGuideDraft()}
                  >
                    게시
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="admin-create-btn"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              )}
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
