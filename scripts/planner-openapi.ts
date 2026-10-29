import { z } from 'zod';
import { MealPlanningIntentSchema, MealPlanDtoSchema, PlanIdSchema, PlanningRequestKeySchema,
  RegenerateMealPlanSchema } from '../packages/domain/src/meal-planning-api';
import { CurrentMealPlanDtoSchema } from '../packages/domain/src/meal-planning-presentation';

type JsonSchema = Record<string, unknown>;
/** Native Zod4 conversion, bounded to the selected contract's nodes and checks. */
export function describeZodContract(schema: z.ZodType): JsonSchema {
  const result = z.toJSONSchema(schema, {
    io: 'input', cycles: 'throw', reused: 'inline',
    override: ({ zodSchema, jsonSchema }) => {
      const def = zodSchema._zod.def;
      if (!['optional', 'nullable', 'default', 'string', 'number', 'boolean', 'null', 'literal', 'enum', 'array', 'object'].includes(def.type))
        throw new Error('CONTRACT_UNSUPPORTED_ZOD_NODE');
      const checks: Array<z.core.$ZodCheckDef & { format?: string }> = (def.checks ?? []).map(check => check._zod.def);
      if ('check' in def && typeof def.check === 'string') checks.push(def);
      for (const rule of checks) {
        if (rule.check === 'custom') jsonSchema['x-runtime-validation'] = true;
        else if (rule.check === 'overwrite') jsonSchema['x-runtime-transform'] = 'overwrite';
        else if (def.type === 'string') {
          if (rule.check === 'string_format' && ['regex', 'uuid', 'date', 'datetime'].includes(rule.format ?? '')) {
            if (rule.format === 'datetime') jsonSchema['x-runtime-validation'] = true;
          } else if (!['min_length', 'max_length'].includes(rule.check)) throw new Error('CONTRACT_UNSUPPORTED_STRING_CHECK');
        } else if (def.type === 'number') {
          if (!['number_format', 'greater_than', 'less_than'].includes(rule.check)) throw new Error('CONTRACT_UNSUPPORTED_NUMBER_CHECK');
        } else if (def.type === 'array') {
          if (!['min_length', 'max_length'].includes(rule.check)) throw new Error('CONTRACT_UNSUPPORTED_ARRAY_CHECK');
        } else throw new Error('CONTRACT_UNSUPPORTED_ZOD_CHECK');
      }
    },
  });
  delete result.$schema;
  return result;
}

export function buildPlannerOpenApi(sourceHashes: readonly { path: string; sha256: string }[]) {
  const error = { description: 'Bounded API error; actual code depends on the guard or state',
    content: { 'application/json': { schema: { type: 'object', required: ['error', 'code'],
      properties: { error: { type: 'string' }, code: { type: 'string' } } } } } };
  const response = (ref: string) => ({ description: 'Existing successful response',
    headers: { 'Cache-Control': { schema: { const: 'no-store' } } },
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
  const idParameter = { name: 'id', in: 'path', required: true, schema: describeZodContract(PlanIdSchema) };
  const keyParameter = { name: 'Idempotency-Key', in: 'header', required: true, schema: describeZodContract(PlanningRequestKeySchema) };
  const requestBody = (ref: string) => ({ required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
  const common = { security: [{ CookieSession: [] }], responses: { '401': error, '403': error, '404': error,
    '413': error, '422': error, '429': error, '500': error, '503': error } };
  return {
    openapi: '3.1.0', info: { title: 'Tako-san planner contract candidate', version: '1-candidate' },
    servers: [{ url: '/api/v1' }],
    'x-classification': 'LOCAL_CONTRACT_CANDIDATE',
    'x-semantic-authority': 'Existing executable Zod schemas and route guards; refinements and transforms require runtime validation',
    'x-source-hashes': [...sourceHashes].sort((a, b) => a.path.localeCompare(b.path)),
    paths: {
      '/meal-planning/plans': { post: { ...common, operationId: 'createPlannerPlan', parameters: [keyParameter],
        description: 'Idempotent user/household-scoped creation; same key and changed normalized intent conflicts. Cookie mutations require allowed Origin and feature enabled.',
        requestBody: requestBody('MealPlanningIntent'), responses: { ...common.responses, '200': response('MealPlan'), '400': error, '409': error } } },
      '/meal-planning/plans/current': { get: { ...common, operationId: 'getCurrentPlannerPlan',
        description: 'Current plan or null; feature and registered membership required. No pagination.',
        responses: { ...common.responses, '200': response('CurrentMealPlan') } } },
      '/meal-planning/plans/{id}': { get: { ...common, operationId: 'getPlannerPlan', parameters: [idParameter],
        responses: { ...common.responses, '200': response('MealPlan'), '409': error } } },
      '/meal-planning/plans/{id}/regenerate': { post: { ...common, operationId: 'regeneratePlannerPlan', parameters: [idParameter],
        description: 'Revision-fenced replacement; stale revision409. Cookie mutations require allowed Origin. Regeneration uses revision, no Idempotency-Key header.',
        requestBody: requestBody('RegenerateMealPlan'), responses: { ...common.responses, '200': response('MealPlan'), '400': error, '409': error } } },
    },
    components: { securitySchemes: { CookieSession: { type: 'apiKey', in: 'cookie', name: '__Host-frigo_session' } },
      schemas: { MealPlanningIntent: describeZodContract(MealPlanningIntentSchema), MealPlan: describeZodContract(MealPlanDtoSchema),
        CurrentMealPlan: describeZodContract(CurrentMealPlanDtoSchema), RegenerateMealPlan: describeZodContract(RegenerateMealPlanSchema) } },
  };
}
