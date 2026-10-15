// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import type { MealPlanDto } from '../../packages/domain/src/meal-planning-api';
import { hookPlan } from '../helpers/planner-hook-fixtures';
import { FreshnessNotice } from '../../src/web/features/planner/PlannerShell';
import {
  canSharePlannerShopping,
  hasFuturePlannerSlot,
  isPlannerSlotElapsed,
  plannerSlotInstant,
  plannerLocalDate,
} from '../../src/web/features/planner/schedule';

const morningId = '2030-01-02:breakfast:0';
const dinnerId = '2030-01-02:dinner:2';
const now = Date.parse('2030-01-02T06:00:00.000Z');
function week(reasons: MealPlanDto['freshness']['reasons'] = ['planning_time_elapsed']) {
  const plan = hookPlan();
  plan.intent.utcOffsetMinutes = 420;
  plan.intent.slots = [
    { date: '2030-01-02', mealType: 'breakfast', sequence: 0, time: '07:15' },
    { date: '2030-01-02', mealType: 'dinner', sequence: 2, time: '19:30' },
  ];
  plan.result.planningReference.utcOffsetMinutes = 420;
  plan.result.meals = [];
  plan.freshness = {
    ...plan.freshness,
    status: reasons.length ? 'requires_revalidation' : 'fresh',
    reasons,
    checkedAt: new Date(now).toISOString(),
  };
  return plan;
}
function family(plan: MealPlanDto) {
  return FamilyMealPlanDtoSchema.parse({
    schemaVersion: 2,
    plan,
    compositions: {
      schemaVersion: 1,
      planId: plan.id,
      planRevision: plan.revision,
      compositions: [],
    },
    policy: {
      mealStyle: 'family',
      preferredRegions: ['nam'],
      internationalMealsPerWeek: 0,
      internationalGeneratedMainCount: 0,
      lockedInternationalMainCount: 0,
      defaultCuisine: 'vietnamese',
      profileRevision: 1,
    },
    diagnostics: {
      completeMealCount: 0,
      partialMealCount: 0,
      unplannedMealCount: 2,
      reasons: [],
      searchLimited: false,
    },
    familyPreferenceFreshness: 'fresh',
  });
}
const notice = (plan: MealPlanDto, familyPlan?: ReturnType<typeof family>) =>
  renderToStaticMarkup(
    <StaticRouter location="/">
      <FreshnessNotice plan={plan} familyPlan={familyPlan} locale="en" />
    </StaticRouter>,
  );

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('weekly continuation schedule', () => {
  it('uses canonical custom times and the plan offset for empty manual slots', () => {
    const plan = week();
    expect(plannerSlotInstant(plan, morningId)).toBe('2030-01-02T00:15:00.000Z');
    expect(plannerSlotInstant(plan, dinnerId)).toBe('2030-01-02T12:30:00.000Z');
    expect(isPlannerSlotElapsed(plan, morningId)).toBe(true);
    expect(isPlannerSlotElapsed(plan, dinnerId)).toBe(false);
    expect(hasFuturePlannerSlot(plan)).toBe(true);
  });
  it('keeps a meal editable exactly at its scheduled instant and closes it afterward', () => {
    const plan = week();
    const dinner = Date.parse(plannerSlotInstant(plan, dinnerId)!);
    expect(isPlannerSlotElapsed(plan, dinnerId, dinner)).toBe(false);
    expect(isPlannerSlotElapsed(plan, dinnerId, dinner + 1)).toBe(true);
  });
  it('honors the latest server check when the device clock is behind', () => {
    const plan = week();
    vi.mocked(Date.now).mockReturnValue(Date.parse('2030-01-01T00:00:00.000Z'));
    expect(isPlannerSlotElapsed(plan, morningId)).toBe(true);
    expect(isPlannerSlotElapsed(plan, dinnerId)).toBe(false);
  });
  it('derives shopping today from the plan offset and fails closed for malformed clocks', () => {
    const plan = week();
    expect(plannerLocalDate(plan, Date.parse('2030-01-02T16:30:00.000Z'))).toBe('2030-01-02');
    expect(plannerLocalDate(plan, Date.parse('2030-01-02T16:59:59.999Z'))).toBe('2030-01-02');
    expect(plannerLocalDate(plan, Date.parse('2030-01-02T17:00:00.000Z'))).toBe('2030-01-03');
    for (const invalidClock of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      8_640_000_000_000_001,
      8_640_000_000_000_000,
      -8_640_000_000_000_000,
    ])
      expect(plannerLocalDate(plan, invalidClock)).toBeUndefined();
    for (const invalidOffset of [Number.NaN, 420.5, -841, 841]) {
      plan.result.planningReference.utcOffsetMinutes = invalidOffset;
      expect(plannerLocalDate(plan)).toBeUndefined();
    }
  });
  it('uses legacy result time before meal-type defaults', () => {
    const plan = hookPlan();
    plan.intent.slots[0].time = undefined;
    plan.result.meals[0].time = '23:30';
    expect(plannerSlotInstant(plan, plan.result.meals[0].slotId)).toBe('2030-01-02T23:30:00.000Z');
    plan.result.meals = [];
    expect(plannerSlotInstant(plan, '2030-01-02:dinner:0')).toBe('2030-01-02T18:00:00.000Z');
  });
  it.each(['missing_slot', 'bad_time', 'bad_date', 'bad_offset'] as const)(
    'fails closed for %s',
    (kind) => {
      const plan = week();
      let target = dinnerId;
      if (kind === 'missing_slot') target = '2030-01-02:dinner:99';
      if (kind === 'bad_time') plan.intent.slots[1].time = '24:00';
      if (kind === 'bad_date') {
        plan.intent.slots[1].date = '2030-02-31';
        target = '2030-02-31:dinner:2';
      }
      if (kind === 'bad_offset') plan.result.planningReference.utcOffsetMinutes = Number.NaN;
      expect(plannerSlotInstant(plan, target)).toBeUndefined();
      expect(isPlannerSlotElapsed(plan, target)).toBe(true);
    },
  );
});

