import type { Context, Next } from 'hono';
import { openD1Session, type D1DatabaseBinding } from '@frigo/db';
import {
  GlobalCurrencySchema,
  isValidIanaTimeZone,
  matchSupportedLocale,
  negotiateAcceptLanguage,
  resolveMarketDefaults,
  type GlobalCurrency,
  type SupportedLocale,
  type WeekStartDay,
} from '../../../packages/domain/src/i18n';
import type { AuthContext, Env, RequestLocaleContext } from '../types';

export const D1_BOOKMARK_HEADER = 'X-D1-Bookmark';
export const TAKOLIO_LOCALE_HEADER = 'X-Takolio-Locale';
export const TAKOLIO_TIMEZONE_HEADER = 'X-Takolio-Timezone';
export const TAKOLIO_COUNTRY_HEADER = 'X-Takolio-Country';

interface CfPropertiesLike {
  country?: unknown;
  timezone?: unknown;
}

function readCfGeo(rawRequest: Request): { country: string | null; timeZone: string | null } {
  const cf = (rawRequest as Request & { cf?: CfPropertiesLike }).cf;
  const rawCountry = typeof cf?.country === 'string' ? cf.country.trim().toUpperCase() : null;
  const country =
    rawCountry && /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== 'XX' && rawCountry !== 'T1'
      ? rawCountry
      : null;
  const timeZone =
    typeof cf?.timezone === 'string' && isValidIanaTimeZone(cf.timezone)
      ? cf.timezone.trim()
      : null;
  return { country, timeZone };
}

/**
 * Resolves the stateless edge locale/market context from headers and Cloudflare Geo signals.
 * Authenticated routes can further refine this with stored user/household preferences via
 * `resolveEffectiveLocaleContext`.
 */
export function negotiateEdgeLocaleContext(
  req: {
    header(name: string): string | undefined;
    raw: Request;
  },
  env?: Pick<Env, 'DEFAULT_MARKET_COUNTRY'>,
): RequestLocaleContext {
  const explicitLocale = matchSupportedLocale(req.header(TAKOLIO_LOCALE_HEADER));
  const acceptLocale = negotiateAcceptLanguage(req.header('Accept-Language'));
  const cfGeo = readCfGeo(req.raw);
  const headerCountryRaw =
    req.header(TAKOLIO_COUNTRY_HEADER)?.trim().toUpperCase() ||
    req.header('CF-IPCountry')?.trim().toUpperCase() ||
    null;
  const validHeaderCountry =
    headerCountryRaw &&
    /^[A-Z]{2}$/.test(headerCountryRaw) &&
    headerCountryRaw !== 'XX' &&
    headerCountryRaw !== 'T1'
      ? headerCountryRaw
      : null;

  const countryHint =
    validHeaderCountry ??
    cfGeo.country ??
    (env?.DEFAULT_MARKET_COUNTRY?.trim().toUpperCase() || null);

  const chosenLocale = explicitLocale ?? acceptLocale;
  const market = resolveMarketDefaults(countryHint, chosenLocale);

  const headerTz = req.header(TAKOLIO_TIMEZONE_HEADER)?.trim();
  const timeZone =
    headerTz && isValidIanaTimeZone(headerTz)
      ? headerTz
      : cfGeo.timeZone ?? market.timeZone;

  const source: RequestLocaleContext['source'] = explicitLocale
    ? 'header'
    : acceptLocale
      ? 'accept_language'
      : validHeaderCountry || cfGeo.country
        ? 'cf_geo'
        : 'default';

  return {
    locale: market.locale,
    countryCode: market.countryCode,
    currency: market.currency,
    timeZone,
    weekStartDay: market.weekStartDay,
    source,
  };
}

interface StoredPreferenceRow {
  locale?: string | null;
  language?: string | null;
  country_code?: string | null;
  currency?: string | null;
  timezone?: string | null;
  week_start_day?: number | null;
  h_locale?: string | null;
  h_country_code?: string | null;
  h_currency?: string | null;
  h_timezone?: string | null;
  h_week_start_day?: number | null;
}

/**
 * Loads user & household regional settings from D1 (when post-0048 columns are present)
 * and merges them over the edge-negotiated RequestLocaleContext.
 */
