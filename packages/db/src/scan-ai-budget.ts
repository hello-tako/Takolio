import { z } from 'zod';
import type { D1DatabaseBinding } from './index';

const Identity = z.string().min(1).max(200).refine((value) => value === value.trim() && !value.includes('\0'));
const Sha = z.string().regex(/^[a-f0-9]{64}$/);
const BoundedInteger = z.number().int().safe().min(0).max(1_000_000_000_000);
const PositiveInteger = BoundedInteger.refine((value) => value > 0);
const Instant = z.string().datetime({ offset: true });
const Scope = z.object({ jobId: Identity, scanId: Identity, householdId: Identity, userId: Identity }).strict();
const Lane = z.enum(['main', 'shadow']);

export const ScanAIBudgetPolicySchema = Scope.extend({
  lane: Lane,
  policyReference: Identity,
  limits: z.object({ maxCalls: z.number().int().min(0).max(10000), maxTokens: BoundedInteger,
    maxMicroUsd: BoundedInteger }).strict(),
}).strict();
export const ScanAIBudgetLeaseSchema = Scope.extend({ claimToken: Identity,
  claimAttempt: z.number().int().safe().positive() }).strict();
export const ScanAICallEvidenceSchema = z.object({
  providerId: Identity,
  physicalModel: Identity,
  task: z.enum(['fridge_image_analysis', 'receipt_ocr', 'label_ocr', 'ingredient_normalization', 'inventory_candidate_extraction']),
  kind: z.enum(['primary', 'repair', 'retry', 'escalation', 'shadow']),
  requestSha256: Sha,
  input: z.object({ tokenBound: BoundedInteger, scope: z.literal('COMPLETE_PROVIDER_INPUT'),
    method: z.enum(['PROVIDER_EXACT_TOKENIZER', 'CERTIFIED_UPPER_BOUND']), requestSha256: Sha,
    evidenceReference: Identity, evidenceSha256: Sha }).strict(),
  output: z.object({ tokenBound: PositiveInteger, enforcement: z.literal('PROVIDER_ENFORCED_MAX_TOKENS'),
    requestSha256: Sha, evidenceReference: Identity, evidenceSha256: Sha }).strict(),
  pricing: z.object({ verification: z.literal('VERIFIED'), currency: z.literal('USD'),
    scope: z.literal('COMPLETE_CALL_CHARGES'), providerId: Identity, physicalModel: Identity,
    inputMicroUsdPerMillionTokens: BoundedInteger, outputMicroUsdPerMillionTokens: BoundedInteger,
    fixedCallMicroUsd: BoundedInteger, version: Identity, sourceReference: Identity,
    sourceSha256: Sha, validFrom: Instant, validUntil: Instant }).strict(),
}).strict().superRefine((value, context) => {
  if (value.input.requestSha256 !== value.requestSha256 || value.output.requestSha256 !== value.requestSha256) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Token evidence must bind the complete outbound request' });
  }
  if (value.providerId !== value.pricing.providerId || value.physicalModel !== value.pricing.physicalModel) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pricing does not bind the provider and physical model' });
  }
  if (Date.parse(value.pricing.validFrom) >= Date.parse(value.pricing.validUntil)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pricing validity interval is empty' });
  }
  if (value.input.tokenBound + value.output.tokenBound > 1_000_000_000_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Total token reservation exceeds exact integer storage limit' });
  }
});

type PolicyInput = z.infer<typeof ScanAIBudgetPolicySchema>;
type Evidence = z.infer<typeof ScanAICallEvidenceSchema>;
type Lease = z.infer<typeof ScanAIBudgetLeaseSchema>;
declare const policyBrand: unique symbol;
declare const proofBrand: unique symbol;
export interface ScanAIBudgetPolicy { readonly [policyBrand]: true }
export interface ScanAICallProof { readonly [proofBrand]: true }
type Policy = PolicyInput & { fingerprint: string };
type Proof = { evidence: Evidence; fingerprint: string; tokens: number; microUsd: number };
const policies = new WeakMap<ScanAIBudgetPolicy, Policy>();
const proofs = new WeakMap<ScanAICallProof, Proof>();

