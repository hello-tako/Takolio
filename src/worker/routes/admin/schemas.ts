import { z } from 'zod';
import { ADMIN_PAGE_MAX, ADMIN_PAGE_SIZE_MAX, ADMIN_ROLES } from '../../../shared/admin';

// Empty query values are treated as absent so cleared UI filters stay valid.
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const intParam = (min: number, max: number, fallback: number) =>
  z.preprocess((value) => (value === undefined || value === '' ? fallback : value),
    z.string().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().int().min(min).max(max)).or(z.literal(fallback)));

export const PageSchema = z.object({
  page: intParam(1, ADMIN_PAGE_MAX, 1),
  pageSize: intParam(1, ADMIN_PAGE_SIZE_MAX, 25),
});

const search = optional(z.string().trim().min(1).max(100));
const rangeParam = z.preprocess((value) => (value === undefined || value === '' ? '30d' : value), z.enum(['7d', '30d', '90d']));
const identifier = z.string().min(1).max(128).regex(/^(?!\.{1,2}$)[A-Za-z0-9_.:-]+$/);
const isoBound = optional(z.string().max(40).refine((value) => Number.isFinite(Date.parse(value)), 'invalid date'));
const reason = z.string().trim().min(1).max(500);
const notificationType = z.enum([
  'system',
  'announcement',
  'support',
  'billing',
  'expiring_soon',
  'cook_ready',
  'shopping_reminder',
]);

// ── Queries ────────────────────────────────────────────────────────────────

export const RangeQuery = z.object({ range: rangeParam }).strict();

export const UsersQuery = PageSchema.extend({
  q: search,
  type: z.preprocess((v) => (v === undefined || v === '' ? 'registered' : v), z.enum(['registered', 'guest', 'all'])),
  plan: optional(z.enum(['free', 'plus'])),
  accountStatus: optional(z.enum(['active', 'suspended', 'deleted'])),
  admin: optional(z.enum(['true', 'false'])),
}).strict();

export const UserDetailQuery = z.object({ reveal: optional(z.literal('email')) }).strict();
export const HouseholdsQuery = PageSchema.extend({ q: search }).strict();

export const TransactionsQuery = PageSchema.extend({
  status: optional(z.enum(['pending', 'paid', 'failed', 'expired', 'refunded'])),
  q: search,
  plan: optional(z.enum(['monthly', 'annual'])),
}).strict();

export const AiUsageQuery = PageSchema.extend({
  task: optional(z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/)),
  status: optional(z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/)),
}).strict();

export const ScanJobsQuery = PageSchema.extend({
  status: optional(z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/)),
  scanType: optional(z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/)),
}).strict();

export const RecipesQuery = PageSchema.extend({
  q: search,
  cuisine: optional(z.string().trim().min(1).max(64)),
  verification: optional(z.enum(['unverified', 'reviewed', 'rejected'])),
  source: optional(z.enum(['legacy', 'curated', 'imported', 'ai_generated', 'user_generated'])),
}).strict();

export const AuditQuery = PageSchema.extend({
  action: optional(z.string().trim().min(1).max(64).regex(/^[a-z0-9._]+$/)),
  outcome: optional(z.enum(['success', 'denied', 'failure'])),
  actor: optional(identifier),
  from: isoBound,
  to: isoBound,
}).strict();

export const EmptyQuery = z.object({}).strict();
export const IdParam = identifier;

// ── Admin Governance & Preferences Bodies ──────────────────────────────────

export const RecipeReviewBody = z.object({
  state: z.enum(['draft', 'in_review', 'approved', 'rejected']),
  note: z.string().trim().min(1).max(2000),
  recipeVersion: z.number().int().positive().safe(),
}).strict();

export const GrantRoleBody = z.object({ userId: identifier, role: z.enum(ADMIN_ROLES) }).strict();

export const PreferencesBody = z.object({
  locale: z.enum(['vi', 'en']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  sidebarCollapsed: z.boolean().optional(),
}).strict();

// ── Shared & User Mutation Bodies ──────────────────────────────────────────

export const ReasonBody = z.object({ reason }).strict();

export const UpgradeSubscriptionBody = z.object({
  duration: z.enum(['monthly', 'annual', 'custom']),
  customDays: z.number().int().min(1).max(3650).optional(),
  reason,
  notifyUser: z.boolean().optional(),
}).strict().refine((v) => v.duration !== 'custom' || v.customDays !== undefined, {
  message: 'customDays is required when duration is custom',
  path: ['customDays'],
});

export const CancelSubscriptionBody = z.object({
  immediate: z.boolean(),
  reason,
}).strict();

export const SuspendUserBody = ReasonBody;
export const UnsuspendUserBody = ReasonBody;

export const DeleteUserBody = z.object({
  mode: z.enum(['anonymize', 'purge']),
  reason,
}).strict();

export const RevokeUserSessionsBody = ReasonBody;
export const VerifyEmailBody = ReasonBody;
export const ResetQuotaBody = ReasonBody;

export const NotifyUserBody = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  type: notificationType.optional(),
  reason,
}).strict();

// ── Household Mutation Bodies ──────────────────────────────────────────────

export const UpdateHouseholdBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  newOwnerUserId: identifier.optional(),
  removeUserId: identifier.optional(),
  reason,
}).strict().refine(
  (v) => v.name !== undefined || v.newOwnerUserId !== undefined || v.removeUserId !== undefined,
  { message: 'At least one household update field is required' },
);

export const PurgeGuestHouseholdsBody = z.object({
  olderThanDays: z.number().int().min(1).max(3650),
  reason,
}).strict();

// ── Billing Mutation Bodies ────────────────────────────────────────────────

export const BillingMarkPaidBody = z.object({
  reason,
  grantDays: z.number().int().min(1).max(3650).optional(),
}).strict();

export const BillingRefundBody = z.object({
  reason,
  revokeSubscription: z.boolean(),
}).strict();

export const BillingResolveBody = z.object({
  outcome: z.enum(['expired', 'failed']),
  reason,
}).strict();

// ── Recipe Mutation Bodies ─────────────────────────────────────────────────

export const RecipeVerificationBody = z.object({
  verificationState: z.enum(['unverified', 'reviewed', 'rejected']),
  recipeVersion: z.number().int().positive().safe(),
  reason,
}).strict();

export const RecipeMetadataUpdateBody = z.object({
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
);

export const RecipeMediaRejectBody = z.object({
  role: z.enum(['hero', 'thumbnail']),
  version: z.number().int().positive().safe(),
  reason,
}).strict();

// ── AI Scan Job Mutation Bodies ────────────────────────────────────────────

export const ScanJobActionBody = ReasonBody;
export const ScanJobRetryBody = ReasonBody;
export const ScanJobCancelBody = ReasonBody;

// ── System Mutation Bodies ─────────────────────────────────────────────────

export const HygieneBody = z.preprocess(
  (value) => (value === undefined ? {} : value),
  z.object({ reason: reason.optional() }).strict(),
);

export const BroadcastBody = z.object({
  target: z.enum(['all_registered', 'pro_only']),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  reason,
}).strict();
