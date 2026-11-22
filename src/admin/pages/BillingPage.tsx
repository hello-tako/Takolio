import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdminBillingResolveOutcome } from '@shared/admin';
import {
  useBillingSummary,
  useMarkBillingIntentPaid,
  useMe,
  useRefundBillingIntent,
  useResolveBillingIntent,
  useTransactions,
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
  PageHeader,
  Pagination,
  RangeSelect,
  Section,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber, formatVnd } from '../lib/format';
import { useDebouncedValue, useRangeParam } from '../lib/hooks';
import { hasPermission } from '../lib/nav';

const PAYMENT_TONE: Record<string, Tone> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  expired: 'neutral',
  refunded: 'info',
};
const PAGE_SIZE = 25;
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'expired', 'refunded'] as const;
const BILLING_PLANS = ['monthly', 'annual'] as const;

function paymentLabel(status: string): string {
  return (vi.labels.paymentStatus as Record<string, string>)[status] ?? status;
}

function planLabel(plan: string): string {
  return vi.labels.billingPlan[plan] ?? plan;
}

type ActiveModal =
  | { kind: 'mark_paid'; intentId: string }
  | { kind: 'resolve'; intentId: string }
  | { kind: 'refund'; intentId: string }
  | null;

export function BillingPage() {
  const [range, setRange] = useRangeParam();
  const me = useMe();
  const canWrite = hasPermission(me.data?.permissions ?? [], 'billing.write');
  const summary = useBillingSummary(range);

  const [status, setStatus] = useState<'' | (typeof PAYMENT_STATUSES)[number]>('');
  const [plan, setPlan] = useState<'' | (typeof BILLING_PLANS)[number]>('');
  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const transactions = useTransactions({
    status: status || undefined,
    plan: plan || undefined,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const markPaid = useMarkBillingIntentPaid();
  const resolveIntent = useResolveBillingIntent();
  const refundIntent = useRefundBillingIntent();

  const [modal, setModal] = useState<ActiveModal>(null);
  const [reason, setReason] = useState('');
  const [grantDays, setGrantDays] = useState('');
  const [resolveOutcome, setResolveOutcome] = useState<AdminBillingResolveOutcome>('expired');
  const [revokeSubscription, setRevokeSubscription] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const openMarkPaid = (intentId: string) => {
    markPaid.reset();
    setReason('');
    setGrantDays('');
    setModal({ kind: 'mark_paid', intentId });
  };

  const openResolve = (intentId: string) => {
    resolveIntent.reset();
    setReason('');
    setResolveOutcome('expired');
    setModal({ kind: 'resolve', intentId });
  };

  const openRefund = (intentId: string) => {
    refundIntent.reset();
    setReason('');
    setRevokeSubscription(true);
    setModal({ kind: 'refund', intentId });
  };

  const closeModal = () => setModal(null);

  const onMarkPaidSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal || modal.kind !== 'mark_paid' || reason.trim().length < 3) return;
    const parsedDays = grantDays.trim() ? Number(grantDays.trim()) : undefined;
    markPaid.mutate(
      {
        intentId: modal.intentId,
        reason: reason.trim(),
        grantDays: parsedDays && Number.isFinite(parsedDays) ? parsedDays : undefined,
      },
      {
        onSuccess: () => {
          setFeedback(vi.billing.actions.markPaidSuccess);
          closeModal();
        },
      },
    );
  };

  const onResolveSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal || modal.kind !== 'resolve' || reason.trim().length < 3) return;
    resolveIntent.mutate(
      {
        intentId: modal.intentId,
        outcome: resolveOutcome,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setFeedback(vi.billing.actions.resolveSuccess);
          closeModal();
        },
      },
    );
  };

  const onRefundSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal || modal.kind !== 'refund' || reason.trim().length < 3) return;
    refundIntent.mutate(
      {
        intentId: modal.intentId,
        revokeSubscription,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setFeedback(vi.billing.actions.refundSuccess);
          closeModal();
        },
      },
    );
  };

  const data = summary.data;

  return (
    <>
      <PageHeader
        title={vi.billing.title}
        description={vi.billing.description}
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      {feedback ? (
        <p className="form-success" role="status" data-testid="admin-billing-feedback">
          {feedback}
        </p>
      ) : null}

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
                    {canWrite ? <th scope="col">{vi.billing.transactionColumns.action}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {data.reconciliationExceptions.map((row) => (
                    <tr key={row.intentId} data-testid="admin-reconciliation-row">
                      <td className="mono">{row.intentId}</td>
                      <td>{row.reason}</td>
                      <td>{formatDateTime(row.firstObservedAt)}</td>
                      <td>{formatDateTime(row.lastObservedAt)}</td>
                      {canWrite ? (
                        <td>
                          <div className="button-row">
                            <Button
                              variant="primary"
                              className="btn-small"
                              data-testid="admin-tx-mark-paid"
                              onClick={() => openMarkPaid(row.intentId)}
                            >
                              Xác nhận &amp; Cấp Pro
                            </Button>
                            <Button
                              variant="secondary"
                              className="btn-small"
                              data-testid="admin-tx-resolve"
                              onClick={() => openResolve(row.intentId)}
                            >
                              Đóng lệnh treo
                            </Button>
                          </div>
                        </td>
                      ) : null}
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
        <div className="filter-chips" role="group" aria-label={vi.billing.statusFilter}>
          <button
            type="button"
            className={status === '' ? 'chip-btn is-active' : 'chip-btn'}
            aria-pressed={status === ''}
            onClick={() => {
              setStatus('');
              setPage(1);
            }}
          >
            {vi.common.all}
          </button>
          {PAYMENT_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className={status === value ? 'chip-btn is-active' : 'chip-btn'}
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {paymentLabel(value)}
            </button>
          ))}
        </div>

        <div className="toolbar toolbar-wrap">
          <Field label={vi.common.search} htmlFor="admin-billing-search">
            <input
              id="admin-billing-search"
              data-testid="admin-billing-search"
              type="search"
              maxLength={100}
              placeholder={vi.billing.searchPlaceholder}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value.slice(0, 100));
                setPage(1);
              }}
            />
          </Field>
          <Field label={vi.billing.planFilter} htmlFor="admin-billing-plan-filter">
            <select
              id="admin-billing-plan-filter"
              data-testid="admin-billing-plan-filter"
              value={plan}
              onChange={(event) => {
                setPlan(event.target.value as typeof plan);
                setPage(1);
              }}
            >
              <option value="">{vi.billing.planAll}</option>
              {BILLING_PLANS.map((value) => (
                <option key={value} value={value}>
                  {planLabel(value)}
                </option>
              ))}
            </select>
          </Field>
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
          <div
            className={transactions.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={transactions.isPlaceholderData}
            tabIndex={0}
            role="region"
            aria-label={vi.billing.transactionsCaption}
          >
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
                  {canWrite ? <th scope="col">{vi.billing.transactionColumns.action}</th> : null}
                </tr>
              </thead>
              <tbody>
                {transactions.data.items.map((row) => {
                  const canMarkPaid =
                    row.effectiveStatus === 'pending' ||
                    row.effectiveStatus === 'failed' ||
                    row.effectiveStatus === 'expired';
                  const canResolve = row.effectiveStatus === 'pending';
                  const canRefund = row.effectiveStatus === 'paid';
                  return (
                    <tr key={row.id} data-testid="admin-transaction-row">
                      <td className="mono">
                        <div>{row.orderCodeMasked}</div>
                        <div className="muted small">{row.id}</div>
                      </td>
                      <td className="mono">
                        <Link to={`/users/${encodeURIComponent(row.userId)}`} className="row-link">
                          {row.userId}
                        </Link>
                      </td>
                      <td>{planLabel(row.plan)}</td>
                      <td>{formatVnd(row.amountVnd)}</td>
                      <td>
                        <Badge tone={PAYMENT_TONE[row.effectiveStatus] ?? 'neutral'}>
                          {paymentLabel(row.effectiveStatus)}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={row.hasReconciliationRecord ? 'warning' : 'neutral'}>
                          {row.hasReconciliationRecord ? vi.billing.reconciled : vi.billing.notReconciled}
                        </Badge>
                      </td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{formatDateTime(row.expiresAt)}</td>
                      {canWrite ? (
                        <td>
                          <div className="button-row">
                            {canMarkPaid ? (
                              <Button
                                variant="primary"
                                className="btn-small"
                                data-testid="admin-tx-mark-paid"
                                onClick={() => openMarkPaid(row.id)}
                              >
                                Xác nhận &amp; Cấp Pro
                              </Button>
                            ) : null}
                            {canResolve ? (
                              <Button
                                variant="secondary"
                                className="btn-small"
                                data-testid="admin-tx-resolve"
                                onClick={() => openResolve(row.id)}
                              >
                                Đóng lệnh treo
                              </Button>
                            ) : null}
                            {canRefund ? (
                              <Button
                                variant="danger"
                                className="btn-small"
                                data-testid="admin-tx-refund"
                                onClick={() => openRefund(row.id)}
                              >
                                Hoàn tiền
                              </Button>
                            ) : null}
                            {!canMarkPaid && !canResolve && !canRefund ? vi.common.dash : null}
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
        {transactions.data ? (
          <Pagination
            page={transactions.data.page}
            pageSize={transactions.data.pageSize}
            total={transactions.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </Section>

      <Dialog
        open={modal?.kind === 'mark_paid'}
        title={vi.billing.actions.markPaidTitle}
        onClose={closeModal}
        testId="admin-billing-mark-paid-dialog"
        footer={
          <>
            <Button onClick={closeModal}>{vi.common.cancel}</Button>
            <Button
              type="submit"
              form="admin-billing-mark-paid-form"
              variant="primary"
              data-testid="admin-tx-mark-paid-confirm"
              disabled={markPaid.isPending || reason.trim().length < 3}
            >
              {markPaid.isPending ? vi.common.processing : vi.billing.actions.markPaidConfirm}
            </Button>
          </>
        }
      >
        <form id="admin-billing-mark-paid-form" className="modal-form" onSubmit={onMarkPaidSubmit}>
          <p className="muted">{vi.billing.actions.markPaidDescription}</p>
          <Field
            label={vi.billing.actions.grantDaysLabel}
            htmlFor="admin-billing-grant-days"
            hint={vi.billing.actions.grantDaysHint}
          >
            <input
              id="admin-billing-grant-days"
              type="number"
              min={1}
              max={1095}
              value={grantDays}
              onChange={(event) => setGrantDays(event.target.value)}
            />
          </Field>
          <Field label={vi.billing.actions.reasonLabel} htmlFor="admin-billing-mark-paid-reason">
            <textarea
              id="admin-billing-mark-paid-reason"
              data-testid="admin-tx-reason-input"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              placeholder={vi.billing.actions.reasonPlaceholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <InlineError error={markPaid.error} />
        </form>
      </Dialog>

      <Dialog
        open={modal?.kind === 'resolve'}
        title={vi.billing.actions.resolveTitle}
        onClose={closeModal}
        testId="admin-billing-resolve-dialog"
        footer={
          <>
            <Button onClick={closeModal}>{vi.common.cancel}</Button>
            <Button
              type="submit"
              form="admin-billing-resolve-form"
              variant="primary"
              data-testid="admin-tx-resolve-confirm"
              disabled={resolveIntent.isPending || reason.trim().length < 3}
            >
              {resolveIntent.isPending ? vi.common.processing : vi.billing.actions.resolveConfirm}
            </Button>
          </>
        }
      >
        <form id="admin-billing-resolve-form" className="modal-form" onSubmit={onResolveSubmit}>
          <p className="muted">{vi.billing.actions.resolveDescription}</p>
          <Field label={vi.billing.actions.outcomeLabel} htmlFor="admin-billing-resolve-outcome">
            <select
              id="admin-billing-resolve-outcome"
              value={resolveOutcome}
              onChange={(event) => setResolveOutcome(event.target.value as AdminBillingResolveOutcome)}
            >
              <option value="expired">{vi.billing.actions.outcomeExpired}</option>
              <option value="failed">{vi.billing.actions.outcomeFailed}</option>
            </select>
          </Field>
          <Field label={vi.billing.actions.reasonLabel} htmlFor="admin-billing-resolve-reason">
            <textarea
              id="admin-billing-resolve-reason"
              data-testid="admin-tx-reason-input"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              placeholder={vi.billing.actions.reasonPlaceholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <InlineError error={resolveIntent.error} />
        </form>
      </Dialog>

      <Dialog
        open={modal?.kind === 'refund'}
        title={vi.billing.actions.refundTitle}
        onClose={closeModal}
        testId="admin-billing-refund-dialog"
        footer={
          <>
            <Button onClick={closeModal}>{vi.common.cancel}</Button>
            <Button
              type="submit"
              form="admin-billing-refund-form"
              variant="danger"
              data-testid="admin-tx-refund-confirm"
              disabled={refundIntent.isPending || reason.trim().length < 3}
            >
              {refundIntent.isPending ? vi.common.processing : vi.billing.actions.refundConfirm}
            </Button>
          </>
        }
      >
        <form id="admin-billing-refund-form" className="modal-form" onSubmit={onRefundSubmit}>
          <p className="muted">{vi.billing.actions.refundDescription}</p>
          <div className="field checkbox-field">
            <input
              id="admin-billing-revoke-sub"
              data-testid="admin-tx-revoke-sub"
              type="checkbox"
              checked={revokeSubscription}
              onChange={(event) => setRevokeSubscription(event.target.checked)}
            />
            <label htmlFor="admin-billing-revoke-sub">{vi.billing.actions.revokeSubscriptionLabel}</label>
          </div>
          <Field label={vi.billing.actions.reasonLabel} htmlFor="admin-billing-refund-reason">
            <textarea
              id="admin-billing-refund-reason"
              data-testid="admin-tx-reason-input"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              placeholder={vi.billing.actions.reasonPlaceholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <InlineError error={refundIntent.error} />
        </form>
      </Dialog>
    </>
  );
}
