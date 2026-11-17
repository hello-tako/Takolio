import clsx from 'clsx';
import { useState } from 'react';
import { useAuditEvents } from '../api/hooks';
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, Section, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime } from '../lib/format';
import { useDebouncedValue } from '../lib/hooks';
import { ADMIN_ROLE_LABELS_VI, type AdminAuditEvent } from '@shared/admin';

const PAGE_SIZE = 25;
const OUTCOME_TONE: Record<string, Tone> = { success: 'success', denied: 'warning', failure: 'danger' };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ACTION_PRESETS = ['admin.login', 'users.pii.reveal', 'role.grant.super_admin'] as const;

function startOfDay(value: string): string | undefined {
  return DATE_PATTERN.test(value) ? `${value}T00:00:00.000Z` : undefined;
}

function endOfDay(value: string): string | undefined {
  return DATE_PATTERN.test(value) ? `${value}T23:59:59.999Z` : undefined;
}

export function AuditPage() {
  const [actionInput, setActionInput] = useState('');
  const [actorInput, setActorInput] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const action = useDebouncedValue(actionInput.trim(), 300);
  const actor = useDebouncedValue(actorInput.trim(), 300);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const events = useAuditEvents({
    action: action || undefined,
    actor: actor || undefined,
    outcome: outcome || undefined,
    from: startOfDay(from),
    to: endOfDay(to),
    page,
    pageSize: PAGE_SIZE,
  });

  const resetPage = () => setPage(1);
  const hasFilters = actionInput !== '' || actorInput !== '' || outcome !== '' || from !== '' || to !== '';
  const clearFilters = () => {
    setActionInput('');
    setActorInput('');
    setOutcome('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={vi.audit.eyebrow}
        title={vi.audit.title}
        description={vi.audit.description}
        actions={<Badge tone="brand">{vi.audit.ledgerBadge}</Badge>}
      />

      <Section title={vi.audit.caption}>
        <div className="preset-strip">
          <span className="muted small">{vi.audit.quickFiltersLabel}</span>
          {ACTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={clsx('preset-chip mono', actionInput === preset && 'is-active')}
              onClick={() => {
                setActionInput(actionInput === preset ? '' : preset);
                resetPage();
              }}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className={clsx('preset-chip', outcome === 'denied' && 'is-active')}
            onClick={() => {
              setOutcome(outcome === 'denied' ? '' : 'denied');
              resetPage();
            }}
          >
            {vi.labels.outcome.denied}
          </button>
        </div>

        <div className="toolbar">
          <Field label={vi.audit.action} htmlFor="admin-audit-action">
            <input
              id="admin-audit-action"
              data-testid="admin-audit-action-filter"
              type="search"
              placeholder={vi.audit.actionPlaceholder}
              maxLength={64}
              value={actionInput}
              onChange={(event) => {
                setActionInput(event.target.value);
                resetPage();
              }}
            />
          </Field>
          <Field label={vi.audit.outcome} htmlFor="admin-audit-outcome">
            <select
              id="admin-audit-outcome"
              data-testid="admin-audit-outcome-filter"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value);
                resetPage();
              }}
            >
              <option value="">{vi.audit.outcomeAll}</option>
              {(['success', 'denied', 'failure'] as const).map((value) => (
                <option key={value} value={value}>
                  {vi.labels.outcome[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vi.audit.actor} htmlFor="admin-audit-actor">
            <input
              id="admin-audit-actor"
              data-testid="admin-audit-actor-filter"
              type="search"
              placeholder={vi.audit.actorPlaceholder}
              maxLength={100}
              value={actorInput}
              onChange={(event) => {
                setActorInput(event.target.value);
                resetPage();
              }}
            />
          </Field>
          <Field label={vi.audit.from} htmlFor="admin-audit-from">
            <input
              id="admin-audit-from"
              data-testid="admin-audit-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
          </Field>
          <Field label={vi.audit.to} htmlFor="admin-audit-to">
            <input
              id="admin-audit-to"
              data-testid="admin-audit-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
            />
          </Field>
          {hasFilters ? (
            <div className="toolbar-actions">
              <Button variant="ghost" onClick={clearFilters}>
                {vi.common.clearFilters}
              </Button>
            </div>
          ) : null}
        </div>

        {events.isPending ? <LoadingState rows={5} /> : null}
        {events.isError ? <ErrorState error={events.error} onRetry={() => void events.refetch()} /> : null}
        {events.data && events.data.items.length === 0 ? <EmptyState body={vi.audit.empty} /> : null}
        {events.data && events.data.items.length > 0 ? (
          <div
            className={events.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={events.isPlaceholderData || undefined}
            tabIndex={0}
            role="region"
            aria-label={vi.audit.caption}
          >
            <table className="data-table audit-table">
              <caption className="sr-only">{vi.audit.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.audit.columns.time}</th>
                  <th scope="col">{vi.audit.columns.actor}</th>
                  <th scope="col">{vi.audit.columns.roles}</th>
                  <th scope="col">{vi.audit.columns.action}</th>
                  <th scope="col">{vi.audit.columns.target}</th>
                  <th scope="col">{vi.audit.columns.outcome}</th>
                  <th scope="col">{vi.audit.columns.reason}</th>
                  <th scope="col">{vi.audit.columns.request}</th>
                  <th scope="col">{vi.audit.columns.details}</th>
                </tr>
              </thead>
              <tbody>
                {events.data.items.map((event) => {
                  const isOpen = expanded.has(event.id);
                  const metadataId = `audit-meta-${event.id}`;
                  return (
                    <AuditRowGroup
                      key={event.id}
                      event={event}
                      isOpen={isOpen}
                      metadataId={metadataId}
                      onToggle={() => toggleExpanded(event.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {events.data ? (
          <Pagination page={events.data.page} pageSize={events.data.pageSize} total={events.data.total} onPageChange={setPage} />
        ) : null}
      </Section>
    </>
  );
}

function AuditRowGroup({
  event,
  isOpen,
  metadataId,
  onToggle,
}: {
  event: AdminAuditEvent;
  isOpen: boolean;
  metadataId: string;
  onToggle: () => void;
}) {
  const metadataEntries = event.metadata ? Object.entries(event.metadata) : [];
  return (
    <>
      <tr data-testid="admin-audit-row">
        <td>{formatDateTime(event.occurredAt)}</td>
        <td className="mono">{event.actorUserId ?? vi.common.dash}</td>
        <td>{event.actorRoles.map((role) => ADMIN_ROLE_LABELS_VI[role]).join(', ') || vi.common.dash}</td>
        <td>
          <Badge tone="neutral">
            <span className="mono">{event.action}</span>
          </Badge>
        </td>
        <td className="mono">{event.targetType ? `${event.targetType}${event.targetId ? `:${event.targetId}` : ''}` : vi.common.dash}</td>
        <td>
          <Badge tone={OUTCOME_TONE[event.outcome] ?? 'neutral'}>{vi.labels.outcome[event.outcome] ?? event.outcome}</Badge>
        </td>
        <td className="mono">{event.reasonCode ?? vi.common.dash}</td>
        <td className="mono">{event.requestId ?? vi.common.dash}</td>
        <td>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            aria-expanded={isOpen}
            aria-controls={metadataId}
            onClick={onToggle}
          >
            {isOpen ? vi.audit.hideMetadata : vi.audit.showMetadata}
          </button>
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={9}>
            <div id={metadataId} className="metadata-panel">
              {metadataEntries.length === 0 ? (
                <p className="muted">{vi.audit.noMetadata}</p>
              ) : (
                <dl className="def-list">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt className="mono">{key}</dt>
                      <dd className="mono">{value === null ? vi.common.dash : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
