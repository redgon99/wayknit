import { ADMIN_PAGE_SIZE } from '../lib/admin';

/** 서버 페이지네이션용 이전/다음 컨트롤. 총 건수가 한 페이지 이하면 숨는다. */
export function AdminPager({
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
