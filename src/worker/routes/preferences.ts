import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { Env, AuthContext } from '../types';
import { SQL } from '@frigo/db';
import {
  CountryCodeSchema,
  GlobalCurrencySchema,
  IanaTimeZoneSchema,
  SupportedLocaleSchema,
  WeekStartDaySchema,
  resolveMarketDefaults,
} from '../../../packages/domain/src/i18n';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rate-limit';

export const preferencesRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

preferencesRoutes.use(
  '/preferences',
  bodyLimit({
    maxSize: 16_384,
    onError: (c) => c.json({ error: 'Dữ liệu tùy chọn quá lớn', code: 'PAYLOAD_TOO_LARGE' }, 413),
  })
);
preferencesRoutes.use(
  '/preferences',
  rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_preferences' })
);

const DEFAULT_PREFERENCES = {
  householdSize: 2,
  spicyLevel: 'medium',
  favoriteCuisines: ['vietnamese'],
  dietaryRestrictions: [],
  language: 'vi',
};

const PreferencesPatchSchema = z.object({
  householdSize: z.coerce.number().int().min(1).max(20).optional(),
  spicyLevel: z.enum(['none', 'mild', 'medium', 'hot']).optional(),
  favoriteCuisines: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  language: SupportedLocaleSchema.optional(),
  locale: SupportedLocaleSchema.optional(),
  countryCode: CountryCodeSchema.nullable().optional(),
  currency: GlobalCurrencySchema.nullable().optional(),
  timeZone: IanaTimeZoneSchema.nullable().optional(),
  weekStartDay: WeekStartDaySchema.nullable().optional(),
  completeOnboarding: z.boolean().optional(),
});

function formatPreferencesResponse(pref: Record<string, any>) {
  const language = pref.language ?? pref.locale ?? 'vi';
  const locale = pref.locale ?? language;
  const countryCode = pref.country_code ?? null;
  const currency = pref.currency ?? null;
  const timeZone = pref.timezone ?? null;
  const weekStartDay =
    pref.week_start_day === 0 || pref.week_start_day === 1 ? pref.week_start_day : null;
  const hasRegionalOverrides =
    countryCode !== null ||
    currency !== null ||
    timeZone !== null ||
    weekStartDay !== null ||
    (pref.locale && pref.locale !== language);

  return {
    householdSize: pref.household_size,
    spicyLevel: pref.spicy_level,
    favoriteCuisines:
      typeof pref.favorite_cuisines === 'string'
        ? JSON.parse(pref.favorite_cuisines)
        : pref.favorite_cuisines,
    dietaryRestrictions:
      typeof pref.dietary_restrictions === 'string'
        ? JSON.parse(pref.dietary_restrictions)
        : pref.dietary_restrictions,
    language,
    ...(hasRegionalOverrides
      ? {
          locale,
          countryCode,
          currency,
          timeZone,
          weekStartDay,
        }
      : {}),
  };
}

// GET /api/v1/preferences
preferencesRoutes.get('/preferences', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (db) {
    try {
      const pref = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>();
      if (pref) {
        return c.json({
          preferences: formatPreferencesResponse(pref),
        });
      }
    } catch (err) {
      console.error('Failed querying user_preferences from D1:');
    }
  }

  return c.json({ preferences: DEFAULT_PREFERENCES });
});

