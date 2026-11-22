/**
 * Takolio Admin Console shared contract (RBAC v3 & typed DTOs).
 *
 * The permission matrix below is the single authorization authority for the
 * console. The worker evaluates it server-side on every admin request; the
 * admin frontend reads the same matrix only to hide navigation or controls,
 * never to grant access. Unknown roles or permissions are denied.
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
  'users.write',
  'users.billing.write',
  'users.suspend',
  'users.delete',
  'households.read',
  'households.write',
  'billing.read',
  'billing.write',
  'ai.read',
  'ai.write',
  'recipes.read',
  'recipes.review',
  'recipes.write',
  'system.read',
  'system.write',
  'audit.read',
  'admin.roles.read',
  'admin.roles.manage',
  'admin.approvals.decide',
  'admin.sessions.revoke',
  'admin.preferences.write',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Bump when the matrix changes; recorded in audit metadata and system status. */
export const ADMIN_RBAC_MATRIX_VERSION = '2026-11-22.v3';

const ALL_ROLES: readonly AdminRole[] = ADMIN_ROLES;

export const ADMIN_PERMISSION_MATRIX: Readonly<Record<AdminPermission, readonly AdminRole[]>> = Object.freeze({
  'admin.self.read': ALL_ROLES,
  'overview.read': ALL_ROLES,
  'users.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'users.pii.reveal': ['SUPER_ADMIN', 'SUPPORT_AGENT'],
  'users.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  'users.billing.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  'users.suspend': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  'users.delete': ['SUPER_ADMIN'],
  'households.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'households.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  'billing.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'billing.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  'ai.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'ai.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  'recipes.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'READ_ONLY_AUDITOR'],
  'recipes.review': ['SUPER_ADMIN', 'CONTENT_EDITOR'],
  'recipes.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR'],
  'system.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'system.write': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
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
  'users.write': 'Hỗ trợ người dùng (xác minh email, đặt lại lượt quét, đăng xuất, thông báo)',
  'users.billing.write': 'Cấp hoặc hủy gói Takolio Pro cho người dùng',
  'users.suspend': 'Tạm khóa và mở khóa tài khoản người dùng',
  'users.delete': 'Ẩn danh hoặc xóa vĩnh viễn tài khoản người dùng',
  'households.read': 'Xem chi tiết hộ gia đình',
  'households.write': 'Chỉnh sửa hộ gia đình và dọn hộ khách',
  'billing.read': 'Xem thanh toán và gói đăng ký',
  'billing.write': 'Xử lý giao dịch thanh toán và đối soát',
  'ai.read': 'Xem vận hành AI & OCR',
  'ai.write': 'Điều khiển hàng đợi quét OCR (thử lại / hủy tác vụ)',
  'recipes.read': 'Xem danh mục công thức',
  'recipes.review': 'Tạo ghi chú biên tập/duyệt công thức',
  'recipes.write': 'Cập nhật công thức, trạng thái xác minh và quản lý media',
  'system.read': 'Xem trạng thái hệ thống',
  'system.write': 'Dọn dẹp dữ liệu hệ thống và gửi thông báo toàn hệ thống',
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

export interface AdminActionQueue {
  pendingReconciliations: number;
  failedScanJobs: number;
  unverifiedRecipes: number;
  suspendedUsers: number;
  pendingApprovals: number;
}

export interface AdminOverview {
  range: AdminRange;
  metrics: AdminMetric[];
  series: AdminSeries[];
  health: { status: 'ok' | 'degraded' | 'unhealthy'; checks: AdminHealthCheck[] };
  incidents: AdminIncident[];
  actionQueue: AdminActionQueue;
}

// ── Users & households ─────────────────────────────────────────────────────

export type AdminAccountStatus = 'active' | 'suspended' | 'deleted';

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  emailMasked: string | null;
  isGuest: boolean;
  isVerified: boolean;
  accountStatus: AdminAccountStatus;
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
  scanQuota: {
    usedThisMonth: number;
    maxPerMonth: number;
  };
  recentTransactions: AdminTransaction[];
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

export interface AdminHouseholdMember {
  id: string;
  userId: string;
  displayName: string | null;
  emailMasked: string | null;
  role: string;
  createdAt: string;
}

export interface AdminHouseholdDetail {
  id: string;
  name: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  createdAt: string;
  inventoryMode: 'native' | 'legacy';
  inventoryVersion: number;
  itemCount: number;
  lotCount: number;
  expiringCount: number;
  mealPlanCount: number;
  cookedMealCount: number;
  shoppingListCount: number;
  members: AdminHouseholdMember[];
}

// ── User & Household Mutation DTOs ─────────────────────────────────────────

export interface AdminReasonRequest {
  reason: string;
}

export type AdminUpgradeDuration = 'monthly' | 'annual' | 'custom';

export interface AdminUpgradeSubscriptionRequest {
  duration: AdminUpgradeDuration;
  customDays?: number;
  reason: string;
  notifyUser?: boolean;
}

export interface AdminUpgradeSubscriptionResult {
  userId: string;
  plan: 'plus';
  status: 'active';
  expiresAt: string;
  notified: boolean;
}

export interface AdminCancelSubscriptionRequest {
  immediate: boolean;
  reason: string;
}

export interface AdminCancelSubscriptionResult {
  userId: string;
  plan: 'free' | 'plus';
  status: string;
  expiresAt: string | null;
  immediate: boolean;
}

export type AdminSuspendUserRequest = AdminReasonRequest;

export interface AdminSuspendUserResult {
  userId: string;
  accountStatus: 'suspended';
  revokedSessions: number;
  updatedAt: string;
}

export type AdminUnsuspendUserRequest = AdminReasonRequest;

export interface AdminUnsuspendUserResult {
  userId: string;
  accountStatus: 'active';
  updatedAt: string;
}

export type AdminDeleteUserMode = 'anonymize' | 'purge';

export interface AdminDeleteUserRequest {
  mode: AdminDeleteUserMode;
  reason: string;
}

export interface AdminDeleteUserResult {
  userId: string;
  mode: AdminDeleteUserMode;
  accountStatus: 'deleted';
  revokedSessions: number;
  deletedAt: string;
}

export type AdminVerifyEmailRequest = AdminReasonRequest;

export interface AdminVerifyEmailResult {
  userId: string;
  isVerified: boolean;
  accountsUpdated: number;
  verifiedAt: string;
}

export type AdminResetQuotaRequest = AdminReasonRequest;

export interface AdminResetQuotaResult {
  userId: string;
  usedThisMonth: number;
  maxPerMonth: number;
  resetAt: string;
}

export type AdminRevokeUserSessionsRequest = AdminReasonRequest;

export interface AdminRevokeUserSessionsResult {
  userId: string;
  revokedSessions: number;
  revokedAt: string;
}

export type AdminNotificationType =
  | 'system'
  | 'announcement'
  | 'support'
  | 'billing'
  | 'expiring_soon'
  | 'cook_ready'
  | 'shopping_reminder';

export interface AdminNotifyUserRequest {
  title: string;
  message: string;
  type?: AdminNotificationType;
  reason: string;
}

export interface AdminNotifyUserResult {
  notificationId: string;
  userId: string;
  type: AdminNotificationType;
  createdAt: string;
}

export interface AdminUpdateHouseholdRequest {
  name?: string;
  newOwnerUserId?: string;
  removeUserId?: string;
  reason: string;
}

export interface AdminUpdateHouseholdResult {
  id: string;
  name: string;
  ownerUserId: string;
  removedUserId: string | null;
  memberCount: number;
  updatedAt: string;
}

export interface AdminPurgeGuestHouseholdsRequest {
  olderThanDays: number;
  reason: string;
}

export interface AdminPurgeGuestHouseholdsResult {
  olderThanDays: number;
  deletedHouseholds: number;
  deletedGuestUsers: number;
  purgedAt: string;
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

export interface AdminBillingMarkPaidRequest {
  reason: string;
  grantDays?: number;
}

export interface AdminBillingMarkPaidResult {
  intentId: string;
  userId: string;
  status: 'paid';
  subscriptionExpiresAt: string;
  reconciliationCleared: boolean;
  updatedAt: string;
}

export interface AdminBillingRefundRequest {
  reason: string;
  revokeSubscription: boolean;
}

export interface AdminBillingRefundResult {
  intentId: string;
  userId: string;
  status: 'refunded';
  subscriptionRevoked: boolean;
  updatedAt: string;
}

export type AdminBillingResolveOutcome = 'expired' | 'failed';

export interface AdminBillingResolveRequest {
  outcome: AdminBillingResolveOutcome;
  reason: string;
}

export interface AdminBillingResolveResult {
  intentId: string;
  status: AdminBillingResolveOutcome;
  reconciliationCleared: boolean;
  updatedAt: string;
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

export interface AdminScanJobRow {
  id: string;
  scanId: string;
  userId: string;
  householdId: string;
  scanType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminScanJobRetryRequest = AdminReasonRequest;
export type AdminScanJobCancelRequest = AdminReasonRequest;

export interface AdminScanJobActionResult {
  id: string;
  scanId: string;
  status: string;
  attempts: number;
  updatedAt: string;
}

// ── Recipes ────────────────────────────────────────────────────────────────

export type AdminRecipeVerificationState = 'unverified' | 'reviewed' | 'rejected';

export interface AdminRecipeSummary {
  id: string;
  slug: string;
  title: string;
  cuisine: string;
  difficulty: string;
  cookTimeMinutes: number;
  sourceType: string;
  verificationState: AdminRecipeVerificationState;
  version: number;
  hasReadyMedia: boolean;
  latestEditorialState: AdminEditorialState | null;
  createdAt: string;
}

export type AdminEditorialState = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface AdminRecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
}

export interface AdminRecipeStep {
  stepNumber: number;
  instruction: string;
  tip: string | null;
  timerMinutes: number | null;
}

export interface AdminRecipeDetail extends AdminRecipeSummary {
  description: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  tags: string[];
  sourceReference: string | null;
  familyId: string | null;
  ingredientCount: number;
  stepCount: number;
  ingredients: AdminRecipeIngredient[];
  steps: AdminRecipeStep[];
  media: Array<{ role: string; version: number; status: string; sourceType: string | null; mimeType: string | null }>;
  editorialReviews: Array<{ id: string; state: AdminEditorialState; note: string; authorUserId: string; recipeVersion: number; createdAt: string }>;
  publication: { canPublish: boolean; note: string };
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

export interface AdminRecipeVerificationRequest {
  verificationState: AdminRecipeVerificationState;
  recipeVersion: number;
  reason: string;
}

export interface AdminRecipeVerificationResult {
  id: string;
  verificationState: AdminRecipeVerificationState;
  version: number;
  updatedAt: string;
}

export interface AdminRecipeMetadataUpdateRequest {
  title?: string;
  description?: string | null;
  cuisine?: string;
  difficulty?: string;
  cookTimeMinutes?: number;
  prepTimeMinutes?: number | null;
  servings?: number;
  tags?: string[];
  reason: string;
}

export interface AdminRecipeMetadataUpdateResult {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
}

export type AdminRecipeMediaRole = 'hero' | 'thumbnail';

export interface AdminRecipeMediaRejectRequest {
  role: AdminRecipeMediaRole;
  version: number;
  reason: string;
}

export interface AdminRecipeMediaRejectResult {
  recipeId: string;
  role: AdminRecipeMediaRole;
  version: number;
  status: 'rejected';
  updatedAt: string;
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

export interface AdminSystemHygieneRequest {
  reason?: string;
}

export interface AdminSystemHygieneResult {
  revokedSessionsDeleted: number;
  legacySessionsDeleted: number;
  expiredOtpsDeleted: number;
  expiredApprovalsClosed: number;
  ranAt: string;
}

export type AdminBroadcastTarget = 'all_registered' | 'pro_only';

export interface AdminSystemBroadcastRequest {
  target: AdminBroadcastTarget;
  title: string;
  message: string;
  reason: string;
}

export interface AdminSystemBroadcastResult {
  target: AdminBroadcastTarget;
  recipientCount: number;
  sentAt: string;
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
 * Approval request. Grants and revocations of SUPER_ADMIN retain an explicit
 * confirmation step; the requester must still be an active SUPER_ADMIN when decided.
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
