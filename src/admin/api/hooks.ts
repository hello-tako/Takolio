import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  AdminAccountStatus,
  AdminAiSummary,
  AdminAiUsageRow,
  AdminApproval,
  AdminAuditEvent,
  AdminAuthConfig,
  AdminBillingMarkPaidRequest,
  AdminBillingMarkPaidResult,
  AdminBillingRefundRequest,
  AdminBillingRefundResult,
  AdminBillingResolveRequest,
  AdminBillingResolveResult,
  AdminBillingSummary,
  AdminCancelSubscriptionRequest,
  AdminCancelSubscriptionResult,
  AdminDataContext,
  AdminDeleteUserRequest,
  AdminDeleteUserResult,
  AdminGrantRoleRequest,
  AdminGrantRoleResult,
  AdminHouseholdDetail,
  AdminHouseholdSummary,
  AdminLoginRequest,
  AdminMe,
  AdminNotifyUserRequest,
  AdminNotifyUserResult,
  AdminOverview,
  AdminPage,
  AdminPreferences,
  AdminPurgeGuestHouseholdsRequest,
  AdminPurgeGuestHouseholdsResult,
  AdminRange,
  AdminRecipeDetail,
  AdminRecipeMediaRejectRequest,
  AdminRecipeMediaRejectResult,
  AdminRecipeMetadataUpdateRequest,
  AdminRecipeMetadataUpdateResult,
  AdminRecipeReviewRequest,
  AdminRecipesSummary,
  AdminRecipeSummary,
  AdminRecipeVerificationRequest,
  AdminRecipeVerificationResult,
  AdminResetQuotaRequest,
  AdminResetQuotaResult,
  AdminRevokeRoleResult,
  AdminRevokeUserSessionsRequest,
  AdminRevokeUserSessionsResult,
  AdminScanJobActionResult,
  AdminScanJobCancelRequest,
  AdminScanJobRetryRequest,
  AdminScanJobRow,
  AdminSettings,
  AdminSuspendUserRequest,
  AdminSuspendUserResult,
  AdminSystemBroadcastRequest,
  AdminSystemBroadcastResult,
  AdminSystemHygieneRequest,
  AdminSystemHygieneResult,
  AdminSystemStatus,
  AdminTransaction,
  AdminUnsuspendUserRequest,
  AdminUnsuspendUserResult,
  AdminUpdateHouseholdRequest,
  AdminUpdateHouseholdResult,
  AdminUpgradeSubscriptionRequest,
  AdminUpgradeSubscriptionResult,
  AdminUserDetail,
  AdminUserSummary,
  AdminVerifyEmailRequest,
  AdminVerifyEmailResult,
} from '@shared/admin';
import { adminData, adminFetch, setMemoryCsrfToken } from './client';

export type UserListParams = {
  q?: string;
  page: number;
  pageSize: number;
  type?: 'registered' | 'guest' | 'all';
  plan?: 'free' | 'plus';
  accountStatus?: AdminAccountStatus;
  admin?: 'true' | 'false';
};

export type HouseholdListParams = { q?: string; page: number; pageSize: number };

export type TransactionParams = {
  status?: string;
  q?: string;
  plan?: string;
  page: number;
  pageSize: number;
};

export type AiUsageParams = { task?: string; status?: string; page: number; pageSize: number };

export type ScanJobsParams = { status?: string; scanType?: string; page: number; pageSize: number };

export type RecipeListParams = {
  q?: string;
  cuisine?: string;
  verification?: string;
  source?: string;
  page: number;
  pageSize: number;
};

