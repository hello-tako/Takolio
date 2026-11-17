import { useState } from 'react';
import { useAiSummary, useAiUsage } from '../api/hooks';
import { useDebouncedValue, useRangeParam } from '../lib/hooks';
import { KeyCountList } from '../components/KeyCountList';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, Pagination, RangeSelect, Section, StatTile, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber, formatUsd } from '../lib/format';

const PAGE_SIZE = 25;

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'success' || s === 'completed') return 'success';
  if (s === 'pending' || s === 'queued' || s === 'running') return 'warning';
  if (s === 'error' || s === 'failed') return 'danger';
  return 'neutral';
}

export function AiPage() {
  const [range, setRange] = useRangeParam();
  const summary = useAiSummary(range);
  const [taskInput, setTaskInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const task = useDebouncedValue(taskInput.trim(), 300);
  const status = useDebouncedValue(statusInput.trim(), 300);
  const [page, setPage] = useState(1);
  const usage = useAiUsage({ task: task || undefined, status: status || undefined, page, pageSize: PAGE_SIZE });
  const data = summary.data;
  const isWired = data?.instrumentation.aiRequestsWriter === 'wired';

  return (
    <>
      <PageHeader
        eyebrow={vi.ai.eyebrow}
        title={vi.ai.title}
        description={vi.ai.description}
        actions={
          <>
            {data ? (
              <Badge tone={isWired ? 'success' : 'warning'}>
                {isWired ? vi.ai.instrumentationWiredBadge : vi.ai.instrumentationUnwiredBadge}
              </Badge>
            ) : null}
            <RangeSelect value={range} onChange={setRange} />
          </>
        }
      />

      {data ? (
        data.instrumentation.aiRequestsWriter === 'not_wired' ? (
          <Notice tone="warning" title={vi.ai.instrumentationTitle} testId="admin-ai-instrumentation-warning">
            <p>{vi.ai.instrumentationBody}</p>
            {data.instrumentation.note ? <p className="small">{data.instrumentation.note}</p> : null}
          </Notice>
        ) : (
          <Notice tone="success" title={vi.ai.instrumentationWiredTitle}>
            <p>{vi.ai.instrumentationWiredBody}</p>
            {data.instrumentation.note ? <p className="small">{data.instrumentation.note}</p> : null}
          </Notice>
        )
      ) : null}

      {summary.isPending ? <LoadingState rows={4} /> : null}
      {summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}
      {data ? (
        <Section title={vi.ai.summary} testId="admin-ai-summary">
          <div
            className={summary.isPlaceholderData ? 'metric-grid is-stale' : 'metric-grid'}
            aria-busy={summary.isPlaceholderData || undefined}
          >
            {data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>

          <h3 className="subsection-title">{vi.ai.byTask}</h3>
          {data.byTask.length === 0 ? (
            <div className="card-inset" style={{ marginBottom: '12px' }}>
              <span className="muted">{vi.ai.noRows}</span>
            </div>
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.ai.byTask}>
              <table className="data-table">
                <caption className="sr-only">{vi.ai.byTask}</caption>
                <thead>
                  <tr>
                    <th scope="col">{vi.ai.byTaskColumns.task}</th>
                    <th scope="col">{vi.ai.byTaskColumns.requests}</th>
                    <th scope="col">{vi.ai.byTaskColumns.errors}</th>
                    <th scope="col">{vi.ai.byTaskColumns.latency}</th>
                    <th scope="col">{vi.ai.byTaskColumns.cost}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byTask.map((row) => {
                    const errRate = row.requests > 0 ? ((row.errors / row.requests) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={row.task}>
                        <td className="mono">{row.task}</td>
                        <td>{formatNumber(row.requests)}</td>
                        <td>
                          {formatNumber(row.errors)}{' '}
                          <Badge tone={row.errors > 0 ? 'danger' : 'success'}>{errRate}%</Badge>
                        </td>
                        <td>{row.avgLatencyMs === null ? vi.common.dash : `${formatNumber(row.avgLatencyMs)} ms`}</td>
                        <td>{formatUsd(row.estimatedCostUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="subsection-title">{vi.ai.byModel}</h3>
          {data.byModel.length === 0 ? (
            <div className="card-inset" style={{ marginBottom: '12px' }}>
              <span className="muted">{vi.ai.noRows}</span>
            </div>
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.ai.byModel}>
              <table className="data-table">
                <caption className="sr-only">{vi.ai.byModel}</caption>
                <thead>
                  <tr>
                    <th scope="col">{vi.ai.byModelColumns.provider}</th>
                    <th scope="col">{vi.ai.byModelColumns.model}</th>
                    <th scope="col">{vi.ai.byModelColumns.requests}</th>
                    <th scope="col">{vi.ai.byModelColumns.input}</th>
                    <th scope="col">{vi.ai.byModelColumns.output}</th>
                    <th scope="col">{vi.ai.byModelColumns.cost}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byModel.map((row) => (
                    <tr key={`${row.provider}/${row.model}`}>
                      <td>
                        <Badge tone="brand">{row.provider}</Badge>
                      </td>
                      <td className="mono">{row.model}</td>
                      <td>{formatNumber(row.requests)}</td>
                      <td>{formatNumber(row.inputTokens)}</td>
                      <td>{formatNumber(row.outputTokens)}</td>
                      <td>{formatUsd(row.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="two-col" style={{ marginTop: '14px' }}>
            <div className="card-inset">
              <h3>{vi.ai.ocr}</h3>
              <div className="stat-strip">
                <StatTile label={vi.ai.retriedLabel} value={formatNumber(data.ocr.retriedJobs)} />
                <StatTile label={vi.ai.exhaustedLabel} value={formatNumber(data.ocr.exhaustedJobs)} />
              </div>
              <h4>{vi.ai.scansByStatus}</h4>
              <KeyCountList items={data.ocr.scansByStatus.map((row) => ({ key: row.status, count: row.count }))} />
              <h4 style={{ marginTop: '10px' }}>{vi.ai.jobsByStatus}</h4>
              <KeyCountList items={data.ocr.jobsByStatus.map((row) => ({ key: row.status, count: row.count }))} />
            </div>

            <div className="card-inset">
              <h3>{vi.ai.queue}</h3>
              <h4>{vi.ai.localQueue}</h4>
              <KeyCountList items={data.queue.localJobStatus.map((row) => ({ key: row.status, count: row.count }))} />
              <h4 style={{ marginTop: '10px' }}>{vi.ai.remoteQueue}</h4>
              <Notice tone="info">
                <Badge tone="neutral">{vi.common.notAvailable}</Badge> {data.queue.remoteBacklog.note}
              </Notice>
            </div>
          </div>

          {data.series.length > 0 ? (
            <div className="chart-grid">
              {data.series.map((series) => (
                <div key={series.key} className="chart-card">
                  <h4>{series.label}</h4>
                  <SeriesChart series={series} variant="line" />
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title={vi.ai.usage}>
        <div className="toolbar">
          <Field label={vi.ai.taskFilter} htmlFor="admin-ai-task-filter">
            <input
              id="admin-ai-task-filter"
              data-testid="admin-ai-task-filter"
              type="search"
              placeholder={vi.ai.taskPlaceholder}
              maxLength={64}
              value={taskInput}
              onChange={(event) => {
                setTaskInput(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label={vi.ai.statusFilter} htmlFor="admin-ai-status-filter">
            <input
              id="admin-ai-status-filter"
              data-testid="admin-ai-status-filter"
              type="search"
              placeholder={vi.ai.statusPlaceholder}
              maxLength={32}
              value={statusInput}
              onChange={(event) => {
                setStatusInput(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          {taskInput || statusInput ? (
            <div className="toolbar-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setTaskInput('');
                  setStatusInput('');
                  setPage(1);
                }}
              >
                {vi.common.clearFilters}
              </Button>
            </div>
          ) : null}
        </div>

        {usage.isPending ? <LoadingState rows={4} /> : null}
        {usage.isError ? <ErrorState error={usage.error} onRetry={() => void usage.refetch()} /> : null}
        {usage.data && usage.data.items.length === 0 ? <EmptyState /> : null}
        {usage.data && usage.data.items.length > 0 ? (
          <div
            className={usage.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={usage.isPlaceholderData || undefined}
            tabIndex={0}
            role="region"
            aria-label={vi.ai.usageCaption}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.ai.usageCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.ai.usageColumns.time}</th>
                  <th scope="col">{vi.ai.usageColumns.task}</th>
                  <th scope="col">{vi.ai.usageColumns.model}</th>
                  <th scope="col">{vi.ai.usageColumns.tokens}</th>
                  <th scope="col">{vi.ai.usageColumns.latency}</th>
                  <th scope="col">{vi.ai.usageColumns.cost}</th>
                  <th scope="col">{vi.ai.usageColumns.status}</th>
                </tr>
              </thead>
              <tbody>
                {usage.data.items.map((row) => (
                  <tr key={row.id} data-testid="admin-ai-usage-row">
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td className="mono">{row.task}</td>
                    <td>
                      <strong>{row.provider}</strong> / <span className="mono">{row.model}</span>
                    </td>
                    <td>
                      {formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}
                    </td>
                    <td>{formatNumber(row.latencyMs)} ms</td>
                    <td>{formatUsd(row.estimatedCostUsd)}</td>
                    <td>
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {usage.data ? (
          <Pagination page={usage.data.page} pageSize={usage.data.pageSize} total={usage.data.total} onPageChange={setPage} />
        ) : null}
      </Section>
    </>
  );
}
