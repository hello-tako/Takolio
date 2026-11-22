import { z } from 'zod';
import type { AdminPermission, AdminRole } from '../../shared/admin';
import { hasAdminPermission, ADMIN_ROLES } from '../../shared/admin';

const id = z.string().min(1).max(128).regex(/^(?!\.{1,2}$)[A-Za-z0-9_.:-]+$/);
const page = { page: z.number().int().min(1).max(1000), pageSize: z.number().int().min(1).max(100) };
const range = z.enum(['7d', '30d', '90d']);
const query = z.string().trim().min(1).max(100).optional();
const reason = z.string().trim().min(1).max(500);
const accountStatus = z.enum(['active', 'suspended', 'deleted']);
const notificationType = z.enum([
  'system',
  'announcement',
  'support',
  'billing',
  'expiring_soon',
  'cook_ready',
  'shopping_reminder',
]);

export const operationInputs = {
  'users.list': z.object({
    ...page,
    q: query,
    type: z.enum(['registered', 'guest', 'all']),
    plan: z.enum(['free', 'plus']).optional(),
    accountStatus: accountStatus.optional(),
    admin: z.enum(['true', 'false']).optional(),
    adminIds: z.array(id).max(1000),
    emailSearch: z.boolean(),
  }).strict(),
  'users.get': z.object({ id, reveal: z.boolean() }).strict(),
  'users.eligible': z.object({ id }).strict(),
  'users.labels': z.object({ ids: z.array(id).max(500) }).strict(),
  'households.list': z.object({ ...page, q: query }).strict(),
  'households.get': z.object({ id }).strict(),
  'recipes.list': z.object({
    ...page,
    q: query,
    cuisine: z.string().max(64).optional(),
    verification: z.enum(['unverified', 'reviewed', 'rejected']).optional(),
    source: z.enum(['legacy', 'curated', 'imported', 'ai_generated', 'user_generated']).optional(),
  }).strict(),
  'recipes.get': z.object({ id }).strict(),
  'recipes.version': z.object({ id }).strict(),
  'recipes.summary': z.object({ catalogMode: z.string().max(64).optional() }).strict(),
  'billing.summary': z.object({ range }).strict(),
  'billing.transactions': z.object({
    ...page,
    status: z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']).optional(),
    q: query,
    plan: z.enum(['monthly', 'annual']).optional(),
  }).strict(),
  'ai.summary': z.object({ range }).strict(),
  'ai.usage': z.object({ ...page, task: z.string().max(64).optional(), status: z.string().max(32).optional() }).strict(),
  'ai.scan_jobs': z.object({
    ...page,
    status: z.string().trim().min(1).max(32).optional(),
    scanType: z.string().trim().min(1).max(32).optional(),
  }).strict(),
  'overview': z.object({ range }).strict(),
  'system': z.object({}).strict(),
} as const;

export type ReadOperation = keyof typeof operationInputs;
export type ReadInput<O extends ReadOperation> = z.infer<(typeof operationInputs)[O]>;

export const operationPermissions: Record<ReadOperation, AdminPermission> = {
  'users.list': 'users.read',
  'users.get': 'users.read',
  'users.eligible': 'admin.roles.manage',
  'users.labels': 'admin.roles.read',
  'households.list': 'households.read',
  'households.get': 'households.read',
  'recipes.list': 'recipes.read',
  'recipes.get': 'recipes.read',
  'recipes.version': 'recipes.review',
  'recipes.summary': 'recipes.read',
  'billing.summary': 'billing.read',
  'billing.transactions': 'billing.read',
  'ai.summary': 'ai.read',
  'ai.usage': 'ai.read',
  'ai.scan_jobs': 'ai.read',
  overview: 'overview.read',
  system: 'admin.self.read',
};

