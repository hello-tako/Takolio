import { describe, expect, it } from 'vitest';
import { canFamilyAct, planDigest, planPackagePurchase, authorizeEnrichmentReview,
  projectEntitlement, aggregatePrivateAnalytics } from '../../packages/domain/src/product-vnext';
describe('dormant Product VNext policy candidates', () => {
  it('separates owner/editor/viewer and rejects foreign/revoked/forged members', () => {
    for (const role of ['owner', 'editor', 'viewer']) {
      const m = { householdId: 'home', actorId: 'actor', role, revoked: false };
      expect(canFamilyAct(m, 'home', 'actor', 'read')).toBe(true);
      expect(canFamilyAct(m, 'home', 'actor', 'inventory_write')).toBe(role !== 'viewer');
      expect(canFamilyAct(m, 'home', 'actor', 'manage_members')).toBe(role === 'owner');
      expect(canFamilyAct({ ...m, revoked: true }, 'home', 'actor', 'read')).toBe(false);
      expect(canFamilyAct(m, 'foreign', 'actor', 'read')).toBe(false);
      expect(canFamilyAct(m, 'home', 'foreign', 'read')).toBe(false);
    }
    expect(canFamilyAct({ role: 'owner' }, 'home', 'actor', 'read')).toBe(false);
  });
  it('uses consent, local quiet hours and one local-day identity across DST repeats', () => {
    const p = { householdId: 'home', userId: 'actor', optedIn: true, timezone: 'America/New_York', quietStartHour: 22, quietEndHour: 7 };
    const first = planDigest(p, new Date('2026-11-01T05:30:00Z'), new Set());
    const second = planDigest(p, new Date('2026-11-01T06:30:00Z'), new Set());
    expect(first.key).toBe(second.key);
    expect(first.shouldSend).toBe(false);
    const day = planDigest(p, new Date('2026-11-01T17:30:00Z'), new Set());
    expect(day.shouldSend).toBe(true);
    expect(planDigest(p, new Date('2026-11-01T17:30:00Z'), new Set([day.key])).shouldSend).toBe(false);
    expect(planDigest({ ...p, optedIn: false }, new Date('2026-11-01T17:30:00Z'), new Set()).shouldSend).toBe(false);
  });
  it('rounds only explicit package evidence and keeps purchased leftovers separate', () => {
    const p = { ingredientId: 'GARLIC', evidenceIngredientId: 'GARLIC', unit: 'g', amountMilliPerPackage: 100000,
      evidenceReference: 'TEST_ONLY:label', missingMilli: 150000 };
    expect(planPackagePurchase(p)).toMatchObject({ packageCount: 2, purchasedMilli: 200000, leftoverMilli: 50000 });
    expect(() => planPackagePurchase({ ...p, evidenceIngredientId: 'RICE' })).toThrow('CONVERSION_IDENTITY_MISMATCH');
    expect(() => planPackagePurchase({ ...p, amountMilliPerPackage: null })).toThrow();
  });
  it('requires global reviewer, source and revision rather than household owner status', () => {
    const r = { globalReviewer: true, releaseId: 'source', expectedRevision: 3, decision: 'approve', evidenceReference: 'TEST_ONLY:evidence' };
    expect(authorizeEnrichmentReview(r, 'source', 3)).toBe(true);
    expect(authorizeEnrichmentReview(r, 'source', 4)).toBe(false);
    expect(authorizeEnrichmentReview({ ...r, globalReviewer: false }, 'source', 3)).toBe(false);
    expect(authorizeEnrichmentReview(r, 'foreign', 3)).toBe(false);
  });
  it('never invents a trial or reset its expiry on repeated projection', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    expect(projectEntitlement({ paidUntil: null, trial: null }, now).plus).toBe(false);
    const trial = { id: 'trial', startsAt: '2026-10-11T00:00:00Z', endsAt: '2026-10-13T00:00:00Z',
      policyVersion: 'candidate', eligibilityVerified: true };
    const result = projectEntitlement({ paidUntil: null, trial }, now);
    expect(result).toMatchObject({ plus: true, runtimeGrant: false, basis: 'trial_evidence' });
    expect(projectEntitlement({ paidUntil: null, trial }, now)).toEqual(result);
    expect(projectEntitlement({ paidUntil: null, trial }, new Date(trial.endsAt)).plus).toBe(false);
  });
  it('drops PII/unknown events and absent consent; event count never proves unique cohort', () => {
    const valid = { event: 'planner_opened', consent: true };
    const invalid = { ...valid, email: 'private@example.test' };
    expect(aggregatePrivateAnalytics(Array(20).fill(invalid), 10).counts).toBeNull();
    expect(aggregatePrivateAnalytics(Array(20).fill({ ...valid, consent: false }), 10).counts).toBeNull();
    expect(aggregatePrivateAnalytics(Array(9).fill(valid), 10).counts).toBeNull();
    expect(aggregatePrivateAnalytics(Array(10).fill(valid), 10)).toMatchObject({ counts: { planner_opened: 10 }, uniqueCohortVerified: false });
  });
});
