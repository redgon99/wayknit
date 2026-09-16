import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import {
  addDistributionAccount,
  approveDistributionPost,
  deleteDistributionAccount,
  deleteDistributionPost,
  hasPostedDuplicate,
  listActiveCombos,
  listDistributionAccounts,
  listDistributionPosts,
  scheduleDistributionPost,
  setDistributionAccountActive,
  triggerDistributionDraft,
  triggerDistributionPublish,
  unscheduleDistributionPost,
  updateDistributionPost,
} from '../lib/distribution';
import { listPublishedGuides } from '../lib/guides';
import type {
  DistributionAccount,
  DistributionPlatform,
  DistributionPost,
  DistributionPostStatus,
} from '../types/distribution';
import type { GuideArticle } from '../types/guides';
import '../styles/app.css';

const PLATFORMS: DistributionPlatform[] = ['x', 'reddit', 'youtube', 'tiktok', 'weibo', 'xiaohongshu'];

const PLATFORM_LABEL: Record<DistributionPlatform, string> = {
  x: 'X (Twitter)',
  reddit: 'Reddit',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  weibo: '웨이보',
  xiaohongshu: '샤오홍슈',
};

const IMPLEMENTED_PLATFORMS: DistributionPlatform[] = ['x'];

/** D2 — 플랫폼별 글자수 한도. 없는 플랫폼은 표시만 하고 막지는 않는다. */
const CHAR_LIMIT: Partial<Record<DistributionPlatform, number>> = {
  x: 280,
  tiktok: 150,
  weibo: 150,
};

/**
 * D1(관리자 검토 2026-09-16) — 게시 버튼이 미구현 플랫폼·계정 미지정에서도
 * 늘 활성화돼 있어서, 클릭한 뒤에야 에러 문구로 이유를 알 수 있었다.
 * handlePublish의 사전 검사와 같은 조건을 버튼에도 미리 반영한다.
 *
 * D2 — "게시" 버튼은 이제 approved(또는 재시도용 failed) 상태에서만 뜬다.
 * draft는 먼저 "승인"을 거쳐야 한다(승인·게시를 같은 클릭에서 분리).
 */
function publishBlockReason(post: DistributionPost): string | null {
  if (!IMPLEMENTED_PLATFORMS.includes(post.platform)) return '자동 게시 미지원';
  if (!post.accountId) return '계정 미연결';
  if (post.status === 'draft') return '승인 필요';
  return null;
}

