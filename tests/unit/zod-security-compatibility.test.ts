import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OffsetDateTimeSchema, UtcDateTimeSchema } from '../../packages/domain/src/foundation';
import { RecipeDefinitionSchema, RecipeFamilySchema } from '../../packages/recipes/src/foundation';
import { RegisterSchema, validateBody } from '../../src/worker/validation/schemas';

describe('patched Zod parser compatibility', () => {
  it('rejects an oversized array before traversing untrusted elements', () => {
    let visits = 0;
    const element = z.unknown().superRefine((_value, ctx) => {
      visits++;
      ctx.addIssue({ code: 'custom', message: 'Invalid element' });
    });
    const schema = z.array(element).max(2);
    const result = schema.safeParse(Array(1000).fill(null));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([expect.objectContaining({ code: 'too_big', maximum: 2 })]);
    expect(visits).toBe(0);
    schema.safeParse([null]);
    expect(visits).toBe(1);
  });

  it.each(['2026-10-29T10:00:00Z', '2026-10-29T10:00Z', '2024-02-29T10:00:00.123Z'])(
    'retains UTC timestamp grammar and bytes %s', (value) => {
      expect(UtcDateTimeSchema.parse(value)).toBe(value);
      expect(OffsetDateTimeSchema.parse(value)).toBe(value);
    });

  it.each(['2026-10-29T10:00:00+0900', '2026-10-29T10:00:00-04:30', '2026-10-29T10:00+09:00'])(
    'retains offset timestamp grammar and bytes %s', (value) => {
      expect(OffsetDateTimeSchema.parse(value)).toBe(value);
      expect(UtcDateTimeSchema.safeParse(value).success).toBe(false);
    });

  it.each(['2026-02-29T10:00:00Z', '2026-10-29T24:00Z', '2026-10-29T10:00', '2026-10-29T10:00:00+09', 'garbage'])(
    'rejects invalid legacy timestamp grammar %s', (value) => {
      expect(OffsetDateTimeSchema.safeParse(value).success).toBe(false);
      expect(UtcDateTimeSchema.safeParse(value).success).toBe(false);
    });

  it('parses omitted recipe and family provenance through their nested defaults', () => {
    expect(RecipeDefinitionSchema.shape.provenance.parse(undefined)).toEqual({
      sourceType: 'legacy', verificationState: 'unverified', version: 1,
    });
    expect(RecipeFamilySchema.shape.provenance.parse(undefined)).toEqual({
      sourceType: 'curated', verificationState: 'unverified', version: 1,
    });
    expect(RecipeDefinitionSchema.shape.provenance.safeParse({ sourceType: 'imported' }).success).toBe(false);
  });

  it('retains validation HTTP status, custom message and flattened field errors', async () => {
    const app = new Hono();
    let accepted = false;
    app.post('/', validateBody(RegisterSchema), (c) => { accepted = true; return c.json({ success: true }); });
    const response = await app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', email: 'valid@example.test', password: 'valid-password' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Dữ liệu không hợp lệ: name: Tên phải có ít nhất 2 ký tự', code: 'VALIDATION_ERROR',
      details: { formErrors: [], fieldErrors: { name: ['Tên phải có ít nhất 2 ký tự'] } },
    });
    expect(accepted).toBe(false);
  });
});
