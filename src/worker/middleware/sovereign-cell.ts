import type { Context, Next } from 'hono';
import type { Env } from '../types';

export type SovereignCellId = 'EU' | 'JP' | 'VN' | 'GLOBAL';

export const TAKOLIO_CELL_HEADER = 'X-Takolio-Cell';
export const TAKOLIO_RESIDENCY_HEADER = 'X-Takolio-Data-Residency';
export const TAKOLIO_REQUIRED_CELL_HEADER = 'X-Takolio-Required-Cell';

const EUROPEAN_RESIDENCY_COUNTRIES = new Set<string>([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

const JAPAN_APAC_COUNTRIES = new Set<string>(['JP', 'KR', 'TW', 'SG', 'HK', 'AU', 'NZ']);

export function resolveTargetCellForCountry(countryCode: string | null | undefined): SovereignCellId {
  const cc = (countryCode || '').trim().toUpperCase();
  if (EUROPEAN_RESIDENCY_COUNTRIES.has(cc)) return 'EU';
  if (cc === 'VN') return 'VN';
  if (JAPAN_APAC_COUNTRIES.has(cc)) return 'JP';
  return 'GLOBAL';
}

export function resolveConfiguredCell(env: Pick<Env, 'CELL_REGION' | 'AI_JURISDICTION'>): SovereignCellId {
  const raw = (env.CELL_REGION || env.AI_JURISDICTION || 'GLOBAL').trim().toUpperCase();
  if (raw === 'EU' || raw === 'JP' || raw === 'VN') return raw;
  return 'GLOBAL';
}

export function residencyTierForCell(cell: SovereignCellId): 'eu-sovereign' | 'apac-jp' | 'apac-vn' | 'global' {
  if (cell === 'EU') return 'eu-sovereign';
  if (cell === 'JP') return 'apac-jp';
  if (cell === 'VN') return 'apac-vn';
  return 'global';
}

export function canonicalOriginForCell(cell: SovereignCellId, env: Pick<Env, 'EU_CELL_URL' | 'JP_CELL_URL' | 'APP_URL'> = {}): string {
  if (cell === 'EU') return (env.EU_CELL_URL || 'https://eu.takolio.com').replace(/\/+$/, '');
  if (cell === 'JP') return (env.JP_CELL_URL || 'https://jp.takolio.com').replace(/\/+$/, '');
  return (env.APP_URL || 'https://app.takolio.com').replace(/\/+$/, '');
}

/**
 * Attaches sovereign cell residency headers and enforces cross-cell isolation when
 * `ENFORCE_CELL_SOVEREIGNTY=true` and a client presents a mismatched `X-Takolio-Required-Cell`
 * (preventing accidental write/read routing of EU sovereign accounts onto a non-EU D1/R2 cell).
 */
export async function sovereignCellMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const activeCell = resolveConfiguredCell(c.env);
  c.header(TAKOLIO_CELL_HEADER, activeCell);
  c.header(TAKOLIO_RESIDENCY_HEADER, residencyTierForCell(activeCell));

  const requiredCellRaw = c.req.header(TAKOLIO_REQUIRED_CELL_HEADER)?.trim().toUpperCase();
  if (
    c.env.ENFORCE_CELL_SOVEREIGNTY === 'true' &&
    requiredCellRaw &&
    ['EU', 'JP', 'VN', 'GLOBAL'].includes(requiredCellRaw) &&
    requiredCellRaw !== activeCell
  ) {
    const targetCell = requiredCellRaw as SovereignCellId;
    return c.json(
      {
        error: `Request requires sovereign cell ${targetCell}, but reached cell ${activeCell}.`,
        code: 'MISDIRECTED_SOVEREIGN_CELL',
        activeCell,
        requiredCell: targetCell,
        redirectOrigin: canonicalOriginForCell(targetCell, c.env),
      },
      421,
    );
  }

  return next();
}
