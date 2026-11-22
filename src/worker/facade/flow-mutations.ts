import type { D1DatabaseBinding } from '@frigo/db';
import type {
  AdminBillingMarkPaidResult,
  AdminBillingRefundResult,
  AdminBillingResolveResult,
  AdminRecipeMediaRejectResult,
  AdminRecipeMetadataUpdateResult,
  AdminRecipeVerificationResult,
  AdminScanJobActionResult,
  AdminSystemBroadcastResult,
  AdminSystemHygieneResult,
} from '../../shared/admin';
import { mutationInputs, type MutationOperation } from './contract';

export type FlowMutationOperation =
  | 'billing.intent.mark_paid'
  | 'billing.intent.refund'
  | 'billing.intent.resolve'
  | 'recipes.verification.set'
  | 'recipes.metadata.update'
  | 'recipes.media.reject'
  | 'ai.scan_job.retry'
  | 'ai.scan_job.cancel'
  | 'system.hygiene.run'
  | 'system.broadcast.send';

const FLOW_OPERATIONS = new Set<FlowMutationOperation>([
  'billing.intent.mark_paid',
  'billing.intent.refund',
  'billing.intent.resolve',
  'recipes.verification.set',
  'recipes.metadata.update',
  'recipes.media.reject',
  'ai.scan_job.retry',
  'ai.scan_job.cancel',
  'system.hygiene.run',
  'system.broadcast.send',
]);

export function isFlowMutationOperation(operation: MutationOperation): operation is FlowMutationOperation {
  return FLOW_OPERATIONS.has(operation as FlowMutationOperation);
}

