import type { CanonicalIngredient } from './index';
import { CANONICAL_INGREDIENTS } from './index';
import { normalizeMultilingualText, type SupportedLocale } from './i18n';

/**
 * Japanese 5-zone refrigerator topology (5ドア冷蔵庫) + pantry:
 * - fridge: 冷蔵室 (2°C..5°C) — dairy, eggs, tofu, natto, prepared dishes
 * - veg_crisper: 野菜室 (3°C..8°C, high humidity) — leafy greens, root vegetables, tomatoes
 * - chilled: チルド室 / パーシャル (-1°C..1°C) — raw meat, raw fish/sashimi, fresh poultry
 * - freezer: 冷凍室 (-18°C) — frozen meats, frozen seafood, frozen udon
 * - pantry: 常温 — dry grains, pasta, canned goods, cooking oils, condiments
 */
export const STORAGE_ZONES = ['fridge', 'veg_crisper', 'chilled', 'freezer', 'pantry'] as const;
export type StorageZone = (typeof STORAGE_ZONES)[number];

/** Maps a granular 5-zone storage bucket to the 3 core lot-authority storage types. */
export function toCoreStorageBucket(zone: StorageZone): 'fridge' | 'freezer' | 'pantry' {
  if (zone === 'freezer') return 'freezer';
  if (zone === 'pantry') return 'pantry';
  return 'fridge';
}

export interface GlobalIngredientMetadata {
  readonly ingredient: CanonicalIngredient;
  readonly preferredStorageZone: StorageZone;
  readonly localizedNames: Partial<Record<SupportedLocale, string>>;
}

/**
 * Extended canonical ingredients for Japan (Washoku/Yoshoku/Chuka) and Europe
 * (DACH/FR/IT/ES/UK/NL/PL/Nordics). Kept separate from the frozen 45-entry V1
 * `CANONICAL_INGREDIENTS` literal so V1 catalog release proofs remain bit-identical,
 * while global OCR, JAN/EAN barcode lookup, allergen safety, and unit conversion
 * distinguish allergen-critical ingredients (e.g. SESAME_OIL != COOKING_OIL,
 * SOBA_BUCKWHEAT != UDON_WHEAT, CLAM_MUSSEL != SHRIMP).
 */
