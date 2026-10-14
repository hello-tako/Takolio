import { useState, type FormEvent } from 'react';
import { ADMIN_ROLE_LABELS_VI, ADMIN_ROLES, ADMIN_SUPER_ADMIN_MINIMUM, type AdminApproval, type AdminPreferences, type AdminRoleAssignment, type AdminRole } from '@shared/admin';
import { type AdminSessionRow, useAdminSessions, useDecideApproval, useGrantRole, useMe, useRevokeRole, useRevokeSession, useSavePreferences, useSettings } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { Badge, Button, DefinitionList, ErrorState, Field, InlineError, LoadingState, Notice, PageHeader, Section, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDate, formatDateTime } from '../lib/format';
import { hasPermission } from '../lib/nav';
import { storeSidebarPreference } from '../lib/hooks';

const ASSIGNMENT_TONE: Record<string, Tone> = { active: 'success', revoked: 'neutral' };
const APPROVAL_TONE: Record<string, Tone> = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'neutral', cancelled: 'neutral' };

function ProfileSection() {
  const me = useMe();
  if (!me.data) return null;
  const user = me.data;
  return (
    <Section title={vi.settings.profile}>
      <DefinitionList
        items={[
          { label: vi.settings.displayName, value: user.displayName },
          { label: vi.users.email, value: <span className="mono">{user.email}</span> },
          {
            label: vi.settings.roles,
            value: user.roles.length ? user.roles.map((role) => ADMIN_ROLE_LABELS_VI[role]).join(', ') : vi.settings.noRoles,
          },
          { label: vi.settings.sessionMethod, value: vi.labels.authMethod[user.session.authMethod] ?? user.session.authMethod },
          { label: vi.settings.sessionCreated, value: formatDateTime(user.session.createdAt) },
          { label: vi.settings.sessionExpires, value: formatDateTime(user.session.expiresAt) },
          { label: vi.settings.sessionIdle, value: formatDateTime(user.session.idleExpiresAt) },
          { label: vi.settings.rbacVersion, value: <span className="mono">{user.rbacMatrixVersion}</span> },
        ]}
      />
    </Section>
  );
}

function PreferencesForm({ initial }: { initial: AdminPreferences }) {
  const save = useSavePreferences();
  const [draft, setDraft] = useState<AdminPreferences>(initial);
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    save.mutate(draft, {
      onSuccess: () => {
        storeSidebarPreference(draft.sidebarCollapsed);
        setSaved(true);
      },
    });
  };

  return (
    <Section title={vi.settings.preferences}>
      <form className="settings-form" onSubmit={onSubmit} data-testid="admin-preferences-form">
        <Field label={vi.settings.locale} htmlFor="admin-pref-locale" hint={vi.settings.localeHint}>
          <select id="admin-pref-locale" value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value as AdminPreferences['locale'] })}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={vi.settings.density} htmlFor="admin-pref-density">
          <select id="admin-pref-density" value={draft.density} onChange={(event) => setDraft({ ...draft, density: event.target.value as AdminPreferences['density'] })}>
            <option value="comfortable">{vi.settings.densityComfortable}</option>
            <option value="compact">{vi.settings.densityCompact}</option>
          </select>
        </Field>
        <div className="field checkbox-field">
          <input
            id="admin-pref-sidebar"
            type="checkbox"
            checked={draft.sidebarCollapsed}
            onChange={(event) => setDraft({ ...draft, sidebarCollapsed: event.target.checked })}
          />
          <label htmlFor="admin-pref-sidebar">{vi.settings.sidebarCollapsed}</label>
        </div>
        <InlineError error={save.error} />
        {saved ? (
          <p className="form-success" role="status" data-testid="admin-preferences-saved">
            {vi.settings.preferencesSaved}
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? vi.common.loading : vi.common.save}
        </Button>
      </form>
    </Section>
  );
}