export async function resolveEffectiveLocaleContext(
  db: D1DatabaseBinding | undefined,
  auth: Pick<AuthContext, 'userId' | 'householdId'> | undefined,
  edgeContext: RequestLocaleContext,
): Promise<RequestLocaleContext> {
  if (!db || !auth?.userId || auth.userId === 'guest_anonymous') {
    return edgeContext;
  }
  try {
    const row = await db
      .prepare(
        `SELECT up.locale, up.language, up.country_code, up.currency, up.timezone, up.week_start_day,
                h.locale AS h_locale, h.country_code AS h_country_code, h.currency AS h_currency,
                h.timezone AS h_timezone, h.week_start_day AS h_week_start_day
           FROM users u
           LEFT JOIN user_preferences up ON up.user_id = u.id
           LEFT JOIN households h ON h.id = ?
          WHERE u.id = ?
          LIMIT 1`,
      )
      .bind(auth.householdId || '', auth.userId)
      .first<StoredPreferenceRow>();

    if (!row) return edgeContext;

    const storedLocale: SupportedLocale | null =
      matchSupportedLocale(row.locale) ??
      matchSupportedLocale(row.language) ??
      matchSupportedLocale(row.h_locale);

    // If the client explicitly sent `X-Takolio-Locale`, let it override for previewing; otherwise stored wins.
    const locale =
      edgeContext.source === 'header'
        ? edgeContext.locale
        : storedLocale ?? edgeContext.locale;

    const rawCountry = (row.country_code ?? row.h_country_code)?.trim().toUpperCase();
    const countryCode =
      rawCountry && /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : edgeContext.countryCode;

    const market = resolveMarketDefaults(countryCode, locale);

    const parsedUserCurrency = GlobalCurrencySchema.safeParse(row.currency?.trim().toUpperCase());
    const parsedHouseCurrency = GlobalCurrencySchema.safeParse(row.h_currency?.trim().toUpperCase());
    const currency: GlobalCurrency = parsedUserCurrency.success
      ? parsedUserCurrency.data
      : parsedHouseCurrency.success
        ? parsedHouseCurrency.data
        : market.currency;

    const timeZone =
      row.timezone && isValidIanaTimeZone(row.timezone)
        ? row.timezone
        : row.h_timezone && isValidIanaTimeZone(row.h_timezone)
          ? row.h_timezone
          : edgeContext.source !== 'default'
            ? edgeContext.timeZone
            : market.timeZone;

    const rawWeekStart = row.week_start_day ?? row.h_week_start_day;
    const weekStartDay: WeekStartDay =
      rawWeekStart === 0 || rawWeekStart === 1 ? rawWeekStart : market.weekStartDay;

    return {
      locale,
      countryCode,
      currency,
      timeZone,
      weekStartDay,
      source: storedLocale ? 'user_preference' : edgeContext.source,
    };
  } catch {
    // Graceful fallback on pre-0048 historical schema snapshots in migration tests.
    return edgeContext;
  }
}

export async function requestLocaleAndD1SessionMiddleware(
  c: Context<{
    Bindings: Env;
    Variables: {
      auth: AuthContext;
      localeContext: RequestLocaleContext;
      d1Database?: D1DatabaseBinding;
    };
  }>,
  next: Next,
) {
  const edgeLocale = negotiateEdgeLocaleContext(c.req, c.env);
  c.set('localeContext', edgeLocale);

  // Open a D1 Read-Replication session if native Cloudflare D1 `withSession` is available.
  const incomingBookmark = c.req.header(D1_BOOKMARK_HEADER);
  const defaultConstraint =
    c.req.method === 'GET' || c.req.method === 'HEAD' ? 'first-unconstrained' : 'first-primary';
  const session = openD1Session(c.env.DB, {
    bookmark: incomingBookmark,
    defaultConstraint,
  });

  if (session?.isNativeSession) {
    c.set('d1Database', session.db);
  }

  await next();

  if (c.req.path.startsWith('/api/')) {
    const resolved = c.get('localeContext') ?? edgeLocale;
    if (!c.res.headers.has('Content-Language')) {
      c.header('Content-Language', resolved.locale);
    }
  }

  if (session?.isNativeSession) {
    const updatedBookmark = session.getBookmark();
    if (updatedBookmark) {
      c.header(D1_BOOKMARK_HEADER, updatedBookmark);
      const existingExpose = c.res.headers.get('Access-Control-Expose-Headers');
      if (existingExpose && !existingExpose.toLowerCase().includes('x-d1-bookmark')) {
        c.header('Access-Control-Expose-Headers', `${existingExpose}, ${D1_BOOKMARK_HEADER}`);
      }
    }
  }
}
