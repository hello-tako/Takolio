import { createHash } from 'node:crypto';
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalized = (text) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
const compact = (text) => normalized(text).replace(/\s+/g, '');
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = next;
  }
  return previous[b.length];
}
function sourceCenter(observation, image) {
  const x = (observation.x + observation.width / 2) * image.width - image.width / 2;
  const y = (1 - observation.y - observation.height / 2) * image.height - image.height / 2;
  const angle = image.angle * Math.PI / 180;
  return { x: Math.cos(angle) * x + Math.sin(angle) * y + image.sourceWidth / 2,
    y: -Math.sin(angle) * x + Math.cos(angle) * y + image.sourceHeight / 2 };
}
export function scoreTextMatrix(prepared, results, preparedHash) {
  if (prepared.classification !== 'TEST_ONLY' || results.classification !== 'TEST_ONLY'
    || results.engine !== 'Apple Vision VNRecognizeTextRequest' || results.datasetId !== prepared.datasetId
    || results.semanticFridgeRecognitionMeasured !== false || results.preparedSha256 !== preparedHash
    || !Array.isArray(results.runs) || results.runs.length !== prepared.cases.length) throw new Error('SYNTHETIC_RESULTS_INVALID');
  const images = new Map(prepared.cases.map((image) => [image.case, image]));
  if (images.size !== prepared.cases.length) throw new Error('SYNTHETIC_MATRIX_INVALID');
  const seen = new Set();
  const scores = results.runs.map((run) => {
    const image = images.get(run.case);
    if (!image || seen.has(run.case) || run.variant !== image.variant || run.imageSha256 !== image.sha256
      || !Number.isFinite(run.latencyMs) || run.latencyMs < 0 || !['output', 'decode_or_recognition_error'].includes(run.status)
      || !Array.isArray(run.observations) || (run.status !== 'output' && run.observations.length)) throw new Error('SYNTHETIC_RESULTS_INVALID');
    seen.add(run.case);
    for (const observation of run.observations) {
      if (typeof observation.text !== 'string' || !['x', 'y', 'width', 'height', 'confidence'].every((field) =>
        Number.isFinite(observation[field]) && observation[field] >= 0 && observation[field] <= 1)) throw new Error('SYNTHETIC_RESULTS_INVALID');
    }
    const regions = image.regions.filter((region) => region.role !== 'header');
    const assigned = regions.map(() => []);
    for (const observation of run.observations) {
      const center = sourceCenter(observation, image);
      const matches = regions.map((region, index) => ({ region, index }))
        .filter(({ region }) => center.x >= region.x - 10 && center.x <= region.x + region.width + 10
          && center.y >= region.y - 10 && center.y <= region.y + region.height + 10)
        .sort((a, b) => Math.abs(center.y - a.region.y - a.region.height / 2)
          - Math.abs(center.y - b.region.y - b.region.height / 2));
      // One observed fragment can support only one occurrence/field region.
      if (matches.length) assigned[matches[0].index].push(observation);
    }
    const fields = regions.map((region, index) => {
      const candidates = assigned[index].sort((a, b) => a.x - b.x);
      const text = candidates.map((entry) => entry.text).join(' ');
      return { role: region.role, position: region.position, expected: region.text, recognized: text,
        exact: normalized(text) === normalized(region.text), compactExact: compact(text) === compact(region.text),
        edits: distance(normalized(region.text), normalized(text)), characters: normalized(region.text).length };
    });
    return { caseId: run.case, documentId: image.documentId, task: image.task, locale: image.locale,
      quality: image.variant, status: run.status, latencyMs: run.latencyMs,
      expectedFailure: image.expectedFailure === true, expectedFields: fields.length,
      exactFields: fields.filter((field) => field.exact).length,
      compactExactFields: fields.filter((field) => field.compactExact).length,
      edits: fields.reduce((sum, field) => sum + field.edits, 0),
      characters: fields.reduce((sum, field) => sum + field.characters, 0), fields };
  });
  const slices = [];
  for (const key of new Set(scores.map((score) => `${score.task}:${score.locale}:${score.quality}`))) {
    const rows = scores.filter((score) => `${score.task}:${score.locale}:${score.quality}` === key);
    const expectedFields = rows.reduce((sum, row) => sum + row.expectedFields, 0);
    const characters = rows.reduce((sum, row) => sum + row.characters, 0);
    slices.push({ slice: key, images: rows.length, documents: new Set(rows.map((row) => row.documentId)).size,
      expectedFields, exactFields: rows.reduce((sum, row) => sum + row.exactFields, 0),
      compactExactFields: rows.reduce((sum, row) => sum + row.compactExactFields, 0),
      characterErrorRate: characters ? rows.reduce((sum, row) => sum + row.edits, 0) / characters : null,
      failures: rows.filter((row) => row.status !== 'output').length });
  }
  return { version: 1, classification: 'TEST_ONLY', engine: results.engine, datasetId: prepared.datasetId,
    imageCount: scores.length, originalDocuments: new Set(scores.filter((row) => !row.expectedFailure).map((row) => row.documentId)).size,
    productOcrCertified: false, semanticFridgeRecognitionMeasured: false,
    measurement: 'Template-region text extraction; not item/field semantic or product pipeline accuracy', slices, scores };
}
