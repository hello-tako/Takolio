import {
  finishOtpVerification, readOtpDatabaseTime, recordOtpDelivery, reserveOtpRequest, otpTicketCanCompare,
  type OtpReservation, type OtpReservationInput, type OtpSuccessEffects, type OtpRegistrationEffects,
} from '../../../packages/db/src/auth-otp';
import type { D1DatabaseBinding } from '../../../packages/db/src';
import { createOtpRequestKey, parseOtpRequestKey, type OtpOperation, type OtpPurpose } from '../config/otp-policy';
import { SCAN_QUOTA_POLICY } from '../config/scan-quota-policy';
import { createOtpDigest, verifyOtpDigest, OTP_DIGEST_VERSION } from '../utils/otp-digest';
import { generateSalt, hashPassword } from '../utils/password';
import { generateSessionToken, hmacSha256Hex, sha256Hex } from '../utils/session';

interface RequestInput {
  email: string; purpose: OtpPurpose; operation: OtpOperation; requestKey?: string;
  semanticBody?: Readonly<Record<string, string | boolean | null>>;
}
export interface OtpIssueInput extends RequestInput {
  operation: 'issue_register' | 'issue_login' | 'issue_forgot'; code: string;
  registration?: { name: string; password: string };
}
export interface OtpVerifyInput extends RequestInput {
  operation: 'register_verify' | 'login_verify' | 'reset_preliminary' | 'reset_final';
  code: string; newPassword?: string;
}
interface OtpPrincipal { accountId: string | null; userId: string | null }
interface IssuanceReceipt extends OtpPrincipal {
  issuanceId: string; generation: number; serverEpochMillis: number; expiresAt: number;
}
export type StrictOtpResult =
  | { kind: 'malformed' | 'expired' | 'conflict' | 'unavailable'; serverEpochMillis?: number }
  | { kind: 'budget' | 'cooldown'; retryAfterSeconds: number; serverEpochMillis: number }
  | ({ kind: 'reserved' } & IssuanceReceipt)
  | ({ kind: 'issuance'; deliveryState: 'accepted' | 'rejected' | 'delivery_unknown'; replayed: true } & IssuanceReceipt)
  | { kind: 'in_progress'; serverEpochMillis: number; expiresAt?: number }
  | { kind: 'reissue_required' | 'delivery_not_ready'; serverEpochMillis: number }
  | { kind: 'invalid' | 'stale'; serverEpochMillis?: number }
  | { kind: 'stale'; serverEpochMillis: number; expiresAt: number }
  | ({ kind: 'proof'; proofExpiresAt: number; generation: number; issuanceId: string; replayed: boolean; serverEpochMillis: number } & OtpPrincipal)
  | ({ kind: 'completed'; replayed: boolean; sessionRequired: boolean; sessionToken?: string; serverEpochMillis: number } & OtpPrincipal);

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

