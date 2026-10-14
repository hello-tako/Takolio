// Admin Console local tooling: synthetic fixtures, two-person operator bootstrap
// SQL and the isolated Wrangler environment. Nothing here talks to Cloudflare or
// GitHub; callers apply SQL to in-memory SQLite or `wrangler --local` only.
import { mkdtempSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'];
export const FIXTURE_DATASET = 'synthetic-admin-v1';
export const FIXTURE_DOMAIN = 'fixture.takosan.test';
// Local fixture credential only. Fixture data is marked and the admin Worker
// refuses to serve a marked database outside development/test.
export const FIXTURE_PASSWORD = 'Local-Fixture-Only-2026!';

/** Matches src/worker/utils/password.ts (PBKDF2-SHA256, 100k, 32 bytes, UTF-8 salt). */
export function hashPassword(password, salt) {
  return pbkdf2Sync(password, Buffer.from(salt, 'utf8'), 100000, 32, 'sha256').toString('hex');
}

export function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number in fixture SQL');
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Fixed reference instant so fixture SQL is byte-for-byte deterministic. */
export const FIXTURE_NOW = Date.parse('2026-10-12T00:00:00.000Z');
function iso(daysAgo, hours = 0) {
  return new Date(FIXTURE_NOW - daysAgo * 86400000 + hours * 3600000).toISOString();
}
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXTURE_ADMINS = [
  { key: 'super', role: 'SUPER_ADMIN', name: 'Quản trị Tổng (fixture)' },
  { key: 'super2', role: 'SUPER_ADMIN', name: 'Quản trị Phụ (fixture)' },
  { key: 'ops', role: 'OPERATIONS_ADMIN', name: 'Vận hành (fixture)' },
  { key: 'content', role: 'CONTENT_EDITOR', name: 'Biên tập (fixture)' },
  { key: 'support', role: 'SUPPORT_AGENT', name: 'Hỗ trợ (fixture)' },
  { key: 'auditor', role: 'READ_ONLY_AUDITOR', name: 'Kiểm toán (fixture)' },
];

export function fixtureEmail(key) {
  return `${key}@${FIXTURE_DOMAIN}`;
}

function userRows(lines, { id, email, name, createdAt, isGuest = 0, password = FIXTURE_PASSWORD, verified = 1 }) {
  const salt = `fixture-salt-${id}`;
  lines.push(`INSERT INTO users (id, email, is_guest, created_at, updated_at) VALUES (${sql(id)}, ${sql(email)}, ${isGuest}, ${sql(createdAt)}, ${sql(createdAt)});`);
  if (!isGuest) {
    lines.push(`INSERT INTO auth_accounts (id, user_id, email, password_hash, salt, is_verified, created_at, updated_at) VALUES (${sql(`acct_${id}`)}, ${sql(id)}, ${sql(email)}, ${sql(hashPassword(password, salt))}, ${sql(salt)}, ${verified}, ${sql(createdAt)}, ${sql(createdAt)});`);
  }
  lines.push(`INSERT INTO profiles (id, user_id, display_name, created_at, updated_at) VALUES (${sql(`prof_${id}`)}, ${sql(id)}, ${sql(name)}, ${sql(createdAt)}, ${sql(createdAt)});`);
  const hh = `hh_${id}`;
  lines.push(`INSERT INTO households (id, name, created_by, created_at, updated_at) VALUES (${sql(hh)}, ${sql(`Bếp của ${name}`)}, ${sql(id)}, ${sql(createdAt)}, ${sql(createdAt)});`);
  lines.push(`INSERT INTO household_members (id, household_id, user_id, role, created_at) VALUES (${sql(`hm_${id}`)}, ${sql(hh)}, ${sql(id)}, 'owner', ${sql(createdAt)});`);
  return hh;
}

/**
 * Deterministic synthetic dataset. `main` targets the customer database
 * schema (migrations/), `admin` the admin database (migrations-admin/). All
 * identities use the reserved `.test` TLD.
 */
export function buildAdminFixtureSql() {
  const rand = prng(20261012);
  const main = ['-- Takosan Admin Console synthetic fixture: customer database part (local only).'];
  const admin = ['-- Takosan Admin Console synthetic fixture: admin database part (local only).'];
  admin.push(`INSERT INTO admin_config_metadata (key, value) VALUES ('fixture_dataset', ${sql(FIXTURE_DATASET)});`);

  for (const [index, entry] of FIXTURE_ADMINS.entries()) {
    userRows(main, { id: `fx_admin_${entry.key}`, email: fixtureEmail(entry.key), name: entry.name, createdAt: iso(120 - index) });
  }
  // Two-person operator bootstrap, then normal grants by the first SUPER_ADMIN.
  admin.push(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_at) VALUES
    ('fx_ara_super', 'fx_admin_super', 'SUPER_ADMIN', 'operator_bootstrap', ${sql(iso(119))}),
    ('fx_ara_super2', 'fx_admin_super2', 'SUPER_ADMIN', 'operator_bootstrap', ${sql(iso(119))});`);
  admin.push(`INSERT INTO admin_config_metadata (key, value) VALUES ('bootstrap_completed_at', ${sql(iso(119))});`);
  for (const entry of FIXTURE_ADMINS.filter((item) => item.role !== 'SUPER_ADMIN')) {
    admin.push(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by, granted_at) VALUES (${sql(`fx_ara_${entry.key}`)}, ${sql(`fx_admin_${entry.key}`)}, ${sql(entry.role)}, 'admin_grant', 'fx_admin_super', ${sql(iso(110))});`);
  }
  userRows(main, { id: 'fx_admin_revoked', email: fixtureEmail('revoked'), name: 'Quản trị đã thu hồi (fixture)', createdAt: iso(100) });
  admin.push(`INSERT INTO admin_role_assignments (id, user_id, role, status, grant_source, granted_by, granted_at, revoked_by, revoked_at, revoke_reason) VALUES ('fx_ara_revoked', 'fx_admin_revoked', 'OPERATIONS_ADMIN', 'revoked', 'admin_grant', 'fx_admin_super', ${sql(iso(100))}, 'fx_admin_super', ${sql(iso(30))}, 'fixture offboarding');`);
  // Household owner with a valid password and NO platform role.
  userRows(main, { id: 'fx_owner', email: fixtureEmail('owner'), name: 'Chủ hộ (fixture)', createdAt: iso(90) });

  const families = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
  const given = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khoa', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Trang', 'Vy'];
  const customers = [];
  for (let i = 1; i <= 48; i += 1) {
    const id = `fx_user_${String(i).padStart(3, '0')}`;
    const name = `${families[i % families.length]} ${given[(i * 7) % given.length]}`;
    const createdAt = iso(Math.floor(rand() * 88), Math.floor(rand() * 20));
    const hh = userRows(main, { id, email: `customer${String(i).padStart(3, '0')}@${FIXTURE_DOMAIN}`, name, createdAt, verified: i % 9 === 0 ? 0 : 1 });
    customers.push({ id, hh, createdAt });
    const lastSeen = iso(Math.floor(rand() * 40), Math.floor(rand() * 20));
    main.push(`INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at, last_seen_at, created_at) VALUES (${sql(`fx_sess_${i}`)}, ${sql(id)}, ${sql(hh)}, ${sql(hashPassword(`session-${i}`, 'fixture').slice(0, 64))}, ${sql(iso(-7))}, ${sql(lastSeen)}, ${sql(createdAt)});`);
    if (i % 4 === 0) {
      main.push(`INSERT INTO subscriptions (id, user_id, plan, status, max_scans_per_month, expires_at, created_at, updated_at) VALUES (${sql(`fx_sub_${i}`)}, ${sql(id)}, 'plus', 'active', 100, ${sql(iso(-30 - i))}, ${sql(createdAt)}, ${sql(createdAt)});`);
    }
    for (let s = 0; s < 1 + (i % 4); s += 1) {
      main.push(`INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, version) VALUES (${sql(`fx_inv_${i}_${s}`)}, ${sql(hh)}, 'TOMATO', 'Cà chua', ${1 + s}, 'piece', 'vegetable', 'fridge', 1);`);
    }
  }
  for (let g = 1; g <= 6; g += 1) {
    userRows(main, { id: `fx_guest_${g}`, email: null, name: `Khách ${g}`, createdAt: iso(g * 5), isGuest: 1 });
  }

  const statuses = ['paid', 'paid', 'paid', 'pending', 'failed', 'expired', 'paid', 'refunded'];
  for (let p = 1; p <= 40; p += 1) {
    const customer = customers[(p * 5) % customers.length];
    const plan = p % 3 === 0 ? 'annual' : 'monthly';
    const amount = plan === 'annual' ? 499000 : 59000;
    const status = statuses[p % statuses.length];
    const createdAt = iso(Math.floor(rand() * 85), Math.floor(rand() * 20));
    const expiresAt = status === 'pending' ? iso(-1) : new Date(Date.parse(createdAt) + 30 * 60000).toISOString();
    main.push(`INSERT INTO payment_intents (id, user_id, plan, amount_vnd, currency, order_code, description, status, expires_at, created_at, updated_at) VALUES (${sql(`fx_pay_${p}`)}, ${sql(customer.id)}, ${sql(plan)}, ${amount}, 'VND', ${sql(String(900000000 + p * 7919))}, ${sql(`TAKOSAN FX ${p}`)}, ${sql(status)}, ${sql(expiresAt)}, ${sql(createdAt)}, ${sql(createdAt)});`);
    if (p === 4 || p === 12) {
      main.push(`INSERT INTO payment_reconciliation_records (intent_id, reason, first_observed_at, last_observed_at) VALUES (${sql(`fx_pay_${p}`)}, ${sql(p === 4 ? 'provider_outcome_unknown' : 'attempt_deadline')}, ${sql(createdAt)}, ${sql(createdAt)});`);
    }
    if (status === 'pending') {
      main.push(`INSERT INTO checkout_admissions (user_id, request_key, intent_id, plan, state, attempt_id, deadline_at, created_at, updated_at) VALUES (${sql(customer.id)}, ${sql(`fixture-request-key-${String(p).padStart(4, '0')}`)}, ${sql(`fx_pay_${p}`)}, ${sql(plan)}, 'remote_uncertain', ${sql(`fx_attempt_${p}`)}, ${sql(iso(-1))}, ${sql(createdAt)}, ${sql(createdAt)});`);
    }
  }

  const tasks = [['scan_ocr', 'qwen', 'qwen-vl-ocr'], ['ingredient_parse', 'qwen', 'qwen3.7-flash'], ['meal_explanation', 'qwen', 'qwen3.7-flash'], ['receipt_ocr', 'qwen', 'qwen-vl-ocr']];
  for (let a = 1; a <= 120; a += 1) {
    const [task, provider, model] = tasks[a % tasks.length];
    const status = a % 13 === 0 ? 'error' : 'success';
    const input = 400 + Math.floor(rand() * 2400);
    const output = 80 + Math.floor(rand() * 600);
    main.push(`INSERT INTO ai_requests (id, user_id, task, provider, model, input_tokens, output_tokens, latency_ms, estimated_cost, status, created_at) VALUES (${sql(`fx_ai_${a}`)}, ${sql(customers[a % customers.length].id)}, ${sql(task)}, ${sql(provider)}, ${sql(model)}, ${input}, ${output}, ${300 + Math.floor(rand() * 4200)}, ${((input * 0.0000005) + (output * 0.000002)).toFixed(6)}, ${sql(status)}, ${sql(iso(Math.floor(rand() * 60), Math.floor(rand() * 20)))});`);
  }

  const scanStatuses = ['confirmed', 'ready', 'failed', 'confirmed', 'processing', 'confirmed'];
  for (let s = 1; s <= 36; s += 1) {
    const customer = customers[(s * 3) % customers.length];
    const status = scanStatuses[s % scanStatuses.length];
    const createdAt = iso(Math.floor(rand() * 60), Math.floor(rand() * 20));
    main.push(`INSERT INTO scans (id, user_id, household_id, status, scan_type, created_at, updated_at) VALUES (${sql(`fx_scan_${s}`)}, ${sql(customer.id)}, ${sql(customer.hh)}, ${sql(status)}, ${sql(s % 5 === 0 ? 'receipt' : 'fridge')}, ${sql(createdAt)}, ${sql(createdAt)});`);
    const jobStatus = status === 'failed' ? 'failed' : status === 'processing' ? 'processing' : 'ready';
    const attempts = jobStatus === 'failed' ? 3 : s % 4 === 0 ? 2 : 1;
    main.push(`INSERT INTO scan_queue_jobs (id, scan_id, household_id, user_id, status, attempts, max_attempts, idempotency_key, error_code, created_at, updated_at) VALUES (${sql(`fx_job_${s}`)}, ${sql(`fx_scan_${s}`)}, ${sql(customer.hh)}, ${sql(customer.id)}, ${sql(jobStatus)}, ${attempts}, 3, ${sql(`fx-idem-${s}`)}, ${jobStatus === 'failed' ? "'AI_PROVIDER_TIMEOUT'" : 'NULL'}, ${sql(createdAt)}, ${sql(createdAt)});`);
  }

  admin.push(`INSERT INTO admin_audit_events (id, occurred_at, actor_user_id, actor_roles, action, target_type, target_id, outcome, reason_code, metadata_json) VALUES
    ('fx_audit_1', ${sql(iso(119))}, NULL, '[]', 'admin.bootstrap.operator', 'user', 'fx_admin_super', 'success', NULL, '{"source":"fixture"}'),
    ('fx_audit_1b', ${sql(iso(119))}, NULL, '[]', 'admin.bootstrap.operator', 'user', 'fx_admin_super2', 'success', NULL, '{"source":"fixture"}'),
    ('fx_audit_2', ${sql(iso(110))}, 'fx_admin_super', '["SUPER_ADMIN"]', 'admin.role.grant', 'user', 'fx_admin_ops', 'success', NULL, '{"role":"OPERATIONS_ADMIN","source":"fixture"}'),
    ('fx_audit_3', ${sql(iso(30))}, 'fx_admin_super', '["SUPER_ADMIN"]', 'admin.role.revoke', 'user', 'fx_admin_revoked', 'success', NULL, '{"role":"OPERATIONS_ADMIN","source":"fixture"}'),
    ('fx_audit_4', ${sql(iso(2))}, NULL, '[]', 'admin.login', NULL, NULL, 'failure', 'invalid_credentials', '{"source":"fixture"}');`);
  return { main: `${main.join('\n')}\n`, admin: `${admin.join('\n')}\n` };
}

