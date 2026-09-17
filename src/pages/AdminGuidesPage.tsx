import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import { GUIDE_KIND_META, GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import {
  archiveGuide,
  buildGuideRow,
  createGuide,
  fetchCourseTextFromGptShare,
  getAdminGuide,
  listAdminGuides,
  publishGuide,
  slugifyGuideTitle,
  unpublishGuide,
  updateGuide,
} from '../lib/guides';
import { parseCourseGuideText, resolveCoursePins, type CourseGuideDraft } from '../lib/courseGuideMacro';
import { isChatGptShareUrl } from '../lib/chatgptShareParse';
import { loadKakaoSdk } from '../lib/kakao';
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
import type { GuideArticle, GuideCoursePin, GuideStatus } from '../types/guides';
import { GuideCourseMap } from '../components/GuideCourseMap';
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
    coursePins: Array.isArray(row.course_pins)
      ? (row.course_pins as GuideCoursePin[])
      : base.coursePins,
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

  /* 추천 여행코스 붙여넣기 매크로 */
  const [macroOpen, setMacroOpen] = useState(false);
  const [macroTab, setMacroTab] = useState<'paste' | 'link'>('paste');
  const [macroRaw, setMacroRaw] = useState('');
  const [macroTitle, setMacroTitle] = useState('');
  const [macroSourceUrl, setMacroSourceUrl] = useState('');
  const [macroPreview, setMacroPreview] = useState<CourseGuideDraft | null>(null);
  const [macroPins, setMacroPins] = useState<GuideCoursePin[]>([]);
  const [macroMissed, setMacroMissed] = useState<string[]>([]);
  const [macroBusy, setMacroBusy] = useState(false);

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
      coursePins: g.coursePins,
      slug: g.slug,
    };
  }

  async function ensureKakaoReady() {
    const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!key) throw new Error('VITE_KAKAO_JS_KEY가 없어 지도 핀을 만들 수 없습니다.');
    await loadKakaoSdk(key);
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

  const handleMacroPreview = async () => {
    setError(null);
    setMacroBusy(true);
    try {
      const draft = parseCourseGuideText(macroRaw, {
        title: macroTitle || undefined,
        sourceUrl: macroSourceUrl || undefined,
      });
      setMacroPreview(draft);
      await ensureKakaoReady();
      const { pins, missed } = await resolveCoursePins(draft.scheduleRows, {
        topicTags: draft.topicTags,
      });
      setMacroPins(pins);
      setMacroMissed(missed);
    } catch (e) {
      setMacroPreview(null);
      setMacroPins([]);
      setMacroMissed([]);
      setError(e instanceof Error ? e.message : '미리보기 변환 실패');
    } finally {
      setMacroBusy(false);
    }
  };

  /** 탭2: GPT 공유 링크만으로 본문 추출 → 미리보기·핀 */
  const handleMacroExtractFromLink = async () => {
    setError(null);
    setMacroBusy(true);
    try {
      const url = macroSourceUrl.trim();
      if (!isChatGptShareUrl(url)) {
        throw new Error('chatgpt.com/share/… 공개 공유 링크를 입력하세요.');
      }
      const { cleanedText, titleHint, sourceUrl } = await fetchCourseTextFromGptShare(url);
      setMacroRaw(cleanedText);
      setMacroSourceUrl(sourceUrl);
      if (!macroTitle.trim() && titleHint) setMacroTitle(titleHint);
      const draft = parseCourseGuideText(cleanedText, {
        title: macroTitle.trim() || titleHint || undefined,
        sourceUrl,
      });
      setMacroPreview(draft);
      await ensureKakaoReady();
      const { pins, missed } = await resolveCoursePins(draft.scheduleRows, {
        topicTags: draft.topicTags,
      });
      setMacroPins(pins);
      setMacroMissed(missed);
    } catch (e) {
      setMacroPreview(null);
      setMacroPins([]);
      setMacroMissed([]);
      setError(e instanceof Error ? e.message : '링크 추출 실패');
    } finally {
      setMacroBusy(false);
    }
  };

  const handleMacroCreate = async (publishNow: boolean) => {
    setMacroBusy(true);
    setError(null);
    try {
      const draft =
        macroPreview ??
        parseCourseGuideText(macroRaw, {
          title: macroTitle || undefined,
          sourceUrl: macroSourceUrl || undefined,
        });
      let pins = macroPins;
      if (!macroPreview || pins.length === 0) {
        await ensureKakaoReady();
        const resolved = await resolveCoursePins(draft.scheduleRows, {
          topicTags: draft.topicTags,
        });
        pins = resolved.pins;
        setMacroMissed(resolved.missed);
      }
      const created = await createGuide({
        title: draft.title,
        summary: draft.summary,
        bodyMd: draft.bodyMd,
        kind: 'course',
        topicTags: draft.topicTags,
        sourceUrls: macroSourceUrl.trim() ? [macroSourceUrl.trim()] : [],
        coursePins: pins,
        slug: slugifyGuideTitle(draft.title),
        status: publishNow ? 'published' : 'draft',
      });
      setMacroRaw('');
      setMacroTitle('');
      setMacroSourceUrl('');
      setMacroPreview(null);
      setMacroPins([]);
      setMacroMissed([]);
      setMacroOpen(false);
      await loadList();
      await openEdit(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '코스 생성 실패');
    } finally {
      setMacroBusy(false);
    }
  };

  const handleRefreshCoursePins = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const { extractScheduleRowsFromBody } = await import('../lib/courseGuideMacro');
      const rows = extractScheduleRowsFromBody(editing.bodyMd);
      if (rows.length < 1) throw new Error('본문에서 일정 장소를 찾지 못했습니다.');
      await ensureKakaoReady();
      const { pins, missed } = await resolveCoursePins(rows, { topicTags: editing.topicTags });
      setEditing({ ...editing, coursePins: pins });
      if (missed.length > 0) {
        setError(`일부 장소를 찾지 못했습니다: ${missed.join(', ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '핀 생성 실패');
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
            <>
              <button type="button" className="admin-create-btn" onClick={() => setMacroOpen((v) => !v)}>
                {macroOpen ? '코스 매크로 닫기' : '코스 붙여넣기 매크로'}
              </button>
              <Link to="/guides" className="admin-link-btn">
                공개 가이드 보기
              </Link>
            </>
          }
        />

        {error && <div className="admin-error">{error}</div>}

        {macroOpen && (
          <section className="admin-section admin-guide-editor">
            <h2>추천 여행코스 · 붙여넣기 매크로</h2>
            <div className="admin-tab-bar" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`admin-tab-btn${macroTab === 'paste' ? ' active' : ''}`}
                onClick={() => setMacroTab('paste')}
              >
                1. 본문 붙여넣기
              </button>
              <button
                type="button"
                className={`admin-tab-btn${macroTab === 'link' ? ' active' : ''}`}
                onClick={() => setMacroTab('link')}
              >
                2. GPT 링크로 추출
              </button>
            </div>

            {macroTab === 'paste' ? (
              <>
                <p className="admin-cell-sub" style={{ marginTop: 0 }}>
                  ChatGPT·메모에서 복사한 하루 일정을 붙여넣으면{' '}
                  <strong>시간 | 일정 | 포인트</strong> 표 형식의 추천 여행코스 초안을 만듭니다.
                </p>
                <label className="admin-guide-field">
                  제목 (비우면 자동)
                  <input
                    value={macroTitle}
                    onChange={(e) => setMacroTitle(e.currentTarget.value)}
                    placeholder="춘천 하루 여행 코스 추천"
                  />
                </label>
                <label className="admin-guide-field">
                  출처 URL (선택)
                  <input
                    value={macroSourceUrl}
                    onChange={(e) => setMacroSourceUrl(e.currentTarget.value)}
                    placeholder="https://…"
                  />
                </label>
                <label className="admin-guide-field">
                  일정 본문 붙여넣기
                  <textarea
                    rows={14}
                    value={macroRaw}
                    onChange={(e) => {
                      setMacroRaw(e.currentTarget.value);
                      setMacroPreview(null);
                      setMacroPins([]);
                      setMacroMissed([]);
                    }}
                    placeholder={`소양강스카이워크 → 닭갈비 → 호수케이블카 → 구봉산 순서로…

10:00–11:00	소양강스카이워크	유리 전망대에서 소양강 위를 걷기
11:20–12:40	춘천 명동 닭갈비골목	대표 먹거리 닭갈비 + 볶음밥
…`}
                  />
                </label>
                <div className="admin-landing-actions">
                  <button
                    type="button"
                    onClick={() => void handleMacroPreview()}
                    disabled={!macroRaw.trim() || macroBusy}
                  >
                    {macroBusy ? '변환·지도 검색 중…' : '미리보기·지도 핀'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMacroCreate(false)}
                    disabled={!macroRaw.trim() || macroBusy}
                  >
                    {macroBusy ? '처리 중…' : '초안으로 저장'}
                  </button>
                  <button
                    type="button"
                    className="admin-create-btn"
                    onClick={() => void handleMacroCreate(true)}
                    disabled={!macroRaw.trim() || macroBusy}
                  >
                    {macroBusy ? '처리 중…' : '바로 발행'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="admin-cell-sub" style={{ marginTop: 0 }}>
                  <code>chatgpt.com/share/…</code> 공개 공유 링크만 넣으면 일정 표를 추출하고 지도 핀까지
                  구성합니다. (AI 토큰 없음 · 브라우저에서 페이지 조회)
                </p>
                <label className="admin-guide-field">
                  제목 (비우면 공유 제목·본문에서 자동)
                  <input
                    value={macroTitle}
                    onChange={(e) => setMacroTitle(e.currentTarget.value)}
                    placeholder="충주 하루 여행 코스 추천"
                  />
                </label>
                <label className="admin-guide-field">
                  GPT 공유 링크
                  <input
                    value={macroSourceUrl}
                    onChange={(e) => {
                      setMacroSourceUrl(e.currentTarget.value);
                      setMacroPreview(null);
                      setMacroPins([]);
                      setMacroMissed([]);
                    }}
                    placeholder="https://chatgpt.com/share/…"
                  />
                </label>
                <div className="admin-landing-actions">
                  <button
                    type="button"
                    className="admin-create-btn"
                    onClick={() => void handleMacroExtractFromLink()}
                    disabled={!macroSourceUrl.trim() || macroBusy}
                  >
                    {macroBusy ? '링크 추출·지도 검색 중…' : '링크로 구성하기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMacroCreate(false)}
                    disabled={!macroPreview || macroBusy}
                  >
                    {macroBusy ? '처리 중…' : '초안으로 저장'}
                  </button>
                  <button
                    type="button"
                    className="admin-create-btn"
                    onClick={() => void handleMacroCreate(true)}
                    disabled={!macroPreview || macroBusy}
                  >
                    {macroBusy ? '처리 중…' : '바로 발행'}
                  </button>
                </div>
              </>
            )}

            {macroPreview && (
              <div className="admin-guide-field" style={{ marginTop: 16 }}>
                <strong>미리보기</strong>
                <p className="admin-cell-sub">
                  {macroPreview.title} · 태그: {macroPreview.topicTags.join(', ') || '(없음)'} · 핀{' '}
                  {macroPins.length}개
                </p>
                <p className="admin-cell-sub">{macroPreview.summary}</p>
                {macroMissed.length > 0 && (
                  <p className="admin-cell-sub" style={{ color: '#b45309' }}>
                    좌표 미매칭: {macroMissed.join(', ')}
                  </p>
                )}
                {macroPins.length > 0 && <GuideCourseMap pins={macroPins} />}
                <textarea rows={12} readOnly value={macroPreview.bodyMd} />
              </div>
            )}
          </section>
        )}

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
                      가이드가 없습니다. 「코스 붙여넣기 매크로」또는 인사이트에서 초안을 만드세요.
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
            {editing.kind === 'course' && (
              <div className="admin-guide-field">
                <div className="admin-landing-actions" style={{ marginBottom: 8 }}>
                  <strong>코스 지도 핀 ({editing.coursePins?.length ?? 0})</strong>
                  <button type="button" disabled={saving} onClick={() => void handleRefreshCoursePins()}>
                    {saving ? '검색 중…' : '본문에서 핀 다시 만들기'}
                  </button>
                </div>
                {(editing.coursePins?.length ?? 0) > 0 ? (
                  <GuideCourseMap pins={editing.coursePins} />
                ) : (
                  <p className="admin-cell-sub">저장된 핀이 없습니다. 위 버튼으로 카카오 검색 후 저장하세요.</p>
                )}
              </div>
            )}
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