// PATCH /api/v1/preferences
preferencesRoutes.patch('/preferences', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  const parsed = PreferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Tùy chọn không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const existing = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>();

    const patch = parsed.data;
    const householdSize = patch.householdSize ?? existing?.household_size ?? 2;
    const spicyLevel = patch.spicyLevel ?? existing?.spicy_level ?? 'medium';
    const favoriteCuisines = patch.favoriteCuisines ?? (existing?.favorite_cuisines ? JSON.parse(existing.favorite_cuisines) : ['vietnamese']);
    const dietaryRestrictions = patch.dietaryRestrictions ?? (existing?.dietary_restrictions ? JSON.parse(existing.dietary_restrictions) : []);
    const language = patch.language ?? patch.locale ?? existing?.language ?? 'vi';
    const locale = patch.locale ?? patch.language ?? existing?.locale ?? language;
    const countryCode =
      patch.countryCode !== undefined ? patch.countryCode : (existing?.country_code ?? null);
    const currency =
      patch.currency !== undefined ? patch.currency : (existing?.currency ?? null);
    const timeZone =
      patch.timeZone !== undefined ? patch.timeZone : (existing?.timezone ?? null);
    const weekStartDay =
      patch.weekStartDay !== undefined
        ? patch.weekStartDay
        : existing?.week_start_day === 0 || existing?.week_start_day === 1
          ? existing.week_start_day
          : null;

    const hasPost0048Columns = existing !== null && existing !== undefined
      ? Object.prototype.hasOwnProperty.call(existing, 'locale')
      : true;

    const buildStatements = (withGlobalColumns: boolean) => {
      const statements = [
        withGlobalColumns
          ? db.prepare(
              `INSERT INTO user_preferences (
                 id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions,
                 language, locale, country_code, currency, timezone, week_start_day, updated_at
               )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(user_id) DO UPDATE SET
                 household_size = excluded.household_size,
                 spicy_level = excluded.spicy_level,
                 favorite_cuisines = excluded.favorite_cuisines,
                 dietary_restrictions = excluded.dietary_restrictions,
                 language = excluded.language,
                 locale = excluded.locale,
                 country_code = excluded.country_code,
                 currency = excluded.currency,
                 timezone = excluded.timezone,
                 week_start_day = excluded.week_start_day,
                 updated_at = datetime('now')`
            ).bind(
              `pref_${auth.userId}`,
              auth.userId,
              householdSize,
              spicyLevel,
              JSON.stringify(favoriteCuisines),
              JSON.stringify(dietaryRestrictions),
              language,
              locale,
              countryCode,
              currency,
              timeZone,
              weekStartDay,
            )
          : db.prepare(
              `INSERT INTO user_preferences (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions, language, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(user_id) DO UPDATE SET
                 household_size = excluded.household_size,
                 spicy_level = excluded.spicy_level,
                 favorite_cuisines = excluded.favorite_cuisines,
                 dietary_restrictions = excluded.dietary_restrictions,
                 language = excluded.language,
                 updated_at = datetime('now')`
            ).bind(
              `pref_${auth.userId}`,
              auth.userId,
              householdSize,
              spicyLevel,
              JSON.stringify(favoriteCuisines),
              JSON.stringify(dietaryRestrictions),
              language,
            ),
      ];

      if (
        withGlobalColumns &&
        auth.householdId &&
        (patch.locale !== undefined ||
          patch.language !== undefined ||
          patch.countryCode !== undefined ||
          patch.currency !== undefined ||
          patch.timeZone !== undefined ||
          patch.weekStartDay !== undefined)
      ) {
        const market = resolveMarketDefaults(countryCode, locale);
        statements.push(
          db.prepare(
            `UPDATE households
                SET locale = ?,
                    country_code = COALESCE(?, country_code),
                    currency = ?,
                    timezone = ?,
                    week_start_day = ?
              WHERE id = ? AND created_by = ?`
          ).bind(
            locale,
            countryCode,
            currency ?? market.currency,
            timeZone ?? market.timeZone,
            weekStartDay ?? market.weekStartDay,
            auth.householdId,
            auth.userId,
          ),
        );
      }

      if (patch.completeOnboarding) {
        statements.push(
          db.prepare(
            "UPDATE profiles SET onboarding_completed_at = COALESCE(onboarding_completed_at, datetime('now')), updated_at = datetime('now') WHERE user_id = ?"
          ).bind(auth.userId),
        );
      }
      return statements;
    };

    let results: Awaited<ReturnType<typeof db.batch>>;
    try {
      results = await db.batch(buildStatements(hasPost0048Columns));
    } catch (err) {
      if (hasPost0048Columns && /no such column/i.test(String((err as Error)?.message ?? err))) {
        results = await db.batch(buildStatements(false));
      } else {
        throw err;
      }
    }

    if (patch.completeOnboarding && results.at(-1)?.meta?.changes !== 1) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    const updated = formatPreferencesResponse({
      household_size: householdSize,
      spicy_level: spicyLevel,
      favorite_cuisines: favoriteCuisines,
      dietary_restrictions: dietaryRestrictions,
      language,
      locale: patch.locale !== undefined ? locale : language,
      country_code: countryCode,
      currency,
      timezone: timeZone,
      week_start_day: weekStartDay,
    });

    return c.json({
      success: true,
      preferences: updated,
      onboardingCompleted: patch.completeOnboarding ? true : undefined,
    });
  } catch (err) {
    console.error('Failed saving user_preferences to D1:');
    return c.json({ error: 'Lỗi cập nhật tùy chọn người dùng', code: 'DATABASE_ERROR' }, 500);
  }
});