export class ScanAIBudgetError extends Error {
  constructor(readonly code: 'INVALID_POLICY' | 'UNTRUSTED_EVIDENCE' | 'INVALID_LEASE' | 'INVALID_CALL_KEY') {
    super(code);
    this.name = 'ScanAIBudgetError';
  }
}
async function hash(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function parse<T>(schema: z.ZodType<T>, input: unknown, code: ConstructorParameters<typeof ScanAIBudgetError>[0]): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ScanAIBudgetError(code);
  return result.data;
}
function provider(source: unknown): asserts source is () => unknown {
  if (typeof source !== 'function') throw new ScanAIBudgetError('UNTRUSTED_EVIDENCE');
}

/** The caller installs reviewed server policy; never pass a request/queue-body provider here. */
export async function createScanAIBudgetPolicy(source: () => unknown): Promise<ScanAIBudgetPolicy> {
  provider(source);
  let parsed: PolicyInput;
  try { parsed = parse(ScanAIBudgetPolicySchema, source(), 'INVALID_POLICY'); }
  catch { throw new ScanAIBudgetError('INVALID_POLICY'); }
  const stored = { ...parsed, fingerprint: await hash(JSON.stringify(parsed)) };
  const capability = Object.freeze({}) as ScanAIBudgetPolicy;
  policies.set(capability, stored);
  return capability;
}

/** This boundary trusts its server provider's evidence authenticity, not client assertions. */
export async function createScanAICallProof(source: () => unknown): Promise<ScanAICallProof> {
  provider(source);
  let evidence: Evidence;
  try { evidence = parse(ScanAICallEvidenceSchema, source(), 'UNTRUSTED_EVIDENCE'); }
  catch { throw new ScanAIBudgetError('UNTRUSTED_EVIDENCE'); }
  const ceil = (tokens: number, rate: number) => (BigInt(tokens) * BigInt(rate) + 999_999n) / 1_000_000n;
  const price = ceil(evidence.input.tokenBound, evidence.pricing.inputMicroUsdPerMillionTokens)
    + ceil(evidence.output.tokenBound, evidence.pricing.outputMicroUsdPerMillionTokens)
    + BigInt(evidence.pricing.fixedCallMicroUsd);
  if (price > 1_000_000_000_000n) throw new ScanAIBudgetError('UNTRUSTED_EVIDENCE');
  const capability = Object.freeze({}) as ScanAICallProof;
  proofs.set(capability, { evidence, fingerprint: await hash(JSON.stringify(evidence)),
    tokens: evidence.input.tokenBound + evidence.output.tokenBound, microUsd: Number(price) });
  return capability;
}

interface ReservationRow {
  id: string; descriptor_fingerprint: string; proof_fingerprint: string;
  reserved_tokens: number; reserved_micro_usd: number; outcome: string;
}
export interface ScanAIReservation {
  id: string; jobId: string; lane: 'main' | 'shadow'; callKey: string;
  descriptorFingerprint: string; proofFingerprint: string;
  reservedTokens: number; reservedMicroUsd: number; outcome: 'RESERVED_UNKNOWN';
}
export type ScanAIBudgetAdmission =
  | { ok: true; acquired: boolean; reservation: ScanAIReservation;
      reason: 'acquired' | 'replay' | 'response_unknown' | 'claim_lost_after_reserve' }
  | { ok: false; acquired: false;
      reason: 'CLAIM_LOST' | 'POLICY_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'BUDGET_EXCEEDED'
        | 'EVIDENCE_EXPIRED' | 'DATABASE_UNAVAILABLE' | 'DATA_INTEGRITY_ERROR' };

const CLAIM_SQL = `SELECT j.id FROM scan_queue_jobs j JOIN scans s ON s.id=j.scan_id
  WHERE j.id=? AND j.scan_id=? AND j.household_id=? AND j.user_id=?
    AND j.status='processing' AND j.claim_token=? AND j.claim_attempt=?
    AND datetime(j.locked_at)>datetime('now','-10 minutes') AND datetime(j.locked_at)<=datetime('now')
    AND s.id=? AND s.household_id=? AND s.user_id=? AND s.status='processing'
    AND EXISTS (SELECT 1 FROM household_members m WHERE m.household_id=j.household_id AND m.user_id=j.user_id)`;
