import { z } from 'zod';
import type { MutationOperation, ReadOperation } from './contract';

const text = z.string().max(8192);
const nullable = text.nullable();
const number = z.number().finite();
const count = number.int().nonnegative();
const role = z.enum(['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR']);
const editorial = z.enum(['draft', 'in_review', 'approved', 'rejected']);
const status = z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']);
const range = z.enum(['7d', '30d', '90d']);
const accountStatus = z.enum(['active', 'suspended', 'deleted']);
const verificationState = z.enum(['unverified', 'reviewed', 'rejected']);
const notificationType = z.enum([
  'system',
  'announcement',
  'support',
  'billing',
  'expiring_soon',
  'cook_ready',
  'shopping_reminder',
]);
const array = <T extends z.ZodTypeAny>(schema: T, max = 100) => z.array(schema).max(max);
const page = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ items: array(schema), page: count.min(1).max(1000), pageSize: count.min(1).max(100), total: count }).strict();

const metric = z.object({
  key: text,
  label: text,
  value: number.nullable(),
  unit: z.enum(['count', 'vnd', 'usd', 'ms', 'percent', 'tokens']),
  status: z.enum(['ok', 'partial', 'unavailable']),
  source: text,
  definition: text,
  note: text.optional(),
}).strict();

const series = z.object({
  key: text,
  label: text,
  unit: z.enum(['count', 'vnd', 'usd', 'ms', 'percent', 'tokens']),
  source: text,
  points: array(z.object({ date: text, value: number }).strict(), 90),
}).strict();

const health = z.object({
  key: text,
  label: text,
  status: z.enum(['ok', 'degraded', 'error', 'unavailable']),
  observedBy: z.enum(['local', 'remote']),
  detail: text.optional(),
}).strict();

const transaction = z.object({
  id: text,
  userId: text,
  orderCodeMasked: text,
  plan: text,
  amountVnd: number,
  status,
  effectiveStatus: status,
  hasReconciliationRecord: z.boolean(),
  createdAt: text,
  updatedAt: text,
  expiresAt: text,
}).strict();

const user = z.object({
  id: text,
  displayName: nullable,
  emailMasked: nullable,
  isGuest: z.boolean(),
  isVerified: z.boolean(),
  accountStatus,
  plan: z.enum(['free', 'plus']),
  subscriptionStatus: nullable,
  subscriptionExpiresAt: nullable,
  householdCount: count,
  createdAt: text,
  lastSeenAt: nullable,
  isPlatformAdmin: z.boolean(),
}).strict();

const householdMember = z.object({
  id: text,
  userId: text,
  displayName: nullable,
  emailMasked: nullable,
  role: text,
  createdAt: text,
}).strict();

const householdDetail = z.object({
  id: text,
  name: text,
  ownerUserId: text,
  ownerDisplayName: nullable,
  createdAt: text,
  inventoryMode: z.enum(['native', 'legacy']),
  inventoryVersion: count,
  itemCount: count,
  lotCount: count,
  expiringCount: count,
  mealPlanCount: count,
  cookedMealCount: count,
  shoppingListCount: count,
  members: array(householdMember, 50),
}).strict();

const recipe = z.object({
  id: text,
  slug: text,
  title: text,
  cuisine: text,
  difficulty: text,
  cookTimeMinutes: number,
  sourceType: text,
  verificationState,
  version: count,
  hasReadyMedia: z.boolean(),
  latestEditorialState: editorial.nullable(),
  createdAt: text,
}).strict();

const recipeIngredient = z.object({
  id: text,
  name: text,
  quantity: number,
  unit: text,
  isOptional: z.boolean(),
}).strict();

const recipeStep = z.object({
  stepNumber: count,
  instruction: text,
  tip: nullable,
  timerMinutes: number.nullable(),
}).strict();

const review = z.object({
  id: text,
  state: editorial,
  note: text,
  authorUserId: text,
  recipeVersion: count,
  createdAt: text,
}).strict();

const scanJob = z.object({
  id: text,
  scanId: text,
  userId: text,
  householdId: text,
  scanType: text,
  status: text,
  attempts: count,
  maxAttempts: count,
  errorCode: nullable,
  errorMessage: nullable,
  lockedAt: nullable,
  createdAt: text,
  updatedAt: text,
}).strict();

const actionQueue = z.object({
  pendingReconciliations: count,
  failedScanJobs: count,
  unverifiedRecipes: count,
  suspendedUsers: count,
  pendingApprovals: count,
}).strict();

