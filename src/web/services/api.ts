// Compatibility facade; domain modules retain ownership-fenced server and offline operations.
import { ApiError, fetchJson, isNonRetryable, getCurrentScope, weekPlanCacheKey } from './http';
import { flush, getPendingOps, type PendingOp } from '../lib/sync';
import { capturePrivateSession, onPrivateSessionReset, privateSessionBlocked } from '../lib/private-session';
import { authApi } from './auth';
import { inventoryApi } from './inventory';
import { inventoryTruthApi } from './inventory-truth';
import { scansApi } from './scans';
import { recipesApi } from './recipes';
import { discoveryApi } from './recipe-discovery';
import { shoppingApi } from './shopping';
import { weekApi, isOwnedWeekPlan } from './week';
import { notificationsApi } from './notifications';
import { billingApi } from './billing';
import { invalidateReplayedQueries } from '../lib/query-invalidation';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/queryKeys';
import type { MealPlan } from '@frigo/domain';

export { ApiError, isOffline, clearTenantCaches } from './http';
export type { ApiErrorKind } from './http';

let blockedWeekSwap: { op: PendingOp; isCurrent: () => boolean } | null = null;
onPrivateSessionReset(() => { blockedWeekSwap = null; });

const sameOp = (a: PendingOp, b: PendingOp) => JSON.stringify(a) === JSON.stringify(b);

function explicitWeekSwap(op: PendingOp): { planId: string } | null {
  const match = /^\/week\/plans\/([^/]+)\/meals\/[^/]+\/swap$/.exec(op.path);
  if (op.method !== 'POST' || !match || !op.body) return null;
  try {
    const body: unknown = JSON.parse(op.body);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const { recipeId, commandId, idempotencyKey } = body as Record<string, unknown>;
    const keys = Object.entries(op.headers ?? {}).filter(([key]) => key.toLowerCase() === 'idempotency-key');
    if (typeof recipeId !== 'string' || !recipeId.trim() || recipeId.trim().length > 160 ||
      typeof commandId !== 'string' || !/^[A-Za-z0-9._:-]{8,200}$/.test(commandId) ||
      keys.length !== 1 || keys[0][1] !== commandId ||
      (idempotencyKey !== undefined && idempotencyKey !== commandId)) return null;
    return { planId: match[1] };
  } catch {
    return null;
  }
}

function isSwapConflict(err: unknown, op: PendingOp): boolean {
  return !!explicitWeekSwap(op) && err instanceof ApiError && err.kind === 'http' &&
    err.status === 409 && err.code === 'IDEMPOTENCY_CONFLICT';
}

function getBlockedWeekSwap(): PendingOp | null {
  if (!blockedWeekSwap) return null;
  const scope = getCurrentScope();
  if (!blockedWeekSwap.isCurrent() || scope.userId !== blockedWeekSwap.op.userId ||
    scope.householdId !== blockedWeekSwap.op.householdId ||
    !getPendingOps().some((op) => sameOp(op, blockedWeekSwap!.op))) {
    blockedWeekSwap = null;
    return null;
  }
  return { ...blockedWeekSwap.op, headers: { ...blockedWeekSwap.op.headers } };
}

