import type { Recipe } from '../types';
import { resolveRecipeArtworkV4 } from '../v4/visual-artwork';

/**
 * Curated culinary title dictionary fixing machine-translated, typo, or clipped recipe names
 * across legacy and imported catalog batches into natural, appetizing Vietnamese phrasing.
 */
const EXACT_CULINARY_TITLE_OVERRIDES: Readonly<Record<string, string>> = {
  'canh cà chua trứng nhà lá': 'Canh cà chua trứng vân mây hành lá',
  'gà kho gừng ớt hiếm': 'Gà ta kho gừng ớt hiểm cay ấm',
  'canh su su băm thịt': 'Canh su su nấu thịt bằm ngọt thanh',
  'gà parmigiana nướng': 'Ức gà đút lò phô mai sốt cà Ý (Parmigiana)',
  'cơm trộn trứng tan nhật': 'Cơm nóng trộn trứng lòng đào kiểu Nhật (Tamago)',
  'cháo trứng trung': 'Cháo trứng gà sánh mịn gừng hành ấm bụng',
  'tôm chiên trứng mỏng': 'Tôm tươi chiên áo trứng vàng giòn',
  'mì hành dầu': 'Mì trộn dầu hành thơm béo Thượng Hải',
  'đậu phụ lạnh hành': 'Đậu phụ non ướp lạnh sốt xì dầu hành hoa',
  'viên thịt chiên trung': 'Thịt viên chiên vàng sốt xì dầu kiểu Hoa',
  'trứng chiên tròn hàn': 'Trứng cuộn chiên mềm kiểu Hàn (Gyeran-mari)',
  'cơm bơ hành nhật': 'Cơm nóng trộn bơ tỏi hành lá kiểu Nhật',
  'mì lạnh gà trung': 'Mì lạnh gà xé sốt mè cay kiểu Hoa',
  'salad mì ý nguội': 'Salad nui Ý trộn rau củ dầu ô liu thanh mát',
  'sườn hầm galbi hàn': 'Sườn bò hầm tương ngọt kiểu Hàn (Galbi-jjim)',
  'canh tương đậu hàn': 'Canh tương đậu nành đậu phụ kiểu Hàn (Doenjang)',
  'trứng hấp hàn': 'Trứng hấp thố đất phồng mịn kiểu Hàn (Gyeran-jjim)',
  'canh trứng hàn': 'Canh trứng vân mây hành lá kiểu Hàn',
  'cơm nấm hàn': 'Cơm thố nấm đông cô dầu mè kiểu Hàn',
  'gà luộc hành lá': 'Gà ta luộc rưới dầu hành gừng thơm mềm',
  'gà xiên yakitori hành': 'Gà xiên nướng sốt Teriyaki hành boa-rô (Yakitori)',
  'mì udon bò hành': 'Mì Udon thịt bò hành lá nước dùng thanh ngọt',
  'rau bina trộn mè nhật': 'Cải bó xôi trộn sốt mè rang kiểu Nhật (Goma-ae)',
  'bông cải trộn mè nhật': 'Bông cải xanh trộn sốt mè rang kiểu Nhật',
  'bắp cải trộn mè nhật': 'Salad bắp cải thái chỉ sốt mè rang kiểu Nhật',
  'mì ý nấm kem': 'Mì Ý sốt kem nấm tươi béo mịn',
  'mì ý carbonara ba chỉ': 'Mì Ý sốt kem trứng thịt xông khói (Carbonara)',
  'mì ý bò bằm bologna': 'Mì Ý sốt bò bằm cà chua truyền thống (Bolognese)',
  'risotto gà hành': 'Cơm Ý Risotto gà áp chảo kem nấm thơm béo',
};

const SHORTHAND_CATEGORY_MAP: Readonly<Record<string, string>> = {
  man: 'mon_kho',
  canh: 'mon_canh',
  xao: 'mon_xao',
  'com-bun': 'mon_bun_pho',
  chay: 'mon_chay',
};

function cleanWhitespaceAndUnicode(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function fixCommonVietnameseCulinaryTypos(text: string): string {
  return text
    .replace(/nhà lá/gi, (match) => (match[0] === 'N' ? 'Hành lá' : 'hành lá'))
    .replace(/ớt hiếm/gi, (match) => (match[0] === 'Ớ' ? 'Ớt hiểm' : 'ớt hiểm'))
    .replace(/\bbăm thịt\b/gi, 'nấu thịt bằm');
}

/**
 * Normalizes a raw recipe title into clean, natural Vietnamese culinary typography.
 */
export function standardizeRecipeTitleV5(rawTitle: string): string {
  const cleaned = cleanWhitespaceAndUnicode(rawTitle);
  if (!cleaned) return cleaned;

  const lookupKey = cleaned.toLocaleLowerCase('vi-VN');
  const exactOverride = EXACT_CULINARY_TITLE_OVERRIDES[lookupKey];
  if (exactOverride) {
    return exactOverride.normalize('NFC');
  }

  let polished = fixCommonVietnameseCulinaryTypos(cleaned);

  // Smooth clipped trailing country adjectives ("... Trung" -> "... kiểu Hoa", "... Hàn" -> "... kiểu Hàn", etc.)
  if (!/\bkiểu\s+(?:Trung|Hàn|Nhật|Thái|Ý)$/i.test(polished)) {
    polished = polished
      .replace(/\s+Trung$/u, ' kiểu Hoa')
      .replace(/\s+Hàn$/u, ' kiểu Hàn')
      .replace(/\s+Nhật$/u, ' kiểu Nhật')
      .replace(/\s+Thái$/u, ' kiểu Thái')
      .replace(/(?<!Mì|mì|Nui|nui)\s+Ý$/u, ' kiểu Ý');
  }

  polished = cleanWhitespaceAndUnicode(polished);
  return polished.charAt(0).toLocaleUpperCase('vi-VN') + polished.slice(1);
}

/**
 * Standardizes a recipe's title, description typography, category alias, and live-action V5 dish photo URL
 * without mutating the input object.
 */
export function standardizeRecipeCulinaryV5(recipe: Recipe): Recipe {
  const normalizedTitle = standardizeRecipeTitleV5(recipe.title);
  const normalizedDescription = fixCommonVietnameseCulinaryTypos(
    cleanWhitespaceAndUnicode(recipe.description ?? ''),
  );
  const normalizedCategory = recipe.category
    ? (SHORTHAND_CATEGORY_MAP[recipe.category] ?? recipe.category)
    : recipe.category;

  const hasCuratedV5Photo =
    typeof recipe.imageUrl === 'string' && recipe.imageUrl.trim().startsWith('/takolio/v5/dishes/');

  const resolvedImageUrl = hasCuratedV5Photo
    ? recipe.imageUrl.trim()
    : resolveRecipeArtworkV4({
        id: recipe.id,
        slug: recipe.slug,
        title: normalizedTitle,
        cuisine: recipe.cuisine,
        category: normalizedCategory,
        tags: recipe.tags,
      }).url;

  return {
    ...recipe,
    title: normalizedTitle,
    description: normalizedDescription,
    ...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
    imageUrl: resolvedImageUrl,
  };
}
