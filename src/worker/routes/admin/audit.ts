import type { D1PreparedStatement } from '@frigo/db';
import type { AdminAuditOutcome } from '../../../shared/admin';
import { hmacSha256Hex } from '../../utils/session';
import { clientIp, newId, type AdminContext } from './http';

const METADATA_KEYS = new Set([
  'permission', 'path', 'method', 'role', 'state', 'recipeVersion', 'reason', 'decision', 'approvalId',
  'assignmentId', 'sessionId', 'authMethod', 'source', 'range', 'field', 'rbacMatrixVersion', 'status',
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
  const secret = c.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return hmacSha256Hex(`admin-audit-ip:${clientIp(c)}`, secret);
}

export async function auditStatement(c: AdminContext, event: AuditEvent): Promise<D1PreparedStatement> {
  const requestId = (c.get('requestId') as string | undefined) ?? null;
  return c.env.DB.prepare(`INSERT INTO admin_audit_events
      (id, actor_user_id, actor_roles, action, target_type, target_id, outcome, reason_code, request_id, ip_hash, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId('evt'), event.actorUserId, JSON.stringify([...event.actorRoles]), event.action,
      event.targetType ?? null, event.targetId ? event.targetId.slice(0, 128) : null, event.outcome,
      event.reasonCode ?? null, requestId ? requestId.slice(0, 128) : null, await ipHash(c), sanitizeMetadata(event.metadata));
}

/** Standalone audit write for denials/failures; never masks the original response on failure. */
export async function writeAudit(c: AdminContext, event: AuditEvent): Promise<void> {
  try {
    await (await auditStatement(c, event)).run();
  } catch {
    console.error(JSON.stringify({ level: 'error', event: 'admin_audit_write_failed', action: event.action }));
  }
}

/**
 * Audit insert that commits only when `guardSql` (an EXISTS-style predicate)
 * holds inside the same batch, so a lost race never records a false success.
 */
export async function guardedAuditStatement(
  c: AdminContext,
  event: AuditEvent,
  guardSql: string,
  guardBinds: unknown[],
): Promise<D1PreparedStatement> {
  const requestId = (c.get('requestId') as string | undefined) ?? null;
  return c.env.DB.prepare(`INSERT INTO admin_audit_events
      (id, actor_user_id, actor_roles, action, target_type, target_id, outcome, reason_code, request_id, ip_hash, metadata_json)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guardSql}`)
    .bind(newId('evt'), event.actorUserId, JSON.stringify([...event.actorRoles]), event.action,
      event.targetType ?? null, event.targetId ? event.targetId.slice(0, 128) : null, event.outcome,
      event.reasonCode ?? null, requestId ? requestId.slice(0, 128) : null, await ipHash(c), sanitizeMetadata(event.metadata), ...guardBinds);
}