export const api = {
  ...authApi,
  ...inventoryApi,
  ...inventoryTruthApi,
  ...scansApi,
  ...recipesApi,
  ...discoveryApi,
  ...shoppingApi,
  ...weekApi,
  ...notificationsApi,
  ...billingApi,
  getBlockedWeekSwap,

  retryPendingWrites: async (options?: { discardWeekSwapConflict?: PendingOp }): Promise<{ attempted: number; remaining: number }> => {
    const scope = getCurrentScope();
    const pending = getPendingOps();
    if (privateSessionBlocked() || !scope.userId || !scope.householdId ||
      !pending.some((op) => op.userId === scope.userId && op.householdId === scope.householdId)) {
      return { attempted: 0, remaining: pending.length };
    }
    const isCurrent = capturePrivateSession();
    const assertCurrent = () => {
      if (!isCurrent()) throw new ApiError('auth', 'Đồng bộ riêng tư đã tạm dừng.');
    };
    const approved = options?.discardWeekSwapConflict;
    let acknowledged: unknown;
    let recoveryFailure: unknown;
    const replayedPaths: string[] = [];
    try {
      const result = await flush(
        async (op) => {
          assertCurrent();
          // The cookie may have changed in another tab. Local storage is not authorization.
          const me = await api.getMe({ requireServer: true });
          assertCurrent();
          if (me.user?.id !== op.userId || me.user?.household?.id !== op.householdId) {
            throw new ApiError('auth', 'Chủ sở hữu thao tác không khớp với phiên máy chủ.');
          }
          try {
            await fetchJson(op.path, { method: op.method, body: op.body, headers: op.headers });
            assertCurrent();
            if (blockedWeekSwap && sameOp(blockedWeekSwap.op, op)) blockedWeekSwap = null;
            replayedPaths.push(op.path);
          } catch (err) {
            assertCurrent();
            if (!isSwapConflict(err, op)) throw err;
            const previous = getBlockedWeekSwap();
            blockedWeekSwap = { op, isCurrent };
            if (!approved || !previous || !sameOp(previous, approved) || !sameOp(approved, op)) throw err;
            try {
              const assertApproved = () => {
                assertCurrent();
                const current = getBlockedWeekSwap();
                if (!current || !sameOp(current, approved)) throw new Error('Week swap recovery changed');
              };
              assertApproved();
              const { planId } = explicitWeekSwap(op)!;
              const response = await fetchJson<{ plan: unknown }>(`/week/plans/${planId}`);
              assertApproved();
              if (!isOwnedWeekPlan(response.plan, planId, scope.householdId)) throw new Error('Invalid Week recovery response');
              const plan = response.plan;
              const planKey = queryKeys.weekPlan(planId);
              const currentKey = queryKeys.currentWeekPlan();
              const keys = [planKey];
              if (queryClient.getQueryData<MealPlan | null>(currentKey)?.id === planId) keys.push(currentKey);
              await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey, exact: true })));
              assertApproved();
              const cacheKey = weekPlanCacheKey();
              const raw = localStorage.getItem(cacheKey);
              const cached: unknown = raw ? JSON.parse(raw) : null;
              if ((cached && typeof cached === 'object' && 'id' in cached && cached.id === planId) ||
                queryClient.getQueryData<MealPlan | null>(currentKey)?.id === planId) {
                localStorage.setItem(cacheKey, JSON.stringify(plan));
              }
              assertApproved();
              queryClient.setQueryData(planKey, plan);
              if (queryClient.getQueryData<MealPlan | null>(currentKey)?.id === planId) {
                queryClient.setQueryData(currentKey, plan);
              }
              await invalidateReplayedQueries([op.path]);
              assertApproved();
              acknowledged = err;
            } catch (failure) {
              recoveryFailure = failure;
            }
            // Only explicit acknowledgement may classify this exact conflict for removal.
            throw err;
          }
        },
        (err) => (acknowledged instanceof ApiError && err === acknowledged && isCurrent() &&
          !!approved && !!getBlockedWeekSwap() && sameOp(getBlockedWeekSwap()!, approved)) || isNonRetryable(err),
        { scope: getCurrentScope, canReplay: isCurrent }
      );
      if (recoveryFailure) throw recoveryFailure;
      getBlockedWeekSwap();
      return result;
    } finally {
      if (replayedPaths.length > 0) {
        try {
          if (isCurrent()) await api.getInventory();
          if (isCurrent()) await api.getShoppingList();
          if (isCurrent()) await api.getCurrentWeekPlan();
        } catch {
          // Reconciliation is best-effort; do not mask replay/persistence results.
        }
        try {
          if (isCurrent()) await invalidateReplayedQueries(replayedPaths);
        } catch {
          // Query invalidation is best-effort after authoritative reads.
        }
      }
    }
  },
};