const EMAIL_RE = /^[^\s@'"\\]{1,64}@[^\s@'"\\]{1,190}\.[a-z0-9-]{2,24}$/i;
const USER_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

/** Environment guard shared by the CLIs and the in-memory preview. Fails closed. */
export function assertLocalProvisioningAllowed({ argv = [], env = process.env } = {}) {
  const forbidden = argv.filter((arg) => ['--remote', '--env', '--preview', '--production'].includes(arg.split('=')[0]));
  if (forbidden.length) throw new Error(`Refusing: ${forbidden.join(', ')} is not allowed; provisioning is local-only.`);
  if (!argv.includes('--local')) throw new Error('Refusing: pass --local explicitly; provisioning never targets remote D1.');
  const environment = env.ENVIRONMENT ?? env.TAKOSAN_ENVIRONMENT ?? 'development';
  if (environment !== 'development') throw new Error(`Refusing: ENVIRONMENT=${environment}; provisioning runs only in development.`);
  if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') throw new Error('Refusing: provisioning is disabled in CI.');
  if (env.CLOUDFLARE_API_TOKEN) throw new Error('Refusing: CLOUDFLARE_API_TOKEN is set; unset it so no remote credential is reachable.');
}

/**
 * Environment for child `wrangler --local` processes: no telemetry, no API
 * token, and a throwaway config home so a stored `wrangler login` OAuth token is
 * unreachable from local tooling.
 */
export function localWranglerEnv(base = process.env) {
  const configHome = mkdtempSync(path.join(tmpdir(), 'takosan-admin-wrangler-home-'));
  return { ...base, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '', XDG_CONFIG_HOME: configHome };
}

/** Customer-database lookup used to resolve bootstrap accounts (read-only). */
export function buildBootstrapAccountLookupSql(emails) {
  if (!Array.isArray(emails) || emails.length !== 2) throw new Error('Bootstrap requires exactly two --email values (two-person rule).');
  const normalized = emails.map((email) => {
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw new Error('A valid --email is required.');
    return email.trim().toLowerCase();
  });
  if (normalized[0] === normalized[1]) throw new Error('Bootstrap requires two different accounts.');
  return `SELECT a.user_id AS user_id, a.email AS email FROM auth_accounts a JOIN users u ON u.id = a.user_id
 WHERE a.email IN (${normalized.map(sql).join(', ')}) AND a.is_verified = 1 AND u.is_guest = 0 ORDER BY a.email`;
}

/**
 * One-time, two-person operator bootstrap for the admin database. Both
 * SUPER_ADMIN grants are inserted by one statement (both or neither), only when
 * the admin database has never had an assignment; a trigger then forbids any
 * later operator_bootstrap grant.
 */
export function buildBootstrapAdminSql({ userIds, assignmentIds }) {
  if (!Array.isArray(userIds) || userIds.length !== 2 || new Set(userIds).size !== 2 || !userIds.every((id) => USER_ID_RE.test(id))) {
    throw new Error('Bootstrap requires two distinct verified accounts.');
  }
  if (!Array.isArray(assignmentIds) || assignmentIds.length !== 2 || !assignmentIds.every((id) => /^ara_[0-9a-f]{16,48}$/.test(id))) {
    throw new Error('Invalid assignment ids.');
  }
  const guard = `NOT EXISTS (SELECT 1 FROM admin_role_assignments) AND NOT EXISTS (SELECT 1 FROM admin_config_metadata WHERE key = 'bootstrap_completed_at')`;
  const ids = assignmentIds.map(sql).join(', ');
  return `INSERT INTO admin_role_assignments (id, user_id, role, grant_source)
SELECT ${sql(assignmentIds[0])}, ${sql(userIds[0])}, 'SUPER_ADMIN', 'operator_bootstrap' WHERE ${guard}
UNION ALL
SELECT ${sql(assignmentIds[1])}, ${sql(userIds[1])}, 'SUPER_ADMIN', 'operator_bootstrap' WHERE ${guard};
INSERT INTO admin_config_metadata (key, value)
SELECT 'bootstrap_completed_at', strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE (SELECT COUNT(*) FROM admin_role_assignments WHERE id IN (${ids}) AND grant_source = 'operator_bootstrap') = 2;
INSERT INTO admin_audit_events (id, actor_user_id, actor_roles, action, target_type, target_id, outcome, metadata_json)
SELECT 'evt_' || substr(id, 5), NULL, '[]', 'admin.bootstrap.operator', 'user', user_id, 'success', '{"source":"cli"}'
  FROM admin_role_assignments WHERE id IN (${ids});
SELECT COUNT(*) AS granted FROM admin_role_assignments WHERE id IN (${ids});`;
}

/** Local-only test account creation (customer database, development only). */
export function buildLocalAccountSql({ email, password, name }) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw new Error('A valid --email is required.');
  if (typeof password !== 'string' || password.length < 12) throw new Error('--password must be at least 12 characters.');
  const normalized = email.trim().toLowerCase();
  const id = `local_${Buffer.from(normalized).toString('hex').slice(0, 24)}`;
  const lines = [];
  userRows(lines, { id, email: normalized, name: name || normalized.split('@')[0], createdAt: new Date().toISOString(), password });
  return lines.join('\n');
}
