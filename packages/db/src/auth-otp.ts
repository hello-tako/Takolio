import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from './index';

export type StrictOtpPurpose = 'register' | 'forgot_password' | 'login';
export type StrictOtpOperation = 'issue_register' | 'issue_login' | 'issue_forgot' | 'register_verify' | 'login_verify' | 'reset_preliminary' | 'reset_final';
export type OtpStatus = 'issued' | 'pending' | 'unavailable' | 'invalid' | 'stale' | 'budget' | 'cooldown' | 'expired' | 'proof' | 'completed';
export interface OtpReservationInput {
  accountHash: string; scopeHash: string; email: string; purpose: StrictOtpPurpose;
  operation: StrictOtpOperation; key: string; keyMillis: number; fingerprint: string;
  commandId: string; requestId: string; issuanceId: string; ticketId: string;
}
export interface OtpReservation {
  kind: 'new' | 'replay' | 'conflict'; status: OtpStatus; requestId: string;
  ticketId: string | null; issuanceId: string | null; generation: number; ownerId: string;
  retryAfterSeconds: number; serverEpochMillis: number; expiresAt: number | null;
  deliveryState: 'pending' | 'accepted' | 'rejected' | 'delivery_unknown' | 'superseded' | null;
  expectedDigest: string | null; digestVersion: number | null; accountId: string | null; userId: string | null;
  proofExpiresAt: number | null; issuanceCurrent: number; principalCurrent: number; legacyReissueRequired: number;
}
export interface OtpRegistrationEffects {
  name: string; passwordHash: string; passwordSalt: string; userId: string; accountId: string; freeScanLimit: number;
}
export interface OtpSuccessEffects {
  sessionId?: string; sessionHash?: string; householdId?: string; sessionExpiresAt?: number;
  passwordHash?: string; passwordSalt?: string;
}
export interface OtpFinalization {
  status: 'completed' | 'proof' | 'invalid' | 'stale'; proofExpiresAt: number | null;
}
export class OtpPersistenceError extends Error {
  constructor() { super('OTP_PERSISTENCE_UNAVAILABLE'); }
}

const HEX = /^[a-f0-9]{64}$/;
const purposes: Record<StrictOtpOperation, StrictOtpPurpose> = {
  issue_register: 'register', issue_login: 'login', issue_forgot: 'forgot_password',
  register_verify: 'register', login_verify: 'login', reset_preliminary: 'forgot_password', reset_final: 'forgot_password',
};
const KEY_VALID = 'c.now_sec * 1000 - ? BETWEEN -30000 AND 1800000';
const BUDGET = `(SELECT COALESCE(SUM(t.weight), 0) FROM auth_otp_tickets t
  WHERE t.scope_hash = s.scope_hash AND t.admitted_at > c.now_sec - 900 AND t.admitted_at <= c.now_sec)`;

