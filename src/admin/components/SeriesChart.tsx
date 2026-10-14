import { useId } from 'react';
import type { AdminSeries } from '@shared/admin';
import { formatByUnit, formatDayLabel } from '../lib/format';
import { vi } from '../i18n/vi';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

/** Hand-written SVG chart; the visually hidden table carries the same data for screen readers. */
export function SeriesChart({ series, variant = 'bar' }: { series: AdminSeries; variant?: 'bar' | 'line' }) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const points = series.points;

  if (points.length === 0) {
    return <p className="muted chart-empty">{vi.chart.empty}</p>;
  }

  const max = Math.max(1, ...points.map((point) => point.value));
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerWidth / points.length;
  const yFor = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;
  const xCenter = (index: number) => PAD.left + slot * index + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const kind = variant === 'bar' ? vi.chart.bar : vi.chart.line;
  const first = points[0]!.date;
  const last = points[points.length - 1]!.date;
  const description = vi.chart.describe(kind, series.label, points.length, first, last, max);
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="chart-svg"
      >
        <title id={titleId}>{series.label}</title>
        <desc id={descId}>{description}</desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(tick)} y2={yFor(tick)} className="chart-grid-line" />
            <text x={PAD.left - 8} y={yFor(tick) + 4} textAnchor="end" className="chart-tick">
              {formatByUnit(tick, series.unit)}
            </text>
          </g>
        ))}
        {variant === 'bar'
          ? points.map((point, index) => {
              const barWidth = Math.max(2, slot * 0.7);
              const barY = yFor(point.value);
              return (
                <rect
                  key={point.date}
                  x={xCenter(index) - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={Math.max(0, PAD.top + innerHeight - barY)}
                  className="chart-bar"
                  rx={2}
                />
              );
            })
          : (
            <>
              <polyline
                className="chart-line"
                fill="none"
                points={points.map((point, index) => `${xCenter(index)},${yFor(point.value)}`).join(' ')}
              />
              {points.map((point, index) => (
                <circle key={point.date} cx={xCenter(index)} cy={yFor(point.value)} r={3} className="chart-dot" />
              ))}
            </>
          )}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={`label-${point.date}`} x={xCenter(index)} y={HEIGHT - 8} textAnchor="middle" className="chart-tick">
              {formatDayLabel(point.date)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="sr-only">
        <table>
        <caption>{vi.chart.tableCaption(series.label)}</caption>
        <thead>
          <tr>
            <th scope="col">{vi.chart.day}</th>
            <th scope="col">{vi.chart.value}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{formatByUnit(point.value, series.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
