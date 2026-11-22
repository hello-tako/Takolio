import type { StandardUnit } from './units';

export type DisplayUnitSystem = 'metric' | 'imperial';

export interface FormattedMeasure {
  quantity: number;
  unit: string;
  text: string;
}

const MASS_GRAMS_PER_OZ = 28.349523125;
const MASS_GRAMS_PER_LB = 453.59237;
const VOL_ML_PER_TSP = 4.92892;
const VOL_ML_PER_TBSP = 14.7868;
const VOL_ML_PER_FL_OZ = 29.5735;
const VOL_ML_PER_CUP = 236.588;

const UNIT_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  vi: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'lít',
    piece: 'quả/cái',
    pack: 'gói',
    bunch: 'bó',
    slice: 'lát',
    oz: 'oz',
    lb: 'lb',
    tsp: 'muỗng cà phê',
    tbsp: 'muỗng canh',
    fl_oz: 'fl oz',
    cup: 'cốc',
  },
  en: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    piece: 'pcs',
    pack: 'pack',
    bunch: 'bunch',
    slice: 'slice',
    oz: 'oz',
    lb: 'lb',
    tsp: 'tsp',
    tbsp: 'tbsp',
    fl_oz: 'fl oz',
    cup: 'cup',
  },
  ja: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    piece: '個',
    pack: 'パック',
    bunch: '束',
    slice: '切れ',
    oz: 'oz',
    lb: 'lb',
    tsp: '小さじ',
    tbsp: '大さじ',
    fl_oz: 'fl oz',
    cup: 'カップ',
  },
  ko: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    piece: '개',
    pack: '팩',
    bunch: '단',
    slice: '조각',
    oz: 'oz',
    lb: 'lb',
    tsp: '작은술',
    tbsp: '큰술',
    fl_oz: 'fl oz',
    cup: '컵',
  },
  th: {
    g: 'กรัม',
    kg: 'กก.',
    ml: 'มล.',
    l: 'ลิตร',
    piece: 'ชิ้น',
    pack: 'แพ็ค',
    bunch: 'กำ',
    slice: 'แผ่น',
    oz: 'ออนซ์',
    lb: 'ปอนด์',
    tsp: 'ช้อนชา',
    tbsp: 'ช้อนโต๊ะ',
    fl_oz: 'fl oz',
    cup: 'ถ้วย',
  },
  zh: {
    g: '克',
    kg: '千克',
    ml: '毫升',
    l: '升',
    piece: '个',
    pack: '包',
    bunch: '把',
    slice: '片',
    oz: '盎司',
    lb: '磅',
    tsp: '茶匙',
    tbsp: '汤匙',
    fl_oz: '液盎司',
    cup: '杯',
  },
  it: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    piece: 'pz',
    pack: 'conf.',
    bunch: 'mazzo',
    slice: 'fette',
    oz: 'oz',
    lb: 'lb',
    tsp: 'cucchiaino',
    tbsp: 'cucchiaio',
    fl_oz: 'fl oz',
    cup: 'tazza',
  },
};

function roundKitchen(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 2) / 2;
  return Math.round(n * 4) / 4;
}

function formatKitchenNumber(n: number): string {
  const rounded = roundKitchen(n);
  if (Number.isInteger(rounded)) return String(rounded);
  return Number(rounded.toFixed(2)).toString();
}

export function localizedUnitLabel(unit: string, locale: string): string {
  const lang = locale.toLowerCase().split(/[-_]/)[0] || 'en';
  const map = UNIT_LABELS[lang] ?? UNIT_LABELS.en;
  return map[unit] ?? unit;
}

/**
 * Deterministic display-layer conversion keeping metric domain quantities intact.
 * Converts metric mass (g/kg) and volume (ml/l) to kitchen-friendly imperial (oz/lb, tsp/tbsp/fl oz/cup).
 * Contextual units (`piece`, `pack`, `bunch`, `slice`) remain unchanged and localized.
 */