export const GLOBAL_EXTENDED_INGREDIENT_METADATA: readonly GlobalIngredientMetadata[] = Object.freeze([
  // OILS, CONDIMENTS & FERMENTED BASES
  {
    ingredient: {
      id: 'SESAME_OIL',
      nameVi: 'Dầu mè',
      nameEn: 'Sesame oil',
      aliases: ['dầu vừng', 'dầu mè thơm', 'sesame oil', 'toasted sesame oil'],
      category: 'spice',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 365,
      icon: '🫗',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'ごま油', de: 'Sesamöl', fr: 'Huile de sésame', es: 'Aceite de sésamo',
      it: 'Olio di sesamo', nl: 'Sesamolie', pl: 'Olej sezamowy', sv: 'Sesamolja',
    },
  },
  {
    ingredient: {
      id: 'OLIVE_OIL',
      nameVi: 'Dầu ô liu',
      nameEn: 'Olive oil',
      aliases: ['dầu oliu', 'extra virgin olive oil', 'olive oil'],
      category: 'spice',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 540,
      icon: '🫒',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'オリーブオイル', de: 'Olivenöl', fr: "Huile d'olive", es: 'Aceite de oliva',
      it: 'Olio extravergine di oliva', nl: 'Olijfolie', pl: 'Oliwa z oliwek', sv: 'Olivolja',
    },
  },
  {
    ingredient: {
      id: 'MISO',
      nameVi: 'Tương Miso',
      nameEn: 'Miso paste',
      aliases: ['miso', 'tương đậu nành nhật', 'awase miso', 'shiro miso', 'aka miso'],
      category: 'spice',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🥣',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: '味噌', de: 'Misopaste', fr: 'Pâte miso', es: 'Pasta de miso',
      it: 'Pasta di miso', nl: 'Misopasta', pl: 'Pasta miso', sv: 'Misopasta',
    },
  },
  {
    ingredient: {
      id: 'MIRIN',
      nameVi: 'Rượu Mirin',
      nameEn: 'Mirin',
      aliases: ['mirin', 'hon mirin', 'rượu ngọt nhật'],
      category: 'spice',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 365,
      icon: '🍶',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'みりん', de: 'Mirin', fr: 'Mirin', es: 'Mirin',
      it: 'Mirin', nl: 'Mirin', pl: 'Mirin', sv: 'Mirin',
    },
  },
  {
    ingredient: {
      id: 'DASHI',
      nameVi: 'Nước dùng Dashi',
      nameEn: 'Dashi stock',
      aliases: ['dashi', 'hondashi', 'katsuobushi dashi', 'bột dashi'],
      category: 'spice',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 180,
      icon: '🍲',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'だし', de: 'Dashi-Brühe', fr: 'Bouillon dashi', es: 'Caldo dashi',
      it: 'Brodo dashi', nl: 'Dashi-bouillon', pl: 'Bulion dashi', sv: 'Dashibuljong',
    },
  },
  {
    ingredient: {
      id: 'MUSTARD',
      nameVi: 'Mù tạt vàng / Dijon',
      nameEn: 'Mustard',
      aliases: ['mustard', 'dijon mustard', 'mù tạt hạt', 'senf', 'moutarde'],
      category: 'spice',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🌭',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: 'マスタード', de: 'Senf', fr: 'Moutarde', es: 'Mostaza',
      it: 'Senape', nl: 'Mosterd', pl: 'Musztarda', sv: 'Senap',
    },
  },
  {
    ingredient: {
      id: 'WINE_COOKING',
      nameVi: 'Rượu vang nấu ăn',
      nameEn: 'Cooking wine',
      aliases: ['cooking wine', 'white wine', 'red wine', 'rượu vang trắng', 'rượu sake nấu ăn'],
      category: 'spice',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 180,
      icon: '🍷',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: '料理酒・ワイン', de: 'Kochwein', fr: 'Vin de cuisine', es: 'Vino de cocina',
      it: 'Vino da cucina', nl: 'Kookwijn', pl: 'Wino kulinarne', sv: 'Matlagningsvin',
    },
  },
  // GRAINS, BREAD & REGIONAL NOODLES
  {
    ingredient: {
      id: 'SOBA_BUCKWHEAT',
      nameVi: 'Mì Soba kiều mạch',
      nameEn: 'Buckwheat soba noodles',
      aliases: ['soba', 'mì soba', 'buckwheat noodles', 'juwari soba'],
      category: 'grain',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🍜',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'そば', de: 'Buchweizennudeln (Soba)', fr: 'Nouilles soba au sarrasin', es: 'Fideos soba de trigo sarraceno',
      it: 'Spaghetti soba di grano saraceno', nl: 'Boekweitnoedels (Soba)', pl: 'Makaron gryczany soba', sv: 'Bovetnudlar (Soba)',
    },
  },
  {
    ingredient: {
      id: 'UDON_WHEAT',
      nameVi: 'Mì Udon lúa mì',
      nameEn: 'Wheat udon noodles',
      aliases: ['udon', 'mì udon', 'sanuki udon'],
      category: 'grain',
      defaultUnit: 'pack',
      defaultShelfLifeDays: 14,
      icon: '🍜',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: 'うどん', de: 'Udon-Nudeln', fr: 'Nouilles udon', es: 'Fideos udon',
      it: 'Udon', nl: 'Udonnoedels', pl: 'Makaron udon', sv: 'Udonnudlar',
    },
  },
  {
    ingredient: {
      id: 'BREAD',
      nameVi: 'Bánh mì gối / Bánh mì Âu',
      nameEn: 'Bread',
      aliases: ['bánh mì lát', 'bánh mì sandwich', 'toast bread', 'sourdough', 'baguette', 'vollkornbrot', 'shokupan'],
      category: 'grain',
      defaultUnit: 'slice',
      defaultShelfLifeDays: 5,
      icon: '🍞',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: '食パン', de: 'Brot', fr: 'Pain', es: 'Pan',
      it: 'Pane', nl: 'Brood', pl: 'Chleb', sv: 'Bröd',
    },
  },
  {
    ingredient: {
      id: 'OATS',
      nameVi: 'Yến mạch',
      nameEn: 'Rolled oats',
      aliases: ['yến mạch cán dẹt', 'oats', 'oatmeal', 'haferflocken'],
      category: 'grain',
      defaultUnit: 'g',
      defaultShelfLifeDays: 240,
      icon: '🌾',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'オートミール', de: 'Haferflocken', fr: "Flocons d'avoine", es: 'Copos de avena',
      it: "Fiocchi d'avena", nl: 'Havermout', pl: 'Płatki owsiane', sv: 'Havregryn',
    },
  },
  {
    ingredient: {
      id: 'POTATO',
      nameVi: 'Khoai tây',
      nameEn: 'Potato',
      aliases: ['khoai tây', 'potato', 'potatoes', 'kartoffeln', 'pomme de terre'],
      category: 'vegetable',
      defaultUnit: 'g',
      defaultShelfLifeDays: 21,
      icon: '🥔',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: 'じゃがいも', de: 'Kartoffeln', fr: 'Pommes de terre', es: 'Patatas',
      it: 'Patate', nl: 'Aardappelen', pl: 'Ziemniaki', sv: 'Potatis',
    },
  },
  // DAIRY
  {
    ingredient: {
      id: 'YOGURT',
      nameVi: 'Sữa chua không đường',
      nameEn: 'Plain yogurt',
      aliases: ['sữa chua', 'yogurt', 'yoghurt', 'greek yogurt', 'naturjoghurt'],
      category: 'dairy',
      defaultUnit: 'g',
      defaultShelfLifeDays: 14,
      icon: '🥛',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: 'ヨーグルト', de: 'Joghurt', fr: 'Yaourt nature', es: 'Yogur natural',
      it: 'Yogurt bianco', nl: 'Yoghurt', pl: 'Jogurt naturalny', sv: 'Yoghurt',
    },
  },
  {
    ingredient: {
      id: 'CREAM',
      nameVi: 'Kem tươi (Whipping/Cooking cream)',
      nameEn: 'Heavy cream',
      aliases: ['kem tươi', 'whipping cream', 'heavy cream', 'crème fraîche', 'sahne'],
      category: 'dairy',
      defaultUnit: 'ml',
      defaultShelfLifeDays: 10,
      icon: '🥛',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: '生クリーム', de: 'Sahne', fr: 'Crème fraîche', es: 'Nata para cocinar',
      it: 'Panna fresca', nl: 'Slagroom', pl: 'Śmietanka', sv: 'Vispgrädde',
    },
  },
  // PROTEINS, SOY & SEAFOOD (STRICT ALLERGEN SPLIT)
  {
    ingredient: {
      id: 'NATTO',
      nameVi: 'Đậu tương lên men Natto',
      nameEn: 'Natto (fermented soybeans)',
      aliases: ['natto', 'đậu nành lên men'],
      category: 'vegetable',
      defaultUnit: 'pack',
      defaultShelfLifeDays: 9,
      icon: '🫘',
    },
    preferredStorageZone: 'fridge',
    localizedNames: {
      ja: '納豆', de: 'Natto', fr: 'Natto', es: 'Natto',
      it: 'Natto', nl: 'Natto', pl: 'Natto', sv: 'Natto',
    },
  },
  {
    ingredient: {
      id: 'SOYBEAN',
      nameVi: 'Đậu nành / Edamame',
      nameEn: 'Soybeans (Edamame)',
      aliases: ['đậu nành', 'edamame', 'soybeans', 'sojabohnen'],
      category: 'vegetable',
      defaultUnit: 'g',
      defaultShelfLifeDays: 5,
      icon: '🫛',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: '枝豆・大豆', de: 'Sojabohnen (Edamame)', fr: 'Edamame (soja)', es: 'Soja (Edamame)',
      it: 'Soia (Edamame)', nl: 'Sojabonen (Edamame)', pl: 'Soja (Edamame)', sv: 'Sojabönor (Edamame)',
    },
  },
  {
    ingredient: {
      id: 'GROUND_BEEF',
      nameVi: 'Thịt bò xay',
      nameEn: 'Ground beef',
      aliases: ['bò băm', 'thịt bò xay', 'minced beef', 'rinderhackfleisch', 'boeuf haché'],
      category: 'meat',
      defaultUnit: 'g',
      defaultShelfLifeDays: 2,
      icon: '🥩',
    },
    preferredStorageZone: 'chilled',
    localizedNames: {
      ja: '牛ひき肉', de: 'Rinderhackfleisch', fr: 'Bœuf haché', es: 'Carne picada de vacuno',
      it: 'Macinato di manzo', nl: 'Rundergehakt', pl: 'Mięso mielone wołowe', sv: 'Nötfärs',
    },
  },
  {
    ingredient: {
      id: 'BACON_HAM',
      nameVi: 'Thịt xông khói / Giăm bông',
      nameEn: 'Bacon & ham',
      aliases: ['bacon', 'giăm bông', 'ham', 'schinken', 'speck', 'lardons'],
      category: 'meat',
      defaultUnit: 'g',
      defaultShelfLifeDays: 10,
      icon: '🥓',
    },
    preferredStorageZone: 'chilled',
    localizedNames: {
      ja: 'ベーコン・ハム', de: 'Schinken & Speck', fr: 'Jambon & lardons', es: 'Jamón y panceta',
      it: 'Prosciutto e pancetta', nl: 'Ham & spek', pl: 'Szynka i boczek', sv: 'Skinka & bacon',
    },
  },
  {
    ingredient: {
      id: 'MACKEREL',
      nameVi: 'Cá thu Nhật (Saba)',
      nameEn: 'Mackerel',
      aliases: ['cá saba', 'cá thu saba', 'mackerel', 'saba', 'makrele', 'maquereau'],
      category: 'seafood',
      defaultUnit: 'g',
      defaultShelfLifeDays: 2,
      icon: '🐟',
    },
    preferredStorageZone: 'chilled',
    localizedNames: {
      ja: 'さば', de: 'Makrele', fr: 'Maquereau', es: 'Caballa',
      it: 'Sgombro', nl: 'Makreel', pl: 'Makrela', sv: 'Makrill',
    },
  },
  {
    ingredient: {
      id: 'CLAM_MUSSEL',
      nameVi: 'Nghêu / Ngao / Vẹm',
      nameEn: 'Clams & mussels',
      aliases: ['nghêu', 'ngao', 'vẹm xanh', 'clams', 'mussels', 'asari', 'moules', 'muscheln'],
      category: 'seafood',
      defaultUnit: 'g',
      defaultShelfLifeDays: 2,
      icon: '🦪',
    },
    preferredStorageZone: 'chilled',
    localizedNames: {
      ja: 'あさり・ムール貝', de: 'Muscheln', fr: 'Moules & palourdes', es: 'Almejas y mejillones',
      it: 'Vongole e cozze', nl: 'Mosselen & venusschelpen', pl: 'Małże', sv: 'Musslor',
    },
  },
  {
    ingredient: {
      id: 'SALMON_ROE',
      nameVi: 'Trứng cá hồi (Ikura)',
      nameEn: 'Salmon roe',
      aliases: ['trứng cá hồi', 'ikura', 'salmon roe'],
      category: 'seafood',
      defaultUnit: 'g',
      defaultShelfLifeDays: 4,
      icon: '🟠',
    },
    preferredStorageZone: 'chilled',
    localizedNames: {
      ja: 'いくら', de: 'Lachskaviar', fr: 'Œufs de saumon', es: 'Huevas de salmón',
      it: 'Uova di salmone', nl: 'Zalmforelkaviaar', pl: 'Ikra z łososia', sv: 'Laxrom',
    },
  },
  // NUTS, SEEDS & LEGUMES (JP CAA 28 & EU ANNEX II 14)
  {
    ingredient: {
      id: 'WALNUT',
      nameVi: 'Hạt óc chó',
      nameEn: 'Walnut',
      aliases: ['óc chó', 'walnut', 'walnuts', 'walnüsse', 'noix'],
      category: 'other',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🌰',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'くるみ', de: 'Walnüsse', fr: 'Noix', es: 'Nueces',
      it: 'Noci', nl: 'Walnoten', pl: 'Orzechy włoskie', sv: 'Valnötter',
    },
  },
  {
    ingredient: {
      id: 'CASHEW',
      nameVi: 'Hạt điều',
      nameEn: 'Cashew nut',
      aliases: ['hạt điều', 'cashew', 'cashews', 'cashewkerne', 'noix de cajou'],
      category: 'other',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🥜',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'カシューナッツ', de: 'Cashewkerne', fr: 'Noix de cajou', es: 'Anacardos',
      it: 'Anacardi', nl: 'Cashewnoten', pl: 'Orzechy nerkowca', sv: 'Cashewnötter',
    },
  },
  {
    ingredient: {
      id: 'PEANUT',
      nameVi: 'Đậu phộng / Lạc',
      nameEn: 'Peanut',
      aliases: ['đậu phộng', 'hạt lạc', 'peanut', 'peanuts', 'erdnüsse', 'cacahuètes'],
      category: 'other',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🥜',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: '落花生・ピーナッツ', de: 'Erdnüsse', fr: 'Cacahuètes', es: 'Cacahuetes',
      it: 'Arachidi', nl: 'Pinda', pl: 'Orzeszki ziemne', sv: 'Jordnötter',
    },
  },
  {
    ingredient: {
      id: 'ALMOND',
      nameVi: 'Hạnh nhân',
      nameEn: 'Almond',
      aliases: ['hạnh nhân', 'almond', 'almonds', 'mandeln', 'amandes'],
      category: 'other',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🌰',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'アーモンド', de: 'Mandeln', fr: 'Amandes', es: 'Almendra',
      it: 'Mandorle', nl: 'Amandelen', pl: 'Migdały', sv: 'Mandlar',
    },
  },
  {
    ingredient: {
      id: 'SESAME_SEED',
      nameVi: 'Hạt mè / Vừng',
      nameEn: 'Sesame seeds',
      aliases: ['hạt mè', 'hạt vừng', 'sesame seeds', 'sesam', 'graines de sésame'],
      category: 'spice',
      defaultUnit: 'g',
      defaultShelfLifeDays: 240,
      icon: '🌾',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'いりごま・ごま', de: 'Sesamsamen', fr: 'Graines de sésame', es: 'Semillas de sésamo',
      it: 'Semi di sesamo', nl: 'Sesamzaad', pl: 'Ziarna sezamu', sv: 'Sesamfrön',
    },
  },
  {
    ingredient: {
      id: 'LUPIN_BEAN',
      nameVi: 'Đậu Lupin',
      nameEn: 'Lupin beans',
      aliases: ['lupin', 'lupini', 'lupinen', 'graines de lupin'],
      category: 'vegetable',
      defaultUnit: 'g',
      defaultShelfLifeDays: 180,
      icon: '🫘',
    },
    preferredStorageZone: 'pantry',
    localizedNames: {
      ja: 'ルピナス豆', de: 'Lupinen', fr: 'Lupin', es: 'Altramuces',
      it: 'Lupini', nl: 'Lupine', pl: 'Łubin', sv: 'Lupinbönor',
    },
  },
  // EUROPEAN & JAPANESE KEY VEGETABLES
  {
    ingredient: {
      id: 'CELERY',
      nameVi: 'Cần tây',
      nameEn: 'Celery',
      aliases: ['cần tây', 'celery', 'sellerie', 'céleri', 'sedano'],
      category: 'vegetable',
      defaultUnit: 'g',
      defaultShelfLifeDays: 10,
      icon: '🥬',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: 'セロリ', de: 'Sellerie', fr: 'Céleri', es: 'Apio',
      it: 'Sedano', nl: 'Selderij', pl: 'Seler naciowy', sv: 'Selleri',
    },
  },
  {
    ingredient: {
      id: 'YAM_NAGAIIMO',
      nameVi: 'Khoai mài / Nagaimo',
      nameEn: 'Japanese mountain yam',
      aliases: ['khoai mài', 'nagaimo', 'yamaimo', 'tororo'],
      category: 'vegetable',
      defaultUnit: 'g',
      defaultShelfLifeDays: 14,
      icon: '🍠',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: 'やまいも・長芋', de: 'Yamswurzel', fr: 'Igname japonais', es: 'Ñame japonés',
      it: 'Igname giapponese', nl: 'Yamwortel', pl: 'Pochrzyn', sv: 'Jamsrot',
    },
  },
  {
    ingredient: {
      id: 'BELL_PEPPER',
      nameVi: 'Ớt chuông',
      nameEn: 'Bell pepper',
      aliases: ['ớt chuông', 'paprika', 'poivron', 'bell pepper', 'piman'],
      category: 'vegetable',
      defaultUnit: 'piece',
      defaultShelfLifeDays: 8,
      icon: '🫑',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: 'ピーマン・パプリカ', de: 'Paprika', fr: 'Poivron', es: 'Pimiento',
      it: 'Peperone', nl: 'Paprika', pl: 'Papryka', sv: 'Paprika',
    },
  },
  {
    ingredient: {
      id: 'ZUCCHINI',
      nameVi: 'Bí ngòi',
      nameEn: 'Zucchini (Courgette)',
      aliases: ['bí ngòi', 'zucchini', 'courgette'],
      category: 'vegetable',
      defaultUnit: 'piece',
      defaultShelfLifeDays: 7,
      icon: '🥒',
    },
    preferredStorageZone: 'veg_crisper',
    localizedNames: {
      ja: 'ズッキーニ', de: 'Zucchini', fr: 'Courgette', es: 'Calabacín',
      it: 'Zucchina', nl: 'Courgette', pl: 'Cukinia', sv: 'Zucchini',
    },
  },
]);

