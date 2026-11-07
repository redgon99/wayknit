import { useEffect, useState, type ReactNode } from 'react';
import { AdminPreviewModal } from './AdminPreviewModal';
import { AdminPager } from './AdminPager';
import {
  ADMIN_PAGE_SIZE,
  listAdminImportRows,
  listAdminMaterialRows,
  listAdminNotices,
  listAdminTripRows,
  type AdminImportRow,
  type AdminListQuery,
  type AdminMaterialRow,
  type AdminNotice,
  type AdminPage,
  type AdminTripRow,
} from '../lib/admin';

export type StatDetailKind = 'trips' | 'public' | 'listed' | 'materials' | 'imports' | 'notices';

export const STAT_DETAIL_LABEL: Record<StatDetailKind, string> = {
  trips: '총 여행 수',
  public: '공개 여행 수',
  listed: '공유마당 등록 수',
  materials: '업로드 자료 수',
  imports: '끌어오기 누적 수',
  notices: '게시 중 공지',
};

const MATERIAL_KIND_LABEL: Record<string, string> = {
  text: '메모',
  image: '사진',
  file: '파일',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

function email(value: string | null): ReactNode {
  return value ?? <span className="admin-cell-sub">(계정 없음)</span>;
}

/** 공개 여행만 공유 주소로 열린다 — 비공개는 제목만 보여준다 */
function TripTitle({ title, slug, isPublic }: { title: string; slug: string | null; isPublic: boolean }) {
  if (!isPublic || !slug) return <>{title}</>;
  return (
    <a href={`/trip/${slug}`} target="_blank" rel="noopener noreferrer">
      {title}
    </a>
  );
}

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

interface DetailView<T> {
  placeholder: string;
  load: (query: AdminListQuery) => Promise<AdminPage<T>>;
  rowKey: (row: T) => string;
  columns: Column<T>[];
}

function tripView(
  filter: 'all' | 'public' | 'listed',
  placeholder: string
): DetailView<AdminTripRow> {
  const timeColumn: Column<AdminTripRow> =
    filter === 'listed'
      ? { header: '마당 등록시각', cell: (r) => formatDateTime(r.plazaListedAt) }
      : { header: '수정시각', cell: (r) => formatDateTime(r.updatedAt) };
  return {
    placeholder,
    load: (query) => listAdminTripRows({ ...query, filter }),
    rowKey: (r) => r.id,
    columns: [
      {
        header: '제목',
        cell: (r) => (
          <>
            <TripTitle title={r.title} slug={r.slug} isPublic={r.isPublic} />
            <div className="admin-cell-sub mono">{r.id}</div>
          </>
        ),
      },
      { header: '소유자', cell: (r) => email(r.ownerEmail) },
      {
        header: '상태',
        cell: (r) => (
          <>
            <span className={`admin-pill ${r.isPublic ? 'ok' : ''}`}>
              {r.isPublic ? '공개' : '비공개'}
            </span>
            {r.listedInPlaza && <span className="admin-pill pin">공유마당</span>}
          </>
        ),
      },
      timeColumn,
    ],
  };
}

const TRIPS_VIEW = tripView('all', '제목 · 소유자 이메일로 검색');
const PUBLIC_VIEW = tripView('public', '제목 · 소유자 이메일로 검색');
const LISTED_VIEW = tripView('listed', '제목 · 소유자 이메일로 검색');

const MATERIALS_VIEW: DetailView<AdminMaterialRow> = {
  placeholder: '자료 제목 · 파일명 · 여행 · 올린 사람으로 검색',
  load: listAdminMaterialRows,
  rowKey: (r) => `${r.tripId}:${r.materialId}`,
  columns: [
    {
      header: '자료',
      cell: (r) => (
        <>
          {r.title}
          {r.fileName && r.fileName !== r.title && (
            <div className="admin-cell-sub">{r.fileName}</div>
          )}
        </>
      ),
    },
    { header: '종류', cell: (r) => MATERIAL_KIND_LABEL[r.kind ?? ''] ?? r.kind ?? '-' },
    { header: '여행', cell: (r) => r.tripTitle },
    {
      header: '올린 사람',
      cell: (r) => r.authorEmail ?? <span className="admin-cell-sub">(기록 없음)</span>,
    },
    { header: '올린 시각', cell: (r) => formatDateTime(r.createdAt) },
  ],
};

const IMPORTS_VIEW: DetailView<AdminImportRow> = {
  placeholder: '원본 여행 · 소유자 · 끌어온 사용자로 검색',
  load: listAdminImportRows,
  rowKey: (r) => r.id,
  columns: [
    {
      header: '원본 여행',
      cell: (r) => (
        <TripTitle title={r.sourceTitle} slug={r.sourceSlug} isPublic={r.sourceIsPublic} />
      ),
    },
    { header: '원본 소유자', cell: (r) => email(r.sourceOwnerEmail) },
    { header: '끌어온 사용자', cell: (r) => email(r.importerEmail) },
    {
      header: '복제본',
      cell: (r) => r.clonedTitle ?? <span className="admin-cell-sub">(삭제됨)</span>,
    },
    { header: '끌어온 시각', cell: (r) => formatDateTime(r.createdAt) },
  ],
};

/** 공지는 전체를 이미 한 번에 받는 구조라 게시중만 추려 화면에서 나눈다 */
async function loadPublishedNotices(query: AdminListQuery): Promise<AdminPage<AdminNotice>> {
  const term = query.search?.trim().toLowerCase() ?? '';
  const matched = (await listAdminNotices()).filter(
    (n) =>
      n.isPublished &&
      (!term || n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term))
  );
  const offset = query.offset ?? 0;
  return {
    rows: matched.slice(offset, offset + (query.limit ?? ADMIN_PAGE_SIZE)),
    totalCount: matched.length,
  };
}

