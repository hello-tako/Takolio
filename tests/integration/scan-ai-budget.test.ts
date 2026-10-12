import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createScanAIBudgetPolicy, createScanAICallProof, reserveScanAICall,
  type ScanAIBudgetPolicy, type ScanAICallProof, type ScanAIBudgetAdmission,
} from '../../packages/db/src/scan-ai-budget';
import { createBarrier, SqliteD1 } from '../helpers/sqlite-d1';

const owner = { jobId: 'budget-job-a', scanId: 'budget-scan-a', householdId: 'budget-house-a', userId: 'budget-user-a' };
const lease = { ...owner, claimToken: 'budget-lease-one', claimAttempt: 1 };
const foreign = { jobId: 'budget-job-b', scanId: 'budget-scan-b', householdId: 'budget-house-b', userId: 'budget-user-b' };
const sha = (letter: string) => letter.repeat(64);
let db: SqliteD1;
const SIDE_EFFECT_TABLES = ['users', 'households', 'household_members', 'scans', 'scan_items', 'scan_queue_jobs',
  'scan_quota_ledger', 'scan_quota_periods', 'inventory_items', 'inventory_lots', 'inventory_commands', 'inventory_events'];
function sourceEvidence(kind = 'primary') {
  return { providerId: 'test-verified-provider', physicalModel: 'test-physical-model', task: 'fridge_image_analysis', kind,
    requestSha256: sha('a'),
    input: { tokenBound: 100, scope: 'COMPLETE_PROVIDER_INPUT', method: 'CERTIFIED_UPPER_BOUND', requestSha256: sha('a'),
      evidenceReference: 'test-complete-input-contract', evidenceSha256: sha('b') },
    output: { tokenBound: 50, enforcement: 'PROVIDER_ENFORCED_MAX_TOKENS', requestSha256: sha('a'),
      evidenceReference: 'test-output-enforcement-contract', evidenceSha256: sha('c') },
    pricing: { verification: 'VERIFIED', currency: 'USD', scope: 'COMPLETE_CALL_CHARGES', providerId: 'test-verified-provider',
      physicalModel: 'test-physical-model', inputMicroUsdPerMillionTokens: 1_000_000, outputMicroUsdPerMillionTokens: 2_000_000,
      fixedCallMicroUsd: 10, version: 'test-reviewed-price-v1', sourceReference: 'test-price-ledger-entry', sourceSha256: sha('d'),
      validFrom: '2020-01-01T00:00:00.000Z', validUntil: '2099-01-01T00:00:00.000Z' } };
}
const policySource = (overrides: Record<string, unknown> = {}) => ({ ...owner, lane: 'main', policyReference: 'test-job-policy-v1',
  limits: { maxCalls: 3, maxTokens: 450, maxMicroUsd: 630 }, ...overrides });