function claimBindings(lease: Lease) {
  return [lease.jobId, lease.scanId, lease.householdId, lease.userId, lease.claimToken, lease.claimAttempt,
    lease.scanId, lease.householdId, lease.userId];
}
function sameScope(policy: Policy, lease: Lease) {
  return policy.jobId === lease.jobId && policy.scanId === lease.scanId
    && policy.householdId === lease.householdId && policy.userId === lease.userId;
}
function evidenceCurrent(proof: Proof) {
  const now = Date.now();
  return now >= Date.parse(proof.evidence.pricing.validFrom) && now < Date.parse(proof.evidence.pricing.validUntil);
}

/** Reserve before provider I/O. Only acquired=true authorizes one attempt; replay/unknown never does. */
export async function reserveScanAICall(db: D1DatabaseBinding, input: {
  policy: ScanAIBudgetPolicy; proof: ScanAICallProof; lease: unknown; callKey: string;
}): Promise<ScanAIBudgetAdmission> {
  const policy = policies.get(input.policy);
  const proof = proofs.get(input.proof);
  if (!policy) throw new ScanAIBudgetError('INVALID_POLICY');
  if (!proof) throw new ScanAIBudgetError('UNTRUSTED_EVIDENCE');
  const lease = parse(ScanAIBudgetLeaseSchema, input.lease, 'INVALID_LEASE');
  const key = parse(Identity, input.callKey, 'INVALID_CALL_KEY');
  const denied = (reason: Extract<ScanAIBudgetAdmission, { ok: false }>['reason']): ScanAIBudgetAdmission =>
    ({ ok: false, acquired: false, reason });
  if (!sameScope(policy, lease)) return denied('CLAIM_LOST');
  if ((proof.evidence.kind === 'shadow') !== (policy.lane === 'shadow')) return denied('POLICY_CONFLICT');
  if (!evidenceCurrent(proof)) return denied('EVIDENCE_EXPIRED');
  const descriptor = await hash(JSON.stringify({ jobId: policy.jobId, lane: policy.lane,
    policyFingerprint: policy.fingerprint, proofFingerprint: proof.fingerprint, callKey: key }));
  const read = () => db.prepare(`SELECT id,descriptor_fingerprint,proof_fingerprint,reserved_tokens,reserved_micro_usd,outcome
    FROM scan_ai_call_reservations WHERE job_id=? AND lane=? AND call_key=?`)
    .bind(policy.jobId, policy.lane, key).first<ReservationRow>();
  const current = () => db.prepare(CLAIM_SQL).bind(...claimBindings(lease)).first();
  const receipt = (row: ReservationRow, acquired: boolean,
    reason: Extract<ScanAIBudgetAdmission, { ok: true }>['reason']): ScanAIBudgetAdmission => {
    if (row.descriptor_fingerprint !== descriptor) return denied('IDEMPOTENCY_CONFLICT');
    if (row.proof_fingerprint !== proof.fingerprint || row.reserved_tokens !== proof.tokens
      || row.reserved_micro_usd !== proof.microUsd || row.outcome !== 'RESERVED_UNKNOWN') return denied('DATA_INTEGRITY_ERROR');
    return { ok: true, acquired, reason, reservation: { id: row.id, jobId: policy.jobId, lane: policy.lane,
      callKey: key, descriptorFingerprint: descriptor, proofFingerprint: proof.fingerprint,
      reservedTokens: proof.tokens, reservedMicroUsd: proof.microUsd, outcome: 'RESERVED_UNKNOWN' } };
  };
  let responseUnknown = false;
  let inserted = false;
  try {
    if (!await current()) return denied('CLAIM_LOST');
    const prior = await read();
    if (prior) return receipt(prior, false, 'replay');
    const reservationId = `aib_${crypto.randomUUID()}`;
    try {
      const budgetInsert = db.prepare(`INSERT OR IGNORE INTO scan_ai_job_budgets
        (job_id,lane,scan_id,household_id,user_id,policy_fingerprint,policy_reference,max_calls,max_tokens,max_micro_usd)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (${CLAIM_SQL})`)
        .bind(policy.jobId, policy.lane, policy.scanId, policy.householdId, policy.userId, policy.fingerprint,
          policy.policyReference, policy.limits.maxCalls, policy.limits.maxTokens, policy.limits.maxMicroUsd, ...claimBindings(lease));
      const admission = db.prepare(`INSERT OR IGNORE INTO scan_ai_call_reservations
        (id,job_id,lane,call_key,descriptor_fingerprint,request_sha256,proof_fingerprint,provider_id,physical_model,
         task,kind,claim_token,claim_attempt,input_token_bound,output_token_bound,reserved_tokens,reserved_micro_usd)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM scan_ai_job_budgets b
        WHERE b.job_id=? AND b.lane=? AND b.policy_fingerprint=? AND b.scan_id=? AND b.household_id=? AND b.user_id=?
          AND EXISTS (${CLAIM_SQL})
          AND datetime(?)<=datetime('now') AND datetime(?)>datetime('now')
          AND (SELECT COUNT(*) FROM scan_ai_call_reservations r WHERE r.job_id=b.job_id AND r.lane=b.lane)<b.max_calls
          AND COALESCE((SELECT SUM(reserved_tokens) FROM scan_ai_call_reservations r WHERE r.job_id=b.job_id AND r.lane=b.lane),0)<=b.max_tokens-?
          AND COALESCE((SELECT SUM(reserved_micro_usd) FROM scan_ai_call_reservations r WHERE r.job_id=b.job_id AND r.lane=b.lane),0)<=b.max_micro_usd-?`)
        .bind(reservationId, policy.jobId, policy.lane, key, descriptor, proof.evidence.requestSha256, proof.fingerprint,
          proof.evidence.providerId, proof.evidence.physicalModel, proof.evidence.task, proof.evidence.kind,
          lease.claimToken, lease.claimAttempt, proof.evidence.input.tokenBound, proof.evidence.output.tokenBound, proof.tokens, proof.microUsd,
          policy.jobId, policy.lane, policy.fingerprint, policy.scanId, policy.householdId, policy.userId,
          ...claimBindings(lease), proof.evidence.pricing.validFrom, proof.evidence.pricing.validUntil, proof.tokens, proof.microUsd);
      const results = await db.batch([budgetInsert, admission]);
      if (results.some((result) => !result.success)) throw new Error('Scan AI budget batch unavailable');
      inserted = Number(results[1]?.meta.changes) === 1;
    } catch {
      responseUnknown = true;
    }
    const row = await read();
    if (row) {
      // A committed-but-unacknowledged reservation stays charged and cannot grant a second call.
      if (responseUnknown) return receipt(row, false, 'response_unknown');
      if (!await current()) return receipt(row, false, 'claim_lost_after_reserve');
      if (!evidenceCurrent(proof)) return denied('EVIDENCE_EXPIRED');
      return receipt(row, inserted, inserted ? 'acquired' : 'replay');
    }
    if (responseUnknown) return denied('DATABASE_UNAVAILABLE');
    if (!await current()) return denied('CLAIM_LOST');
    const storedPolicy = await db.prepare('SELECT policy_fingerprint FROM scan_ai_job_budgets WHERE job_id=? AND lane=?')
      .bind(policy.jobId, policy.lane).first<{ policy_fingerprint: string }>();
    if (!storedPolicy) return denied('DATABASE_UNAVAILABLE');
    if (storedPolicy.policy_fingerprint !== policy.fingerprint) return denied('POLICY_CONFLICT');
    if (!evidenceCurrent(proof)) return denied('EVIDENCE_EXPIRED');
    return denied('BUDGET_EXCEEDED');
  } catch {
    return denied('DATABASE_UNAVAILABLE');
  }
}
