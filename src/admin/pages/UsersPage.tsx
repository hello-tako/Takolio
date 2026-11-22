import clsx from 'clsx';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import type { AdminAccountStatus, AdminHouseholdMember } from '@shared/admin';
import {
  useHouseholdDetail,
  useHouseholds,
  useMe,
  usePurgeGuestHouseholds,
  useUpdateHousehold,
  useUsers,
  type HouseholdListParams,
  type UserListParams,
} from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { Drawer } from '../components/Drawer';
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
  Pagination,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { useDebouncedValue } from '../lib/hooks';
import { hasPermission } from '../lib/nav';

const PAGE_SIZE = 25;

const ACCOUNT_STATUS_TONE: Record<AdminAccountStatus, Tone> = {
  active: 'success',
  suspended: 'warning',
  deleted: 'danger',
};

const ACCOUNT_STATUS_FILTERS: ReadonlyArray<{ value: '' | AdminAccountStatus; label: string }> = [
  { value: '', label: vi.common.all },
  { value: 'active', label: vi.labels.accountStatus.active ?? 'Hoạt động' },
  { value: 'suspended', label: vi.labels.accountStatus.suspended ?? 'Tạm khóa' },
  { value: 'deleted', label: vi.labels.accountStatus.deleted ?? 'Đã xóa' },
];

export function DirectoryTabs({ active }: { active: 'users' | 'households' }) {
  const me = useMe();
  const permissions = me.data?.permissions ?? [];
  const canUsers = hasPermission(permissions, 'users.read');
  const canHouseholds = hasPermission(permissions, 'households.read');
  return (
    <nav className="tabs" aria-label={vi.users.title}>
      {canUsers ? (
        <NavLink to="/users" data-testid="admin-users-tab" className={active === 'users' ? 'tab is-active' : 'tab'} end>
          {vi.users.tabUsers}
        </NavLink>
      ) : null}
      {canHouseholds ? (
        <NavLink
          to="/households"
          data-testid="admin-households-tab"
          className={active === 'households' ? 'tab is-active' : 'tab'}
        >
          {vi.users.tabHouseholds}
        </NavLink>
      ) : null}
    </nav>
  );
}

function PlanBadge({ plan }: { plan: 'free' | 'plus' }) {
  const tone: Tone = plan === 'plus' ? 'brand' : 'neutral';
  return <Badge tone={tone}>{vi.labels.subscription[plan]}</Badge>;
}

function AccountStatusBadge({ status }: { status?: AdminAccountStatus }) {
  const resolved: AdminAccountStatus = status ?? 'active';
  return (
    <Badge tone={ACCOUNT_STATUS_TONE[resolved] ?? 'neutral'}>
      {vi.labels.accountStatus[resolved] ?? resolved}
    </Badge>
  );
}

