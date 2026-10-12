import { z } from 'zod';
import { MealPlanningIntentSchema, MealPlanDtoSchema, PlanIdSchema, PlanningRequestKeySchema,
  RegenerateMealPlanSchema } from '../packages/domain/src/meal-planning-api';
import { CurrentMealPlanDtoSchema } from '../packages/domain/src/meal-planning-presentation';

type JsonSchema = Record<string, unknown>;
/** Only locked Zod3 nodes used by this selected contract are supported. */
export function describeZodContract(schema: z.ZodTypeAny): JsonSchema {
  if (schema instanceof z.ZodOptional) return describeZodContract(schema.unwrap());
  if (schema instanceof z.ZodNullable) return { anyOf: [describeZodContract(schema.unwrap()), { type: 'null' }] };
  if (schema instanceof z.ZodDefault) return { ...describeZodContract(schema.removeDefault()), default: schema._def.defaultValue() };
  if (schema instanceof z.ZodEffects) return { ...describeZodContract(schema.innerType()), 'x-runtime-validation': true };
  if (schema instanceof z.ZodString) {
    const result: JsonSchema = { type: 'string' };
    for (const check of schema._def.checks) {
      if (check.kind === 'min') result.minLength = check.value;
      else if (check.kind === 'max') result.maxLength = check.value;
      else if (check.kind === 'regex') result.pattern = check.regex.source;
      else if (check.kind === 'uuid') result.format = 'uuid';
      else if (check.kind === 'date') result.format = 'date';
      else if (check.kind === 'datetime') { result.format = 'date-time'; result['x-runtime-validation'] = true; }
      else if (check.kind === 'trim') result['x-runtime-transform'] = 'trim';
      else throw new Error('CONTRACT_UNSUPPORTED_STRING_CHECK');
    }
    return result;
  }
  if (schema instanceof z.ZodNumber) {
    const result: JsonSchema = { type: 'number' };
    for (const check of schema._def.checks) {
      if (check.kind === 'int') result.type = 'integer';
      else if (check.kind === 'min') result[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
      else if (check.kind === 'max') result[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
      else if (check.kind === 'finite') result['x-runtime-validation'] = true;
      else throw new Error('CONTRACT_UNSUPPORTED_NUMBER_CHECK');
    }
    return result;
  }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodNull) return { type: 'null' };
  if (schema instanceof z.ZodLiteral) return { const: schema.value };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodArray) return { type: 'array', items: describeZodContract(schema.element),
    ...(schema._def.minLength ? { minItems: schema._def.minLength.value } : {}),
    ...(schema._def.maxLength ? { maxItems: schema._def.maxLength.value } : {}) };
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(schema.shape) as [string, z.ZodTypeAny][]) {
      properties[key] = describeZodContract(child);
      if (!child.isOptional()) required.push(key);
    }
    return { type: 'object', properties, required, additionalProperties: schema._def.unknownKeys === 'passthrough' };
  }
  throw new Error('CONTRACT_UNSUPPORTED_ZOD_NODE');
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
