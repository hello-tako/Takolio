#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { hash, scoreTextMatrix } from './synthetic-scan/score.mjs';
const preparedPath = resolve(process.argv[2] || '.artifacts/scan-synthetic-v3/prepared.json');
const resultsPath = resolve(process.argv[3] || '.artifacts/scan-synthetic-v3/apple-vision.raw.json');
const outputPath = resolve(process.argv[4] || '.artifacts/scan-synthetic-v3/scores.json');
try {
  const preparedBytes = await readFile(preparedPath);
  const prepared = JSON.parse(preparedBytes);
  for (const image of prepared.cases) {
    if (basename(image.file) !== image.file || hash(await readFile(join(dirname(preparedPath), image.file))) !== image.sha256) throw new Error('SYNTHETIC_IMAGE_HASH_MISMATCH');
  }
  const rawBytes = await readFile(resultsPath);
  const results = JSON.parse(rawBytes);
  const scores = { ...scoreTextMatrix(prepared, results, hash(preparedBytes)),
    receipt: { preparedSha256: hash(preparedBytes), rawOcrSha256: hash(rawBytes) } };
  await writeFile(outputPath, `${JSON.stringify(scores, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ imageCount: scores.imageCount, originalDocuments: scores.originalDocuments, slices: scores.slices })}\n`);
} catch (error) {
  const codes = new Set(['SYNTHETIC_IMAGE_HASH_MISMATCH', 'SYNTHETIC_RESULTS_INVALID', 'SYNTHETIC_MATRIX_INVALID']);
  process.stderr.write(`${codes.has(error.message) ? error.message : 'SYNTHETIC_INPUT_UNAVAILABLE'}\n`);
  process.exitCode = 2;
}
