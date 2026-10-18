/**
 * Takosan Admin Console V1 shared contract.
 *
 * The permission matrix below is the single authorization authority for the
 * console. The worker evaluates it server-side on every admin request; the
 * admin frontend reads the same matrix only to hide navigation, never to
 * grant access. Unknown roles or permissions are denied.
 */

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'CONTENT_EDITOR',
  'SUPPORT_AGENT',
  'READ_ONLY_AUDITOR',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'admin.self.read',
  'overview.read',
  'users.read',
  'users.pii.reveal',
  'households.read',
  'billing.read',
  'ai.read',
  'recipes.read',
  'recipes.review',
  'system.read',
  'audit.read',
  'admin.roles.read',
  'admin.roles.manage',
  'admin.approvals.decide',
  'admin.sessions.revoke',
  'admin.preferences.write',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Bump when the matrix changes; recorded in audit metadata and system status. */
export const ADMIN_RBAC_MATRIX_VERSION = '2026-10-13.v2';

const ALL_ROLES: readonly AdminRole[] = ADMIN_ROLES;

export const ADMIN_PERMISSION_MATRIX: Readonly<Record<AdminPermission, readonly AdminRole[]>> = Object.freeze({
  'admin.self.read': ALL_ROLES,
  'overview.read': ALL_ROLES,
  'users.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'users.pii.reveal': ['SUPER_ADMIN', 'SUPPORT_AGENT'],
  'households.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'billing.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'ai.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'recipes.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'READ_ONLY_AUDITOR'],
  'recipes.review': ['SUPER_ADMIN', 'CONTENT_EDITOR'],
  'system.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'audit.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'admin.roles.read': ['SUPER_ADMIN', 'READ_ONLY_AUDITOR'],
  'admin.roles.manage': ['SUPER_ADMIN'],
  'admin.approvals.decide': ['SUPER_ADMIN'],
  'admin.sessions.revoke': ['SUPER_ADMIN'],
  'admin.preferences.write': ALL_ROLES,
});

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/** Deny-by-default evaluation; ignores unknown role strings. */
export function hasAdminPermission(roles: readonly string[], permission: string): boolean {
  if (!isAdminPermission(permission)) return false;
  const allowed = ADMIN_PERMISSION_MATRIX[permission];
  return roles.some((role) => isAdminRole(role) && allowed.includes(role));
}

export function permissionsForRoles(roles: readonly string[]): AdminPermission[] {
  return ADMIN_PERMISSIONS.filter((permission) => hasAdminPermission(roles, permission));
}

export const ADMIN_ROLE_LABELS_VI: Readonly<Record<AdminRole, string>> = Object.freeze({
  SUPER_ADMIN: 'Quản trị viên cấp cao',
  OPERATIONS_ADMIN: 'Quản trị vận hành',
  CONTENT_EDITOR: 'Biên tập nội dung',
  SUPPORT_AGENT: 'Nhân viên hỗ trợ',
  READ_ONLY_AUDITOR: 'Kiểm toán (chỉ đọc)',
});

export const ADMIN_PERMISSION_LABELS_VI: Readonly<Record<AdminPermission, string>> = Object.freeze({
  'admin.self.read': 'Xem phiên quản trị của chính mình',
  'overview.read': 'Xem tổng quan',
  'users.read': 'Xem danh sách người dùng (đã che thông tin nhạy cảm)',
  'users.pii.reveal': 'Hiện email đầy đủ của người dùng (có ghi nhật ký)',
  'households.read': 'Xem tóm tắt hộ gia đình',
  'billing.read': 'Xem thanh toán và gói đăng ký (chỉ đọc)',
  'ai.read': 'Xem vận hành AI & OCR',
  'recipes.read': 'Xem danh mục công thức',
  'recipes.review': 'Tạo ghi chú biên tập/duyệt công thức',
  'system.read': 'Xem trạng thái hệ thống',
  'audit.read': 'Xem nhật ký kiểm toán',
  'admin.roles.read': 'Xem phân quyền quản trị',
  'admin.roles.manage': 'Cấp/thu hồi vai trò quản trị',
  'admin.approvals.decide': 'Phê duyệt yêu cầu cấp quyền cao',
  'admin.sessions.revoke': 'Thu hồi phiên quản trị',
  'admin.preferences.write': 'Lưu tùy chọn cá nhân',
});

