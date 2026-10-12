import { z } from 'zod';
const Id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const membership = z.object({ householdId: Id, actorId: Id,
  role: z.enum(['owner', 'editor', 'viewer']), revoked: z.boolean() }).strict();
export type FamilyAction = 'read' | 'inventory_write' | 'plan_write' | 'shopping_write' | 'manage_members';
export function canFamilyAct(raw: unknown, householdId: string, actorId: string, action: FamilyAction): boolean {
  if (!['read', 'inventory_write', 'plan_write', 'shopping_write', 'manage_members'].includes(action)) return false;
  const parsed = membership.safeParse(raw);
  if (!parsed.success || parsed.data.revoked || parsed.data.householdId !== householdId || parsed.data.actorId !== actorId) return false;
  return action === 'read' || parsed.data.role === 'owner' ||
    (parsed.data.role === 'editor' && ['inventory_write', 'plan_write', 'shopping_write'].includes(action));
}
const digestPreference = z.object({ householdId: Id, userId: Id, optedIn: z.boolean(),
  timezone: z.string().max(100), quietStartHour: z.number().int().min(0).max(23),
  quietEndHour: z.number().int().min(0).max(23) }).strict();
export function planDigest(raw: unknown, now: Date, sentKeys: ReadonlySet<string>) {
  const p = digestPreference.parse(raw);
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_INSTANT');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: p.timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  const hour = Number(value('hour'));
  const quiet = p.quietStartHour < p.quietEndHour ? hour >= p.quietStartHour && hour < p.quietEndHour
    : p.quietStartHour > p.quietEndHour && (hour >= p.quietStartHour || hour < p.quietEndHour);
  const key = `digest:${p.householdId}:${p.userId}:${value('year')}-${value('month')}-${value('day')}`;
  return { classification: 'OFFLINE_CANDIDATE' as const, key,
    shouldSend: p.optedIn && !quiet && !sentKeys.has(key), deliveryVerified: false as const };
}
const purchase = z.object({ ingredientId: Id, evidenceIngredientId: Id, unit: z.enum(['g', 'ml']),
  amountMilliPerPackage: z.number().int().positive().safe(), evidenceReference: z.string().trim().min(1).max(300),
  missingMilli: z.number().int().nonnegative().safe() }).strict();
export function planPackagePurchase(raw: unknown) {
  const p = purchase.parse(raw);
  if (p.ingredientId !== p.evidenceIngredientId) throw new Error('CONVERSION_IDENTITY_MISMATCH');
  const count = Math.ceil(p.missingMilli / p.amountMilliPerPackage);
  const purchasedMilli = count * p.amountMilliPerPackage;
  if (!Number.isSafeInteger(purchasedMilli)) throw new Error('QUANTITY_OVERFLOW');
  return { packageCount: count, purchasedMilli, leftoverMilli: purchasedMilli - p.missingMilli,
    unit: p.unit, evidenceReference: p.evidenceReference };
}
export function authorizeEnrichmentReview(raw: unknown, expectedRelease: string, currentRevision: number) {
  const schema = z.object({ globalReviewer: z.literal(true), releaseId: Id, expectedRevision: z.number().int().nonnegative().safe(),
    decision: z.enum(['approve', 'reject', 'needs_evidence']), evidenceReference: z.string().trim().min(1).max(300) }).strict();
  const parsed = schema.safeParse(raw);
  return parsed.success && parsed.data.releaseId === expectedRelease && parsed.data.expectedRevision === currentRevision;
}
const entitlement = z.object({ paidUntil: z.string().datetime().nullable(), trial: z.object({
  id: Id, startsAt: z.string().datetime(), endsAt: z.string().datetime(), policyVersion: Id,
  eligibilityVerified: z.literal(true),
}).strict().nullable() }).strict();
export function projectEntitlement(raw: unknown, now: Date) {
  const p = entitlement.parse(raw);
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_INSTANT');
  if (p.trial && Date.parse(p.trial.endsAt) <= Date.parse(p.trial.startsAt)) throw new Error('INVALID_TRIAL_WINDOW');
  const paid = p.paidUntil !== null && Date.parse(p.paidUntil) > now.getTime();
  const trial = p.trial !== null && Date.parse(p.trial.startsAt) <= now.getTime() && Date.parse(p.trial.endsAt) > now.getTime();
  return { classification: 'OFFLINE_CANDIDATE' as const, plus: paid || trial,
    basis: paid ? 'paid_evidence' : trial ? 'trial_evidence' : 'none', runtimeGrant: false as const };
}
const analytics = z.object({ event: z.enum(['planner_opened', 'scan_reviewed', 'shopping_completed']),
  consent: z.literal(true) }).strict();
export function aggregatePrivateAnalytics(raw: readonly unknown[], minimumCohort: number) {
  if (!Number.isSafeInteger(minimumCohort) || minimumCohort < 10) throw new Error('INVALID_PRIVACY_FLOOR');
  const accepted = raw.map((value) => analytics.safeParse(value)).filter((row) => row.success);
  if (accepted.length < minimumCohort) return { status: 'INSUFFICIENT_COHORT', counts: null };
  const counts = { planner_opened: 0, scan_reviewed: 0, shopping_completed: 0 };
  for (const row of accepted) if (row.success) counts[row.data.event]++;
  // Event counts cannot establish unique users; keep the real cohort gate open.
  return { status: 'OFFLINE_EVENT_COUNTS', counts, uniqueCohortVerified: false };
}
