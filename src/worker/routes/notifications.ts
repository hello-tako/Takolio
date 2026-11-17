import { Hono } from 'hono';
import { Env, AuthContext } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { readInventoryAuthorityMode } from '../../../packages/db/src/inventory-writer-fence';
import { readInventoryAuthority } from '../../../packages/db/src/inventory-read-authority';

export const notificationRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface NotificationRow {
  id: string;
  household_id: string;
  user_id: string | null;
  category: 'expiry' | 'shopping' | 'planner' | 'household' | 'system';
  title: string;
  message: string;
  action_url: string | null;
  dedupe_key: string | null;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

function legacyTypeForCategory(category: NotificationRow['category']): string {
  switch (category) {
    case 'expiry':
      return 'expiring_soon';
    case 'shopping':
      return 'shopping_reminder';
    case 'system':
      return 'cook_ready';
    default:
      return category;
  }
}

function mapNotificationRow(row: NotificationRow, fallbackUserId: string) {
  return {
    id: row.id,
    userId: row.user_id ?? fallbackUserId,
    category: row.category,
    type: legacyTypeForCategory(row.category),
    title: row.title,
    message: row.message,
    actionUrl: row.action_url ?? null,
    isRead: Boolean(row.is_read),
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

async function deterministicNotifId(householdId: string, dedupeKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${householdId}:${dedupeKey}`)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `notif_${hex.slice(0, 28)}`;
}

notificationRoutes.get('/notifications', tenancyGuard, async (c) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  const db = c.env.DB;
  if (!auth.householdId || auth.userId === 'guest_anonymous') {
    return c.json({ notifications: [] });
  }

  const nowIso = new Date().toISOString();

  if (!db) {
    return c.json({
      notifications: [
        {
          id: 'notif_welcome_fallback',
          userId: auth.userId,
          category: 'system',
          type: 'cook_ready',
          title: 'Chào mừng bạn đến với Takolio!',
          message: 'Hãy chụp ảnh tủ lạnh hoặc hóa đơn đi chợ để Takolio tự động ghi nhận nguyên liệu cho bạn.',
          actionUrl: '/scan',
          isRead: false,
          readAt: null,
          createdAt: nowIso,
        },
      ],
    });
  }

  try {
    // 1. Check expiring items — T11: adopted households derive freshness
    // from canonical lot authority; the projection is never the source.
    let expiringItems: Array<{ key: string; name: string; quantity: number; unit: string }> = [];
    if ((await readInventoryAuthorityMode(db, auth.householdId)) === 'native') {
      const { items } = await readInventoryAuthority(db, {
        householdId: auth.householdId,
        actorId: auth.userId,
      });
      expiringItems = items
        .filter((item) => item.freshness === 'expiring' || item.freshness === 'use_soon')
        .slice(0, 5)
        .map((item) => ({
          key: `expiry:${item.lotId}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        }));
    } else {
      const expiring = await db
        .prepare(
          `SELECT id, name, quantity, unit, freshness
             FROM inventory_items
            WHERE household_id = ?
              AND quantity > 0
              AND (freshness = 'expiring' OR freshness = 'use_soon')
            LIMIT 5`
        )
        .bind(auth.householdId)
        .all<{ id: string; name: string; quantity: number; unit: string }>();
      expiringItems = (expiring.results || []).map((item) => ({
        key: `expiry:${item.id}`,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));
    }

    // 2. Check pending shopping items
    const shopping = await db
      .prepare(
        `SELECT COUNT(*) as cnt
           FROM shopping_items si
           JOIN shopping_lists sl ON si.list_id = sl.id
          WHERE sl.household_id = ? AND si.is_checked = 0`
      )
      .bind(auth.householdId)
      .first<{ cnt: number }>();
    const pendingShoppingCount = Number(shopping?.cnt ?? 0);

    // Ensure household row exists before FK writes in lightweight test fixtures.
    const statements: any[] = [
      db
        .prepare('INSERT OR IGNORE INTO users (id, is_guest) VALUES (?, ?)')
        .bind(auth.userId, auth.isGuest ? 1 : 0),
      db
        .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
        .bind(auth.householdId, 'Tủ lạnh gia đình', auth.userId),
    ];

    // Prune stale expiry notifications for items already consumed/discarded.
    if (expiringItems.length === 0) {
      statements.push(
        db
          .prepare(
            `DELETE FROM user_notifications
              WHERE household_id = ? AND category = 'expiry' AND dedupe_key LIKE 'expiry:%'`
          )
          .bind(auth.householdId)
      );
    } else {
      const placeholders = expiringItems.map(() => '?').join(',');
      statements.push(
        db
          .prepare(
            `DELETE FROM user_notifications
              WHERE household_id = ?
                AND category = 'expiry'
                AND dedupe_key LIKE 'expiry:%'
                AND dedupe_key NOT IN (${placeholders})`
          )
          .bind(auth.householdId, ...expiringItems.map((it) => it.key))
      );
    }

    // Upsert active expiry alerts without overwriting existing is_read state.
    for (const it of expiringItems) {
      const notifId = await deterministicNotifId(auth.householdId, it.key);
      statements.push(
        db
          .prepare(
            `INSERT INTO user_notifications
               (id, household_id, user_id, category, title, message, action_url, dedupe_key, is_read, created_at)
             VALUES (?, ?, NULL, 'expiry', ?, ?, '/fridge', ?, 0, ?)
             ON CONFLICT(household_id, dedupe_key) DO UPDATE SET
               title = excluded.title,
               message = excluded.message`
          )
          .bind(
            notifId,
            auth.householdId,
            `${it.name} cần dùng sớm!`,
            `Bạn đang có ${it.quantity} ${it.unit} ${it.name} trong tủ lạnh. Hãy chế biến ngay để giữ độ tươi ngon nhé.`,
            it.key,
            nowIso
          )
      );
    }

    // Sync shopping reminder without overwriting existing is_read state.
    if (pendingShoppingCount > 0) {
      const shopNotifId = await deterministicNotifId(auth.householdId, 'shopping:pending');
      const shopCreatedAt = new Date(Date.now() - 1_800_000).toISOString();
      statements.push(
        db
          .prepare(
            `INSERT INTO user_notifications
               (id, household_id, user_id, category, title, message, action_url, dedupe_key, is_read, created_at)
             VALUES (?, ?, NULL, 'shopping', ?, ?, '/shopping', 'shopping:pending', 0, ?)
             ON CONFLICT(household_id, dedupe_key) DO UPDATE SET
               title = excluded.title,
               message = excluded.message`
          )
          .bind(
            shopNotifId,
            auth.householdId,
            'Nhắc nhở danh sách đi chợ',
            `Bạn còn ${pendingShoppingCount} món chưa mua trong danh sách đi chợ.`,
            shopCreatedAt
          )
      );
    } else {
      statements.push(
        db
          .prepare(
            `DELETE FROM user_notifications
              WHERE household_id = ? AND category = 'shopping' AND dedupe_key = 'shopping:pending'`
          )
          .bind(auth.householdId)
      );
    }

    // Manage welcome notification: show for brand-new households, clear when real alerts exist.
    const hasOperationalAlerts = expiringItems.length > 0 || pendingShoppingCount > 0;
    if (hasOperationalAlerts) {
      statements.push(
        db
          .prepare(
            `DELETE FROM user_notifications
              WHERE household_id = ? AND category = 'system' AND dedupe_key = 'system:welcome'`
          )
          .bind(auth.householdId)
      );
    }

    await db.batch(statements);

    let persisted = await db
      .prepare(
        `SELECT * FROM user_notifications
          WHERE household_id = ?
            AND (user_id IS NULL OR user_id = ?)
          ORDER BY is_read ASC, created_at DESC
          LIMIT 50`
      )
      .bind(auth.householdId, auth.userId)
      .all<NotificationRow>();

    let rows = (persisted.results || []) as NotificationRow[];

    if (rows.length === 0) {
      const welcomeId = await deterministicNotifId(auth.householdId, 'system:welcome');
      await db
        .prepare(
          `INSERT INTO user_notifications
             (id, household_id, user_id, category, title, message, action_url, dedupe_key, is_read, created_at)
           VALUES (?, ?, NULL, 'system', ?, ?, '/scan', 'system:welcome', 0, ?)
           ON CONFLICT(household_id, dedupe_key) DO NOTHING`
        )
        .bind(
          welcomeId,
          auth.householdId,
          'Chào mừng bạn đến với Takolio!',
          'Hãy chụp ảnh tủ lạnh hoặc hóa đơn đi chợ để Takolio tự động ghi nhận nguyên liệu cho bạn.',
          nowIso
        )
        .run();

      persisted = await db
        .prepare(
          `SELECT * FROM user_notifications
            WHERE household_id = ?
              AND (user_id IS NULL OR user_id = ?)
            ORDER BY is_read ASC, created_at DESC
            LIMIT 50`
        )
        .bind(auth.householdId, auth.userId)
        .all<NotificationRow>();
      rows = (persisted.results || []) as NotificationRow[];
    }

    return c.json({
      notifications: rows.map((row) => mapNotificationRow(row, auth.userId)),
    });
  } catch {
    console.warn(JSON.stringify({ event: 'notifications_query_failed' }));
    return c.json({
      notifications: [
        {
          id: 'notif_welcome_fallback',
          userId: auth.userId,
          category: 'system',
          type: 'cook_ready',
          title: 'Chào mừng bạn đến với Takolio!',
          message: 'Hãy chụp ảnh tủ lạnh hoặc hóa đơn đi chợ để Takolio tự động ghi nhận nguyên liệu cho bạn.',
          actionUrl: '/scan',
          isRead: false,
          readAt: null,
          createdAt: nowIso,
        },
      ],
    });
  }
});

