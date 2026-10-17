import type { D1PreparedStatement } from '@frigo/db';
import type { AdminAuditOutcome } from '../../../shared/admin';
import { hmacSha256Hex } from '../../utils/session';
import { AdminHttpError, newId, type AdminContext } from './http';

const METADATA_KEYS = new Set([
  'permission', 'path', 'method', 'role', 'state', 'recipeVersion', 'reason', 'decision', 'approvalId',
  'assignmentId', 'sessionId', 'authMethod', 'source', 'range', 'field', 'rbacMatrixVersion', 'status', 'requestedBy',
]);

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEvent {
  actorUserId: string | null;
  actorRoles: readonly string[];
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  outcome: AdminAuditOutcome;
  reasonCode?: string | null;
  metadata?: AuditMetadata;
}

/** Keeps only allow-listed primitive keys; strings are clipped and never contain '@'. */
export function sanitizeMetadata(metadata: AuditMetadata | undefined): string | null {
  if (!metadata) return null;
  const clean: AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string') clean[key] = value.replaceAll('@', '(at)').slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === 'boolean' || value === null) clean[key] = value;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

async function ipHash(c: AdminContext): Promise<string | null> {
  const secret = c.env.ADMIN_AUDIT_HMAC_SECRET;
  const ip = c.req.header('CF-Connecting-IP');
  if (!secret || secret.length < 32 || !ip) return null;
  return hmacSha256Hex(`admin-audit-ip:${ip}`, secret);
}

async function values(c: AdminContext, event: AuditEvent): Promise<unknown[]> {
  const requestId = (c.get('requestId') as string | undefined) ?? null;
  return [newId('evt'), event.actorUserId, JSON.stringify([...event.actorRoles]), event.action,
    event.targetType ?? null, event.targetId ? event.targetId.slice(0, 128) : null, event.outcome,
    event.reasonCode ?? null, requestId ? requestId.slice(0, 128) : null, await ipHash(c), sanitizeMetadata(event.metadata)];
}

const COLUMNS = '(id, actor_user_id, actor_roles, action, target_type, target_id, outcome, reason_code, request_id, ip_hash, metadata_json)';

export async function auditStatement(c: AdminContext, event: AuditEvent): Promise<D1PreparedStatement> {
  return c.get('adminDb').prepare(`INSERT INTO admin_audit_events ${COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...(await values(c, event)));
}

/**
 * Audit insert that commits only when `guardSql` holds inside the same batch,
 * so a lost race never records a false success.
 */
export async function guardedAuditStatement(c: AdminContext, event: AuditEvent, guardSql: string, guardBinds: unknown[]): Promise<D1PreparedStatement> {
  return c.get('adminDb').prepare(`INSERT INTO admin_audit_events ${COLUMNS} SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guardSql}`)
    .bind(...(await values(c, event)), ...guardBinds);
}

/** Durable audit required before an action proceeds or data is disclosed; fails closed. */
export async function requireAudit(c: AdminContext, event: AuditEvent): Promise<void> {
  try {
    await (await auditStatement(c, event)).run();
  } catch {
    console.error(JSON.stringify({ level: 'error', event: 'admin_audit_required_write_failed', action: event.action }));
    throw new AdminHttpError(503, 'ADMIN_AUDIT_UNAVAILABLE', 'Không ghi được nhật ký kiểm toán nên thao tác đã bị chặn.');
  }
}

/**
 * Best-effort audit for denials and failed logins. The request is already
 * refused, so a failed write never grants anything; it is logged.
 */
export async function writeAudit(c: AdminContext, event: AuditEvent): Promise<void> {
  try {
    await (await auditStatement(c, event)).run();
  } catch {
    console.error(JSON.stringify({ level: 'error', event: 'admin_audit_write_failed', action: event.action }));
  }
}