export async function executeFlowMutation(
  db: D1DatabaseBinding,
  operation: FlowMutationOperation,
  rawInput: unknown,
): Promise<unknown> {
  switch (operation) {
    case 'billing.intent.mark_paid': {
      const input = mutationInputs['billing.intent.mark_paid'].parse(rawInput);
      const intent = await db
        .prepare('SELECT id, user_id, plan, status FROM payment_intents WHERE id = ? LIMIT 1')
        .bind(input.intentId)
        .first<{ id: string; user_id: string; plan: string; status: string }>();
      if (!intent) throw new Error('FACADE_NOT_FOUND:Không tìm thấy giao dịch thanh toán.');
      if (intent.status === 'paid' || intent.status === 'refunded') {
        throw new Error('FACADE_CONFLICT:Giao dịch đã được thanh toán hoặc hoàn tiền.');
      }
      const hadRec = Boolean(
        await db
          .prepare('SELECT 1 AS ok FROM payment_reconciliation_records WHERE intent_id = ? LIMIT 1')
          .bind(input.intentId)
          .first(),
      );
      const sub = await db
        .prepare('SELECT id, plan, status, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
        .bind(intent.user_id)
        .first<{ id: string; plan: string; status: string | null; expires_at: string | null }>();
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const days = input.grantDays ?? (intent.plan === 'annual' ? 366 : 31);
      const currentExpMs =
        sub &&
        sub.plan === 'plus' &&
        (sub.status === 'active' || sub.status === 'suspended:active') &&
        sub.expires_at &&
        Number.isFinite(Date.parse(sub.expires_at))
          ? Date.parse(sub.expires_at)
          : 0;
      const baseMs = Math.max(nowMs, currentExpMs);
      const subscriptionExpiresAt = new Date(baseMs + days * 86_400_000).toISOString();
      const subId = sub?.id ?? `sub_${crypto.randomUUID()}`;
      const nextSubStatus = sub?.status?.startsWith('suspended:') ? 'suspended:active' : 'active';

      await db.batch([
        db
          .prepare(
            "UPDATE payment_intents SET status = 'paid', provider_reference = COALESCE(provider_reference, ?), updated_at = ? WHERE id = ?",
          )
          .bind(`admin_manual:${intent.id}`, now, intent.id),
        db.prepare('DELETE FROM payment_reconciliation_records WHERE intent_id = ?').bind(intent.id),
        db.prepare('DELETE FROM checkout_admissions WHERE intent_id = ?').bind(intent.id),
        db
          .prepare(
            `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, expires_at, created_at, updated_at)
             VALUES (?, ?, 'plus', ?, 0, 500, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               plan = 'plus',
               status = excluded.status,
               max_scans_per_month = 500,
               expires_at = excluded.expires_at,
               updated_at = excluded.updated_at`,
          )
          .bind(subId, intent.user_id, nextSubStatus, subscriptionExpiresAt, now, now),
        db
          .prepare(
            "UPDATE scan_quota_periods SET max_scans = 500, updated_at = ? WHERE user_id = ? AND period_start = strftime('%Y-%m-01', 'now')",
          )
          .bind(now, intent.user_id),
      ]);

      const result: AdminBillingMarkPaidResult = {
        intentId: intent.id,
        userId: intent.user_id,
        status: 'paid',
        subscriptionExpiresAt,
        reconciliationCleared: hadRec,
        updatedAt: now,
      };
      return result;
    }

    case 'billing.intent.refund': {
      const input = mutationInputs['billing.intent.refund'].parse(rawInput);
      const intent = await db
        .prepare('SELECT id, user_id, status FROM payment_intents WHERE id = ? LIMIT 1')
        .bind(input.intentId)
        .first<{ id: string; user_id: string; status: string }>();
      if (!intent) throw new Error('FACADE_NOT_FOUND:Không tìm thấy giao dịch thanh toán.');
      if (intent.status !== 'paid') {
        throw new Error('FACADE_CONFLICT:Chỉ có thể hoàn tiền giao dịch đã thanh toán.');
      }
      const now = new Date().toISOString();
      const statements = [
        db.prepare("UPDATE payment_intents SET status = 'refunded', updated_at = ? WHERE id = ?").bind(now, intent.id),
        db.prepare('DELETE FROM payment_reconciliation_records WHERE intent_id = ?').bind(intent.id),
      ];
      if (input.revokeSubscription) {
        statements.push(
          db
            .prepare(
              `UPDATE subscriptions
               SET plan = 'free',
                   status = CASE WHEN status LIKE 'suspended:%' THEN 'suspended:cancelled' ELSE 'cancelled' END,
                   expires_at = NULL,
                   max_scans_per_month = 5,
                   updated_at = ?
               WHERE user_id = ?`,
            )
            .bind(now, intent.user_id),
          db
            .prepare(
              "UPDATE scan_quota_periods SET max_scans = 5, updated_at = ? WHERE user_id = ? AND period_start = strftime('%Y-%m-01', 'now')",
            )
            .bind(now, intent.user_id),
        );
      }
      await db.batch(statements);
      const result: AdminBillingRefundResult = {
        intentId: intent.id,
        userId: intent.user_id,
        status: 'refunded',
        subscriptionRevoked: input.revokeSubscription,
        updatedAt: now,
      };
      return result;
    }

    case 'billing.intent.resolve': {
      const input = mutationInputs['billing.intent.resolve'].parse(rawInput);
      const intent = await db
        .prepare('SELECT id, status FROM payment_intents WHERE id = ? LIMIT 1')
        .bind(input.intentId)
        .first<{ id: string; status: string }>();
      if (!intent) throw new Error('FACADE_NOT_FOUND:Không tìm thấy giao dịch thanh toán.');
      if (intent.status !== 'pending') {
        throw new Error('FACADE_CONFLICT:Chỉ có thể đóng giao dịch đang ở trạng thái chờ.');
      }
      const hadRec = Boolean(
        await db
          .prepare('SELECT 1 AS ok FROM payment_reconciliation_records WHERE intent_id = ? LIMIT 1')
          .bind(input.intentId)
          .first(),
      );
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('UPDATE payment_intents SET status = ?, updated_at = ? WHERE id = ?').bind(input.outcome, now, intent.id),
        db.prepare('DELETE FROM payment_reconciliation_records WHERE intent_id = ?').bind(intent.id),
        db.prepare('DELETE FROM checkout_admissions WHERE intent_id = ?').bind(intent.id),
      ]);
      const result: AdminBillingResolveResult = {
        intentId: intent.id,
        status: input.outcome,
        reconciliationCleared: hadRec,
        updatedAt: now,
      };
      return result;
    }

    case 'recipes.verification.set': {
      const input = mutationInputs['recipes.verification.set'].parse(rawInput);
      const recipe = await db
        .prepare('SELECT id, version FROM recipes WHERE id = ? LIMIT 1')
        .bind(input.recipeId)
        .first<{ id: string; version: number }>();
      if (!recipe) throw new Error('FACADE_NOT_FOUND:Không tìm thấy công thức.');
      if (Number(recipe.version) !== input.recipeVersion) {
        throw new Error('FACADE_CONFLICT:Phiên bản công thức đã thay đổi, vui lòng tải lại.');
      }
      const now = new Date().toISOString();
      await db
        .prepare('UPDATE recipes SET verification_state = ? WHERE id = ? AND version = ?')
        .bind(input.verificationState, recipe.id, input.recipeVersion)
        .run();
      const result: AdminRecipeVerificationResult = {
        id: recipe.id,
        verificationState: input.verificationState,
        version: Number(recipe.version),
        updatedAt: now,
      };
      return result;
    }

    case 'recipes.metadata.update': {
      const input = mutationInputs['recipes.metadata.update'].parse(rawInput);
      const recipe = await db
        .prepare('SELECT id, title, version FROM recipes WHERE id = ? LIMIT 1')
        .bind(input.recipeId)
        .first<{ id: string; title: string; version: number }>();
      if (!recipe) throw new Error('FACADE_NOT_FOUND:Không tìm thấy công thức.');

      const sets: string[] = [];
      const binds: unknown[] = [];
      if (input.title !== undefined) {
        sets.push('title = ?');
        binds.push(input.title);
      }
      if (input.description !== undefined) {
        sets.push('description = ?');
        binds.push(input.description);
      }
      if (input.cuisine !== undefined) {
        sets.push('cuisine = ?');
        binds.push(input.cuisine);
      }
      if (input.difficulty !== undefined) {
        sets.push('difficulty = ?');
        binds.push(input.difficulty);
      }
      if (input.cookTimeMinutes !== undefined) {
        sets.push('cook_time_minutes = ?');
        binds.push(input.cookTimeMinutes);
      }
      if (input.prepTimeMinutes !== undefined) {
        sets.push('prep_time_minutes = ?');
        binds.push(input.prepTimeMinutes);
      }
      if (input.servings !== undefined) {
        sets.push('servings = ?');
        binds.push(input.servings);
      }
      if (input.tags !== undefined) {
        sets.push('tags = ?');
        binds.push(JSON.stringify(input.tags));
      }
      if (sets.length > 0) {
        await db
          .prepare(`UPDATE recipes SET ${sets.join(', ')} WHERE id = ?`)
          .bind(...binds, recipe.id)
          .run();
      }
      const now = new Date().toISOString();
      const result: AdminRecipeMetadataUpdateResult = {
        id: recipe.id,
        title: input.title ?? recipe.title,
        version: Number(recipe.version),
        updatedAt: now,
      };
      return result;
    }

    case 'recipes.media.reject': {
      const input = mutationInputs['recipes.media.reject'].parse(rawInput);
      const media = await db
        .prepare('SELECT id FROM recipe_media WHERE recipe_id = ? AND role = ? AND version = ? LIMIT 1')
        .bind(input.recipeId, input.role, input.version)
        .first<{ id: string }>();
      if (!media) throw new Error('FACADE_NOT_FOUND:Không tìm thấy media công thức.');
      const now = new Date().toISOString();
      await db
        .prepare("UPDATE recipe_media SET status = 'rejected', updated_at = ? WHERE recipe_id = ? AND role = ? AND version = ?")
        .bind(now, input.recipeId, input.role, input.version)
        .run();
      const result: AdminRecipeMediaRejectResult = {
        recipeId: input.recipeId,
        role: input.role,
        version: input.version,
        status: 'rejected',
        updatedAt: now,
      };
      return result;
    }

    case 'ai.scan_job.retry': {
      const input = mutationInputs['ai.scan_job.retry'].parse(rawInput);
      const job = await db
        .prepare('SELECT id, scan_id FROM scan_queue_jobs WHERE id = ? LIMIT 1')
        .bind(input.jobId)
        .first<{ id: string; scan_id: string }>();
      if (!job) throw new Error('FACADE_NOT_FOUND:Không tìm thấy tác vụ quét.');
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            "UPDATE scan_queue_jobs SET status = 'pending', attempts = 0, error_code = NULL, error_message = NULL, locked_at = NULL, claim_token = NULL, updated_at = ? WHERE id = ?",
          )
          .bind(now, job.id),
        db.prepare("UPDATE scans SET status = 'pending', updated_at = ? WHERE id = ?").bind(now, job.scan_id),
      ]);
      const result: AdminScanJobActionResult = {
        id: job.id,
        scanId: job.scan_id,
        status: 'pending',
        attempts: 0,
        updatedAt: now,
      };
      return result;
    }

    case 'ai.scan_job.cancel': {
      const input = mutationInputs['ai.scan_job.cancel'].parse(rawInput);
      const job = await db
        .prepare(
          'SELECT j.id, j.scan_id, j.user_id, j.status, j.attempts, COALESCE(s.created_at, j.created_at) AS scan_created_at FROM scan_queue_jobs j LEFT JOIN scans s ON s.id = j.scan_id WHERE j.id = ? LIMIT 1',
        )
        .bind(input.jobId)
        .first<{ id: string; scan_id: string; user_id: string; status: string; attempts: number; scan_created_at: string }>();
      if (!job) throw new Error('FACADE_NOT_FOUND:Không tìm thấy tác vụ quét.');
      if (job.status === 'ready') {
        throw new Error('FACADE_CONFLICT:Tác vụ quét đã hoàn tất, không thể hủy.');
      }
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            "UPDATE scan_queue_jobs SET status = 'failed', error_code = 'ADMIN_CANCELLED', error_message = ?, locked_at = NULL, claim_token = NULL, updated_at = ? WHERE id = ?",
          )
          .bind(input.reason, now, job.id),
        db.prepare("UPDATE scans SET status = 'failed', updated_at = ? WHERE id = ?").bind(now, job.scan_id),
        db
          .prepare(
            "UPDATE scan_quota_periods SET used_count = MAX(0, used_count - 1), updated_at = ? WHERE user_id = ? AND period_start = strftime('%Y-%m-01', ?)",
          )
          .bind(now, job.user_id, job.scan_created_at),
        db
          .prepare(
            'UPDATE subscriptions SET scan_count_current_month = MAX(0, scan_count_current_month - 1), updated_at = ? WHERE user_id = ?',
          )
          .bind(now, job.user_id),
      ]);
      const result: AdminScanJobActionResult = {
        id: job.id,
        scanId: job.scan_id,
        status: 'failed',
        attempts: Number(job.attempts),
        updatedAt: now,
      };
      return result;
    }

    case 'system.hygiene.run': {
      mutationInputs['system.hygiene.run'].parse(rawInput);
      const [revokedCount, legacyCount, otpCount] = await Promise.all([
        db
          .prepare("SELECT COUNT(*) AS n FROM sessions_v2 WHERE revoked_at IS NOT NULL OR datetime(expires_at) <= datetime('now')")
          .first<{ n: number }>(),
        db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE datetime(expires_at) <= datetime('now')").first<{ n: number }>(),
        db
          .prepare("SELECT COUNT(*) AS n FROM auth_otps WHERE used = 1 OR used_at IS NOT NULL OR datetime(expires_at) <= datetime('now')")
          .first<{ n: number }>(),
      ]);
      await db.batch([
        db.prepare("DELETE FROM sessions_v2 WHERE revoked_at IS NOT NULL OR datetime(expires_at) <= datetime('now')"),
        db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')"),
        db.prepare("DELETE FROM auth_otps WHERE used = 1 OR used_at IS NOT NULL OR datetime(expires_at) <= datetime('now')"),
      ]);
      const result: AdminSystemHygieneResult = {
        revokedSessionsDeleted: Number(revokedCount?.n ?? 0),
        legacySessionsDeleted: Number(legacyCount?.n ?? 0),
        expiredOtpsDeleted: Number(otpCount?.n ?? 0),
        expiredApprovalsClosed: 0,
        ranAt: new Date().toISOString(),
      };
      return result;
    }

    case 'system.broadcast.send': {
      const input = mutationInputs['system.broadcast.send'].parse(rawInput);
      const proFilter =
        input.target === 'pro_only'
          ? "AND s.plan = 'plus' AND s.status = 'active' AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now'))"
          : '';
      const users = await db
        .prepare(
          `SELECT u.id FROM users u
           LEFT JOIN subscriptions s ON s.user_id = u.id
           WHERE u.is_guest = 0 AND COALESCE(s.status, 'active') <> 'deleted' ${proFilter}
           ORDER BY u.created_at DESC, u.id DESC
           LIMIT 500`,
        )
        .all<{ id: string }>();
      const sentAt = new Date().toISOString();
      if (users.results.length > 0) {
        const statements = users.results.map((u) =>
          db
            .prepare(
              "INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 'announcement', 0, ?)",
            )
            .bind(`ntf_${crypto.randomUUID()}`, u.id, input.title, input.message, sentAt),
        );
        await db.batch(statements);
      }
      const result: AdminSystemBroadcastResult = {
        target: input.target,
        recipientCount: users.results.length,
        sentAt,
      };
      return result;
    }
  }
}
