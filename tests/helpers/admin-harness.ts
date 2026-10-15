import path from 'node:path';
import { fetchAdminWorker } from './admin-worker-fetch.mjs';
import { createCustomerReadFacade } from '../../src/worker/facade/customer-read-service';
import type { AdminEnv } from '../../src/worker/routes/admin/env';
import { buildAdminFixtureSql, FIXTURE_PASSWORD } from '../../scripts/admin-local-lib.mjs';
import { SqliteD1, applyMigrations } from './sqlite-d1';

export const LOCAL_ORIGIN = 'http://127.0.0.1:8790';
export const PROD_ORIGIN = 'https://admin.takosan.test';
export const CUSTOMER_URL = 'https://app.takosan.test';
export const ACCESS_TEAM = 'takosan.cloudflareaccess.com';
export const ACCESS_AUD = 'a'.repeat(32);
export const PASSWORD = FIXTURE_PASSWORD;
export const fx = (key: string) => `${key}@fixture.takosan.test`;

export interface Databases { main: SqliteD1; admin: SqliteD1 }

let fixture: { main: string; admin: string } | null = null;

/** Customer database (full ledger) + admin database (migrations-admin), optionally seeded with the fixture. */
export function createDatabases(options: { seed?: boolean; migrateAdmin?: boolean } = {}): Databases {
  fixture ??= buildAdminFixtureSql();
  const main = new SqliteD1();
  const admin = new SqliteD1({ migrate: false });
  if (options.migrateAdmin !== false) applyMigrations(admin, path.resolve(process.cwd(), 'migrations-admin'));
  if (options.seed !== false) {
    main.seed(fixture.main);
    if (options.migrateAdmin !== false) admin.seed(fixture.admin);
  }
  return { main, admin };
}

export function closeDatabases(dbs: Databases | undefined) {
  dbs?.main.close();
  dbs?.admin.close();
}

export function memoryKv() {
  const entries = new Map<string, string>();
  return {
    async get(key: string, type?: string) { const value = entries.get(key); return value === undefined ? null : type === 'json' ? JSON.parse(value) : value; },
    async put(key: string, value: string) { entries.set(key, value); },
    async delete(key: string) { entries.delete(key); },
  };
}

type LocalAuthGlobal = typeof globalThis & { __ADMIN_LOCAL_AUTH__?: boolean };
/** Simulates a bundle built with the local-only define (wrangler.admin-local.jsonc). */
export function setLocalAuthBuild(enabled: boolean) {
  if (enabled) (globalThis as LocalAuthGlobal).__ADMIN_LOCAL_AUTH__ = true;
  else delete (globalThis as LocalAuthGlobal).__ADMIN_LOCAL_AUTH__;
}

export function localEnv(dbs: Databases, overrides: Partial<AdminEnv> = {}): AdminEnv {
  return { CUSTOMER_READ: createCustomerReadFacade(dbs.main, { allowLocalPassword: true }), ADMIN_DB: dbs.admin, CACHE: memoryKv() as never, ENVIRONMENT: 'development', ADMIN_CONSOLE_ENABLED: 'true',
    ADMIN_AUTH_MODE: 'password', ADMIN_ORIGIN: LOCAL_ORIGIN, CUSTOMER_APP_URL: 'http://127.0.0.1:8787', ...overrides };
}

export function productionEnv(dbs: Databases, overrides: Partial<AdminEnv> = {}): AdminEnv {
  return { CUSTOMER_READ: createCustomerReadFacade(dbs.main), ADMIN_DB: dbs.admin, CACHE: memoryKv() as never, ENVIRONMENT: 'production', ADMIN_CONSOLE_ENABLED: 'true',
    ADMIN_AUTH_MODE: 'cloudflare_access', ADMIN_ORIGIN: PROD_ORIGIN, CUSTOMER_APP_URL: CUSTOMER_URL,
    ADMIN_ACCESS_TEAM_DOMAIN: ACCESS_TEAM, ADMIN_ACCESS_AUD: ACCESS_AUD, ...overrides };
}

export interface Session { cookie: string; token: string; csrf: string; sessionId: string }
export interface CallOptions {
  env: AdminEnv;
  method?: string;
  session?: Session | null;
  /** undefined → the session's token; null → omit. */
  csrf?: string | null;
  /** undefined → the admin origin for non-GET requests; null → omit. */
  origin?: string | null;
  headers?: Record<string, string>;
  body?: unknown;
  /** Request URL origin; defaults to ADMIN_ORIGIN. */
  base?: string;
  /** undefined → a rotating test IP; null → omit CF-Connecting-IP. */
  ip?: string | null;
}
export interface Result { status: number; json: any; text: string; headers: Headers }

let ipCounter = 0;
export async function call(pathname: string, options: CallOptions): Promise<Result> {
  const method = options.method ?? 'GET';
  const base = options.base ?? options.env.ADMIN_ORIGIN ?? LOCAL_ORIGIN;
  const headers = new Headers(options.headers);
  if (options.ip !== null) headers.set('CF-Connecting-IP', options.ip ?? `198.51.100.${((ipCounter += 1) % 250) + 1}`);
  const origin = options.origin === undefined ? (method === 'GET' ? undefined : base) : options.origin;
  if (origin) headers.set('Origin', origin);
  if (options.session) headers.append('Cookie', options.session.cookie);
  const csrf = options.csrf === undefined ? options.session?.csrf : options.csrf;
  if (csrf && method !== 'GET') headers.set('X-Admin-CSRF', csrf);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetchAdminWorker(new Request(`${base}${pathname}`, { method, headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) }), options.env);
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text, headers: response.headers };
}

export async function login(env: AdminEnv, email: string, password = PASSWORD, extra: Partial<CallOptions> = {}): Promise<Session> {
  const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email, password }, ...extra });
  if (result.status !== 200) throw new Error(`login ${email} failed: ${result.status} ${result.text}`);
  const cookies = result.headers.getSetCookie();
  const token = /__Host-takosan_admin_session=([0-9a-f]{64})/.exec(cookies.join('\n'))?.[1];
  if (!token) throw new Error('no session cookie');
  return { cookie: `__Host-takosan_admin_session=${token}`, token, csrf: result.json.csrfToken, sessionId: result.json.data.session.id };
}

export const count = (db: SqliteD1, query: string, ...binds: unknown[]) => db.query<{ n: number }>(query, ...binds)[0].n;

/** Synthetic enrollment only; runtime provisioning never calls this helper. */
export async function enrollFixtureOperators(dbs: Databases, keys = ['super', 'super2', 'ops', 'content', 'support', 'auditor']) {
  for (const key of keys) {
    const userId = `fx_admin_${key}`;
    await dbs.admin.prepare(`INSERT INTO approved_human_operators (operator_id,enrollment_record_ref,independent_approval_ref,enrolled_at)
      VALUES (?,?,?,'2026-10-15T00:00:00.000Z')`).bind(`operator_${key}`, `synthetic-human-${key}`, `synthetic-human-approval-${key}`).run();
    await dbs.admin.prepare(`INSERT INTO operator_identity_bindings (id,user_id,operator_id,access_iss,access_sub,enrollment_record_ref,independent_approval_ref,bound_at)
      VALUES (?,?,?,?,?,?,?,'2026-10-15T00:00:00.000Z')`).bind(`bind_fixture_${key}`, userId, `operator_${key}`, `https://${ACCESS_TEAM}`, `subject_${key}`, `synthetic-binding-${key}`, `synthetic-binding-approval-${key}`).run();
  }
}