const STATUS_LABEL: Record<DistributionPostStatus, string> = {
  draft: '초안',
  approved: '승인됨',
  scheduled: '예약됨',
  posted: '게시됨',
  failed: '실패',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function AdminDistributionPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'accounts'>('queue');

  const [accounts, setAccounts] = useState<DistributionAccount[]>([]);
  const [posts, setPosts] = useState<DistributionPost[]>([]);

  const [platformFilter, setPlatformFilter] = useState<DistributionPlatform | ''>('');
  const [statusFilter, setStatusFilter] = useState<DistributionPostStatus | ''>('');

  const [guides, setGuides] = useState<GuideArticle[]>([]);
  const [selectedGuideIds, setSelectedGuideIds] = useState<Set<string>>(new Set());
  const [draftPlatforms, setDraftPlatforms] = useState<Set<DistributionPlatform>>(new Set(['x']));
  const [draftCountries, setDraftCountries] = useState('US, GB, JP');
  const [drafting, setDrafting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<DistributionPost | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [schedulingAt, setSchedulingAt] = useState('');

  /* A4·D3와 이어지는 사용성 — 감사 로그의 대상 링크(?account=/?post=)가
   * 지금까지는 이 페이지로만 오고 아무것도 열지 않았다. 탭 전환 + 해당
   * 행으로 스크롤 + (게시물이면) 편집창까지 자동으로 연다. */
  const focusAccountId = searchParams.get('account');
  const focusPostId = searchParams.get('post');

  const [newPlatform, setNewPlatform] = useState<DistributionPlatform>('x');
  const [newCountry, setNewCountry] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newAccessToken, setNewAccessToken] = useState('');
  const [newAccessTokenSecret, setNewAccessTokenSecret] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const rows = await listDistributionAccounts();
      setAccounts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '계정 목록을 불러오지 못했습니다.');
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const rows = await listDistributionPosts({
        platform: platformFilter || undefined,
        status: statusFilter || undefined,
      });
      setPosts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 목록을 불러오지 못했습니다.');
    }
  }, [platformFilter, statusFilter]);

  /* D2 — "발행된 가이드 중 최근 5개를 알아서" 대신 관리자가 소스를 직접 고른다 */
  const loadGuides = useCallback(async () => {
    try {
      const rows = await listPublishedGuides(50);
      setGuides(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가이드 목록을 불러오지 못했습니다.');
    }
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadPosts(), loadGuides()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAccounts, loadPosts, loadGuides]);

  useEffect(() => {
    if (access !== 'ok') return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, loadAll]);

  useEffect(() => {
    if (access === 'ok') void loadPosts();
  }, [access, loadPosts]);

  const [highlightAccountId, setHighlightAccountId] = useState<string | null>(null);

  /* 감사 로그 대상 링크(?account=/?post=)로 들어왔을 때 탭 전환 + 자동 오픈.
   * 한 번 처리하면 URL에서 지운다 — 새로고침해도 계속 같은 행이 열리면
   * 다른 행을 보기 불편하다. */
  useEffect(() => {
    if (access !== 'ok') return;
    if (focusAccountId) {
      setActiveTab('accounts');
      setHighlightAccountId(focusAccountId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('account');
          return next;
        },
        { replace: true }
      );
    } else if (focusPostId && posts.length > 0) {
      const target = posts.find((p) => p.id === focusPostId);
      if (target) {
        setActiveTab('queue');
        setEditingPost(target);
        setSchedulingAt(target.scheduledAt ? target.scheduledAt.slice(0, 16) : '');
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('post');
          return next;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, focusAccountId, focusPostId, posts]);

  const accountsByPlatform = useMemo(() => {
    const map = new Map<DistributionPlatform, DistributionAccount[]>();
    for (const acc of accounts) {
      const list = map.get(acc.platform) ?? [];
      list.push(acc);
      map.set(acc.platform, list);
    }
    return map;
  }, [accounts]);

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>배포관리</h1>
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
          <h1>배포관리</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>배포관리</h1>
          <p>접근 권한이 없습니다.</p>
        </div>
      </main>
    );
  }

  const toggleDraftPlatform = (platform: DistributionPlatform) => {
    setDraftPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const toggleGuideSelection = (id: string) => {
    setSelectedGuideIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerateDrafts = async () => {
    const platforms = [...draftPlatforms];
    const countries = draftCountries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const guideIds = [...selectedGuideIds];
    if (platforms.length === 0 || countries.length === 0) {
      setError('플랫폼과 국가를 1개 이상 선택/입력하세요.');
      return;
    }
    if (guideIds.length === 0) {
      setError('소스로 쓸 가이드를 1개 이상 선택하세요.');
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      /* D2 — 중복 게시 방지(생성 전). 이 가이드로 이 조합이 이미 진행
       * 중/게시됐으면 조용히 또 만들지 않고 먼저 확인받는다. */
      const existing = await listActiveCombos(guideIds, platforms, countries);
      if (existing.size > 0) {
        const ok = window.confirm(
          `선택한 가이드 중 ${existing.size}건은 이미 같은 플랫폼·국가 조합으로 초안/게시가 있습니다.\n` +
            `그래도 새 초안을 추가로 만들까요? (기존 항목은 그대로 남습니다)`
        );
        if (!ok) {
          setDrafting(false);
          return;
        }
      }
      const result = await triggerDistributionDraft({ guideIds, platforms, countries });
      if (result.created === 0) {
        setError('초안을 생성하지 못했습니다. 선택한 가이드로 만들 수 있는 조합이 있는지 확인해 주세요.');
      }
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '초안 생성 실패');
    } finally {
      setDrafting(false);
    }
  };

  /** D2 — "게시" 한 번이 승인+게시를 같이 하던 것의 첫 단계. 검토 없이 바로
   * 나가는 걸 막는 게 목적이라 확인창은 안 띄운다(다음 단계인 게시에서 띄움). */
  const handleApprove = async (post: DistributionPost) => {
    setApprovingId(post.id);
    setError(null);
    try {
      await approveDistributionPost(post.id);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 실패');
    } finally {
      setApprovingId(null);
    }
  };

  const handlePublish = async (post: DistributionPost) => {
    if (!IMPLEMENTED_PLATFORMS.includes(post.platform)) {
      setError(`${PLATFORM_LABEL[post.platform]} 게시 커넥터는 아직 구현되지 않았습니다.`);
      return;
    }
    if (!post.accountId) {
      setError('게시할 계정을 먼저 지정하세요 (편집에서 계정 선택).');
      return;
    }
    if (post.status === 'draft') {
      setError('먼저 승인이 필요합니다.');
      return;
    }
    setPublishingId(post.id);
    setError(null);
    try {
      /* D2 — 중복 게시 방지(직전 최종 확인). 승인 이후 시간이 지나는 동안
       * 같은 가이드×플랫폼×국가로 다른 초안이 먼저 게시됐을 수 있다. */
      if (await hasPostedDuplicate(post)) {
        setError('같은 가이드·플랫폼·국가 조합이 이미 게시된 다른 항목이 있습니다. 중복 게시를 막기 위해 중단했습니다.');
        setPublishingId(null);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '중복 확인 실패 — 게시를 중단했습니다.');
      setPublishingId(null);
      return;
    }
    const verb = post.status === 'failed' ? '재시도' : '게시';
    const ok = window.confirm(
      `${PLATFORM_LABEL[post.platform]} 계정으로 실제 ${verb}됩니다. 계속할까요?\n\n${post.body.slice(0, 120)}`
    );
    if (!ok) {
      setPublishingId(null);
      return;
    }
    try {
      await triggerDistributionPublish(post.id);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 실패');
      await loadPosts();
    } finally {
      setPublishingId(null);
    }
  };

  const handleSchedule = async () => {
    if (!editingPost) return;
    if (!schedulingAt) {
      setError('예약 시각을 먼저 선택하세요.');
      return;
    }
    setSavingPost(true);
    setError(null);
    try {
      await scheduleDistributionPost(editingPost.id, new Date(schedulingAt).toISOString());
      await loadPosts();
      setEditingPost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '예약 저장 실패');
    } finally {
      setSavingPost(false);
    }
  };

  const handleUnschedule = async () => {
    if (!editingPost) return;
    setSavingPost(true);
    setError(null);
    try {
      await unscheduleDistributionPost(editingPost.id);
      setSchedulingAt('');
      await loadPosts();
      setEditingPost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '예약 취소 실패');
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeletePost = async (post: DistributionPost) => {
    const msg =
      post.status === 'posted'
        ? '이미 게시된 항목입니다. 우리 기록만 지워지고 실제 SNS의 게시물은 그대로 남습니다. 삭제할까요?'
        : '이 초안을 삭제할까요?';
    const ok = window.confirm(msg);
    if (!ok) return;
    try {
      await deleteDistributionPost(post.id);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setSavingPost(true);
    setError(null);
    try {
      await updateDistributionPost(editingPost.id, {
        title: editingPost.title,
        body: editingPost.body,
        accountId: editingPost.accountId,
      });
      await loadPosts();
      setEditingPost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSavingPost(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newLabel.trim() || !newCountry.trim()) {
      setError('국가와 계정 이름을 입력해 주세요.');
      return;
    }
    try {
      const credentials: Record<string, string> = {};
      if (newPlatform === 'x') {
        if (newAccessToken.trim()) credentials.accessToken = newAccessToken.trim();
        if (newAccessTokenSecret.trim()) credentials.accessTokenSecret = newAccessTokenSecret.trim();
      }
      await addDistributionAccount({
        platform: newPlatform,
        country: newCountry,
        label: newLabel,
        handle: newHandle,
        credentials,
      });
      setNewCountry('');
      setNewLabel('');
      setNewHandle('');
      setNewAccessToken('');
      setNewAccessTokenSecret('');
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '계정 추가 실패');
    }
  };

  const handleToggleAccount = async (acc: DistributionAccount) => {
    try {
      await setDistributionAccountActive(acc.id, !acc.isActive);
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경 실패');
    }
  };

  const handleDeleteAccount = async (acc: DistributionAccount) => {
    const ok = window.confirm(`계정 "${acc.label}"을(를) 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteDistributionAccount(acc.id);
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '계정 삭제 실패');
    }
  };

  const editorAccountOptions = editingPost
    ? (accountsByPlatform.get(editingPost.platform) ?? [])
    : [];

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          title="배포관리"
          subtitle="가이드 콘텐츠를 국가·SNS별로 재작성해 검토 후 게시합니다 (관리자 전용)"
          current="distribution"
          refreshing={refreshing}
          onRefresh={() => void loadAll()}
        />

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-tab-bar" role="tablist" aria-label="배포관리 영역">
          {(
            [
              { id: 'queue' as const, label: '검토 큐' },
              { id: 'accounts' as const, label: '계정 관리' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'queue' && (
          <section className="admin-section">
            <h2>AI 초안 생성</h2>
            <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
              고른 가이드를 소스로, 선택한 플랫폼×국가 조합마다 게시글 초안을 만듭니다.
              {' '}X 외 플랫폼은 초안까지만 생성되고 실제 게시는 커넥터 구현 후 지원됩니다.
            </p>

            {/* D2 — "발행된 가이드 중 최근 5개를 알아서" 대신 관리자가 소스를 직접 고른다 */}
            <label className="admin-cell-sub" style={{ display: 'block', marginBottom: 4 }}>
              소스 가이드 ({selectedGuideIds.size}개 선택)
            </label>
            <div
              className="admin-table-wrap"
              style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 10, border: '1px solid var(--color-border)' }}
            >
              {guides.length === 0 && (
                <p className="admin-cell-sub" style={{ padding: 8 }}>발행된 가이드가 없습니다.</p>
              )}
              {guides.map((g) => (
                <label
                  key={g.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedGuideIds.has(g.id)}
                    onChange={() => toggleGuideSelection(g.id)}
                  />
                  <span style={{ fontSize: 13 }}>{g.title}</span>
                </label>
              ))}
            </div>

            <div className="admin-insight-cat-list" role="group" aria-label="플랫폼 선택" style={{ marginBottom: 10 }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`admin-insight-cat-btn ${draftPlatforms.has(p) ? 'selected' : ''}`}
                  onClick={() => toggleDraftPlatform(p)}
                >
                  <span className="admin-insight-cat-label">
                    {PLATFORM_LABEL[p]}
                    {!IMPLEMENTED_PLATFORMS.includes(p) ? ' (게시 미구현)' : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
              <input
                style={{ flex: 1 }}
                value={draftCountries}
                onChange={(e) => setDraftCountries(e.currentTarget.value)}
                placeholder="국가 코드, 쉼표 구분 (예: US, GB, JP, CN)"
              />
              <button
                type="button"
                className="admin-create-btn"
                disabled={drafting}
                onClick={() => void handleGenerateDrafts()}
              >
                {drafting ? '생성 중…' : 'AI 초안 생성'}
              </button>
            </div>

            <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.currentTarget.value as DistributionPlatform | '')}
              >
                <option value="">전체 플랫폼</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.currentTarget.value as DistributionPostStatus | '')}
              >
                <option value="">전체 상태</option>
                {(Object.keys(STATUS_LABEL) as DistributionPostStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>플랫폼</th>
                    <th>국가</th>
                    <th>내용</th>
                    <th>계정</th>
                    <th>상태</th>
                    <th>수정</th>
                    <th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => {
                    const account = accounts.find((a) => a.id === post.accountId);
                    return (
                      <tr key={post.id}>
                        <td>
                          <span className="admin-pill">{PLATFORM_LABEL[post.platform]}</span>
                        </td>
                        <td>{post.country}</td>
                        <td>
                          {post.title && <div>{post.title}</div>}
                          <div className="admin-cell-sub">{post.body.slice(0, 90)}</div>
                          {post.status === 'failed' && post.errorMessage && (
                            <div className="admin-cell-sub" style={{ color: '#b91c1c' }}>
                              {post.errorMessage}
                            </div>
                          )}
                        </td>
                        <td>{account ? account.label : <span className="admin-cell-sub">미지정</span>}</td>
                        <td>
                          <span className={`admin-pill ${post.status === 'posted' ? 'ok' : ''}`}>
                            {STATUS_LABEL[post.status]}
                          </span>
                        </td>
                        <td>{formatDateTime(post.updatedAt)}</td>
                        <td>
                          <div className="admin-action-row">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPost(post);
                                setSchedulingAt(post.scheduledAt ? post.scheduledAt.slice(0, 16) : '');
                              }}
                            >
                              편집
                            </button>
                            {post.status === 'draft' && IMPLEMENTED_PLATFORMS.includes(post.platform) && (
                              <button
                                type="button"
                                className="admin-create-btn"
                                disabled={approvingId === post.id}
                                onClick={() => void handleApprove(post)}
                              >
                                {approvingId === post.id ? '승인 중…' : '승인'}
                              </button>
                            )}
                            {post.status !== 'posted' &&
                              !(post.status === 'draft' && IMPLEMENTED_PLATFORMS.includes(post.platform)) &&
                              (() => {
                                const blocked = publishBlockReason(post);
                                const label = post.status === 'failed' ? '재시도' : '게시';
                                return (
                                  <>
                                    {blocked !== '자동 게시 미지원' && (
                                      <button
                                        type="button"
                                        className="admin-create-btn"
                                        disabled={publishingId === post.id || Boolean(blocked)}
                                        title={blocked ?? undefined}
                                        onClick={() => void handlePublish(post)}
                                      >
                                        {publishingId === post.id ? `${label} 중…` : label}
                                      </button>
                                    )}
                                    {blocked && blocked !== '자동 게시 미지원' && (
                                      <span className="admin-cell-sub">{blocked}</span>
                                    )}
                                    {blocked === '자동 게시 미지원' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void navigator.clipboard.writeText(post.body).then(() => {
                                            setCopiedId(post.id);
                                            setTimeout(() => setCopiedId((cur) => (cur === post.id ? null : cur)), 1500);
                                          });
                                        }}
                                      >
                                        {copiedId === post.id ? '복사됨' : '본문 복사'}
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            <button type="button" className="danger" onClick={() => void handleDeletePost(post)}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {posts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="admin-cell-sub">
                        표시할 항목이 없습니다. 위에서 「AI 초안 생성」으로 시작하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {editingPost && (
          <section className="admin-section admin-guide-editor">
            <h2>
              편집 — {PLATFORM_LABEL[editingPost.platform]} · {editingPost.country}
            </h2>
            {editingPost.title !== null && (
              <label className="admin-guide-field">
                제목
                <input
                  value={editingPost.title ?? ''}
                  onChange={(e) => setEditingPost({ ...editingPost, title: e.currentTarget.value })}
                />
              </label>
            )}
            <label className="admin-guide-field">
              본문
              <textarea
                rows={8}
                value={editingPost.body}
                onChange={(e) => setEditingPost({ ...editingPost, body: e.currentTarget.value })}
              />
            </label>
            {/* D2 — 게시 전 채널 미리보기. 픽셀 단위 재현이 아니라 "이대로 나가면
                이렇게 보인다"를 빠르게 확인하는 용도 + 플랫폼 글자수 한도 경고 */}
            {(() => {
              const limit = CHAR_LIMIT[editingPost.platform];
              const over = limit != null && editingPost.body.length > limit;
              return (
                <div style={{ marginBottom: 12 }}>
                  <p
                    className="admin-cell-sub"
                    style={{ textAlign: 'right', color: over ? '#b91c1c' : undefined, margin: '2px 0 6px' }}
                  >
                    {editingPost.body.length}
                    {limit != null ? ` / ${limit}자` : '자'}
                    {over ? ' — 한도 초과, 게시 시 플랫폼에서 잘리거나 거부될 수 있습니다' : ''}
                  </p>
                  <div className="admin-distribution-preview">
                    <div className="admin-distribution-preview-head">
                      <span className="admin-pill">{PLATFORM_LABEL[editingPost.platform]}</span>
                      <span className="admin-cell-sub">
                        {accounts.find((a) => a.id === editingPost.accountId)?.handle ?? '계정 미지정'}
                      </span>
                    </div>
                    {editingPost.title && <strong style={{ display: 'block', marginBottom: 4 }}>{editingPost.title}</strong>}
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{editingPost.body || '(본문 없음)'}</p>
                    {editingPost.mediaUrls.length > 0 && (
                      <p className="admin-cell-sub" style={{ marginTop: 6 }}>
                        미디어 {editingPost.mediaUrls.length}건 첨부됨
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
            <label className="admin-guide-field">
              게시 계정
              <select
                value={editingPost.accountId ?? ''}
                onChange={(e) =>
                  setEditingPost({ ...editingPost, accountId: e.currentTarget.value || null })
                }
              >
                <option value="">계정 미지정</option>
                {editorAccountOptions.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.country} · {acc.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-action-row">
              <button
                type="button"
                className="admin-create-btn"
                disabled={savingPost}
                onClick={() => void handleSaveEdit()}
              >
                {savingPost ? '저장 중…' : '저장'}
              </button>
              <button type="button" onClick={() => setEditingPost(null)}>
                취소
              </button>
            </div>

            {/* D2 — 예약 시간 설정 UI. 자동 발행 크론은 아직 없다 — 정직하게 밝혀둔다. */}
            {editingPost.status !== 'posted' && (
              <div className="admin-guide-field" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <label>
                  예약 시각
                  <input
                    type="datetime-local"
                    value={schedulingAt}
                    onChange={(e) => setSchedulingAt(e.currentTarget.value)}
                  />
                </label>
                <p className="admin-cell-sub" style={{ marginTop: 4 }}>
                  기록용입니다 — 예약 시각이 돼도 자동으로 게시되지 않습니다. 그 시각에 담당자가
                  직접 「게시」를 눌러야 나갑니다(자동 예약 발행은 아직 구현되지 않음).
                </p>
                <div className="admin-action-row" style={{ marginTop: 6 }}>
                  <button type="button" disabled={savingPost} onClick={() => void handleSchedule()}>
                    {savingPost ? '저장 중…' : '예약으로 표시'}
                  </button>
                  {editingPost.status === 'scheduled' && (
                    <button type="button" disabled={savingPost} onClick={() => void handleUnschedule()}>
                      예약 취소
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'accounts' && (
          <section className="admin-section">
            <h2>계정 추가</h2>
            <div className="admin-notice-form-row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.currentTarget.value as DistributionPlatform)}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
              <input
                style={{ width: 90 }}
                value={newCountry}
                onChange={(e) => setNewCountry(e.currentTarget.value)}
                placeholder="국가 (US)"
              />
              <input
                style={{ flex: 1, minWidth: 140 }}
                value={newLabel}
                onChange={(e) => setNewLabel(e.currentTarget.value)}
                placeholder="계정 이름 (내부 표시용)"
              />
              <input
                style={{ flex: 1, minWidth: 140 }}
                value={newHandle}
                onChange={(e) => setNewHandle(e.currentTarget.value)}
                placeholder="핸들 (@wayknit_us)"
              />
            </div>
            {newPlatform === 'x' && (
              <div className="admin-notice-form-row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                <input
                  style={{ flex: 1, minWidth: 200 }}
                  type="password"
                  value={newAccessToken}
                  onChange={(e) => setNewAccessToken(e.currentTarget.value)}
                  placeholder="X Access Token"
                />
                <input
                  style={{ flex: 1, minWidth: 200 }}
                  type="password"
                  value={newAccessTokenSecret}
                  onChange={(e) => setNewAccessTokenSecret(e.currentTarget.value)}
                  placeholder="X Access Token Secret"
                />
              </div>
            )}
            <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
              X는 개발자 포털에서 발급한 계정별 Access Token/Secret이 필요합니다. 앱 공통 Consumer
              Key/Secret은 Supabase 함수 시크릿(X_CONSUMER_KEY / X_CONSUMER_SECRET)에 별도 등록하세요.
            </p>
            <button type="button" className="admin-create-btn" onClick={() => void handleAddAccount()}>
              추가
            </button>

            <h2 style={{ marginTop: 20 }}>등록된 계정</h2>
            {PLATFORMS.map((platform) => (
              <div key={platform} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>{PLATFORM_LABEL[platform]}</strong>
                <div style={{ marginTop: 4 }}>
                  {(accountsByPlatform.get(platform) ?? []).map((acc) => (
                    <span
                      key={acc.id}
                      className={`admin-pill ${acc.isActive ? 'ok' : ''} ${
                        acc.id === highlightAccountId ? 'admin-distribution-account-highlight' : ''
                      }`}
                      ref={acc.id === highlightAccountId ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
                    >
                      {acc.country} · {acc.label}
                      {acc.handle ? ` (${acc.handle})` : ''}
                      <button
                        type="button"
                        onClick={() => void handleToggleAccount(acc)}
                        style={{ marginLeft: 6, border: 'none', background: 'none', cursor: 'pointer' }}
                        title={acc.isActive ? '비활성화' : '활성화'}
                      >
                        {acc.isActive ? '⏸' : '▶'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAccount(acc)}
                        style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer' }}
                        title="삭제"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {(accountsByPlatform.get(platform) ?? []).length === 0 && (
                    <span className="admin-cell-sub">등록된 계정 없음</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
