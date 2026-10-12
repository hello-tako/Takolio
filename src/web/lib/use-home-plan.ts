import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { mealPlanningApi } from '../services/meal-planning';
import { ApiError } from '../services/http';
import { useAuthStore } from '../stores/useAuthStore';
import { isMealPlannerEnabled } from '../features/planner/feature';
import {
  compositionUnavailable,
  isMealCompositionEnabled,
  usePlanCompositions,
} from '../features/planner/composition';
import { queryKeys } from './queryKeys';
import { capturePrivateSession } from './private-session';
import { presentCanonicalHome, presentLegacyHome, type CompositionEvidence } from './home-plan';

export function useHomePlan(now: Date) {
  const client = useQueryClient();
  const enabled = isMealPlannerEnabled();
  const isGuest = useAuthStore((state) => state.isGuest);
  const requiresAccount = enabled && isGuest;
  const isCurrent = capturePrivateSession();
  const canonical = useQuery({
    queryKey: queryKeys.currentMealPlanningPlan(),
    queryFn: async () => {
      if (!isCurrent() || useAuthStore.getState().isGuest) throw new ApiError('auth', 'A registered account is required for this planner session.');
      return (await mealPlanningApi.current()).plan;
    },
    enabled: enabled && !requiresAccount,
    retry: false,
    staleTime: 0,
  });
  const legacy = useQuery({
    queryKey: queryKeys.currentWeekPlan(),
    queryFn: () => api.getCurrentWeekPlan(),
    enabled: !enabled,
  });
  const compositions = usePlanCompositions(
    requiresAccount ? undefined : canonical.data ?? undefined,
    enabled && !requiresAccount && canonical.isSuccess,
  );
  const query = enabled ? canonical : legacy;
  let evidence: CompositionEvidence = { kind: 'legacy' };
  if (enabled && isMealCompositionEnabled() && !compositionUnavailable(compositions.error)) {
    evidence = compositions.isError
      ? { kind: 'error' }
      : compositions.isPending
        ? { kind: 'pending' }
        : compositions.data?.planRevision !== canonical.data?.revision
          ? { kind: 'mismatch' }
          : { kind: 'ready', data: compositions.data! };
  }
  const plan = requiresAccount ? null : enabled
    ? canonical.data
      ? presentCanonicalHome(canonical.data, now, evidence)
      : null
    : legacy.data
      ? presentLegacyHome(legacy.data, now)
      : null;
  const retry = async () => {
    // A retained callback must not read a plan after the owner or account changes.
    if (!isCurrent() || (enabled && useAuthStore.getState().isGuest)) return;
    if (enabled) {
      const fresh = await canonical.refetch();
      if (isCurrent() && !useAuthStore.getState().isGuest && fresh.isSuccess && fresh.data && isMealCompositionEnabled()) {
        // Target the returned revision; refetching this render's observer can request an old plan.
        await client.invalidateQueries({
          queryKey: queryKeys.mealPlanningCompositions(fresh.data.id, fresh.data.revision),
          exact: true,
        });
      }
    } else await legacy.refetch();
  };
  return { query, plan, retry, requiresAccount, setupHref: enabled ? '/planner/new' : '/week/setup' };
}
