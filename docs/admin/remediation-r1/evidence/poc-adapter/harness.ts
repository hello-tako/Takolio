// Adapter that runs the ORIGINAL 2026-10-12 review PoCs unchanged against the
// remediated admin Worker. Legacy config (APP_URL / ADMIN_HOSTNAME) is mapped to
// the new ADMIN_ORIGIN/CUSTOMER_APP_URL model; SQL is routed to the admin DB when
// it names an admin_* table, else to the customer DB.
import { beforeAll, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fetchAdminWorker } from '../../../tests/helpers/admin-worker-fetch.mjs';
import { buildAdminFixtureSql, FIXTURE_PASSWORD } from '../../../scripts/admin-local-lib.mjs';
import { SqliteD1, applyMigrations } from '../../../tests/helpers/sqlite-d1';

export const SECRET = 'admin-integration-test-secret-0123456789';
export const DEV_BASE = 'http://127.0.0.1:8790';
export const APP_BASE = 'https://app.takosan.test';
export const ADMIN_BASE = 'https://admin.takosan.test';
export const PASSWORD = FIXTURE_PASSWORD;
export const FX = (key: string) => `${key}@fixture.takosan.test`;

const ADMIN_SQL = /\badmin_[a-z_]+/i;
export class RoutedDb {
  constructor(readonly main: SqliteD1, readonly admin: SqliteD1) {}
  private pick(sql: string) { return ADMIN_SQL.test(sql) ? this.admin : this.main; }
  prepare(sql: string) { return this.pick(sql).prepare(sql); }
  async batch(statements: Array<{ db?: SqliteD1 }>) { return ((statements[0]?.db ?? this.admin) as SqliteD1).batch(statements as never); }
  async exec(sql: string) { return this.pick(sql).exec(sql); }
  // The write-capture table must exist in both databases; reads of it are merged.
  seed(sql: string) { if (/CREATE TABLE poc_write_log/.test(sql)) { this.main.seed(sql); this.admin.seed(sql); } else this.pick(sql).seed(sql); }
  query<T = Record<string, unknown>>(sql: string, ...values: unknown[]): T[] {
    if (/FROM poc_write_log/.test(sql)) {
      const merged = [...this.main.query<T>(sql, ...values), ...this.admin.query<T>(sql, ...values)];
      return [...new Map(merged.map((row) => [JSON.stringify(row), row])).values()];
    }
    return this.pick(sql).query<T>(sql, ...values);
  }
  close() { this.main.close(); this.admin.close(); }
}

let fixture: { main: string; admin: string } | null = null;
export function fixtureDb() {
  const state = { db: undefined as unknown as RoutedDb };
  beforeAll(() => { fixture = buildAdminFixtureSql(); (globalThis as Record<string, unknown>).__ADMIN_LOCAL_AUTH__ = true; });
  beforeEach(() => {
    const main = new SqliteD1();
    const admin = new SqliteD1({ migrate: false });
    applyMigrations(admin, path.resolve(process.cwd(), 'migrations-admin'));
    main.seed(fixture!.main);
    admin.seed(fixture!.admin);
    state.db = new RoutedDb(main, admin);
  });
  afterEach(() => { state.db.close(); });
  return state;
}

function kv() {
  const entries = new Map<string, string>();
  return {
    async get(key: string, type?: string) { const v = entries.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(key: string, value: string) { entries.set(key, value); },
    async delete(key: string) { entries.delete(key); },
  };
}

export function makeEnv(db: unknown, overrides: Record<string, string | undefined> = {}) {
  const environment = 'ENVIRONMENT' in overrides ? overrides.ENVIRONMENT : 'development';
  const adminOrigin = overrides.ADMIN_HOSTNAME ? `https://${overrides.ADMIN_HOSTNAME}` : (overrides.APP_URL ?? DEV_BASE);
  const customer = overrides.ADMIN_HOSTNAME ? (overrides.APP_URL ?? APP_BASE) : (environment === 'production' || environment === 'staging' ? APP_BASE : 'http://127.0.0.1:8787');
  const { APP_URL: _a, ADMIN_HOSTNAME: _h, ADMIN_PASSWORD_LOGIN_ENABLED: _p, JWT_SECRET: _j, ...rest } = overrides;
  return {
    DB: db, ADMIN_DB: db, CACHE: kv(), ENVIRONMENT: environment,
    // Legacy semantics enabled the console by default outside production; the new model needs an explicit flag.
    ADMIN_CONSOLE_ENABLED: environment === 'production' ? undefined : 'true',
    ADMIN_AUTH_MODE: 'password', ADMIN_ORIGIN: adminOrigin, CUSTOMER_APP_URL: customer, ...rest,
  } as never;
}

let ipCounter = 0;
export function nextIp(): string { ipCounter += 1; return `198.51.100.${(ipCounter % 250) + 1}`; }

export interface Res { status: number; json: any; text: string; headers: Headers }
export interface SendOptions { method?: string; headers?: Record<string, string>; body?: unknown; cf?: boolean }

export async function send(env: unknown, url: string, options: SendOptions = {}): Promise<Res> {
  const headers = new Headers();
  if (options.cf !== false) headers.set('CF-Connecting-IP', nextIp());
  for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetchAdminWorker(new Request(url, { method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) }), env as never);
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text, headers: response.headers };
}

export interface Session { cookie: string; csrf: string; id: string | null }

export async function login(env: unknown, email: string, base = DEV_BASE, origin = base): Promise<{ res: Res; session?: Session }> {
  const res = await send(env, `${base}/api/v1/admin/auth/login`, { method: 'POST', headers: { Origin: origin }, body: { email, password: PASSWORD } });
  const token = /__Host-takosan_admin_session=([0-9a-f]{64})/.exec(res.headers.getSetCookie().join('\n'))?.[1];
  const csrf = res.json?.csrfToken;
  if (!token || !csrf) return { res };
  return { res, session: { cookie: `__Host-takosan_admin_session=${token}`, csrf, id: res.json?.data?.session?.id ?? null } };
}

export function mutate(env: unknown, session: Session | undefined, method: string, path: string, body?: unknown, base = DEV_BASE, origin = base) {
  const headers: Record<string, string> = { Origin: origin };
  if (session) { headers.Cookie = session.cookie; headers['X-Admin-CSRF'] = session.csrf; }
  return send(env, `${base}${path}`, { method, headers, body });
}

export function read(env: unknown, session: Session | undefined, path: string, base = DEV_BASE) {
  return send(env, `${base}${path}`, { headers: session ? { Cookie: session.cookie } : {} });
}

export function rows<T = any>(db: { query: (sql: string, ...v: unknown[]) => T[] }, sql: string, ...values: unknown[]): T[] {
  return db.query(sql, ...values);
}
