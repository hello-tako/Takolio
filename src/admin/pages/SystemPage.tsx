import { useState, type FormEvent } from 'react';
import type { AdminBroadcastTarget, AdminSystemHygieneResult } from '@shared/admin';
import { useMe, useRunSystemHygiene, useSendSystemBroadcast, useSystemStatus } from '../api/hooks';
import { HealthCheckList } from '../components/HealthChecks';
import {
  Badge,
  Button,
  DefinitionList,
  ErrorState,
  Field,
  InlineError,
  LoadingState,
  Notice,
  PageHeader,
  Section,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber } from '../lib/format';
import { hasPermission } from '../lib/nav';

export function SystemPage() {
  const me = useMe();
  const canWrite = hasPermission(me.data?.permissions ?? [], 'system.write');
  const status = useSystemStatus();
  const data = status.data;

  const hygiene = useRunSystemHygiene();
  const broadcast = useSendSystemBroadcast();

  const [hygieneReason, setHygieneReason] = useState('');
  const [hygieneResult, setHygieneResult] = useState<AdminSystemHygieneResult | null>(null);

  const [target, setTarget] = useState<AdminBroadcastTarget>('all_registered');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);

  const onRunHygiene = () => {
    hygiene.mutate(
      { reason: hygieneReason.trim() || undefined },
      {
        onSuccess: (result) => {
          setHygieneResult(result);
        },
      },
    );
  };

  const onSendBroadcast = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBroadcastMessage(null);
    if (!title.trim() || !message.trim() || reason.trim().length < 3) return;
    broadcast.mutate(
      {
        target,
        title: title.trim(),
        message: message.trim(),
        reason: reason.trim(),
      },
      {
        onSuccess: (result) => {
          setTitle('');
          setMessage('');
          setReason('');
          setBroadcastMessage(vi.system.broadcast.success(result.recipientCount));
        },
      },
    );
  };

  return (
    <>
      <PageHeader title={vi.system.title} description={vi.system.description} />
      {status.isPending ? <LoadingState rows={5} /> : null}
      {status.isError ? <ErrorState error={status.error} onRetry={() => void status.refetch()} /> : null}
      {data ? (
        <>
          <Section title={vi.system.checks}>
            <HealthCheckList checks={data.checks} itemTestId="admin-system-check" />
          </Section>

          {canWrite ? (
            <div className="two-col" data-testid="admin-system-ops">
              <Section title={vi.system.hygiene.title} description={vi.system.hygiene.description}>
                <div className="modal-form">
                  <Field label={vi.system.hygiene.reasonLabel} htmlFor="admin-hygiene-reason">
                    <input
                      id="admin-hygiene-reason"
                      type="text"
                      maxLength={300}
                      placeholder={vi.system.hygiene.reasonPlaceholder}
                      value={hygieneReason}
                      onChange={(event) => setHygieneReason(event.target.value)}
                    />
                  </Field>
                  <InlineError error={hygiene.error} />
                  <div>
                    <Button
                      variant="primary"
                      data-testid="admin-hygiene-run-btn"
                      disabled={hygiene.isPending}
                      onClick={onRunHygiene}
                    >
                      {hygiene.isPending ? vi.system.hygiene.running : vi.system.hygiene.runButton}
                    </Button>
                  </div>
                  {hygieneResult ? (
                    <div className="card-inset" role="status" data-testid="admin-hygiene-result">
                      <p className="form-success">{vi.system.hygiene.success}</p>
                      <DefinitionList
                        items={[
                          {
                            label: vi.system.hygiene.revokedSessions,
                            value: formatNumber(hygieneResult.revokedSessionsDeleted),
                          },
                          {
                            label: vi.system.hygiene.legacySessions,
                            value: formatNumber(hygieneResult.legacySessionsDeleted),
                          },
                          {
                            label: vi.system.hygiene.expiredOtps,
                            value: formatNumber(hygieneResult.expiredOtpsDeleted),
                          },
                          {
                            label: vi.system.hygiene.expiredApprovals,
                            value: formatNumber(hygieneResult.expiredApprovalsClosed),
                          },
                          {
                            label: vi.system.hygiene.ranAt,
                            value: formatDateTime(hygieneResult.ranAt),
                          },
                        ]}
                      />
                    </div>
                  ) : null}
                </div>
              </Section>

              <Section title={vi.system.broadcast.title} description={vi.system.broadcast.description}>
                <form className="modal-form" onSubmit={onSendBroadcast} data-testid="admin-broadcast-form">
                  <Field label={vi.system.broadcast.targetLabel} htmlFor="admin-broadcast-target">
                    <select
                      id="admin-broadcast-target"
                      data-testid="admin-broadcast-target"
                      value={target}
                      onChange={(event) => setTarget(event.target.value as AdminBroadcastTarget)}
                    >
                      <option value="all_registered">{vi.system.broadcast.targetAllRegistered}</option>
                      <option value="pro_only">{vi.system.broadcast.targetProOnly}</option>
                    </select>
                  </Field>
                  <Field label={vi.system.broadcast.subjectLabel} htmlFor="admin-broadcast-title">
                    <input
                      id="admin-broadcast-title"
                      data-testid="admin-broadcast-title"
                      type="text"
                      required
                      maxLength={120}
                      placeholder={vi.system.broadcast.subjectPlaceholder}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </Field>
                  <Field label={vi.system.broadcast.messageLabel} htmlFor="admin-broadcast-message">
                    <textarea
                      id="admin-broadcast-message"
                      data-testid="admin-broadcast-message"
                      rows={3}
                      required
                      maxLength={1000}
                      placeholder={vi.system.broadcast.messagePlaceholder}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </Field>
                  <Field label={vi.system.broadcast.reasonLabel} htmlFor="admin-broadcast-reason">
                    <input
                      id="admin-broadcast-reason"
                      data-testid="admin-broadcast-reason"
                      type="text"
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder={vi.system.broadcast.reasonPlaceholder}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <InlineError error={broadcast.error} />
                  {broadcastMessage ? (
                    <p className="form-success" role="status" data-testid="admin-broadcast-success">
                      {broadcastMessage}
                    </p>
                  ) : null}
                  <div>
                    <Button
                      type="submit"
                      variant="primary"
                      data-testid="admin-broadcast-submit"
                      disabled={
                        broadcast.isPending || !title.trim() || !message.trim() || reason.trim().length < 3
                      }
                    >
                      {broadcast.isPending ? vi.system.broadcast.submitting : vi.system.broadcast.submitButton}
                    </Button>
                  </div>
                </form>
              </Section>
            </div>
          ) : null}

          <div className="two-col">
            <Section title={vi.system.release}>
              <DefinitionList
                items={[
                  {
                    label: vi.system.commit,
                    value: <span className="mono">{data.release.gitCommit ?? vi.common.notSet}</span>,
                  },
                  { label: vi.common.environment, value: data.release.environment },
                  {
                    label: vi.system.rbacVersion,
                    value: <span className="mono">{data.release.rbacMatrixVersion}</span>,
                  },
                ]}
              />
            </Section>
            <Section title={vi.system.database}>
              <p>
                {vi.system.reachable}:{' '}
                <Badge tone={data.database.reachable ? 'success' : 'danger'}>
                  {data.database.reachable ? vi.labels.yes : vi.labels.no}
                </Badge>
              </p>
              <h3>{vi.system.schema}</h3>
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
                        <td className="mono">{flag.value ?? vi.common.notSet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title={vi.system.warnings}>
              {data.warnings.length === 0 ? (
                <p className="muted">{vi.system.noWarnings}</p>
              ) : (
                data.warnings.map((warning) => (
                  <Notice key={warning.code} tone="warning" title={warning.code}>
                    {warning.message}
                  </Notice>
                ))
              )}
            </Section>
          </div>
        </>
      ) : null}
    </>
  );
}
