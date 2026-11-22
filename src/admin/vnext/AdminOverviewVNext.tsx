import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useOverview } from '../api/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import { SeriesChart } from '../components/SeriesChart';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricStatusBadge,
  RangeSelect,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatByUnit, formatDateTime, formatNumber } from '../lib/format';
import { useRangeParam } from '../lib/hooks';
import './admin-vnext.css';

const SEVERITY_TONE: Record<string, Tone> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

const HEALTH_TONE: Record<string, Tone> = {
  ok: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
};

export function AdminOverviewVNext() {
  const [range, setRange] = useRangeParam();
  const overview = useOverview(range);

  const actionQueue = overview.data?.actionQueue ?? {
    pendingReconciliations: 0,
    failedScanJobs: 0,
    unverifiedRecipes: 0,
    suspendedUsers: 0,
    pendingApprovals: 0,
  };

  const queueItems = [
    {
      key: 'pendingReconciliations',
      count: actionQueue.pendingReconciliations,
      label: vi.overview.actionQueue.items.pendingReconciliations.label,
      cta: vi.overview.actionQueue.items.pendingReconciliations.cta,
      to: '/billing',
    },
    {
      key: 'failedScanJobs',
      count: actionQueue.failedScanJobs,
      label: vi.overview.actionQueue.items.failedScanJobs.label,
      cta: vi.overview.actionQueue.items.failedScanJobs.cta,
      to: '/ai',
    },
    {
      key: 'unverifiedRecipes',
      count: actionQueue.unverifiedRecipes,
      label: vi.overview.actionQueue.items.unverifiedRecipes.label,
      cta: vi.overview.actionQueue.items.unverifiedRecipes.cta,
      to: '/recipes',
    },
    {
      key: 'suspendedUsers',
      count: actionQueue.suspendedUsers,
      label: vi.overview.actionQueue.items.suspendedUsers.label,
      cta: vi.overview.actionQueue.items.suspendedUsers.cta,
      to: '/users?accountStatus=suspended',
    },
    {
      key: 'pendingApprovals',
      count: actionQueue.pendingApprovals,
      label: vi.overview.actionQueue.items.pendingApprovals.label,
      cta: vi.overview.actionQueue.items.pendingApprovals.cta,
      to: '/settings',
    },
  ] as const;

  return (
    <div className="tkv-admin-pilot" data-testid="ad02-vnext-overview">
      <div className="tkv-admin-header">
        <div>
          <h1 className="tkv-admin-title" data-testid="admin-page-title">
            {vi.overview.title}
          </h1>
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
          <section
            aria-labelledby="tkv-admin-queue-heading"
            className="tkv-admin-card"
            data-testid="admin-action-queue"
          >
            <div className="tkv-admin-card-head">
              <div>
                <h2 id="tkv-admin-queue-heading">{vi.overview.actionQueue.title}</h2>
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  {vi.overview.actionQueue.description}
                </p>
              </div>
            </div>
            <div className="action-queue-grid">
              {queueItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  className={clsx('action-queue-card', item.count > 0 && 'has-items')}
                  data-testid={`admin-action-queue-${item.key}`}
                >
                  <div>
                    <div className="action-queue-count">{formatNumber(item.count)}</div>
                    <div className="action-queue-label">{item.label}</div>
                  </div>
                  <span className="action-queue-cta">{item.cta} →</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="tkv-admin-metrics-heading" className="tkv-admin-card">
            <div className="tkv-admin-card-head">
              <h2 id="tkv-admin-metrics-heading">{vi.overview.metrics}</h2>
            </div>
            <div className="tkv-admin-kpi-grid">
              {overview.data.metrics.map((metric) => (
                <div key={metric.key} className="tkv-admin-kpi-item" data-testid={`admin-metric-${metric.key}`}>
                  <div className="metric-head">
                    <span className="tkv-kpi-label">{metric.label}</span>
                    <MetricStatusBadge status={metric.status} />
                  </div>
                  <strong className="tkv-kpi-number">
                    {metric.value === null || metric.value === undefined
                      ? vi.common.notAvailable
                      : formatByUnit(metric.value, metric.unit)}
                  </strong>
                  {metric.note ? <span className="tkv-kpi-note">{metric.note}</span> : null}
                </div>
              ))}
            </div>
          </section>

          <div className="tkv-admin-two-col">
            <section className="tkv-admin-card" aria-labelledby="tkv-admin-ops-heading">
              <div className="tkv-admin-card-head">
                <h2 id="tkv-admin-ops-heading">{vi.overview.health}</h2>
                <Badge tone={HEALTH_TONE[overview.data.health.status] ?? 'neutral'}>
                  {vi.labels.healthStatus[overview.data.health.status] ?? overview.data.health.status}
                </Badge>
              </div>
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
