import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ADMIN_ROLE_LABELS_VI,
  type AdminAccountStatus,
  type AdminDeleteUserMode,
  type AdminNotificationType,
  type AdminUpgradeDuration,
} from '@shared/admin';
import { AdminApiError } from '../api/client';
import {
  useCancelUserSubscription,
  useDeleteUser,
  useMe,
  useNotifyUser,
  useResetUserQuota,
  useRevokeUserSessions,
  useSuspendUser,
  useUnsuspendUser,
  useUpgradeUserSubscription,
  useUserDetail,
  useVerifyUserEmail,
} from '../api/hooks';
import { Dialog } from '../components/Dialog';
import {
  Badge,
  Button,
  DefinitionList,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  LoadingState,
  Notice,
  PageHeader,
  Section,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDate, formatDateTime, formatVnd } from '../lib/format';
import { hasPermission } from '../lib/nav';

const ACCOUNT_STATUS_TONE: Record<AdminAccountStatus, Tone> = {
  active: 'success',
  suspended: 'warning',
  deleted: 'danger',
};

const PAYMENT_TONE: Record<string, Tone> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  expired: 'neutral',
  refunded: 'info',
};

const NOTIFICATION_TYPES: readonly AdminNotificationType[] = [
  'support',
  'system',
  'billing',
  'announcement',
  'expiring_soon',
  'cook_ready',
  'shopping_reminder',
];

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const me = useMe();
  const permissions = me.data?.permissions ?? [];
  const canReveal = hasPermission(permissions, 'users.pii.reveal');
  const canWrite = hasPermission(permissions, 'users.write');
  const canBillingWrite = hasPermission(permissions, 'users.billing.write');
  const canSuspend = hasPermission(permissions, 'users.suspend');
  const canDelete = hasPermission(permissions, 'users.delete');

  const [revealRequested, setRevealRequested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Dialog states
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDuration, setUpgradeDuration] = useState<AdminUpgradeDuration>('monthly');
  const [customDays, setCustomDays] = useState(30);
  const [notifyOnUpgrade, setNotifyOnUpgrade] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState('');

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [unsuspendOpen, setUnsuspendOpen] = useState(false);
  const [unsuspendReason, setUnsuspendReason] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<AdminDeleteUserMode>('anonymize');
  const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyReason, setVerifyReason] = useState('');

  const [resetQuotaOpen, setResetQuotaOpen] = useState(false);
  const [resetQuotaReason, setResetQuotaReason] = useState('');

  const [revokeSessionsOpen, setRevokeSessionsOpen] = useState(false);
  const [revokeSessionsReason, setRevokeSessionsReason] = useState('');

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyType, setNotifyType] = useState<AdminNotificationType>('support');
  const [notifyReason, setNotifyReason] = useState('');

  const detail = useUserDetail(userId, revealRequested);
  const user = detail.data;
  const emailRef = useRef<HTMLSpanElement>(null);

  const upgradeSubscription = useUpgradeUserSubscription();
  const cancelSubscription = useCancelUserSubscription();
  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();
  const deleteUser = useDeleteUser();
  const verifyUserEmail = useVerifyUserEmail();
  const resetUserQuota = useResetUserQuota();
  const revokeUserSessions = useRevokeUserSessions();
  const notifyUser = useNotifyUser();

  useEffect(() => {
    if (revealRequested && user?.emailRevealed) emailRef.current?.focus();
  }, [revealRequested, user?.emailRevealed]);

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
  const accountStatus: AdminAccountStatus = user.accountStatus ?? 'active';
  const isDeleted = accountStatus === 'deleted';
  const scanQuota = user.scanQuota ?? {
    usedThisMonth: 0,
    maxPerMonth: user.plan === 'plus' ? 500 : 5,
  };
  const recentTransactions = user.recentTransactions ?? [];
  const deleteConfirmMatched =
    deleteConfirmWord.trim().toUpperCase() === 'XOA' || deleteConfirmWord.trim() === user.id;

  return (
    <>
      <Link to="/users" className="back-link">
        {vi.users.detailBack}
      </Link>
      <PageHeader
        title={user.displayName ?? vi.users.anonymous}
        description={user.isGuest ? vi.users.guestNote : undefined}
        actions={
          <div className="button-row">
            <Badge
              tone={ACCOUNT_STATUS_TONE[accountStatus] ?? 'neutral'}
              testId="admin-user-account-status"
            >
              {vi.labels.accountStatus[accountStatus] ?? accountStatus}
            </Badge>
            <Badge tone={user.plan === 'plus' ? 'brand' : 'neutral'}>
              {vi.labels.subscription[user.plan]}
            </Badge>
            {canReveal && !user.emailRevealed ? (
              <Button
                variant="secondary"
                data-testid="admin-reveal-email"
                onClick={() => setConfirmOpen(true)}
              >
                {vi.users.revealEmail}
              </Button>
            ) : null}
          </div>
        }
      />
      {detail.isError ? <ErrorState error={detail.error} /> : null}
      {user.emailRevealed ? <Notice tone="warning">{vi.users.revealedNotice}</Notice> : null}
      {feedbackNotice ? (
        <Notice tone="success" testId="admin-user-action-notice">
          {feedbackNotice}
        </Notice>
      ) : null}

      {(canBillingWrite || canSuspend) && !isDeleted ? (
        <Section title={vi.users.lifecycle.title}>
          <div className="button-row">
            {canBillingWrite ? (
              <>
                <Button
                  variant="primary"
                  data-testid="admin-user-upgrade-btn"
                  onClick={() => {
                    setUpgradeReason('');
                    setUpgradeOpen(true);
                  }}
                >
                  {vi.users.lifecycle.upgradeButton}
                </Button>
                {user.plan === 'plus' ? (
                  <Button
                    variant="secondary"
                    data-testid="admin-user-cancel-plan-btn"
                    onClick={() => {
                      setCancelReason('');
                      setCancelImmediate(false);
                      setCancelOpen(true);
                    }}
                  >
                    {vi.users.lifecycle.cancelButton}
                  </Button>
                ) : null}
              </>
            ) : null}

            {canSuspend && !user.isPlatformAdmin ? (
              accountStatus === 'suspended' ? (
                <Button
                  variant="secondary"
                  data-testid="admin-user-unsuspend-btn"
                  onClick={() => {
                    setUnsuspendReason('');
                    setUnsuspendOpen(true);
                  }}
                >
                  {vi.users.lifecycle.unsuspendButton}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  data-testid="admin-user-suspend-btn"
                  onClick={() => {
                    setSuspendReason('');
                    setSuspendOpen(true);
                  }}
                >
                  {vi.users.lifecycle.suspendButton}
                </Button>
              )
            ) : null}
          </div>
        </Section>
      ) : null}

      {canWrite && !isDeleted ? (
        <Section
          title={vi.users.lifecycle.supportTitle}
          description={`${vi.users.quotaTitle}: ${vi.users.quotaSummary(scanQuota.usedThisMonth, scanQuota.maxPerMonth)}`}
        >
          <div className="button-row">
            <Button
              variant="secondary"
              data-testid="admin-user-revoke-sessions-btn"
              onClick={() => {
                setRevokeSessionsReason('');
                setRevokeSessionsOpen(true);
              }}
            >
              {vi.users.lifecycle.revokeSessionsButton}
            </Button>
            {!user.isGuest ? (
              <Button
                variant="secondary"
                data-testid="admin-user-verify-email-btn"
                onClick={() => {
                  setVerifyReason('');
                  setVerifyOpen(true);
                }}
              >
                {vi.users.lifecycle.verifyEmailButton}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              data-testid="admin-user-reset-quota-btn"
              onClick={() => {
                setResetQuotaReason('');
                setResetQuotaOpen(true);
              }}
            >
              {vi.users.lifecycle.resetQuotaButton} ({vi.users.quotaSummary(scanQuota.usedThisMonth, scanQuota.maxPerMonth)})
            </Button>
            <Button
              variant="secondary"
              data-testid="admin-user-notify-btn"
              onClick={() => {
                setNotifyTitle('');
                setNotifyMessage('');
                setNotifyType('support');
                setNotifyReason('');
                setNotifyOpen(true);
              }}
            >
              {vi.users.lifecycle.notifyButton}
            </Button>
          </div>
        </Section>
      ) : null}

      <div className="detail-grid" data-testid="admin-user-detail">
        <Section title={vi.users.profile}>
          <DefinitionList
            items={[
              {
                label: vi.users.email,
                value: (
                  <span className="mono" data-testid="admin-user-email" ref={emailRef} tabIndex={-1}>
                    {shownEmail}
                  </span>
                ),
              },
              {
                label: vi.users.accountStatus,
                value: (
                  <Badge tone={ACCOUNT_STATUS_TONE[accountStatus] ?? 'neutral'}>
                    {vi.labels.accountStatus[accountStatus] ?? accountStatus}
                  </Badge>
                ),
              },
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
              {
                label: vi.users.plan,
                value: (
                  <Badge tone={user.plan === 'plus' ? 'brand' : 'neutral'}>
                    {vi.labels.subscription[user.plan]}
                  </Badge>
                ),
              },
              { label: vi.users.subscriptionStatus, value: user.subscriptionStatus ?? vi.common.dash },
              { label: vi.users.subscriptionExpires, value: formatDateTime(user.subscriptionExpiresAt) },
              {
                label: vi.users.quotaTitle,
                value: vi.users.quotaSummary(scanQuota.usedThisMonth, scanQuota.maxPerMonth),
              },
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

      <Section title={vi.users.recentTransactionsTitle}>
        {recentTransactions.length === 0 ? (
          <p className="muted">{vi.users.recentTransactionsEmpty}</p>
        ) : (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label={vi.users.recentTransactionsTitle}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.users.recentTransactionsTitle}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.billing.transactionColumns.orderCode}</th>
                  <th scope="col">{vi.billing.transactionColumns.plan}</th>
                  <th scope="col">{vi.billing.transactionColumns.amount}</th>
                  <th scope="col">{vi.billing.transactionColumns.status}</th>
                  <th scope="col">{vi.billing.transactionColumns.created}</th>
                  <th scope="col">{vi.billing.transactionColumns.expires}</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} data-testid="admin-user-transaction-row">
                    <td className="mono">{tx.orderCodeMasked}</td>
                    <td>{vi.labels.billingPlan[tx.plan] ?? tx.plan}</td>
                    <td>{formatVnd(tx.amountVnd)}</td>
                    <td>
                      <Badge tone={PAYMENT_TONE[tx.effectiveStatus] ?? 'neutral'}>
                        {(vi.labels.paymentStatus as Record<string, string>)[tx.effectiveStatus] ??
                          tx.effectiveStatus}
                      </Badge>
                    </td>
                    <td>{formatDateTime(tx.createdAt)}</td>
                    <td>{formatDateTime(tx.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

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

      {canDelete && !user.isPlatformAdmin && !isDeleted ? (
        <section className="danger-zone" aria-labelledby="admin-user-danger-heading">
          <div className="section-head">
            <div>
              <h2 id="admin-user-danger-heading">{vi.users.lifecycle.dangerTitle}</h2>
              <p className="muted">{vi.users.lifecycle.deleteDescription}</p>
            </div>
            <Button
              variant="danger"
              data-testid="admin-user-delete-btn"
              onClick={() => {
                setDeleteMode('anonymize');
                setDeleteConfirmWord('');
                setDeleteReason('');
                setDeleteOpen(true);
              }}
            >
              {vi.users.lifecycle.deleteButton}
            </Button>
          </div>
        </section>
      ) : null}

      {/* Email Reveal Dialog */}
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

      {/* Upgrade Takolio Pro Dialog */}
      <Dialog
        open={upgradeOpen}
        title={vi.users.lifecycle.upgradeTitle}
        onClose={() => setUpgradeOpen(false)}
        testId="admin-user-upgrade-dialog"
        footer={
          <>
            <Button onClick={() => setUpgradeOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-user-upgrade-confirm"
              disabled={upgradeSubscription.isPending || upgradeReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                upgradeSubscription.mutate(
                  {
                    userId: user.id,
                    duration: upgradeDuration,
                    customDays: upgradeDuration === 'custom' ? customDays : undefined,
                    notifyUser: notifyOnUpgrade,
                    reason: upgradeReason.trim(),
                  },
                  {
                    onSuccess: () => {
                      setUpgradeOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.upgradeSuccess);
                    },
                  },
                );
              }}
            >
              {upgradeSubscription.isPending ? vi.common.processing : vi.users.lifecycle.upgradeConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.upgradeDescription}</p>
          <Field label={vi.users.lifecycle.durationLabel} htmlFor="admin-user-upgrade-duration">
            <select
              id="admin-user-upgrade-duration"
              data-testid="admin-user-upgrade-duration"
              value={upgradeDuration}
              onChange={(event) => setUpgradeDuration(event.target.value as AdminUpgradeDuration)}
            >
              <option value="monthly">{vi.users.lifecycle.durationMonthly}</option>
              <option value="annual">{vi.users.lifecycle.durationAnnual}</option>
              <option value="custom">{vi.users.lifecycle.durationCustom}</option>
            </select>
          </Field>
          {upgradeDuration === 'custom' ? (
            <Field label={vi.users.lifecycle.customDaysLabel} htmlFor="admin-user-upgrade-days">
              <input
                id="admin-user-upgrade-days"
                data-testid="admin-user-upgrade-days"
                type="number"
                min={1}
                max={1095}
                value={customDays}
                onChange={(event) => setCustomDays(Math.max(1, Math.min(1095, Number(event.target.value) || 30)))}
              />
            </Field>
          ) : null}
          <div className="checkbox-field">
            <input
              id="admin-user-upgrade-notify"
              type="checkbox"
              checked={notifyOnUpgrade}
              onChange={(event) => setNotifyOnUpgrade(event.target.checked)}
            />
            <label htmlFor="admin-user-upgrade-notify">{vi.users.lifecycle.notifyUserLabel}</label>
          </div>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-upgrade-reason">
            <input
              id="admin-user-upgrade-reason"
              data-testid="admin-user-upgrade-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={upgradeReason}
              onChange={(event) => setUpgradeReason(event.target.value)}
            />
          </Field>
          <InlineError error={upgradeSubscription.error} />
        </div>
      </Dialog>

      {/* Cancel Takolio Pro Dialog */}
      <Dialog
        open={cancelOpen}
        title={vi.users.lifecycle.cancelTitle}
        onClose={() => setCancelOpen(false)}
        testId="admin-user-cancel-plan-dialog"
        footer={
          <>
            <Button onClick={() => setCancelOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-user-cancel-plan-confirm"
              disabled={cancelSubscription.isPending || cancelReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                cancelSubscription.mutate(
                  {
                    userId: user.id,
                    immediate: cancelImmediate,
                    reason: cancelReason.trim(),
                  },
                  {
                    onSuccess: () => {
                      setCancelOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.cancelSuccess);
                    },
                  },
                );
              }}
            >
              {cancelSubscription.isPending ? vi.common.processing : vi.users.lifecycle.cancelConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.cancelDescription}</p>
          <div className="checkbox-field">
            <input
              id="admin-user-cancel-immediate"
              data-testid="admin-user-cancel-immediate"
              type="checkbox"
              checked={cancelImmediate}
              onChange={(event) => setCancelImmediate(event.target.checked)}
            />
            <label htmlFor="admin-user-cancel-immediate">{vi.users.lifecycle.cancelImmediateLabel}</label>
          </div>
          <p className="field-hint">
            {cancelImmediate ? vi.users.lifecycle.cancelImmediateHint : vi.users.lifecycle.cancelAtEndHint}
          </p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-cancel-reason">
            <input
              id="admin-user-cancel-reason"
              data-testid="admin-user-cancel-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </Field>
          <InlineError error={cancelSubscription.error} />
        </div>
      </Dialog>

      {/* Suspend User Dialog */}
      <Dialog
        open={suspendOpen}
        title={vi.users.lifecycle.suspendTitle}
        onClose={() => setSuspendOpen(false)}
        testId="admin-user-suspend-dialog"
        footer={
          <>
            <Button onClick={() => setSuspendOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-user-suspend-confirm"
              disabled={suspendUser.isPending || suspendReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                suspendUser.mutate(
                  { userId: user.id, reason: suspendReason.trim() },
                  {
                    onSuccess: () => {
                      setSuspendOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.suspendSuccess);
                    },
                  },
                );
              }}
            >
              {suspendUser.isPending ? vi.common.processing : vi.users.lifecycle.suspendConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.suspendDescription}</p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-suspend-reason">
            <input
              id="admin-user-suspend-reason"
              data-testid="admin-user-suspend-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
            />
          </Field>
          <InlineError error={suspendUser.error} />
        </div>
      </Dialog>

      {/* Unsuspend User Dialog */}
      <Dialog
        open={unsuspendOpen}
        title={vi.users.lifecycle.unsuspendTitle}
        onClose={() => setUnsuspendOpen(false)}
        testId="admin-user-unsuspend-dialog"
        footer={
          <>
            <Button onClick={() => setUnsuspendOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-user-unsuspend-confirm"
              disabled={unsuspendUser.isPending || unsuspendReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                unsuspendUser.mutate(
                  { userId: user.id, reason: unsuspendReason.trim() },
                  {
                    onSuccess: () => {
                      setUnsuspendOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.unsuspendSuccess);
                    },
                  },
                );
              }}
            >
              {unsuspendUser.isPending ? vi.common.processing : vi.users.lifecycle.unsuspendConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.unsuspendDescription}</p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-unsuspend-reason">
            <input
              id="admin-user-unsuspend-reason"
              data-testid="admin-user-unsuspend-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={unsuspendReason}
              onChange={(event) => setUnsuspendReason(event.target.value)}
            />
          </Field>
          <InlineError error={unsuspendUser.error} />
        </div>
      </Dialog>

      {/* Delete / Anonymize User Dialog */}
      <Dialog
        open={deleteOpen}
        title={vi.users.lifecycle.deleteTitle}
        onClose={() => setDeleteOpen(false)}
        testId="admin-user-delete-dialog"
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-user-delete-confirm"
              disabled={deleteUser.isPending || !deleteConfirmMatched || deleteReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                deleteUser.mutate(
                  { userId: user.id, mode: deleteMode, reason: deleteReason.trim() },
                  {
                    onSuccess: () => {
                      setDeleteOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.deleteSuccess);
                    },
                  },
                );
              }}
            >
              {deleteUser.isPending ? vi.common.processing : vi.users.lifecycle.deleteConfirmButton}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.deleteDescription}</p>
          <div className="card-inset" style={{ display: 'grid', gap: '10px' }}>
            <label className="checkbox-field" htmlFor="admin-user-delete-mode-anonymize">
              <input
                id="admin-user-delete-mode-anonymize"
                data-testid="admin-user-delete-mode-anonymize"
                type="radio"
                name="deleteMode"
                value="anonymize"
                checked={deleteMode === 'anonymize'}
                onChange={() => setDeleteMode('anonymize')}
              />
              <div>
                <strong>{vi.users.lifecycle.deleteModeAnonymize}</strong>
                <p className="field-hint">{vi.users.lifecycle.deleteModeAnonymizeHint}</p>
              </div>
            </label>
            <label className="checkbox-field" htmlFor="admin-user-delete-mode-purge">
              <input
                id="admin-user-delete-mode-purge"
                data-testid="admin-user-delete-mode-purge"
                type="radio"
                name="deleteMode"
                value="purge"
                checked={deleteMode === 'purge'}
                onChange={() => setDeleteMode('purge')}
              />
              <div>
                <strong>{vi.users.lifecycle.deleteModePurge}</strong>
                <p className="field-hint">{vi.users.lifecycle.deleteModePurgeHint}</p>
              </div>
            </label>
          </div>
          <Field label='Nhập "XOA" để xác nhận' htmlFor="admin-user-delete-confirm-word">
            <input
              id="admin-user-delete-confirm-word"
              data-testid="admin-user-delete-confirm-word"
              type="text"
              placeholder="XOA"
              value={deleteConfirmWord}
              onChange={(event) => setDeleteConfirmWord(event.target.value)}
            />
          </Field>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-delete-reason">
            <input
              id="admin-user-delete-reason"
              data-testid="admin-user-delete-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
            />
          </Field>
          <InlineError error={deleteUser.error} />
        </div>
      </Dialog>

      {/* Revoke User Sessions Dialog */}
      <Dialog
        open={revokeSessionsOpen}
        title={vi.users.lifecycle.revokeSessionsTitle}
        onClose={() => setRevokeSessionsOpen(false)}
        testId="admin-user-revoke-sessions-dialog"
        footer={
          <>
            <Button onClick={() => setRevokeSessionsOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-user-revoke-sessions-confirm"
              disabled={revokeUserSessions.isPending || revokeSessionsReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                revokeUserSessions.mutate(
                  { userId: user.id, reason: revokeSessionsReason.trim() },
                  {
                    onSuccess: (res) => {
                      setRevokeSessionsOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.revokeSessionsSuccess(res.revokedSessions));
                    },
                  },
                );
              }}
            >
              {revokeUserSessions.isPending ? vi.common.processing : vi.users.lifecycle.revokeSessionsConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.revokeSessionsDescription}</p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-revoke-sessions-reason">
            <input
              id="admin-user-revoke-sessions-reason"
              data-testid="admin-user-revoke-sessions-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={revokeSessionsReason}
              onChange={(event) => setRevokeSessionsReason(event.target.value)}
            />
          </Field>
          <InlineError error={revokeUserSessions.error} />
        </div>
      </Dialog>

      {/* Verify Email Dialog */}
      <Dialog
        open={verifyOpen}
        title={vi.users.lifecycle.verifyEmailTitle}
        onClose={() => setVerifyOpen(false)}
        testId="admin-user-verify-email-dialog"
        footer={
          <>
            <Button onClick={() => setVerifyOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-user-verify-email-confirm"
              disabled={verifyUserEmail.isPending || verifyReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                verifyUserEmail.mutate(
                  { userId: user.id, reason: verifyReason.trim() },
                  {
                    onSuccess: () => {
                      setVerifyOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.verifyEmailSuccess);
                    },
                  },
                );
              }}
            >
              {verifyUserEmail.isPending ? vi.common.processing : vi.users.lifecycle.verifyEmailConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.verifyEmailDescription}</p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-verify-email-reason">
            <input
              id="admin-user-verify-email-reason"
              data-testid="admin-user-verify-email-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={verifyReason}
              onChange={(event) => setVerifyReason(event.target.value)}
            />
          </Field>
          <InlineError error={verifyUserEmail.error} />
        </div>
      </Dialog>

      {/* Reset Scan Quota Dialog */}
      <Dialog
        open={resetQuotaOpen}
        title={vi.users.lifecycle.resetQuotaTitle}
        onClose={() => setResetQuotaOpen(false)}
        testId="admin-user-reset-quota-dialog"
        footer={
          <>
            <Button onClick={() => setResetQuotaOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-user-reset-quota-confirm"
              disabled={resetUserQuota.isPending || resetQuotaReason.trim().length < 3}
              onClick={() => {
                setFeedbackNotice(null);
                resetUserQuota.mutate(
                  { userId: user.id, reason: resetQuotaReason.trim() },
                  {
                    onSuccess: () => {
                      setResetQuotaOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.resetQuotaSuccess);
                    },
                  },
                );
              }}
            >
              {resetUserQuota.isPending ? vi.common.processing : vi.users.lifecycle.resetQuotaConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.resetQuotaDescription}</p>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-reset-quota-reason">
            <input
              id="admin-user-reset-quota-reason"
              data-testid="admin-user-reset-quota-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={resetQuotaReason}
              onChange={(event) => setResetQuotaReason(event.target.value)}
            />
          </Field>
          <InlineError error={resetUserQuota.error} />
        </div>
      </Dialog>

      {/* Direct User Notification Dialog */}
      <Dialog
        open={notifyOpen}
        title={vi.users.lifecycle.notifyTitle}
        onClose={() => setNotifyOpen(false)}
        testId="admin-user-notify-dialog"
        footer={
          <>
            <Button onClick={() => setNotifyOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="primary"
              data-testid="admin-user-notify-confirm"
              disabled={
                notifyUser.isPending ||
                !notifyTitle.trim() ||
                !notifyMessage.trim() ||
                notifyReason.trim().length < 3
              }
              onClick={() => {
                setFeedbackNotice(null);
                notifyUser.mutate(
                  {
                    userId: user.id,
                    title: notifyTitle.trim(),
                    message: notifyMessage.trim(),
                    type: notifyType,
                    reason: notifyReason.trim(),
                  },
                  {
                    onSuccess: () => {
                      setNotifyOpen(false);
                      setFeedbackNotice(vi.users.lifecycle.notifySuccess);
                    },
                  },
                );
              }}
            >
              {notifyUser.isPending ? vi.common.processing : vi.users.lifecycle.notifyConfirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.lifecycle.notifyDescription}</p>
          <Field label={vi.users.lifecycle.notifyTypeLabel} htmlFor="admin-user-notify-type">
            <select
              id="admin-user-notify-type"
              data-testid="admin-user-notify-type"
              value={notifyType}
              onChange={(event) => setNotifyType(event.target.value as AdminNotificationType)}
            >
              {NOTIFICATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {vi.labels.notificationType[type] ?? type}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vi.users.lifecycle.notifySubjectLabel} htmlFor="admin-user-notify-title">
            <input
              id="admin-user-notify-title"
              data-testid="admin-user-notify-title"
              type="text"
              maxLength={120}
              required
              placeholder={vi.users.lifecycle.notifySubjectPlaceholder}
              value={notifyTitle}
              onChange={(event) => setNotifyTitle(event.target.value)}
            />
          </Field>
          <Field label={vi.users.lifecycle.notifyMessageLabel} htmlFor="admin-user-notify-message">
            <textarea
              id="admin-user-notify-message"
              data-testid="admin-user-notify-message"
              rows={3}
              maxLength={1000}
              required
              placeholder={vi.users.lifecycle.notifyMessagePlaceholder}
              value={notifyMessage}
              onChange={(event) => setNotifyMessage(event.target.value)}
            />
          </Field>
          <Field label={vi.users.lifecycle.reasonLabel} htmlFor="admin-user-notify-reason">
            <input
              id="admin-user-notify-reason"
              data-testid="admin-user-notify-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.lifecycle.reasonPlaceholder}
              value={notifyReason}
              onChange={(event) => setNotifyReason(event.target.value)}
            />
          </Field>
          <InlineError error={notifyUser.error} />
        </div>
      </Dialog>
    </>
  );
}
