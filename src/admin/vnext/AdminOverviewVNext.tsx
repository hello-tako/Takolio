import { Link } from 'react-router-dom';
import { useOverview } from '../api/hooks';
import { useRangeParam } from '../lib/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import { SeriesChart } from '../components/SeriesChart';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  RangeSelect,
  type Tone,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { vi } from '../i18n/vi';
import './admin-vnext.css';

const SEVERITY_TONE: Record<string, Tone> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

/**
 * AD02 — Tổng quan hệ thống (G02 Live Admin Pilot).
 * Faithfully matches `AD02.png` data-dense operational dashboard while strictly
 * preserving:
 * - Separate Admin session & RBAC (`overview.read`)
 * - 100% real `useOverview(range)` telemetry (ZERO fake KPIs!)
 * - Clear fixture banner when running against local synthetic dataset
 */
export function AdminOverviewVNext() {
  const [range, setRange] = useRangeParam();
  const overview = useOverview(range);

  return (
    <div className="tkv-admin-pilot" data-testid="ad02-vnext-overview">
      <div className="tkv-admin-header">
        <div>
          <span className="tkv-admin-eyebrow">AD02 · Bảng điều hành hệ thống</span>
          <h1 className="tkv-admin-title" data-testid="admin-page-title">{vi.overview.title}</h1>
          <p className="tkv-admin-subtitle">{vi.overview.description}</p>
        </div>
        <div className="tkv-admin-actions">
          <RangeSelect value={range} onChange={setRange} />
        </div>
      </div>

      {overview.isPending ? <LoadingState rows={6} /> : null}
      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : null}

      {overview.data ? (
        <div
          className={overview.isPlaceholderData ? 'is-stale tkv-admin-stack' : 'tkv-admin-stack'}
          aria-busy={overview.isPlaceholderData}
        >
          {/* Top 3 Operational Status Tiles matching AD02.png ("Trạng thái | Cần kiểm tra | Tác vụ / Chỉ số") */}
          <section aria-label=" Tóm tắt trạng thái vận hành" className="tkv-admin-status-trio">
            <div className="tkv-status-tile is-mint">
              <span className="tkv-tile-label">Trạng thái hệ thống</span>
              <strong className="tkv-tile-value">
                {vi.labels.healthStatus[overview.data.health.status] ?? overview.data.health.status}
              </strong>
              <span className="tkv-tile-meta">
                {overview.data.health.checks.length} hạng mục kiểm tra trực tiếp
              </span>
            </div>

            <div className="tkv-status-tile is-saffron">
              <span className="tkv-tile-label">Sự cố & cảnh báo</span>
              <strong className="tkv-tile-value">
                {overview.data.incidents.length === 0
                  ? 'Không có cảnh báo'
                  : `${overview.data.incidents.length} mục cần xem`}
              </strong>
              <span className="tkv-tile-meta">Nguồn: nhật ký vận hành máy chủ</span>
            </div>

            <div className="tkv-status-tile is-sky">
              <span className="tkv-tile-label">Chỉ số thu thập ({range})</span>
              <strong className="tkv-tile-value">{overview.data.metrics.length} nhóm chỉ số</strong>
              <span className="tkv-tile-meta">Không suy diễn số liệu ngoài API</span>
            </div>
          </section>

          {/* Real Server Metrics Grid (Zero fabricated numbers) */}
          <section aria-labelledby="tkv-admin-metrics-heading" className="tkv-admin-card">
            <div className="tkv-admin-card-head">
              <h2 id="tkv-admin-metrics-heading">{vi.overview.metrics}</h2>
              <span className="muted small">Dữ liệu xác thực theo quyền RBAC</span>
            </div>
            <div className="tkv-admin-kpi-grid">
              {overview.data.metrics.map((metric) => (
                <div key={metric.key} className="tkv-admin-kpi-item">
                  <span className="tkv-kpi-label">{metric.label}</span>
                  <strong className="tkv-kpi-number">
                    {metric.value === null || metric.value === undefined
                      ? 'Chưa có dữ liệu'
                      : new Intl.NumberFormat('vi-VN').format(metric.value)}
                  </strong>
                  {metric.note ? <span className="tkv-kpi-note">{metric.note}</span> : null}
                </div>
              ))}
            </div>
          </section>

          {/* Operational Summary Table/Rows matching AD02.png ("Tổng quan vận hành") + Health & Incidents */}
          <div className="tkv-admin-two-col">
            <section className="tkv-admin-card" aria-labelledby="tkv-admin-ops-heading">
              <div className="tkv-admin-card-head">
                <h2 id="tkv-admin-ops-heading">Tổng quan vận hành & điều hướng nhanh</h2>
              </div>
              <ul className="tkv-admin-ops-list">
                <li>
                  <div>
                    <strong>{vi.overview.health}</strong>
                    <p className="muted small">Kiểm tra cơ sở dữ liệu D1, hàng đợi và cấu hình môi trường</p>
                  </div>
                  <Link to="/system?vnext=1" className="tkv-ops-link">
                    Chi tiết ›
                  </Link>
                </li>
                <li>
                  <div>
                    <strong>Nhật ký kiểm toán bất biến (AD10)</strong>
                    <p className="muted small">Đối chiếu tác nhân quản trị và lịch sử thay đổi quyền</p>
                  </div>
                  <Link to="/audit?vnext=1" className="tkv-ops-link">
                    Chi tiết ›
                  </Link>
                </li>
                <li>
                  <div>
                    <strong>Vận hành AI & Quét ảnh (AD07)</strong>
                    <p className="muted small">Theo dõi trạng thái hàng đợi nhận diện không lộ PII</p>
                  </div>
                  <Link to="/ai?vnext=1" className="tkv-ops-link">
                    Chi tiết ›
                  </Link>
                </li>
              </ul>

              <div className="tkv-admin-health-wrap">
                <HealthCheckList checks={overview.data.health.checks} />
              </div>
            </section>

            <section className="tkv-admin-card" aria-labelledby="tkv-admin-inc-heading">
              <div className="tkv-admin-card-head">
                <h2 id="tkv-admin-inc-heading">{vi.overview.incidents}</h2>
              </div>
              {overview.data.incidents.length === 0 ? (
                <p className="muted">{vi.overview.noIncidents}</p>
              ) : (
                <ul className="incident-list">
                  {overview.data.incidents.map((incident) => (
                    <li key={incident.id} className="incident-item">
                      <Badge tone={SEVERITY_TONE[incident.severity] ?? 'neutral'}>
                        {vi.labels.severity[incident.severity] ?? incident.severity}
                      </Badge>
                      <div>
                        <strong>{incident.title}</strong>
                        <p className="muted">
                          {incident.source} · {formatDateTime(incident.occurredAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="tkv-admin-card" aria-labelledby="tkv-admin-series-heading">
            <div className="tkv-admin-card-head">
              <h2 id="tkv-admin-series-heading">{vi.overview.series}</h2>
            </div>
            {overview.data.series.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="chart-grid">
                {overview.data.series.map((series) => (
                  <div key={series.key} className="chart-card">
                    <h3>{series.label}</h3>
                    <SeriesChart series={series} variant="bar" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
