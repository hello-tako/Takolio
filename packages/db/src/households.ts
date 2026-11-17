import type { D1DatabaseBinding } from './index';

export interface PrimaryHouseholdMembership {
  householdId: string;
  role: 'owner' | 'member';
  existed: boolean;
}

/**
 * Resolves the user's active household across logins, OAuth, and password resets.
 * Shared family households joined via invite ('member') take priority over the auto-created
 * personal fallback household (`hh_<userId>`), then oldest membership (`created_at ASC`).
 */
export async function resolvePrimaryHousehold(
  db: D1DatabaseBinding,
  userId: string,
): Promise<PrimaryHouseholdMembership> {
  const row = await db
    .prepare(
      `SELECT hm.household_id, hm.role
       FROM household_members hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = ?
       ORDER BY CASE WHEN hm.role = 'member' THEN 0 ELSE 1 END, hm.created_at ASC
       LIMIT 1`
    )
    .bind(userId)
    .first<{ household_id: string; role: string }>();

  if (row?.household_id) {
    return {
      householdId: row.household_id,
      role: row.role === 'owner' ? 'owner' : 'member',
      existed: true,
    };
  }

  return {
    householdId: `hh_${userId}`,
    role: 'owner',
    existed: false,
  };
}
