import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { findCanonicalIngredient, computeFreshness, type StandardUnit } from '@frigo/domain';
import { ensureHouseholdAdopted, type D1DatabaseBinding, type D1PreparedStatement } from '@frigo/db';
import { readInventoryAuthorityMode, runLegacyInventoryBatch } from '../../../packages/db/src/inventory-writer-fence';
import { composeInventoryLotCommands, readAdoptedLotSnapshot, type LotCommandSpec } from '../../../packages/db/src/inventory-lot-commands';
import { LotCommandError } from '../../../packages/domain/src/inventory-lot-commands';
import type { Env, AuthContext } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { sha256Hex } from '../utils/session';
import { lotExpiryFromEvidence } from '../utils/scan-evidence';
import { inventoryAuthorityFailure } from '../utils/inventory-authority';
import { fetchHouseholdInventoryFromDb } from './inventory';

type HouseholdVariables = { auth: AuthContext; householdRole?: string };
export const householdRoutes = new Hono<{ Bindings: Env; Variables: HouseholdVariables }>();

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALID_UNITS = new Set<StandardUnit>(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);

function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return `TAKO-${suffix}`;
}

function normalizeInviteCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 8 || !cleaned.startsWith('TAKO')) return null;
  return `TAKO-${cleaned.slice(4)}`;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function normalizeUnit(unit: string | undefined): StandardUnit {
  const candidate = (unit || 'piece').trim().toLowerCase() as StandardUnit;
  return VALID_UNITS.has(candidate) ? candidate : 'piece';
}

const CreateInviteSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(20).default(5),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  role: z.enum(['member']).default('member'),
});

const JoinHouseholdSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

const GuestImportItemSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().positive().max(10000),
  unit: z.string().trim().max(20).optional(),
  category: z.string().trim().max(30).optional(),
  storage: z.enum(['fridge', 'freezer', 'pantry']).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiryEstimated: z.boolean().optional(),
});

const GuestImportShoppingSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().positive().max(10000).default(1),
  unit: z.string().trim().max(20).default('piece'),
  isChecked: z.boolean().optional(),
  ingredientId: z.string().trim().max(100).optional(),
});

const ImportGuestSchema = z.object({
  items: z.array(GuestImportItemSchema).max(100).default([]),
  shoppingItems: z.array(GuestImportShoppingSchema).max(100).default([]),
  guestSessionToken: z.string().trim().min(16).max(256).optional(),
});

householdRoutes.use('/households/*', bodyLimit({ maxSize: 65_536 }));
householdRoutes.use('/households/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  return c.req.method === 'GET'
    ? next()
    : rateLimiter({ maxRequests: 30, windowSeconds: 60, prefix: 'rl_households' })(c, next);
});

