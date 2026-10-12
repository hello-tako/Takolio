import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ADMIN_ROLE_LABELS_VI } from '@shared/admin';
import { AdminApiError } from '../api/client';
import { useMe, useUserDetail } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { Badge, Button, DefinitionList, EmptyState, ErrorState, LoadingState, Notice, PageHeader, Section } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDate, formatDateTime } from '../lib/format';
import { hasPermission } from '../lib/nav';

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const me = useMe();
  const canReveal = hasPermission(me.data?.permissions ?? [], 'users.pii.reveal');
  const [revealRequested, setRevealRequested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detail = useUserDetail(userId, revealRequested);
  const user = detail.data;

  if (detail.isPending) {
    return (
      <>
        <Link to="/users" className="back-link">
          {vi.users.detailBack}
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
          {vi.users.detailBack}
        </Link>
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
        {vi.users.detailBack}
      </Link>
      <PageHeader
        title={user.displayName ?? vi.users.anonymous}
        description={user.isGuest ? vi.users.guestNote : undefined}
        actions={
          canReveal && !user.emailRevealed ? (
            <Button variant="secondary" data-testid="admin-reveal-email" onClick={() => setConfirmOpen(true)}>
              {vi.users.revealEmail}
            </Button>
          ) : undefined
        }
      />
      {detail.isError ? <ErrorState error={detail.error} /> : null}
      {user.emailRevealed ? <Notice tone="warning">{vi.users.revealedNotice}</Notice> : null}

      <div className="detail-grid" data-testid="admin-user-detail">
        <Section title={vi.users.profile}>
          <DefinitionList
            items={[
              { label: vi.users.email, value: <span className="mono" data-testid="admin-user-email">{shownEmail}</span> },
              { label: vi.users.columns.type, value: user.isGuest ? vi.users.guest : vi.users.registered },
              { label: vi.users.verified, value: user.isVerified ? vi.users.verified : vi.users.unverified },
              { label: vi.users.onboarding, value: formatDateTime(user.onboardingCompletedAt) },
              { label: vi.users.created, value: formatDate(user.createdAt) },
              { label: vi.users.lastSeen, value: formatDateTime(user.lastSeenAt) },
              {
                label: vi.users.authProviders,
                value: user.authProviders.length
                  ? user.authProviders.map((provider) => vi.users.provider[provider] ?? provider).join(', ')
                  : vi.common.dash,
              },
            ]}
          />
        </Section>

        <Section title={vi.users.subscription}>
          <DefinitionList
            items={[
              { label: vi.users.plan, value: <Badge tone={user.plan === 'plus' ? 'brand' : 'neutral'}>{vi.labels.subscription[user.plan]}</Badge> },
              { label: vi.users.subscriptionStatus, value: user.subscriptionStatus ?? vi.common.dash },
              { label: vi.users.subscriptionExpires, value: formatDateTime(user.subscriptionExpiresAt) },
            ]}
          />
        </Section>

        <Section title={vi.users.activity}>
          <DefinitionList
            items={[
              { label: vi.users.activeSessions, value: user.activity.activeSessions },
              { label: vi.users.scans30d, value: user.activity.scans30d },
              { label: vi.users.lastScan, value: formatDateTime(user.activity.lastScanAt) },
              {
                label: vi.users.payments,
                value: `${user.activity.payments.paid} / ${user.activity.payments.pending} / ${user.activity.payments.failed}`,
              },
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
                  <Badge tone="brand">{ADMIN_ROLE_LABELS_VI[role]}</Badge>
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
          <div className="table-wrap">
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
                    <td>{household.name}</td>
                    <td>{household.role}</td>
                    <td>{household.memberCount}</td>
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
        <p>{vi.users.revealBody}</p>
      </Dialog>
    </>
  );
}
