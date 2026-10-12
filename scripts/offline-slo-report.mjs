#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output') throw new Error('Usage: offline-slo-report.mjs --input FILE --output FILE');
const bytes = await readFile(args[1]);
if (bytes.length > 16 * 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { buildSloReport } = await vite.ssrLoadModule('/src/worker/observability/slo-report.ts');
  const report = buildSloReport(JSON.parse(bytes));
  await writeFile(args[3], `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally { await vite.close(); }