export function UsersPage() {
  const me = useMe();
  const permissions = me.data?.permissions ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('accountStatus');
  const validInitialStatus: '' | AdminAccountStatus =
    initialStatus === 'active' || initialStatus === 'suspended' || initialStatus === 'deleted'
      ? initialStatus
      : '';

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [accountStatus, setAccountStatus] = useState<'' | AdminAccountStatus>(validInitialStatus);
  const [type, setType] = useState<NonNullable<UserListParams['type']>>('registered');
  const [plan, setPlan] = useState<'' | 'free' | 'plus'>('');
  const [admin, setAdmin] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const paramStatus = searchParams.get('accountStatus');
    if (paramStatus === 'active' || paramStatus === 'suspended' || paramStatus === 'deleted') {
      setAccountStatus(paramStatus);
    }
  }, [searchParams]);

  const params: UserListParams = {
    q: search || undefined,
    page,
    pageSize: PAGE_SIZE,
    type,
    plan: plan || undefined,
    accountStatus: accountStatus || undefined,
    admin: admin || undefined,
  };
  const users = useUsers(params);

  const resetPage = () => setPage(1);
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value.slice(0, 100));
    resetPage();
  };

  const selectAccountStatus = (next: '' | AdminAccountStatus) => {
    setAccountStatus(next);
    resetPage();
    setSearchParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set('accountStatus', next);
        else updated.delete('accountStatus');
        return updated;
      },
      { replace: true },
    );
  };

  return (
    <>
      <PageHeader title={vi.users.title} description={vi.users.description} />
      <DirectoryTabs active="users" />
      <section className="card">
        <div className="filter-chips" role="group" aria-label={vi.users.accountStatus}>
          {ACCOUNT_STATUS_FILTERS.map((chip) => (
            <button
              key={chip.value || 'all'}
              type="button"
              className={clsx('chip-btn', accountStatus === chip.value && 'is-active')}
              aria-pressed={accountStatus === chip.value}
              data-testid={`admin-users-status-chip-${chip.value || 'all'}`}
              onClick={() => selectAccountStatus(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <Field label={vi.users.search} htmlFor="admin-users-search-input">
            <input
              id="admin-users-search-input"
              data-testid="admin-users-search"
              type="search"
              placeholder={
                hasPermission(permissions, 'users.pii.reveal')
                  ? vi.users.searchPlaceholderPii
                  : vi.users.searchPlaceholderBasic
              }
              maxLength={100}
              value={searchInput}
              onChange={onSearch}
            />
          </Field>
          <Field label={vi.users.type} htmlFor="admin-users-type">
            <select
              id="admin-users-type"
              data-testid="admin-users-type-filter"
              value={type}
              onChange={(event) => {
                setType(event.target.value as typeof type);
                resetPage();
              }}
            >
              {(['registered', 'guest', 'all'] as const).map((value) => (
                <option key={value} value={value}>
                  {vi.labels.userType[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vi.users.plan} htmlFor="admin-users-plan">
            <select
              id="admin-users-plan"
              data-testid="admin-users-plan-filter"
              value={plan}
              onChange={(event) => {
                setPlan(event.target.value as typeof plan);
                resetPage();
              }}
            >
              <option value="">{vi.users.planAll}</option>
              <option value="free">{vi.labels.subscription.free}</option>
              <option value="plus">{vi.labels.subscription.plus}</option>
            </select>
          </Field>
          <Field label={vi.users.platformAdmin} htmlFor="admin-users-admin">
            <select
              id="admin-users-admin"
              data-testid="admin-users-admin-filter"
              value={admin}
              onChange={(event) => {
                setAdmin(event.target.value as typeof admin);
                resetPage();
              }}
            >
              <option value="">{vi.users.adminAll}</option>
              <option value="true">{vi.users.adminYes}</option>
              <option value="false">{vi.users.adminNo}</option>
            </select>
          </Field>
        </div>

        {users.isPending ? <LoadingState rows={5} /> : null}
        {users.isError ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : null}
        {users.data && users.data.items.length === 0 ? <EmptyState /> : null}
        {users.data && users.data.items.length > 0 ? (
          <div
            className={users.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={users.isPlaceholderData}
            tabIndex={0}
            role="region"
            aria-label={vi.users.caption}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.users.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.users.columns.name}</th>
                  <th scope="col">{vi.users.columns.email}</th>
                  <th scope="col">{vi.users.columns.type}</th>
                  <th scope="col">{vi.users.columns.status}</th>
                  <th scope="col">{vi.users.columns.plan}</th>
                  <th scope="col">{vi.users.columns.households}</th>
                  <th scope="col">{vi.users.columns.created}</th>
                  <th scope="col">{vi.users.columns.lastSeen}</th>
                  <th scope="col">{vi.users.columns.admin}</th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user) => (
                  <tr key={user.id} data-testid="admin-user-row">
                    <td>
                      <Link to={`/users/${encodeURIComponent(user.id)}`} className="row-link">
                        {user.displayName ?? vi.users.anonymous}
                      </Link>
                    </td>
                    <td>
                      <span className="mono">{user.emailMasked ?? vi.common.dash}</span>
                    </td>
                    <td>{user.isGuest ? vi.users.guest : vi.users.registered}</td>
                    <td>
                      <AccountStatusBadge status={user.accountStatus} />
                    </td>
                    <td>
                      <PlanBadge plan={user.plan} />
                    </td>
                    <td>{user.householdCount}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{formatDateTime(user.lastSeenAt)}</td>
                    <td>{user.isPlatformAdmin ? <Badge tone="brand">{vi.users.platformAdmin}</Badge> : vi.common.dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {users.data ? (
          <Pagination
            page={users.data.page}
            pageSize={users.data.pageSize}
            total={users.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </>
  );
}

function HouseholdDetailDrawer({
  householdId,
  canWrite,
  onClose,
}: {
  householdId: string | undefined;
  canWrite: boolean;
  onClose: () => void;
}) {
  const detail = useHouseholdDetail(householdId);
  const updateHousehold = useUpdateHousehold();

  const [renameValue, setRenameValue] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingMemberAction, setPendingMemberAction] = useState<{
    kind: 'remove' | 'transfer';
    member: AdminHouseholdMember;
  } | null>(null);
  const [memberReason, setMemberReason] = useState('');

  useEffect(() => {
    if (detail.data) {
      setRenameValue(detail.data.name);
      setRenameReason('');
      setActionMessage(null);
    }
  }, [detail.data]);

  const onRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail.data || !renameValue.trim() || renameReason.trim().length < 3) return;
    setActionMessage(null);
    updateHousehold.mutate(
      {
        householdId: detail.data.id,
        name: renameValue.trim(),
        reason: renameReason.trim(),
      },
      {
        onSuccess: () => {
          setRenameReason('');
          setActionMessage(vi.users.householdDrawer.renameSuccess);
        },
      },
    );
  };

  const confirmMemberAction = () => {
    if (!detail.data || !pendingMemberAction || memberReason.trim().length < 3) return;
    const isRemove = pendingMemberAction.kind === 'remove';
    setActionMessage(null);
    updateHousehold.mutate(
      {
        householdId: detail.data.id,
        ...(isRemove
          ? { removeUserId: pendingMemberAction.member.userId }
          : { newOwnerUserId: pendingMemberAction.member.userId }),
        reason: memberReason.trim(),
      },
      {
        onSuccess: () => {
          setPendingMemberAction(null);
          setMemberReason('');
          setActionMessage(
            isRemove
              ? vi.users.householdDrawer.removeMemberSuccess
              : vi.users.householdDrawer.transferOwnerSuccess,
          );
        },
      },
    );
  };

  return (
    <>
      <Drawer
        open={Boolean(householdId)}
        title={detail.data?.name ?? vi.users.householdDrawer.title}
        onClose={onClose}
        testId="admin-household-drawer"
      >
        {detail.isPending ? <LoadingState rows={4} /> : null}
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : null}
        {detail.data ? (
          <>
            {actionMessage ? (
              <Notice tone="success" testId="admin-household-action-notice">
                {actionMessage}
              </Notice>
            ) : null}

            <div className="card-inset">
              <h3>{vi.users.householdDrawer.overview}</h3>
              <DefinitionList
                items={[
                  {
                    label: vi.users.householdDrawer.inventoryMode,
                    value: (
                      <Badge tone={detail.data.inventoryMode === 'native' ? 'brand' : 'neutral'}>
                        {vi.labels.inventoryMode[detail.data.inventoryMode] ?? detail.data.inventoryMode}
                      </Badge>
                    ),
                  },
                  {
                    label: vi.users.householdColumns.owner,
                    value: detail.data.ownerDisplayName ?? detail.data.ownerUserId,
                  },
                  {
                    label: vi.users.householdColumns.created,
                    value: formatDate(detail.data.createdAt),
                  },
                ]}
              />
              <div className="kv-grid" style={{ marginTop: '12px', marginBottom: 0 }}>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.itemCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.itemCount)}</strong>
                </div>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.lotCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.lotCount)}</strong>
                </div>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.expiringCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.expiringCount)}</strong>
                </div>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.mealPlanCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.mealPlanCount)}</strong>
                </div>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.cookedMealCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.cookedMealCount)}</strong>
                </div>
                <div className="kv-item">
                  <span className="kv-label">{vi.users.householdDrawer.shoppingListCount}</span>
                  <strong className="kv-value">{formatNumber(detail.data.shoppingListCount)}</strong>
                </div>
              </div>
            </div>

            <div className="card-inset">
              <h3>{vi.users.householdDrawer.membersTitle}</h3>
              {detail.data.members.length === 0 ? (
                <p className="muted">{vi.users.householdDrawer.membersEmpty}</p>
              ) : (
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={vi.users.householdDrawer.membersTitle}
                >
                  <table className="data-table">
                    <caption className="sr-only">{vi.users.householdDrawer.membersTitle}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{vi.users.householdDrawer.memberColumns.name}</th>
                        <th scope="col">{vi.users.householdDrawer.memberColumns.email}</th>
                        <th scope="col">{vi.users.householdDrawer.memberColumns.role}</th>
                        <th scope="col">{vi.users.householdDrawer.memberColumns.joined}</th>
                        {canWrite ? <th scope="col">{vi.users.householdDrawer.memberColumns.action}</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.members.map((member) => {
                        const isOwner = member.userId === detail.data.ownerUserId;
                        return (
                          <tr key={member.id} data-testid="admin-household-member-row">
                            <td>
                              <Link to={`/users/${encodeURIComponent(member.userId)}`} className="row-link">
                                {member.displayName ?? vi.users.anonymous}
                              </Link>
                            </td>
                            <td className="mono">{member.emailMasked ?? vi.common.dash}</td>
                            <td>
                              {isOwner ? (
                                <Badge tone="brand">{vi.users.householdDrawer.ownerBadge}</Badge>
                              ) : (
                                <Badge tone="neutral">{member.role}</Badge>
                              )}
                            </td>
                            <td>{formatDate(member.createdAt)}</td>
                            {canWrite ? (
                              <td>
                                {!isOwner ? (
                                  <div className="button-row">
                                    <Button
                                      variant="secondary"
                                      className="btn-small"
                                      data-testid="admin-household-transfer-owner"
                                      onClick={() => {
                                        setMemberReason('');
                                        setPendingMemberAction({ kind: 'transfer', member });
                                      }}
                                    >
                                      {vi.users.householdDrawer.transferOwnerSubmit}
                                    </Button>
                                    <Button
                                      variant="danger"
                                      className="btn-small"
                                      data-testid="admin-household-remove-member"
                                      onClick={() => {
                                        setMemberReason('');
                                        setPendingMemberAction({ kind: 'remove', member });
                                      }}
                                    >
                                      {vi.users.householdDrawer.removeMemberButton}
                                    </Button>
                                  </div>
                                ) : (
                                  vi.common.dash
                                )}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {canWrite ? (
              <form className="card-inset modal-form" onSubmit={onRenameSubmit} data-testid="admin-household-rename-form">
                <h3>{vi.users.householdDrawer.renameTitle}</h3>
                <Field label={vi.users.householdDrawer.renameLabel} htmlFor="admin-household-rename-input">
                  <input
                    id="admin-household-rename-input"
                    data-testid="admin-household-rename-input"
                    type="text"
                    maxLength={120}
                    required
                    placeholder={vi.users.householdDrawer.renamePlaceholder}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                  />
                </Field>
                <Field label={vi.users.householdDrawer.reasonLabel} htmlFor="admin-household-rename-reason">
                  <input
                    id="admin-household-rename-reason"
                    data-testid="admin-household-rename-reason"
                    type="text"
                    maxLength={500}
                    required
                    placeholder={vi.users.householdDrawer.reasonPlaceholder}
                    value={renameReason}
                    onChange={(event) => setRenameReason(event.target.value)}
                  />
                </Field>
                <InlineError error={updateHousehold.error} />
                <div className="button-row">
                  <Button
                    type="submit"
                    variant="primary"
                    data-testid="admin-household-rename-submit"
                    disabled={updateHousehold.isPending || !renameValue.trim() || renameReason.trim().length < 3}
                  >
                    {updateHousehold.isPending ? vi.common.processing : vi.users.householdDrawer.renameSubmit}
                  </Button>
                </div>
              </form>
            ) : null}
          </>
        ) : null}
      </Drawer>

      <Dialog
        open={pendingMemberAction !== null}
        title={
          pendingMemberAction?.kind === 'remove'
            ? vi.users.householdDrawer.removeMemberTitle
            : vi.users.householdDrawer.transferOwnerTitle
        }
        onClose={() => setPendingMemberAction(null)}
        testId="admin-household-member-dialog"
        footer={
          <>
            <Button onClick={() => setPendingMemberAction(null)}>{vi.common.cancel}</Button>
            <Button
              variant={pendingMemberAction?.kind === 'remove' ? 'danger' : 'primary'}
              data-testid="admin-household-member-confirm"
              disabled={updateHousehold.isPending || memberReason.trim().length < 3}
              onClick={confirmMemberAction}
            >
              {pendingMemberAction?.kind === 'remove'
                ? vi.users.householdDrawer.removeMemberConfirm
                : vi.users.householdDrawer.transferOwnerSubmit}
            </Button>
          </>
        }
      >
        {pendingMemberAction ? (
          <div className="modal-form">
            <p>
              {pendingMemberAction.kind === 'remove'
                ? vi.users.householdDrawer.removeMemberBody(
                    pendingMemberAction.member.displayName ??
                      pendingMemberAction.member.emailMasked ??
                      pendingMemberAction.member.userId,
                  )
                : `${vi.users.householdDrawer.transferOwnerLabel}: ${
                    pendingMemberAction.member.displayName ??
                    pendingMemberAction.member.emailMasked ??
                    pendingMemberAction.member.userId
                  }`}
            </p>
            <Field label={vi.users.householdDrawer.reasonLabel} htmlFor="admin-household-member-reason">
              <input
                id="admin-household-member-reason"
                data-testid="admin-household-member-reason"
                type="text"
                maxLength={500}
                required
                placeholder={vi.users.householdDrawer.reasonPlaceholder}
                value={memberReason}
                onChange={(event) => setMemberReason(event.target.value)}
              />
            </Field>
            <InlineError error={updateHousehold.error} />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

export function HouseholdsPage() {
  const me = useMe();
  const permissions = me.data?.permissions ?? [];
  const canWrite = hasPermission(permissions, 'households.write');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>(undefined);

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgeNotice, setPurgeNotice] = useState<string | null>(null);

  const params: HouseholdListParams = { q: search || undefined, page, pageSize: PAGE_SIZE };
  const households = useHouseholds(params);
  const purgeGuests = usePurgeGuestHouseholds();

  const onConfirmPurge = () => {
    if (purgeReason.trim().length < 3) return;
    setPurgeNotice(null);
    purgeGuests.mutate(
      { olderThanDays, reason: purgeReason.trim() },
      {
        onSuccess: (result) => {
          setPurgeOpen(false);
          setPurgeReason('');
          setPurgeNotice(vi.users.purgeGuests.success(result.deletedHouseholds, result.deletedGuestUsers));
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title={vi.users.title}
        description={vi.users.description}
        actions={
          canWrite ? (
            <Button
              variant="secondary"
              data-testid="admin-purge-guests-btn"
              onClick={() => {
                setPurgeReason('');
                setPurgeOpen(true);
              }}
            >
              {vi.users.purgeGuests.button}
            </Button>
          ) : undefined
        }
      />
      <DirectoryTabs active="households" />

      {purgeNotice ? (
        <Notice tone="success" testId="admin-purge-guests-notice">
          {purgeNotice}
        </Notice>
      ) : null}

      <section className="card">
        <div className="toolbar">
          <Field label={vi.users.searchHouseholds} htmlFor="admin-households-search-input">
            <input
              id="admin-households-search-input"
              data-testid="admin-households-search"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value.slice(0, 100));
                setPage(1);
              }}
            />
          </Field>
        </div>
        {households.isPending ? <LoadingState rows={5} /> : null}
        {households.isError ? <ErrorState error={households.error} onRetry={() => void households.refetch()} /> : null}
        {households.data && households.data.items.length === 0 ? <EmptyState /> : null}
        {households.data && households.data.items.length > 0 ? (
          <div
            className={households.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={households.isPlaceholderData}
            tabIndex={0}
            role="region"
            aria-label={vi.users.householdCaption}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.users.householdCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.users.householdColumns.name}</th>
                  <th scope="col">{vi.users.householdColumns.owner}</th>
                  <th scope="col">{vi.users.householdColumns.members}</th>
                  <th scope="col">{vi.users.householdColumns.items}</th>
                  <th scope="col">{vi.users.householdColumns.created}</th>
                  <th scope="col">{vi.users.householdColumns.action}</th>
                </tr>
              </thead>
              <tbody>
                {households.data.items.map((household) => (
                  <tr
                    key={household.id}
                    data-testid="admin-household-row"
                    onClick={() => setSelectedHouseholdId(household.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong>{household.name}</strong>
                    </td>
                    <td>{household.ownerDisplayName ?? vi.users.anonymous}</td>
                    <td>{household.memberCount}</td>
                    <td>{household.inventoryItemCount}</td>
                    <td>{formatDate(household.createdAt)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Button
                        variant="ghost"
                        className="btn-small"
                        data-testid="admin-household-detail-btn"
                        onClick={() => setSelectedHouseholdId(household.id)}
                      >
                        {vi.users.openDetail}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {households.data ? (
          <Pagination
            page={households.data.page}
            pageSize={households.data.pageSize}
            total={households.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <HouseholdDetailDrawer
        householdId={selectedHouseholdId}
        canWrite={canWrite}
        onClose={() => setSelectedHouseholdId(undefined)}
      />

      <Dialog
        open={purgeOpen}
        title={vi.users.purgeGuests.title}
        onClose={() => setPurgeOpen(false)}
        testId="admin-purge-guests-dialog"
        footer={
          <>
            <Button onClick={() => setPurgeOpen(false)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-purge-guests-confirm"
              disabled={purgeGuests.isPending || purgeReason.trim().length < 3}
              onClick={onConfirmPurge}
            >
              {purgeGuests.isPending ? vi.common.processing : vi.users.purgeGuests.confirm}
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p>{vi.users.purgeGuests.description}</p>
          <Field
            label={vi.users.purgeGuests.olderThanDaysLabel}
            htmlFor="admin-purge-guests-days"
            hint={vi.users.purgeGuests.olderThanDaysHint}
          >
            <input
              id="admin-purge-guests-days"
              data-testid="admin-purge-guests-days"
              type="number"
              min={1}
              max={365}
              value={olderThanDays}
              onChange={(event) => setOlderThanDays(Math.max(1, Math.min(365, Number(event.target.value) || 30)))}
            />
          </Field>
          <Field label={vi.users.purgeGuests.reasonLabel} htmlFor="admin-purge-guests-reason">
            <input
              id="admin-purge-guests-reason"
              data-testid="admin-purge-guests-reason"
              type="text"
              maxLength={500}
              required
              placeholder={vi.users.purgeGuests.reasonPlaceholder}
              value={purgeReason}
              onChange={(event) => setPurgeReason(event.target.value)}
            />
          </Field>
          <InlineError error={purgeGuests.error} />
        </div>
      </Dialog>
    </>
  );
}