describe('future shopping policy and notice', () => {
  it('allows time-only non-family continuation and sends users directly to shopping', () => {
    const plan = week();
    expect(canSharePlannerShopping(plan)).toBe(true);
    const html = notice(plan);
    expect(html).toContain('Continue planning your next meals');
    expect(html).toContain('Past meals stay unchanged.');
    expect(html).toContain('only includes upcoming meals');
    expect(html).toContain(`/planner/${plan.id}/shopping`);
    expect(html).not.toContain('Create a new plan starting today or tomorrow');
  });
  it('rechecks family stock/history after cooking while retaining truthful stale reasons', () => {
    const plan = week(['planning_time_elapsed', 'stale_inventory', 'stale_history']);
    expect(canSharePlannerShopping(plan, family(plan))).toBe(true);
    expect(canSharePlannerShopping(plan)).toBe(false);
    const html = notice(plan, family(plan));
    expect(html).toContain('Continue planning your next meals');
    expect(html).toContain('Inventory changed');
    expect(html).toContain('History or feedback changed');
  });
  it.each(['stale_preferences', 'stale_catalog', 'catalog_authority_changed'] as const)(
    'blocks family sharing when %s also changed',
    (reason) => {
      const plan = week(['planning_time_elapsed', reason]);
      expect(canSharePlannerShopping(plan, family(plan))).toBe(false);
      const html = notice(plan, family(plan));
      expect(html).toContain('must be revalidated');
      expect(html).not.toContain('Continue planning your next meals');
      expect(html).not.toContain(`/planner/${plan.id}/shopping`);
    },
  );
  it('requires current family revision and current preferences', () => {
    const plan = week(['stale_inventory']);
    const staleRevision = family(plan);
    staleRevision.plan.revision += 1;
    expect(canSharePlannerShopping(plan, staleRevision)).toBe(false);
    const staleProfile = family(plan);
    staleProfile.familyPreferenceFreshness = 'requires_revalidation';
    expect(canSharePlannerShopping(plan, staleProfile)).toBe(false);
    plan.freshness = { ...plan.freshness, status: 'fresh', reasons: [] };
    expect(canSharePlannerShopping(plan, staleProfile)).toBe(false);
  });
  it('blocks sharing when every meal has elapsed, even if cached freshness says fresh', () => {
    const plan = week([]);
    plan.freshness.checkedAt = '2030-01-03T00:00:00.000Z';
    expect(hasFuturePlannerSlot(plan)).toBe(false);
    expect(canSharePlannerShopping(plan, family(plan))).toBe(false);
  });
  it('retains legacy plan guidance when composition is disabled', () => {
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'false');
    expect(notice(week())).toContain('Create a new plan starting today or tomorrow');
  });
});