function MatrixSection({ matrix }: { matrix: Array<{ permission: string; label: string; roles: AdminRole[] }> }) {
  return (
    <Section title={vi.settings.matrix} description={vi.settings.matrixCaption}>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.settings.matrixCaption}>
        <table className="data-table matrix" data-testid="admin-settings-matrix">
          <caption className="sr-only">{vi.settings.matrixCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{vi.settings.permission}</th>
              {ADMIN_ROLES.map((role) => (
                <th scope="col" key={role}>
                  {ADMIN_ROLE_LABELS_VI[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.permission}>
                <th scope="row">{row.label}</th>
                {ADMIN_ROLES.map((role) => {
                  const granted = row.roles.includes(role);
                  return (
                    <td key={role} className="matrix-cell">
                      <span aria-hidden="true">{granted ? '✓' : '—'}</span>
                      <span className="sr-only">{granted ? vi.settings.matrixMark : vi.settings.matrixNone}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function RolesSection({
  assignments,
  canManage,
  currentUserId,
}: {
  assignments: AdminRoleAssignment[];
  canManage: boolean;
  currentUserId: string;
}) {
  const revoke = useRevokeRole();
  const grant = useGrantRole();
  const [target, setTarget] = useState<AdminRoleAssignment | null>(null);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantRole, setGrantRole] = useState<AdminRole>('CONTENT_EDITOR');
  const [grantMessage, setGrantMessage] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const activeSupers = assignments.filter((item) => item.role === 'SUPER_ADMIN' && item.status === 'active').length;

  const onGrant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGrantMessage(null);
    grant.mutate(
      { userId: grantUserId.trim(), role: grantRole },
      {
        onSuccess: (result) => {
          setGrantUserId('');
          setGrantMessage('approval' in result ? vi.settings.approvalRequested : vi.settings.grantRecorded);
        },
      },
    );
  };

  return (
    <>
      <Section title={vi.settings.assignments} description={vi.settings.grantSuperAdminNote}>
        {assignments.length === 0 ? (
          <p className="muted">{vi.settings.noRoles}</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.settings.assignmentsCaption}>
            <table className="data-table">
              <caption className="sr-only">{vi.settings.assignmentsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.settings.assignmentColumns.user}</th>
                  <th scope="col">{vi.settings.assignmentColumns.role}</th>
                  <th scope="col">{vi.settings.assignmentColumns.status}</th>
                  <th scope="col">{vi.settings.assignmentColumns.source}</th>
                  <th scope="col">{vi.settings.assignmentColumns.grantedBy}</th>
                  <th scope="col">{vi.settings.assignmentColumns.grantedAt}</th>
                  <th scope="col">{vi.settings.assignmentColumns.action}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const isSelf = assignment.userId === currentUserId;
                  return (
                    <tr key={assignment.id} data-testid="admin-role-assignment-row">
                      <td>
                        {assignment.userDisplayName ?? vi.users.anonymous}
                        <div className="mono muted">{assignment.userEmailMasked ?? vi.common.dash}</div>
                      </td>
                      <td>{ADMIN_ROLE_LABELS_VI[assignment.role]}</td>
                      <td>
                        <Badge tone={ASSIGNMENT_TONE[assignment.status] ?? 'neutral'}>{vi.labels.assignmentStatus[assignment.status]}</Badge>
                      </td>
                      <td>{vi.labels.grantSource[assignment.grantSource] ?? assignment.grantSource}</td>
                      <td className="mono">{assignment.grantedBy ?? vi.common.dash}</td>
                      <td>{formatDate(assignment.grantedAt)}</td>
                      <td>
                        {canManage && assignment.status === 'active' ? (
                          isSelf ? (
                            <span className="muted small">{vi.settings.revokeSelf}</span>
                          ) : (
                            assignment.role === 'SUPER_ADMIN' && activeSupers <= ADMIN_SUPER_ADMIN_MINIMUM ? (
                              <span className="muted small" data-testid="admin-role-revoke-blocked">{vi.settings.revokeSuperMinimum}</span>
                            ) : (
                              <Button variant="danger" className="btn-small" data-testid="admin-role-revoke" onClick={() => { setRevokeMessage(null); setTarget(assignment); }}>
                                {vi.settings.revoke}
                              </Button>
                            )
                          )
                        ) : (
                          vi.common.dash
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {revokeMessage ? (
          <p className="form-success" role="status" data-testid="admin-notice">
            {revokeMessage}
          </p>
        ) : null}
      </Section>

      {canManage ? (
        <Section title={vi.settings.grantTitle}>
          <form className="settings-form" onSubmit={onGrant} data-testid="admin-grant-form">
            <Field label={vi.settings.grantUserId} htmlFor="admin-grant-user-id">
              <input
                id="admin-grant-user-id"
                data-testid="admin-grant-user"
                type="text"
                maxLength={100}
                required
                value={grantUserId}
                onChange={(event) => setGrantUserId(event.target.value)}
              />
            </Field>
            <Field label={vi.settings.grantRole} htmlFor="admin-grant-role">
              <select id="admin-grant-role" data-testid="admin-grant-role" value={grantRole} onChange={(event) => setGrantRole(event.target.value as AdminRole)}>
                {ADMIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ADMIN_ROLE_LABELS_VI[role]}
                  </option>
                ))}
              </select>
            </Field>
            <InlineError error={grant.error} />
            {grantMessage ? (
              <p className="form-success" role="status" data-testid="admin-notice">
                {grantMessage}
              </p>
            ) : null}
            <Button type="submit" variant="primary" data-testid="admin-grant-submit" disabled={grant.isPending || grantUserId.trim() === ''}>
              {grant.isPending ? vi.settings.grantSubmitting : vi.settings.grantSubmit}
            </Button>
          </form>
        </Section>
      ) : null}

      <Dialog
        open={target !== null}
        title={vi.settings.revokeTitle}
        onClose={() => setTarget(null)}
        testId="admin-revoke-dialog"
        footer={
          <>
            <Button onClick={() => setTarget(null)}>{vi.common.cancel}</Button>
            <Button
              variant="danger"
              data-testid="admin-revoke-confirm"
              disabled={revoke.isPending}
              onClick={() => {
                if (!target) return;
                revoke.mutate(target.id, {
                  onSuccess: (result) => {
                    setTarget(null);
                    setRevokeMessage('approval' in result ? vi.settings.approvalRequested : vi.settings.revokeDone);
                  },
                });
              }}
            >
              {vi.settings.revoke}
            </Button>
          </>
        }
      >
        {target ? (
          <p>
            {target.role === 'SUPER_ADMIN'
              ? vi.settings.revokeSuperBody(target.userDisplayName ?? target.userEmailMasked ?? target.userId)
              : vi.settings.revokeBody(ADMIN_ROLE_LABELS_VI[target.role], target.userDisplayName ?? target.userEmailMasked ?? target.userId)}
          </p>
        ) : null}
        <InlineError error={revoke.error} />
      </Dialog>
    </>
  );
}

function ApprovalsSection({ approvals, canDecide, currentUserId }: { approvals: AdminApproval[]; canDecide: boolean; currentUserId: string }) {
  const decide = useDecideApproval();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Section title={vi.settings.approvals}>
      {approvals.length === 0 ? (
        <p className="muted">{vi.settings.approvalsEmpty}</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.settings.approvalsCaption}>
          <table className="data-table">
            <caption className="sr-only">{vi.settings.approvalsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{vi.settings.approvalColumns.kind}</th>
                <th scope="col">{vi.settings.approvalColumns.target}</th>
                <th scope="col">{vi.settings.approvalColumns.requestedBy}</th>
                <th scope="col">{vi.settings.approvalColumns.requestedAt}</th>
                <th scope="col">{vi.settings.approvalColumns.status}</th>
                <th scope="col">{vi.settings.approvalColumns.expires}</th>
                <th scope="col">{vi.settings.approvalColumns.decidedBy}</th>
                <th scope="col">{vi.settings.approvalColumns.action}</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => {
                // Four-eyes: neither the requester nor the affected user may decide.
                const involved = approval.requestedBy === currentUserId || approval.targetUserId === currentUserId;
                const canAct = canDecide && approval.status === 'pending' && !involved;
                return (
                  <tr key={approval.id} data-testid="admin-approval-row">
                    <td>{vi.settings.approvalActions[approval.action] ?? approval.action}</td>
                    <td className="mono">{approval.targetUserId}</td>
                    <td className="mono">{approval.requestedBy}</td>
                    <td>{formatDateTime(approval.requestedAt)}</td>
                    <td>
                      <Badge tone={APPROVAL_TONE[approval.status] ?? 'neutral'}>{vi.labels.approvalStatus[approval.status] ?? approval.status}</Badge>
                    </td>
                    <td>{formatDateTime(approval.expiresAt)}</td>
                    <td className="mono">{approval.decidedBy ?? vi.common.dash}</td>
                    <td>
                      {canAct ? (
                        <div className="button-row">
                          <Button
                            variant="primary"
                            className="btn-small"
                            data-testid="admin-approval-approve"
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate(
                                { approvalId: approval.id, decision: 'approve' },
                                { onSuccess: () => setMessage(vi.settings.approvalDone) },
                              )
                            }
                          >
                            {vi.settings.approve}
                          </Button>
                          <Button
                            variant="danger"
                            className="btn-small"
                            data-testid="admin-approval-reject"
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate(
                                { approvalId: approval.id, decision: 'reject' },
                                { onSuccess: () => setMessage(vi.settings.approvalDone) },
                              )
                            }
                          >
                            {vi.settings.reject}
                          </Button>
                        </div>
                      ) : approval.status === 'pending' && involved ? (
                        <span className="muted small">{vi.settings.approvalNotAllowed}</span>
                      ) : (
                        vi.common.dash
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <InlineError error={decide.error} />
      {message ? (
        <p className="form-success" role="status" data-testid="admin-notice">
          {message}
        </p>
      ) : null}
    </Section>
  );
}

function SessionsSection({ sessions, currentSessionId }: { sessions: AdminSessionRow[]; currentSessionId: string }) {
  const revoke = useRevokeSession();
  return (
    <Section title={vi.settings.sessions}>
      {sessions.length === 0 ? (
        <p className="muted">{vi.settings.sessionsEmpty}</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.settings.sessionsCaption}>
          <table className="data-table">
            <caption className="sr-only">{vi.settings.sessionsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{vi.settings.sessionColumns.user}</th>
                <th scope="col">{vi.settings.sessionColumns.method}</th>
                <th scope="col">{vi.settings.sessionColumns.created}</th>
                <th scope="col">{vi.settings.sessionColumns.lastSeen}</th>
                <th scope="col">{vi.settings.sessionColumns.expires}</th>
                <th scope="col">{vi.settings.sessionColumns.action}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} data-testid="admin-session-row">
                  <td className="mono">{session.userId}</td>
                  <td>{vi.labels.authMethod[session.authMethod] ?? session.authMethod}</td>
                  <td>{formatDateTime(session.createdAt)}</td>
                  <td>{formatDateTime(session.lastSeenAt)}</td>
                  <td>{formatDateTime(session.expiresAt)}</td>
                  <td>
                    {session.id === currentSessionId ? (
                      vi.settings.self
                    ) : (
                      <Button variant="danger" className="btn-small" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>
                        {vi.settings.revokeSession}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InlineError error={revoke.error} />
    </Section>
  );
}

export function SettingsPage() {
  const me = useMe();
  const settings = useSettings();
  const permissions = me.data?.permissions ?? [];
  const canRolesRead = hasPermission(permissions, 'admin.roles.read');
  const canManage = hasPermission(permissions, 'admin.roles.manage');
  const canDecide = hasPermission(permissions, 'admin.approvals.decide');
  const canRevokeSessions = hasPermission(permissions, 'admin.sessions.revoke');
  const sessions = useAdminSessions(canRevokeSessions);
  const currentUserId = me.data?.userId ?? '';
  const currentSessionId = me.data?.session.id ?? '';

  return (
    <>
      <PageHeader title={vi.settings.title} description={vi.settings.description} />
      <ProfileSection />

      {settings.isPending ? <LoadingState rows={4} /> : null}
      {settings.isError ? <ErrorState error={settings.error} onRetry={() => void settings.refetch()} /> : null}
      {settings.data ? (
        <>
          {/* Not keyed on server data: a refetch after saving must not remount the form and drop its success state. */}
          <PreferencesForm initial={settings.data.preferences} />
          <MatrixSection matrix={settings.data.matrix} />
          {canRolesRead ? (
            <>
              <RolesSection assignments={settings.data.assignments} canManage={canManage} currentUserId={currentUserId} />
              <ApprovalsSection approvals={settings.data.approvals} canDecide={canDecide} currentUserId={currentUserId} />
            </>
          ) : (
            <Notice tone="info">{vi.settings.permissionDeniedSection}</Notice>
          )}
          {canRevokeSessions ? (
            sessions.isPending ? (
              <LoadingState rows={2} />
            ) : sessions.isError ? (
              <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
            ) : (
              <SessionsSection sessions={sessions.data ?? []} currentSessionId={currentSessionId} />
            )
          ) : null}
        </>
      ) : null}
    </>
  );
}
