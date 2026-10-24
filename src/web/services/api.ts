// Compatibility facade; domain modules retain ownership-fenced server and offline operations.
import { ApiError, fetchJson, isNonRetryable, getCurrentScope } from './http';
import { flush, getPendingOps } from '../lib/sync';
import { capturePrivateSession, privateSessionBlocked } from '../lib/private-session';
import { authApi } from './auth';
import { inventoryApi } from './inventory';
import { inventoryTruthApi } from './inventory-truth';
import { scansApi } from './scans';
import { recipesApi } from './recipes';
import { discoveryApi } from './recipe-discovery';
import { shoppingApi } from './shopping';
import { weekApi } from './week';
import { notificationsApi } from './notifications';
import { billingApi } from './billing';
import { invalidateReplayedQueries } from '../lib/query-invalidation';

export { ApiError, isOffline, clearTenantCaches } from './http';
export type { ApiErrorKind } from './http';

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

  retryPendingWrites: async (): Promise<{ attempted: number; remaining: number }> => {
    const scope = getCurrentScope();
    const pending = getPendingOps();
    if (privateSessionBlocked() || !scope.userId || !scope.householdId ||
      !pending.some((op) => op.userId === scope.userId && op.householdId === scope.householdId)) {
      return { attempted: 0, remaining: pending.length };
    }
    const isCurrent = capturePrivateSession();
    const replayedPaths: string[] = [];
    try {
      return await flush(
        async (op) => {
          if (!isCurrent()) throw new ApiError('auth', 'Đồng bộ riêng tư đã tạm dừng.');
          // The cookie may have changed in another tab. Local storage is not authorization.
          const me = await api.getMe({ requireServer: true });
          if (!isCurrent() || me.user?.id !== op.userId || me.user?.household?.id !== op.householdId) {
            throw new ApiError('auth', 'Chủ sở hữu thao tác không khớp với phiên máy chủ.');
          }
          await fetchJson(op.path, { method: op.method, body: op.body, headers: op.headers });
          if (isCurrent()) replayedPaths.push(op.path);
        },
        isNonRetryable,
        { scope: getCurrentScope, canReplay: isCurrent }
      );
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