export const mutationInputs = {
  'users.subscription.upgrade': z.object({
    userId: id,
    duration: z.enum(['monthly', 'annual', 'custom']),
    customDays: z.number().int().min(1).max(3650).optional(),
    reason,
    notifyUser: z.boolean().optional(),
  }).strict().refine((v) => v.duration !== 'custom' || v.customDays !== undefined, {
    message: 'customDays is required when duration is custom',
    path: ['customDays'],
  }),
  'users.subscription.cancel': z.object({
    userId: id,
    immediate: z.boolean(),
    reason,
  }).strict(),
  'users.suspend': z.object({ userId: id, reason }).strict(),
  'users.unsuspend': z.object({ userId: id, reason }).strict(),
  'users.delete': z.object({
    userId: id,
    mode: z.enum(['anonymize', 'purge']),
    reason,
  }).strict(),
  'users.sessions.revoke': z.object({ userId: id, reason }).strict(),
  'users.verify_email': z.object({ userId: id, reason }).strict(),
  'users.quota.reset': z.object({ userId: id, reason }).strict(),
  'users.notify': z.object({
    userId: id,
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(2000),
    type: notificationType.optional(),
    reason,
  }).strict(),
  'households.update': z.object({
    householdId: id,
    name: z.string().trim().min(1).max(120).optional(),
    newOwnerUserId: id.optional(),
    removeUserId: id.optional(),
    reason,
  }).strict().refine(
    (v) => v.name !== undefined || v.newOwnerUserId !== undefined || v.removeUserId !== undefined,
    { message: 'At least one household update field is required' },
  ),
  'households.purge_guests': z.object({
    olderThanDays: z.number().int().min(1).max(3650),
    reason,
  }).strict(),
  'billing.intent.mark_paid': z.object({
    intentId: id,
    reason,
    grantDays: z.number().int().min(1).max(3650).optional(),
  }).strict(),
  'billing.intent.refund': z.object({
    intentId: id,
    reason,
    revokeSubscription: z.boolean(),
  }).strict(),
  'billing.intent.resolve': z.object({
    intentId: id,
    outcome: z.enum(['expired', 'failed']),
    reason,
  }).strict(),
  'recipes.verification.set': z.object({
    recipeId: id,
    verificationState: z.enum(['unverified', 'reviewed', 'rejected']),
    recipeVersion: z.number().int().positive().safe(),
    reason,
  }).strict(),
  'recipes.metadata.update': z.object({
    recipeId: id,
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    cuisine: z.string().trim().min(1).max(64).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    cookTimeMinutes: z.number().int().min(0).max(1440).optional(),
    prepTimeMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    servings: z.number().int().min(1).max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    reason,
  }).strict().refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.cuisine !== undefined ||
      v.difficulty !== undefined ||
      v.cookTimeMinutes !== undefined ||
      v.prepTimeMinutes !== undefined ||
      v.servings !== undefined ||
      v.tags !== undefined,
    { message: 'At least one recipe metadata field is required' },
  ),
  'recipes.media.reject': z.object({
    recipeId: id,
    role: z.enum(['hero', 'thumbnail']),
    version: z.number().int().positive().safe(),
    reason,
  }).strict(),
  'ai.scan_job.retry': z.object({ jobId: id, reason }).strict(),
  'ai.scan_job.cancel': z.object({ jobId: id, reason }).strict(),
  'system.hygiene.run': z.object({ reason: reason.optional() }).strict(),
  'system.broadcast.send': z.object({
    target: z.enum(['all_registered', 'pro_only']),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(2000),
    reason,
  }).strict(),
} as const;

export type MutationOperation = keyof typeof mutationInputs;
export type MutationInput<O extends MutationOperation> = z.infer<(typeof mutationInputs)[O]>;

export const mutationPermissions: Record<MutationOperation, AdminPermission> = {
  'users.subscription.upgrade': 'users.billing.write',
  'users.subscription.cancel': 'users.billing.write',
  'users.suspend': 'users.suspend',
  'users.unsuspend': 'users.suspend',
  'users.delete': 'users.delete',
  'users.sessions.revoke': 'users.write',
  'users.verify_email': 'users.write',
  'users.quota.reset': 'users.write',
  'users.notify': 'users.write',
  'households.update': 'households.write',
  'households.purge_guests': 'households.write',
  'billing.intent.mark_paid': 'billing.write',
  'billing.intent.refund': 'billing.write',
  'billing.intent.resolve': 'billing.write',
  'recipes.verification.set': 'recipes.write',
  'recipes.metadata.update': 'recipes.write',
  'recipes.media.reject': 'recipes.write',
  'ai.scan_job.retry': 'ai.write',
  'ai.scan_job.cancel': 'ai.write',
  'system.hygiene.run': 'system.write',
  'system.broadcast.send': 'system.write',
};

