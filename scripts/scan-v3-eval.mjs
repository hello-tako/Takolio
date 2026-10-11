#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const allowed = new Set(['--dataset', '--predictions', '--output', '--dry-run']);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('INVALID_ARGUMENTS');
  return args[index + 1];
}
let vite;
try {
  if (args.includes('--live')) throw new Error('LIVE_EXECUTION_NOT_SUPPORTED');
  for (let index = 0; index < args.length; index++) {
    if (!allowed.has(args[index])) throw new Error('INVALID_ARGUMENTS');
    if (args[index] !== '--dry-run') index++;
  }
  const datasetPath = resolve(option('--dataset', 'tests/fixtures/scan-v3/dataset.json'));
  const predictionsPath = resolve(option('--predictions', 'tests/fixtures/scan-v3/predictions.json'));
  const outputPath = option('--output', '');
  const datasetBytes = await readFile(datasetPath);
  const predictionBytes = await readFile(predictionsPath);
  vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
    appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
  const { scoreScanV3 } = await vite.ssrLoadModule('/scripts/scan-v3-scoring.ts');
  const sourceFiles = ['scripts/scan-v3-eval.mjs', 'scripts/scan-v3-scoring.ts',
    'packages/ai/src/scan-contract-v3.ts', 'packages/ai/src/schemas.ts', 'pnpm-lock.yaml'];
  const sourceHashes = await Promise.all(sourceFiles.map(async (path) => ({ path,
    sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
  const report = { ...scoreScanV3(JSON.parse(datasetBytes), JSON.parse(predictionBytes)),
    receipt: { datasetFileSha256: createHash('sha256').update(datasetBytes).digest('hex'),
      predictionsFileSha256: createHash('sha256').update(predictionBytes).digest('hex'),
      evaluatorSourceSha256: createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex'),
      sourceHashes, command: ['node', 'scripts/scan-v3-eval.mjs', ...args] } };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) await writeFile(resolve(outputPath), serialized, { mode: 0o600 });
  process.stdout.write(serialized);
} catch (error) {
  const safeCodes = new Set(['LIVE_EXECUTION_NOT_SUPPORTED', 'INVALID_ARGUMENTS', 'SCAN_V3_EVALUATOR_INVALID_INPUT',
    'SCAN_V3_EVALUATOR_DATASET_MISMATCH', 'SCAN_V3_EVALUATOR_SUBMISSION_MISMATCH', 'SCAN_V3_EVALUATOR_COST_OVERFLOW']);
  process.stderr.write(`${JSON.stringify({ code: error instanceof Error && safeCodes.has(error.message) ? error.message : 'SCAN_V3_EVALUATOR_INPUT_UNAVAILABLE' })}\n`);
  process.exitCode = 2;
} finally {
  await vite?.close();
}
