import { Hono } from 'hono';
import type { AuthContext, Env } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { negotiateEdgeLocaleContext } from '../middleware/locale';
import {
  BarcodeValidationError,
  lookupBarcodeProduct,
} from '../services/barcode-lookup';

export const barcodeRoutes = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

barcodeRoutes.get(
  '/barcodes/:code',
  tenancyGuard,
  rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_barcode' }),
  async (c) => {
    const auth = c.get('auth');
    const code = c.req.param('code') ?? '';
    const edgeLocale = negotiateEdgeLocaleContext(c.req).locale;
    const locale = auth.locale ?? edgeLocale;

    try {
      const result = await lookupBarcodeProduct(c.env.DB, code, {
        locale,
        offBaseUrl: c.env.BARCODE_OFF_BASE_URL,
      });
      if (!result.found) {
        return c.json(
          {
            found: false,
            cached: false,
            barcode: result.barcode,
            symbology: result.symbology,
            code: 'BARCODE_NOT_FOUND',
          },
          404,
        );
      }
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof BarcodeValidationError) {
        return c.json({ error: error.message, code: error.code }, 400);
      }
      return c.json(
        { error: 'Barcode lookup unavailable', code: 'BARCODE_LOOKUP_UNAVAILABLE' },
        503,
      );
    }
  },
);