function validate(input: OtpReservationInput): void {
  if (![input.accountHash, input.scopeHash, input.fingerprint].every((value) => HEX.test(value))
    || purposes[input.operation] !== input.purpose || input.email !== input.email.trim().toLowerCase()
    || !/^[1-9][0-9]{12}:[a-f0-9]{32}$/.test(input.key) || Number(input.key.slice(0, 13)) !== input.keyMillis
    || ![input.commandId, input.requestId, input.issuanceId, input.ticketId].every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)) {
    throw new OtpPersistenceError();
  }
}
async function batch(db: D1DatabaseBinding, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  try {
    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success)) throw new OtpPersistenceError();
    return results;
  } catch { throw new OtpPersistenceError(); }
}
function assertion(db: D1DatabaseBinding, commandId: string, guard: string, values: unknown[] = []): D1PreparedStatement {
  return db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
    SELECT c.id, changes() = 1 FROM auth_otp_claims c WHERE c.id = ? AND ${guard}`)
    .bind(commandId, ...values);
}
function cleanup(db: D1DatabaseBinding, commandId: string): D1PreparedStatement[] {
  return [db.prepare('DELETE FROM auth_otp_assertions WHERE command_id = ?').bind(commandId),
    db.prepare('DELETE FROM auth_otp_claims WHERE id = ?').bind(commandId)];
}
export async function readOtpDatabaseTime(db: D1DatabaseBinding): Promise<number> {
  try {
    const row = await db.prepare('SELECT unixepoch() AS now_sec').first<{ now_sec: number }>();
    if (!row || !Number.isSafeInteger(row.now_sec) || row.now_sec < 0) throw new OtpPersistenceError();
    return row.now_sec;
  } catch { throw new OtpPersistenceError(); }
}

/** Reserve authority and budget in one transaction; only its acknowledged winner owns comparison. */
export async function reserveOtpRequest(db: D1DatabaseBinding, input: OtpReservationInput,
  issuance?: { expectedDigest: string; digestVersion: number; registration?: OtpRegistrationEffects }): Promise<OtpReservation> {
  validate(input);
  const issuing = input.operation.startsWith('issue_');
  if (issuing !== Boolean(issuance) || (issuance && (!HEX.test(issuance.expectedDigest) || ![1, 2].includes(issuance.digestVersion)))) throw new OtpPersistenceError();
  const registration = issuance?.registration;
  if (registration && (input.operation !== 'issue_register' || typeof registration.name !== 'string'
    || registration.name.trim() !== registration.name || registration.name.length < 2 || registration.name.length > 60
    || !HEX.test(registration.passwordHash) || !/^[a-f0-9]{32}$/.test(registration.passwordSalt)
    || ![registration.userId, registration.accountId].every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)
    || !Number.isSafeInteger(registration.freeScanLimit) || registration.freeScanLimit < 1)) throw new OtpPersistenceError();
  const { commandId: cmd, accountHash: account, scopeHash: scope, requestId: request } = input;
  const own = `EXISTS (SELECT 1 FROM auth_otp_requests r WHERE r.id = ? AND r.owner_id = c.id AND r.status = '${issuing ? 'issued' : 'pending'}')`;
  const statements = [
    db.prepare("INSERT INTO auth_otp_claims(id, kind, now_sec) VALUES (?, 'reserve', unixepoch())").bind(cmd),
    // Lazy import happens only for a fresh valid key, never on a cross-purpose conflict/replay.
    db.prepare(`INSERT OR IGNORE INTO auth_otp_scopes
      (scope_hash, account_hash, purpose, initialized_at, legacy_weight, locked_until, cooldown_until)
      SELECT ?, ?, ?, c.now_sec,
        MIN(5, COALESCE((SELECT SUM(MIN(5, MAX(0, attempt_count))) FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ?), 0)),
        MAX(COALESCE((SELECT MAX(COALESCE(unixepoch(locked_until), 0)) FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ?), 0),
          CASE WHEN (SELECT COALESCE(SUM(MIN(5, MAX(0, attempt_count))), 0) FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ?) >= 5 THEN c.now_sec + 900 ELSE 0 END),
        COALESCE((SELECT MAX(COALESCE(unixepoch(created_at), 0) + 60) FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ?), 0)
      FROM auth_otp_claims c WHERE c.id = ? AND ${KEY_VALID}
        AND NOT EXISTS (SELECT 1 FROM auth_otp_requests r WHERE r.account_hash = ? AND r.request_key = ?)`)
      .bind(scope, account, input.purpose, input.email, input.purpose, input.email, input.purpose,
        input.email, input.purpose, input.email, input.purpose, cmd, input.keyMillis, account, input.key),
    db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
      SELECT c.id, EXISTS (SELECT 1 FROM auth_otp_scopes s WHERE s.scope_hash = ? AND s.account_hash = ? AND s.purpose = ?)
      FROM auth_otp_claims c WHERE c.id = ? AND ${KEY_VALID}
        AND NOT EXISTS (SELECT 1 FROM auth_otp_requests r WHERE r.account_hash = ? AND r.request_key = ?)`)
      .bind(scope, account, input.purpose, cmd, input.keyMillis, account, input.key),
    db.prepare(`INSERT OR IGNORE INTO auth_otp_tickets
      (id, scope_hash, request_id, issuance_id, generation, owner_id, operation, state, weight, admitted_at, deadline)
      SELECT s.scope_hash || ':legacy', s.scope_hash, NULL, NULL, 0, s.scope_hash, 'legacy_import', 'imported', s.legacy_weight, s.initialized_at, s.initialized_at
      FROM auth_otp_scopes s WHERE s.scope_hash = ? AND s.legacy_weight > 0`).bind(scope),
    db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
      SELECT c.id, EXISTS (SELECT 1 FROM auth_otp_tickets t WHERE t.id = s.scope_hash || ':legacy'
        AND t.scope_hash = s.scope_hash AND t.request_id IS NULL AND t.issuance_id IS NULL
        AND t.generation = 0 AND t.owner_id = s.scope_hash AND t.operation = 'legacy_import'
        AND t.state = 'imported' AND t.weight = s.legacy_weight
        AND t.admitted_at = s.initialized_at AND t.deadline = s.initialized_at)
      FROM auth_otp_claims c JOIN auth_otp_scopes s ON s.scope_hash = ?
      WHERE c.id = ? AND s.legacy_weight > 0`).bind(scope, cmd),
    // Legacy challenges have no provider acceptance proof. Preserve accounting before this cutover.
    db.prepare(`UPDATE auth_otps SET used = 1, used_at = datetime(cutover.now_sec, 'unixepoch')
      FROM auth_otp_claims cutover
      WHERE cutover.id = ? AND cutover.now_sec * 1000 - ? BETWEEN -30000 AND 1800000
        AND lower(trim(auth_otps.email)) = ? AND auth_otps.purpose = ? AND auth_otps.used = 0
        AND EXISTS (SELECT 1 FROM auth_otp_scopes WHERE scope_hash = ?)
        AND NOT EXISTS (SELECT 1 FROM auth_otp_requests WHERE account_hash = ? AND request_key = ?)`)
      .bind(cmd, input.keyMillis, input.email, input.purpose, scope, account, input.key),
    db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
      SELECT c.id, NOT EXISTS (SELECT 1 FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ? AND used = 0)
      FROM auth_otp_claims c WHERE c.id = ? AND ${KEY_VALID}
        AND EXISTS (SELECT 1 FROM auth_otp_scopes WHERE scope_hash = ?)
        AND NOT EXISTS (SELECT 1 FROM auth_otp_requests WHERE account_hash = ? AND request_key = ?)`)
      .bind(input.email, input.purpose, cmd, input.keyMillis, scope, account, input.key),
    db.prepare(`INSERT OR IGNORE INTO auth_otp_requests
      (id, account_hash, scope_hash, request_key, operation, purpose, fingerprint, generation, issuance_id, owner_id, status, created_at, retained_until)
      SELECT ?, ?, ?, ?, ?, ?, ?, COALESCE(s.generation, 0) + ${issuing ? '1' : '0'},
        ${issuing ? '?' : 's.current_issuance_id'}, c.id,
        CASE WHEN NOT (${KEY_VALID}) THEN 'expired'
          WHEN s.locked_until > c.now_sec OR ${BUDGET} >= 5 THEN 'budget'
          ${issuing ? "WHEN s.cooldown_until > c.now_sec THEN 'cooldown'" : ''}
          ${input.operation === 'issue_register' ? "WHEN EXISTS (SELECT 1 FROM auth_accounts a WHERE lower(trim(a.email)) = ? AND a.is_verified <> 0) THEN 'unavailable'" : ''}
          ELSE '${issuing ? 'issued' : 'pending'}' END,
        c.now_sec, c.now_sec + 86400
      FROM auth_otp_claims c LEFT JOIN auth_otp_scopes s ON s.scope_hash = ? WHERE c.id = ?`)
      .bind(request, account, scope, input.key, input.operation, input.purpose, input.fingerprint,
        ...(issuing ? [input.issuanceId] : []), input.keyMillis,
        ...(input.operation === 'issue_register' ? [input.email] : []), scope, cmd),
  ];
  if (issuance) {
    if (registration) {
      const create = `${own} AND NOT EXISTS (SELECT 1 FROM auth_accounts a WHERE lower(trim(a.email)) = ?)`;
      const household = `hh_${registration.userId}`;
      const generated = `${own} AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.email = ?)`;
      // Existing pending signups retain their original password/profile. Only the first admitted issue creates parents.
      statements.push(
        db.prepare(`INSERT INTO users(id, email, is_guest)
          SELECT ?, ?, 0 FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(registration.userId, input.email, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO profiles(id, user_id, display_name)
          SELECT ?, ?, ? FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(`prof_${registration.userId}`, registration.userId, registration.name, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO households(id, name, created_by)
          SELECT ?, ?, ? FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(household, `Tủ lạnh của ${registration.name}`, registration.userId, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO household_members(id, household_id, user_id, role)
          SELECT ?, ?, ?, 'owner' FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(`hm_${registration.userId}`, household, registration.userId, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO user_preferences(id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions)
          SELECT ?, ?, 2, 'medium', '["vietnamese"]', '[]' FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(`pref_${registration.userId}`, registration.userId, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO subscriptions(id, user_id, plan, status, scan_count_current_month, max_scans_per_month)
          SELECT ?, ?, 'free', 'active', 0, ? FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(`sub_${registration.userId}`, registration.userId, registration.freeScanLimit, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO shopping_lists(id, household_id, name)
          SELECT ?, ?, 'Danh sách mua sắm' FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(`list_${household}`, household, cmd, request, input.email),
        assertion(db, cmd, create, [request, input.email]),
        db.prepare(`INSERT INTO auth_accounts(id, user_id, email, password_hash, salt, is_verified)
          SELECT ?, ?, ?, ?, ?, 0 FROM auth_otp_claims c WHERE c.id = ? AND ${create}`)
          .bind(registration.accountId, registration.userId, input.email, registration.passwordHash, registration.passwordSalt,
            cmd, request, input.email),
        assertion(db, cmd, generated, [request, registration.userId, input.email]),
        db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
          SELECT c.id, EXISTS (SELECT 1 FROM auth_accounts a JOIN users u ON u.id = a.user_id
            JOIN profiles p ON p.user_id = u.id JOIN households h ON h.id = ? AND h.created_by = u.id
            JOIN household_members m ON m.household_id = h.id AND m.user_id = u.id AND m.role = 'owner'
            JOIN user_preferences pref ON pref.user_id = u.id JOIN subscriptions sub ON sub.user_id = u.id
            JOIN shopping_lists list ON list.household_id = h.id
            WHERE a.id = ? AND a.user_id = ? AND a.email = ? AND a.is_verified = 0
              AND a.password_hash = ? AND a.salt = ? AND p.display_name = ? AND u.is_guest = 0)
          FROM auth_otp_claims c WHERE c.id = ? AND ${generated}`)
          .bind(household, registration.accountId, registration.userId, input.email, registration.passwordHash,
            registration.passwordSalt, registration.name, cmd, request, registration.userId, input.email),
      );
    }
    statements.push(
      db.prepare(`UPDATE auth_otp_issuances SET state = 'superseded'
        WHERE id = (SELECT current_issuance_id FROM auth_otp_scopes WHERE scope_hash = ?)
        AND EXISTS (SELECT 1 FROM auth_otp_claims c WHERE c.id = ? AND ${own})`).bind(scope, cmd, request),
      db.prepare(`UPDATE auth_otp_scopes SET generation = generation + 1, current_issuance_id = ?, cooldown_until =
        (SELECT now_sec + 60 FROM auth_otp_claims WHERE id = ?)
        WHERE scope_hash = ? AND EXISTS (SELECT 1 FROM auth_otp_claims c WHERE c.id = ? AND ${own})`)
        .bind(input.issuanceId, cmd, scope, cmd, request),
      assertion(db, cmd, own, [request]),
      db.prepare(`INSERT INTO auth_otp_issuances
        (id, scope_hash, generation, request_id, state, expected_digest, digest_version, account_id, user_id, created_at, expires_at)
        SELECT ?, ?, r.generation, r.id, 'pending', ?, ?, a.id, a.user_id, c.now_sec, c.now_sec + 600
        FROM auth_otp_claims c JOIN auth_otp_requests r ON r.owner_id = c.id
        LEFT JOIN auth_accounts a ON lower(trim(a.email)) = ?
        WHERE c.id = ? AND r.id = ? AND r.status = 'issued'`)
        .bind(input.issuanceId, scope, issuance.expectedDigest, issuance.digestVersion, input.email, cmd, request),
      assertion(db, cmd, own, [request]),
    );
  } else {
    statements.push(
      db.prepare(`INSERT INTO auth_otp_tickets
        (id, scope_hash, request_id, issuance_id, generation, owner_id, operation, state, weight, admitted_at, deadline)
        SELECT ?, r.scope_hash, r.id, r.issuance_id, r.generation, r.owner_id, r.operation,
          CASE WHEN i.scope_hash = r.scope_hash AND i.generation = r.generation
            AND i.state = 'accepted' AND i.used = 0 AND i.expires_at > c.now_sec
            AND (i.account_id IS NULL OR EXISTS (SELECT 1 FROM auth_accounts a WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?))
          THEN 'admitted' ELSE 'unavailable' END, 1, c.now_sec,
          MAX(c.now_sec, MIN(c.now_sec + 30, COALESCE(i.expires_at, c.now_sec + 30)))
        FROM auth_otp_claims c JOIN auth_otp_requests r ON r.owner_id = c.id
        LEFT JOIN auth_otp_issuances i ON i.id = r.issuance_id
        WHERE c.id = ? AND r.id = ? AND r.status = 'pending'`).bind(input.ticketId, input.email, cmd, request),
      assertion(db, cmd, own, [request]),
      db.prepare(`UPDATE auth_otp_scopes AS s SET locked_until = MAX(locked_until,
        (SELECT now_sec + 900 FROM auth_otp_claims WHERE id = ?))
        WHERE scope_hash = ? AND EXISTS (SELECT 1 FROM auth_otp_claims c WHERE c.id = ? AND ${own} AND ${BUDGET} >= 5)`)
        .bind(cmd, scope, cmd, request),
      assertion(db, cmd, `${own} AND EXISTS (SELECT 1 FROM auth_otp_scopes s WHERE s.scope_hash = ? AND ${BUDGET} >= 5)`, [request, scope]),
      db.prepare(`UPDATE auth_otp_requests SET status = 'unavailable' WHERE id = ? AND owner_id = ? AND status = 'pending'
        AND EXISTS (SELECT 1 FROM auth_otp_tickets WHERE request_id = ? AND state = 'unavailable')`).bind(request, cmd, request),
      assertion(db, cmd, `EXISTS (SELECT 1 FROM auth_otp_tickets t WHERE t.request_id = ? AND t.owner_id = c.id AND t.state = 'unavailable')`, [request]),
    );
  }
  statements.push(
    db.prepare(`UPDATE auth_otp_tickets SET state = 'stale' WHERE state = 'admitted'
      AND deadline <= (SELECT now_sec FROM auth_otp_claims WHERE id = ?)
      AND request_id IN (SELECT id FROM auth_otp_requests WHERE account_hash = ? AND request_key = ? AND fingerprint = ? AND operation = ? AND purpose = ? AND scope_hash = ?)`)
      .bind(cmd, account, input.key, input.fingerprint, input.operation, input.purpose, scope),
    db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
      SELECT c.id, NOT EXISTS (SELECT 1 FROM auth_otp_tickets t JOIN auth_otp_requests r ON r.id = t.request_id
        WHERE r.account_hash = ? AND r.request_key = ? AND r.fingerprint = ? AND r.operation = ? AND r.purpose = ? AND r.scope_hash = ?
          AND t.state = 'admitted' AND t.deadline <= c.now_sec)
      FROM auth_otp_claims c WHERE c.id = ?`)
      .bind(account, input.key, input.fingerprint, input.operation, input.purpose, scope, cmd),
    db.prepare(`UPDATE auth_otp_requests SET status = 'stale' WHERE account_hash = ? AND request_key = ? AND fingerprint = ? AND operation = ? AND purpose = ? AND scope_hash = ? AND status = 'pending'
      AND EXISTS (SELECT 1 FROM auth_otp_tickets t WHERE t.request_id = auth_otp_requests.id AND t.state = 'stale')`)
      .bind(account, input.key, input.fingerprint, input.operation, input.purpose, scope),
    db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok)
      SELECT c.id, NOT EXISTS (SELECT 1 FROM auth_otp_requests r JOIN auth_otp_tickets t ON t.request_id = r.id
        WHERE r.account_hash = ? AND r.request_key = ? AND r.fingerprint = ? AND r.operation = ? AND r.purpose = ? AND r.scope_hash = ?
          AND r.status = 'pending' AND t.state = 'stale')
      FROM auth_otp_claims c WHERE c.id = ?`)
      .bind(account, input.key, input.fingerprint, input.operation, input.purpose, scope, cmd),
    db.prepare(`SELECT CASE WHEN r.fingerprint <> ? OR r.operation <> ? OR r.purpose <> ? OR r.scope_hash <> ? THEN 'conflict'
        WHEN r.owner_id = c.id THEN 'new' ELSE 'replay' END AS kind,
      CASE WHEN NOT (${KEY_VALID}) THEN 'expired'
        WHEN r.status = 'proof' AND NOT COALESCE((i.state = 'accepted' AND i.used = 0 AND i.expires_at > c.now_sec
          AND i.id = s.current_issuance_id AND i.generation = s.generation AND i.scope_hash = r.scope_hash
          AND (i.account_id IS NULL OR EXISTS (SELECT 1 FROM auth_accounts a WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?))), 0) THEN 'stale' ELSE r.status END AS status, r.id AS requestId, t.id AS ticketId, r.issuance_id AS issuanceId, r.generation, r.owner_id AS ownerId,
      CASE WHEN r.status = 'budget' THEN MAX(0, s.locked_until - c.now_sec)
        WHEN r.status = 'cooldown' THEN MAX(0, s.cooldown_until - c.now_sec) ELSE 0 END AS retryAfterSeconds,
      c.now_sec * 1000 AS serverEpochMillis, COALESCE(i.expires_at, CASE WHEN r.operation IN ('issue_register','issue_login','issue_forgot') THEN r.created_at + 600 END) AS expiresAt, i.state AS deliveryState,
      CASE WHEN r.owner_id = c.id AND t.state = 'admitted' THEN i.expected_digest END AS expectedDigest,
      CASE WHEN r.owner_id = c.id AND t.state = 'admitted' THEN i.digest_version END AS digestVersion,
      i.account_id AS accountId, i.user_id AS userId, r.proof_expires_at AS proofExpiresAt,
      COALESCE(i.id = s.current_issuance_id AND i.generation = s.generation AND i.scope_hash = r.scope_hash AND i.used = 0, 0) AS issuanceCurrent,
      (i.account_id IS NULL OR EXISTS (SELECT 1 FROM auth_accounts a JOIN users u ON u.id = a.user_id
        WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?)) AS principalCurrent,
      (r.issuance_id IS NULL AND EXISTS (SELECT 1 FROM auth_otps WHERE lower(trim(email)) = ? AND purpose = ?)) AS legacyReissueRequired
      FROM auth_otp_claims c JOIN auth_otp_requests r ON r.account_hash = ? AND r.request_key = ?
      LEFT JOIN auth_otp_scopes s ON s.scope_hash = r.scope_hash
      LEFT JOIN auth_otp_tickets t ON t.request_id = r.id
      LEFT JOIN auth_otp_issuances i ON i.id = r.issuance_id WHERE c.id = ?`)
      .bind(input.fingerprint, input.operation, input.purpose, scope, input.keyMillis, input.email, input.email, input.email, input.purpose, account, input.key, cmd),
    ...cleanup(db, cmd),
  );
  const results = await batch(db, statements);
  const row = results[results.length - 3].results[0] as OtpReservation | undefined;
  if (!row || !['new', 'replay', 'conflict'].includes(row.kind)) throw new OtpPersistenceError();
  return row;
}

