export const SEED = 20261012;
export const DATASET_ID = 'synthetic-scan-images-20261012-v1';
export const QUALITIES = ['clean', 'blur', 'tilt', 'low_light', 'missing_field'];
const vn = [
  ['CÀ CHUA', '1 KG', 42000], ['THỊT BÒ', '500 G', 119000],
  ['TRỨNG GÀ', '10 PIECE', 36000], ['SỮA TƯƠI', '1 L', 32000],
  ['ĐẬU PHỤ', '3 PIECE', 21000], ['RAU CẢI', '2 BUNCH', 26000],
];
const jp = [
  ['トマト', '1 PIECE', 198], ['牛乳', '1 L', 238], ['卵', '10 PIECE', 298],
  ['豆腐', '2 PIECE', 156], ['にんじん', '3 PIECE', 180], ['りんご', '2 PIECE', 320],
];
const clone = (value) => structuredClone(value);
export const unknown = (reason = 'missing') => ({ state: 'unknown', reason });
export const unknownQuantity = () => Object.fromEntries(['amount', 'unit', 'basis', 'sourceText'].map((key) => [key, unknown('not_observable')]));
export function known(value, documentId, sourcePosition, text) {
  return { state: 'known', value, basis: 'source_extraction',
    evidence: [{ kind: 'source_text', documentId, sourcePosition, text }] };
}
function quantity(text, id, position, basis = 'purchased_measure') {
  if (!text) return unknownQuantity();
  const [amount, unit] = text.split(' ');
  return { amount: known(Number(amount), id, position, text),
    unit: known(unit.toLowerCase(), id, position, text),
    basis: known(['PIECE', 'BUNCH'].includes(unit) ? 'purchase_count' : basis, id, position, text),
    sourceText: known(text, id, position, text) };
}
function item(name, qty, id, position) {
  return { occurrenceId: `${id}-item-${position}`, sourcePosition: position,
    rawName: known(name, id, position, name), quantity: quantity(qty, id, position),
    canonicalId: unknown('unverified'), confidence: unknown('not_reported'),
    category: unknown('unverified'), storage: unknown('not_observable') };
}
export function makeSources() {
  const sources = [];
  for (const locale of ['vi', 'ja']) {
    for (let index = 0; index < 6; index++) {
      const id = `syn-${locale}-receipt-${index}`;
      const rows = clone(locale === 'vi' ? vn : jp);
      // Two identical purchases are two occurrences, including equal quantity/price.
      rows.splice(2, 0, clone(rows[0]));
      rows[3][2] += index * (locale === 'vi' ? 1000 : 10);
      sources.push({ id, kind: 'receipt', locale, country: locale === 'vi' ? 'VN' : 'JP',
        currency: locale === 'vi' ? 'VND' : 'JPY', rows,
        split: index < 3 ? 'calibration' : 'heldout' });
    }
  }
  for (let index = 0; index < 6; index++) {
    const locale = index % 2 ? 'ja' : 'vi';
    sources.push({ id: `syn-label-${index}`, kind: 'label', locale,
      country: locale === 'vi' ? 'VN' : 'JP', name: locale === 'vi' ? 'SỮA TƯƠI' : '牛乳',
      net: `${250 + index * 50} ML`, expiry: '2026-12-31',
      split: index < 3 ? 'calibration' : 'heldout' });
    sources.push({ id: `syn-fridge-${index}`, kind: 'fridge', locale: 'en', country: 'OTHER',
      scene: index, split: index < 3 ? 'calibration' : 'heldout' });
  }
  return sources;
}
export function annotation(source, quality) {
  const id = source.id;
  const missing = quality === 'missing_field';
  const document = { documentId: id, sourceId: `${id}-source` };
  if (source.kind === 'receipt') {
    const items = source.rows.map(([name, qty, price], position) => ({
      ...item(name, missing && position === 1 ? null : qty, id, position),
      unitPrice: unknown(), lineTotal: missing && position === 1 ? unknown() : known(
        { amountMinor: price, currency: source.currency }, id, position, `${price.toLocaleString('en-US')} ${source.currency}`),
      tax: unknown(), discount: unknown(),
    }));
    return { schemaVersion: 3, task: 'receipt_ocr', document, items,
      merchantName: known('TAKOSAN QA MART', id, 0, 'TAKOSAN QA MART'),
      invoiceNumber: unknown(), purchaseDate: unknown(), tax: unknown(), discount: unknown(),
      totalAmount: missing ? unknown() : known({ amountMinor: source.rows.reduce((sum, row) => sum + row[2], 0),
        currency: source.currency }, id, 0, `${source.rows.reduce((sum, row) => sum + row[2], 0).toLocaleString('en-US')} ${source.currency}`) };
  }
  if (source.kind === 'label') {
    const labelItem = item(source.name, null, id, 0);
    const netQuantity = missing ? unknownQuantity() : quantity(source.net, id, 0, 'package_content');
    return { schemaVersion: 3, task: 'label_ocr', document, items: [labelItem],
      productionDate: unknown(), expiryDate: missing ? unknown() : known(source.expiry, id, 0, source.expiry), netQuantity };
  }
  // Drawn objects suggest identity but do not prove count/mass or hidden contents.
  const regions = [
    { x: 125 / 1080, y: 200 / 1080, width: 150 / 1080, height: 200 / 1080 },
    { x: (363 + source.scene * 7) / 1080, y: 285 / 1080, width: 275 / 1080, height: 120 / 1080 },
    { x: 630 / 1080, y: 513 / 1080, width: 270 / 1080, height: 162 / 1080 },
    { x: 150 / 1080, y: 740 / 1080, width: 350 / 1080, height: 170 / 1080 },
  ];
  const names = ['milk carton', 'tomato', 'covered container', 'leafy vegetables'];
  const items = regions.map((region, position) => ({
    ...item(names[position], null, id, position),
    rawName: position === 2 || (missing && position === 3) ? unknown('not_observable') : {
      state: 'known', value: names[position], basis: 'visual_observation',
      evidence: [{ kind: 'source_region', documentId: id, sourcePosition: position, region }] },
  }));
  return { schemaVersion: 3, task: 'fridge_image_analysis', document, items };
}
