import { useState, type ChangeEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useHouseholds, useMe, useUsers, type HouseholdListParams, type UserListParams } from '../api/hooks';
import { Badge, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, type Tone } from '../components/ui';
import { useDebouncedValue } from '../lib/hooks';
import { formatDate, formatDateTime } from '../lib/format';
import { hasPermission } from '../lib/nav';
import { vi } from '../i18n/vi';

const PAGE_SIZE = 25;

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
        <NavLink to="/households" data-testid="admin-households-tab" className={active === 'households' ? 'tab is-active' : 'tab'}>
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

export function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [type, setType] = useState<NonNullable<UserListParams['type']>>('registered');
  const [plan, setPlan] = useState<'' | 'free' | 'plus'>('');
  const [admin, setAdmin] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const params: UserListParams = {
    q: search || undefined,
    page,
    pageSize: PAGE_SIZE,
    type,
    plan: plan || undefined,
    admin: admin || undefined,
  };
  const users = useUsers(params);

  const resetPage = () => setPage(1);
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value.slice(0, 100));
    resetPage();
  };

  return (
    <>
      <PageHeader title={vi.users.title} description={vi.users.description} />
      <DirectoryTabs active="users" />
      <section className="card">
        <div className="toolbar">
          <Field label={vi.users.search} htmlFor="admin-users-search-input">
            <input
              id="admin-users-search-input"
              data-testid="admin-users-search"
              type="search"
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
          <div className={users.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'} aria-busy={users.isPlaceholderData}>
            <table className="data-table">
              <caption className="sr-only">{vi.users.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.users.columns.name}</th>
                  <th scope="col">{vi.users.columns.email}</th>
                  <th scope="col">{vi.users.columns.type}</th>
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
          <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPageChange={setPage} />
        ) : null}
      </section>
    </>
  );
}

export function HouseholdsPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const params: HouseholdListParams = { q: search || undefined, page, pageSize: PAGE_SIZE };
  const households = useHouseholds(params);

  return (
    <>
      <PageHeader title={vi.users.title} description={vi.users.description} />
      <DirectoryTabs active="households" />
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
          <div className={households.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'} aria-busy={households.isPlaceholderData}>
            <table className="data-table">
              <caption className="sr-only">{vi.users.householdCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.users.householdColumns.name}</th>
                  <th scope="col">{vi.users.householdColumns.owner}</th>
                  <th scope="col">{vi.users.householdColumns.members}</th>
                  <th scope="col">{vi.users.householdColumns.items}</th>
                  <th scope="col">{vi.users.householdColumns.created}</th>
                </tr>
              </thead>
              <tbody>
                {households.data.items.map((household) => (
                  <tr key={household.id} data-testid="admin-household-row">
                    <td>{household.name}</td>
                    <td>{household.ownerDisplayName ?? vi.users.anonymous}</td>
                    <td>{household.memberCount}</td>
                    <td>{household.inventoryItemCount}</td>
                    <td>{formatDate(household.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {households.data ? (
          <Pagination page={households.data.page} pageSize={households.data.pageSize} total={households.data.total} onPageChange={setPage} />
        ) : null}
      </section>
    </>
  );
}
