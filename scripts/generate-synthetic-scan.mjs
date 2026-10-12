#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { makeSources, annotation, SEED, DATASET_ID, QUALITIES } from './synthetic-scan/source.mjs';
import { renderScene, renderPixels } from './synthetic-scan/render.mjs';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function generateSyntheticScan(directory) {
  const output = resolve(directory);
  await mkdir(output, { recursive: true, mode: 0o700 });
  const fontFiles = { ja: 'qa/ocr/synthetic-v3/fonts/noto-sans-jp-test-subset.ttf',
    vi: 'tests/e2e/t17-ui/fonts/nunito-400.ttf', en: 'tests/e2e/t17-ui/fonts/nunito-400.ttf' };
  const fonts = await Promise.all([...new Set(Object.values(fontFiles))].map(async (path) => ({ path, sha256: hash(await readFile(path)) })));
  const provenance = JSON.parse(await readFile('qa/ocr/synthetic-v3/fonts/provenance.json'));
  if (fonts.find((font) => font.path === fontFiles.ja)?.sha256 !== provenance.subsetSha256) throw new Error('SYNTHETIC_FONT_HASH_MISMATCH');
  const sources = makeSources();
  // The source-first transcript is written before rasterization or OCR execution.
  await writeFile(join(output, 'sources.json'), `${JSON.stringify({ seed: SEED, classification: 'TEST_ONLY', sources }, null, 2)}\n`, { mode: 0o600 });
  const sourceAnnotations = sources.flatMap((source) => QUALITIES.map((quality) => ({
    caseId: `${source.id}-${quality}`, quality, groundTruth: annotation(source, quality),
    regions: renderScene(source, quality).regions,
  })));
  await writeFile(join(output, 'annotations.source.json'), `${JSON.stringify({ classification: 'TEST_ONLY', cases: sourceAnnotations }, null, 2)}\n`, { mode: 0o600 });
  const dataset = { schemaVersion: 1, datasetId: DATASET_ID, classification: 'TEST_ONLY', cases: [] };
  const prepared = { version: 1, datasetId: DATASET_ID, classification: 'TEST_ONLY', seed: SEED,
    renderer: { sharp: sharp.versions.sharp, pango: sharp.versions.pango, vips: sharp.versions.vips },
    fonts, cases: [] };
  for (const source of sources) {
    const originalScene = renderScene(source, 'clean');
    const original = await renderPixels(originalScene, resolve(fontFiles[source.locale]));
    for (const quality of QUALITIES) {
      const scene = quality === 'missing_field' ? renderScene(source, quality) : originalScene;
      let pixels = quality === 'missing_field' ? await renderPixels(scene, resolve(fontFiles[source.locale])) : original;
      let pipeline = sharp(pixels);
      if (quality === 'blur') pipeline = pipeline.blur(1.9);
      if (quality === 'tilt') pipeline = pipeline.rotate(7, { background: '#d9d6cd' });
      if (quality === 'low_light') pipeline = pipeline.linear(.30, 4);
      pixels = quality === 'clean' || quality === 'missing_field' ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 72 }).toBuffer();
      const metadata = await sharp(pixels).metadata();
      const caseId = `${source.id}-${quality}`;
      const filename = `${caseId}.${metadata.format === 'png' ? 'png' : 'jpg'}`;
      await writeFile(join(output, filename), pixels, { mode: 0o600 });
      const groundTruth = annotation(source, quality);
      if (quality === 'tilt' && source.kind === 'fridge') {
        const angle = 7 * Math.PI / 180;
        for (const item of groundTruth.items) {
          if (item.rawName.state !== 'known') continue;
          for (const evidence of item.rawName.evidence) {
            if (evidence.kind !== 'source_region') continue;
            const region = evidence.region;
            const corners = [0, 1].flatMap((dx) => [0, 1].map((dy) => {
              const x = (region.x + dx * region.width) * scene.width - scene.width / 2;
              const y = (region.y + dy * region.height) * scene.height - scene.height / 2;
              return { x: (Math.cos(angle) * x - Math.sin(angle) * y + metadata.width / 2) / metadata.width,
                y: (Math.sin(angle) * x + Math.cos(angle) * y + metadata.height / 2) / metadata.height };
            }));
            const x = Math.min(...corners.map((point) => point.x));
            const y = Math.min(...corners.map((point) => point.y));
            evidence.region = { x, y, width: Math.max(...corners.map((point) => point.x)) - x,
              height: Math.max(...corners.map((point) => point.y)) - y };
          }
        }
      }
      const transcript = JSON.stringify({ regions: scene.regions, groundTruth });
      dataset.cases.push({ caseId, assetId: `${caseId}-asset`, documentId: source.id,
        sourceGroupId: `${source.id}-source`, task: groundTruth.task, locale: source.locale,
        country: source.country, quality, split: source.split, assetSha256: hash(original),
        preprocessingSha256: hash(pixels), preprocessingVersion: 'synthetic-render-v1',
        assetKind: 'SYNTHETIC_IMAGE', provenance: `synthetic://seed-${SEED}/${source.id}`,
        licenseReference: 'REPOSITORY_GENERATED_SYNTHETIC', permissionReference: 'USER_REQUEST_2026-10-12',
        retentionPolicy: 'LOCAL_IGNORED_TEST_ARTIFACTS', accessPolicy: 'LOCAL_ONLY',
        redactionStatus: 'SYNTHETIC_NO_PII', annotation: { schemaVersion: 1, status: 'TEST_ONLY',
          reviewer: 'MISSING', adjudicator: 'MISSING', transcriptSha256: hash(transcript),
          providerOutputIndependent: true, groundTruth } });
      prepared.cases.push({ case: caseId, variant: quality, documentId: source.id, task: groundTruth.task,
        locale: source.locale, file: filename, bytes: pixels.length, width: metadata.width, height: metadata.height,
        sha256: hash(pixels), format: metadata.format, sourceWidth: scene.width, sourceHeight: scene.height,
        angle: quality === 'tilt' ? 7 : 0, regions: scene.regions });
    }
  }
  const damaged = Buffer.from('SYNTHETIC TEST ONLY - intentionally damaged JPEG');
  await writeFile(join(output, 'damaged.jpg'), damaged, { mode: 0o600 });
  prepared.cases.push({ case: 'damaged-image', variant: 'damaged', documentId: 'damaged-image',
    task: 'receipt_ocr', locale: 'en', file: 'damaged.jpg', bytes: damaged.length, sha256: hash(damaged),
    expectedFailure: true, regions: [] });
  for (const [filename, value] of [['dataset.json', dataset], ['prepared.json', prepared]]) {
    await writeFile(join(output, filename), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  }
  return { originals: sources.length, variants: dataset.cases.length, damaged: 1, output };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${JSON.stringify(await generateSyntheticScan(process.argv[2] || '.artifacts/scan-synthetic-v3'))}\n`);
}
