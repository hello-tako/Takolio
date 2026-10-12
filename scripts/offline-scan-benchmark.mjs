#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') throw new Error('Usage: offline-scan-benchmark.mjs --output DIRECTORY; no live mode');
const output = resolve(args[1]);
const input = '.artifacts/scan-synthetic-v3/dataset.json';
const bytes = await readFile(input);
const dataset = JSON.parse(bytes);
if (dataset.classification !== 'TEST_ONLY') throw new Error('OFFLINE_SYNTHETIC_ONLY');
await mkdir(output, { recursive: true, mode: 0o700 });
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { scoreScanV3, ScanV3DatasetSchema } = await vite.ssrLoadModule('/scripts/scan-v3-scoring.ts');
  ScanV3DatasetSchema.parse(dataset);
  const runs = [];
  for (const profile of ['source_oracle', 'provider_outage', 'malformed_provider']) {
    const predictions = { schemaVersion: 1, datasetId: dataset.datasetId,
      submissions: dataset.cases.map((entry) => ({ caseId: entry.caseId, finalAttempt: 0,
        attempts: [{ kind: 'primary', status: profile === 'provider_outage' ? 'provider_error' : 'output',
          ...(profile === 'provider_outage' ? {} : { output: profile === 'source_oracle' ? entry.annotation.groundTruth : { schemaVersion: 3, forged: true } }),
          costUsdMicros: 0, costBasis: 'ESTIMATED', pricingVersion: 'OFFLINE_MOCK_NO_BILLING' }],
      })) };
    const report = scoreScanV3(dataset, predictions);
    runs.push({ profile, report });
    await writeFile(join(output, `${profile}.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  const pilot = { assets: 240, providerCandidates: 2, maximumCallsPerAssetPerProvider: 3,
    inputTokensPerCallScenario: 16000, outputTokensPerCallCapScenario: 2048 };
  const calls = pilot.assets * pilot.providerCandidates * pilot.maximumCallsPerAssetPerProvider;
  const estimates = { classification: 'PLANNING_ESTIMATE', status: 'PENDING_EXTERNAL_EVIDENCE', pilot,
    maximumCalls: calls, inputTokensScenario: calls * pilot.inputTokensPerCallScenario,
    outputTokensScenario: calls * pilot.outputTokensPerCallCapScenario,
    formulaUsd: '(inputTokens * inputUsdPerMillion + outputTokens * outputUsdPerMillion) / 1000000',
    verifiedProviderPrices: null, costUpperBoundUsd: null,
    illustrationOnly: [
      { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 },
      { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
    ].map((rate) => ({ ...rate, hypotheticalUsd: (calls * pilot.inputTokensPerCallScenario * rate.inputUsdPerMillion
      + calls * pilot.outputTokensPerCallCapScenario * rate.outputUsdPerMillion) / 1_000_000 })),
    warning: 'Illustrative rates/token scenarios are not provider quotes or trusted vision-token upper bounds.' };
  const receipt = { schemaVersion: 1, classification: 'TEST_ONLY', executionMode: 'OFFLINE_MOCK',
    acceptance: 'OFFLINE_PIPELINE_VERIFIED', externalAcceptance: 'PENDING_EXTERNAL_EVIDENCE',
    datasetSha256: createHash('sha256').update(bytes).digest('hex'), cases: dataset.cases.length,
    outboundCalls: 0, chargedUsd: 0, approvedBudgetUsd: 0,
    mockOutputBasis: 'Source oracle copies synthetic ground truth; tests pipeline, not model accuracy.',
    profiles: runs.map(({ profile }) => profile), estimates };
  await writeFile(join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally { await vite.close(); }
