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

export const RangeQuery = z.object({ range: rangeParam }).strict();

export const UsersQuery = PageSchema.extend({
  q: search,
  type: z.preprocess((v) => (v === undefined || v === '' ? 'registered' : v), z.enum(['registered', 'guest', 'all'])),
  plan: optional(z.enum(['free', 'plus'])),
  admin: optional(z.enum(['true', 'false'])),
}).strict();

export const UserDetailQuery = z.object({ reveal: optional(z.literal('email')) }).strict();
export const HouseholdsQuery = PageSchema.extend({ q: search }).strict();
export const TransactionsQuery = PageSchema.extend({ status: optional(z.enum(['pending', 'paid', 'failed', 'expired', 'refunded'])) }).strict();
export const AiUsageQuery = PageSchema.extend({
  task: optional(z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/)),
  status: optional(z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/)),
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
