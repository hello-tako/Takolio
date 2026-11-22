import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdminScanJobRow } from '@shared/admin';
import {
  useAiSummary,
  useAiUsage,
  useCancelScanJob,
  useMe,
  useRetryScanJob,
  useScanJobs,
} from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { KeyCountList } from '../components/KeyCountList';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  LoadingState,
  Notice,
  PageHeader,
  Pagination,
  RangeSelect,
  Section,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber, formatUsd } from '../lib/format';
import { useDebouncedValue, useRangeParam } from '../lib/hooks';
import { hasPermission } from '../lib/nav';

const PAGE_SIZE = 25;
const SCAN_JOB_STATUSES = ['failed', 'pending', 'processing', 'ready'] as const;
const SCAN_TYPES = ['fridge', 'receipt'] as const;

const SCAN_JOB_TONE: Record<string, Tone> = {
  ready: 'success',
  pending: 'warning',
  processing: 'info',
  failed: 'danger',
};

function scanJobStatusLabel(status: string): string {
  return vi.labels.scanJobStatus[status] ?? status;
}

function scanTypeLabel(type: string): string {
  return vi.labels.scanType[type] ?? type;
}

export function AiPage() {
  const [range, setRange] = useRangeParam();
  const me = useMe();
  const canWrite = hasPermission(me.data?.permissions ?? [], 'ai.write');
  const summary = useAiSummary(range);

  const [scanStatus, setScanStatus] = useState<'' | (typeof SCAN_JOB_STATUSES)[number]>('');
  const [scanType, setScanType] = useState<'' | (typeof SCAN_TYPES)[number]>('');
  const [scanPage, setScanPage] = useState(1);
  const scanJobs = useScanJobs({
    status: scanStatus || undefined,
    scanType: scanType || undefined,
    page: scanPage,
    pageSize: PAGE_SIZE,
  });

  const retryJob = useRetryScanJob();
  const cancelJob = useCancelScanJob();
  const [jobAction, setJobAction] = useState<{ kind: 'retry' | 'cancel'; job: AdminScanJobRow } | null>(null);
  const [jobReason, setJobReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [taskInput, setTaskInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const task = useDebouncedValue(taskInput.trim(), 300);
  const status = useDebouncedValue(statusInput.trim(), 300);
  const [page, setPage] = useState(1);
  const usage = useAiUsage({ task: task || undefined, status: status || undefined, page, pageSize: PAGE_SIZE });

  const openJobAction = (kind: 'retry' | 'cancel', job: AdminScanJobRow) => {
    retryJob.reset();
    cancelJob.reset();
    setJobReason('');
    setJobAction({ kind, job });
  };

  const closeJobAction = () => setJobAction(null);

  const onConfirmJobAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobAction || jobReason.trim().length < 3) return;
    if (jobAction.kind === 'retry') {
      retryJob.mutate(
        { jobId: jobAction.job.id, reason: jobReason.trim() },
        {
          onSuccess: () => {
            setFeedback(vi.ai.scanJobs.retrySuccess);
            closeJobAction();
          },
        },
      );
    } else {
      cancelJob.mutate(
        { jobId: jobAction.job.id, reason: jobReason.trim() },
        {
          onSuccess: () => {
            setFeedback(vi.ai.scanJobs.cancelSuccess);
            closeJobAction();
          },
        },
      );
    }
  };

  const data = summary.data;

  return (
    <>
      <PageHeader
        title={vi.ai.title}
        description={vi.ai.description}
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      {feedback ? (
        <p className="form-success" role="status" data-testid="admin-ai-feedback">
          {feedback}
        </p>
      ) : null}

      {data && data.instrumentation.aiRequestsWriter === 'not_wired' ? (
        <Notice tone="warning" title={vi.ai.instrumentationTitle} testId="admin-ai-instrumentation-warning">
          <p>{vi.ai.instrumentationBody}</p>
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
              <KeyCountList
                items={data.ocr.scansByStatus.map((row) => ({ key: row.status, count: row.count }))}
                labelOf={scanJobStatusLabel}
              />
              <h4>{vi.ai.jobsByStatus}</h4>
              <KeyCountList
                items={data.ocr.jobsByStatus.map((row) => ({ key: row.status, count: row.count }))}
                labelOf={scanJobStatusLabel}
              />
              <p>
                Thử lại: <strong>{formatNumber(data.ocr.retriedJobs)}</strong> · Quá giới hạn thử lại:{' '}
                <strong>{formatNumber(data.ocr.exhaustedJobs)}</strong>
              </p>
            </div>
            <div className="card-inset">
              <h3>{vi.ai.queue}</h3>
              <h4>{vi.ai.localQueue}</h4>
              <KeyCountList
                items={data.queue.localJobStatus.map((row) => ({ key: row.status, count: row.count }))}
                labelOf={scanJobStatusLabel}
              />
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

      <Section title={vi.ai.scanJobs.title} description={vi.ai.scanJobs.description} testId="admin-scan-jobs">
        <div className="filter-chips" role="group" aria-label={vi.ai.scanJobs.statusFilter}>
          <button
            type="button"
            className={scanStatus === '' ? 'chip-btn is-active' : 'chip-btn'}
            aria-pressed={scanStatus === ''}
            onClick={() => {
              setScanStatus('');
              setScanPage(1);
            }}
          >
            {vi.common.all}
          </button>
          {SCAN_JOB_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className={scanStatus === value ? 'chip-btn is-active' : 'chip-btn'}
              aria-pressed={scanStatus === value}
              onClick={() => {
                setScanStatus(value);
                setScanPage(1);
              }}
            >
              {scanJobStatusLabel(value)}
            </button>
          ))}
        </div>

        <div className="toolbar toolbar-wrap">
          <Field label={vi.ai.scanJobs.scanTypeFilter} htmlFor="admin-scan-type-filter">
            <select
              id="admin-scan-type-filter"
              data-testid="admin-scan-type-filter"
              value={scanType}
              onChange={(event) => {
                setScanType(event.target.value as typeof scanType);
                setScanPage(1);
              }}
            >
              <option value="">{vi.ai.scanJobs.scanTypeAll}</option>
              {SCAN_TYPES.map((value) => (
                <option key={value} value={value}>
                  {scanTypeLabel(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {scanJobs.isPending ? <LoadingState rows={4} /> : null}
        {scanJobs.isError ? <ErrorState error={scanJobs.error} onRetry={() => void scanJobs.refetch()} /> : null}
        {scanJobs.data && scanJobs.data.items.length === 0 ? <EmptyState body={vi.ai.scanJobs.empty} /> : null}
        {scanJobs.data && scanJobs.data.items.length > 0 ? (
          <div
            className={scanJobs.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={scanJobs.isPlaceholderData}
            tabIndex={0}
            role="region"
            aria-label={vi.ai.scanJobs.caption}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.ai.scanJobs.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.ai.scanJobs.columns.id}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.user}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.scanType}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.status}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.attempts}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.error}</th>
                  <th scope="col">{vi.ai.scanJobs.columns.updated}</th>
                  {canWrite ? <th scope="col">{vi.ai.scanJobs.columns.action}</th> : null}
                </tr>
              </thead>
              <tbody>
                {scanJobs.data.items.map((job) => {
                  const canRetry = job.status !== 'ready';
                  const canCancel = job.status !== 'ready' && job.status !== 'failed';
                  return (
                    <tr key={job.id} data-testid="admin-scan-job-row">
                      <td className="mono">
                        <div>{job.id}</div>
                        <div className="muted small">{job.scanId}</div>
                      </td>
                      <td className="mono">
                        <Link to={`/users/${encodeURIComponent(job.userId)}`} className="row-link">
                          {job.userId}
                        </Link>
                      </td>
                      <td>{scanTypeLabel(job.scanType)}</td>
                      <td>
                        <Badge tone={SCAN_JOB_TONE[job.status] ?? 'neutral'}>{scanJobStatusLabel(job.status)}</Badge>
                      </td>
                      <td className="mono">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td>
                        {job.errorCode || job.errorMessage ? (
                          <div>
                            {job.errorCode ? <div className="mono">{job.errorCode}</div> : null}
                            {job.errorMessage ? <div className="muted small">{job.errorMessage}</div> : null}
                          </div>
                        ) : (
                          vi.common.dash
                        )}
                      </td>
                      <td>{formatDateTime(job.updatedAt)}</td>
                      {canWrite ? (
                        <td>
                          <div className="button-row">
                            {canRetry ? (
                              <Button
                                variant="primary"
                                className="btn-small"
                                data-testid="admin-scan-retry-btn"
                                onClick={() => openJobAction('retry', job)}
                              >
                                Chạy lại
                              </Button>
                            ) : null}
                            {canCancel ? (
                              <Button
                                variant="danger"
                                className="btn-small"
                                data-testid="admin-scan-cancel-btn"
                                onClick={() => openJobAction('cancel', job)}
                              >
                                Hủy &amp; Hoàn lượt
                              </Button>
                            ) : null}
                            {!canRetry && !canCancel ? vi.common.dash : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {scanJobs.data ? (
          <Pagination
            page={scanJobs.data.page}
            pageSize={scanJobs.data.pageSize}
            total={scanJobs.data.total}
            onPageChange={setScanPage}
          />
        ) : null}
      </Section>

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
          <div
            className={usage.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={usage.isPlaceholderData}
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
          <Pagination
            page={usage.data.page}
            pageSize={usage.data.pageSize}
            total={usage.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </Section>

      <Dialog
        open={jobAction !== null}
        title={jobAction?.kind === 'cancel' ? vi.ai.scanJobs.cancelTitle : vi.ai.scanJobs.retryTitle}
        onClose={closeJobAction}
        testId="admin-scan-action-dialog"
        footer={
          <>
            <Button onClick={closeJobAction}>{vi.common.cancel}</Button>
            <Button
              type="submit"
              form="admin-scan-action-form"
              variant={jobAction?.kind === 'cancel' ? 'danger' : 'primary'}
              data-testid="admin-scan-action-confirm"
              disabled={retryJob.isPending || cancelJob.isPending || jobReason.trim().length < 3}
            >
              {retryJob.isPending || cancelJob.isPending
                ? vi.common.processing
                : jobAction?.kind === 'cancel'
                  ? vi.ai.scanJobs.cancelConfirm
                  : vi.ai.scanJobs.retryConfirm}
            </Button>
          </>
        }
      >
        <form id="admin-scan-action-form" className="modal-form" onSubmit={onConfirmJobAction}>
          <p className="muted">
            {jobAction?.kind === 'cancel' ? vi.ai.scanJobs.cancelDescription : vi.ai.scanJobs.retryDescription}
          </p>
          <Field label={vi.ai.scanJobs.reasonLabel} htmlFor="admin-scan-action-reason">
            <textarea
              id="admin-scan-action-reason"
              data-testid="admin-scan-action-reason"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              placeholder={vi.ai.scanJobs.reasonPlaceholder}
              value={jobReason}
              onChange={(event) => setJobReason(event.target.value)}
            />
          </Field>
          <InlineError error={retryJob.error ?? cancelJob.error} />
        </form>
      </Dialog>
    </>
  );
}
