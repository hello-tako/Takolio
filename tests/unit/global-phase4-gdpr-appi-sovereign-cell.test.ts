import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  canonicalOriginForCell,
  residencyTierForCell,
  resolveConfiguredCell,
  resolveTargetCellForCountry,
} from '../../src/worker/middleware/sovereign-cell';
import {
  computeTaxRetentionUntilIso,
  computeTaxRetentionYears,
} from '../../src/worker/services/privacy-compliance';

function parseJsonc(raw: string): Record<string, any> {
  const withoutComments = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return JSON.parse(withoutComments);
}

describe('Global Phase 4 — EU Sovereign Cell (`jurisdiction: "eu"`), Cross-Cell Routing & Tax Retention Horizons', () => {
  it('enforces Cloudflare D1 & R2 `jurisdiction: "eu"` and disables Meta Llama-3.2 Vision in wrangler.eu.jsonc', () => {
    const euCfg = parseJsonc(readFileSync('wrangler.eu.jsonc', 'utf8'));
    expect(euCfg.name).toBe('frigo-eu');
    expect(euCfg.d1_databases[0].jurisdiction).toBe('eu');
    expect(euCfg.r2_buckets[0].jurisdiction).toBe('eu');
    expect(euCfg.vars.CELL_REGION).toBe('EU');
    expect(euCfg.vars.AI_JURISDICTION).toBe('EU');
    expect(euCfg.vars.ENFORCE_CELL_SOVEREIGNTY).toBe('true');
    expect(euCfg.vars.CLOUDFLARE_VISION_FALLBACK).toBe('false');
    expect(euCfg.vars.GOOGLE_JWKS_VERIFY_ENABLED).toBe('true');

    const jpCfg = parseJsonc(readFileSync('wrangler.jp.jsonc', 'utf8'));
    expect(jpCfg.name).toBe('frigo-jp');
    expect(jpCfg.vars.CELL_REGION).toBe('JP');
    expect(jpCfg.vars.AI_JURISDICTION).toBe('JP');
    expect(jpCfg.vars.DEFAULT_MARKET_COUNTRY).toBe('JP');
  });

  it('routes EEA + UK + Switzerland to the EU Sovereign Cell and Japan/APAC to the JP Cell', () => {
    for (const cc of ['DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'SE', 'NO', 'IS', 'GB', 'CH']) {
      expect(resolveTargetCellForCountry(cc)).toBe('EU');
    }
    for (const cc of ['JP', 'KR', 'SG', 'TW', 'AU']) {
      expect(resolveTargetCellForCountry(cc)).toBe('JP');
    }
    expect(resolveTargetCellForCountry('VN')).toBe('VN');
    expect(resolveTargetCellForCountry('US')).toBe('GLOBAL');

    expect(residencyTierForCell('EU')).toBe('eu-sovereign');
    expect(residencyTierForCell('JP')).toBe('apac-jp');
    expect(resolveConfiguredCell({ CELL_REGION: 'EU' })).toBe('EU');
    expect(canonicalOriginForCell('EU')).toBe('https://eu.takolio.com');
    expect(canonicalOriginForCell('JP')).toBe('https://jp.takolio.com');
  });

  it('computes 10-year tax retention for EEA/UK/CH (German AO §147) and 7-year retention for Japan NTA', () => {
    expect(computeTaxRetentionYears('DE')).toBe(10);
    expect(computeTaxRetentionYears('FR')).toBe(10);
    expect(computeTaxRetentionYears('GB')).toBe(10);
    expect(computeTaxRetentionYears('CH')).toBe(10);
    expect(computeTaxRetentionYears('JP')).toBe(7);
    expect(computeTaxRetentionYears('VN')).toBe(7);

    expect(computeTaxRetentionUntilIso('2026-11-22T00:00:00.000Z', 'DE')).toBe('2036-11-22T00:00:00.000Z');
    expect(computeTaxRetentionUntilIso('2026-11-22T00:00:00.000Z', 'JP')).toBe('2033-11-22T00:00:00.000Z');
  });
});