/** An adapter completion can publish once, only while its generation is current. */
export async function recordOtpDelivery(db: D1DatabaseBinding, issuanceId: string,
  state: 'accepted' | 'rejected' | 'delivery_unknown', commandId: string): Promise<boolean> {
  if (!['accepted', 'rejected', 'delivery_unknown'].includes(state)) throw new OtpPersistenceError();
  const statements = [
    db.prepare(`INSERT INTO auth_otp_claims(id, kind, now_sec)
      SELECT ?, 'delivery', unixepoch() FROM auth_otp_issuances i JOIN auth_otp_scopes s ON s.current_issuance_id = i.id AND s.generation = i.generation
      WHERE i.id = ? AND i.state = 'pending' AND i.used = 0 AND i.expires_at > unixepoch()`).bind(commandId, issuanceId),
    db.prepare(`UPDATE auth_otp_issuances SET state = ? WHERE id = ? AND state = 'pending'
      AND EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ? AND kind = 'delivery')`).bind(state, issuanceId, commandId),
    assertion(db, commandId, "c.kind = 'delivery'"),
    db.prepare('SELECT EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ?) AS changed').bind(commandId),
    ...cleanup(db, commandId),
  ];
  const results = await batch(db, statements);
  return (results[3].results[0] as { changed: number }).changed === 1;
}

