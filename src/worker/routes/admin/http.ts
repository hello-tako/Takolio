import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../../types';
import type { AdminAuthMode, AdminDataContext, AdminErrorCode, AdminPermission, AdminRole } from '../../../shared/admin';

export interface AdminPrincipal {
  userId: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  sessionId: string;
  csrfHash: string;
  authMethod: 'password' | 'cloudflare_access';
  createdAt: string;
  expiresAt: string;
  idleExpiresAt: string;
  email: string | null;
  displayName: string | null;
}

// `admin` is deliberately distinct from the customer `auth` variable.
export type AdminVariables = { admin: AdminPrincipal; requestId: string; adminMode: AdminAuthMode };
export type AdminApp = { Bindings: Env; Variables: AdminVariables };
export type AdminContext = Context<AdminApp>;
export type AdminMiddleware = MiddlewareHandler<AdminApp>;

export class AdminHttpError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503, readonly code: AdminErrorCode, message: string) {
    super(message);
  }
}

const MESSAGES: Partial<Record<AdminErrorCode, string>> = {
  ADMIN_UNAUTHENTICATED: 'Vui lòng đăng nhập quản trị.',
  ADMIN_SESSION_EXPIRED: 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.',
  ADMIN_SESSION_REVOKED: 'Phiên quản trị đã bị thu hồi.',
  ADMIN_FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  ADMIN_CSRF_FAILED: 'Yêu cầu bị chặn do không xác minh được nguồn gốc.',
  ADMIN_INVALID_CREDENTIALS: 'Thông tin đăng nhập không hợp lệ hoặc tài khoản không có quyền quản trị.',
  ADMIN_AUTH_NOT_CONFIGURED: 'Xác thực quản trị chưa được cấu hình cho môi trường này.',
  ADMIN_ACCESS_DENIED: 'Không xác minh được danh tính Cloudflare Access.',
  ADMIN_VALIDATION_FAILED: 'Tham số yêu cầu không hợp lệ.',
  ADMIN_NOT_FOUND: 'Không tìm thấy.',
  ADMIN_CONFLICT: 'Dữ liệu đã thay đổi. Vui lòng tải lại.',
  ADMIN_UNAVAILABLE: 'Dịch vụ quản trị tạm thời không khả dụng.',
};

export function adminError(status: AdminHttpError['status'], code: AdminErrorCode, message?: string): AdminHttpError {
  return new AdminHttpError(status, code, message ?? MESSAGES[code] ?? 'Yêu cầu không hợp lệ.');
}

export function errorResponse(c: Context, status: number, code: AdminErrorCode, message?: string): Response {
  return c.json({ error: message ?? MESSAGES[code] ?? 'Đã xảy ra lỗi.', code }, status as 400);
}

export async function dataContext(c: AdminContext): Promise<AdminDataContext> {
  let fixtureDataset: string | null = null;
  try {
    const row = await c.env.DB.prepare("SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'").first<{ value: string }>();
    fixtureDataset = row?.value ?? null;
  } catch {
    fixtureDataset = null;
  }
  return { environment: c.env.ENVIRONMENT || 'development', generatedAt: new Date().toISOString(), fixtureDataset };
}

export async function ok<T>(c: AdminContext, data: T, status: 200 | 201 = 200): Promise<Response> {
  return c.json({ data, context: await dataContext(c) }, status);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function plusMinutes(minutes: number, from = Date.now()): string {
  return new Date(from + minutes * 60_000).toISOString();
}

export function randomHex(bytes: number): string {
  const array = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newId(prefix: string): string {
  return `${prefix}_${randomHex(12)}`;
}

/** Constant-time comparison of equal-length hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCookie(c: Context, name: string): string | undefined {
  const header = c.req.header('cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'anonymous_client';
}

/** SQLite datetime() comparable "now" for ISO columns written with toISOString(). */
export function isPast(iso: string, now = Date.now()): boolean {
  const value = Date.parse(iso);
  return !Number.isFinite(value) || value <= now;
}

export function rangeDays(range: '7d' | '30d' | '90d'): number {
  return range === '7d' ? 7 : range === '90d' ? 90 : 30;
}

/** First UTC day included in the range, as YYYY-MM-DD. */
export function rangeStartDay(range: '7d' | '30d' | '90d', now = Date.now()): string {
  const start = new Date(now - (rangeDays(range) - 1) * 86_400_000);
  return start.toISOString().slice(0, 10);
}

export function fillDays(range: '7d' | '30d' | '90d', rows: Array<{ day: string; value: number | null }>, now = Date.now()) {
  const byDay = new Map(rows.map((row) => [row.day, Number(row.value ?? 0)]));
  const days = rangeDays(range);
  const points = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    points.push({ date, value: byDay.get(date) ?? 0 });
  }
  return points;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
