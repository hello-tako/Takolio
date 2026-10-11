import {
  finishOtpVerification, readOtpDatabaseTime, recordOtpDelivery, reserveOtpRequest, otpTicketCanCompare,
  type OtpReservation, type OtpReservationInput, type OtpSuccessEffects,
} from '../../../packages/db/src/auth-otp';
import type { D1DatabaseBinding } from '../../../packages/db/src';
import { createOtpRequestKey, parseOtpRequestKey, type OtpOperation, type OtpPurpose } from '../config/otp-policy';
import { createOtpDigest, verifyOtpDigest, OTP_DIGEST_VERSION } from '../utils/otp-digest';
import { generateSalt, hashPassword } from '../utils/password';
import { generateSessionToken, hmacSha256Hex, sha256Hex } from '../utils/session';

interface RequestInput {
  email: string; purpose: OtpPurpose; operation: OtpOperation; requestKey?: string;
  semanticBody?: Readonly<Record<string, string | boolean | null>>;
}
export interface OtpIssueInput extends RequestInput {
  operation: 'issue_register' | 'issue_login' | 'issue_forgot'; code: string;
}
export interface OtpVerifyInput extends RequestInput {
  operation: 'register_verify' | 'login_verify' | 'reset_preliminary' | 'reset_final';
  code: string; newPassword?: string;
}
export type StrictOtpResult =
  | { kind: 'malformed' | 'expired' | 'conflict' | 'unavailable' }
  | { kind: 'budget' | 'cooldown'; retryAfterSeconds: number; serverEpochMillis: number }
  | { kind: 'reserved'; issuanceId: string; generation: number; serverEpochMillis: number; expiresAt: number }
  | { kind: 'in_progress'; serverEpochMillis: number }
  | { kind: 'invalid' | 'stale' }
  | { kind: 'proof'; proofExpiresAt: number; generation: number; issuanceId: string; replayed: boolean }
  | { kind: 'completed'; replayed: boolean; sessionRequired: boolean; sessionToken?: string };

const purposeByOperation: Record<OtpOperation, OtpPurpose> = {
  issue_register: 'register', issue_login: 'login', issue_forgot: 'forgot_password',
  register_verify: 'register', login_verify: 'login', reset_preliminary: 'forgot_password', reset_final: 'forgot_password',
};
function canonicalBody(input: RequestInput): string {
  const body = input.semanticBody ?? {};
  const entries = Object.entries(body).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (entries.length > 16 || entries.some(([key, value]) => key.length > 64 || key === 'turnstileToken'
    || !(value === null || typeof value === 'boolean' || (typeof value === 'string' && value.length <= 2048)))) throw new Error('OTP_INPUT');
  return JSON.stringify(entries);
}

/** Dormant kernel: routes must validate request authorization before future integration. */
export class StrictOtpCoordinator {
  constructor(private readonly db: D1DatabaseBinding, private readonly secret: string) {}

  private async prepare(input: RequestInput, material: unknown): Promise<OtpReservationInput | StrictOtpResult> {
    if (!this.secret || typeof input.email !== 'string' || input.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || purposeByOperation[input.operation] !== input.purpose) {
      return { kind: 'unavailable' };
    }
    const email = input.email.trim().toLowerCase();
    const now = await readOtpDatabaseTime(this.db);
    const key = input.requestKey === undefined ? createOtpRequestKey(now * 1000) : input.requestKey;
    const parsed = parseOtpRequestKey(key, now);
    if (parsed.kind !== 'valid') return { kind: parsed.kind };
    const [accountHash, scopeHash, fingerprint] = await Promise.all([
      hmacSha256Hex(JSON.stringify(['strict-otp-account-v1', email]), this.secret),
      hmacSha256Hex(JSON.stringify(['strict-otp-scope-v1', email, input.purpose]), this.secret),
      hmacSha256Hex(JSON.stringify(['strict-otp-request-v1', email, input.purpose, input.operation, canonicalBody(input), material]), this.secret),
    ]);
    return { accountHash, scopeHash, fingerprint, email, purpose: input.purpose, operation: input.operation,
      key, keyMillis: parsed.issuedAtMs, commandId: crypto.randomUUID(), requestId: crypto.randomUUID(),
      issuanceId: crypto.randomUUID(), ticketId: crypto.randomUUID() };
  }

  private replay(row: OtpReservation, sessionOperation: boolean): StrictOtpResult | null {
    if (row.status === 'expired') return { kind: 'expired' };
    if (row.kind === 'conflict') return { kind: 'conflict' };
    if (row.status === 'budget' || row.status === 'cooldown') return {
      kind: row.status, retryAfterSeconds: row.retryAfterSeconds, serverEpochMillis: row.serverEpochMillis,
    };
    if (row.status === 'unavailable') return { kind: 'unavailable' };
    if (row.kind !== 'replay') return null;
    if (row.status === 'issued' || row.status === 'pending') return { kind: 'in_progress', serverEpochMillis: row.serverEpochMillis };
    if (row.status === 'proof' && row.proofExpiresAt !== null && row.proofExpiresAt <= row.serverEpochMillis / 1000) return { kind: 'stale' };
    if (row.status === 'proof' && row.proofExpiresAt !== null && row.issuanceId !== null) return {
      kind: 'proof', proofExpiresAt: row.proofExpiresAt, generation: row.generation, issuanceId: row.issuanceId, replayed: true,
    };
    if (row.status === 'completed') return { kind: 'completed', replayed: true, sessionRequired: sessionOperation };
    return { kind: row.status === 'invalid' ? 'invalid' : 'stale' };
  }

