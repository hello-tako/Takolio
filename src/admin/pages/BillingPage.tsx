import { useState } from 'react';
import { useBillingSummary, useTransactions } from '../api/hooks';
import { useRangeParam } from '../lib/hooks';
import { KeyCountList } from '../components/KeyCountList';
import { MetricCard } from '../components/MetricCard';
import { SeriesChart } from '../components/SeriesChart';
import { Badge, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, Pagination, RangeSelect, Section, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber, formatVnd } from '../lib/format';

const PAYMENT_TONE: Record<string, Tone> = { paid: 'success', pending: 'warning', failed: 'danger', expired: 'neutral', refunded: 'info' };
const PAGE_SIZE = 25;
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'expired', 'refunded'] as const;

function paymentLabel(status: string): string {
  return (vi.labels.paymentStatus as Record<string, string>)[status] ?? status;
}

export function BillingPage() {
  const [range, setRange] = useRangeParam();
  const summary = useBillingSummary(range);
  const [status, setStatus] = useState<'' | (typeof PAYMENT_STATUSES)[number]>('');
  const [page, setPage] = useState(1);
  const transactions = useTransactions({ status: status || undefined, page, pageSize: PAGE_SIZE });
  const data = summary.data;

  return (
    <>
      <PageHeader title={vi.billing.title} description={vi.billing.description} actions={<RangeSelect value={range} onChange={setRange} />} />
      <Notice tone="info" testId="admin-billing-readonly">
        {vi.billing.readOnly}
      </Notice>

      {summary.isPending ? <LoadingState rows={4} /> : null}
      {summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}
      {data ? (
        <Section title={vi.billing.summary} testId="admin-billing-summary">
          <div className={summary.isPlaceholderData ? 'metric-grid is-stale' : 'metric-grid'}>
            {data.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
          <div className="two-col">
            <div>
              <h3>{vi.billing.statusBreakdown}</h3>
              <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.billing.statusBreakdown}>
                <table className="data-table">
                  <caption className="sr-only">{vi.billing.statusBreakdown}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{vi.billing.statusColumns.status}</th>
                      <th scope="col">{vi.billing.statusColumns.count}</th>
                      <th scope="col">{vi.billing.statusColumns.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.statusBreakdown.map((row) => (
                      <tr key={row.status}>
                        <td>
                          <Badge tone={PAYMENT_TONE[row.status] ?? 'neutral'}>{paymentLabel(row.status)}</Badge>
                        </td>
                        <td>{formatNumber(row.count)}</td>
                        <td>{formatVnd(row.amountVnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>{vi.billing.checkoutStates}</h3>
              <KeyCountList
                items={data.checkoutStates.map((row) => ({ key: row.state, count: row.count }))}
                labelOf={(key) => vi.labels.checkoutState[key] ?? key}
              />
            </div>
          </div>

          <Notice tone="warning" title={vi.billing.providerTitle} testId="admin-billing-provider">
            <p>{data.providerReconciliation.note || vi.billing.providerBody}</p>
            <Badge tone="neutral">{vi.common.notAvailable}</Badge>
          </Notice>

          <h3>{vi.billing.exceptions}</h3>
          {data.reconciliationExceptions.length === 0 ? (
            <p className="muted">{vi.billing.exceptionsEmpty}</p>
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.billing.exceptions}>
              <table className="data-table">
                <caption className="sr-only">{vi.billing.exceptions}</caption>
                <thead>
                  <tr>
                    <th scope="col">{vi.billing.exceptionColumns.intent}</th>
                    <th scope="col">{vi.billing.exceptionColumns.reason}</th>
                    <th scope="col">{vi.billing.exceptionColumns.first}</th>
                    <th scope="col">{vi.billing.exceptionColumns.last}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reconciliationExceptions.map((row) => (
                    <tr key={row.intentId}>
                      <td className="mono">{row.intentId}</td>
                      <td>{row.reason}</td>
                      <td>{formatDateTime(row.firstObservedAt)}</td>
                      <td>{formatDateTime(row.lastObservedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3>{vi.billing.revenue}</h3>
          <div className="chart-grid">
            {data.series.map((series) => (
              <div key={series.key} className="chart-card">
                <h4>{series.label}</h4>
                <SeriesChart series={series} variant="bar" />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={vi.billing.transactions}>
        <div className="toolbar">
          <Field label={vi.billing.statusFilter} htmlFor="admin-billing-status-filter">
            <select
              id="admin-billing-status-filter"
              data-testid="admin-billing-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
            >
              <option value="">{vi.common.all}</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {paymentLabel(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {transactions.isPending ? <LoadingState rows={4} /> : null}
        {transactions.isError ? <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} /> : null}
        {transactions.data && transactions.data.items.length === 0 ? <EmptyState /> : null}
        {transactions.data && transactions.data.items.length > 0 ? (
          <div className={transactions.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'} aria-busy={transactions.isPlaceholderData} tabIndex={0} role="region" aria-label={vi.billing.transactionsCaption}>
            <table className="data-table">
              <caption className="sr-only">{vi.billing.transactionsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.billing.transactionColumns.orderCode}</th>
                  <th scope="col">{vi.billing.transactionColumns.user}</th>
                  <th scope="col">{vi.billing.transactionColumns.plan}</th>
                  <th scope="col">{vi.billing.transactionColumns.amount}</th>
                  <th scope="col">{vi.billing.transactionColumns.status}</th>
                  <th scope="col">{vi.billing.transactionColumns.reconciliation}</th>
                  <th scope="col">{vi.billing.transactionColumns.created}</th>
                  <th scope="col">{vi.billing.transactionColumns.expires}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.data.items.map((row) => (
                  <tr key={row.id} data-testid="admin-transaction-row">
                    <td className="mono">{row.orderCodeMasked}</td>
                    <td className="mono">{row.userId}</td>
                    <td>{row.plan}</td>
                    <td>{formatVnd(row.amountVnd)}</td>
                    <td>
                      <Badge tone={PAYMENT_TONE[row.effectiveStatus] ?? 'neutral'}>{paymentLabel(row.effectiveStatus)}</Badge>
                    </td>
                    <td>{row.hasReconciliationRecord ? vi.billing.reconciled : vi.billing.notReconciled}</td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{formatDateTime(row.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {transactions.data ? (
          <Pagination page={transactions.data.page} pageSize={transactions.data.pageSize} total={transactions.data.total} onPageChange={setPage} />
        ) : null}
      </Section>
    </>
  );
}
