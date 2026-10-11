import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1DatabaseBinding } from '@frigo/db';
import {
  resetRecipeCatalogShadowThrottle,
  runRecipeCatalogShadow,
  scheduleRecipeCatalogShadow,
  toRecipeCatalogShadowLogRecord,
  type RecipeCatalogShadowOutcome,
} from '../../src/worker/services/recipe-catalog-shadow';

const FAILURE_CATEGORY = 'RECIPE_CATALOG_SHADOW_FAILED';
const PRIVATE_FIXTURE = 'fixture-private-detail';
const hostileFailures = [
  {
    label: 'mutable Error metadata',
    create() {
      const value = new Error(`${PRIVATE_FIXTURE}: message`);
      value.name = `${PRIVATE_FIXTURE}: name`;
      value.stack = `${PRIVATE_FIXTURE}: stack`;
      return { value, inspections: [] as string[] };
    },
  },
  {
    label: 'Error metadata accessors',
    create() {
      const value = new Error();
      const inspections: string[] = [];
      for (const field of ['name', 'message', 'stack']) {
        Object.defineProperty(value, field, {
          get() {
            inspections.push(field);
            throw new Error(`${PRIVATE_FIXTURE}: accessor`);
          },
        });
      }
      return { value, inspections };
    },
  },
  {
    label: 'non-Error getters and coercion hooks',
    create() {
      const inspections: string[] = [];
      const inspect = (field: string): never => {
        inspections.push(field);
        throw new Error(`${PRIVATE_FIXTURE}: coercion`);
      };
      const value = {
        get name() { return inspect('name'); },
        get message() { return inspect('message'); },
        get stack() { return inspect('stack'); },
        toString() { return inspect('toString'); },
        [Symbol.toPrimitive]() { return inspect('toPrimitive'); },
      };
      return { value, inspections };
    },
  },
  {
    label: 'primitive rejection',
    create() {
      return { value: `${PRIVATE_FIXTURE}: primitive`, inspections: [] as string[] };
    },
  },
];

function failingDatabase(value: unknown) {
  const prepare = vi.fn(() => ({}));
  const batch = vi.fn(async () => { throw value; });
  const db = { prepare, batch } as unknown as D1DatabaseBinding;
  return { db, prepare, batch };
}

describe('recipe catalog shadow log privacy', () => {
  beforeEach(() => resetRecipeCatalogShadowThrottle());

  it.each(hostileFailures)('records a static category for $label without inspecting the thrown value', async ({ create }) => {
    const failure = create();
    const database = failingDatabase(failure.value);
    let clock = 10;

    const outcome = await runRecipeCatalogShadow(database.db, 'shadow', () => clock++);
    expect(outcome).toEqual({ status: 'shadow_error', mode: 'shadow', error: FAILURE_CATEGORY, lookupMs: 1 });
    expect(database.prepare).toHaveBeenCalledTimes(5);
    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(failure.inspections).toEqual([]);
    expect(toRecipeCatalogShadowLogRecord(outcome)).toMatchObject({
      level: 'warn', status: 'shadow_error', catalog_mode: 'shadow', catalog_source: 'static',
      catalog_lookup_ms: 1, catalog_d1_count: null, catalog_drift_count: null, error: FAILURE_CATEGORY,
    });
    expect(JSON.stringify(outcome)).not.toContain(PRIVATE_FIXTURE);
    expect(JSON.stringify(toRecipeCatalogShadowLogRecord(outcome))).not.toContain(PRIVATE_FIXTURE);
  });

  it('keeps scheduling and throttling behavior when a D1 batch rejects with private data', async () => {
    const failure = hostileFailures[0].create();
    const database = failingDatabase(failure.value);
    const records: unknown[] = [];
    const executor = vi.fn();
    let clock = 1_000;
    const now = () => clock;
    const env = { DB: database.db, RECIPE_CATALOG_MODE: 'shadow', RECIPE_CATALOG_SHADOW_INTERVAL_MS: '5000' };

    const outcome = await scheduleRecipeCatalogShadow(env, executor, (record) => records.push(record), now);
    expect(outcome).toEqual({ status: 'shadow_error', mode: 'shadow', error: FAILURE_CATEGORY, lookupMs: 0 });
    expect(executor).toHaveBeenCalledTimes(1);
    await executor.mock.calls[0][0];
    clock += 1_000;
    expect(await scheduleRecipeCatalogShadow(env, executor, (record) => records.push(record), now))
      .toEqual({ status: 'throttled', mode: 'shadow', nextEligibleInMs: 4000 });
    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ level: 'warn', status: 'shadow_error', error: FAILURE_CATEGORY });
    expect(JSON.stringify(records)).not.toContain(PRIVATE_FIXTURE);
  });

  it.each([FAILURE_CATEGORY, 'D1 binding unavailable', 'RecipeCatalogModeError'])
    ('retains the trusted formatter category %s', (error) => {
      const record = toRecipeCatalogShadowLogRecord({ status: 'shadow_error', mode: 'shadow', error, lookupMs: 7 });
      expect(record).toMatchObject({ level: 'warn', status: 'shadow_error', catalog_lookup_ms: 7, error });
    });

  it.each([`${PRIVATE_FIXTURE}: caller injection`, 'Error', '', 5, null, hostileFailures[2].create().value])
    ('replaces an untrusted formatter error with the static category', (error) => {
      const outcome = { status: 'shadow_error', mode: 'shadow', error, lookupMs: 7 } as RecipeCatalogShadowOutcome;
      const record = toRecipeCatalogShadowLogRecord(outcome);
      expect(record).toMatchObject({ level: 'warn', status: 'shadow_error', catalog_lookup_ms: 7, error: FAILURE_CATEGORY });
      expect(JSON.stringify(record)).not.toContain(PRIVATE_FIXTURE);
    });

  it('does not execute a caller-injected error accessor while formatting a shadow outcome', () => {
    const error = vi.fn(() => { throw new Error(`${PRIVATE_FIXTURE}: formatter getter`); });
    const outcome = { status: 'shadow_error', mode: 'shadow', lookupMs: 9 };
    Object.defineProperty(outcome, 'error', { get: error });

    const record = toRecipeCatalogShadowLogRecord(outcome as RecipeCatalogShadowOutcome);
    expect(record).toMatchObject({ level: 'warn', status: 'shadow_error', catalog_lookup_ms: 9, error: FAILURE_CATEGORY });
    expect(error).not.toHaveBeenCalled();
    expect(JSON.stringify(record)).not.toContain(PRIVATE_FIXTURE);
  });

  it('ignores an inherited error accessor instead of treating it as a trusted category', () => {
    const error = vi.fn(() => 'D1 binding unavailable');
    const prototype = Object.defineProperty({}, 'error', { get: error });
    const outcome = Object.assign(Object.create(prototype), { status: 'shadow_error', mode: 'shadow', lookupMs: 9 });

    expect(toRecipeCatalogShadowLogRecord(outcome).error).toBe(FAILURE_CATEGORY);
    expect(error).not.toHaveBeenCalled();
  });

  it('falls back to a static category if a caller proxy rejects descriptor inspection', () => {
    const outcome = new Proxy({ status: 'shadow_error', mode: 'shadow', error: 'D1 binding unavailable', lookupMs: 9 }, {
      getOwnPropertyDescriptor() { throw new Error(`${PRIVATE_FIXTURE}: descriptor trap`); },
    });
    expect(toRecipeCatalogShadowLogRecord(outcome as RecipeCatalogShadowOutcome).error).toBe(FAILURE_CATEGORY);
  });
});
