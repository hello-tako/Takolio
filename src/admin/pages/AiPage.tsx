import { useState } from 'react';
import { useAiSummary, useAiUsage } from '../api/hooks';
import { useRangeParam } from '../lib/hooks';
import { KeyCountList } from '../components/KeyCountList';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import { Badge, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, Pagination, RangeSelect, Section } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber, formatUsd } from '../lib/format';
import { useDebouncedValue } from '../lib/hooks';

const PAGE_SIZE = 25;

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

  return (
    <>
      <PageHeader title={vi.ai.title} description={vi.ai.description} actions={<RangeSelect value={range} onChange={setRange} />} />

      {data && data.instrumentation.aiRequestsWriter === 'not_wired' ? (
        <Notice tone="warning" title={vi.ai.instrumentationTitle} testId="admin-ai-instrumentation-warning">
          <p>{vi.ai.instrumentationBody}</p>
          {data.instrumentation.note ? <p>{data.instrumentation.note}</p> : null}
        </Notice>
      ) : null}

      {summary.isPending ? <LoadingState rows={4} /> : null}
      {summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}
      {data ? (
        <Section title={vi.ai.summary} testId="admin-ai-summary">
          <div className={summary.isPlaceholderData ? 'metric-grid is-stale' : 'metric-grid'}>
            {data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>

          <h3>{vi.ai.byTask}</h3>
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
                {data.byTask.map((row) => (
                  <tr key={row.task}>
                    <td className="mono">{row.task}</td>
                    <td>{formatNumber(row.requests)}</td>
                    <td>{formatNumber(row.errors)}</td>
                    <td>{row.avgLatencyMs === null ? vi.common.dash : `${formatNumber(row.avgLatencyMs)} ms`}</td>
                    <td>{formatUsd(row.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{vi.ai.byModel}</h3>
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
                    <td>{row.provider}</td>
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

          <div className="two-col">
            <div className="card-inset">
              <h3>{vi.ai.ocr}</h3>
              <h4>{vi.ai.scansByStatus}</h4>
              <KeyCountList items={data.ocr.scansByStatus.map((row) => ({ key: row.status, count: row.count }))} />
              <h4>{vi.ai.jobsByStatus}</h4>
              <KeyCountList items={data.ocr.jobsByStatus.map((row) => ({ key: row.status, count: row.count }))} />
              <p>
                Retry: <strong>{formatNumber(data.ocr.retriedJobs)}</strong> · Hết lượt retry:{' '}
                <strong>{formatNumber(data.ocr.exhaustedJobs)}</strong>
              </p>
            </div>
            <div className="card-inset">
              <h3>{vi.ai.queue}</h3>
              <h4>{vi.ai.localQueue}</h4>
              <KeyCountList items={data.queue.localJobStatus.map((row) => ({ key: row.status, count: row.count }))} />
              <h4>{vi.ai.remoteQueue}</h4>
              <Notice tone="info">
                <Badge tone="neutral">{vi.common.notAvailable}</Badge> {data.queue.remoteBacklog.note}
              </Notice>
            </div>
          </div>

          <div className="chart-grid">
            {data.series.map((series) => (
              <div key={series.key} className="chart-card">
                <h4>{series.label}</h4>
                <SeriesChart series={series} variant="line" />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={vi.ai.usage}>
        <div className="toolbar">
          <Field label={vi.ai.taskFilter} htmlFor="admin-ai-task-filter">
            <input
              id="admin-ai-task-filter"
              data-testid="admin-ai-task-filter"
              type="search"
              maxLength={100}
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
              maxLength={100}
              value={statusInput}
              onChange={(event) => {
                setStatusInput(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        {usage.isPending ? <LoadingState rows={4} /> : null}
        {usage.isError ? <ErrorState error={usage.error} onRetry={() => void usage.refetch()} /> : null}
        {usage.data && usage.data.items.length === 0 ? <EmptyState /> : null}
        {usage.data && usage.data.items.length > 0 ? (
          <div className={usage.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'} aria-busy={usage.isPlaceholderData} tabIndex={0} role="region" aria-label={vi.ai.usageCaption}>
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
                      {row.provider} / <span className="mono">{row.model}</span>
                    </td>
                    <td>
                      {formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}
                    </td>
                    <td>{formatNumber(row.latencyMs)} ms</td>
                    <td>{formatUsd(row.estimatedCostUsd)}</td>
                    <td>{row.status}</td>
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
