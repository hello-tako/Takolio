import { useSystemStatus } from '../api/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import { Badge, Button, DefinitionList, ErrorState, LoadingState, Notice, PageHeader, Section, StatTile } from '../components/ui';
import { vi } from '../i18n/vi';

export function SystemPage() {
  const status = useSystemStatus();
  const data = status.data;
  const schemaPassed = data ? data.database.schemaChecks.filter((c) => c.present).length : 0;
  const schemaTotal = data ? data.database.schemaChecks.length : 0;

  return (
    <>
      <PageHeader
        eyebrow={vi.system.eyebrow}
        title={vi.system.title}
        description={vi.system.description}
        actions={
          <Button variant="secondary" onClick={() => void status.refetch()} disabled={status.isFetching}>
            {status.isFetching ? vi.common.updating : vi.common.refresh}
          </Button>
        }
      />

      {status.isPending ? <LoadingState rows={5} /> : null}
      {status.isError ? <ErrorState error={status.error} onRetry={() => void status.refetch()} /> : null}
      {data ? (
        <>
          <div className="stat-strip">
            <StatTile label={vi.common.environment} value={data.release.environment.toUpperCase()} />
            <StatTile
              label={vi.system.commit}
              value={<span className="mono">{data.release.gitCommit ? data.release.gitCommit.slice(0, 12) : vi.common.notSet}</span>}
            />
            <StatTile label={vi.system.rbacVersion} value={<span className="mono">{data.release.rbacMatrixVersion}</span>} />
            <StatTile
              label={vi.system.reachable}
              value={
                <Badge tone={data.database.reachable ? 'success' : 'danger'}>
                  {data.database.reachable ? vi.labels.yes : vi.labels.no}
                </Badge>
              }
              sub={vi.system.schemaPassCount(schemaPassed, schemaTotal)}
            />
          </div>

          <Section title={vi.system.checks}>
            <HealthCheckList checks={data.checks} itemTestId="admin-system-check" />
          </Section>

          <div className="two-col">
            <Section title={vi.system.release}>
              <DefinitionList
                items={[
                  {
                    label: vi.system.commit,
                    value: <span className="mono">{data.release.gitCommit ?? vi.common.notSet}</span>,
                  },
                  { label: vi.common.environment, value: <Badge tone="brand">{data.release.environment}</Badge> },
                  {
                    label: vi.system.rbacVersion,
                    value: <span className="mono">{data.release.rbacMatrixVersion}</span>,
                  },
                  {
                    label: vi.system.securityPosture,
                    value: <span className="mono small">{vi.system.securityPostureValue}</span>,
                  },
                ]}
              />
            </Section>

            <Section
              title={vi.system.database}
              actions={
                <Badge tone={schemaPassed === schemaTotal ? 'success' : 'danger'}>
                  {vi.system.schemaPassCount(schemaPassed, schemaTotal)}
                </Badge>
              }
            >
              <p>
                {vi.system.reachable}:{' '}
                <Badge tone={data.database.reachable ? 'success' : 'danger'}>
                  {data.database.reachable ? vi.labels.yes : vi.labels.no}
                </Badge>
              </p>
              <h3 className="subsection-title">{vi.system.schema}</h3>
              <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.system.schema}>
                <table className="data-table">
                  <caption className="sr-only">{vi.system.schema}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{vi.system.objectColumn}</th>
                      <th scope="col">{vi.system.presentColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.database.schemaChecks.map((check) => (
                      <tr key={check.object}>
                        <td className="mono">{check.object}</td>
                        <td>
                          <Badge tone={check.present ? 'success' : 'danger'}>
                            {check.present ? vi.labels.yes : vi.labels.no}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="two-col">
            <Section title={vi.system.flags}>
              <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.system.flags}>
                <table className="data-table">
                  <caption className="sr-only">{vi.system.flags}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{vi.system.flagKey}</th>
                      <th scope="col">{vi.system.flagValue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.featureFlags.map((flag) => (
                      <tr key={flag.key}>
                        <td className="mono">{flag.key}</td>
                        <td>
                          {flag.value !== null ? (
                            <span className="mono">{flag.value}</span>
                          ) : (
                            <Badge tone="neutral">{vi.common.notSet}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={vi.system.warnings}>
              {data.warnings.length === 0 ? (
                <div className="card-inset">
                  <Badge tone="success">{vi.labels.healthStatus.ok}</Badge>{' '}
                  <span className="muted">{vi.system.noWarnings}</span>
                </div>
              ) : (
                data.warnings.map((warning) => (
                  <Notice key={warning.code} tone="warning" title={warning.code}>
                    {warning.message}
                  </Notice>
                ))
              )}
            </Section>
          </div>

          <Section title={vi.system.remote} description={vi.system.remoteNote}>
            <ul className="check-list">
              {data.remoteAdapters.map((adapter) => (
                <li key={adapter.key} className="check-item">
                  <div className="check-head">
                    <strong>{adapter.label}</strong>
                    <Badge tone="neutral">{vi.common.notAvailable}</Badge>
                  </div>
                  <p className="muted small" style={{ marginTop: '4px' }}>
                    {adapter.note}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
    </>
  );
}
