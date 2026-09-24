import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthBar } from './AuthBar';

export type AdminPageKey =
  | 'dashboard'
  | 'admin'
  | 'insights'
  | 'insight-reports'
  | 'guides'
  | 'distribution'
  | 'scenarios'
  | 'landing'
  | 'reports'
  | 'audit'
  | 'search';

interface NavItem {
  key: AdminPageKey;
  label: string;
  to: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** 업무 성격별로 묶은 사이드바 메뉴. 예전엔 9개 버튼이 한 줄에 나열돼 2줄로 줄바꿈됐다 (§32 개편). */
const NAV_GROUPS: NavGroup[] = [
  {
    label: '개요',
    items: [{ key: 'dashboard', label: '대시보드', to: '/admin/dashboard' }],
  },
  {
    label: '운영',
    items: [
      { key: 'admin', label: '현황 관리', to: '/admin' },
      { key: 'reports', label: '신고 검수', to: '/admin/reports' },
      { key: 'audit', label: '감사 로그', to: '/admin/audit' },
    ],
  },
  {
    label: '콘텐츠',
    items: [
      { key: 'guides', label: '가이드 카드', to: '/admin/guides' },
      { key: 'scenarios', label: '시나리오 카탈로그', to: '/admin/scenarios' },
      { key: 'landing', label: '랜딩페이지 관리', to: '/admin/landing' },
    ],
  },
  {
    label: '성장',
    items: [
      { key: 'insights', label: '시장 인사이트', to: '/admin/insights' },
      { key: 'insight-reports', label: '리서치 리포트', to: '/admin/insight-reports' },
      { key: 'distribution', label: '배포관리', to: '/admin/distribution' },
    ],
  },
];

const PAGE_TITLE: Record<AdminPageKey, string> = {
  dashboard: '대시보드',
  admin: '현황 관리',
  insights: '시장 인사이트',
  'insight-reports': '리서치 리포트',
  guides: '가이드 카드',
  distribution: '배포관리',
  scenarios: '시나리오 카탈로그',
  landing: '랜딩페이지 관리',
  reports: '신고 검수',
  audit: '감사 로그',
  search: '통합 검색',
};

interface Props {
  subtitle: string;
  current: AdminPageKey;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** 페이지별 추가 액션(예: 가이드 카드의 "공개 가이드 보기", 코스 매크로 토글) */
  extraActions?: ReactNode;
  /** 랜딩페이지 관리처럼 더 넓은 본문이 필요한 페이지 */
  wide?: boolean;
  children: ReactNode;
}

export function AdminShell({
  subtitle,
  current,
  refreshing = false,
  onRefresh,
  extraActions,
  wide = false,
  children,
}: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(current === 'search' ? (params.get('q') ?? '') : '');

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    navigate(`/admin/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="admin-app-shell">
      <nav className="admin-sidebar" aria-label="관리자 메뉴">
        <div className="admin-sidebar-brand">
          <span className="logo">Wayknit 관리자</span>
        </div>
        <div className="admin-sidebar-groups">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="admin-sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`admin-sidebar-link${item.key === current ? ' active' : ''}`}
                  aria-current={item.key === current ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="admin-sidebar-account">
          <AuthBar />
        </div>
        <div className="admin-sidebar-utility">
          <Link to="/plan">플래너로 이동 ↗</Link>
        </div>
      </nav>

      <div className="admin-main-col">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <h1>{PAGE_TITLE[current]}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="admin-topbar-actions">
            {onRefresh && (
              <button type="button" className="admin-refresh-btn" onClick={onRefresh}>
                {refreshing ? '새로고침 중...' : '새로고침'}
              </button>
            )}
            {extraActions}
            <form className="admin-global-search" onSubmit={submitSearch} role="search">
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="전체 검색 (이메일 · 여행 · 시나리오 · 가이드)"
                aria-label="관리자 전역 검색"
              />
              <button type="submit" className="admin-link-btn">
                검색
              </button>
            </form>
          </div>
        </header>
        <main className={`admin-content${wide ? ' admin-content-wide' : ''}`}>{children}</main>
      </div>
    </div>
  );
}
