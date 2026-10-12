import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { processScanJob, ensureScanQueueIntent, cancelQueuedScan, type ScanQueueMessage } from '../../src/worker/services/scan-queue';
import { reserveScanQuota } from '../../src/worker/services/scan-quota';
import { scanRoutes } from '../../src/worker/routes/scans';
import type { AuthContext, Env } from '../../src/worker/types';
import { readScanJobEnvelope, readScanResultEnvelope } from '../../packages/ai/src/scan-envelope';

const vision = vi.fn();
vi.mock('@frigo/ai', () => ({ AIRouter: class { vision = vision; receiptScan = vision; } }));
const message: ScanQueueMessage = { type: 'scan.process.v1', jobId: 'cancel-job', scanId: 'cancel-scan',
  userId: 'cancel-user', householdId: 'cancel-home', scanType: 'fridge', imageBase64: 'aGVsbG8=', idempotencyKey: 'cancel-key' };
const extracted = { items: [{ raw_name: 'Synthetic', estimated_quantity: 1, unit: 'piece', confidence: 0.8 }] };
let db: SqliteD1;
let env: Env;
const auth: AuthContext = { userId: 'cancel-user', householdId: 'cancel-home', isGuest: false };
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', async (c, next) => { c.set('auth', auth); await next(); });
app.route('/', scanRoutes);
const facts = () => ({ scans: db.query('SELECT * FROM scans'), jobs: db.query('SELECT * FROM scan_queue_jobs'),
  items: db.query('SELECT * FROM scan_items'), quota: db.query('SELECT * FROM scan_quota_ledger'), inventory: db.query('SELECT * FROM inventory_items') });
beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('cancel-user');
    INSERT INTO households(id,name,created_by) VALUES ('cancel-home','Cancel','cancel-user');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES ('cancel-member','cancel-home','cancel-user','owner');`);
  env = { DB: db, ENVIRONMENT: 'test' };
  expect((await reserveScanQuota(db, { userId: message.userId, householdId: message.householdId,
    scanId: message.scanId, idempotencyKey: message.idempotencyKey!, scan: { imageKey: null,
      scanType: 'fridge', requestFingerprint: '', imageMimeType: 'image/jpeg' } })).ok).toBe(true);
  await ensureScanQueueIntent(env, message);
  vision.mockReset().mockResolvedValue(extracted);
});
afterEach(() => db.close());

describe('existing fenced queue cancellation and contract readers', () => {
  it('cancels pending work and settles quota once without an AI or stock write', async () => {
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('cancelled');
    const after = facts();
    expect(after.scans[0].status).toBe('failed');
    expect(after.jobs[0]).toMatchObject({ status: 'failed', error_code: 'SCAN_CANCELLED' });
    expect(after.quota[0].status).toBe('released');
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('cancelled');
    await processScanJob(env, message);
    await ensureScanQueueIntent(env, message);
    expect(facts()).toEqual(after);
    expect(vision).not.toHaveBeenCalled();
  });
  it('aborts the local operation and fences an adapter that ignores the signal', async () => {
    let resolve!: (result: typeof extracted) => void;
    let start!: () => void;
    const started = new Promise<void>((yes) => { start = yes; });
    const work = new Promise<typeof extracted>((yes) => { resolve = yes; });
    let signal: AbortSignal | undefined;
    vision.mockImplementationOnce((_input, control) => { signal = control.signal; start(); return work; });
    const worker = processScanJob(env, message);
    await started;
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('cancelled');
    await worker;
    expect(signal?.aborted).toBe(true);
    const after = facts();
    resolve(extracted);
    await Promise.resolve();
    await processScanJob(env, message);
    expect(facts()).toEqual(after);
    expect(after.items).toHaveLength(0);
    expect(vision).toHaveBeenCalledTimes(1);
  });
  it('preserves a committed successful scan when completion wins', async () => {
    await processScanJob(env, message);
    const after = facts();
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('conflict');
    expect(facts()).toEqual(after);
    expect(after.quota[0].status).toBe('consumed');
  });
  it('keeps foreign/missing and unqueued scans unchanged', async () => {
    const before = facts();
    expect(await cancelQueuedScan(env, message.scanId, 'foreign-home')).toBe('missing');
    expect(await cancelQueuedScan(env, 'missing-scan', message.householdId)).toBe('missing');
    expect(facts()).toEqual(before);
    db.execute('DELETE FROM scan_queue_jobs');
    const unqueued = facts();
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('conflict');
    expect(facts()).toEqual(unqueued);
  });
  it('rolls back every cancellation write when a trigger rejects settlement', async () => {
    db.seed("CREATE TRIGGER reject_cancel BEFORE UPDATE ON scans BEGIN SELECT RAISE(ABORT,'synthetic'); END;");
    const before = facts();
    await expect(cancelQueuedScan(env, message.scanId, message.householdId)).rejects.toThrow();
    expect(facts()).toEqual(before);
  });
  it('recovers cancellation response loss after commit', async () => {
    db.hooks.afterBatch = () => { db.hooks = {}; throw new Error('Synthetic response loss'); };
    expect(await cancelQueuedScan(env, message.scanId, message.householdId)).toBe('cancelled');
    expect(facts().quota[0].status).toBe('released');
  });
  it('makes simultaneous cancellation idempotent', async () => {
    expect(await Promise.all([cancelQueuedScan(env, message.scanId, message.householdId),
      cancelQueuedScan(env, message.scanId, message.householdId)])).toEqual(['cancelled', 'cancelled']);
    expect(facts().quota[0].status).toBe('released');
  });
  it('exposes cancellation through the existing guarded route', async () => {
    const response = await app.request('/scans/cancel-scan/cancel', { method: 'POST' }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, cancelled: true, status: 'failed', code: 'SCAN_CANCELLED' });
  });
  it.each(['3', '2', '', '03', '3, 1'])('fences HTTP contract %s before legacy mutation', async (version) => {
    const before = facts();
    const response = await app.request('/scans/cancel-scan/confirm', { method: 'POST',
      headers: { 'X-Scan-Contract-Version': version, 'Content-Type': 'application/json' }, body: '{}' }, env);
    expect(response.status).toBe(version === '3' ? 409 : 400);
    expect((await response.json() as { code: string }).code).toBe(version === '3'
      ? 'SCAN_CONTRACT_NOT_ENABLED' : 'SCAN_CONTRACT_VERSION_UNSUPPORTED');
    expect(facts()).toEqual(before);
  });
  it.each([3, 2, '1', null])('rejects non-v1 messages before claim when schemaVersion=%s', async (version) => {
    const before = facts();
    await expect(processScanJob(env, { ...message, schemaVersion: version })).rejects.toMatchObject({ retryable: false });
    expect(facts()).toEqual(before);
    expect(vision).not.toHaveBeenCalled();
  });
  it('reads legacy and candidate V3 envelopes without manufacturing legacy fields', () => {
    expect(readScanJobEnvelope(message)).toMatchObject({ ok: true, envelope: { version: 1 } });
    const candidate = { type: 'scan.process.v3', schemaVersion: 3, scanId: 'candidate', userId: 'user', householdId: 'home',
      task: 'label_ocr', requestFingerprint: 'a'.repeat(64) };
    expect(readScanJobEnvelope(candidate)).toMatchObject({ ok: true, envelope: { version: 3, message: candidate } });
    expect(readScanJobEnvelope({ ...candidate, type: 'scan.process.v1' }).ok).toBe(false);
    expect(readScanJobEnvelope({ ...message, userId: {} }).ok).toBe(false);
    const fixtures = JSON.parse(readFileSync('tests/fixtures/scan-v3/predictions.json', 'utf8'));
    const v3 = fixtures.submissions[0].attempts[0].output;
    expect(readScanResultEnvelope(v3)).toMatchObject({ ok: true, envelope: { version: 3, result: v3 } });
    expect(readScanResultEnvelope(extracted, 'fridge_image_analysis')).toEqual({ ok: true,
      envelope: { version: 1, task: 'fridge_image_analysis', result: extracted } });
    expect(readScanResultEnvelope(extracted).ok).toBe(false);
  });
});
