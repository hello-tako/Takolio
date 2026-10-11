import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPlannerOpenApi, describeZodContract } from '../../scripts/planner-openapi';
import { MealPlanningIntentSchema } from '../../packages/domain/src/meal-planning-api';

describe('bounded Zod3 OpenAPI candidate', () => {
  it('keeps create/current/get/regenerate shapes and actual header/revision semantics', () => {
    const doc = buildPlannerOpenApi([]);
    expect(Object.keys(doc.paths)).toHaveLength(4);
    expect(doc.paths['/meal-planning/plans'].post.parameters[0].name).toBe('Idempotency-Key');
    expect(doc.paths['/meal-planning/plans/{id}/regenerate'].post.parameters).toHaveLength(1);
    expect(doc.components.schemas.CurrentMealPlan).toMatchObject({ required: ['plan'],
      properties: { plan: { anyOf: expect.arrayContaining([{ type: 'null' }]) } } });
    expect(doc.components.schemas.MealPlan).toMatchObject({ additionalProperties: false });
  });
  it('generates identical output with reordered source receipts and no timestamp', () => {
    const a = { path: 'a', sha256: '1' }; const b = { path: 'b', sha256: '2' };
    expect(JSON.stringify(buildPlannerOpenApi([b, a]))).toBe(JSON.stringify(buildPlannerOpenApi([a, b])));
  });
  it('describes defaults as optional inputs while executable schema fills them', () => {
    const schema = describeZodContract(MealPlanningIntentSchema);
    expect(schema.required).not.toContain('horizonDays');
    expect(schema).toMatchObject({ properties: { horizonDays: { type: 'integer', minimum: 1, maximum: 14, default: 7 } } });
    const intent = { startDate: '2030-01-01', defaultServings: 2, slots: [{ date: '2030-01-01', mealType: 'dinner' }] };
    expect(MealPlanningIntentSchema.parse(intent).horizonDays).toBe(7);
    expect(MealPlanningIntentSchema.safeParse({ ...intent, horizonDays: 99 }).success).toBe(false);
  });
  it('marks runtime-only refinements rather than claiming structural equivalence', () => {
    const schema = z.string().refine((value) => value === 'exact');
    expect(describeZodContract(schema)).toEqual({ type: 'string', 'x-runtime-validation': true });
    expect(schema.safeParse('other').success).toBe(false);
  });
  it('fails closed for unsupported nodes instead of emitting a permissive schema', () => {
    expect(() => describeZodContract(z.record(z.string()))).toThrow('CONTRACT_UNSUPPORTED_ZOD_NODE');
    expect(() => describeZodContract(z.string().url())).toThrow('CONTRACT_UNSUPPORTED_STRING_CHECK');
  });
});