export async function finishOtpVerification(db: D1DatabaseBinding,
  input: { ticketId: string; ownerId: string; commandId: string; email: string; valid: boolean; effects: OtpSuccessEffects }): Promise<OtpFinalization> {
  if (typeof input.email !== 'string' || input.email !== input.email.trim().toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new OtpPersistenceError();
  const { ticketId: ticket, ownerId: owner, commandId: cmd } = input;
  const statements: D1PreparedStatement[] = [];
  const session = input.effects.sessionHash !== undefined;
  if (session && (!HEX.test(input.effects.sessionHash!) || !input.effects.sessionId || !input.effects.householdId
    || !Number.isSafeInteger(input.effects.sessionExpiresAt))) throw new OtpPersistenceError();
  if (input.effects.passwordHash !== undefined && (!HEX.test(input.effects.passwordHash) || !/^[a-f0-9]{32}$/.test(input.effects.passwordSalt ?? ''))) throw new OtpPersistenceError();
  const result = input.valid ? 'completed' : 'invalid';
  // A valid digest alone never authorizes a principal: pin account identity, delivery and membership here.
  statements.push(db.prepare(`INSERT INTO auth_otp_claims(id, kind, now_sec)
    SELECT ?, 'finalize', unixepoch() FROM auth_otp_tickets t
      JOIN auth_otp_requests r ON r.id = t.request_id
      JOIN auth_otp_scopes s ON s.scope_hash = t.scope_hash
      JOIN auth_otp_issuances i ON i.id = t.issuance_id
    WHERE t.id = ? AND t.owner_id = ? AND t.state = 'admitted'
      AND t.deadline > unixepoch() AND i.expires_at > unixepoch() AND i.used = 0 AND i.state = 'accepted'
      AND s.current_issuance_id = i.id AND s.generation = t.generation AND i.generation = t.generation
      AND i.scope_hash = t.scope_hash AND r.scope_hash = t.scope_hash AND r.operation = t.operation
      AND r.owner_id = t.owner_id AND r.status = 'pending'
      AND (i.account_id IS NULL OR EXISTS (SELECT 1 FROM auth_accounts a WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?))
      ${input.valid ? `
      AND s.current_issuance_id = i.id AND s.generation = t.generation AND i.generation = t.generation
      AND EXISTS (SELECT 1 FROM auth_accounts a JOIN users u ON u.id = a.user_id
        WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?
          AND (r.operation <> 'register_verify' OR a.is_verified = 0))
      AND CASE WHEN r.operation IN ('register_verify','reset_final') THEN ? ELSE NOT ? END
      AND (r.operation NOT IN ('register_verify','reset_final') OR ?)
      AND (r.operation NOT IN ('register_verify','reset_final') OR EXISTS
        (SELECT 1 FROM household_members m WHERE m.user_id = i.user_id AND m.household_id = ?))` : ''}`)
    .bind(cmd, ticket, owner, input.email, ...(input.valid ? [input.email, session ? 1 : 0, session ? 1 : 0,
      input.effects.passwordHash !== undefined ? 1 : 0, input.effects.householdId ?? null] : [])));
  const claim = `EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ? AND kind = 'finalize')`;
  const ticketJoin = `SELECT t.id FROM auth_otp_tickets t JOIN auth_otp_requests r ON r.id = t.request_id WHERE t.id = ? AND r.operation`;
  if (input.valid) {
    statements.push(
      // Strict challenges live in their receipt; legacy challenges remain unchanged in dormant A1.
      db.prepare(`UPDATE auth_otp_issuances SET used = 1 WHERE id = (SELECT issuance_id FROM auth_otp_tickets WHERE id = ?)
        AND used = 0 AND ${claim} AND EXISTS (${ticketJoin} <> 'reset_preliminary')`).bind(ticket, cmd, ticket),
      assertion(db, cmd, `EXISTS (${ticketJoin} <> 'reset_preliminary')`, [ticket]),
      db.prepare(`UPDATE auth_accounts SET is_verified = 1 WHERE id = (SELECT i.account_id FROM auth_otp_issuances i
        JOIN auth_otp_tickets t ON t.issuance_id = i.id WHERE t.id = ?) AND ${claim}
        AND EXISTS (${ticketJoin} IN ('register_verify','reset_final'))`).bind(ticket, cmd, ticket),
      assertion(db, cmd, `EXISTS (${ticketJoin} IN ('register_verify','reset_final'))`, [ticket]),
      db.prepare(`UPDATE auth_accounts SET password_hash = ?, salt = ?, updated_at = datetime((SELECT now_sec FROM auth_otp_claims WHERE id = ?), 'unixepoch')
        WHERE id = (SELECT i.account_id FROM auth_otp_issuances i JOIN auth_otp_tickets t ON t.issuance_id = i.id WHERE t.id = ?)
        AND ${claim} AND EXISTS (${ticketJoin} IN ('register_verify','reset_final'))`).bind(input.effects.passwordHash ?? null, input.effects.passwordSalt ?? null, cmd, ticket, cmd, ticket),
      assertion(db, cmd, `EXISTS (${ticketJoin} IN ('register_verify','reset_final'))`, [ticket]),
      db.prepare(`UPDATE sessions_v2 SET revoked_at = datetime((SELECT now_sec FROM auth_otp_claims WHERE id = ?), 'unixepoch')
        WHERE user_id = (SELECT i.user_id FROM auth_otp_issuances i JOIN auth_otp_tickets t ON t.issuance_id = i.id WHERE t.id = ?)
        AND revoked_at IS NULL AND ${claim} AND EXISTS (${ticketJoin} = 'reset_final')`).bind(cmd, ticket, cmd, ticket),
      db.prepare(`INSERT INTO auth_otp_assertions(command_id, ok) SELECT c.id,
        NOT EXISTS (SELECT 1 FROM sessions_v2 WHERE user_id = (SELECT i.user_id FROM auth_otp_issuances i
          JOIN auth_otp_tickets t ON t.issuance_id = i.id WHERE t.id = ?) AND revoked_at IS NULL)
        FROM auth_otp_claims c WHERE c.id = ? AND EXISTS (${ticketJoin} = 'reset_final')`).bind(ticket, cmd, ticket),
      db.prepare(`INSERT INTO sessions_v2(id, user_id, household_id, token_hash, expires_at)
        SELECT ?, i.user_id, ?, ?, datetime(?, 'unixepoch') FROM auth_otp_claims c
        JOIN auth_otp_tickets t ON t.id = ? JOIN auth_otp_requests r ON r.id = t.request_id
        JOIN auth_otp_issuances i ON i.id = t.issuance_id
        WHERE c.id = ? AND r.operation IN ('register_verify','reset_final') AND ? > c.now_sec`)
        .bind(input.effects.sessionId ?? null, input.effects.householdId ?? null, input.effects.sessionHash ?? null,
          input.effects.sessionExpiresAt ?? null, ticket, cmd, input.effects.sessionExpiresAt ?? 0),
      assertion(db, cmd, `EXISTS (${ticketJoin} IN ('register_verify','reset_final'))`, [ticket]),
    );
  }
  statements.push(
    db.prepare(`UPDATE auth_otp_tickets SET state = CASE WHEN operation = 'reset_preliminary' AND ? THEN 'proof' ELSE ? END,
      proof_expires_at = CASE WHEN operation = 'reset_preliminary' AND ? THEN (SELECT now_sec + 900 FROM auth_otp_claims WHERE id = ?) END
      WHERE id = ? AND owner_id = ? AND state = 'admitted' AND ${claim}`).bind(input.valid ? 1 : 0, result, input.valid ? 1 : 0, cmd, ticket, owner, cmd),
    assertion(db, cmd, "c.kind = 'finalize'"),
    db.prepare(`UPDATE auth_otp_requests SET status = (SELECT state FROM auth_otp_tickets WHERE id = ?),
      proof_expires_at = (SELECT proof_expires_at FROM auth_otp_tickets WHERE id = ?)
      WHERE id = (SELECT request_id FROM auth_otp_tickets WHERE id = ?) AND ${claim}`).bind(ticket, ticket, ticket, cmd),
    assertion(db, cmd, "c.kind = 'finalize'"),
    db.prepare(`INSERT INTO auth_otp_claims(id, kind, now_sec)
      SELECT ?, 'reserve', unixepoch() FROM auth_otp_tickets WHERE id = ? AND owner_id = ? AND state = 'admitted'
        AND NOT EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ?)`).bind(cmd, ticket, owner, cmd),
    db.prepare(`UPDATE auth_otp_tickets SET state = 'stale' WHERE id = ? AND owner_id = ? AND state = 'admitted'
      AND EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ? AND kind = 'reserve')`).bind(ticket, owner, cmd),
    assertion(db, cmd, "c.kind = 'reserve'"),
    db.prepare(`UPDATE auth_otp_requests SET status = 'stale' WHERE id = (SELECT request_id FROM auth_otp_tickets WHERE id = ? AND state = 'stale')
      AND EXISTS (SELECT 1 FROM auth_otp_claims WHERE id = ? AND kind = 'reserve')`).bind(ticket, cmd),
    assertion(db, cmd, "c.kind = 'reserve'"),
    db.prepare('SELECT state AS status, proof_expires_at AS proofExpiresAt FROM auth_otp_tickets WHERE id = ? AND owner_id = ?').bind(ticket, owner),
    ...cleanup(db, cmd),
  );
  const results = await batch(db, statements);
  const row = results[results.length - 3].results[0] as OtpFinalization | undefined;
  if (!row || !['completed', 'proof', 'invalid', 'stale'].includes(row.status)) throw new OtpPersistenceError();
  return row;
}

export async function otpTicketCanCompare(db: D1DatabaseBinding, ticketId: string, ownerId: string, email: string): Promise<boolean> {
  try {
    const row = await db.prepare(`SELECT EXISTS (SELECT 1 FROM auth_otp_tickets t
      JOIN auth_otp_requests r ON r.id = t.request_id
      JOIN auth_otp_issuances i ON i.id = t.issuance_id
      JOIN auth_otp_scopes s ON s.scope_hash = t.scope_hash
      WHERE t.id = ? AND t.owner_id = ? AND r.owner_id = t.owner_id AND r.status = 'pending'
        AND t.state = 'admitted' AND t.deadline > unixepoch() AND i.expires_at > unixepoch()
        AND i.used = 0 AND i.state = 'accepted' AND i.scope_hash = t.scope_hash
        AND s.current_issuance_id = i.id AND s.generation = t.generation AND i.generation = t.generation
        AND (i.account_id IS NULL OR EXISTS (SELECT 1 FROM auth_accounts a WHERE a.id = i.account_id AND a.user_id = i.user_id AND lower(trim(a.email)) = ?))) AS eligible`)
      .bind(ticketId, ownerId, email).first<{ eligible: number }>();
    if (!row) throw new OtpPersistenceError();
    return row.eligible === 1;
  } catch { throw new OtpPersistenceError(); }
}