  async reserveIssuance(value: OtpIssueInput): Promise<StrictOtpResult> {
    try {
      const input = { ...value, semanticBody: value.semanticBody ? { ...value.semanticBody } : undefined };
      if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) return { kind: 'malformed' };
      // Server-generated challenge material must not change a transport replay fingerprint.
      const prepared = await this.prepare(input, null);
      if ('kind' in prepared) return prepared;
      const expectedDigest = await createOtpDigest(prepared.email, prepared.purpose, input.code, this.secret);
      const row = await reserveOtpRequest(this.db, prepared, { expectedDigest, digestVersion: OTP_DIGEST_VERSION });
      const replay = this.replay(row, false);
      if (replay) return replay;
      if (row.status !== 'issued' || row.issuanceId === null || row.expiresAt === null) return { kind: 'unavailable' };
      return { kind: 'reserved', issuanceId: row.issuanceId, generation: row.generation,
        serverEpochMillis: row.serverEpochMillis, expiresAt: row.expiresAt };
    } catch { return { kind: 'unavailable' }; }
  }

  async recordDelivery(issuanceId: string, state: 'accepted' | 'rejected' | 'delivery_unknown'): Promise<boolean> {
    try { return await recordOtpDelivery(this.db, issuanceId, state, crypto.randomUUID()); }
    catch { return false; }
  }

  async verify(value: OtpVerifyInput): Promise<StrictOtpResult> {
    try {
      const input = { ...value, semanticBody: value.semanticBody ? { ...value.semanticBody } : undefined };
      if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) || (input.operation === 'reset_final'
        && (typeof input.newPassword !== 'string' || input.newPassword.length < 8 || input.newPassword.length > 128))) return { kind: 'malformed' };
      // A1 cannot transfer guest data; the guarded transfer belongs to route integration.
      if (input.operation === 'register_verify' && input.semanticBody?.migrateFromHouseholdId) return { kind: 'unavailable' };
      const prepared = await this.prepare(input, [input.code, input.newPassword ?? null]);
      if ('kind' in prepared) return prepared;
      const row = await reserveOtpRequest(this.db, prepared);
      const sessionOperation = input.operation === 'register_verify' || input.operation === 'reset_final';
      const replay = this.replay(row, sessionOperation);
      if (replay) return replay;
      if (!row.ticketId || !row.expectedDigest || row.digestVersion === null) return { kind: 'unavailable' };
      if (!await otpTicketCanCompare(this.db, row.ticketId, row.ownerId)) {
        await finishOtpVerification(this.db, { ticketId: row.ticketId, ownerId: row.ownerId, commandId: crypto.randomUUID(), valid: false, effects: {} });
        return { kind: 'stale' };
      }
      // This is the sole comparison boundary; only the newly acknowledged ticket reaches it.
      const compared = await verifyOtpDigest(prepared.email, prepared.purpose, input.code, row.expectedDigest, row.digestVersion, this.secret);
      const valid = compared && row.accountId !== null && row.userId !== null;
      const effects: OtpSuccessEffects = {};
      let sessionToken: string | undefined;
      if (valid && sessionOperation) {
        sessionToken = generateSessionToken();
        effects.sessionId = crypto.randomUUID();
        effects.sessionHash = await sha256Hex(sessionToken);
        effects.householdId = `hh_${row.userId}`;
        effects.sessionExpiresAt = Math.floor(row.serverEpochMillis / 1000) + 7 * 86400;
      }
      if (valid && input.operation === 'reset_final') {
        effects.passwordSalt = generateSalt();
        effects.passwordHash = await hashPassword(input.newPassword!, effects.passwordSalt);
      }
      const final = await finishOtpVerification(this.db, { ticketId: row.ticketId, ownerId: row.ownerId,
        commandId: crypto.randomUUID(), valid, effects });
      if (final.status === 'proof' && final.proofExpiresAt !== null && row.issuanceId !== null) return {
        kind: 'proof', proofExpiresAt: final.proofExpiresAt, generation: row.generation, issuanceId: row.issuanceId, replayed: false,
      };
      if (final.status !== 'completed') return { kind: final.status === 'invalid' ? 'invalid' : 'stale' };
      return { kind: 'completed', replayed: false, sessionRequired: false, ...(sessionToken ? { sessionToken } : {}) };
    } catch { return { kind: 'unavailable' }; }
  }
}