// ── Transport constants ────────────────────────────────────────────────────

export const ADMIN_API_BASE = '/api/v1/admin';
export const ADMIN_SESSION_COOKIE = '__Host-takosan_admin_session';
/** CSRF token is session-derived and delivered in JSON (login, GET /me); there is no CSRF cookie. */
export const ADMIN_CSRF_HEADER = 'X-Admin-CSRF';
export const ADMIN_SESSION_ABSOLUTE_MINUTES = 8 * 60;
export const ADMIN_SESSION_IDLE_MINUTES = 30;
export const ADMIN_PAGE_SIZE_MAX = 100;
export const ADMIN_PAGE_MAX = 1000;

export type AdminRange = '7d' | '30d' | '90d';
export const ADMIN_RANGES: readonly AdminRange[] = ['7d', '30d', '90d'];

/** Error body shape, matching the existing `{ error, code }` worker convention. */
export interface AdminErrorBody {
  error: string;
  code: AdminErrorCode;
}

export type AdminErrorCode =
  | 'ADMIN_UNAUTHENTICATED'
  | 'ADMIN_SESSION_EXPIRED'
  | 'ADMIN_SESSION_REVOKED'
  | 'ADMIN_FORBIDDEN'
  | 'ADMIN_CSRF_FAILED'
  | 'ADMIN_INVALID_CREDENTIALS'
  | 'ADMIN_AUTH_NOT_CONFIGURED'
  | 'ADMIN_ACCESS_DENIED'
  | 'ADMIN_VALIDATION_FAILED'
  | 'ADMIN_NOT_FOUND'
  | 'ADMIN_CONFLICT'
  | 'ADMIN_GOVERNANCE_INCOMPLETE'
  | 'ADMIN_UNAVAILABLE'
  | 'ADMIN_AUDIT_UNAVAILABLE'
  | 'ADMIN_SCHEMA_MISMATCH'
  | 'ADMIN_FIXTURE_DATA_REJECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RATE_LIMIT_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

/** Every metric is either measured from a named source or explicitly unavailable. */
export type MetricStatus = 'ok' | 'partial' | 'unavailable';

export interface AdminMetric {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'vnd' | 'usd' | 'ms' | 'percent' | 'tokens';
  status: MetricStatus;
  /** Table/adapter the value came from, e.g. `D1:users`. */
  source: string;
  definition: string;
  /** Present when status is `partial` or `unavailable`. */
  note?: string;
}