const NOTICES_VIEW: DetailView<AdminNotice> = {
  placeholder: '공지 제목 · 내용으로 검색',
  load: loadPublishedNotices,
  rowKey: (n) => n.id,
  columns: [
    {
      header: '제목',
      cell: (n) => (
        <>
          {n.title}
          {n.pinned && <span className="admin-pill pin">고정</span>}
        </>
      ),
    },
    { header: '내용', cell: (n) => <span className="admin-notice-body-cell">{n.body}</span> },
    { header: '수정시각', cell: (n) => formatDateTime(n.updatedAt) },
  ],
};

function DetailTable<T>({ view, onTotal }: { view: DetailView<T>; onTotal: (n: number) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // 첫 요청은 바로, 검색어 입력은 타이핑마다 나가지 않도록 늦춘다
    const timer = setTimeout(() => {
      void view
        .load({ search, limit: ADMIN_PAGE_SIZE, offset: page * ADMIN_PAGE_SIZE })
        .then((result) => {
          if (!alive) return;
          setRows(result.rows);
          setTotal(result.totalCount);
          onTotal(result.totalCount);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setError(e instanceof Error ? e.message : '상세 내역을 불러오지 못했습니다.');
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [view, search, page, onTotal]);

  return (
    <>
      <div className="admin-filter-row">
        <input
          type="search"
          className="admin-search-input"
          value={search}
          placeholder={view.placeholder}
          aria-label="상세 내역 검색"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {error ? (
        <div className="admin-error">{error}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {view.columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={view.rowKey(row)}>
                  {view.columns.map((c) => (
                    <td key={c.header}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={view.columns.length}>
                    {loading
                      ? '불러오는 중…'
                      : search
                        ? '검색 결과가 없습니다.'
                        : '표시할 내역이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager page={page} total={total} onPage={setPage} />
    </>
  );
}

/** 공유자료 현황 칩의 숫자 뒤에 있는 실제 내역을 보여주는 모달 */
export function AdminStatDetailModal({
  kind,
  onClose,
}: {
  kind: StatDetailKind;
  onClose: () => void;
}) {
  const [total, setTotal] = useState<number | null>(null);

  return (
    <AdminPreviewModal
      open
      onClose={onClose}
      title={STAT_DETAIL_LABEL[kind]}
      subtitle={total === null ? undefined : `${total.toLocaleString('ko-KR')}건`}
      className="admin-stat-detail-modal"
    >
      {kind === 'trips' && <DetailTable view={TRIPS_VIEW} onTotal={setTotal} />}
      {kind === 'public' && <DetailTable view={PUBLIC_VIEW} onTotal={setTotal} />}
      {kind === 'listed' && <DetailTable view={LISTED_VIEW} onTotal={setTotal} />}
      {kind === 'materials' && <DetailTable view={MATERIALS_VIEW} onTotal={setTotal} />}
      {kind === 'imports' && <DetailTable view={IMPORTS_VIEW} onTotal={setTotal} />}
      {kind === 'notices' && <DetailTable view={NOTICES_VIEW} onTotal={setTotal} />}
    </AdminPreviewModal>
  );
}
