#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const output = 'docs/backend-upgrade/b07/contracts/planner.openapi.json';
const sources = ['scripts/planner-contract.mjs', 'scripts/planner-openapi.ts',
  'packages/domain/src/meal-planning-api.ts', 'packages/domain/src/meal-planning-presentation.ts',
  'packages/domain/src/meal-shopping-api.ts', 'packages/domain/src/foundation.ts', 'src/worker/routes/meal-planning.ts',
  'src/worker/middleware/auth.ts', 'src/worker/middleware/tenancy.ts', 'src/worker/utils/session.ts'];
let vite;
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('CONTRACT_INVALID_ARGUMENT');
  vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom',
    logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
  const { buildPlannerOpenApi } = await vite.ssrLoadModule('/scripts/planner-openapi.ts');
  const hashes = await Promise.all(sources.map(async (path) => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
  const bytes = `${JSON.stringify(buildPlannerOpenApi(hashes), null, 2)}\n`;
  if (args[0] === '--check') {
    if (await readFile(output, 'utf8') !== bytes) throw new Error('CONTRACT_ARTIFACT_DRIFT');
  } else await writeFile(output, bytes);
  process.stdout.write('planner-contract=PASS; bounded4routes, executableZod semantic authority\n');
} catch {
  process.stderr.write('planner-contract=FAIL; generation unavailable or candidate drift\n');
  process.exitCode = 1;
} finally { await vite?.close(); }