export const GLOBAL_EXTENDED_INGREDIENTS: readonly CanonicalIngredient[] = Object.freeze(
  GLOBAL_EXTENDED_INGREDIENT_METADATA.map((entry) => entry.ingredient),
);

const GLOBAL_METADATA_BY_ID = new Map<string, GlobalIngredientMetadata>(
  GLOBAL_EXTENDED_INGREDIENT_METADATA.map((entry) => [entry.ingredient.id, entry]),
);

const V1_PREFERRED_STORAGE_ZONES: Readonly<Record<string, StorageZone>> = Object.freeze({
  PORK_BELLY: 'chilled',
  GROUND_PORK: 'chilled',
  BEEF_SIRLOIN: 'chilled',
  CHICKEN_BREAST: 'chilled',
  CHICKEN_THIGH: 'chilled',
  PORK_RIBS: 'chilled',
  SHRIMP: 'chilled',
  SALMON_FILLET: 'chilled',
  WHITE_FISH: 'chilled',
  CRAB_MEAT: 'chilled',
  SQUID: 'chilled',
  FISH_FRESHWATER: 'chilled',
  CHICKEN_EGG: 'fridge',
  FRESH_MILK: 'fridge',
  CHEDDAR_CHEESE: 'fridge',
  BUTTER: 'fridge',
  TOFU: 'fridge',
  KIMCHI: 'fridge',
  NOODLE: 'fridge',
  TOMATO: 'veg_crisper',
  WATER_SPINACH: 'veg_crisper',
  SPINACH: 'veg_crisper',
  BROCCOLI: 'veg_crisper',
  CARROT: 'veg_crisper',
  ONION: 'veg_crisper',
  SCALLION: 'veg_crisper',
  CHILI: 'veg_crisper',
  CUCUMBER: 'veg_crisper',
  CABBAGE: 'veg_crisper',
  MUSHROOM: 'veg_crisper',
  BITTER_MELON: 'veg_crisper',
  WINTER_MELON: 'veg_crisper',
  PUMPKIN: 'veg_crisper',
  PINEAPPLE: 'veg_crisper',
  BEAN_SPROUTS: 'veg_crisper',
  CHAYOTE: 'veg_crisper',
  LEMONGRASS: 'veg_crisper',
  LIME: 'veg_crisper',
  GINGER: 'veg_crisper',
  GARLIC: 'pantry',
  RICE: 'pantry',
  SPAGHETTI_PASTA: 'pantry',
  FISH_SAUCE: 'pantry',
  SOY_SAUCE: 'pantry',
  COOKING_OIL: 'pantry',
  SUGAR: 'pantry',
  RICE_PAPER: 'pantry',
});

