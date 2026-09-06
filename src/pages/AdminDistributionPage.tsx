import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import { isCurrentUserAdmin } from '../lib/admin';
import {
  addDistributionAccount,
  approveDistributionPost,
  deleteDistributionAccount,
  deleteDistributionPost,
  listDistributionAccounts,
  listDistributionPosts,
  setDistributionAccountActive,
  triggerDistributionDraft,
  triggerDistributionPublish,
  updateDistributionPost,
} from '../lib/distribution';
import type {
  DistributionAccount,
  DistributionPlatform,
  DistributionPost,
  DistributionPostStatus,
} from '../types/distribution';
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
  const { configured, loading, user } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'accounts'>('queue');

  const [accounts, setAccounts] = useState<DistributionAccount[]>([]);
  const [posts, setPosts] = useState<DistributionPost[]>([]);

  const [platformFilter, setPlatformFilter] = useState<DistributionPlatform | ''>('');
  const [statusFilter, setStatusFilter] = useState<DistributionPostStatus | ''>('');

  const [draftPlatforms, setDraftPlatforms] = useState<Set<DistributionPlatform>>(new Set(['x']));
  const [draftCountries, setDraftCountries] = useState('US, GB, JP');
  const [drafting, setDrafting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<DistributionPost | null>(null);
  const [savingPost, setSavingPost] = useState(false);

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

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadPosts()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAccounts, loadPosts]);

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
        if (ok) await loadAll();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loading, user, loadAll]);

  useEffect(() => {
    if (isAdmin) void loadPosts();
  }, [isAdmin, loadPosts]);

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
  if (!loading && !user) return <Navigate to="/login" replace />;
  if (checkingAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>배포관리</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (!isAdmin) {
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

  const handleGenerateDrafts = async () => {
    const platforms = [...draftPlatforms];
    const countries = draftCountries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (platforms.length === 0 || countries.length === 0) {
      setError('플랫폼과 국가를 1개 이상 선택/입력하세요.');
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const result = await triggerDistributionDraft({ platforms, countries });
      if (result.created === 0) {
        setError('초안을 생성하지 못했습니다. 발행된 가이드가 있는지 확인해 주세요.');
      }
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '초안 생성 실패');
    } finally {
      setDrafting(false);
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
    const ok = window.confirm(
      `${PLATFORM_LABEL[post.platform]} 계정으로 실제 게시됩니다. 계속할까요?\n\n${post.body.slice(0, 120)}`
    );
    if (!ok) return;
    setPublishingId(post.id);
    setError(null);
    try {
      await approveDistributionPost(post.id);
      await triggerDistributionPublish(post.id);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 실패');
      await loadPosts();
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeletePost = async (post: DistributionPost) => {
    const ok = window.confirm('이 초안을 삭제할까요?');
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
              발행된 가이드 카드를 소스로, 선택한 플랫폼×국가 조합마다 게시글 초안을 만듭니다.
              {' '}X 외 플랫폼은 초안까지만 생성되고 실제 게시는 커넥터 구현 후 지원됩니다.
            </p>
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
                            <button type="button" onClick={() => setEditingPost(post)}>
                              편집
                            </button>
                            {post.status !== 'posted' && (
                              <button
                                type="button"
                                className="admin-create-btn"
                                disabled={publishingId === post.id}
                                onClick={() => void handlePublish(post)}
                              >
                                {publishingId === post.id ? '게시 중…' : '게시'}
                              </button>
                            )}
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
                    <span key={acc.id} className={`admin-pill ${acc.isActive ? 'ok' : ''}`}>
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
