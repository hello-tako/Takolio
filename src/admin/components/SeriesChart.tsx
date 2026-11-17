import clsx from 'clsx';
import { useId, useState } from 'react';
import type { AdminSeries } from '@shared/admin';
import { formatByUnit, formatDayLabel } from '../lib/format';
import { vi } from '../i18n/vi';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 14, right: 14, bottom: 28, left: 56 };

/** Hand-crafted Control Tower SVG chart with summary KPIs, interactive hover readout, and screen-reader data table. */
export function SeriesChart({ series, variant = 'bar' }: { series: AdminSeries; variant?: 'bar' | 'line' }) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const gradId = `${id}-area-grad`;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const points = series.points;

  if (points.length === 0) {
    return <p className="muted chart-empty">{vi.chart.empty}</p>;
  }

  const values = points.map((point) => point.value);
  const maxVal = Math.max(...values);
  const max = Math.max(1, maxVal);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const latestPoint = points[points.length - 1]!;
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerWidth / points.length;
  const baselineY = PAD.top + innerHeight;
  const yFor = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;
  const xCenter = (index: number) => PAD.left + slot * index + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const kind = variant === 'bar' ? vi.chart.bar : vi.chart.line;
  const first = points[0]!.date;
  const last = latestPoint.date;
  const description = vi.chart.describe(kind, series.label, points.length, first, last, maxVal);
  const ticks = [0, max / 2, max];

  const lineCoords = points.map((point, index) => `${xCenter(index)},${yFor(point.value)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M ${xCenter(0)},${baselineY} L ${points.map((point, index) => `${xCenter(index)},${yFor(point.value)}`).join(' L ')} L ${xCenter(points.length - 1)},${baselineY} Z`
      : '';

  return (
    <figure className="chart" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="chart-stats-bar">
        <div className="chart-stats-group">
          <span className="chart-stat-item">
            {vi.chart.total}:
            <span className="chart-stat-value">{formatByUnit(sum, series.unit)}</span>
          </span>
          <span className="chart-stat-item">
            {vi.chart.peak}:
            <span className="chart-stat-value">{formatByUnit(maxVal, series.unit)}</span>
          </span>
          <span className="chart-stat-item">
            {vi.chart.latest}:
            <span className="chart-stat-value">{formatByUnit(latestPoint.value, series.unit)}</span>
          </span>
        </div>
        {activePoint ? (
          <span className="chart-tooltip-pill" aria-live="polite">
            {formatDayLabel(activePoint.date)}: {formatByUnit(activePoint.value, series.unit)}
          </span>
        ) : (
          <span className="muted small mono">{series.source}</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="chart-svg"
      >
        <title id={titleId}>{series.label}</title>
        <desc id={descId}>{description}</desc>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B6B4A" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#1B6B4A" stopOpacity="0.01" />
          </linearGradient>
        </defs>

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
              const barWidth = Math.max(3, slot * 0.68);
              const barY = yFor(point.value);
              const barHeight = Math.max(0, baselineY - barY);
              return (
                <rect
                  key={point.date}
                  x={xCenter(index) - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  className={clsx('chart-bar', hoveredIndex === index && 'is-hovered')}
                  rx={3}
                  onMouseEnter={() => setHoveredIndex(index)}
                />
              );
            })
          : (
            <>
              <path d={areaPath} fill={`url(#${gradId})`} className="chart-area" />
              <polyline className="chart-line" fill="none" points={lineCoords} />
              {points.map((point, index) => (
                <circle
                  key={point.date}
                  cx={xCenter(index)}
                  cy={yFor(point.value)}
                  r={hoveredIndex === index ? 5 : 3.2}
                  className={clsx('chart-dot', hoveredIndex === index && 'is-hovered')}
                  onMouseEnter={() => setHoveredIndex(index)}
                />
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
