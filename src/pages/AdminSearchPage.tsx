import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import {
  groupByKind,
  searchAdmin,
  SEARCH_KIND_LABEL,
  type SearchHit,
} from '../lib/adminSearch';
import '../styles/app.css';

export default function AdminSearchPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setHits(await searchAdmin(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : '검색에 실패했습니다.');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (access === 'ok') void runSearch(query);
  }, [access, query, runSearch]);

  const groups = useMemo(() => groupByKind(hits), [hits]);

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>전역 검색</h1>
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
          <h1>전역 검색</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>전역 검색</h1>
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
          subtitle="사용자 · 여행 · 시나리오 · 가이드 · 공지를 한 번에"
          current="search"
          refreshing={searching}
          onRefresh={() => void runSearch(query)}
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <h2>
            {query ? `"${query}" 검색 결과 (${hits.length})` : '검색어를 입력하세요'}
          </h2>

          {!query && (
            <p className="admin-cell-sub">
              위쪽 검색창에 이메일·여행 제목·시나리오 지역·가이드 제목 등을 입력하면 전 영역에서 찾습니다.
            </p>
          )}

          {query && !searching && hits.length === 0 && (
            <p className="admin-cell-sub">일치하는 항목이 없습니다.</p>
          )}

          {groups.map((group) => (
            <div key={group.kind} className="search-group">
              <h3 className="admin-subheading">
                {SEARCH_KIND_LABEL[group.kind]} ({group.hits.length})
              </h3>
              <ul className="search-hits">
                {group.hits.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`} className="search-hit">
                    <span className="search-hit-main">
                      <span className="search-hit-title">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="search-hit-sub">{hit.subtitle}</span>
                      )}
                    </span>
                    {hit.status && <span className="search-hit-status">{hit.status}</span>}
                    {hit.url ? (
                      hit.url.startsWith('/trip/') ? (
                        <a
                          className="admin-link-btn"
                          href={hit.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          열기
                        </a>
                      ) : (
                        <Link className="admin-link-btn" to={hit.url}>
                          이동
                        </Link>
                      )
                    ) : (
                      <span className="admin-cell-sub">비공개</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
