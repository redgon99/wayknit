import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import {
  addAdminUserAccount,
  createAdminNotice,
  deleteAdminNotice,
  fetchAdminShareStats,
  getEnvAdminEmails,
  isCurrentUserAdmin,
  listAdminNotices,
  listAdminUserAccounts,
  listAdminUserRows,
  listPlazaListings,
  removeAdminUserAccount,
  updateAdminNotice,
  upsertUserVerification,
  ADMIN_PAGE_SIZE,
  type AdminNotice,
  type AdminPlazaListing,
  type AdminShareStats,
  type AdminUserAccount,
  type AdminUserRow,
} from '../lib/admin';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv';
import { deleteWayknitMockMailUsers } from '../lib/mockMailUsers';
import { evaluateTier3Gates, type GateStatus } from '../lib/tierGates';
import '../styles/app.css';

/** 서버 페이지네이션용 이전/다음 컨트롤. 총 건수가 한 페이지 이하면 숨는다. */
function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const lastPage = Math.max(Math.ceil(total / ADMIN_PAGE_SIZE) - 1, 0);
  if (total <= ADMIN_PAGE_SIZE) return null;
  const from = page * ADMIN_PAGE_SIZE + 1;
  const to = Math.min((page + 1) * ADMIN_PAGE_SIZE, total);
  return (
    <div className="admin-pager">
      <button
        type="button"
        className="admin-link-btn"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        이전
      </button>
      <span className="admin-cell-sub">
        {from}–{to} / {total}
      </span>
      <button
        type="button"
        className="admin-link-btn"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        다음
      </button>
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function AdminPage() {
  const { configured, loading, user } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 전역 검색 결과에서 /admin?q=이메일 로 넘어오면 사용자 검색을 채워둔다
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState(() => searchParams.get('q') ?? '');
  const [userPage, setUserPage] = useState(0);

  const [plaza, setPlaza] = useState<AdminPlazaListing[]>([]);
  const [plazaTotal, setPlazaTotal] = useState(0);
  const [plazaSearch, setPlazaSearch] = useState('');
  const [plazaPage, setPlazaPage] = useState(0);

  const [stats, setStats] = useState<AdminShareStats | null>(null);
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [gates, setGates] = useState<GateStatus[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminUserAccount[]>([]);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticePublished, setNoticePublished] = useState(true);
  const [noticePinned, setNoticePinned] = useState(false);

  const [exporting, setExporting] = useState<'users' | 'plaza' | null>(null);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [deletingMocks, setDeletingMocks] = useState(false);

  const envAdminEmails = useMemo(() => getEnvAdminEmails(), []);
  const currentEmail = user?.email?.trim().toLowerCase() ?? null;

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [shareStats, noticeRows, gateRows, adminRows] = await Promise.all([
        fetchAdminShareStats(),
        listAdminNotices(),
        evaluateTier3Gates(),
        listAdminUserAccounts(),
      ]);
      setStats(shareStats);
      setNotices(noticeRows);
      setGates(gateRows);
      setAdminAccounts(adminRows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '관리자 데이터를 불러오지 못했습니다.';
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * 목록 두 개는 서버에서 페이지 단위로 가져온다. 검색어는 타이핑마다
   * 요청이 나가지 않도록 디바운스한다.
   */
  const loadUsers = useCallback(async (search: string, page: number) => {
    try {
      const result = await listAdminUserRows({
        search,
        limit: ADMIN_PAGE_SIZE,
        offset: page * ADMIN_PAGE_SIZE,
      });
      setUsers(result.rows);
      setUserTotal(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다.');
    }
  }, []);

  const loadPlaza = useCallback(async (search: string, page: number) => {
    try {
      const result = await listPlazaListings({
        search,
        limit: ADMIN_PAGE_SIZE,
        offset: page * ADMIN_PAGE_SIZE,
      });
      setPlaza(result.rows);
      setPlazaTotal(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : '공유마당 목록을 불러오지 못했습니다.');
    }
  }, []);

  /**
   * 내보내기는 화면에 보이는 페이지가 아니라 현재 검색 조건에 맞는 전체를
   * 받아야 쓸모가 있다. 서버 페이지네이션을 쓰므로 큰 limit으로 한 번 더 부른다.
   */
  const EXPORT_LIMIT = 5000;

  const handleExportUsers = async () => {
    setExporting('users');
    try {
      const { rows } = await listAdminUserRows({ search: userSearch, limit: EXPORT_LIMIT });
      const csv = toCsv(rows, [
        { header: '이메일', value: (r) => r.email ?? '' },
        { header: '사용자 ID', value: (r) => r.userId },
        { header: '여행수', value: (r) => r.tripCount },
        { header: '첫 생성', value: (r) => r.firstTripAt ?? '' },
        { header: '마지막 활동', value: (r) => r.lastUpdatedAt ?? '' },
        { header: '확인 상태', value: (r) => (r.isVerified ? '확인됨' : '미확인') },
        { header: '확인 시각', value: (r) => r.verifiedAt ?? '' },
        { header: '메모', value: (r) => r.memo ?? '' },
      ]);
      downloadCsv(csvFilename('wayknit_사용자'), csv);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPlaza = async () => {
    setExporting('plaza');
    try {
      const { rows } = await listPlazaListings({ search: plazaSearch, limit: EXPORT_LIMIT });
      const csv = toCsv(rows, [
        { header: '제목', value: (r) => r.title },
        { header: '여행 ID', value: (r) => r.id },
        { header: '소유자', value: (r) => r.ownerEmail ?? '' },
        { header: '마당 등록시각', value: (r) => r.listedAt ?? '' },
        { header: '자료 수', value: (r) => r.materialsCount },
      ]);
      downloadCsv(csvFilename('wayknit_공유마당'), csv);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => void loadUsers(userSearch, userPage), 250);
    return () => clearTimeout(timer);
  }, [isAdmin, userSearch, userPage, loadUsers]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => void loadPlaza(plazaSearch, plazaPage), 250);
    return () => clearTimeout(timer);
  }, [isAdmin, plazaSearch, plazaPage, loadPlaza]);

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
          await loadAll();
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
  }, [configured, loading, user, loadAll]);

  const publishedCount = useMemo(
    () => notices.filter((n) => n.isPublished).length,
    [notices]
  );

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>관리자 페이지</h1>
          <p>Supabase가 설정된 환경에서만 관리자 기능을 사용할 수 있습니다.</p>
          <Link to="/plan" className="admin-link-btn">
            플래너로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (checkingAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>관리자 페이지</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>관리자 페이지</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/plan" className="admin-link-btn">
            플래너로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const handleToggleVerify = async (row: AdminUserRow) => {
    try {
      await upsertUserVerification({
        userId: row.userId,
        isVerified: !row.isVerified,
        memo: row.memo ?? '',
      });
      await loadUsers(userSearch, userPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사용자 확인 상태 변경 실패');
    }
  };

  const handleMemoSave = async (row: AdminUserRow, memo: string) => {
    try {
      await upsertUserVerification({
        userId: row.userId,
        isVerified: row.isVerified,
        memo,
      });
      await loadUsers(userSearch, userPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : '메모 저장 실패');
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setError('추가할 관리자 이메일을 입력해 주세요.');
      return;
    }
    setAddingAdmin(true);
    try {
      await addAdminUserAccount(newAdminEmail);
      setNewAdminEmail('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리자 추가 실패');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteMockUsers = async () => {
    const ok = window.confirm(
      '시험용 목업 계정 user1@mail.com ~ user30@mail.com 과 목업 여행을 삭제할까요? 이 작업은 되돌릴 수 없습니다.'
    );
    if (!ok) return;
    setDeletingMocks(true);
    setError(null);
    try {
      const result = await deleteWayknitMockMailUsers();
      setUserPage(0);
      await Promise.all([loadUsers(userSearch, 0), loadAll()]);
      window.alert(`목업 계정 ${result.deletedUsers}명, 여행 ${result.deletedTrips}건을 삭제했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목업 계정 삭제 실패');
    } finally {
      setDeletingMocks(false);
    }
  };

  const handleRemoveAdmin = async (account: AdminUserAccount) => {
    const ok = window.confirm(`관리자 "${account.email}"의 권한을 제거할까요?`);
    if (!ok) return;
    try {
      await removeAdminUserAccount(account.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리자 삭제 실패');
    }
  };

  const handleCreateNotice = async () => {
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      setError('공지 제목과 내용을 입력해 주세요.');
      return;
    }
    try {
      await createAdminNotice({
        title: noticeTitle,
        body: noticeBody,
        isPublished: noticePublished,
        pinned: noticePinned,
      });
      setNoticeTitle('');
      setNoticeBody('');
      setNoticePublished(true);
      setNoticePinned(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 생성 실패');
    }
  };

  const handleTogglePublish = async (notice: AdminNotice) => {
    try {
      await updateAdminNotice(notice.id, { isPublished: !notice.isPublished });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '공개 상태 변경 실패');
    }
  };

  const handleTogglePinned = async (notice: AdminNotice) => {
    try {
      await updateAdminNotice(notice.id, { pinned: !notice.pinned });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '상단 고정 변경 실패');
    }
  };

  const handleDeleteNotice = async (notice: AdminNotice) => {
    const ok = window.confirm(`공지 "${notice.title}"를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteAdminNotice(notice.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 삭제 실패');
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          title="관리자 페이지"
          subtitle="현재 사용자확인 관리 / 공유자료 현황 관리 / 기타 공지사항 관리"
          current="admin"
          refreshing={refreshing}
          onRefresh={() => void loadAll()}
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <h2>관리자 계정 관리</h2>
          <p className="admin-section-lead">
            여기서 추가/삭제한 관리자는 DB(admin_users)에 저장됩니다. 마지막 관리자 1명은 잠금 방지를 위해 삭제할 수 없습니다.
          </p>

          {envAdminEmails.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <strong style={{ fontSize: 13 }}>환경변수(VITE_ADMIN_EMAILS) 관리자</strong>
              <p className="admin-cell-sub" style={{ marginBottom: 6 }}>
                배포 환경설정으로 지정된 관리자입니다. 이 화면에서는 추가·삭제할 수 없고, 배포 환경변수를 수정해야 합니다.
              </p>
              <div>
                {envAdminEmails.map((email) => (
                  <span key={email} className="admin-pill ok">
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
            <input
              style={{ flex: 1 }}
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.currentTarget.value)}
              placeholder="추가할 관리자 이메일"
            />
            <button
              type="button"
              className="admin-create-btn"
              disabled={addingAdmin}
              onClick={() => void handleAddAdmin()}
            >
              {addingAdmin ? '추가 중…' : '관리자 추가'}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>등록일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {adminAccounts.map((account) => {
                  const isSelf = currentEmail === account.email.toLowerCase();
                  const isLastAdmin = adminAccounts.length <= 1;
                  return (
                    <tr key={account.id}>
                      <td className="mono">
                        {account.email}
                        {isSelf && <span className="admin-pill" style={{ marginLeft: 6 }}>나</span>}
                      </td>
                      <td>{formatDateTime(account.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="danger"
                          disabled={isLastAdmin}
                          title={isLastAdmin ? '마지막 관리자는 삭제할 수 없습니다.' : undefined}
                          onClick={() => void handleRemoveAdmin(account)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {adminAccounts.length === 0 && (
                  <tr>
                    <td colSpan={3}>DB에 등록된 관리자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>현재 사용자확인 관리 ({userTotal}명)</h2>

          <div className="admin-filter-row">
            <input
              type="search"
              className="admin-search-input"
              value={userSearch}
              placeholder="이메일 · 메모 · 사용자 ID로 검색"
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(0);
              }}
              aria-label="사용자 검색"
            />
            <button
              type="button"
              className="admin-link-btn"
              disabled={exporting !== null || userTotal === 0}
              onClick={() => void handleExportUsers()}
            >
              {exporting === 'users' ? '내보내는 중…' : `CSV 내보내기 (${userTotal})`}
            </button>
            <button
              type="button"
              className="danger"
              disabled={deletingMocks}
              onClick={() => void handleDeleteMockUsers()}
            >
              {deletingMocks ? '삭제 중…' : '목업 계정 삭제'}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>여행수</th>
                  <th>첫 생성</th>
                  <th>마지막 활동</th>
                  <th>확인 상태</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      {row.email ?? <span className="admin-cell-sub">(계정 없음)</span>}
                      <div className="admin-cell-sub mono">{row.userId}</div>
                    </td>
                    <td>{row.tripCount}</td>
                    <td>{formatDateTime(row.firstTripAt)}</td>
                    <td>{formatDateTime(row.lastUpdatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={`admin-verify-btn ${row.isVerified ? 'is-verified' : 'is-unverified'}`}
                        onClick={() => void handleToggleVerify(row)}
                      >
                        {row.isVerified ? '확인됨' : '미확인'}
                      </button>
                      {row.verifiedAt && (
                        <div className="admin-cell-sub">{formatDateTime(row.verifiedAt)}</div>
                      )}
                    </td>
                    <td>
                      <textarea
                        className="admin-memo-input"
                        defaultValue={row.memo ?? ''}
                        placeholder="관리 메모"
                        onBlur={(e) => void handleMemoSave(row, e.currentTarget.value)}
                      />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {userSearch ? '검색 결과가 없습니다.' : '표시할 사용자가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pager
            page={userPage}
            total={userTotal}
            onPage={setUserPage}
          />
        </section>

        <section className="admin-section">
          <h2>공유자료 현황 관리</h2>
          <div className="admin-stats-grid">
            <article className="admin-stat-card">
              <span>총 여행 수</span>
              <strong>{stats?.totalTrips ?? 0}</strong>
            </article>
            <article className="admin-stat-card">
              <span>공개 여행 수</span>
              <strong>{stats?.publicTrips ?? 0}</strong>
            </article>
            <article className="admin-stat-card">
              <span>공유마당 등록 수</span>
              <strong>{stats?.listedTrips ?? 0}</strong>
            </article>
            <article className="admin-stat-card">
              <span>업로드 자료 수</span>
              <strong>{stats?.totalMaterials ?? 0}</strong>
            </article>
            <article className="admin-stat-card">
              <span>끌어오기 누적 수</span>
              <strong>{stats?.totalImports ?? 0}</strong>
            </article>
            <article className="admin-stat-card">
              <span>게시 중 공지</span>
              <strong>{publishedCount}</strong>
            </article>
          </div>

          <h3 className="admin-subheading">공유마당 등록 목록 ({plazaTotal}건)</h3>

          <div className="admin-filter-row">
            <input
              type="search"
              className="admin-search-input"
              value={plazaSearch}
              placeholder="제목 · 소유자 이메일로 검색"
              onChange={(e) => {
                setPlazaSearch(e.target.value);
                setPlazaPage(0);
              }}
              aria-label="공유마당 검색"
            />
            <button
              type="button"
              className="admin-link-btn"
              disabled={exporting !== null || plazaTotal === 0}
              onClick={() => void handleExportPlaza()}
            >
              {exporting === 'plaza' ? '내보내는 중…' : `CSV 내보내기 (${plazaTotal})`}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>소유자</th>
                  <th>마당 등록시각</th>
                  <th>자료 수</th>
                </tr>
              </thead>
              <tbody>
                {plaza.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.title}
                      <div className="admin-cell-sub mono">{row.id}</div>
                    </td>
                    <td>
                      {row.ownerEmail ?? <span className="admin-cell-sub">(계정 없음)</span>}
                    </td>
                    <td>{formatDateTime(row.listedAt)}</td>
                    <td>{row.materialsCount}</td>
                  </tr>
                ))}
                {plaza.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      {plazaSearch ? '검색 결과가 없습니다.' : '공유마당 등록 데이터가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pager page={plazaPage} total={plazaTotal} onPage={setPlazaPage} />
        </section>

        <section className="admin-section">
          <h2>Tier 3 착수 게이트</h2>
          <p className="admin-section-lead">
            아래 항목은 수치가 기준을 넘으면 착수를 검토한다. 최근 30일 계측 기준.
            {gates.some((g) => g.source === 'local') && ' (원격 집계 불가 — 이 브라우저 로컬 값)'}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>지표</th>
                  <th>현재</th>
                  <th>기준</th>
                  <th>상태</th>
                  <th>판단 근거</th>
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div>{g.id}</div>
                      <div className="admin-cell-sub">{g.item}</div>
                    </td>
                    <td className="mono">{g.event}</td>
                    <td>
                      {g.count}
                      {g.sessions != null && (
                        <div className="admin-cell-sub">세션 {g.sessions}</div>
                      )}
                    </td>
                    <td>
                      {g.threshold} / {g.windowDays}일
                    </td>
                    <td>
                      <span className={`admin-gate-badge ${g.met ? 'met' : 'waiting'}`}>
                        {g.met ? '착수 검토' : '관찰 중'}
                      </span>
                    </td>
                    <td className="admin-cell-detail">{g.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>기타 공지사항 관리</h2>

          <div className="admin-notice-form">
            <input
              className="admin-notice-title"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.currentTarget.value)}
              placeholder="공지 제목"
            />
            <textarea
              className="admin-notice-body"
              value={noticeBody}
              onChange={(e) => setNoticeBody(e.currentTarget.value)}
              placeholder="공지 내용"
            />
            <div className="admin-notice-form-row">
              <label>
                <input
                  type="checkbox"
                  checked={noticePublished}
                  onChange={(e) => setNoticePublished(e.currentTarget.checked)}
                />
                게시
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={noticePinned}
                  onChange={(e) => setNoticePinned(e.currentTarget.checked)}
                />
                상단 고정
              </label>
              <button type="button" className="admin-create-btn" onClick={() => void handleCreateNotice()}>
                공지 추가
              </button>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>내용</th>
                  <th>상태</th>
                  <th>수정시각</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td>{n.title}</td>
                    <td className="admin-notice-body-cell">{n.body}</td>
                    <td>
                      <span className={`admin-pill ${n.isPublished ? 'ok' : ''}`}>
                        {n.isPublished ? '게시중' : '비공개'}
                      </span>
                      {n.pinned && <span className="admin-pill pin">고정</span>}
                    </td>
                    <td>{formatDateTime(n.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row">
                        <button type="button" onClick={() => void handleTogglePublish(n)}>
                          {n.isPublished ? '비공개' : '게시'}
                        </button>
                        <button type="button" onClick={() => void handleTogglePinned(n)}>
                          {n.pinned ? '고정해제' : '고정'}
                        </button>
                        <button type="button" className="danger" onClick={() => void handleDeleteNotice(n)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {notices.length === 0 && (
                  <tr>
                    <td colSpan={5}>등록된 공지가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
