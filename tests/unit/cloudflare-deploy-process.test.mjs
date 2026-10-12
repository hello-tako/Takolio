import { existsSync, mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { capturedCommand } from '../../scripts/cloudflare-deploy-retry.mjs';

const directories = [];
const moduleUrl = new URL('../../scripts/cloudflare-deploy-retry.mjs', import.meta.url).href;
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'frigo-deploy-process-'));
  directories.push(directory);
  return { ready: join(directory, 'ready'), marker: join(directory, 'should-not-run') };
}
function descendant({ ready, marker }, delay = 1600) {
  return `require('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready');
    process.stdout.write('READY\\n');
    setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'orphan ran'), ${delay});`;
}
function parent(f, { delay = 1600, overflow = false, exitImmediately = false } = {}) {
  const code = descendant(f, delay);
  return `const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(code)}], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', (chunk) => { process.stdout.write(${overflow ? "'x'.repeat(2048)" : 'chunk'}); ${exitImmediately ? 'process.exit(0);' : ''} });
    setInterval(() => {}, 1000);`;
}
async function waitReady(file) {
  const deadline = Date.now() + 3000;
  while (!existsSync(file) && Date.now() < deadline) await pause(10);
  expect(existsSync(file)).toBe(true);
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});

describe.skipIf(process.platform === 'win32')('bounded deployment subprocess groups', () => {
  it('captures normal output without leaking it through the parent console', async () => {
    const result = await capturedCommand(process.execPath, ['-e', "process.stdout.write('read trace'); process.stderr.write('diagnostic');"],
      { env: process.env, timeoutMs: 3000 });
    expect(result).toEqual({ exitCode: 0, output: 'read trace\ndiagnostic', incomplete: false });
  });

  it('kills the pnpm-style descendant on timeout before it can continue work', async () => {
    const f = fixture();
    const result = await capturedCommand(process.execPath, ['-e', parent(f)], { env: process.env, timeoutMs: 1000 });
    expect(existsSync(f.ready)).toBe(true);
    expect(result).toMatchObject({ exitCode: 1, incomplete: true });
    await pause(800);
    expect(existsSync(f.marker)).toBe(false);
  }, 6000);

  it('kills the descendant when captured output exceeds its bound', async () => {
    const f = fixture();
    const result = await capturedCommand(process.execPath, ['-e', parent(f, { delay: 500, overflow: true })],
      { env: process.env, timeoutMs: 3000, maxOutputBytes: 1024 });
    expect(existsSync(f.ready)).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(1024);
    await pause(600);
    expect(existsSync(f.marker)).toBe(false);
  });

  it('kills the entire descendant group on caller cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    const running = capturedCommand(process.execPath, ['-e', parent(f, { delay: 500 })],
      { env: process.env, timeoutMs: 3000, signal: controller.signal });
    await waitReady(f.ready);
    controller.abort();
    expect((await running).incomplete).toBe(true);
    await pause(600);
    expect(existsSync(f.marker)).toBe(false);
  });

  it.each(['SIGTERM', 'SIGINT'])('preserves %s after killing its deployment descendant', async (signal) => {
    const f = fixture();
    const host = `import { capturedCommand } from ${JSON.stringify(moduleUrl)};
      import { existsSync } from 'node:fs';
      const interval = setInterval(() => { if (existsSync(${JSON.stringify(f.ready)})) {
        clearInterval(interval); process.kill(process.pid, ${JSON.stringify(signal)});
      } }, 10);
      const result = await capturedCommand(process.execPath, ['-e', ${JSON.stringify(parent(f, { delay: 500 }))}],
        { env: process.env, timeoutMs: 3000 });
      clearInterval(interval); process.stdout.write(JSON.stringify(result));`;
    const result = await capturedCommand(process.execPath, ['--input-type=module', '-e', host], { env: process.env, timeoutMs: 4000 });
    expect(result.exitCode).not.toBe(0);
    expect(result.signal).toBe(signal);
    expect(JSON.parse(result.output)).toMatchObject({ exitCode: 1, incomplete: true });
    await pause(600);
    expect(existsSync(f.marker)).toBe(false);
  }, 6000);

  it('cleans up a descendant left after a successful parent exit', async () => {
    const f = fixture();
    const result = await capturedCommand(process.execPath, ['-e', parent(f, { delay: 500, exitImmediately: true })],
      { env: process.env, timeoutMs: 3000 });
    expect(result.exitCode).toBe(0);
    expect(existsSync(f.ready)).toBe(true);
    await pause(600);
    expect(existsSync(f.marker)).toBe(false);
  });

  it('does not launch a process after cancellation and fails closed on spawn failure', async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    expect(await capturedCommand(process.execPath, ['-e', parent(f)],
      { env: process.env, timeoutMs: 1000, signal: controller.signal }))
      .toEqual({ exitCode: 1, output: '', incomplete: true });
    expect(existsSync(f.ready)).toBe(false);
    const missing = await capturedCommand('/frigo-test-only-command-does-not-exist', [], { env: process.env, timeoutMs: 1000 });
    expect(missing.incomplete).toBe(true);
    expect(missing.exitCode).not.toBe(0);
  });

  it.each([0, -1, 2_147_483_648, NaN])('rejects unsafe timer bound %s before launch', (timeoutMs) => {
    expect(() => capturedCommand(process.execPath, [], { env: process.env, timeoutMs })).toThrow('Invalid deployment process bounds');
  });
});