export type AuditParams = {
  action?: string;
  outcome?: string;
  actor?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

/** Session row from GET /sessions (admin.sessions.revoke). Not part of the shared DTO set. */
export interface AdminSessionRow {
  id: string;
  userId: string;
  authMethod: string;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
}

export interface AdminLoginResponse {
  data: AdminMe;
  context: AdminDataContext;
  csrfToken: string;
}

export const adminKeys = {
  authConfig: ['admin', 'auth-config'] as const,
  me: ['admin', 'me'] as const,
  overviewAll: ['admin', 'overview'] as const,
  overview: (range: AdminRange) => ['admin', 'overview', range] as const,
  usersAll: ['admin', 'users'] as const,
  users: (params: UserListParams) => ['admin', 'users', params] as const,
  userAll: ['admin', 'user'] as const,
  userById: (id: string) => ['admin', 'user', id] as const,
  user: (id: string, reveal: boolean) => ['admin', 'user', id, reveal ? 'email' : 'masked'] as const,
  householdsAll: ['admin', 'households'] as const,
  households: (params: HouseholdListParams) => ['admin', 'households', params] as const,
  household: (id: string) => ['admin', 'households', 'detail', id] as const,
  billing: ['admin', 'billing'] as const,
  billingSummary: (range: AdminRange) => ['admin', 'billing', 'summary', range] as const,
  transactions: (params: TransactionParams) => ['admin', 'billing', 'transactions', params] as const,
  ai: ['admin', 'ai'] as const,
  aiSummary: (range: AdminRange) => ['admin', 'ai', 'summary', range] as const,
  aiUsage: (params: AiUsageParams) => ['admin', 'ai', 'usage', params] as const,
  scanJobs: (params: ScanJobsParams) => ['admin', 'ai', 'scan-jobs', params] as const,
  recipes: ['admin', 'recipes'] as const,
  recipeList: (params: RecipeListParams) => ['admin', 'recipes', 'list', params] as const,
  recipeSummary: ['admin', 'recipes', 'summary'] as const,
  recipe: (id: string) => ['admin', 'recipes', 'detail', id] as const,
  system: ['admin', 'system'] as const,
  auditAll: ['admin', 'audit'] as const,
  audit: (params: AuditParams) => ['admin', 'audit', params] as const,
  settings: ['admin', 'settings'] as const,
  sessions: ['admin', 'sessions'] as const,
};

// Public endpoint: `{ data: { mode } }`, no context.
async function fetchAuthConfig(): Promise<AdminAuthConfig> {
  const body = await adminFetch<{ data: AdminAuthConfig }>('GET', '/auth/config');
  return body.data;
}

// ── Read Queries ───────────────────────────────────────────────────────────

export function useAuthConfig() {
  return useQuery({
    queryKey: adminKeys.authConfig,
    queryFn: fetchAuthConfig,
    staleTime: 5 * 60_000,
  });
}

export function useMe() {
  return useQuery({
    queryKey: adminKeys.me,
    queryFn: async () => {
      const me = await adminData<AdminMe>('GET', '/me');
      // /me re-issues the session-bound CSRF token after a reload.
      setMemoryCsrfToken(me.csrfToken);
      return me;
    },
    staleTime: 60_000,
  });
}

export function useOverview(range: AdminRange) {
  return useQuery({
    queryKey: adminKeys.overview(range),
    queryFn: () => adminData<AdminOverview>('GET', '/overview', { query: { range } }),
    placeholderData: keepPreviousData,
  });
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () =>
      adminData<AdminPage<AdminUserSummary>>('GET', '/users', {
        query: {
          q: params.q,
          page: params.page,
          pageSize: params.pageSize,
          type: params.type,
          plan: params.plan,
          accountStatus: params.accountStatus,
          admin: params.admin,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetail(userId: string | undefined, reveal: boolean) {
  return useQuery({
    queryKey: adminKeys.user(userId ?? '', reveal),
    queryFn: () =>
      adminData<AdminUserDetail>('GET', `/users/${encodeURIComponent(userId ?? '')}`, {
        query: { reveal: reveal ? 'email' : undefined },
      }),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export function useHouseholds(params: HouseholdListParams) {
  return useQuery({
    queryKey: adminKeys.households(params),
    queryFn: () =>
      adminData<AdminPage<AdminHouseholdSummary>>('GET', '/households', {
        query: { q: params.q, page: params.page, pageSize: params.pageSize },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useHouseholdDetail(householdId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.household(householdId ?? ''),
    queryFn: () =>
      adminData<AdminHouseholdDetail>('GET', `/households/${encodeURIComponent(householdId ?? '')}`),
    enabled: Boolean(householdId),
    placeholderData: keepPreviousData,
  });
}

export function useBillingSummary(range: AdminRange) {
  return useQuery({
    queryKey: adminKeys.billingSummary(range),
    queryFn: () => adminData<AdminBillingSummary>('GET', '/billing/summary', { query: { range } }),
    placeholderData: keepPreviousData,
  });
}

export function useTransactions(params: TransactionParams) {
  return useQuery({
    queryKey: adminKeys.transactions(params),
    queryFn: () =>
      adminData<AdminPage<AdminTransaction>>('GET', '/billing/transactions', {
        query: {
          status: params.status,
          q: params.q,
          plan: params.plan,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAiSummary(range: AdminRange) {
  return useQuery({
    queryKey: adminKeys.aiSummary(range),
    queryFn: () => adminData<AdminAiSummary>('GET', '/ai/summary', { query: { range } }),
    placeholderData: keepPreviousData,
  });
}

export function useAiUsage(params: AiUsageParams) {
  return useQuery({
    queryKey: adminKeys.aiUsage(params),
    queryFn: () =>
      adminData<AdminPage<AdminAiUsageRow>>('GET', '/ai/usage', {
        query: { task: params.task, status: params.status, page: params.page, pageSize: params.pageSize },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useScanJobs(params: ScanJobsParams) {
  return useQuery({
    queryKey: adminKeys.scanJobs(params),
    queryFn: () =>
      adminData<AdminPage<AdminScanJobRow>>('GET', '/ai/scan-jobs', {
        query: { status: params.status, scanType: params.scanType, page: params.page, pageSize: params.pageSize },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRecipes(params: RecipeListParams) {
  return useQuery({
    queryKey: adminKeys.recipeList(params),
    queryFn: () =>
      adminData<AdminPage<AdminRecipeSummary>>('GET', '/recipes', {
        query: {
          q: params.q,
          cuisine: params.cuisine,
          verification: params.verification,
          source: params.source,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRecipesSummary() {
  return useQuery({
    queryKey: adminKeys.recipeSummary,
    queryFn: () => adminData<AdminRecipesSummary>('GET', '/recipes/summary'),
  });
}

export function useRecipe(recipeId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.recipe(recipeId ?? ''),
    queryFn: () => adminData<AdminRecipeDetail>('GET', `/recipes/${encodeURIComponent(recipeId ?? '')}`),
    enabled: Boolean(recipeId),
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: adminKeys.system,
    queryFn: () => adminData<AdminSystemStatus>('GET', '/system/status'),
  });
}

export function useAuditEvents(params: AuditParams) {
  return useQuery({
    queryKey: adminKeys.audit(params),
    queryFn: () =>
      adminData<AdminPage<AdminAuditEvent>>('GET', '/audit', {
        query: {
          action: params.action,
          outcome: params.outcome,
          actor: params.actor,
          from: params.from,
          to: params.to,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => adminData<AdminSettings>('GET', '/settings'),
  });
}

export function useAdminSessions(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.sessions,
    queryFn: () => adminData<AdminSessionRow[]>('GET', '/sessions'),
    enabled,
  });
}

// ── Auth & Governance Mutations ────────────────────────────────────────────

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminLoginRequest | undefined) =>
      adminFetch<AdminLoginResponse>('POST', '/auth/login', { body, skipCsrf: true }),
    onSuccess: (response) => {
      setMemoryCsrfToken(response.csrfToken);
      queryClient.setQueryData(adminKeys.me, response.data);
    },
  });
}

/** Revokes the server session, then drops every cached admin response. Callers navigate to /login. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await adminFetch<unknown>('POST', '/auth/logout');
    } catch {
      // The session may already be gone; the local state is cleared either way.
    } finally {
      setMemoryCsrfToken(null);
      queryClient.clear();
    }
  }, [queryClient]);
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AdminPreferences>) => adminData<AdminPreferences>('PUT', '/preferences', { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.settings }),
  });
}

export function useReviewRecipe(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminRecipeReviewRequest) =>
      adminData<unknown>('POST', `/recipes/${encodeURIComponent(recipeId)}/reviews`, { body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.recipes }),
  });
}

export function useGrantRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminGrantRoleRequest) => adminData<AdminGrantRoleResult>('POST', '/roles', { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.settings });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
    },
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => adminData<AdminRevokeRoleResult>('DELETE', `/roles/${encodeURIComponent(assignmentId)}`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.settings });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
    },
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, decision }: { approvalId: string; decision: 'approve' | 'reject' }) =>
      adminData<AdminApproval>('POST', `/approvals/${encodeURIComponent(approvalId)}/${decision}`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.settings });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminData<unknown>('POST', `/sessions/${encodeURIComponent(sessionId)}/revoke`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.sessions }),
  });
}

// ── User Lifecycle & Support Mutations ─────────────────────────────────────

export function useUpgradeUserSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminUpgradeSubscriptionRequest) =>
      adminData<AdminUpgradeSubscriptionResult>('POST', `/users/${encodeURIComponent(userId)}/subscription/upgrade`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.billing });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useCancelUserSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminCancelSubscriptionRequest) =>
      adminData<AdminCancelSubscriptionResult>('POST', `/users/${encodeURIComponent(userId)}/subscription/cancel`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.billing });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminSuspendUserRequest) =>
      adminData<AdminSuspendUserResult>('POST', `/users/${encodeURIComponent(userId)}/suspend`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminUnsuspendUserRequest) =>
      adminData<AdminUnsuspendUserResult>('POST', `/users/${encodeURIComponent(userId)}/unsuspend`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminDeleteUserRequest) =>
      adminData<AdminDeleteUserResult>('POST', `/users/${encodeURIComponent(userId)}/delete`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.householdsAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useRevokeUserSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminRevokeUserSessionsRequest) =>
      adminData<AdminRevokeUserSessionsResult>('POST', `/users/${encodeURIComponent(userId)}/sessions/revoke`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useVerifyUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminVerifyEmailRequest) =>
      adminData<AdminVerifyEmailResult>('POST', `/users/${encodeURIComponent(userId)}/verify-email`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useResetUserQuota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminResetQuotaRequest) =>
      adminData<AdminResetQuotaResult>('POST', `/users/${encodeURIComponent(userId)}/quota/reset`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useNotifyUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & AdminNotifyUserRequest) =>
      adminData<AdminNotifyUserResult>('POST', `/users/${encodeURIComponent(userId)}/notify`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.userById(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

// ── Household Mutations ────────────────────────────────────────────────────

export function useUpdateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, ...body }: { householdId: string } & AdminUpdateHouseholdRequest) =>
      adminData<AdminUpdateHouseholdResult>('PATCH', `/households/${encodeURIComponent(householdId)}`, { body }),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.householdsAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.household(variables.householdId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function usePurgeGuestHouseholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminPurgeGuestHouseholdsRequest) =>
      adminData<AdminPurgeGuestHouseholdsResult>('POST', '/households/purge-guests', { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.householdsAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

// ── Billing Mutations ──────────────────────────────────────────────────────

export function useMarkBillingIntentPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intentId, ...body }: { intentId: string } & AdminBillingMarkPaidRequest) =>
      adminData<AdminBillingMarkPaidResult>('POST', `/billing/transactions/${encodeURIComponent(intentId)}/mark-paid`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.billing });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useRefundBillingIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intentId, ...body }: { intentId: string } & AdminBillingRefundRequest) =>
      adminData<AdminBillingRefundResult>('POST', `/billing/transactions/${encodeURIComponent(intentId)}/refund`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.billing });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useResolveBillingIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intentId, ...body }: { intentId: string } & AdminBillingResolveRequest) =>
      adminData<AdminBillingResolveResult>('POST', `/billing/transactions/${encodeURIComponent(intentId)}/resolve`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.billing });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

// ── Recipe Mutations ───────────────────────────────────────────────────────

export function useSetRecipeVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, ...body }: { recipeId: string } & AdminRecipeVerificationRequest) =>
      adminData<AdminRecipeVerificationResult>('POST', `/recipes/${encodeURIComponent(recipeId)}/verification`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.recipes });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useUpdateRecipeMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, ...body }: { recipeId: string } & AdminRecipeMetadataUpdateRequest) =>
      adminData<AdminRecipeMetadataUpdateResult>('PATCH', `/recipes/${encodeURIComponent(recipeId)}`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.recipes });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useRejectRecipeMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, ...body }: { recipeId: string } & AdminRecipeMediaRejectRequest) =>
      adminData<AdminRecipeMediaRejectResult>('POST', `/recipes/${encodeURIComponent(recipeId)}/media/reject`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.recipes });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

// ── AI & OCR Scan Job Mutations ────────────────────────────────────────────

export function useRetryScanJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...body }: { jobId: string } & AdminScanJobRetryRequest) =>
      adminData<AdminScanJobActionResult>('POST', `/ai/scan-jobs/${encodeURIComponent(jobId)}/retry`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.ai });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useCancelScanJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...body }: { jobId: string } & AdminScanJobCancelRequest) =>
      adminData<AdminScanJobActionResult>('POST', `/ai/scan-jobs/${encodeURIComponent(jobId)}/cancel`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.ai });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

// ── System Operations Mutations ────────────────────────────────────────────

export function useRunSystemHygiene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: AdminSystemHygieneRequest) =>
      adminData<AdminSystemHygieneResult>('POST', '/system/hygiene', { body: body ?? {} }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.system });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overviewAll });
      void queryClient.invalidateQueries({ queryKey: adminKeys.settings });
      void queryClient.invalidateQueries({ queryKey: adminKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}

export function useSendSystemBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminSystemBroadcastRequest) =>
      adminData<AdminSystemBroadcastResult>('POST', '/system/broadcast', { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.system });
      void queryClient.invalidateQueries({ queryKey: adminKeys.auditAll });
    },
  });
}
