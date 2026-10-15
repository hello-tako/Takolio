import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { SaveFamilyPreferencesSchema } from '../../../packages/domain/src/family-preferences-api';
import { FamilyPreferenceError, readFamilyPreferences, saveFamilyPreferences } from '../../../packages/db/src/family-preferences';
import type { Env, AuthContext } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';

export const familyPreferencesRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
familyPreferencesRoutes.use('/family-preferences', tenancyGuard);
familyPreferencesRoutes.use('/family-preferences', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
familyPreferencesRoutes.use('/family-preferences', bodyLimit({ maxSize: 16_384 }));
familyPreferencesRoutes.use('/family-preferences', rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'family-preferences' }));
familyPreferencesRoutes.get('/family-preferences', async (c) => {
  const auth = c.get('auth');
  if (!c.env.DB) return c.json({ code: 'DATABASE_UNAVAILABLE' }, 503);
  try { return c.json(await readFamilyPreferences(c.env.DB, auth)); }
  catch (error) {
    if (error instanceof FamilyPreferenceError) return c.json({ code: error.code }, error.status);
    return c.json({ code: 'DATABASE_UNAVAILABLE' }, 503);
  }
});
familyPreferencesRoutes.put('/family-preferences', async (c) => {
  const parsed = SaveFamilyPreferencesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: 'VALIDATION_ERROR', error: 'Sở thích chưa hợp lệ.' }, 422);
  if (!c.env.DB) return c.json({ code: 'DATABASE_UNAVAILABLE' }, 503);
  try { return c.json(await saveFamilyPreferences(c.env.DB, c.get('auth'), parsed.data)); }
  catch (error) {
    if (error instanceof FamilyPreferenceError) return c.json({ code: error.code,
      error: error.code === 'REVISION_CONFLICT' ? 'Sở thích đã thay đổi. Hãy tải lại trước khi lưu.' : 'Không có quyền cập nhật.' }, error.status);
    return c.json({ code: 'DATABASE_UNAVAILABLE', error: 'Chưa lưu được sở thích. Vui lòng thử lại.' }, 503);
  }
});