export const Capability = z.object({
  version: z.literal(1),
  operation: z.enum(Object.keys(operationInputs) as [ReadOperation, ...ReadOperation[]]),
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  userId: id,
  sessionId: id,
  roles: z.array(z.enum(ADMIN_ROLES)).min(1).max(5),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type ReadCapability = z.infer<typeof Capability>;

export const MutationCapabilitySchema = z.object({
  version: z.literal(1),
  kind: z.literal('mutation'),
  operation: z.enum(Object.keys(mutationInputs) as [MutationOperation, ...MutationOperation[]]),
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  userId: id,
  sessionId: id,
  roles: z.array(z.enum(ADMIN_ROLES)).min(1).max(5),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type MutationCapability = z.infer<typeof MutationCapabilitySchema>;

export interface CustomerReadBinding {
  read(operation: ReadOperation, input: unknown, capability: ReadCapability): Promise<unknown>;
  mutate(operation: MutationOperation, input: unknown, capability: MutationCapability): Promise<unknown>;
}

export function authorized(operation: ReadOperation, input: Record<string, unknown>, roles: readonly AdminRole[]): boolean {
  return (
    hasAdminPermission(roles, operationPermissions[operation]) &&
    (!(input.reveal || input.emailSearch) || hasAdminPermission(roles, 'users.pii.reveal'))
  );
}

export function authorizedMutation(operation: MutationOperation, roles: readonly AdminRole[]): boolean {
  return hasAdminPermission(roles, mutationPermissions[operation]);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]]))
      : entry,
  );
}

export async function hash(value: unknown): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}

async function hmac(secret: string, value: unknown): Promise<string> {
  if (secret.length < 32) throw new Error('FACADE_AUTH_UNAVAILABLE');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalJson(value)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}

function constantTimeDiff(a: string, b: string): number {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff;
}

function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signCapability(
  secret: string,
  operation: ReadOperation,
  input: unknown,
  actor: { userId: string; sessionId: string; roles: AdminRole[] },
): Promise<ReadCapability> {
  const now = Date.now();
  const claims = {
    version: 1 as const,
    operation,
    inputHash: await hash(input),
    userId: actor.userId,
    sessionId: actor.sessionId,
    roles: actor.roles,
    issuedAt: now,
    expiresAt: now + 15_000,
    nonce: randomNonce(),
  };
  return { ...claims, signature: await hmac(secret, claims) };
}

export async function verifyCapability(
  secret: string,
  operation: ReadOperation,
  input: unknown,
  raw: unknown,
): Promise<ReadCapability> {
  const parsed = Capability.parse(raw);
  const { signature, ...claims } = parsed;
  const expected = await hmac(secret, claims);
  if (
    constantTimeDiff(signature, expected) ||
    parsed.operation !== operation ||
    parsed.inputHash !== (await hash(input)) ||
    parsed.issuedAt > Date.now() + 1000 ||
    parsed.expiresAt <= Date.now() ||
    parsed.expiresAt - parsed.issuedAt > 15_000 ||
    !authorized(operation, input as Record<string, unknown>, parsed.roles)
  ) {
    throw new Error('FACADE_FORBIDDEN');
  }
  return parsed;
}

export async function signMutationCapability(
  secret: string,
  operation: MutationOperation,
  input: unknown,
  actor: { userId: string; sessionId: string; roles: AdminRole[] },
): Promise<MutationCapability> {
  const now = Date.now();
  const claims = {
    version: 1 as const,
    kind: 'mutation' as const,
    operation,
    inputHash: await hash(input),
    userId: actor.userId,
    sessionId: actor.sessionId,
    roles: actor.roles,
    issuedAt: now,
    expiresAt: now + 15_000,
    nonce: randomNonce(),
  };
  return { ...claims, signature: await hmac(secret, claims) };
}

export async function verifyMutationCapability(
  secret: string,
  operation: MutationOperation,
  input: unknown,
  raw: unknown,
): Promise<MutationCapability> {
  const parsed = MutationCapabilitySchema.parse(raw);
  const { signature, ...claims } = parsed;
  const expected = await hmac(secret, claims);
  if (
    constantTimeDiff(signature, expected) ||
    parsed.operation !== operation ||
    parsed.inputHash !== (await hash(input)) ||
    parsed.issuedAt > Date.now() + 1000 ||
    parsed.expiresAt <= Date.now() ||
    parsed.expiresAt - parsed.issuedAt > 15_000 ||
    !authorizedMutation(operation, parsed.roles)
  ) {
    throw new Error('FACADE_FORBIDDEN');
  }
  return parsed;
}