// 1. GET /api/v1/households/current
householdRoutes.get('/households/current', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);

  try {
    const [hhRes, membersRes, invitesRes] = await db.batch([
      db.prepare('SELECT id, name, created_by, created_at FROM households WHERE id = ? LIMIT 1').bind(auth.householdId),
      db.prepare(
        `SELECT hm.user_id, hm.role, hm.created_at, u.email, p.display_name, p.avatar_url
           FROM household_members hm
           JOIN users u ON u.id = hm.user_id
           LEFT JOIN profiles p ON p.user_id = hm.user_id
          WHERE hm.household_id = ?
          ORDER BY CASE WHEN hm.role = 'owner' THEN 0 ELSE 1 END, hm.created_at ASC`
      ).bind(auth.householdId),
      db.prepare(
        `SELECT id, invite_code, role, max_uses, used_count, expires_at, created_at, created_by_user_id
           FROM household_invites
          WHERE household_id = ?
            AND revoked_at IS NULL
            AND used_count < max_uses
            AND datetime(expires_at) > datetime('now')
          ORDER BY created_at DESC
          LIMIT 20`
      ).bind(auth.householdId),
    ]);

    const household = (hhRes.results?.[0] ?? null) as {
      id: string; name: string; created_by: string; created_at: string;
    } | null;
    if (!household) {
      return c.json({ error: 'Không tìm thấy hộ gia đình', code: 'NOT_FOUND' }, 404);
    }

    const memberRows = (membersRes.results ?? []) as Array<{
      user_id: string;
      role: string;
      created_at: string;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>;
    const callerMember = memberRows.find((m) => m.user_id === auth.userId);
    const isOwner = callerMember?.role === 'owner' || c.get('householdRole') === 'owner';

    const members = memberRows.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name || 'Thành viên Takolio',
      email: isOwner || m.user_id === auth.userId ? m.email : maskEmail(m.email),
      avatarUrl: m.avatar_url || '/icons/favicon.svg',
      role: m.role === 'owner' ? 'owner' : 'member',
      joinedAt: m.created_at,
    }));

    const invites = isOwner
      ? ((invitesRes.results ?? []) as Array<{
          id: string;
          invite_code: string;
          role: string;
          max_uses: number;
          used_count: number;
          expires_at: string;
          created_at: string;
          created_by_user_id: string;
        }>).map((inv) => ({
          id: inv.id,
          inviteCode: inv.invite_code,
          role: inv.role,
          maxUses: inv.max_uses,
          usedCount: inv.used_count,
          expiresAt: inv.expires_at,
          createdAt: inv.created_at,
        }))
      : [];

    return c.json({
      household: {
        id: household.id,
        name: household.name,
        createdBy: household.created_by,
        createdAt: household.created_at,
        myRole: isOwner ? 'owner' : 'member',
      },
      members,
      invites,
    });
  } catch {
    return c.json({ error: 'Không thể tải thông tin hộ gia đình', code: 'DATABASE_ERROR' }, 500);
  }
});