const outputs: Record<ReadOperation, z.ZodTypeAny> = {
  'users.list': page(user),
  'users.get': user.extend({
    email: nullable,
    emailRevealed: z.boolean(),
    onboardingCompletedAt: nullable,
    authProviders: array(z.enum(['password', 'google']), 2),
    households: array(z.object({ id: text, name: text, role: text, memberCount: count, createdAt: text }).strict(), 20),
    activity: z.object({
      activeSessions: count,
      scans30d: count,
      lastScanAt: nullable,
      payments: z.object({ paid: count, pending: count, failed: count }).strict(),
    }).strict(),
    scanQuota: z.object({ usedThisMonth: count, maxPerMonth: count }).strict(),
    recentTransactions: array(transaction, 20),
    adminRoles: array(role, 5),
  }).strict().nullable(),
  'users.eligible': z.boolean(),
  'users.labels': z.record(text, z.object({ displayName: nullable, emailMasked: nullable }).strict())
    .refine((value) => Object.keys(value).length <= 500),
  'households.list': page(z.object({
    id: text,
    name: text,
    ownerUserId: text,
    ownerDisplayName: nullable,
    memberCount: count,
    inventoryItemCount: count,
    createdAt: text,
  }).strict()),
  'households.get': householdDetail.nullable(),
  'recipes.list': page(recipe),
  'recipes.get': recipe.extend({
    description: nullable,
    servings: number,
    prepTimeMinutes: number.nullable(),
    tags: array(text, 50),
    sourceReference: nullable,
    familyId: nullable,
    ingredientCount: count,
    stepCount: count,
    ingredients: array(recipeIngredient, 200),
    steps: array(recipeStep, 100),
    media: array(z.object({ role: text, version: count, status: text, sourceType: nullable, mimeType: nullable }).strict(), 20),
    editorialReviews: array(review),
    publication: z.object({ canPublish: z.boolean(), note: text }).strict(),
  }).strict().nullable(),
  'recipes.version': count.nullable(),
  'recipes.summary': z.object({
    total: count,
    byVerification: array(z.object({ state: text, count }).strict()),
    bySource: array(z.object({ sourceType: text, count }).strict()),
    byCuisine: array(z.object({ cuisine: text, count }).strict(), 20),
    withReadyMedia: count,
    catalogMode: text,
    editorialQueue: array(z.object({ state: editorial, count }).strict()),
  }).strict(),
  'billing.summary': z.object({
    range,
    metrics: array(metric, 20),
    statusBreakdown: array(z.object({ status, count, amountVnd: number }).strict(), 5),
    checkoutStates: array(z.object({ state: z.enum(['dispatching', 'ready', 'remote_uncertain']), count }).strict(), 3),
    reconciliationExceptions: array(z.object({ intentId: text, reason: text, firstObservedAt: text, lastObservedAt: text }).strict(), 20),
    series: array(series, 10),
    providerReconciliation: z.object({ status: z.literal('unavailable'), note: text }).strict(),
  }).strict(),
  'billing.transactions': page(transaction),
  'ai.summary': z.object({
    range,
    metrics: array(metric, 20),
    byTask: array(z.object({ task: text, requests: count, errors: count, avgLatencyMs: number.nullable(), estimatedCostUsd: number }).strict(), 50),
    byModel: array(z.object({ provider: text, model: text, requests: count, inputTokens: number, outputTokens: number, estimatedCostUsd: number }).strict(), 50),
    ocr: z.object({
      scansByStatus: array(z.object({ status: text, count }).strict()),
      jobsByStatus: array(z.object({ status: text, count }).strict()),
      retriedJobs: count,
      exhaustedJobs: count,
    }).strict(),
    queue: z.object({
      localJobStatus: array(z.object({ status: text, count }).strict()),
      remoteBacklog: z.object({ status: z.literal('unavailable'), note: text }).strict(),
    }).strict(),
    instrumentation: z.object({ aiRequestsWriter: z.enum(['not_wired', 'wired']), note: text }).strict(),
    series: array(series, 10),
  }).strict(),
  'ai.usage': page(z.object({
    id: text,
    task: text,
    provider: text,
    model: text,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    estimatedCostUsd: number,
    status: text,
    createdAt: text,
  }).strict()),
  'ai.scan_jobs': page(scanJob),
  overview: z.object({
    range,
    metrics: array(metric, 20),
    series: array(series, 10),
    health: z.object({ status: z.enum(['ok', 'degraded', 'unhealthy']), checks: array(health, 20) }).strict(),
    incidents: array(z.object({ id: text, occurredAt: text, severity: z.enum(['info', 'warning', 'critical']), title: text, source: text }).strict(), 10),
    actionQueue,
  }).strict(),
  system: z.object({ reachable: z.boolean(), tables: array(text, 8) }).strict(),
};