const policy = (overrides: Record<string, unknown> = {}) => createScanAIBudgetPolicy(() => policySource(overrides));
const proof = (kind = 'primary') => createScanAICallProof(() => sourceEvidence(kind));
function reservations() { return db.query('SELECT * FROM scan_ai_call_reservations ORDER BY id'); }
function budgetFacts() {
  return { budgets: db.query('SELECT * FROM scan_ai_job_budgets ORDER BY job_id,lane'), reservations: reservations() };
}
function sideEffects() {
  return Object.fromEntries(SIDE_EFFECT_TABLES.map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY rowid`)]));
}
async function admit(key: string, options: { policy?: ScanAIBudgetPolicy; proof?: ScanAICallProof; lease?: unknown } = {}) {
  return reserveScanAICall(db, { callKey: key, policy: options.policy ?? await policy(), proof: options.proof ?? await proof(),
    lease: options.lease ?? lease });
}
function expectGranted(result: ScanAIBudgetAdmission) {
  expect(result).toMatchObject({ ok: true, acquired: true, reason: 'acquired',
    reservation: { jobId: owner.jobId, lane: 'main', reservedTokens: 150, reservedMicroUsd: 210, outcome: 'RESERVED_UNKNOWN' } });
}

beforeEach(() => {
  db = new SqliteD1();
  db.seed(readFileSync('docs/backend-upgrade/b04b/schema.candidate.sql', 'utf8'));
  db.seed(`INSERT INTO users(id) VALUES ('${owner.userId}'),('${foreign.userId}');
    INSERT INTO households(id,name,created_by) VALUES ('${owner.householdId}','Budget A','${owner.userId}'),('${foreign.householdId}','Budget B','${foreign.userId}');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('budget-member-a','${owner.householdId}','${owner.userId}','owner'),('budget-member-b','${foreign.householdId}','${foreign.userId}','owner');
    INSERT INTO scans(id,user_id,household_id,status) VALUES
      ('${owner.scanId}','${owner.userId}','${owner.householdId}','processing'),('${foreign.scanId}','${foreign.userId}','${foreign.householdId}','processing');
    INSERT INTO scan_queue_jobs(id,scan_id,household_id,user_id,idempotency_key,status,attempts,claim_attempt,claim_token,locked_at)
    VALUES ('${owner.jobId}','${owner.scanId}','${owner.householdId}','${owner.userId}','budget-queue-a','processing',1,1,'${lease.claimToken}',datetime('now')),
      ('${foreign.jobId}','${foreign.scanId}','${foreign.householdId}','${foreign.userId}','budget-queue-b','processing',1,1,'foreign-lease',datetime('now'));
    INSERT INTO scan_quota_ledger(id,user_id,household_id,scan_id,idempotency_key,period_start,status)
    VALUES ('budget-quota','${owner.userId}','${owner.householdId}','${owner.scanId}','budget-quota-key','2026-10-01','reserved');
    INSERT INTO scan_quota_periods(user_id,household_id,period_start,used_count,max_scans)
    VALUES ('${owner.userId}','${owner.householdId}','2026-10-01',1,5);
    INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit)
    VALUES ('budget-stock','${owner.householdId}','RICE','Rice',1,'kg');`);
});
afterEach(() => db.close());

describe('B04b candidate durable reservation boundary', () => {
  it('reserves the complete call upper bound before a simulated provider attempt without changing other authorities', async () => {
    const before = sideEffects();
    let networkCalls = 0;
    const result = await admit('call-primary');
    expectGranted(result);
    if (result.acquired) {
      expect(reservations()).toHaveLength(1);
      networkCalls++;
    }
    expect(networkCalls).toBe(1);
    expect(reservations()[0]).toMatchObject({ claim_token: lease.claimToken, claim_attempt: 1, kind: 'primary',
      input_token_bound: 100, output_token_bound: 50, reserved_tokens: 150, reserved_micro_usd: 210 });
    expect(sideEffects()).toEqual(before);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('never grants a second call for a replay or mutable provider evidence source', async () => {
    const evidence = sourceEvidence();
    const trustedProof = await createScanAICallProof(() => evidence);
    const source = policySource();
    const immutablePolicy = await createScanAIBudgetPolicy(() => source);
    expectGranted(await admit('same-call', { proof: trustedProof, policy: immutablePolicy }));
    const before = budgetFacts();
    evidence.input.tokenBound = 1;
    evidence.pricing.fixedCallMicroUsd = 0;
    source.limits.maxCalls = 999;
    expect(await admit('same-call', { proof: trustedProof, policy: immutablePolicy }))
      .toMatchObject({ ok: true, acquired: false, reason: 'replay', reservation: { reservedTokens: 150, reservedMicroUsd: 210 } });
    expect(budgetFacts()).toEqual(before);
  });

  it.each(['primary', 'repair', 'retry', 'escalation'])('charges every %s attempt and permanently consumes a crash reservation', async (kind) => {
    expectGranted(await admit('crashed-call', { proof: await proof(kind) }));
    const charged = budgetFacts();
    // No provider result exists; a fresh worker may only observe the reserved UNKNOWN charge.
    expect(await admit('crashed-call', { proof: await proof(kind) })).toMatchObject({ ok: true, acquired: false, reason: 'replay' });
    expect(budgetFacts()).toEqual(charged);
    expectGranted(await admit('repair-call', { proof: await proof('repair') }));
    expectGranted(await admit('retry-call', { proof: await proof('retry') }));
    const before = budgetFacts();
    expect(await admit('fourth-call')).toEqual({ ok: false, acquired: false, reason: 'BUDGET_EXCEEDED' });
    expect(budgetFacts()).toEqual(before);
    expect(reservations()).toHaveLength(3);
  });

  it.each([
    { maxCalls: 0, maxTokens: 10000, maxMicroUsd: 10000 },
    { maxCalls: 100, maxTokens: 149, maxMicroUsd: 10000 },
    { maxCalls: 100, maxTokens: 10000, maxMicroUsd: 209 },
  ])('enforces each independent ceiling atomically (%j)', async (limits) => {
    const before = sideEffects();
    expect(await admit('over-ceiling', { policy: await policy({ limits }) }))
      .toEqual({ ok: false, acquired: false, reason: 'BUDGET_EXCEEDED' });
    expect(reservations()).toEqual([]);
    expect(sideEffects()).toEqual(before);
  });

  it('makes policy immutable across retries and rejects a more permissive replacement', async () => {
    expectGranted(await admit('initial-call'));
    const before = budgetFacts();
    expect(await admit('second-call', { policy: await policy({ limits: { maxCalls: 999, maxTokens: 99999, maxMicroUsd: 99999 } }) }))
      .toEqual({ ok: false, acquired: false, reason: 'POLICY_CONFLICT' });
    expect(budgetFacts()).toEqual(before);
    expect(() => db.execute('UPDATE scan_ai_job_budgets SET max_calls=999')).toThrow('SCAN_AI_BUDGET_IMMUTABLE');
    expect(() => db.execute('DELETE FROM scan_ai_job_budgets')).toThrow('SCAN_AI_BUDGET_IMMUTABLE');
  });

  it.each(['request', 'input', 'output', 'pricing', 'model', 'kind'])('conflicts on the same call key with different %s evidence', async (field) => {
    expectGranted(await admit('descriptor-key'));
    const evidence = sourceEvidence();
    if (field === 'request') { evidence.requestSha256 = sha('e'); evidence.input.requestSha256 = sha('e'); evidence.output.requestSha256 = sha('e'); }
    if (field === 'input') evidence.input.tokenBound = 99;
    if (field === 'output') evidence.output.tokenBound = 49;
    if (field === 'pricing') evidence.pricing.version = 'test-price-v2';
    if (field === 'model') { evidence.physicalModel = 'other-model'; evidence.pricing.physicalModel = 'other-model'; }
    if (field === 'kind') evidence.kind = 'retry';
    const before = budgetFacts();
    expect(await admit('descriptor-key', { proof: await createScanAICallProof(() => evidence) }))
      .toEqual({ ok: false, acquired: false, reason: 'IDEMPOTENCY_CONFLICT' });
    expect(budgetFacts()).toEqual(before);
  });

  it('serializes concurrent distinct call admissions within the cumulative ceiling', async () => {
    const cap = await policy({ limits: { maxCalls: 1, maxTokens: 150, maxMicroUsd: 210 } });
    const barrier = createBarrier(2);
    db.hooks.beforeBatch = () => barrier.wait();
    const outcomes = await Promise.all([admit('race-call-a', { policy: cap }), admit('race-call-b', { policy: cap })]);
    expect(outcomes.filter((result) => result.acquired)).toHaveLength(1);
    expect(outcomes.filter((result) => !result.ok)).toEqual([{ ok: false, acquired: false, reason: 'BUDGET_EXCEEDED' }]);
    expect(reservations()).toHaveLength(1);
  });

  it('grants only one concurrent admission for the same key', async () => {
    const barrier = createBarrier(2);
    db.hooks.beforeBatch = () => barrier.wait();
    const outcomes = await Promise.all([admit('concurrent-key'), admit('concurrent-key')]);
    expect(outcomes.filter((result) => result.acquired)).toHaveLength(1);
    expect(outcomes.filter((result) => result.ok && !result.acquired)).toMatchObject([{ reason: 'replay' }]);
    expect(reservations()).toHaveLength(1);
  });

  it('keeps a committed reservation after response loss and never turns its recovery into network permission', async () => {
    let lost = false;
    db.hooks.afterBatch = () => { db.hooks = {}; lost = true; throw new Error('Fixture response lost after COMMIT'); };
    expect(await admit('lost-response')).toMatchObject({ ok: true, acquired: false, reason: 'response_unknown' });
    expect(lost).toBe(true);
    const before = budgetFacts();
    expect(await admit('lost-response')).toMatchObject({ ok: true, acquired: false, reason: 'replay' });
    expect(budgetFacts()).toEqual(before);
    expect(reservations()).toHaveLength(1);
  });

  it('rolls back policy and reservation together if the admission INSERT aborts', async () => {
    const before = sideEffects();
    db.seed(`CREATE TRIGGER budget_injected_abort BEFORE INSERT ON scan_ai_call_reservations
      BEGIN SELECT RAISE(ABORT,'Injected reservation failure'); END;`);
    expect(await admit('rollback-key')).toEqual({ ok: false, acquired: false, reason: 'DATABASE_UNAVAILABLE' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
    expect(sideEffects()).toEqual(before);
  });

  it('retains all old-lease charges after redelivery and refuses old/cancelled leases', async () => {
    expectGranted(await admit('lease-one-call'));
    db.execute(`UPDATE scan_queue_jobs SET claim_token='budget-lease-two',claim_attempt=2,attempts=2,locked_at=datetime('now') WHERE id=?`, [owner.jobId]);
    const next = { ...lease, claimToken: 'budget-lease-two', claimAttempt: 2 };
    const before = budgetFacts();
    expect(await admit('stale-call')).toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual(before);
    expect(await admit('lease-one-call', { lease: next })).toMatchObject({ ok: true, acquired: false, reason: 'replay' });
    expectGranted(await admit('lease-two-call', { lease: next }));
    db.execute(`UPDATE scan_queue_jobs SET status='failed',claim_token='cancelled-lease',error_code='SCAN_CANCELLED' WHERE id=?`, [owner.jobId]);
    db.execute("UPDATE scans SET status='failed' WHERE id=?", [owner.scanId]);
    const cancelled = budgetFacts();
    expect(await admit('cancelled-call', { lease: next })).toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual(cancelled);
    expect(reservations()).toHaveLength(2);
  });

  it.each(['expired', 'future', 'wrong-token', 'wrong-attempt', 'scan-ready', 'job-ready', 'revoked-membership'])
  ('denies %s admission before persisting policy or reservations', async (condition) => {
    if (condition === 'expired') db.execute("UPDATE scan_queue_jobs SET locked_at=datetime('now','-11 minutes') WHERE id=?", [owner.jobId]);
    if (condition === 'future') db.execute("UPDATE scan_queue_jobs SET locked_at=datetime('now','+1 hour') WHERE id=?", [owner.jobId]);
    if (condition === 'wrong-token') db.execute("UPDATE scan_queue_jobs SET claim_token='different' WHERE id=?", [owner.jobId]);
    if (condition === 'wrong-attempt') db.execute('UPDATE scan_queue_jobs SET claim_attempt=2 WHERE id=?', [owner.jobId]);
    if (condition === 'scan-ready') db.execute("UPDATE scans SET status='ready' WHERE id=?", [owner.scanId]);
    if (condition === 'job-ready') db.execute("UPDATE scan_queue_jobs SET status='ready' WHERE id=?", [owner.jobId]);
    if (condition === 'revoked-membership') db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [owner.householdId, owner.userId]);
    const before = sideEffects();
    expect(await admit('denied-lease')).toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
    expect(sideEffects()).toEqual(before);
  });

  it('fences a lease revoked between its read and atomic batch admission', async () => {
    db.hooks.beforeBatch = () => {
      db.hooks = {};
      db.execute("UPDATE scan_queue_jobs SET status='failed',claim_token='cancelled',error_code='SCAN_CANCELLED' WHERE id=?", [owner.jobId]);
      db.execute("UPDATE scans SET status='failed' WHERE id=?", [owner.scanId]);
    };
    expect(await admit('fenced-admission')).toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
  });

  it('does not grant a provider call when cancellation follows the committed reservation', async () => {
    db.hooks.afterBatch = () => {
      db.hooks = {};
      db.execute("UPDATE scan_queue_jobs SET status='failed',claim_token='cancelled',error_code='SCAN_CANCELLED' WHERE id=?", [owner.jobId]);
      db.execute("UPDATE scans SET status='failed' WHERE id=?", [owner.scanId]);
    };
    expect(await admit('cancel-after-reserve')).toMatchObject({ ok: true, acquired: false, reason: 'claim_lost_after_reserve' });
    expect(reservations()).toHaveLength(1);
  });

  it('refuses admission if membership disappears at the batch barrier', async () => {
    db.hooks.beforeBatch = () => {
      db.hooks = {};
      db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [owner.householdId, owner.userId]);
    };
    expect(await admit('revocation-race')).toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
  });

  it('retains the charge and grants nothing if the postcommit receipt read is unavailable', async () => {
    db.hooks.afterBatch = () => {
      db.hooks = { beforeStatement: ({ sql }) => {
        if (sql.includes('FROM scan_ai_call_reservations')) throw new Error('Receipt read unavailable');
      } };
    };
    expect(await admit('unreadable-receipt')).toEqual({ ok: false, acquired: false, reason: 'DATABASE_UNAVAILABLE' });
    expect(reservations()).toHaveLength(1);
    db.hooks = {};
    const charged = budgetFacts();
    expect(await admit('unreadable-receipt')).toMatchObject({ ok: true, acquired: false, reason: 'replay' });
    expect(budgetFacts()).toEqual(charged);
  });

  it('does not claim a call when no batch has committed', async () => {
    db.hooks.beforeBatch = () => { db.hooks = {}; throw new Error('Before transaction network unavailable'); };
    expect(await admit('uncommitted')).toEqual({ ok: false, acquired: false, reason: 'DATABASE_UNAVAILABLE' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
  });

  it('cannot refund or delete an unknown charge through the candidate schema', async () => {
    expectGranted(await admit('no-refund'));
    const before = budgetFacts();
    expect(() => db.execute('UPDATE scan_ai_call_reservations SET reserved_tokens=0,reserved_micro_usd=0'))
      .toThrow('SCAN_AI_RESERVATION_IMMUTABLE');
    expect(() => db.execute('DELETE FROM scan_ai_call_reservations')).toThrow('SCAN_AI_RESERVATION_IMMUTABLE');
    expect(() => db.execute('DELETE FROM scan_queue_jobs WHERE id=?', [owner.jobId])).toThrow();
    expect(budgetFacts()).toEqual(before);
  });

  it('isolates shadow admissions from main and from user scan quota', async () => {
    const shadowPolicy = await policy({ lane: 'shadow', limits: { maxCalls: 1, maxTokens: 150, maxMicroUsd: 210 } });
    const before = sideEffects();
    expect(await admit('shadow-one', { policy: shadowPolicy, proof: await proof('shadow') }))
      .toMatchObject({ ok: true, acquired: true, reservation: { lane: 'shadow' } });
    expect(await admit('shadow-two', { policy: shadowPolicy, proof: await proof('shadow') }))
      .toEqual({ ok: false, acquired: false, reason: 'BUDGET_EXCEEDED' });
    expectGranted(await admit('main-one'));
    expect(db.query('SELECT lane,COUNT(*) AS calls,SUM(reserved_tokens) AS tokens FROM scan_ai_call_reservations GROUP BY lane ORDER BY lane'))
      .toEqual([{ lane: 'main', calls: 1, tokens: 150 }, { lane: 'shadow', calls: 1, tokens: 150 }]);
    expect(await admit('invalid-shadow', { proof: await proof('shadow') }))
      .toEqual({ ok: false, acquired: false, reason: 'POLICY_CONFLICT' });
    expect(sideEffects()).toEqual(before);
  });

  it('rejects a foreign or misbound scope without reading that household budget', async () => {
    const before = budgetFacts();
    expect(await admit('foreign-job', { lease: { ...lease, householdId: foreign.householdId } }))
      .toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(await admit('foreign-job', { policy: await policy({ ...foreign }), lease: { ...foreign, claimToken: lease.claimToken, claimAttempt: 1 } }))
      .toEqual({ ok: false, acquired: false, reason: 'CLAIM_LOST' });
    expect(budgetFacts()).toEqual(before);
  });
});

describe('B04b trusted evidence and exact cost arithmetic', () => {
  it.each(['no-input-bound', 'estimate-only', 'no-output-enforcement', 'mismatched-input', 'mismatched-output', 'wrong-model', 'unverified-price', 'wrong-currency'])
  ('refuses %s evidence', async (condition) => {
    const evidence = sourceEvidence() as Record<string, unknown>;
    const input = evidence.input as Record<string, unknown>;
    const output = evidence.output as Record<string, unknown>;
    const pricing = evidence.pricing as Record<string, unknown>;
    if (condition === 'no-input-bound') input.tokenBound = null;
    if (condition === 'estimate-only') { input.method = 'ESTIMATED'; input.estimatedInputTokens = 100; }
    if (condition === 'no-output-enforcement') output.enforcement = 'LOCAL_TIMEOUT';
    if (condition === 'mismatched-input') input.requestSha256 = sha('e');
    if (condition === 'mismatched-output') output.requestSha256 = sha('e');
    if (condition === 'wrong-model') pricing.physicalModel = 'unmatched';
    if (condition === 'unverified-price') pricing.verification = 'ESTIMATED';
    if (condition === 'wrong-currency') pricing.currency = 'JPY';
    await expect(createScanAICallProof(() => evidence)).rejects.toMatchObject({ name: 'ScanAIBudgetError', code: 'UNTRUSTED_EVIDENCE' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
  });

  it('rejects forged structural capabilities and returns sanitized schema failures', async () => {
    await expect(reserveScanAICall(db, { policy: {} as ScanAIBudgetPolicy, proof: await proof(), lease, callKey: 'fake' }))
      .rejects.toMatchObject({ code: 'INVALID_POLICY', message: 'INVALID_POLICY' });
    await expect(admit('fake', { proof: {} as ScanAICallProof })).rejects.toMatchObject({ code: 'UNTRUSTED_EVIDENCE' });
    await expect(admit('fake', { lease: { ...lease, claimAttempt: -1, rawSecret: 'private-input' } }))
      .rejects.toMatchObject({ code: 'INVALID_LEASE', message: 'INVALID_LEASE' });
    await expect(admit(' ')).rejects.toMatchObject({ code: 'INVALID_CALL_KEY', message: 'INVALID_CALL_KEY' });
  });

  it.each(['not-yet-valid', 'expired'])('blocks %s pricing without a reservation', async (condition) => {
    const evidence = sourceEvidence();
    if (condition === 'not-yet-valid') { evidence.pricing.validFrom = '2098-01-01T00:00:00.000Z'; }
    else { evidence.pricing.validUntil = '2021-01-01T00:00:00.000Z'; }
    expect(await admit('expired-price', { proof: await createScanAICallProof(() => evidence) }))
      .toEqual({ ok: false, acquired: false, reason: 'EVIDENCE_EXPIRED' });
    expect(budgetFacts()).toEqual({ budgets: [], reservations: [] });
  });

  it('rounds input and output costs upward separately using integer arithmetic', async () => {
    const evidence = sourceEvidence();
    evidence.input.tokenBound = 1;
    evidence.output.tokenBound = 1;
    evidence.pricing.inputMicroUsdPerMillionTokens = 1;
    evidence.pricing.outputMicroUsdPerMillionTokens = 1;
    evidence.pricing.fixedCallMicroUsd = 0;
    expect(await admit('fractional-cost', { proof: await createScanAICallProof(() => evidence) }))
      .toMatchObject({ ok: true, acquired: true, reservation: { reservedTokens: 2, reservedMicroUsd: 2 } });
  });

  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER, 1_000_000_000_001])('refuses an inexact/out-of-range bound (%s)', async (invalid) => {
    const evidence = sourceEvidence(); evidence.input.tokenBound = invalid;
    await expect(createScanAICallProof(() => evidence)).rejects.toMatchObject({ code: 'UNTRUSTED_EVIDENCE' });
  });

  it('sanitizes provider exceptions and stores only hashes and bounded metadata', async () => {
    await expect(createScanAICallProof(() => { throw new Error('PRIVATE-prompt-or-pricing-body'); }))
      .rejects.toMatchObject({ code: 'UNTRUSTED_EVIDENCE', message: 'UNTRUSTED_EVIDENCE' });
    await expect(createScanAIBudgetPolicy(() => { throw new Error('PRIVATE-operator-payload'); }))
      .rejects.toMatchObject({ code: 'INVALID_POLICY', message: 'INVALID_POLICY' });
    expectGranted(await admit('private-free-reservation'));
    const stored = JSON.stringify(budgetFacts());
    expect(stored).not.toContain('evidenceReference');
    expect(stored).not.toContain('sourceReference');
    expect(stored).not.toContain('PRIVATE-');
  });

  it('uses exact BigInt pricing for a large representable upper bound', async () => {
    const evidence = sourceEvidence();
    evidence.input.tokenBound = 999_999_999;
    evidence.output.tokenBound = 1;
    evidence.pricing.inputMicroUsdPerMillionTokens = 123_456_789;
    evidence.pricing.outputMicroUsdPerMillionTokens = 0;
    evidence.pricing.fixedCallMicroUsd = 0;
    const expected = Number((999_999_999n * 123_456_789n + 999_999n) / 1_000_000n);
    expect(await admit('large-exact-cost', { proof: await createScanAICallProof(() => evidence),
      policy: await policy({ limits: { maxCalls: 1, maxTokens: 1_000_000_000, maxMicroUsd: expected } }) }))
      .toMatchObject({ ok: true, acquired: true, reservation: { reservedTokens: 1_000_000_000, reservedMicroUsd: expected } });
  });

  it('refuses combined-token and worst-case-price storage overflow', async () => {
    const evidence = sourceEvidence();
    evidence.input.tokenBound = 1_000_000_000_000;
    evidence.output.tokenBound = 1;
    await expect(createScanAICallProof(() => evidence)).rejects.toMatchObject({ code: 'UNTRUSTED_EVIDENCE' });
    evidence.input.tokenBound = 1_000_000_000;
    evidence.pricing.inputMicroUsdPerMillionTokens = 1_000_000_000_000;
    await expect(createScanAICallProof(() => evidence)).rejects.toMatchObject({ code: 'UNTRUSTED_EVIDENCE' });
  });
});