export function formatDisplayQuantity(
  quantity: number,
  unit: StandardUnit | string,
  system: DisplayUnitSystem,
  locale = 'vi',
): FormattedMeasure {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;

  if (system === 'metric') {
    if (unit === 'g' && safeQty >= 1000) {
      const kg = safeQty / 1000;
      const label = localizedUnitLabel('kg', locale);
      return { quantity: roundKitchen(kg), unit: 'kg', text: `${formatKitchenNumber(kg)} ${label}` };
    }
    if (unit === 'ml' && safeQty >= 1000) {
      const l = safeQty / 1000;
      const label = localizedUnitLabel('l', locale);
      return { quantity: roundKitchen(l), unit: 'l', text: `${formatKitchenNumber(l)} ${label}` };
    }
    const label = localizedUnitLabel(unit, locale);
    return { quantity: roundKitchen(safeQty), unit, text: `${formatKitchenNumber(safeQty)} ${label}` };
  }

  // Imperial presentation conversion from metric canonical base
  if (unit === 'g' || unit === 'kg') {
    const grams = unit === 'kg' ? safeQty * 1000 : safeQty;
    if (grams >= MASS_GRAMS_PER_LB) {
      const lbs = grams / MASS_GRAMS_PER_LB;
      const label = localizedUnitLabel('lb', locale);
      return { quantity: roundKitchen(lbs), unit: 'lb', text: `${formatKitchenNumber(lbs)} ${label}` };
    }
    const oz = grams / MASS_GRAMS_PER_OZ;
    const label = localizedUnitLabel('oz', locale);
    return { quantity: roundKitchen(oz), unit: 'oz', text: `${formatKitchenNumber(oz)} ${label}` };
  }

  if (unit === 'ml' || unit === 'l') {
    const ml = unit === 'l' ? safeQty * 1000 : safeQty;
    if (ml >= VOL_ML_PER_CUP * 0.5) {
      const cups = ml / VOL_ML_PER_CUP;
      const label = localizedUnitLabel('cup', locale);
      return { quantity: roundKitchen(cups), unit: 'cup', text: `${formatKitchenNumber(cups)} ${label}` };
    }
    if (ml >= VOL_ML_PER_FL_OZ * 1.5) {
      const flOz = ml / VOL_ML_PER_FL_OZ;
      const label = localizedUnitLabel('fl_oz', locale);
      return { quantity: roundKitchen(flOz), unit: 'fl_oz', text: `${formatKitchenNumber(flOz)} ${label}` };
    }
    if (ml >= VOL_ML_PER_TBSP * 0.75) {
      const tbsp = ml / VOL_ML_PER_TBSP;
      const label = localizedUnitLabel('tbsp', locale);
      return { quantity: roundKitchen(tbsp), unit: 'tbsp', text: `${formatKitchenNumber(tbsp)} ${label}` };
    }
    const tsp = ml / VOL_ML_PER_TSP;
    const label = localizedUnitLabel('tsp', locale);
    return { quantity: roundKitchen(tsp), unit: 'tsp', text: `${formatKitchenNumber(tsp)} ${label}` };
  }

  const label = localizedUnitLabel(unit, locale);
  return { quantity: roundKitchen(safeQty), unit, text: `${formatKitchenNumber(safeQty)} ${label}` };
}

/**
 * Converts Celsius temperature mentions (e.g., "180°C", "4°C") in cooking step text to Fahrenheit when imperial is selected.
 */
export function convertStepTemperatures(text: string, system: DisplayUnitSystem): string {
  if (system !== 'imperial') return text;
  return text.replace(/(\d{1,3})\s*°\s*C\b/g, (_match, rawC: string) => {
    const c = Number(rawC);
    if (!Number.isFinite(c)) return _match;
    const f = Math.round((c * 9) / 5 + 32);
    return `${f}°F`;
  });
}