const scanJobActionResult = z.object({
  id: text,
  scanId: text,
  status: text,
  attempts: count,
  updatedAt: text,
}).strict();

const mutationOutputs: Record<MutationOperation, z.ZodTypeAny> = {
  'users.subscription.upgrade': z.object({
    userId: text,
    plan: z.literal('plus'),
    status: z.literal('active'),
    expiresAt: text,
    notified: z.boolean(),
  }).strict(),
  'users.subscription.cancel': z.object({
    userId: text,
    plan: z.enum(['free', 'plus']),
    status: text,
    expiresAt: nullable,
    immediate: z.boolean(),
  }).strict(),
  'users.suspend': z.object({
    userId: text,
    accountStatus: z.literal('suspended'),
    revokedSessions: count,
    updatedAt: text,
  }).strict(),
  'users.unsuspend': z.object({
    userId: text,
    accountStatus: z.literal('active'),
    updatedAt: text,
  }).strict(),
  'users.delete': z.object({
    userId: text,
    mode: z.enum(['anonymize', 'purge']),
    accountStatus: z.literal('deleted'),
    revokedSessions: count,
    deletedAt: text,
  }).strict(),
  'users.sessions.revoke': z.object({
    userId: text,
    revokedSessions: count,
    revokedAt: text,
  }).strict(),
  'users.verify_email': z.object({
    userId: text,
    isVerified: z.boolean(),
    accountsUpdated: count,
    verifiedAt: text,
  }).strict(),
  'users.quota.reset': z.object({
    userId: text,
    usedThisMonth: count,
    maxPerMonth: count,
    resetAt: text,
  }).strict(),
  'users.notify': z.object({
    notificationId: text,
    userId: text,
    type: notificationType,
    createdAt: text,
  }).strict(),
  'households.update': z.object({
    id: text,
    name: text,
    ownerUserId: text,
    removedUserId: nullable,
    memberCount: count,
    updatedAt: text,
  }).strict(),
  'households.purge_guests': z.object({
    olderThanDays: count,
    deletedHouseholds: count,
    deletedGuestUsers: count,
    purgedAt: text,
  }).strict(),
  'billing.intent.mark_paid': z.object({
    intentId: text,
    userId: text,
    status: z.literal('paid'),
    subscriptionExpiresAt: text,
    reconciliationCleared: z.boolean(),
    updatedAt: text,
  }).strict(),
  'billing.intent.refund': z.object({
    intentId: text,
    userId: text,
    status: z.literal('refunded'),
    subscriptionRevoked: z.boolean(),
    updatedAt: text,
  }).strict(),
  'billing.intent.resolve': z.object({
    intentId: text,
    status: z.enum(['expired', 'failed']),
    reconciliationCleared: z.boolean(),
    updatedAt: text,
  }).strict(),
  'recipes.verification.set': z.object({
    id: text,
    verificationState,
    version: count,
    updatedAt: text,
  }).strict(),
  'recipes.metadata.update': z.object({
    id: text,
    title: text,
    version: count,
    updatedAt: text,
  }).strict(),
  'recipes.media.reject': z.object({
    recipeId: text,
    role: z.enum(['hero', 'thumbnail']),
    version: count,
    status: z.literal('rejected'),
    updatedAt: text,
  }).strict(),
  'ai.scan_job.retry': scanJobActionResult,
  'ai.scan_job.cancel': scanJobActionResult,
  'system.hygiene.run': z.object({
    revokedSessionsDeleted: count,
    legacySessionsDeleted: count,
    expiredOtpsDeleted: count,
    expiredApprovalsClosed: count,
    ranAt: text,
  }).strict(),
  'system.broadcast.send': z.object({
    target: z.enum(['all_registered', 'pro_only']),
    recipientCount: count,
    sentAt: text,
  }).strict(),
};

export function validateOutput(operation: ReadOperation, value: unknown): unknown {
  return outputs[operation].parse(value);
}

export function validateMutationOutput(operation: MutationOperation, value: unknown): unknown {
  return mutationOutputs[operation].parse(value);
}
