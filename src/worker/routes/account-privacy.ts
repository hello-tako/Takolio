import { Hono } from 'hono';
import { z } from 'zod';
import { negotiateEdgeLocaleContext, resolveEffectiveLocaleContext } from '../middleware/locale';
import { rateLimiter } from '../middleware/rate-limit';
import {
  canonicalOriginForCell,
  residencyTierForCell,
  resolveConfiguredCell,
  resolveTargetCellForCountry,
} from '../middleware/sovereign-cell';
import {
  buildUserDataPortabilityExport,
  CONSENT_TYPES,
  executeTwoPhaseAccountErasure,
  listUserConsents,
  recordUserConsent,
} from '../services/privacy-compliance';
import type { AuthContext, Env } from '../types';
import { SESSION_COOKIE } from '../utils/session';

export const accountPrivacyRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const ConsentWriteSchema = z.object({
  consentType: z.enum(CONSENT_TYPES),
  policyVersion: z.string().trim().min(1).max(64),
  granted: z.boolean(),
});

const AccountErasureConfirmSchema = z.object({
  confirm: z.literal('DELETE_MY_ACCOUNT'),
});

accountPrivacyRoutes.use('/account/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  if (!auth?.userId || auth.isGuest) {
    return c.json({ error: 'Authenticated registered account required', code: 'UNAUTHORIZED' }, 401);
  }
  if (!c.env.DB) {
    return c.json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  return next();
});

accountPrivacyRoutes.use('/account', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  if (!auth?.userId || auth.isGuest) {
    return c.json({ error: 'Authenticated registered account required', code: 'UNAUTHORIZED' }, 401);
  }
  if (!c.env.DB) {
    return c.json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  return next();
});

// 1. Sovereign Data Residency Status (`GET /api/v1/account/residency`)
accountPrivacyRoutes.get('/account/residency', async (c) => {
  const auth = c.get('auth');
  const localeCtx = await resolveEffectiveLocaleContext(
    c.env.DB,
    auth,
    negotiateEdgeLocaleContext(c.req, c.env),
  );
  const activeCell = resolveConfiguredCell(c.env);
  const recommendedCell = resolveTargetCellForCountry(localeCtx.countryCode);

  return c.json({
    activeCell,
    residencyTier: residencyTierForCell(activeCell),
    recommendedCell,
    recommendedOrigin: canonicalOriginForCell(recommendedCell, c.env),
    countryCode: localeCtx.countryCode,
    sovereigntyEnforced: c.env.ENFORCE_CELL_SOVEREIGNTY === 'true',
  });
});

// 2. Consent Ledger Read (`GET /api/v1/account/consents` — GDPR Art. 7 / APPI Art. 28)
accountPrivacyRoutes.get('/account/consents', async (c) => {
  const userId = c.get('auth').userId;
  const consents = await listUserConsents(c.env.DB, userId);
  return c.json(consents);
});

// 3. Consent Ledger Write (`POST /api/v1/account/consents`)
accountPrivacyRoutes.post(
  '/account/consents',
  rateLimiter({ maxRequests: 20, windowSeconds: 60, prefix: 'rl_account_consent' }),
  async (c) => {
    const parsed = ConsentWriteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'Invalid consent payload', code: 'INVALID_CONSENT_PAYLOAD' }, 400);
    }

    const auth = c.get('auth');
    const localeCtx = await resolveEffectiveLocaleContext(
      c.env.DB,
      auth,
      negotiateEdgeLocaleContext(c.req, c.env),
    );
    const jurisdiction = resolveTargetCellForCountry(localeCtx.countryCode);

    const record = await recordUserConsent(c.env.DB, {
      userId: auth.userId,
      consentType: parsed.data.consentType,
      policyVersion: parsed.data.policyVersion,
      granted: parsed.data.granted,
      jurisdiction,
    });

    return c.json({ success: true, consent: record }, 201);
  },
);

// 4. GDPR Art. 20 Right to Data Portability / APPI Art. 33 Personal Data Export (`GET /api/v1/account/export`)
accountPrivacyRoutes.get(
  '/account/export',
  rateLimiter({ maxRequests: 5, windowSeconds: 300, prefix: 'rl_account_export' }),
  async (c) => {
    const auth = c.get('auth');
    const localeCtx = await resolveEffectiveLocaleContext(
      c.env.DB,
      auth,
      negotiateEdgeLocaleContext(c.req, c.env),
    );
    const jurisdiction = resolveTargetCellForCountry(localeCtx.countryCode);

    const bundle = await buildUserDataPortabilityExport(c.env.DB, auth.userId, jurisdiction);
    c.header('Content-Disposition', 'attachment; filename="takolio-personal-data-export.json"');
    return c.json(bundle);
  },
);

// 5. GDPR Art. 17 / APPI Art. 35 / Apple 5.1.1(v) Two-Phase Account Erasure (`DELETE /api/v1/account`)
accountPrivacyRoutes.delete(
  '/account',
  rateLimiter({ maxRequests: 3, windowSeconds: 300, prefix: 'rl_account_delete', enforcement: 'fail-closed' }),
  async (c) => {
    const parsed = AccountErasureConfirmSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: 'Explicit confirmation {"confirm": "DELETE_MY_ACCOUNT"} is required.',
          code: 'ERASURE_CONFIRMATION_REQUIRED',
        },
        400,
      );
    }

    const auth = c.get('auth');
    const localeCtx = await resolveEffectiveLocaleContext(
      c.env.DB,
      auth,
      negotiateEdgeLocaleContext(c.req, c.env),
    );
    const jurisdiction = resolveTargetCellForCountry(localeCtx.countryCode);

    const result = await executeTwoPhaseAccountErasure(
      c.env.DB,
      c.env.IMAGES,
      auth.userId,
      jurisdiction,
    );

    // Expire authoritative session cookie immediately
    c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

    return c.json({
      success: true,
      erasure: result,
    });
  },
);
