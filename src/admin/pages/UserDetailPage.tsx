import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ADMIN_ROLE_LABELS_VI } from '@shared/admin';
import { AdminApiError } from '../api/client';
import { useMe, useUserDetail } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { Badge, Button, DefinitionList, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, Section } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { hasPermission } from '../lib/nav';

const REVEAL_REASON_KEYS = ['support_ticket', 'billing_inquiry', 'security_review', 'compliance_audit'] as const;

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const me = useMe();
  const canReveal = hasPermission(me.data?.permissions ?? [], 'users.pii.reveal');
  const [revealRequested, setRevealRequested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealReason, setRevealReason] = useState<string>('support_ticket');
  const [revealTicket, setRevealTicket] = useState('');
  const detail = useUserDetail(userId, revealRequested);
  const user = detail.data;
  const emailRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (revealRequested && user?.emailRevealed) emailRef.current?.focus();
  }, [revealRequested, user?.emailRevealed]);

  if (detail.isPending) {
    return (
      <>
        <Link to="/users" className="back-link">
          {vi.common.backTo(vi.users.detailBack)}
        </Link>
        <h1 data-testid="admin-page-title">{vi.users.detailTitle}</h1>
        <LoadingState rows={4} />
      </>
    );
  }
  if (!user) {
    return (
      <>
        <Link to="/users" className="back-link">
          {vi.common.backTo(vi.users.detailBack)}
        </Link>
        <h1 data-testid="admin-page-title">{vi.users.detailTitle}</h1>
        {detail.error instanceof AdminApiError && detail.error.status === 404 ? (
          <EmptyState title={vi.errors.ADMIN_NOT_FOUND} />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </>
    );
  }

  const shownEmail = user.email ?? user.emailMasked ?? vi.common.dash;

  return (
    <>
      <Link to="/users" className="back-link">
        {vi.common.backTo(vi.users.detailBack)}
      </Link>
      <PageHeader
        eyebrow={vi.users.detailEyebrow}
        title={user.displayName ?? vi.users.anonymous}
        description={user.isGuest ? vi.users.guestNote : undefined}
        actions={
          <>
            <Badge tone={user.plan === 'plus' ? 'brand' : 'neutral'}>{vi.labels.subscription[user.plan]}</Badge>
            <Badge tone={user.isGuest ? 'warning' : user.isVerified ? 'success' : 'neutral'}>
              {user.isGuest ? vi.users.guest : user.isVerified ? vi.users.verified : vi.users.unverified}
            </Badge>
            {canReveal && !user.emailRevealed ? (
              <Button variant="secondary" data-testid="admin-reveal-email" onClick={() => setConfirmOpen(true)}>
                {vi.users.revealEmail}
              </Button>
            ) : null}
          </>
        }
      />

      {detail.isError ? <ErrorState error={detail.error} /> : null}
      {user.emailRevealed ? (
        <Notice tone="warning" title={vi.users.revealedNotice}>
          <span className="small">
            {vi.users.revealReasonLabel}: <strong>{vi.users.revealReasons[revealReason] ?? revealReason}</strong>
            {revealTicket.trim() ? ` · ${revealTicket.trim()}` : ''}
          </span>
        </Notice>
      ) : null}

      <div className="detail-grid" data-testid="admin-user-detail">
        <Section title={vi.users.profile}>
          <DefinitionList
            items={[
              { label: vi.users.userId, value: <span className="mono">{user.id}</span> },
              {
                label: vi.users.email,
                value: (
                  <span className="mono" data-testid="admin-user-email" ref={emailRef} tabIndex={-1}>
                    {shownEmail}
                  </span>
                ),
              },
              { label: vi.users.columns.type, value: user.isGuest ? vi.users.guest : vi.users.registered },
              {
                label: vi.users.verified,
                value: (
                  <Badge tone={user.isVerified ? 'success' : 'neutral'}>
                    {user.isVerified ? vi.users.verified : vi.users.unverified}
                  </Badge>
                ),
              },
              { label: vi.users.onboarding, value: formatDateTime(user.onboardingCompletedAt) },
              { label: vi.users.created, value: formatDate(user.createdAt) },
              { label: vi.users.lastSeen, value: formatDateTime(user.lastSeenAt) },
              {
                label: vi.users.authProviders,
                value: user.authProviders.length
                  ? user.authProviders.map((provider) => vi.users.provider[provider] ?? provider).join(' · ')
                  : vi.common.dash,
              },
            ]}
          />
        </Section>

        <Section title={vi.users.subscription}>
          <DefinitionList
            items={[
              {
                label: vi.users.plan,
                value: <Badge tone={user.plan === 'plus' ? 'brand' : 'neutral'}>{vi.labels.subscription[user.plan]}</Badge>,
              },
              { label: vi.users.subscriptionStatus, value: user.subscriptionStatus ?? vi.common.dash },
              { label: vi.users.subscriptionExpires, value: formatDateTime(user.subscriptionExpiresAt) },
              {
                label: vi.users.payments,
                value: (
                  <span className="button-row">
                    <Badge tone="success">{formatNumber(user.activity.payments.paid)}</Badge>
                    <Badge tone="warning">{formatNumber(user.activity.payments.pending)}</Badge>
                    <Badge tone="danger">{formatNumber(user.activity.payments.failed)}</Badge>
                  </span>
                ),
              },
            ]}
          />
        </Section>

        <Section title={vi.users.activity}>
          <DefinitionList
            items={[
              {
                label: vi.users.activeSessions,
                value: (
                  <Badge tone={user.activity.activeSessions > 0 ? 'info' : 'neutral'}>
                    {formatNumber(user.activity.activeSessions)}
                  </Badge>
                ),
              },
              { label: vi.users.scans30d, value: formatNumber(user.activity.scans30d) },
              { label: vi.users.lastScan, value: formatDateTime(user.activity.lastScanAt) },
            ]}
          />
        </Section>

        <Section title={vi.users.adminRoles}>
          {user.adminRoles.length === 0 ? (
            <p className="muted">{vi.users.noAdminRoles}</p>
          ) : (
            <ul className="chip-list">
              {user.adminRoles.map((role) => (
                <li key={role}>
                  <Badge tone="terracotta">{ADMIN_ROLE_LABELS_VI[role]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={vi.users.households} description={vi.users.householdsMemberNote}>
        {user.households.length === 0 ? (
          <p className="muted">{vi.users.householdEmpty}</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.users.households}>
            <table className="data-table">
              <caption className="sr-only">{vi.users.households}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.users.householdColumns.name}</th>
                  <th scope="col">{vi.users.householdRole}</th>
                  <th scope="col">{vi.users.householdMembers}</th>
                  <th scope="col">{vi.users.householdColumns.created}</th>
                </tr>
              </thead>
              <tbody>
                {user.households.map((household) => (
                  <tr key={household.id}>
                    <td>
                      <strong>{household.name}</strong>
                      <div className="cell-sub mono">{household.id}</div>
                    </td>
                    <td>
                      <Badge tone="neutral">{household.role}</Badge>
                    </td>
                    <td>{formatNumber(household.memberCount)}</td>
                    <td>{formatDate(household.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Dialog
        open={confirmOpen}
        title={vi.users.revealTitle}
        onClose={() => setConfirmOpen(false)}
        testId="admin-reveal-dialog"
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-reveal-confirm"
              disabled={!revealReason}
              onClick={() => {
                setRevealRequested(true);
                setConfirmOpen(false);
              }}
            >
              {vi.users.revealConfirm}
            </Button>
          </>
        }
      >
        <Notice tone="warning">{vi.users.revealBody}</Notice>
        <Field label={vi.users.revealReasonLabel} htmlFor="admin-reveal-reason">
          <select
            id="admin-reveal-reason"
            value={revealReason}
            onChange={(event) => setRevealReason(event.target.value)}
          >
            {REVEAL_REASON_KEYS.map((key) => (
              <option key={key} value={key}>
                {vi.users.revealReasons[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={vi.users.revealTicketLabel} htmlFor="admin-reveal-ticket">
          <input
            id="admin-reveal-ticket"
            type="text"
            maxLength={80}
            placeholder={vi.users.revealTicketPlaceholder}
            value={revealTicket}
            onChange={(event) => setRevealTicket(event.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}
