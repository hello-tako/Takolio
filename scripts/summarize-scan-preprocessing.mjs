#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
const directory = resolve(process.argv[2] || '.artifacts/scan-preprocessing-comparison');
const source = resolve(process.argv[3] || '.artifacts/scan-synthetic-v3');
const policies = ['jpeg82', 'jpeg95', 'png', 'small_original'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await readFile(join(source, 'prepared.json'));
const prepared = JSON.parse(sourceBytes);
const comparisonBytes = await readFile(join(directory, 'comparison.json'));
const comparison = JSON.parse(comparisonBytes);
if (prepared.classification !== 'TEST_ONLY' || comparison.classification !== 'TEST_ONLY'
  || comparison.sourcePreparedSha256 !== hash(sourceBytes)) throw new Error('COMPARISON_SOURCE_MISMATCH');
const groups = [];
for (const policy of policies) {
  const bytes = await readFile(join(directory, policy, 'scores.json'));
  const report = JSON.parse(bytes);
  const manifestBytes = await readFile(join(directory, policy, 'prepared.json'));
  const rawBytes = await readFile(join(directory, policy, 'apple-vision.raw.json'));
  if (report.receipt?.preparedSha256 !== hash(manifestBytes) || report.receipt?.rawOcrSha256 !== hash(rawBytes)) throw new Error('COMPARISON_SCORE_MISMATCH');
  const measurements = comparison.policies.find((entry) => entry.policy === policy).measurements;
  for (const [task, locale] of [['receipt_ocr', 'vi'], ['receipt_ocr', 'ja'], ['label_ocr', 'vi'], ['label_ocr', 'ja']]) {
    const rows = report.scores.filter((row) => row.task === task && row.locale === locale);
    const ids = new Set(rows.map((row) => row.caseId));
    const sizes = measurements.filter((row) => ids.has(row.caseId)).map((row) => row.outputBytes).sort((a, b) => a - b);
    groups.push({ policy, task, locale, imageCount: rows.length, documentCount: new Set(rows.map((row) => row.documentId)).size,
      expectedFields: rows.reduce((sum, row) => sum + row.expectedFields, 0),
      exactFields: rows.reduce((sum, row) => sum + row.exactFields, 0),
      compactExactFields: rows.reduce((sum, row) => sum + row.compactExactFields, 0),
      edits: rows.reduce((sum, row) => sum + row.edits, 0),
      inputBytes: measurements.filter((row) => ids.has(row.caseId)).reduce((sum, row) => sum + row.inputBytes, 0),
      outputBytes: sizes.reduce((sum, value) => sum + value, 0), maximumBytes: sizes.at(-1),
      losslessOver512KiB: sizes.filter((value) => value > 512 * 1024).length, reportSha256: hash(bytes) });
  }
}
const losslessPixels = [];
for (const image of prepared.cases.filter((image) => image.format === 'png' && image.task === 'receipt_ocr')) {
  const original = await sharp(await readFile(join(source, image.file))).ensureAlpha().raw().toBuffer();
  const manifest = JSON.parse(await readFile(join(directory, 'png', 'prepared.json')));
  const candidate = manifest.cases.find((entry) => entry.case === image.case);
  const processed = await sharp(await readFile(join(directory, 'png', candidate.file))).ensureAlpha().raw().toBuffer();
  losslessPixels.push({ caseId: image.case, exact: original.equals(processed), sourcePixelsSha256: hash(original),
    encodedPixelsSha256: hash(processed) });
}
const output = { version: 1, classification: 'TEST_ONLY', measurement: 'TEMPLATE_REGION_TEXT_AND_BYTES',
  productOcrCertified: false, independentRealSamples: 0, comparisonSha256: hash(comparisonBytes), groups, losslessPixels };
await writeFile(join(directory, 'summary.json'), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ groups, exactPngReceiptPixels: losslessPixels.filter((row) => row.exact).length,
  pngReceiptImages: losslessPixels.length })}\n`);
