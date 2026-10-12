import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { hash } from './score.mjs';
import sharp from 'sharp';

export async function verifySyntheticImages(directory, prepared, dataset) {
  if (prepared.classification !== 'TEST_ONLY' || dataset.classification !== 'TEST_ONLY'
    || prepared.datasetId !== dataset.datasetId) throw new Error('SYNTHETIC_MATRIX_INVALID');
  const rows = new Map(dataset.cases.map((row) => [row.caseId, row]));
  if (rows.size !== dataset.cases.length) throw new Error('SYNTHETIC_MATRIX_INVALID');
  const seen = new Set();
  for (const image of prepared.cases) {
    if (seen.has(image.case) || basename(image.file) !== image.file) throw new Error('SYNTHETIC_MATRIX_INVALID');
    seen.add(image.case);
    const bytes = await readFile(join(directory, image.file));
    if (bytes.length !== image.bytes || hash(bytes) !== image.sha256) throw new Error('SYNTHETIC_IMAGE_HASH_MISMATCH');
    if (image.expectedFailure) {
      let failed = false;
      try { await sharp(bytes).toBuffer(); } catch { failed = true; }
      if (!failed) throw new Error('SYNTHETIC_DAMAGED_IMAGE_UNEXPECTEDLY_VALID');
      continue;
    }
    const row = rows.get(image.case);
    const meta = await sharp(bytes).metadata();
    if (!row || row.documentId !== image.documentId || row.task !== image.task || row.locale !== image.locale
      || row.quality !== image.variant || row.preprocessingSha256 !== image.sha256
      || meta.width !== image.width || meta.height !== image.height || meta.format !== image.format
      || row.assetKind !== 'SYNTHETIC_IMAGE') throw new Error('SYNTHETIC_IMAGE_BINDING_MISMATCH');
  }
  if (dataset.cases.some((row) => !seen.has(row.caseId))) throw new Error('SYNTHETIC_MATRIX_INVALID');
  return { images: prepared.cases.length, annotated: dataset.cases.length,
    documents: new Set(dataset.cases.map((row) => row.documentId)).size };
}
