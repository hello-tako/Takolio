import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const base = 'http://127.0.0.1:3321';
const attempt = new Date().toISOString().replaceAll(':', '-');
const out = `.artifacts/takeover/scan-manual-history/browser-${attempt}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const records = [], shots = [], diagnostics = [], blocked = [], failures = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const scriptHash = sha(await readFile(new URL(import.meta.url)));
const api = (page, path, method = 'GET', body) => page.evaluate(async ({ path, method, body }) => {
  const response = await fetch(path, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, json: await response.json() };
}, { path, method, body });
const state = page => api(page, '/__preview/scan01', 'POST', {});
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  shots.push({ path, sha256: sha(await readFile(path)) });
}
async function adopt(context) {
  const token = (await context.cookies()).find(c => c.name === '__Host-frigo_session')?.value;
  assert(token, 'Registered synthetic session required');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/inventory-adopt.mjs', '--base-url', base + '/api/v1', '--origin', base,
      '--household', 'planner-preview-household', '--session-stdin', '--apply'],
    { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH } });
    let output = '';
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { output += value; });
    child.on('error', reject);
    child.on('close', code => {
      if (output.includes(token)) reject(new Error('Credential in local adoption output; output suppressed'));
      else if (code !== 0) reject(new Error('Local adoption failed; output suppressed'));
      else resolve({ code, output });
    });
    child.stdin.end(token);
  });
}
async function layout(page, phase) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(dimensions.scrollWidth <= dimensions.width, `Horizontal overflow at ${phase}`);
  return dimensions;
}
function manualFacts(snapshot, dto, name, removedName) {
  assert.equal(snapshot.status, 200);
  assert.equal(dto.status, 200);
  const rows = snapshot.json.scan_items.filter(row => row.raw_name === name);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.match(row.id, /^scan_manual_[a-f0-9]{64}$/);
  assert.equal(row.review_state, 'CONFIRMED');
  assert.equal(row.is_confirmed, 1);
  assert.equal(row.estimated_quantity, 0.25);
  assert.equal(row.unit, 'pack');
  assert.equal(row.storage, 'pantry');
  assert.equal(row.category, 'other');
  assert.equal(row.reviewed_expiry_date, '2030-12-31');
  assert.equal(row.reviewed_expiry_kind, 'KNOWN');
  for (const field of ['ocr_raw_name', 'ocr_quantity', 'ocr_unit', 'ocr_confidence', 'ocr_canonical_id', 'ocr_category', 'ocr_storage', 'unit_price_vnd', 'total_price_vnd']) assert.equal(row[field], null, field);
  assert(!snapshot.json.scan_items.some(row => row.raw_name === removedName));
  assert(!snapshot.json.inventory_lots.some(row => row.raw_name === removedName));
  const lot = snapshot.json.inventory_lots.find(lot => lot.raw_name === name);
  assert(lot, 'Manual stock lot exists');
  assert.equal(lot.quantity_milli, 250);
  assert.equal(lot.canonical_unit, 'pack');
  assert.equal(lot.storage_location_id, 't08-location:planner-preview-household:PANTRY');
  assert.equal(lot.expiry_kind, 'KNOWN');
  assert.equal(lot.expiry_at, '2030-12-31');
  const item = dto.json.scan.items.find(item => item.id === row.id);
  assert.equal(item.isManual, true);
  assert.equal(item.rawName, name);
  assert.equal(item.estimatedQuantity, 0.25);
  assert.equal(item.unit, 'pack');
  assert.equal(item.storage, 'pantry');
  assert.equal(item.expiryDate, '2030-12-31');
  assert.equal(item.expiryEstimated, false);
  assert.equal(item.expiryKind, 'KNOWN');
  for (const field of ['rawEvidence', 'confidence', 'unitPriceVnd', 'totalPriceVnd']) assert(!Object.hasOwn(item, field), field);
  assert.equal(dto.json.scan.status, 'confirmed');
  return { historyId: row.id, lotId: lot.id, item };
}
async function manualUi(page, row, kind, name) {
  await expect(row).toBeVisible();
  await expect(row).toContainText('Nhập thủ công');
  assert(!/AI đọc|OCR|Độ tin cậy|Đơn giá/.test(await row.innerText()));
  await expect(row.locator('[data-raw-evidence], [data-testid="receipt-raw-evidence"], [data-testid="receipt-price"], [data-testid="receipt-confidence"]')).toHaveCount(0);
  await expect(row.getByLabel(kind === 'photo' ? 'Tên nguyên liệu' : 'Tên sản phẩm', { exact: true })).toHaveValue(name);
  await expect(row.getByLabel('Số lượng', { exact: true })).toHaveValue('0.25');
  await expect(row.getByLabel('Đơn vị', { exact: true })).toHaveValue('pack');
  await expect(row.getByLabel(kind === 'photo' ? 'Bảo quản' : 'Nơi bảo quản', { exact: true })).toHaveValue('pantry');
  await expect(row.getByLabel(kind === 'photo' ? 'Hạn dùng' : 'Hạn dùng trên nhãn', { exact: true })).toHaveValue('2030-12-31');
  assert(await row.locator('input,select,button').evaluateAll(controls => controls.every(control => control.matches(':disabled'))));
  if (kind === 'receipt') await expect(row.locator('summary')).toHaveText('Xem giá trị nhập thủ công đã xác nhận');
  await layout(page, `${kind}-fresh`);
}
try {
  for (const width of [320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 844 : 1000 }, locale: 'vi-VN', reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route(url => url.origin !== base, async route => {
      blocked.push({ width, method: route.request().method(), origin: new URL(route.request().url()).origin, path: new URL(route.request().url()).pathname });
      await route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', socket => {
      const origin = new URL(socket.url()).origin.replace(/^ws/, 'http');
      if (origin !== base) { blocked.push({ width, websocket: origin }); socket.close(); }
      else socket.connectToServer();
    });
    const requests = [], pageErrors = [], consoleErrors = [], failedRequests = [];
    diagnostics.push({ width, pageErrors, consoleErrors, requests, failedRequests });
    context.on('page', page => {
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('requestfailed', request => failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) failedRequests.push({ path: new URL(response.url()).pathname, status: response.status() }); });
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: url.pathname });
      });
    });
    let page = await context.newPage();
    await page.goto(base + '/__preview');
    await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(/\/planner$/, { timeout: 15000 });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('frigo_user_id'))).toBe('planner-preview-user');
    const adoption = await adopt(context);
    const seeded = await api(page, '/__preview/t13-scans', 'POST', {});
    assert.equal(seeded.status, 200);
    for (const kind of ['photo', 'receipt']) {
      const scanId = kind === 'photo' ? seeded.json.fridge : seeded.json.receipt;
      const name = `Gia vị thủ công SCAN01 ${kind} ${width}`;
      const removedName = `Dòng đã xóa SCAN01 ${width}`;
      const route = kind === 'photo' ? `/scan/${scanId}/review` : `/scan/receipt-review?scanId=${scanId}`;
      let payload, response;
      await page.goto(base + route);
      const before = await state(page);
      if (kind === 'photo') {
        const add = async (value, capture = false) => {
          await page.getByRole('button', { name: 'Thêm nguyên liệu AI còn thiếu', exact: true }).click();
          const dialog = page.getByRole('dialog');
          await dialog.getByLabel('Tên nguyên liệu', { exact: true }).fill(value);
          await dialog.getByLabel('Số lượng', { exact: true }).fill('0.25');
          await dialog.getByLabel('Đơn vị', { exact: true }).selectOption('pack');
          if (capture) await shot(page, `${width}-photo-manual-form`);
          await dialog.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
          await expect(dialog).toHaveCount(0);
        };
        await add(name, true);
        await add(removedName);
        await page.locator('[data-scan-item-id]').filter({ hasText: removedName }).getByRole('button', { name: 'Xóa dòng thủ công', exact: true }).click();
        const draft = page.locator('[data-scan-item-id]').filter({ hasText: name });
        await draft.getByLabel('Bảo quản', { exact: true }).selectOption('pantry');
        await draft.getByLabel('Hạn dùng', { exact: true }).fill('2030-12-31');
        await page.locator(`[data-scan-item-id="${scanId}-3"]`).getByRole('button', { name: 'Từ chối dòng này', exact: true }).click();
        await shot(page, `${width}-photo-manual-draft`);
        const pending = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/scans/${scanId}/confirm` && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Xác nhận nguyên liệu (4 món)', exact: true }).click();
        const accepted = await pending;
        payload = accepted.request().postDataJSON();
        response = { status: accepted.status(), json: await accepted.json() };
        await expect(page).toHaveURL(/\/fridge$/);
      } else {
        await expect(page.getByRole('button', { name: /Thêm nguyên liệu/ })).toHaveCount(0);
        payload = { items: [0, 1, 2, 3].map(index => ({ id: `${scanId}-${index}`, ...(index === 3 ? { rejected: true } : {}) })) };
        payload.items.push({ id: `draft_scan01_receipt_${width}`, rawName: name, estimatedQuantity: 0.25, unit: 'pack', category: 'other', storage: 'pantry', expiryDate: '2030-12-31', expiryEstimated: false });
        response = await api(page, `/api/v1/scans/${scanId}/confirm`, 'POST', payload);
      }
      assert.equal(response.status, 200);
      const committed = await state(page);
      const dto = await api(page, `/api/v1/scans/${scanId}`);
      const record = { width, kind, scanId, route, adoption, before, payload, response, committed, dto };
      records.push(record);
      const facts = manualFacts(committed, dto, name, removedName);
      const rejected = committed.json.scan_items.find(row => row.id === `${scanId}-3`);
      assert.equal(rejected.review_state, 'REJECTED');
      await page.evaluate(() => { window.scan01OldDocumentMarker = true; });
      const requestStart = requests.length;
      const previousPage = page;
      page = await context.newPage();
      await page.goto(base + route);
      assert.equal(await page.evaluate(() => window.scan01OldDocumentMarker), undefined);
      await previousPage.close();
      if (kind === 'photo') await expect(page.getByText('Bản quét đã xác nhận · Chỉ xem')).toBeVisible();
      else await expect(page.getByRole('status')).toContainText('Hóa đơn đã được xác nhận');
      const manual = kind === 'photo' ? page.locator(`[data-scan-item-id="${facts.historyId}"]`) : page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${facts.historyId}`) });
      await manualUi(page, manual, kind, name);
      const unknown = kind === 'photo' ? page.locator(`[data-scan-item-id="${scanId}-0"]`) : page.getByTestId('receipt-line').filter({ has: page.locator(`#receipt-name-${scanId}-0`) });
      await expect(unknown).toContainText('Độ tin cậy: chưa rõ');
      await expect(unknown).not.toContainText('Nhập thủ công');
      assert(!requests.slice(requestStart).some(request => request.method !== 'GET'), 'Fresh reopen may only read API');
      const reopenRequests = requests.slice(requestStart);
      await shot(page, `${width}-${kind}-fresh-readonly`);
      const afterReopen = await state(page);
      assert.deepEqual(afterReopen, committed, 'Fresh reopen changes no SQL facts');
      const freshDto = await api(page, `/api/v1/scans/${scanId}`);
      assert.deepEqual(freshDto, dto);
      const replay = await api(page, `/api/v1/scans/${scanId}/confirm`, 'POST', payload);
      assert.equal(replay.status, 200);
      assert.equal(replay.json.idempotentReplay, true);
      const afterReplay = await state(page);
      assert.deepEqual(afterReplay, committed, 'Replay changes no SQL facts');
      Object.assign(record, { facts, freshDocument: true, reopenRequests, afterReopen, freshDto, replay, afterReplay });
      console.log(`PASS SCAN01 ${kind} ${width}: manual 0.25 pack; durable SQL/GET; new-document read-only; no false OCR; replay zero delta`);
    }
    assert.deepEqual(pageErrors, []);
    await context.close();
  }
  assert.deepEqual(blocked, [], 'No external browser request');
  console.log('PASS SCAN01 browser: four flows; eight screenshots; local-only; zero page errors');
} catch (error) {
  failures.push({ name: error.name, message: error.message, stack: error.stack });
  for (const context of browser.contexts()) for (const page of context.pages()) {
    try { await shot(page, `failure-${shots.length}`); } catch {}
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  const evidence = { base, attempt, out, scriptHash, localOnly: true, nativeAdoption: true, records, shots, diagnostics, blocked, failures };
  const json = JSON.stringify(evidence, null, 2);
  await writeFile(out + '/readback.json', json);
  await writeFile(out + '/manifest.json', JSON.stringify({ scriptHash, readbackSha256: sha(json), screenshots: shots }, null, 2));
  await browser.close();
  console.log(`EVIDENCE ${out}`);
}
