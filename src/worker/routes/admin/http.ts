import type { Context, MiddlewareHandler } from 'hono';
import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminDataContext, AdminErrorCode, AdminPermission, AdminRole } from '../../../shared/admin';
import type { CustomerReadClient } from './customer-facade-client';
import type { AdminEnv } from './env';
import type { AdminPolicy } from './policy';

export interface AdminPrincipal {
  userId: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  sessionId: string;
  /** Session-derived CSRF token (never stored). */
  csrfToken: string;
  authMethod: 'password' | 'cloudflare_access';
  createdAt: string;
  expiresAt: string;
  idleExpiresAt: string;
  email: string | null;
  displayName: string | null;
  accessIss?: string;
  accessSub?: string;
  operatorId?: string;
}

export type AdminVariables = {
  admin: AdminPrincipal;
  requestId: string;
  policy: AdminPolicy;
  /** Internal named reads, not a D1 binding. */
  main: CustomerReadClient;
  adminDb: D1DatabaseBinding;
  fixtureDataset: string | null;
};
export type AdminApp = { Bindings: AdminEnv; Variables: AdminVariables };
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
  ADMIN_GOVERNANCE_INCOMPLETE: 'Cần ít nhất ba người vận hành đã được phê duyệt và có thể đăng nhập.',
  ADMIN_UNAVAILABLE: 'Dịch vụ quản trị tạm thời không khả dụng.',
  ADMIN_AUDIT_UNAVAILABLE: 'Không ghi được nhật ký kiểm toán nên thao tác đã bị chặn.',
  ADMIN_SCHEMA_MISMATCH: 'Cơ sở dữ liệu quản trị chưa đúng phiên bản.',
  ADMIN_FIXTURE_DATA_REJECTED: 'Dữ liệu tổng hợp bị từ chối ở môi trường này.',
};

export function errorResponse(c: Context, status: number, code: AdminErrorCode, message?: string): Response {
  return c.json({ error: message ?? MESSAGES[code] ?? 'Đã xảy ra lỗi.', code }, status as 400);
}

export function dataContext(c: AdminContext): AdminDataContext {
  return { environment: c.get('policy')?.environment ?? 'unknown', generatedAt: nowIso(), fixtureDataset: c.get('fixtureDataset') ?? null };
}

export function ok<T>(c: AdminContext, data: T, status: 200 | 201 = 200): Response {
  return c.json({ data, context: dataContext(c) }, status);
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

export function isPast(iso: string, now = Date.now()): boolean {
  const value = Date.parse(iso);
  return !Number.isFinite(value) || value <= now;
}

export function rangeDays(range: '7d' | '30d' | '90d'): number {
  return range === '7d' ? 7 : range === '90d' ? 90 : 30;
}

/** First UTC day included in the range, as YYYY-MM-DD. */
export function rangeStartDay(range: '7d' | '30d' | '90d', now = Date.now()): string {
  return new Date(now - (rangeDays(range) - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function fillDays(range: '7d' | '30d' | '90d', rows: Array<{ day: string; value: number | null }>, now = Date.now()) {
  const byDay = new Map(rows.map((row) => [row.day, Number(row.value ?? 0)]));
  const points = [];
  for (let i = rangeDays(range) - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    points.push({ date, value: byDay.get(date) ?? 0 });
  }
  return points;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** SQLite/D1 constraint or trigger aborts surface as conflicts, never as 500s. */
export function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|CHECK constraint failed|SQLITE_CONSTRAINT|at least (?:two|three) active (?:enrolled )?SUPER_ADMIN|role target must be|approval target must be|cannot be reactivated|already been completed|are final/i.test(message);
}
