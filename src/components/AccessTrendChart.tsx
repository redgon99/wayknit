import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { AccessLogBucket, AccessLogTrendPoint } from '../lib/adminAccessLog';

const HEIGHT = 170;
const MARGIN = { top: 12, right: 44, bottom: 24, left: 40 };
const Y_TICKS = 4;
const MAX_X_LABELS = 8;
/** 끝값 라벨이 이보다 가까우면 겹치므로 범례와 툴팁에 맡긴다 */
const MIN_LABEL_GAP = 14;

const SERIES = [
  { key: 'views', label: '조회수', color: 'var(--trend-views)' },
  { key: 'visitors', label: '방문자', color: 'var(--trend-visitors)' },
] as const;

/** 0부터 시작하는 눈금이 정수로 떨어지는 간격(1·2·5 단위) */
function tickStep(max: number): number {
  const raw = Math.max(max, 1) / Y_TICKS;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 5, 10].find((m) => m * power >= raw) ?? 10;
  return Math.max(1, nice * power);
}

function bucketLabel(at: string, bucket: AccessLogBucket): string {
  if (bucket === 'hour') return `${Number(at.slice(11, 13))}시`;
  return `${Number(at.slice(5, 7))}/${Number(at.slice(8, 10))}`;
}

function linePath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
}

interface AccessTrendChartProps {
  points: AccessLogTrendPoint[];
  bucket: AccessLogBucket;
  /** 다시 불러오는 동안 이전 그래프를 흐리게 유지한다 */
  dimmed?: boolean;
}

export function AccessTrendChart({ points, bucket, dimmed = false }: AccessTrendChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // viewBox로 늘리면 넓은 화면에서 글자까지 커지므로 실제 폭에 맞춰 그린다.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = points.length;
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const step = tickStep(Math.max(0, ...points.flatMap((p) => [p.views, p.visitors])));
  const yMax = step * Y_TICKS;
  const x = (i: number) => MARGIN.left + (count > 1 ? (i / (count - 1)) * innerWidth : innerWidth / 2);
  const y = (value: number) => MARGIN.top + innerHeight * (1 - value / yMax);
  const xLabelEvery = Math.ceil(count / MAX_X_LABELS);

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const ratio = (event.clientX - left - MARGIN.left) / innerWidth;
    setActive(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
  };

  const handleKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const move = event.key === 'ArrowRight' ? 1 : -1;
    setActive((i) => Math.min(count - 1, Math.max(0, (i ?? count - 1) + move)));
  };

  const last = points[count - 1];
  const endValues = last ? SERIES.map((s) => ({ ...s, value: last[s.key] })) : [];
  const showEndLabels =
    endValues.length === 2 &&
    Math.abs(y(endValues[0].value) - y(endValues[1].value)) >= MIN_LABEL_GAP;
  const activePoint = active === null ? null : points[active];
  const tooltipOnLeft = active !== null && x(active) > width / 2;

  return (
    <div className={`access-trend${dimmed ? ' access-trend-dimmed' : ''}`}>
      <div className="access-trend-legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i className="access-trend-key" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="access-trend-plot" ref={plotRef}>
        {width > 0 && count > 0 && (
          <svg
            height={HEIGHT}
            role="img"
            aria-label="기간별 조회수와 방문자 추이. 값은 아래 표에서도 볼 수 있습니다."
            tabIndex={0}
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActive(null)}
            onKeyDown={handleKey}
            onBlur={() => setActive(null)}
          >
            {Array.from({ length: Y_TICKS + 1 }, (_, i) => i * step).map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + innerWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--color-border)"
                />
                <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end">
                  {tick.toLocaleString('ko-KR')}
                </text>
              </g>
            ))}

            {points.map((p, i) =>
              (count - 1 - i) % xLabelEvery === 0 ? (
                <text key={p.at} x={x(i)} y={HEIGHT - 6} textAnchor="middle">
                  {bucketLabel(p.at, bucket)}
                </text>
              ) : null
            )}

            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="var(--color-text-tertiary)"
              />
            )}

            {SERIES.map((s) => (
              <path
                key={s.key}
                d={linePath(points.map((p, i) => [x(i), y(p[s.key])]))}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {SERIES.map((s) => {
              const index = active ?? count - 1;
              return (
                <circle
                  key={s.key}
                  cx={x(index)}
                  cy={y(points[index][s.key])}
                  r={4}
                  fill={s.color}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            })}

            {showEndLabels &&
              endValues.map((s) => (
                <text key={s.key} x={x(count - 1) + 10} y={y(s.value) + 4}>
                  {s.value.toLocaleString('ko-KR')}
                </text>
              ))}
          </svg>
        )}

        {activePoint && active !== null && (
          <div
            className="access-trend-tooltip"
            style={tooltipOnLeft ? { right: width - x(active) + 10 } : { left: x(active) + 10 }}
          >
            <span>{bucketLabel(activePoint.at, bucket)}</span>
            {SERIES.map((s) => (
              <p key={s.key}>
                <i className="access-trend-key" style={{ background: s.color }} />
                <strong>{activePoint[s.key].toLocaleString('ko-KR')}</strong> {s.label}
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="access-trend-table">
        <summary>표로 보기</summary>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{bucket === 'hour' ? '시간' : '날짜'}</th>
                <th>조회수</th>
                <th>방문자</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.at}>
                  <td>{bucketLabel(p.at, bucket)}</td>
                  <td>{p.views.toLocaleString('ko-KR')}</td>
                  <td>{p.visitors.toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
