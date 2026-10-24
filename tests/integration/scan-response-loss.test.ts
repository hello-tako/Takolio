import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { scansApi } from '../../src/web/services/scans';
import { fetchJson, isNonRetryable } from '../../src/web/services/http';
import { flush, getPendingOps } from '../../src/web/lib/sync';
import { privateCacheKey } from '../../src/web/lib/private-session';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { scanRoutes } from '../../src/worker/routes/scans';
import type { AuthContext, Env } from '../../src/worker/types';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const scope = { userId: 'scan-recovery-user', householdId: 'scan-recovery-household' };
const origin = 'https://scan-recovery.example.com';
const cookie = 'scan-recovery-test-cookie';
const scanId = 'scan-recovery-server';
const confirmPath = `/scans/${scanId}/confirm`;
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/api/v1', scanRoutes);

function interruptedBody(response: Response, error: Error, beforeFailure?: () => void): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"success":')); },
    pull(controller) {
      beforeFailure?.();
      controller.error(error);
    },
  }), { status: response.status, headers: response.headers });
}

describe('server scan confirmation response-loss recovery (real SQLite HTTP)', () => {
  let db: SqliteD1;
  let env: Env;

  beforeEach(async () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    localStorage.setItem('frigo_user_id', scope.userId);
    localStorage.setItem('frigo_household_id', scope.householdId);
    db = new SqliteD1();
    db.execute('INSERT INTO users (id, email) VALUES (?, ?)', [scope.userId, 'scan-recovery@example.com']);
    db.execute('INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)',
      [scope.householdId, 'Recovery test', scope.userId]);
    db.execute('INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)',
      ['scan-recovery-member', scope.householdId, scope.userId, 'owner']);
    db.execute('INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
      ['scan-recovery-session', scope.userId, scope.householdId, await sha256Hex(cookie), new Date(Date.now() + 3600_000).toISOString()]);
    db.execute("INSERT INTO scans (id, user_id, household_id, status) VALUES (?, ?, ?, 'ready')",
      [scanId, scope.userId, scope.householdId]);
    db.execute(`INSERT INTO scan_items (id, scan_id, raw_name, canonical_id, estimated_quantity, unit, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, ['reviewed-eggs', scanId, 'Trứng gà', 'CHICKEN_EGG', 6, 'piece', 'egg']);
    env = { DB: db, ENVIRONMENT: 'test', APP_URL: origin } as unknown as Env;
  });

  afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
  });

  async function serverResponse(input: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set('Cookie', `${SESSION_COOKIE}=${cookie}`);
    headers.set('Origin', origin);
    return app.fetch(new Request(new URL(input, origin), { ...init, headers }), env);
  }

  it.each([0, 2].flatMap((existingQuantity) => ['fetch', 'body-type-error', 'body-abort'].map((failure) => ({
    existingQuantity, failure,
  }))))('replays only confirmation after repeated $failure losses with $existingQuantity existing eggs', async ({ existingQuantity, failure }) => {
    if (existingQuantity > 0) {
      db.execute(`INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['existing-eggs', scope.householdId, 'CHICKEN_EGG', 'Trứng gà', existingQuantity, 'piece', 'egg']);
    }
    const cachedItems = existingQuantity === 0 ? [] : [{ id: 'existing-eggs', quantity: existingQuantity, unit: 'piece' }];
    const cacheKey = privateCacheKey('inventory');
    localStorage.setItem(cacheKey, JSON.stringify(cachedItems));
    const initialCache = localStorage.getItem(cacheKey);
    const items = [{ id: 'reviewed-eggs', estimatedQuantity: 4 }];
    const originalBody = JSON.stringify({ items });
    const received: Array<{ path: string; body: string; user: string | null; household: string | null }> = [];
    const replies: Array<{ success: boolean; idempotentReplay?: boolean }> = [];
    let lossesRemaining = 2;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      received.push({
        path: input, body: String(init.body),
        user: headers.get('X-Frigo-Expected-User-Id'), household: headers.get('X-Frigo-Expected-Household-Id'),
      });
      const response = await serverResponse(input, init);
      expect(response.status).toBe(200);
      replies.push(await response.clone().json());
      if (lossesRemaining-- > 0) {
        if (failure === 'fetch') throw new TypeError('response lost after server commit');
        return interruptedBody(response, failure === 'body-type-error'
          ? new TypeError('response body connection lost') : new DOMException('response body aborted', 'AbortError'));
      }
      return response;
    }));

    const result = await scansApi.confirmScan(scanId, items);
    expect(result).toEqual({ success: true, pendingSync: true, items: cachedItems });
    expect(replies).toEqual([expect.objectContaining({ success: true })]);
    expect(replies[0].idempotentReplay).toBeUndefined();
    const stock = () => db.query('SELECT * FROM inventory_items WHERE household_id = ? ORDER BY id', scope.householdId);
    const events = () => db.query('SELECT * FROM inventory_events WHERE household_id = ? ORDER BY id', scope.householdId);
    const committedStock = stock();
    const committedEvents = events();
    expect(committedStock).toHaveLength(1);
    expect(committedStock[0].quantity).toBe(existingQuantity + 4);
    expect(committedEvents).toEqual([expect.objectContaining({ event_type: 'SCAN_CONFIRM', quantity_delta: 4 })]);
    expect(db.query('SELECT status FROM scans WHERE id = ?', scanId)).toEqual([{ status: 'confirmed' }]);
    expect(db.query('SELECT estimated_quantity, is_confirmed FROM scan_items WHERE id = ?', 'reviewed-eggs'))
      .toEqual([{ estimated_quantity: 4, is_confirmed: 1 }]);
    const queued = getPendingOps();
    expect(queued).toEqual([expect.objectContaining({ path: confirmPath, method: 'POST', body: originalBody, ...scope })]);

    const replay = () => flush(async (op) => {
      await fetchJson(op.path, { method: op.method, body: op.body, headers: op.headers });
    }, isNonRetryable, { scope });
    expect(await replay()).toEqual({ attempted: 0, remaining: 1 });
    expect(getPendingOps()).toEqual(queued);
    expect(stock()).toEqual(committedStock);
    expect(events()).toEqual(committedEvents);

    expect(await replay()).toEqual({ attempted: 1, remaining: 0 });
    expect(await replay()).toEqual({ attempted: 0, remaining: 0 });
    expect(getPendingOps()).toEqual([]);
    expect(stock()).toEqual(committedStock);
    expect(events()).toEqual(committedEvents);
    expect(localStorage.getItem(cacheKey)).toBe(initialCache);
    expect(received).toEqual(Array.from({ length: 3 }, () => ({
      path: `/api/v1${confirmPath}`, body: originalBody, user: scope.userId, household: scope.householdId,
    })));
    expect(replies.slice(1)).toEqual(Array.from({ length: 2 }, () => expect.objectContaining({
      success: true, idempotentReplay: true,
    })));
  });

  it.each((['legacy', 'native'] as const).flatMap((mode) => (['fridge', 'receipt'] as const)
    .flatMap((scanType) => ['fetch', 'body-type-error', 'body-abort'].map((failure) => ({ mode, scanType, failure })))))
  ('retains manual history through repeated $failure loss and outbox replay: $mode/$scanType', async ({ mode, scanType, failure }) => {
    if (mode === 'native') {
      await backfillLegacyInventory(db, scope.householdId);
      await executeInventoryAdoption(db, { householdId: scope.householdId, actorId: scope.userId }, {}, '2026-10-24T10:00:00Z');
    }
    db.execute('UPDATE scans SET scan_type = ?, purchase_date = ? WHERE id = ?',
      [scanType, scanType === 'receipt' ? '2026-09-12' : null, scanId]);
    const items = [{ id: 'draft_response_loss_salt', rawName: 'SCAN01 response-loss salt',
      estimatedQuantity: 0.25, unit: 'pack', category: 'other', storage: 'pantry' }];
    const originalBody = JSON.stringify({ items });
    const cacheKey = privateCacheKey('inventory');
    localStorage.setItem(cacheKey, '[]');
    const received: Array<{ path: string; body: string; user: string | null; household: string | null }> = [];
    const replies: Array<{ success: boolean; idempotentReplay?: boolean; confirmedItemIds?: string[] }> = [];
    let lossesRemaining = 2;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      received.push({ path: input, body: String(init.body),
        user: headers.get('X-Frigo-Expected-User-Id'), household: headers.get('X-Frigo-Expected-Household-Id') });
      const response = await serverResponse(input, init);
      expect(response.status).toBe(200);
      replies.push(await response.clone().json());
      if (lossesRemaining-- > 0) {
        if (failure === 'fetch') throw new TypeError('manual response lost after server commit');
        return interruptedBody(response, failure === 'body-type-error'
          ? new TypeError('manual response body lost') : new DOMException('manual response body aborted', 'AbortError'));
      }
      return response;
    }));

    expect(await scansApi.confirmScan(scanId, items)).toEqual({ success: true, pendingSync: true, items: [] });
    expect(replies).toEqual([expect.objectContaining({ success: true, confirmedItemIds: [] })]);
    expect(replies[0].idempotentReplay).toBeUndefined();
    const expectedHistoryId = `scan_manual_${await sha256Hex(JSON.stringify([scanId, items[0].id, 0]))}`;
    const manualRows = db.query('SELECT * FROM scan_items WHERE scan_id = ? AND id = ?', scanId, expectedHistoryId);
    expect(manualRows).toEqual([expect.objectContaining({ raw_name: items[0].rawName, canonical_id: null,
      estimated_quantity: 0.25, unit: 'pack', category: 'other', storage: 'pantry', is_confirmed: 1,
      review_state: 'CONFIRMED', reviewed_expiry_date: null, reviewed_expiry_kind: 'UNKNOWN' })]);
    for (const key of ['ocr_raw_name', 'ocr_quantity', 'ocr_unit', 'ocr_confidence', 'ocr_canonical_id',
      'ocr_category', 'ocr_storage', 'unit_price_vnd', 'total_price_vnd']) expect(manualRows[0][key]).toBeNull();
    expect(db.query('SELECT review_state, is_confirmed FROM scan_items WHERE id = ?', 'reviewed-eggs'))
      .toEqual([{ review_state: 'PENDING', is_confirmed: 0 }]);
    expect(db.query('SELECT quantity, unit FROM inventory_items WHERE household_id = ?', scope.householdId))
      .toEqual([{ quantity: 0.25, unit: 'pack' }]);
    expect(db.query('SELECT status FROM scans WHERE id = ?', scanId)).toEqual([{ status: 'confirmed' }]);
    expect(db.query('SELECT id FROM inventory_events WHERE household_id = ?', scope.householdId)).toHaveLength(1);
    const commands = db.query<{ fingerprint: string }>('SELECT fingerprint FROM inventory_commands');
    expect(commands).toHaveLength(mode === 'native' ? 1 : 0);
    if (mode === 'native') {
      expect(db.query('SELECT quantity_milli, source_type, source_id, purchased_at, amount_minor, currency FROM inventory_lots'))
        .toEqual([{ quantity_milli: 250, source_type: scanType === 'receipt' ? 'RECEIPT' : 'SCAN', source_id: scanId,
          purchased_at: scanType === 'receipt' ? '2026-09-12' : null, amount_minor: null, currency: null }]);
      expect(JSON.parse(commands[0].fingerprint).command.scanEvidence.lines)
        .toEqual([expect.objectContaining({ scanItemId: null, raw: { rawName: null, quantity: null, unit: null }, corrected: false })]);
      expect(db.query('SELECT raw_name FROM inventory_observations')).toEqual([{ raw_name: null }]);
    }
    const facts = () => Object.fromEntries(['inventory_lots', 'inventory_items', 'inventory_commands', 'inventory_events',
      'inventory_observations', 'inventory_reconciliation_decisions', 'inventory_adoption_receipts',
      'scan_items', 'scans', 'households', 'storage_locations']
      .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
    const committed = facts();
    const queued = getPendingOps();
    expect(queued).toEqual([expect.objectContaining({ path: confirmPath, method: 'POST', body: originalBody,
      dedupeKey: `scan-confirm:${scanId}`, ...scope })]);
    const replay = () => flush(async (op) => {
      await fetchJson(op.path, { method: op.method, body: op.body, headers: op.headers });
    }, isNonRetryable, { scope });
    expect(await replay()).toEqual({ attempted: 0, remaining: 1 });
    expect(getPendingOps()).toEqual(queued);
    expect(facts()).toEqual(committed);
    expect(await replay()).toEqual({ attempted: 1, remaining: 0 });
    expect(await replay()).toEqual({ attempted: 0, remaining: 0 });
    expect(getPendingOps()).toEqual([]);
    expect(facts()).toEqual(committed);
    expect(localStorage.getItem(cacheKey)).toBe('[]');
    expect(received).toEqual(Array.from({ length: 3 }, () => ({ path: `/api/v1${confirmPath}`,
      body: originalBody, user: scope.userId, household: scope.householdId })));
    expect(replies.slice(1)).toEqual(Array.from({ length: 2 }, () => expect.objectContaining({ success: true, idempotentReplay: true })));
    const response = await serverResponse(`/api/v1/scans/${scanId}`, { method: 'GET' });
    expect(response.status).toBe(200);
    const fresh = await response.json() as { scan: { items: Array<Record<string, unknown>> } };
    expect(fresh.scan.items).toHaveLength(2);
    const manual = fresh.scan.items.find((item) => item.id === expectedHistoryId)!;
    expect(manual).toMatchObject({ rawName: items[0].rawName, estimatedQuantity: 0.25, unit: 'pack',
      category: 'other', storage: 'pantry', isManual: true, isConfirmed: true, reviewState: 'CONFIRMED', expiryKind: 'UNKNOWN' });
    for (const key of ['confidence', 'rawEvidence', 'unitPriceVnd', 'totalPriceVnd', 'expiryDate'])
      expect(manual).not.toHaveProperty(key);
    expect(fresh.scan.items.find((item) => item.id === 'reviewed-eggs')).not.toHaveProperty('isManual');
    expect(facts()).toEqual(committed);
  });

  it.each(['TypeError', 'AbortError'])('does not queue a body %s after the active owner changes', async (kind) => {
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const response = await serverResponse(input, init);
      expect(response.status).toBe(200);
      return interruptedBody(response, kind === 'TypeError'
        ? new TypeError('response body connection lost') : new DOMException('response body aborted', 'AbortError'), () => {
        localStorage.setItem('frigo_user_id', 'replacement-user');
        localStorage.setItem('frigo_household_id', 'replacement-household');
      });
    }));

    await expect(scansApi.confirmScan(scanId, [{ id: 'reviewed-eggs', estimatedQuantity: 4 }]))
      .rejects.toMatchObject({ kind: 'auth' });
    expect(getPendingOps()).toEqual([]);
    expect(db.query('SELECT quantity FROM inventory_items WHERE household_id = ?', scope.householdId))
      .toEqual([{ quantity: 4 }]);
    expect(db.query('SELECT event_type FROM inventory_events WHERE household_id = ?', scope.householdId))
      .toEqual([{ event_type: 'SCAN_CONFIRM' }]);
  });

  it('does not queue malformed JSON after successful response headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const response = await serverResponse(input, init);
      expect(response.status).toBe(200);
      return new Response('{"success":', { status: response.status, headers: response.headers });
    }));

    await expect(scansApi.confirmScan(scanId, [{ id: 'reviewed-eggs', estimatedQuantity: 4 }]))
      .rejects.toBeInstanceOf(SyntaxError);
    expect(getPendingOps()).toEqual([]);
    expect(db.query('SELECT quantity FROM inventory_items WHERE household_id = ?', scope.householdId))
      .toEqual([{ quantity: 4 }]);
    expect(db.query('SELECT event_type FROM inventory_events WHERE household_id = ?', scope.householdId))
      .toEqual([{ event_type: 'SCAN_CONFIRM' }]);
  });

  it.each([400, 409, 500].flatMap((status) => ['intact', 'TypeError', 'AbortError'].map((failure) => ({ status, failure }))))(
    'does not queue HTTP $status with a $failure response body', async ({ status, failure }) => {
      if (status === 409) db.execute("UPDATE scans SET status = 'processing' WHERE id = ?", [scanId]);
      if (status === 500) db.seed(`CREATE TRIGGER reject_scan_confirmation BEFORE UPDATE ON scans
        WHEN NEW.status = 'confirmed' BEGIN SELECT RAISE(ABORT, 'injected confirmation failure'); END;`);
      const before = Object.fromEntries(['inventory_items', 'inventory_events', 'scans', 'scan_items']
        .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
      const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
        const response = await serverResponse(input, init);
        expect(response.status).toBe(status);
        if (failure === 'intact') return response;
        return interruptedBody(response, failure === 'TypeError'
          ? new TypeError('error response body lost') : new DOMException('error response body aborted', 'AbortError'));
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(scansApi.confirmScan(scanId, status === 400 ? [] : [{ id: 'reviewed-eggs', estimatedQuantity: 4 }]))
        .rejects.toMatchObject({ kind: 'http', status });
      expect(getPendingOps()).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1${confirmPath}`);
      expect(Object.fromEntries(Object.keys(before).map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)])))
        .toEqual(before);
    },
  );

  it('does not mistake a post-response cache TypeError for transport loss', async () => {
    vi.stubGlobal('fetch', vi.fn(serverResponse));
    const cacheKey = privateCacheKey('inventory');
    const write = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === cacheKey) throw new TypeError('cache write failed');
      write(key, value);
    };

    await expect(scansApi.confirmScan(scanId, [{ id: 'reviewed-eggs', estimatedQuantity: 4 }]))
      .rejects.toThrow('cache write failed');
    expect(getPendingOps()).toEqual([]);
    expect(db.query('SELECT quantity FROM inventory_items WHERE household_id = ?', scope.householdId))
      .toEqual([{ quantity: 4 }]);
    expect(db.query('SELECT event_type FROM inventory_events WHERE household_id = ?', scope.householdId))
      .toEqual([{ event_type: 'SCAN_CONFIRM' }]);
  });
});