// 2. POST /api/v1/households/invites
householdRoutes.post('/households/invites', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  if (auth.isGuest) {
    return c.json({ error: 'Vui lòng đăng nhập để tạo mã mời gia đình', code: 'REGISTERED_ACCOUNT_REQUIRED' }, 403);
  }
  if (!db) return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);

  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = CreateInviteSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return c.json({ error: 'Thông tin mã mời không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  const membership = await db
    .prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
    .bind(auth.householdId, auth.userId)
    .first<{ role: string }>();
  if (!membership || membership.role !== 'owner') {
    return c.json({ error: 'Chỉ chủ hộ gia đình mới có thể tạo mã mời', code: 'FORBIDDEN' }, 403);
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + parsed.data.expiresInDays * 86_400_000).toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `inv_${crypto.randomUUID()}`;
    const inviteCode = generateInviteCode();
    try {
      const res = await db
        .prepare(
          `INSERT INTO household_invites
            (id, household_id, invite_code, created_by_user_id, role, max_uses, used_count, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .bind(id, auth.householdId, inviteCode, auth.userId, parsed.data.role, parsed.data.maxUses, expiresAt, createdAt)
        .run();
      if (res.success) {
        return c.json(
          {
            success: true,
            invite: {
              id,
              inviteCode,
              role: parsed.data.role,
              maxUses: parsed.data.maxUses,
              usedCount: 0,
              expiresAt,
              createdAt,
            },
          },
          201
        );
      }
    } catch {
      // Retry on rare 4-char invite collision
    }
  }

  return c.json({ error: 'Không thể tạo mã mời lúc này. Vui lòng thử lại.', code: 'DATABASE_ERROR' }, 500);
});

// 3. POST /api/v1/households/join
householdRoutes.post('/households/join', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  if (!auth?.userId || auth.isGuest) {
    return c.json({ error: 'Vui lòng đăng nhập để tham gia hộ gia đình', code: 'REGISTERED_ACCOUNT_REQUIRED' }, 403);
  }
  if (!db) return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);

  const parsed = JoinHouseholdSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Mã mời không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  const inviteCode = normalizeInviteCode(parsed.data.inviteCode);
  if (!inviteCode) {
    return c.json({ error: 'Mã mời phải có định dạng TAKO-XXXX', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const invite = await db
      .prepare(
        `SELECT i.id, i.household_id, i.role, i.max_uses, i.used_count, i.expires_at, h.name AS household_name
           FROM household_invites i
           JOIN households h ON h.id = i.household_id
          WHERE i.invite_code = ?
            AND i.revoked_at IS NULL
            AND i.used_count < i.max_uses
            AND datetime(i.expires_at) > datetime('now')
          LIMIT 1`
      )
      .bind(inviteCode)
      .first<{
        id: string;
        household_id: string;
        role: 'owner' | 'member';
        max_uses: number;
        used_count: number;
        expires_at: string;
        household_name: string;
      }>();

    if (!invite) {
      return c.json({ error: 'Mã mời không tồn tại hoặc đã hết hạn', code: 'INVITE_INVALID_OR_EXPIRED' }, 404);
    }

    const existingMember = await db
      .prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
      .bind(invite.household_id, auth.userId)
      .first<{ role: string }>();

    if (existingMember) {
      await db
        .prepare('UPDATE sessions_v2 SET household_id = ? WHERE user_id = ? AND revoked_at IS NULL')
        .bind(invite.household_id, auth.userId)
        .run();
      return c.json({
        success: true,
        alreadyMember: true,
        householdId: invite.household_id,
        householdName: invite.household_name,
        role: existingMember.role,
        household: {
          id: invite.household_id,
          name: invite.household_name,
          role: existingMember.role,
        },
      });
    }

    const now = new Date().toISOString();
    const profile = await db
      .prepare('SELECT display_name FROM profiles WHERE user_id = ? LIMIT 1')
      .bind(auth.userId)
      .first<{ display_name: string | null }>();
    const displayName = profile?.display_name || 'Thành viên mới';

    const results = await db.batch([
      db
        .prepare(
          `UPDATE household_invites
              SET used_count = used_count + 1
            WHERE id = ?
              AND revoked_at IS NULL
              AND used_count < max_uses
              AND datetime(expires_at) > datetime('now')`
        )
        .bind(invite.id),
      db
        .prepare(
          `INSERT INTO household_members (id, household_id, user_id, role)
           SELECT ?, ?, ?, ?
            WHERE changes() = 1`
        )
        .bind(`hm_${invite.household_id}_${auth.userId}`, invite.household_id, auth.userId, invite.role),
      db
        .prepare('UPDATE sessions_v2 SET household_id = ? WHERE user_id = ? AND revoked_at IS NULL')
        .bind(invite.household_id, auth.userId),
      db
        .prepare(
          `INSERT INTO user_notifications
            (id, household_id, user_id, category, title, message, action_url, dedupe_key, is_read, created_at)
           VALUES (?, ?, NULL, 'household', ?, ?, '/account', ?, 0, ?)
           ON CONFLICT(household_id, dedupe_key) DO NOTHING`
        )
        .bind(
          `notif_${crypto.randomUUID()}`,
          invite.household_id,
          `${displayName} đã tham gia hộ gia đình`,
          `Tủ lạnh "${invite.household_name}" vừa có thêm thành viên cùng chia sẻ nguyên liệu và danh sách đi chợ.`,
          `household:join:${invite.id}:${auth.userId}`,
          now
        ),
    ]);

    if (results[0]?.meta?.changes !== 1) {
      return c.json({ error: 'Mã mời vừa hết lượt sử dụng hoặc đã hết hạn', code: 'INVITE_INVALID_OR_EXPIRED' }, 409);
    }

    return c.json({
      success: true,
      householdId: invite.household_id,
      householdName: invite.household_name,
      role: invite.role,
      household: {
        id: invite.household_id,
        name: invite.household_name,
        role: invite.role,
      },
    });
  } catch {
    return c.json({ error: 'Không thể tham gia hộ gia đình lúc này', code: 'DATABASE_ERROR' }, 500);
  }
});

// 4. DELETE /api/v1/households/members/:memberUserId
householdRoutes.delete('/households/members/:memberUserId', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const targetUserId = c.req.param('memberUserId')?.trim();
  if (!targetUserId) return c.json({ error: 'Thiếu mã thành viên', code: 'VALIDATION_ERROR' }, 400);
  if (!db) return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);

  try {
    const [callerRow, targetRow] = await Promise.all([
      db.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
        .bind(auth.householdId, auth.userId)
        .first<{ role: string }>(),
      db.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
        .bind(auth.householdId, targetUserId)
        .first<{ role: string }>(),
    ]);

    if (!callerRow) return c.json({ error: 'Không có quyền truy cập', code: 'FORBIDDEN' }, 403);
    if (!targetRow) return c.json({ error: 'Thành viên không thuộc hộ gia đình này', code: 'NOT_FOUND' }, 404);

    const isSelfLeave = targetUserId === auth.userId;
    if (!isSelfLeave && callerRow.role !== 'owner') {
      return c.json({ error: 'Chỉ chủ hộ gia đình mới có thể xóa thành viên', code: 'FORBIDDEN' }, 403);
    }
    if (isSelfLeave && targetRow.role === 'owner') {
      const otherOwners = await db
        .prepare("SELECT COUNT(*) AS cnt FROM household_members WHERE household_id = ? AND role = 'owner' AND user_id != ?")
        .bind(auth.householdId, auth.userId)
        .first<{ cnt: number }>();
      if (!otherOwners || otherOwners.cnt === 0) {
        return c.json(
          { error: 'Chủ hộ duy nhất không thể rời khỏi hộ gia đình cá nhân', code: 'CANNOT_LEAVE_AS_SOLE_OWNER' },
          400
        );
      }
    }

    const fallbackHouseholdId = `hh_${targetUserId}`;
    await db.batch([
      db
        .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
        .bind(fallbackHouseholdId, 'Tủ lạnh của tôi', targetUserId),
      db
        .prepare('INSERT OR IGNORE INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)')
        .bind(`hm_${targetUserId}`, fallbackHouseholdId, targetUserId, 'owner'),
      db
        .prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)')
        .bind(`list_${fallbackHouseholdId}`, fallbackHouseholdId, 'Danh sách mua sắm'),
      db
        .prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
        .bind(auth.householdId, targetUserId),
      db
        .prepare('UPDATE sessions_v2 SET household_id = ? WHERE user_id = ? AND household_id = ? AND revoked_at IS NULL')
        .bind(fallbackHouseholdId, targetUserId, auth.householdId),
    ]);

    await ensureHouseholdAdopted(db, { householdId: fallbackHouseholdId, actorId: targetUserId });

    const nextActiveHouseholdId = isSelfLeave ? fallbackHouseholdId : auth.householdId;
    return c.json({
      success: true,
      removedUserId: targetUserId,
      leftHousehold: isSelfLeave,
      householdId: nextActiveHouseholdId,
      activeHouseholdId: nextActiveHouseholdId,
    });
  } catch {
    return c.json({ error: 'Không thể cập nhật thành viên hộ gia đình', code: 'DATABASE_ERROR' }, 500);
  }
});

// 5. POST /api/v1/households/import-guest — Seamless Guest -> Registered Account Transfer
async function loadVerifiedGuestData(db: D1DatabaseBinding, guestSessionToken: string) {
  const tokenHash = await sha256Hex(guestSessionToken);
  const guestSession = await db
    .prepare(
      `SELECT s.user_id, s.household_id
         FROM sessions_v2 s
         JOIN users u ON u.id = s.user_id
         JOIN households h ON h.id = s.household_id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND u.is_guest = 1
          AND h.created_by = s.user_id
        LIMIT 1`
    )
    .bind(tokenHash)
    .first<{ user_id: string; household_id: string }>();

  if (!guestSession) return { items: [], shoppingItems: [] };

  const [invRes, shopRes] = await db.batch([
    db
      .prepare(
        `SELECT id, name, quantity, unit, category, storage, expiry_date, expiry_kind
           FROM inventory_items
          WHERE household_id = ? AND quantity > 0
          LIMIT 100`
      )
      .bind(guestSession.household_id),
    db
      .prepare(
        `SELECT si.id, si.name, si.quantity, si.unit, si.is_checked, si.ingredient_id
           FROM shopping_items si
           JOIN shopping_lists sl ON sl.id = si.list_id
          WHERE sl.household_id = ?
          LIMIT 100`
      )
      .bind(guestSession.household_id),
  ]);

  return {
    items: ((invRes.results ?? []) as Array<{
      id: string; name: string; quantity: number; unit: string; category: string;
      storage: 'fridge' | 'freezer' | 'pantry'; expiry_date: string | null; expiry_kind: string | null;
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      quantity: Number(r.quantity),
      unit: r.unit,
      category: r.category || 'other',
      storage: (['fridge', 'freezer', 'pantry'].includes(r.storage) ? r.storage : 'fridge') as 'fridge' | 'freezer' | 'pantry',
      expiryDate: r.expiry_date,
      expiryEstimated: r.expiry_kind === 'ESTIMATED',
    })),
    shoppingItems: ((shopRes.results ?? []) as Array<{
      id: string; name: string; quantity: number; unit: string; is_checked: number; ingredient_id: string | null;
    }>).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: Number(s.quantity) || 1,
      unit: s.unit || 'piece',
      isChecked: Boolean(s.is_checked),
      ingredientId: s.ingredient_id || undefined,
    })),
  };
}

householdRoutes.post('/households/import-guest', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  if (auth.isGuest) {
    return c.json({ error: 'Vui lòng đăng nhập để nhập dữ liệu phiên khách', code: 'REGISTERED_ACCOUNT_REQUIRED' }, 403);
  }
  if (!db) return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);

  const parsed = ImportGuestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Dữ liệu chuyển từ phiên khách không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    let mergedItems = [...parsed.data.items];
    let mergedShopping = [...parsed.data.shoppingItems];

    if (parsed.data.guestSessionToken) {
      const serverGuest = await loadVerifiedGuestData(db, parsed.data.guestSessionToken);
      const seenItemNames = new Set(mergedItems.map((i) => `${i.name.toLowerCase()}:${i.unit || 'piece'}`));
      for (const item of serverGuest.items) {
        const key = `${item.name.toLowerCase()}:${item.unit || 'piece'}`;
        if (!seenItemNames.has(key)) {
          seenItemNames.add(key);
          mergedItems.push(item);
        }
      }
      const seenShopNames = new Set(mergedShopping.map((s) => s.name.toLowerCase()));
      for (const shop of serverGuest.shoppingItems) {
        if (!seenShopNames.has(shop.name.toLowerCase())) {
          seenShopNames.add(shop.name.toLowerCase());
          mergedShopping.push(shop);
        }
      }
    }

    mergedItems = mergedItems.slice(0, 100);
    mergedShopping = mergedShopping.slice(0, 100);

    if (mergedItems.length === 0 && mergedShopping.length === 0) {
      return c.json({
        success: true,
        importedItemsCount: 0,
        importedInventoryCount: 0,
        importedShoppingCount: 0,
      });
    }

    const now = new Date().toISOString();
    const listRow = await db
      .prepare('SELECT id FROM shopping_lists WHERE household_id = ? LIMIT 1')
      .bind(auth.householdId)
      .first<{ id: string }>();
    const listId = listRow?.id || `list_${auth.householdId}`;

    const shoppingStatements: D1PreparedStatement[] = [
      db.prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)').bind(
        listId,
        auth.householdId,
        'Danh sách mua sắm'
      ),
    ];

    for (const shop of mergedShopping) {
      const shopId = `shop_imp_${crypto.randomUUID()}`;
      const canonical = findCanonicalIngredient(shop.name);
      const ingredientRow = (shop.ingredientId || canonical?.id)
        ? await db.prepare('SELECT id FROM ingredients WHERE id = ?').bind(shop.ingredientId || canonical!.id).first<{ id: string }>()
        : null;
      shoppingStatements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO shopping_items
              (id, list_id, ingredient_id, name, quantity, unit, is_checked)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            shopId,
            listId,
            ingredientRow?.id ?? null,
            shop.name.trim(),
            shop.quantity,
            normalizeUnit(shop.unit),
            shop.isChecked ? 1 : 0
          )
      );
    }

    if (mergedItems.length > 0) {
      const mode = await readInventoryAuthorityMode(db, auth.householdId);
      if (mode === 'native') {
        const scope = { householdId: auth.householdId, actorId: auth.userId };
        const snapshot = await readAdoptedLotSnapshot(db, scope);
        const specs: LotCommandSpec[] = [];
        for (let index = 0; index < mergedItems.length; index++) {
          const item = mergedItems[index];
          const storage = item.storage || 'fridge';
          const location =
            snapshot.locations.find((entry) => entry.isDefault && entry.type.toLowerCase() === storage) ??
            snapshot.locations[0];
          if (!location) throw new LotCommandError('DRIFT_DETECTED');
          const canonical = findCanonicalIngredient(item.name);
          const ingredientRow = canonical?.id
            ? await db.prepare('SELECT id FROM ingredients WHERE id = ?').bind(canonical.id).first<{ id: string }>()
            : null;
          const lotId = `guest_imp_${auth.householdId.slice(-8)}_${Date.now()}_${index}`;
          const expiry = item.expiryEstimated === true
            ? lotExpiryFromEvidence(item.expiryDate ?? null, 'inferred')
            : lotExpiryFromEvidence(item.expiryDate ?? null, item.expiryDate ? 'supplied' : 'absent');
          specs.push({
            clientKey: `guest-import:${auth.householdId}:${item.id || `${item.name}:${index}`}`,
            input: {
              type: 'CREATE',
              lotId,
              ingredientId: ingredientRow?.id ?? null,
              rawName: item.name.trim(),
              quantity: item.quantity,
              unit: normalizeUnit(item.unit),
              displayCategory: item.category || canonical?.category || 'other',
              storageLocationId: location.id,
              expiryAt: expiry.expiryAt,
              estimatedExpiryAt: expiry.estimatedExpiryAt,
              expiryKind: expiry.expiryKind,
              purchasedAt: null,
              openedAt: null,
              purchasePrice: null,
              sourceType: 'MANUAL',
              sourceId: null,
            },
          });
        }
        const composed = await composeInventoryLotCommands(db, scope, specs, now);
        await db.batch([...composed.statements, ...shoppingStatements]);
      } else {
        const legacyStatements: D1PreparedStatement[] = [];
        for (let index = 0; index < mergedItems.length; index++) {
          const item = mergedItems[index];
          const canonical = findCanonicalIngredient(item.name);
          const ingredientRow = canonical?.id
            ? await db.prepare('SELECT id FROM ingredients WHERE id = ?').bind(canonical.id).first<{ id: string }>()
            : null;
          const itemId = `guest_imp_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
          const unit = normalizeUnit(item.unit);
          const expiryDate = item.expiryDate ?? null;
          legacyStatements.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO inventory_items
                  (id, household_id, ingredient_id, name, quantity, unit, category, storage, expiry_date, added_date, freshness, data_source)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
              )
              .bind(
                itemId,
                auth.householdId,
                ingredientRow?.id ?? null,
                item.name.trim(),
                item.quantity,
                unit,
                item.category || canonical?.category || 'other',
                item.storage || 'fridge',
                expiryDate,
                now,
                computeFreshness(expiryDate ?? undefined)
              ),
            db
              .prepare(
                `INSERT INTO inventory_events
                  (id, household_id, inventory_item_id, event_type, quantity_delta, unit, reason, metadata)
                 VALUES (?, ?, ?, 'ADD', ?, ?, 'Nhập từ phiên khách', ?)`
              )
              .bind(
                `evt_${itemId}`,
                auth.householdId,
                itemId,
                item.quantity,
                unit,
                JSON.stringify({ source: 'guest_import' })
              )
          );
        }
        await runLegacyInventoryBatch(db, auth.householdId, [...legacyStatements, ...shoppingStatements]);
      }
    } else if (shoppingStatements.length > 0) {
      await db.batch(shoppingStatements);
    }

    if (c.env.CACHE) await c.env.CACHE.delete(`inv_${auth.householdId}`).catch(() => {});
    const inventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, c.env.CACHE, {
      strict: true,
      actorId: auth.userId,
    });

    return c.json({
      success: true,
      importedItemsCount: mergedItems.length,
      importedInventoryCount: mergedItems.length,
      importedShoppingCount: mergedShopping.length,
      inventory,
    });
  } catch (error) {
    if (error instanceof LotCommandError) {
      const failure = inventoryAuthorityFailure(error);
      return c.json({ error: error.message, code: failure.code }, failure.status);
    }
    return c.json({ error: 'Không thể nhập dữ liệu phiên khách', code: 'DATABASE_ERROR' }, 500);
  }
});