/** Recommended 5-zone storage compartment for Japanese & global smart refrigerators. */
export function recommendedStorageZoneForIngredient(ingredientId: string | null | undefined): StorageZone {
  if (!ingredientId) return 'fridge';
  const upper = ingredientId.trim().toUpperCase();
  const globalMeta = GLOBAL_METADATA_BY_ID.get(upper);
  if (globalMeta) return globalMeta.preferredStorageZone;
  return V1_PREFERRED_STORAGE_ZONES[upper] ?? 'fridge';
}

export function getAllCanonicalIngredients(): readonly CanonicalIngredient[] {
  return [...CANONICAL_INGREDIENTS, ...GLOBAL_EXTENDED_INGREDIENTS];
}

export function findGlobalIngredientMetadata(ingredientId: string): GlobalIngredientMetadata | undefined {
  return GLOBAL_METADATA_BY_ID.get(ingredientId.trim().toUpperCase());
}

export function localizeAnyCanonicalIngredientName(
  ingredientId: string,
  locale: SupportedLocale,
  fallback?: string,
): string | undefined {
  const meta = GLOBAL_METADATA_BY_ID.get(ingredientId.trim().toUpperCase());
  if (!meta) return undefined;
  if (locale === 'vi') return meta.ingredient.nameVi;
  if (locale === 'en') return meta.ingredient.nameEn;
  return meta.localizedNames[locale] ?? fallback ?? meta.ingredient.nameEn;
}

export function normalizeGlobalIngredientQuery(input: string): string {
  return normalizeMultilingualText(input)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
