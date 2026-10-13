import { useEffect, useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FamilyMealPlanDto } from '../../../../packages/domain/src/family-meal-planning-api';
import type {
  MealPlanDto,
  MealPlanningIntent,
} from '../../../../packages/domain/src/meal-planning-api';
import { familyMealPlanningApi } from '../../services/family-meal-planning';
import { isMealCompositionEnabled } from './composition';
import { mealPlanningApi } from '../../services/meal-planning';
import { ApiError } from '../../services/http';
import { useAuthStore } from '../../stores/useAuthStore';
import { capturePrivateSession, onPrivateSessionReset } from '../../lib/private-session';
import { queryKeys } from '../../lib/queryKeys';

export function usePlanner(planId?: string, enabled = true) {
  const client = useQueryClient();
  const registeredAccountRequired = useAuthStore((state) => state.isGuest);
  const isCurrent = capturePrivateSession();
  const queryKey = planId
    ? queryKeys.mealPlanningPlan(planId)
    : queryKeys.currentMealPlanningPlan();
  function seedFamily(result: FamilyMealPlanDto) {
    if (!isCurrent() || useAuthStore.getState().isGuest) return;
    client.setQueryData(
      [...queryKeys.mealPlanningPlan(result.plan.id), 'family', result.plan.revision],
      result,
    );
    client.setQueryData(
      queryKeys.mealPlanningCompositions(result.plan.id, result.plan.revision),
      result.compositions,
    );
  }
  async function loadPlan(id: string): Promise<MealPlanDto> {
    if (isMealCompositionEnabled()) {
      try {
        const result = await familyMealPlanningApi.get(id);
        seedFamily(result);
        return result.plan;
      } catch (failure) {
        if (
          !(failure instanceof ApiError) ||
          (failure.status !== 404 && failure.code !== 'FAMILY_PLAN_METADATA_MISSING')
        )
          throw failure;
      }
    }
    return mealPlanningApi.get(id);
  }
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!isCurrent() || useAuthStore.getState().isGuest)
        throw new ApiError('auth', 'A registered account is required for this planner session.');
      if (planId) return loadPlan(planId);
      if (isMealCompositionEnabled()) {
        try {
          const family = (await familyMealPlanningApi.current()).plan;
          if (family) seedFamily(family);
          if (family) return family.plan;
          return (await mealPlanningApi.current()).plan;
        } catch (failure) {
          if (
            !(failure instanceof ApiError) ||
            (failure.status !== 404 && failure.code !== 'FAMILY_PLAN_METADATA_MISSING')
          )
            throw failure;
        }
      }
      return (await mealPlanningApi.current()).plan;
    },
    enabled: enabled && !registeredAccountRequired,
    retry: false,
    staleTime: 0,
  });
  const familyQuery = useQuery<FamilyMealPlanDto>({
    queryKey: [
      ...queryKeys.mealPlanningPlan(query.data?.id ?? 'none'),
      'family',
      query.data?.revision ?? 0,
    ],
    queryFn: skipToken,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshed, setRefreshed] = useState(false);
  const [, setSessionEpoch] = useState(0);
  const gate = useRef<symbol | null>(null);
  const mounted = useRef(true);
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const reset = () => {
      gate.current = null;
      keys.current.clear();
      setBusy(null);
      setError(null);
      setRefreshed(false);
      setSessionEpoch((value) => value + 1);
    };
    reset();
    return onPrivateSessionReset(reset);
  }, [queryKey[1], queryKey[2]]);
  function requestKey(intent: unknown) {
    const fingerprint = JSON.stringify(intent);
    if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, crypto.randomUUID());
    return keys.current.get(fingerprint)!;
  }
  function retireRequestKey(intent: unknown) {
    keys.current.delete(JSON.stringify(intent));
  }
  async function generate(intent: MealPlanningIntent, key: string) {
    if (isMealCompositionEnabled()) {
      const result = await familyMealPlanningApi.generate(intent, key);
      seedFamily(result);
      return result.plan;
    }
    return mealPlanningApi.generate(intent, key);
  }
  async function regenerate(id: string, revision: number) {
    if (isMealCompositionEnabled()) {
      try {
        const result = await familyMealPlanningApi.regenerate(id, revision);
        seedFamily(result);
        return result.plan;
      } catch (failure) {
        if (
          !(failure instanceof ApiError) ||
          (failure.status !== 404 && failure.code !== 'FAMILY_PLAN_METADATA_MISSING')
        )
          throw failure;
      }
    }
    return mealPlanningApi.regenerate(id, { revision });
  }
  function replacePlan(plan: MealPlanDto) {
    void client.cancelQueries({ queryKey: queryKeys.mealPlanningPlan(plan.id) });
    void client.cancelQueries({ queryKey: queryKeys.currentMealPlanningPlan() });
    client.setQueryData(queryKeys.mealPlanningPlan(plan.id), plan);
    client.setQueryData(queryKeys.currentMealPlanningPlan(), plan);
    client.removeQueries({ queryKey: queryKeys.mealPlanningShopping(plan.id) });
    client.removeQueries({ queryKey: queryKeys.mealPlanningAlternativesForPlan(plan.id) });
  }
  async function perform<T>(
    label: string,
    operation: () => Promise<T>,
    accept?: (data: T) => void,
  ): Promise<T | undefined> {
    if (gate.current || !mounted.current || !isCurrent() || useAuthStore.getState().isGuest) return;
    const operationId = Symbol();
    gate.current = operationId;
    const current = isCurrent;
    setBusy(label);
    setError(null);
    setRefreshed(false);
    try {
      const result = await operation();
      if (!current() || !mounted.current || useAuthStore.getState().isGuest) return;
      accept?.(result);
      return result;
    } catch (failure) {
      if (!current() || !mounted.current || useAuthStore.getState().isGuest) return;
      setError(failure);
      if (failure instanceof ApiError && failure.status === 409 && planId) {
        client.removeQueries({ queryKey: queryKeys.mealPlanningShopping(planId) });
        client.removeQueries({ queryKey: queryKeys.mealPlanningAlternativesForPlan(planId) });
        try {
          const latest = await loadPlan(planId);
          if (current() && mounted.current && !useAuthStore.getState().isGuest) {
            replacePlan(latest);
            setError(null);
            setRefreshed(true);
          }
        } catch {
          /* Keep the last accepted revision when conflict recovery cannot load it. */
        }
      }
    } finally {
      if (gate.current === operationId) gate.current = null;
      if (current() && mounted.current && !useAuthStore.getState().isGuest) setBusy(null);
    }
  }
  return {
    query,
    plan: registeredAccountRequired ? undefined : query.data,
    familyPlan: registeredAccountRequired ? undefined : familyQuery.data,
    busy,
    error,
    refreshed,
    perform,
    replacePlan,
    requestKey,
    retireRequestKey,
    registeredAccountRequired,
    generate,
    regenerate,
    loadPlan,
  };
}
