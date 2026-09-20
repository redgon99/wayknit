import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminShell } from '../components/AdminShell';
import { AdminPreviewModal } from '../components/AdminPreviewModal';
import { GUIDE_KIND_META, GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import {
  archiveGuide,
  buildGuideRow,
  createGuide,
  deleteGuide,
  fetchCourseTextFromGptShare,
  getAdminGuide,
  listAdminGuides,
  publishGuide,
  slugifyGuideTitle,
  unpublishGuide,
  updateGuide,
} from '../lib/guides';
import { parseCourseGuideText, resolveCoursePins, type CourseGuideDraft } from '../lib/courseGuideMacro';
import {
  deriveGuideSummary,
  parseMultiLangGuide,
  type MultiLangGuideSection,
} from '../lib/multiLangGuideMacro';
import {
  buildCourseFromSelection,
  parseCourseOptions,
  proposeCourseOptions,
  type CourseOption,
} from '../lib/aiCourseGuide';
import { isChatGptShareUrl } from '../lib/chatgptShareParse';
import { loadGoogleMapsSdk, getGoogleMapsApiKey } from '../lib/googleMaps';
import { renderGuideMarkdown } from '../lib/guideMarkdown';
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
import { CourseTaxonomyPicker } from '../components/CourseTaxonomyChips';
import { displayCourseTags } from '../lib/courseGuideTaxonomy';
import '../styles/app.css';

function formatUnknownError(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  if (typeof Event !== 'undefined' && e instanceof Event) {
    return `${fallback} (이벤트: ${e.type})`;
  }
  return fallback;
}

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

/** 압축 표 갱신 열 — "2026.09.20 08:29" 형태로 짧게 */
function formatCompactDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const GUIDES_PAGE_SIZE = 8;

export default function AdminGuidesPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [guides, setGuides] = useState<GuideArticle[]>([]);
  const [statusFilter, setStatusFilter] = useState<GuideStatus | ''>('');
  const [kindFilter, setKindFilter] = useState<GuideKind | ''>('');
  const [titleSearch, setTitleSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<GuideArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /* C4(관리자 검토 2026-09-16) — 발행된 글은 초안/버전 경로로, draft·archived는 기존 직접수정 그대로 */
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());
  const [hasDraft, setHasDraft] = useState(false);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewGuide, setPreviewGuide] = useState<GuideArticle | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  /* 추천 여행코스 붙여넣기 매크로 */
  const [macroOpen, setMacroOpen] = useState(false);
  const [macroRaw, setMacroRaw] = useState('');
  const [macroTitle, setMacroTitle] = useState('');
  const [macroSourceUrl, setMacroSourceUrl] = useState('');
  const [macroPreview, setMacroPreview] = useState<CourseGuideDraft | null>(null);
  const [macroPins, setMacroPins] = useState<GuideCoursePin[]>([]);
  const [macroMissed, setMacroMissed] = useState<string[]>([]);
  const [macroBusy, setMacroBusy] = useState(false);
  const macroCanRun = Boolean(macroSourceUrl.trim() || macroRaw.trim());

  /* AI 자동 생성 — 커스텀 GPT 프롬프트를 옮긴 course-guide-generate 함수 호출 (§34) */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRegion, setAiRegion] = useState('');
  const [aiExtra, setAiExtra] = useState('');
  const [aiOptionsText, setAiOptionsText] = useState('');
  const [aiOptions, setAiOptions] = useState<CourseOption[]>([]);
  const [aiSelection, setAiSelection] = useState('');
  const [aiProposing, setAiProposing] = useState(false);
  const [aiBuilding, setAiBuilding] = useState(false);

  /* 다국어 붙여넣기(2026-09-20) — 같은 내용을 여러 언어로 반복한 글을
     언어별 가이드 카드로 나눠 만든다. */
  const [mlOpen, setMlOpen] = useState(false);
  const [mlRaw, setMlRaw] = useState('');
  const [mlKind, setMlKind] = useState<GuideKind>('practical');
  const [mlSections, setMlSections] = useState<MultiLangGuideSection[]>([]);
  const [mlUsedAi, setMlUsedAi] = useState(false);
  const [mlBusy, setMlBusy] = useState(false);

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

  useEffect(() => {
    setPage(0);
  }, [statusFilter, kindFilter, titleSearch]);

  const filteredGuides = guides.filter((g) => {
    const term = titleSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      g.title.toLowerCase().includes(term) ||
      g.topicTags.some((tag) => tag.toLowerCase().includes(term))
    );
  });
  const guidesPageCount = Math.max(1, Math.ceil(filteredGuides.length / GUIDES_PAGE_SIZE));
  const guidesPage = Math.min(page, guidesPageCount - 1);
  const pagedGuides = filteredGuides.slice(
    guidesPage * GUIDES_PAGE_SIZE,
    guidesPage * GUIDES_PAGE_SIZE + GUIDES_PAGE_SIZE
  );

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

  /** 목록은 본문(body_md)을 안 받아오므로(S1) 미리보기를 열 때만 전체 행을 조회한다 */
  const openPreview = async (id: string) => {
    setPreviewLoadingId(id);
    try {
      const g = await getAdminGuide(id);
      if (!g) {
        setError('가이드를 찾을 수 없습니다.');
        return;
      }
      setPreviewGuide(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기를 불러오지 못했습니다.');
    } finally {
      setPreviewLoadingId(null);
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

  async function ensureMapsReady() {
    const key = getGoogleMapsApiKey();
    if (!key) throw new Error('VITE_GOOGLE_MAPS_API_KEY가 없어 지도 핀을 만들 수 없습니다.');
    await loadGoogleMapsSdk(key);
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

  async function applyMacroDraft(draft: CourseGuideDraft, doneLabel: string) {
    setMacroPreview(draft);
    try {
      await ensureMapsReady();
      const { pins, missed } = await resolveCoursePins(draft.scheduleRows, {
        topicTags: draft.topicTags,
      });
      setMacroPins(pins);
      setMacroMissed(missed);
      if (missed.length > 0) {
        setError(
          `${doneLabel} 일부 좌표 미매칭: ${missed.slice(0, 6).join(', ')}${missed.length > 6 ? '…' : ''}`
        );
      }
    } catch (pinErr) {
      setMacroPins([]);
      setMacroMissed(draft.scheduleRows.map((r) => r.place));
      setError(
        `일정 변환은 완료됐습니다. 지도 핀만 실패: ${formatUnknownError(pinErr, 'Google Maps SDK/검색 오류')}`
      );
    }
  }

  const handleMacroRun = async () => {
    setError(null);
    setMacroBusy(true);
    try {
      const fromUrl = macroSourceUrl.trim();
      const fromBody = macroRaw.trim();
      const shareUrl = isChatGptShareUrl(fromUrl)
        ? fromUrl
        : isChatGptShareUrl(fromBody)
          ? fromBody
          : '';
      if (shareUrl) {
        const { cleanedText, titleHint, sourceUrl } = await fetchCourseTextFromGptShare(shareUrl);
        setMacroRaw(cleanedText);
        setMacroSourceUrl(sourceUrl);
        const title = macroTitle.trim() || titleHint || undefined;
        if (!macroTitle.trim() && titleHint) setMacroTitle(titleHint);
        const draft = parseCourseGuideText(cleanedText, { title, sourceUrl });
        await applyMacroDraft(draft, '일정 추출 완료.');
        return;
      }
      if (!fromBody) {
        throw new Error('일정 본문을 붙여넣거나 ChatGPT 공유 링크를 입력하세요.');
      }
      const draft = parseCourseGuideText(fromBody, {
        title: macroTitle || undefined,
        sourceUrl: fromUrl || undefined,
      });
      await applyMacroDraft(draft, '일정 변환 완료.');
    } catch (e) {
      setMacroPreview(null);
      setMacroPins([]);
      setMacroMissed([]);
      setError(formatUnknownError(e, '실행 실패'));
    } finally {
      setMacroBusy(false);
    }
  };

  const handleAiPropose = async () => {
    if (!aiRegion.trim()) return;
    setAiProposing(true);
    setError(null);
    try {
      const text = await proposeCourseOptions(aiRegion, aiExtra || undefined);
      setAiOptionsText(text);
      setAiOptions(parseCourseOptions(text));
      setAiSelection('');
    } catch (e) {
      setAiOptionsText('');
      setAiOptions([]);
      setError(formatUnknownError(e, '여행안 생성 실패'));
    } finally {
      setAiProposing(false);
    }
  };

  const handleAiBuild = async () => {
    if (!aiOptionsText.trim() || !aiSelection.trim()) return;
    setAiBuilding(true);
    setError(null);
    try {
      const text = await buildCourseFromSelection(aiRegion, aiOptionsText, aiSelection, aiExtra || undefined);
      setMacroRaw(text);
      setMacroTitle('');
      setMacroSourceUrl('');
      const draft = parseCourseGuideText(text, {});
      await applyMacroDraft(draft, 'AI 일정 생성 완료.');
    } catch (e) {
      setMacroPreview(null);
      setMacroPins([]);
      setMacroMissed([]);
      const hint = aiOptionsText
        ? ' (AI가 만든 원문은 「코스 붙여넣기 매크로」 패널의 「일정 본문」 칸에 남아 있습니다 — 확인 후 수동으로 다시 실행해볼 수 있습니다.)'
        : '';
      setError(formatUnknownError(e, 'AI 일정 생성 실패') + hint);
    } finally {
      setAiBuilding(false);
    }
  };

  const handleMlParse = async () => {
    if (!mlRaw.trim()) return;
    setMlBusy(true);
    setError(null);
    try {
      const { sections, usedAi } = await parseMultiLangGuide(mlRaw);
      setMlSections(sections);
      setMlUsedAi(usedAi);
    } catch (e) {
      setMlSections([]);
      setError(formatUnknownError(e, '다국어 분리 실패'));
    } finally {
      setMlBusy(false);
    }
  };

  const updateMlSection = (index: number, patch: Partial<MultiLangGuideSection>) => {
    setMlSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeMlSection = (index: number) => {
    setMlSections((prev) => prev.filter((_, i) => i !== index));
  };

  /** 언어 수만큼 createGuide를 반복 호출 — 하나가 실패해도 나머지는 만들어진
   * 상태로 남는다(부분 실패 시 사용자가 뭐가 됐는지 알아야 하므로 굳이
   * 트랜잭션처럼 전부 되돌리지 않음, 실패한 언어만 다시 시도하면 됨). */
  const handleMlPublish = async () => {
    if (mlSections.length === 0) return;
    setMlBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const section of mlSections) {
      try {
        await createGuide({
          title: section.title,
          summary: deriveGuideSummary(section.bodyMd),
          bodyMd: section.bodyMd,
          kind: mlKind,
          locale: section.locale,
          status: 'published',
        });
      } catch (e) {
        failed.push(`${section.locale}(${formatUnknownError(e, '실패')})`);
      }
    }
    setMlBusy(false);
    if (failed.length > 0) {
      setError(`일부 언어 생성 실패: ${failed.join(', ')} — 나머지는 만들어졌습니다.`);
      setMlSections((prev) => prev.filter((s) => failed.some((f) => f.startsWith(s.locale))));
    } else {
      setMlOpen(false);
      setMlRaw('');
      setMlSections([]);
    }
    await loadList();
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
        await ensureMapsReady();
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

  const handleDeleteGuide = async (g: GuideArticle) => {
    const publishedNote = g.status === 'published' ? ' 공개 목록에서도 바로 사라집니다.' : '';
    if (!window.confirm(`「${g.title}」을(를) 삭제할까요?${publishedNote} 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    setDeletingId(g.id);
    setError(null);
    try {
      await deleteGuide(g.id);
      if (editing?.id === g.id) {
        setEditing(null);
        setHasDraft(false);
        setVersions([]);
      }
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setDeletingId(null);
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
      await ensureMapsReady();
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
    <AdminShell
      subtitle="종류별 초안을 검수·발행합니다. 추천 여행코스는 플래너 자동 동선과 연동됩니다."
      current="guides"
      refreshing={refreshing}
      onRefresh={() => void loadList()}
      extraActions={
        <>
          <button type="button" className="admin-create-btn" onClick={() => setAiOpen((v) => !v)}>
            {aiOpen ? 'AI 자동 생성 닫기' : 'AI 자동 생성'}
          </button>
          <button type="button" className="admin-create-btn" onClick={() => setMacroOpen((v) => !v)}>
            {macroOpen ? '코스 매크로 닫기' : '코스 붙여넣기 매크로'}
          </button>
          <button type="button" className="admin-create-btn" onClick={() => setMlOpen((v) => !v)}>
            {mlOpen ? '다국어 붙여넣기 닫기' : '다국어 붙여넣기'}
          </button>
          <Link to="/guides" className="admin-link-btn">
            공개 가이드 보기
          </Link>
        </>
      }
      wide
    >
      {error && <div className="admin-error">{error}</div>}

        {macroOpen && (
          <section className="admin-section admin-guide-editor">
            <h2>추천 여행코스 · 붙여넣기 매크로</h2>
            <p className="admin-cell-sub" style={{ marginTop: 0 }}>
              ChatGPT 공유 링크(<code>chatgpt.com/share/…</code>)나 일정 본문을 넣으면{' '}
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
              출처 URL
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
            <label className="admin-guide-field">
              일정 본문
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
                className="admin-create-btn"
                onClick={() => void handleMacroRun()}
                disabled={!macroCanRun || macroBusy}
              >
                {macroBusy ? '실행 중…' : '실행'}
              </button>
            </div>
          </section>
        )}

        {aiOpen && (
          <section className="admin-section admin-guide-editor">
            <h2>AI 자동 생성</h2>
            <p className="admin-cell-sub" style={{ marginTop: 0 }}>
              지역만 넣으면 조건이 다른 여행안 5개를 먼저 제안하고, 그중 하나를 고르면(또는 조건을 바꿔
              고르면) 상세 일정을 만듭니다. 관리자 커스텀 GPT에 넣어 쓰던 지시문을 그대로 옮겼습니다.
            </p>
            <label className="admin-guide-field">
              지역
              <input
                value={aiRegion}
                onChange={(e) => setAiRegion(e.currentTarget.value)}
                placeholder="춘천"
              />
            </label>
            <label className="admin-guide-field">
              추가 조건 (선택)
              <input
                value={aiExtra}
                onChange={(e) => setAiExtra(e.currentTarget.value)}
                placeholder="예: 반려견 동반 가능한 곳 위주로"
              />
            </label>
            <div className="admin-landing-actions">
              <button
                type="button"
                className="admin-create-btn"
                disabled={!aiRegion.trim() || aiProposing}
                onClick={() => void handleAiPropose()}
              >
                {aiProposing ? '여행안 만드는 중…' : aiOptionsText ? '여행안 5개 다시 만들기' : '여행안 5개 만들기'}
              </button>
            </div>

            {aiOptionsText && (
              <div style={{ marginTop: 16 }}>
                <strong>여행안 중 하나를 고르거나, 조건을 바꿔 적어주세요</strong>
                {aiOptions.length > 0 ? (
                  <div className="admin-ai-option-list" role="group" aria-label="여행안 선택" style={{ marginTop: 8 }}>
                    {aiOptions.map((opt) => (
                      <button
                        key={opt.index}
                        type="button"
                        className={`admin-ai-option-btn ${aiSelection === `${opt.index}번` ? 'selected' : ''}`}
                        onClick={() => setAiSelection(`${opt.index}번`)}
                      >
                        <span className="admin-ai-option-title">
                          {opt.index}. {opt.title}
                        </span>
                        <span className="admin-cell-sub">{opt.conditions}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <pre className="admin-cell-sub" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                    {aiOptionsText}
                  </pre>
                )}
                <label className="admin-guide-field" style={{ marginTop: 10 }}>
                  선택 / 수정 (예: "2번", "2번, 자가용으로", "알아서 바로 짜줘")
                  <input
                    value={aiSelection}
                    onChange={(e) => setAiSelection(e.currentTarget.value)}
                    placeholder="2번, 자가용으로"
                  />
                </label>
                <div className="admin-landing-actions">
                  <button
                    type="button"
                    className="admin-create-btn"
                    disabled={!aiSelection.trim() || aiBuilding}
                    onClick={() => void handleAiBuild()}
                  >
                    {aiBuilding ? '일정 만드는 중…' : '이 조건으로 일정 만들기'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {macroPreview && (
          <section className="admin-section admin-guide-editor">
            <div className="admin-landing-actions">
              <button
                type="button"
                onClick={() => void handleMacroCreate(false)}
                disabled={macroBusy}
              >
                {macroBusy ? '처리 중…' : '초안으로 저장'}
              </button>
              <button
                type="button"
                className="admin-create-btn"
                onClick={() => void handleMacroCreate(true)}
                disabled={macroBusy}
              >
                {macroBusy ? '처리 중…' : '바로 발행'}
              </button>
            </div>

            <div className="admin-guide-macro-preview" style={{ marginTop: 16 }}>
              <strong>미리보기</strong>
              <p className="admin-cell-sub">
                핀 {macroPins.length}개
                {macroMissed.length > 0 ? ` · 미매칭 ${macroMissed.length}곳` : ''}
              </p>
              <div className="admin-guide-macro-split">
                <div className="admin-guide-macro-pane">
                  <div className="admin-guide-macro-pane-label">좌측 · 편집본</div>
                  <label className="admin-guide-field">
                    제목
                    <input
                      value={macroPreview.title}
                      onChange={(e) =>
                        setMacroPreview({ ...macroPreview, title: e.currentTarget.value })
                      }
                    />
                  </label>
                  <label className="admin-guide-field">
                    요약
                    <textarea
                      rows={3}
                      value={macroPreview.summary}
                      onChange={(e) =>
                        setMacroPreview({ ...macroPreview, summary: e.currentTarget.value })
                      }
                    />
                  </label>
                  <label className="admin-guide-field">
                    본문 (Markdown)
                    <textarea
                      rows={18}
                      value={macroPreview.bodyMd}
                      onChange={(e) =>
                        setMacroPreview({ ...macroPreview, bodyMd: e.currentTarget.value })
                      }
                    />
                  </label>
                  <div className="admin-guide-field">
                    추천코스 태그
                    <CourseTaxonomyPicker
                      tags={macroPreview.topicTags}
                      onChange={(topicTags) => setMacroPreview({ ...macroPreview, topicTags })}
                    />
                  </div>
                </div>
                <div className="admin-guide-macro-pane admin-guide-macro-live">
                  <div className="admin-guide-macro-pane-label">우측 · 실행본 (공개 가이드와 동일)</div>
                  <article className="guides-detail admin-guide-macro-live-inner">
                    <div className="guides-card-tags">
                      <span className="guides-tag guides-tag-kind">추천 여행코스</span>
                      {displayCourseTags(macroPreview.topicTags, 'ko', 8).map((tag) => (
                        <span key={tag} className="guides-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h1>{macroPreview.title}</h1>
                    {macroPreview.summary && (
                      <p className="guides-detail-summary">{macroPreview.summary}</p>
                    )}
                    {macroPins.length > 0 ? (
                      <GuideCourseMap pins={macroPins} />
                    ) : (
                      <p className="guides-muted">
                        지도 핀이 없습니다. Google Maps API 키를 확인한 뒤 다시 구성하세요.
                      </p>
                    )}
                    <div className="guides-body">{renderGuideMarkdown(macroPreview.bodyMd)}</div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        )}

        {mlOpen && (
          <section className="admin-section admin-guide-editor">
            <h2>다국어 가이드 붙여넣기</h2>
            <p className="admin-cell-sub" style={{ marginTop: 0 }}>
              "🇰🇷 한국어 / 🇺🇸 English / 🇨🇳 简体中文 / 🇯🇵 日本語…"처럼 같은 내용을
              여러 언어로 반복해 적은 글을 붙여넣으면, 언어마다 가이드 카드를
              따로 만듭니다. 형식이 규칙적이면 바로 나누고(무료), 못 나누면
              AI가 한 번 더 시도합니다.
            </p>
            <label className="admin-guide-field">
              종류 (모든 언어에 동일 적용)
              <select value={mlKind} onChange={(e) => setMlKind(e.currentTarget.value as GuideKind)}>
                {GUIDE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {GUIDE_KIND_META[k].labelKo}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-guide-field">
              원문
              <textarea
                rows={14}
                value={mlRaw}
                onChange={(e) => {
                  setMlRaw(e.currentTarget.value);
                  setMlSections([]);
                }}
                placeholder={`🇰🇷 한국어

외국인이 알아두면 좋은 한국 여행 팁 10가지

입국 조건은 출발 전에 확인하세요…

🇺🇸 English

10 Essential Korea Travel Tips…`}
              />
            </label>
            <div className="admin-landing-actions">
              <button
                type="button"
                className="admin-create-btn"
                disabled={!mlRaw.trim() || mlBusy}
                onClick={() => void handleMlParse()}
              >
                {mlBusy ? '나누는 중…' : '언어별로 나누기'}
              </button>
            </div>

            {mlSections.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="admin-cell-sub">
                  {mlSections.length}개 언어로 나뉨
                  {mlUsedAi ? ' · AI 보조 사용됨(비용 발생) — 아래서 꼭 확인 후 발행하세요' : ' · 규칙 기반(무료)'}
                </p>
                {mlSections.map((section, i) => (
                  <div key={`${section.locale}-${i}`} className="admin-ml-section" style={{ marginTop: 12 }}>
                    <div className="admin-ml-section-head">
                      <span className="admin-pill">{section.locale}</span>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removeMlSection(i)}
                        title="이 언어는 만들지 않음"
                      >
                        빼기
                      </button>
                    </div>
                    <label className="admin-guide-field">
                      제목
                      <input
                        value={section.title}
                        onChange={(e) => updateMlSection(i, { title: e.currentTarget.value })}
                      />
                    </label>
                    <label className="admin-guide-field">
                      본문
                      <textarea
                        rows={8}
                        value={section.bodyMd}
                        onChange={(e) => updateMlSection(i, { bodyMd: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                ))}
                <div className="admin-landing-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin-create-btn"
                    disabled={mlBusy || mlSections.length === 0}
                    onClick={() => void handleMlPublish()}
                  >
                    {mlBusy ? '발행 중…' : `${mlSections.length}개 언어로 발행`}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="admin-section">
          <div className="admin-filter-row">
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
            <input
              type="search"
              className="admin-search-input"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.currentTarget.value)}
              placeholder="제목·태그 검색"
              aria-label="가이드 카드 검색"
            />
            <span className="admin-cell-sub" style={{ marginLeft: 'auto' }}>
              전체 {filteredGuides.length}건 ·{' '}
              {filteredGuides.length === 0
                ? '0건 표시'
                : `${guidesPage * GUIDES_PAGE_SIZE + 1}–${Math.min(
                    guidesPage * GUIDES_PAGE_SIZE + GUIDES_PAGE_SIZE,
                    filteredGuides.length
                  )}건 표시`}
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>종류·상태</th>
                  <th>태그</th>
                  <th>갱신</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {pagedGuides.map((g) => (
                  <tr key={g.id}>
                    <td>{g.title}</td>
                    <td>
                      <span className="admin-pill">{GUIDE_KIND_META[g.kind].labelKo}</span>
                      <span className={`admin-pill ${g.status === 'published' ? 'ok' : ''}`}>
                        {STATUS_LABEL[g.status]}
                      </span>
                      {draftKeys.has(g.id) && <span className="admin-pill">수정 초안</span>}
                    </td>
                    <td>{displayCourseTags(g.topicTags, 'ko', 3).join(', ') || '-'}</td>
                    <td className="mono">{formatCompactDateTime(g.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          type="button"
                          disabled={previewLoadingId === g.id}
                          onClick={() => void openPreview(g.id)}
                        >
                          {previewLoadingId === g.id ? '불러오는 중…' : '미리보기'}
                        </button>
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
                        <button
                          type="button"
                          className="danger"
                          disabled={deletingId === g.id}
                          onClick={() => void handleDeleteGuide(g)}
                        >
                          {deletingId === g.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredGuides.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-cell-sub">
                      {guides.length === 0
                        ? '가이드가 없습니다. 「코스 붙여넣기 매크로」또는 인사이트에서 초안을 만드세요.'
                        : '검색·필터 조건에 맞는 가이드가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredGuides.length > GUIDES_PAGE_SIZE && (
            <div className="admin-pager">
              <button
                type="button"
                className="admin-link-btn"
                disabled={guidesPage <= 0}
                onClick={() => setPage(guidesPage - 1)}
              >
                이전
              </button>
              <span className="admin-cell-sub">
                {guidesPage + 1} / {guidesPageCount} 페이지
              </span>
              <button
                type="button"
                className="admin-link-btn"
                disabled={guidesPage >= guidesPageCount - 1}
                onClick={() => setPage(guidesPage + 1)}
              >
                다음
              </button>
            </div>
          )}
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
                  <p className="admin-cell-sub">저장된 핀이 없습니다. 위 버튼으로 Google 검색 후 저장하세요.</p>
                )}
              </div>
            )}
            {editing.kind === 'course' ? (
              <div className="admin-guide-field">
                추천코스 태그
                <CourseTaxonomyPicker
                  tags={editing.topicTags}
                  onChange={(topicTags) => setEditing({ ...editing, topicTags })}
                />
              </div>
            ) : (
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
            )}
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
              <button
                type="button"
                className="danger"
                disabled={saving || deletingId === editing.id}
                onClick={() => void handleDeleteGuide(editing)}
              >
                {deletingId === editing.id ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </section>
        )}

        <AdminPreviewModal
          open={Boolean(previewGuide)}
          onClose={() => setPreviewGuide(null)}
          title={previewGuide?.title ?? ''}
          subtitle={previewGuide?.summary}
          headerExtra={
            previewGuide && (
              <div style={{ marginTop: 8 }}>
                <span className="admin-pill">{GUIDE_KIND_META[previewGuide.kind].labelKo}</span>
                <span className={`admin-pill ${previewGuide.status === 'published' ? 'ok' : ''}`}>
                  {STATUS_LABEL[previewGuide.status]}
                </span>
                {displayCourseTags(previewGuide.topicTags, 'ko', 8).map((tag) => (
                  <span key={tag} className="admin-pill">
                    {tag}
                  </span>
                ))}
              </div>
            )
          }
        >
          {previewGuide?.kind === 'course' && (previewGuide.coursePins?.length ?? 0) > 0 && (
            <GuideCourseMap pins={previewGuide.coursePins} />
          )}
          {previewGuide && <div className="guides-body">{renderGuideMarkdown(previewGuide.bodyMd)}</div>}
        </AdminPreviewModal>
    </AdminShell>
  );
}
