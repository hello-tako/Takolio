import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recipeMediaRoutes } from '../../src/worker/routes/recipe-media';
import { emitRecipeMediaDiagnostic, resetRecipeMediaDiagnosticsForTests } from '../../src/worker/services/recipe-media';
import type { Env } from '../../src/worker/types';

describe('public media diagnostic privacy', () => {
  beforeEach(() => resetRecipeMediaDiagnosticsForTests());
  afterEach(() => vi.restoreAllMocks());

  it.each(['missing', 'failed'] as const)('keeps %s metadata status without logging an arbitrary valid path identity', async (mode) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const privateId = 'private-household-123';
    const get = vi.fn();
    const db = {
      prepare: () => ({
        bind: () => ({ first: async () => {
          if (mode === 'failed') throw new Error('synthetic-private-provider-body');
          return null;
        } }),
      }),
    } as unknown as Env['DB'];
    const response = await recipeMediaRoutes.request(`/recipe-media/${privateId}/hero/1`, {}, { DB: db, IMAGES: { get } } as unknown as Env);
    expect(response.status).toBe(mode === 'failed' ? 503 : 404);
    expect(await response.json()).toEqual({
      error: 'Recipe media unavailable',
      code: mode === 'failed' ? 'RECIPE_MEDIA_UNAVAILABLE' : 'RECIPE_MEDIA_NOT_FOUND',
    });
    expect(get).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const record = JSON.parse(warn.mock.calls[0][0] as string);
    expect(record).toEqual({ level: 'warn', event: mode === 'failed' ? 'recipe_media_read_failed' : 'recipe_media_metadata_missing', role: 'hero', version: 1,
      ...(mode === 'failed' ? { code: 'D1_READ_FAILED' } : {}),
    });
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/private-household-123|synthetic-private-provider-body/);
  });

  it('does not enumerate ignored private metadata or stringify unrecognized codes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unsafe = { role: 'hero', version: 3, code: 'synthetic-private-code' };
    Object.defineProperty(unsafe, 'recipeId', { enumerable: true, get: () => { throw new Error('private-id-getter'); } });
    Object.defineProperty(unsafe, 'toJSON', { enumerable: true, get: () => { throw new Error('private-serialization-getter'); } });
    expect(emitRecipeMediaDiagnostic('recipe_media_invalid', unsafe, 60_000)).toBe(true);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ level: 'warn', event: 'recipe_media_invalid', role: 'hero', version: 3 });
  });

  it('ignores accessors instead of reading fields again after validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const read = vi.fn(() => 'synthetic-private-getter');
    const detail = {};
    for (const field of ['role', 'version', 'code']) Object.defineProperty(detail, field, { enumerable: true, get: read });
    expect(emitRecipeMediaDiagnostic('recipe_media_invalid', detail, 60_000)).toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ level: 'warn', event: 'recipe_media_invalid' });
  });

  it('keeps the failure event observable when a metadata proxy rejects inspection', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const detail = new Proxy({}, { ownKeys() { throw new Error('synthetic-private-proxy'); } });
    expect(emitRecipeMediaDiagnostic('recipe_media_read_failed', detail, 60_000)).toBe(true);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ level: 'warn', event: 'recipe_media_read_failed' });
  });

  it('retains valid bounded categories and the existing window cap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 20; i += 1) {
      expect(emitRecipeMediaDiagnostic('recipe_media_not_ready', { role: 'thumbnail', version: 1_000_000, code: 'superseded' }, 60_000)).toBe(true);
    }
    expect(emitRecipeMediaDiagnostic('recipe_media_read_failed', { code: 'D1_READ_FAILED' }, 60_001)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(20);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ level: 'warn', event: 'recipe_media_not_ready', role: 'thumbnail', version: 1_000_000, code: 'superseded' });
    expect(emitRecipeMediaDiagnostic('recipe_media_read_failed', { code: 'D1_READ_FAILED' }, 120_000)).toBe(true);
  });
});
