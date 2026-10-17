import type { AdminMetric } from '@shared/admin';

const integer = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' });

export function formatNumber(value: number): string {
  return integer.format(value);
}

export function formatVnd(value: number): string {
  return vnd.format(value);
}

export function formatUsd(value: number): string {
  return usd.format(value);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateOnly.format(date);
}

/** Formats a value by the metric/series unit; null stays a dash. */
export function formatByUnit(value: number | null, unit: AdminMetric['unit']): string {
  if (value === null || Number.isNaN(value)) return '—';
  switch (unit) {
    case 'vnd':
      return formatVnd(value);
    case 'usd':
      return formatUsd(value);
    case 'ms':
      return `${formatNumber(value)} ms`;
    case 'percent':
      return `${percent.format(value)}%`;
    case 'tokens':
      return `${formatNumber(value)} token`;
    default:
      return formatNumber(value);
  }
}

/** UTC `YYYY-MM-DD` day bucket to `DD/MM`, without timezone shifting. */
export function formatDayLabel(day: string): string {
  return day.length >= 10 ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : day;
}
