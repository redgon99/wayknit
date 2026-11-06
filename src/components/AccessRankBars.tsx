export interface AccessRankRow {
  key: string;
  label: string;
  value: number;
  /** 값 뒤에 붙는 설명(단위·비중 등) */
  detail: string;
}

/**
 * 순위 막대. 값이 모두 글자로 보이므로 툴팁 없이 막대는 크기 비교만 맡는다.
 * rows는 값이 큰 순서로 넘긴다.
 */
export function AccessRankBars({ rows }: { rows: AccessRankRow[] }) {
  const maxValue = rows[0]?.value ?? 0;
  return (
    <ul className="access-sections">
      {rows.map((row) => (
        <li key={row.key} className="access-section-row">
          <span className="access-section-label" title={row.label}>
            {row.label}
          </span>
          <span
            className="access-section-bar"
            style={{ width: `${maxValue > 0 ? (row.value / maxValue) * 100 : 0}%` }}
          />
          <span className="access-section-meta">
            <strong>{row.value.toLocaleString('ko-KR')}</strong>
            {row.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
