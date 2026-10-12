import { Context, Next } from 'hono';
import { Env, AuthContext } from '../types';

/** Verifies current household membership before a household handler runs. */
export async function tenancyGuard(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (!auth || !auth.userId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }

  // Anonymous catalog reads and development guest tokens have no persisted session.
  if (auth.isGuest && !auth.sessionId) {
    return await next();
  }

  if (!auth.householdId) {
    return c.json({ error: 'Unauthorized: Household context is missing', code: 'UNAUTHORIZED' }, 401);
  }

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    const membership = await db
      .prepare(`SELECT hm.role
        FROM household_members hm JOIN households h ON h.id = hm.household_id
        WHERE hm.household_id = ? AND hm.user_id = ?
          AND (? = 0 OR h.created_by = ?)
        LIMIT 1`)
      .bind(auth.householdId, auth.userId, auth.isGuest ? 1 : 0, auth.userId)
      .first<{ role: string }>();

    if (!membership) {
      return c.json(
        {
          error: 'Forbidden: You do not have permission to access this household data',
          code: 'TENANCY_VIOLATION',
        },
        403
      );
    }
  } catch {
    console.error(JSON.stringify({ event: 'tenancy_check_failed' }));
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  await next();
}