// PATCH /api/v1/notifications/:id/read
notificationRoutes.patch(
  '/notifications/:id/read',
  tenancyGuard,
  rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_notif_w' }),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    const auth = c.get('auth');
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
    }
    const id = c.req.param('id');
    const nowIso = new Date().toISOString();
    try {
      const existing = await db
        .prepare(
          `SELECT * FROM user_notifications
            WHERE id = ? AND household_id = ? AND (user_id IS NULL OR user_id = ?)
            LIMIT 1`
        )
        .bind(id, auth.householdId, auth.userId)
        .first<NotificationRow>();
      if (!existing) {
        return c.json({ error: 'Không tìm thấy thông báo', code: 'NOT_FOUND' }, 404);
      }
      await db
        .prepare(
          `UPDATE user_notifications
              SET is_read = 1, read_at = COALESCE(read_at, ?)
            WHERE id = ? AND household_id = ?`
        )
        .bind(nowIso, id, auth.householdId)
        .run();
      const updated: NotificationRow = {
        ...existing,
        is_read: 1,
        read_at: existing.read_at ?? nowIso,
      };
      return c.json({
        success: true,
        notification: mapNotificationRow(updated, auth.userId),
      });
    } catch {
      return c.json({ error: 'Không thể cập nhật trạng thái thông báo', code: 'DATABASE_ERROR' }, 500);
    }
  }
);

// POST /api/v1/notifications/read-all
notificationRoutes.post(
  '/notifications/read-all',
  tenancyGuard,
  rateLimiter({ maxRequests: 30, windowSeconds: 60, prefix: 'rl_notif_w' }),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    const auth = c.get('auth');
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
    }
    const nowIso = new Date().toISOString();
    try {
      const res = await db
        .prepare(
          `UPDATE user_notifications
              SET is_read = 1, read_at = COALESCE(read_at, ?)
            WHERE household_id = ?
              AND (user_id IS NULL OR user_id = ?)
              AND is_read = 0`
        )
        .bind(nowIso, auth.householdId, auth.userId)
        .run();
      const updatedCount = typeof res.meta?.changes === 'number' ? res.meta.changes : 0;
      return c.json({ success: true, updatedCount });
    } catch {
      return c.json({ error: 'Không thể đánh dấu đã đọc tất cả thông báo', code: 'DATABASE_ERROR' }, 500);
    }
  }
);
