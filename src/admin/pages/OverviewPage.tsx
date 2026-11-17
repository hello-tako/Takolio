import { Link } from 'react-router-dom';
import { useMe, useOverview } from '../api/hooks';
import { useRangeParam } from '../lib/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, RangeSelect, Section, type Tone } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { visibleNavItems } from '../lib/nav';
import { vi } from '../i18n/vi';

const SEVERITY_TONE: Record<string, Tone> = { info: 'info', warning: 'warning', critical: 'danger' };
const OVERALL_TONE: Record<string, Tone> = { ok: 'success', degraded: 'warning', unhealthy: 'danger' };

export function OverviewPage() {
  const [range, setRange] = useRangeParam();
  const overview = useOverview(range);
  const me = useMe();
  const quickLinks = visibleNavItems(me.data?.permissions ?? []).filter((item) => item.id !== 'overview');

  return (
    <>
      <PageHeader
        eyebrow={vi.overview.eyebrow}
        title={vi.overview.title}
        description={vi.overview.description}
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      {overview.isPending ? <LoadingState rows={6} /> : null}
      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : null}
      {overview.data ? (
        <div
          className={overview.isPlaceholderData ? 'is-stale' : undefined}
          aria-busy={overview.isPlaceholderData || undefined}
        >
          <section aria-labelledby="admin-overview-metrics" className="metric-grid">
            <h2 id="admin-overview-metrics" className="sr-only">
              {vi.overview.metrics}
            </h2>
            {overview.data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </section>

          {quickLinks.length > 0 ? (
            <Section title={vi.overview.quickActions} description={vi.overview.quickActionsDesc}>
              <div className="quick-actions-grid">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} to={item.to} className="quick-action-card">
                      <span className="quick-action-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span>{vi.layout.nav[item.id]}</span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <Section title={vi.overview.series} description={vi.overview.seriesDesc}>
            {overview.data.series.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="chart-grid">
                {overview.data.series.map((series, index) => (
                  <div key={series.key} className="chart-card">
                    <h3>{series.label}</h3>
                    <SeriesChart series={series} variant={index % 2 === 0 ? 'bar' : 'line'} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="two-col">
            <Section
              title={vi.overview.health}
              actions={
                <Badge tone={OVERALL_TONE[overview.data.health.status] ?? 'neutral'}>
                  {vi.overview.healthBadge}: {vi.labels.healthStatus[overview.data.health.status] ?? overview.data.health.status}
                </Badge>
              }
            >
              <HealthCheckList checks={overview.data.health.checks} />
            </Section>

            <Section title={vi.overview.incidents}>
              {overview.data.incidents.length === 0 ? (
                <div className="card-inset">
                  <strong>{vi.overview.noIncidents}</strong>
                  <p className="muted small" style={{ marginTop: '4px' }}>
                    {vi.overview.noIncidentsHint}
                  </p>
                </div>
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
                          <span className="mono">{incident.source}</span> · {formatDateTime(incident.occurredAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      ) : null}
    </>
  );
}