/** Authorization and Origin checks belong to routes; every challenge comparison belongs here. */
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
    if (parsed.kind !== 'valid') return { kind: parsed.kind, serverEpochMillis: now * 1000 };
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
    const epoch = { serverEpochMillis: row.serverEpochMillis };
    const principal = { accountId: row.accountId, userId: row.userId };
    if (row.status === 'expired') return { kind: 'expired', ...epoch };
    if (row.kind === 'conflict') return { kind: 'conflict', ...epoch };
    if (row.status === 'budget' || row.status === 'cooldown') return {
      kind: row.status, retryAfterSeconds: row.retryAfterSeconds, ...epoch,
    };
    if (row.status === 'unavailable') {
      if (row.ticketId === null) return { kind: 'unavailable', ...epoch };
      if (row.legacyReissueRequired) return { kind: 'reissue_required', ...epoch };
      if (row.issuanceId === null) return { kind: 'invalid', ...epoch };
      if (!row.issuanceCurrent || !row.principalCurrent || row.expiresAt === null
        || row.expiresAt <= row.serverEpochMillis / 1000) return { kind: 'stale', ...epoch };
      return { kind: 'delivery_not_ready', ...epoch };
    }
    if (row.kind !== 'replay') return null;
    if (row.status === 'issued') {
      if (!row.issuanceCurrent || !row.principalCurrent || row.deliveryState === 'superseded' || row.expiresAt === null
        || row.expiresAt <= row.serverEpochMillis / 1000 || row.issuanceId === null) return row.expiresAt === null
          ? { kind: 'stale', ...epoch } : { kind: 'stale', ...epoch, expiresAt: row.expiresAt };
      if (row.deliveryState === 'accepted' || row.deliveryState === 'rejected' || row.deliveryState === 'delivery_unknown') return {
        kind: 'issuance', deliveryState: row.deliveryState, issuanceId: row.issuanceId,
        generation: row.generation, expiresAt: row.expiresAt, replayed: true, ...epoch, ...principal,
      };
      return { kind: 'in_progress', ...epoch, expiresAt: row.expiresAt };
    }
    if (row.status === 'pending') return { kind: 'in_progress', ...epoch };
    if (row.status === 'proof' && row.proofExpiresAt !== null && row.proofExpiresAt <= row.serverEpochMillis / 1000) return { kind: 'stale', ...epoch };
    if (row.status === 'proof' && row.proofExpiresAt !== null && row.issuanceId !== null) return {
      kind: 'proof', proofExpiresAt: row.proofExpiresAt, generation: row.generation,
      issuanceId: row.issuanceId, replayed: true, ...epoch, ...principal,
    };
    if (row.status === 'completed' && (!row.principalCurrent || row.accountId === null || row.userId === null)) return { kind: 'stale', ...epoch };
    if (row.status === 'completed') return { kind: 'completed', replayed: true, sessionRequired: sessionOperation, ...epoch, ...principal };
    return { kind: row.status === 'invalid' ? 'invalid' : 'stale', ...epoch };
  }

  async reserveIssuance(value: OtpIssueInput): Promise<StrictOtpResult> {
    try {
      const input = { ...value, semanticBody: value.semanticBody ? { ...value.semanticBody } : undefined,
        registration: value.registration ? { ...value.registration } : undefined };
      if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) || (input.registration && (
        input.operation !== 'issue_register' || typeof input.registration.name !== 'string'
        || input.registration.name.trim().length < 2 || input.registration.name.trim().length > 60
        || typeof input.registration.password !== 'string' || input.registration.password.length < 6 || input.registration.password.length > 100))) return { kind: 'malformed' };
      // Random challenge, principal IDs and password salt must not change a transport replay fingerprint.
      const prepared = await this.prepare(input, input.registration ? [input.registration.name.trim(), input.registration.password] : null);
      if ('kind' in prepared) return prepared;
      const expectedDigest = await createOtpDigest(prepared.email, prepared.purpose, input.code, this.secret);
      let registration: OtpRegistrationEffects | undefined;
      if (input.registration) {
        const passwordSalt = generateSalt();
        registration = { name: input.registration.name.trim(), passwordSalt,
          passwordHash: await hashPassword(input.registration.password, passwordSalt),
          userId: `usr_${crypto.randomUUID()}`, accountId: `account_${crypto.randomUUID()}`, freeScanLimit: SCAN_QUOTA_POLICY.free };
      }
      const row = await reserveOtpRequest(this.db, prepared, { expectedDigest, digestVersion: OTP_DIGEST_VERSION, registration });
      const replay = this.replay(row, false);
      if (replay) return replay;
      if (row.status !== 'issued' || row.issuanceId === null || row.expiresAt === null) return { kind: 'unavailable', serverEpochMillis: row.serverEpochMillis };
      return { kind: 'reserved', issuanceId: row.issuanceId, generation: row.generation,
        serverEpochMillis: row.serverEpochMillis, expiresAt: row.expiresAt, accountId: row.accountId, userId: row.userId };
    } catch { return { kind: 'unavailable' }; }
  }

  async recordDelivery(issuanceId: string, state: 'accepted' | 'rejected' | 'delivery_unknown'): Promise<boolean> {
    try { return await recordOtpDelivery(this.db, issuanceId, state, crypto.randomUUID()); }
    catch { return false; }
  }

  async verify(value: OtpVerifyInput): Promise<StrictOtpResult> {
    try {
      const input = { ...value, semanticBody: value.semanticBody ? { ...value.semanticBody } : undefined };
      if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) || (['register_verify', 'reset_final'].includes(input.operation)
        && (typeof input.newPassword !== 'string' || input.newPassword.length < 6 || input.newPassword.length > 100))) return { kind: 'malformed' };
      // Ownership changes need a separate reviewed transfer command; no OTP admission occurs here.
      if (input.operation === 'register_verify' && input.semanticBody?.migrateFromHouseholdId) return { kind: 'unavailable' };
      const prepared = await this.prepare(input, [input.code, input.newPassword ?? null]);
      if ('kind' in prepared) return prepared;
      const row = await reserveOtpRequest(this.db, prepared);
      const sessionOperation = input.operation === 'register_verify' || input.operation === 'reset_final';
      const replay = this.replay(row, sessionOperation);
      if (replay) return replay;
      if (!row.ticketId || !row.expectedDigest || row.digestVersion === null) return { kind: 'unavailable', serverEpochMillis: row.serverEpochMillis };
      if (!await otpTicketCanCompare(this.db, row.ticketId, row.ownerId, prepared.email)) {
        await finishOtpVerification(this.db, { ticketId: row.ticketId, ownerId: row.ownerId, commandId: crypto.randomUUID(), email: prepared.email, valid: false, effects: {} });
        return { kind: 'stale', serverEpochMillis: row.serverEpochMillis };
      }
      // Only the newly acknowledged ticket reaches this comparison boundary.
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
      if (valid && (input.operation === 'reset_final' || input.operation === 'register_verify')) {
        effects.passwordSalt = generateSalt();
        effects.passwordHash = await hashPassword(input.newPassword!, effects.passwordSalt);
      }
      const final = await finishOtpVerification(this.db, { ticketId: row.ticketId, ownerId: row.ownerId,
        commandId: crypto.randomUUID(), email: prepared.email, valid, effects });
      if (final.status === 'proof' && final.proofExpiresAt !== null && row.issuanceId !== null) return {
        kind: 'proof', proofExpiresAt: final.proofExpiresAt, generation: row.generation, issuanceId: row.issuanceId,
        replayed: false, serverEpochMillis: row.serverEpochMillis, accountId: row.accountId, userId: row.userId,
      };
      if (final.status !== 'completed') return { kind: final.status === 'invalid' ? 'invalid' : 'stale', serverEpochMillis: row.serverEpochMillis };
      return { kind: 'completed', replayed: false, sessionRequired: false, serverEpochMillis: row.serverEpochMillis,
        accountId: row.accountId, userId: row.userId, ...(sessionToken ? { sessionToken } : {}) };
    } catch { return { kind: 'unavailable' }; }
  }
}