export interface AdminSeriesPoint {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface AdminSeries {
  key: string;
  label: string;
  unit: AdminMetric['unit'];
  source: string;
  points: AdminSeriesPoint[];
}

export interface AdminDataContext {
  environment: string;
  generatedAt: string;
  /** Set when the database carries a synthetic fixture marker; UI must label data as synthetic. */
  fixtureDataset: string | null;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminEnvelope<T> {
  data: T;
  context: AdminDataContext;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export type AdminAuthMode = 'password' | 'cloudflare_access' | 'unavailable';

/** Public (unauthenticated) answer: the mode only, no environment or configuration hints. */
export interface AdminAuthConfig {
  mode: AdminAuthMode;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminMe {
  userId: string;
  displayName: string;
  /** Own email is shown masked unless the actor holds users.pii.reveal. */
  email: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  session: {
    id: string;
    authMethod: 'password' | 'cloudflare_access';
    createdAt: string;
    expiresAt: string;
    idleExpiresAt: string;
  };
  rbacMatrixVersion: string;
  /** Session-bound CSRF token for the X-Admin-CSRF header; keep in memory only. */
  csrfToken: string;
}

// ── Overview ───────────────────────────────────────────────────────────────

export interface AdminIncident {
  id: string;
  occurredAt: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  source: string;
}

export interface AdminOverview {
  range: AdminRange;
  metrics: AdminMetric[];
  series: AdminSeries[];
  health: { status: 'ok' | 'degraded' | 'unhealthy'; checks: AdminHealthCheck[] };
  incidents: AdminIncident[];
}

// ── Users & households ─────────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  emailMasked: string | null;
  isGuest: boolean;
  isVerified: boolean;
  plan: 'free' | 'plus';
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  householdCount: number;
  createdAt: string;
  lastSeenAt: string | null;
  /** True when the user holds any active admin role (platform admin, not household role). */
  isPlatformAdmin: boolean;
}

export interface AdminUserDetail extends AdminUserSummary {
  /** Full email only when explicitly revealed by an actor with users.pii.reveal. */
  email: string | null;
  emailRevealed: boolean;
  onboardingCompletedAt: string | null;
  authProviders: Array<'password' | 'google'>;
  households: Array<{ id: string; name: string; role: string; memberCount: number; createdAt: string }>;
  activity: {
    activeSessions: number;
    scans30d: number;
    lastScanAt: string | null;
    payments: { paid: number; pending: number; failed: number };
  };
  adminRoles: AdminRole[];
}

export interface AdminHouseholdSummary {
  id: string;
  name: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  memberCount: number;
  inventoryItemCount: number;
  createdAt: string;
}

// ── Billing ────────────────────────────────────────────────────────────────

export interface AdminBillingSummary {
  range: AdminRange;
  metrics: AdminMetric[];
  statusBreakdown: Array<{ status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'; count: number; amountVnd: number }>;
  checkoutStates: Array<{ state: 'dispatching' | 'ready' | 'remote_uncertain'; count: number }>;
  reconciliationExceptions: Array<{ intentId: string; reason: string; firstObservedAt: string; lastObservedAt: string }>;
  series: AdminSeries[];
  /** External provider reconciliation is a future adapter. */
  providerReconciliation: { status: 'unavailable'; note: string };
}

export interface AdminTransaction {
  id: string;
  userId: string;
  /** Last 4 digits only. */
  orderCodeMasked: string;
  plan: string;
  amountVnd: number;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  /** Derived: pending past expires_at is reported as expired. */
  effectiveStatus: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  hasReconciliationRecord: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// ── AI & OCR ───────────────────────────────────────────────────────────────

export interface AdminAiSummary {
  range: AdminRange;
  metrics: AdminMetric[];
  byTask: Array<{ task: string; requests: number; errors: number; avgLatencyMs: number | null; estimatedCostUsd: number }>;
  byModel: Array<{ provider: string; model: string; requests: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number }>;
  ocr: {
    scansByStatus: Array<{ status: string; count: number }>;
    jobsByStatus: Array<{ status: string; count: number }>;
    retriedJobs: number;
    exhaustedJobs: number;
  };
  queue: { localJobStatus: Array<{ status: string; count: number }>; remoteBacklog: { status: 'unavailable'; note: string } };
  instrumentation: { aiRequestsWriter: 'not_wired' | 'wired'; note: string };
  series: AdminSeries[];
}

export interface AdminAiUsageRow {
  id: string;
  task: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  status: string;
  createdAt: string;
}

// ── Recipes ────────────────────────────────────────────────────────────────

export interface AdminRecipeSummary {
  id: string;
  slug: string;
  title: string;
  cuisine: string;
  difficulty: string;
  cookTimeMinutes: number;
  sourceType: string;
  verificationState: 'unverified' | 'reviewed' | 'rejected';
  version: number;
  hasReadyMedia: boolean;
  latestEditorialState: AdminEditorialState | null;
  createdAt: string;
}

export type AdminEditorialState = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface AdminRecipeDetail extends AdminRecipeSummary {
  description: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  tags: string[];
  sourceReference: string | null;
  familyId: string | null;
  ingredientCount: number;
  stepCount: number;
  media: Array<{ role: string; version: number; status: string; sourceType: string | null; mimeType: string | null }>;
  editorialReviews: Array<{ id: string; state: AdminEditorialState; note: string; authorUserId: string; recipeVersion: number; createdAt: string }>;
  /** Publishing into canonical recipe authority is not available in V1. */
  publication: { canPublish: false; note: string };
}

export interface AdminRecipesSummary {
  total: number;
  byVerification: Array<{ state: string; count: number }>;
  bySource: Array<{ sourceType: string; count: number }>;
  byCuisine: Array<{ cuisine: string; count: number }>;
  withReadyMedia: number;
  catalogMode: string;
  editorialQueue: Array<{ state: AdminEditorialState; count: number }>;
}

export interface AdminRecipeReviewRequest {
  state: AdminEditorialState;
  note: string;
  /** Optimistic guard: must equal the recipe's current version. */
  recipeVersion: number;
}

// ── System ─────────────────────────────────────────────────────────────────

export interface AdminHealthCheck {
  key: string;
  label: string;
  status: 'ok' | 'degraded' | 'error' | 'unavailable';
  /** `local` = observed by this worker; `remote` = requires a future provider adapter. */
  observedBy: 'local' | 'remote';
  detail?: string;
}

export interface AdminSystemStatus {
  checks: AdminHealthCheck[];
  release: { gitCommit: string | null; environment: string; rbacMatrixVersion: string };
  database: { reachable: boolean; schemaChecks: Array<{ object: string; present: boolean }> };
  featureFlags: Array<{ key: string; value: string | null }>;
  warnings: Array<{ code: string; message: string }>;
  remoteAdapters: Array<{ key: string; label: string; status: 'unavailable'; note: string }>;
}

// ── Audit ──────────────────────────────────────────────────────────────────

export type AdminAuditOutcome = 'success' | 'denied' | 'failure';

export interface AdminAuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorRoles: AdminRole[];
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: AdminAuditOutcome;
  reasonCode: string | null;
  requestId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface AdminRoleAssignment {
  id: string;
  userId: string;
  userDisplayName: string | null;
  userEmailMasked: string | null;
  role: AdminRole;
  status: 'active' | 'revoked';
  grantSource: 'operator_bootstrap' | 'admin_grant' | 'approval';
  grantedBy: string | null;
  grantedAt: string;
  revokedAt: string | null;
}

export type AdminApprovalAction = 'role.grant.super_admin' | 'role.revoke.super_admin';

/**
 * Four-eyes request. Grants and revocations of SUPER_ADMIN both require a second,
 * distinct SUPER_ADMIN; the requester must still be an active SUPER_ADMIN when it is decided.
 */
export interface AdminApproval {
  id: string;
  action: AdminApprovalAction;
  targetUserId: string;
  /** Set for revocations: the SUPER_ADMIN assignment that will be revoked. */
  assignmentId: string | null;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  decidedBy: string | null;
  decidedAt: string | null;
  expiresAt: string;
}

export interface AdminPreferences {
  locale: 'vi' | 'en';
  density: 'comfortable' | 'compact';
  sidebarCollapsed: boolean;
}

export interface AdminSettings {
  assignments: AdminRoleAssignment[];
  approvals: AdminApproval[];
  matrix: Array<{ permission: AdminPermission; label: string; roles: AdminRole[] }>;
  preferences: AdminPreferences;
  rbacMatrixVersion: string;
}

export interface AdminGrantRoleRequest {
  userId: string;
  role: AdminRole;
}

/** Non-SUPER grants apply immediately; SUPER_ADMIN grants return a pending approval (201). */
export type AdminGrantRoleResult =
  | { assignment: { id: string; userId: string; role: AdminRole; status: 'active' } }
  | { approval: AdminApproval };

/** Non-SUPER revocations apply immediately (200); SUPER_ADMIN revocations return a pending approval (201). */
export type AdminRevokeRoleResult =
  | { assignment: { id: string; status: 'revoked' } }
  | { approval: AdminApproval };

/** Single-owner mode keeps the console operable without a multi-person roster. */
export const ADMIN_SUPER_ADMIN_MINIMUM = 1;
