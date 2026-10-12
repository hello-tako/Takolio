import { useOverview } from '../api/hooks';
import { useRangeParam } from '../lib/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, RangeSelect, Section, type Tone } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { vi } from '../i18n/vi';

const SEVERITY_TONE: Record<string, Tone> = { info: 'info', warning: 'warning', critical: 'danger' };
const OVERALL_TONE: Record<string, Tone> = { ok: 'success', degraded: 'warning', unhealthy: 'danger' };

export function OverviewPage() {
  const [range, setRange] = useRangeParam();
  const overview = useOverview(range);

  return (
    <>
      <PageHeader
        title={vi.overview.title}
        description={vi.overview.description}
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      {overview.isPending ? <LoadingState rows={6} /> : null}
      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : null}
      {overview.data ? (
        <div className={overview.isPlaceholderData ? 'is-stale' : undefined} aria-busy={overview.isPlaceholderData}>
          <section aria-label={vi.overview.metrics} className="metric-grid">
            {overview.data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </section>

          <div className="two-col">
            <Section
              title={vi.overview.health}
              actions={<Badge tone={OVERALL_TONE[overview.data.health.status] ?? 'neutral'}>{vi.overview.healthBadge}: {vi.labels.healthStatus[overview.data.health.status] ?? overview.data.health.status}</Badge>}
            >
              <HealthCheckList checks={overview.data.health.checks} />
            </Section>
            <Section title={vi.overview.incidents}>
              {overview.data.incidents.length === 0 ? (
                <p className="muted">{vi.overview.noIncidents}</p>
              ) : (
                <ul className="incident-list">
                  {overview.data.incidents.map((incident) => (
                    <li key={incident.id} className="incident-item">
                      <Badge tone={SEVERITY_TONE[incident.severity] ?? 'neutral'}>{vi.labels.severity[incident.severity] ?? incident.severity}</Badge>
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
            </Section>
          </div>

          <Section title={vi.overview.series}>
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
          </Section>
        </div>
      ) : null}
    </>
  );
}
