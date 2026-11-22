export type StandardUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'pack' | 'bunch' | 'slice';

export type IngredientCategory =
  | 'meat'
  | 'vegetable'
  | 'egg'
  | 'dairy'
  | 'spice'
  | 'seafood'
  | 'grain'
  | 'fruit'
  | 'other';

export type FreshnessStatus = 'fresh' | 'use_soon' | 'expiring' | 'out_of_stock';

export type InventoryEventType =
  | 'ADD'
  | 'MANUAL_UPDATE'
  | 'SCAN_CONFIRM'
  | 'SCAN_CORRECTION'
  | 'COOK'
  | 'DISCARD'
  | 'SHOPPING_IMPORT';

export interface CanonicalIngredient {
  id: string; // e.g. 'PORK_BELLY'
  nameVi: string; // 'Thịt ba chỉ'
  nameEn: string; // 'Pork belly'
  aliases: string[]; // ['ba chỉ', 'ba rọi', 'thịt ba rọi', 'thịt heo ba chỉ']
  category: IngredientCategory;
  defaultUnit: StandardUnit;
  defaultShelfLifeDays: number;
  icon?: string;
}

export interface InventoryItem {
  id: string;
  householdId: string;
  ingredientId: string; // Canonical ID
  name: string;
  quantity: number;
  unit: StandardUnit;
  category: IngredientCategory;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate?: string; // ISO date string YYYY-MM-DD
  addedDate: string; // ISO date string
  freshness: FreshnessStatus;
  dataSource?: 'scan' | 'manual' | 'shopping';
  /** Monotonic server-side revision used to reject concurrent lost updates. */
  version?: number;
  updatedAt: string;
}

export interface InventoryEvent {
  id: string;
  inventoryItemId: string;
  householdId: string;
  eventType: InventoryEventType;
  quantityDelta: number;
  unit: StandardUnit;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Canonical Ingredients Catalog
export const CANONICAL_INGREDIENTS: CanonicalIngredient[] = [
  // MEAT & POULTRY
  {
    id: 'PORK_BELLY',
    nameVi: 'Thịt ba chỉ',
    nameEn: 'Pork belly',
    aliases: ['ba chỉ', 'ba rọi', 'thịt ba rọi', 'thịt ba chỉ heo', 'pork belly'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 4,
    icon: '🥓',
  },
  {
    id: 'GROUND_PORK',
    nameVi: 'Thịt heo xay',
    nameEn: 'Ground pork',
    aliases: ['thịt băm', 'thịt xay', 'thịt lợn xay', 'thịt bằm'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 3,
    icon: '🥩',
  },
  {
    id: 'BEEF_SIRLOIN',
    nameVi: 'Thịt bò',
    nameEn: 'Beef sirloin',
    aliases: ['thịt bò', 'bò phi lê', 'thịt bò phi lê', 'thịt thăn bò', 'bắp bò'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 4,
    icon: '🥩',
  },
  {
    id: 'CHICKEN_BREAST',
    nameVi: 'Ức gà',
    nameEn: 'Chicken breast',
    aliases: ['ức gà', 'thịt ức gà', 'gà phi lê'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 3,
    icon: '🍗',
  },
  {
    id: 'CHICKEN_THIGH',
    nameVi: 'Đùi gà',
    nameEn: 'Chicken thigh',
    aliases: ['đùi gà', 'má đùi gà', 'thịt đùi gà'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 3,
    icon: '🍗',
  },
  // SEAFOOD
  {
    id: 'SHRIMP',
    nameVi: 'Tôm tươi',
    nameEn: 'Fresh shrimp',
    aliases: ['tôm', 'tôm sú', 'tôm thẻ', 'tôm lột'],
    category: 'seafood',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🦐',
  },
  {
    id: 'SALMON_FILLET',
    nameVi: 'Cá hồi',
    nameEn: 'Salmon fillet',
    aliases: ['cá hồi', 'phi lê cá hồi'],
    category: 'seafood',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🐟',
  },
  // EGGS & DAIRY
  {
    id: 'CHICKEN_EGG',
    nameVi: 'Trứng gà',
    nameEn: 'Chicken egg',
    aliases: ['trứng gà', 'trứng gà ta', 'egg', 'eggs', 'chicken egg'],
    category: 'egg',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 14,
    icon: '🥚',
  },
  {
    id: 'FRESH_MILK',
    nameVi: 'Sữa tươi',
    nameEn: 'Fresh milk',
    aliases: ['sữa', 'sữa tươi', 'sữa không đường', 'sữa có đường'],
    category: 'dairy',
    defaultUnit: 'ml',
    defaultShelfLifeDays: 7,
    icon: '🥛',
  },
  {
    id: 'CHEDDAR_CHEESE',
    nameVi: 'Phô mai',
    nameEn: 'Cheese',
    aliases: ['phô mai', 'pho mát', 'cheddar'],
    category: 'dairy',
    defaultUnit: 'g',
    defaultShelfLifeDays: 21,
    icon: '🧀',
  },
  {
    id: 'BUTTER',
    nameVi: 'Bơ thực vật/động vật',
    nameEn: 'Butter',
    aliases: ['bơ', 'bơ lạt', 'bơ phe', 'butter'],
    category: 'dairy',
    defaultUnit: 'g',
    defaultShelfLifeDays: 30,
    icon: '🧈',
  },
  // VEGETABLES
  {
    id: 'TOMATO',
    nameVi: 'Cà chua',
    nameEn: 'Tomato',
    aliases: ['cà chua', 'cà chua bi', 'tomato'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 7,
    icon: '🍅',
  },
  {
    id: 'WATER_SPINACH',
    nameVi: 'Rau muống',
    nameEn: 'Water spinach',
    aliases: ['rau muống', 'muống nước', 'rau muống đồng'],
    category: 'vegetable',
    defaultUnit: 'bunch',
    defaultShelfLifeDays: 4,
    icon: '🥬',
  },
  {
    id: 'SPINACH',
    nameVi: 'Rau chân vịt',
    nameEn: 'Spinach',
    aliases: ['rau bina', 'cải bó xôi', 'rau chân vịt'],
    category: 'vegetable',
    defaultUnit: 'g',
    defaultShelfLifeDays: 4,
    icon: '🥬',
  },
  {
    id: 'TOFU',
    nameVi: 'Đậu phụ',
    nameEn: 'Tofu',
    aliases: ['đậu phụ', 'đậu hũ', 'tàu hũ', 'tofu'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 4,
    icon: '🧊',
  },
  {
    id: 'BROCCOLI',
    nameVi: 'Bông cải xanh',
    nameEn: 'Broccoli',
    aliases: ['súp lơ', 'súp lơ xanh', 'bông cải xanh', 'broccoli'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 6,
    icon: '🥦',
  },
  {
    id: 'CARROT',
    nameVi: 'Cà rốt',
    nameEn: 'Carrot',
    aliases: ['cà rốt', 'carrot'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 14,
    icon: '🥕',
  },
  {
    id: 'ONION',
    nameVi: 'Hành tây',
    nameEn: 'Onion',
    aliases: ['hành tây', 'củ hành tây'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 20,
    icon: '🧅',
  },
  {
    id: 'GARLIC',
    nameVi: 'Tỏi',
    nameEn: 'Garlic',
    aliases: ['tỏi', 'tỏi cô đơn', 'tỏi ta', 'củ tỏi'],
    category: 'spice',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 30,
    icon: '🧄',
  },
  {
    id: 'GINGER',
    nameVi: 'Gừng',
    nameEn: 'Ginger',
    aliases: ['gừng', 'củ gừng'],
    category: 'spice',
    defaultUnit: 'g',
    defaultShelfLifeDays: 20,
    icon: '🫚',
  },
  {
    id: 'SCALLION',
    nameVi: 'Hành lá',
    nameEn: 'Green onion',
    aliases: ['hành lá', 'hành hoa', 'scallion'],
    category: 'vegetable',
    defaultUnit: 'bunch',
    defaultShelfLifeDays: 5,
    icon: '🌱',
  },
  {
    id: 'CHILI',
    nameVi: 'Ớt',
    nameEn: 'Chili',
    aliases: ['ớt', 'ớt hiểm', 'ớt sừng', 'ớt đỏ'],
    category: 'spice',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 14,
    icon: '🌶️',
  },
  {
    id: 'CUCUMBER',
    nameVi: 'Dưa leo',
    nameEn: 'Cucumber',
    aliases: ['dưa chuột', 'dưa leo'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 7,
    icon: '🥒',
  },
  {
    id: 'CABBAGE',
    nameVi: 'Bắp cải',
    nameEn: 'Cabbage',
    aliases: ['bắp cải', 'cải bắp'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 12,
    icon: '🥬',
  },
  {
    id: 'KIMCHI',
    nameVi: 'Kim chi',
    nameEn: 'Kimchi',
    aliases: ['kimchi', 'kim chi hàn quốc'],
    category: 'vegetable',
    defaultUnit: 'g',
    defaultShelfLifeDays: 45,
    icon: '🥬',
  },
  {
    id: 'MUSHROOM',
    nameVi: 'Nấm đùi gà / nấm hương',
    nameEn: 'Mushroom',
    aliases: ['nấm', 'nấm hương', 'nấm kim châm', 'nấm đùi gà', 'nấm rơm'],
    category: 'vegetable',
    defaultUnit: 'g',
    defaultShelfLifeDays: 5,
    icon: '🍄',
  },
  {
    id: 'RICE',
    nameVi: 'Gạo / Cơm nguội',
    nameEn: 'Rice',
    aliases: ['gạo', 'cơm', 'cơm nguội', 'gạo thơm'],
    category: 'grain',
    defaultUnit: 'g',
    defaultShelfLifeDays: 90,
    icon: '🍚',
  },
  {
    id: 'SPAGHETTI_PASTA',
    nameVi: 'Mì Ý / Pasta',
    nameEn: 'Pasta',
    aliases: ['mì ý', 'spaghetti', 'pasta', 'mì sợi'],
    category: 'grain',
    defaultUnit: 'g',
    defaultShelfLifeDays: 180,
    icon: '🍝',
  },
  {
    id: 'NOODLE',
    nameVi: 'Bún / Mì sợi',
    nameEn: 'Noodles',
    aliases: ['bún', 'mì', 'phở', 'hủ tiếu', 'bún tươi'],
    category: 'grain',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🍜',
  },
  {
    id: 'FISH_SAUCE',
    nameVi: 'Nước mắm',
    nameEn: 'Fish sauce',
    aliases: ['nước mắm', 'mắm nam ngư', 'mắm'],
    category: 'spice',
    defaultUnit: 'ml',
    defaultShelfLifeDays: 365,
    icon: '🥫',
  },
  {
    id: 'SOY_SAUCE',
    nameVi: 'Xì dầu / Nước tương',
    nameEn: 'Soy sauce',
    aliases: ['xì dầu', 'nước tương', 'tương đậu nành'],
    category: 'spice',
    defaultUnit: 'ml',
    defaultShelfLifeDays: 365,
    icon: '🍶',
  },
  {
    id: 'COOKING_OIL',
    nameVi: 'Dầu ăn',
    nameEn: 'Cooking oil',
    aliases: ['dầu ăn', 'dầu mè', 'dầu olive', 'dầu thực vật'],
    category: 'spice',
    defaultUnit: 'ml',
    defaultShelfLifeDays: 365,
    icon: '🫗',
  },
  {
    id: 'PORK_RIBS',
    nameVi: 'Sườn heo / Sườn non',
    nameEn: 'Pork ribs',
    aliases: ['sườn', 'sườn heo', 'sườn non', 'sườn sụn'],
    category: 'meat',
    defaultUnit: 'g',
    defaultShelfLifeDays: 3,
    icon: '🍖',
  },
  {
    id: 'CRAB_MEAT',
    nameVi: 'Cua đồng / Cua thịt',
    nameEn: 'Crab meat / Field crab',
    aliases: ['cua đồng', 'cua', 'riêu cua', 'thịt cua'],
    category: 'seafood',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🦀',
  },
  {
    id: 'SQUID',
    nameVi: 'Mực tươi',
    nameEn: 'Squid',
    aliases: ['mực', 'mực ống', 'mực lá', 'mực tươi'],
    category: 'seafood',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🦑',
  },
  {
    id: 'FISH_FRESHWATER',
    nameVi: 'Cá tươi (Cá lóc, cá điêu hồng, rô phi)',
    nameEn: 'Freshwater fish',
    aliases: ['cá lóc', 'cá quả', 'cá điêu hồng', 'cá rô', 'cá tươi', 'cá trắm'],
    category: 'seafood',
    defaultUnit: 'g',
    defaultShelfLifeDays: 2,
    icon: '🐟',
  },
  {
    id: 'BITTER_MELON',
    nameVi: 'Khổ qua / Mướp đắng',
    nameEn: 'Bitter melon',
    aliases: ['khổ qua', 'mướp đắng'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 5,
    icon: '🥒',
  },
  {
    id: 'WINTER_MELON',
    nameVi: 'Bí đao',
    nameEn: 'Winter melon',
    aliases: ['bí đao', 'bí xanh'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 10,
    icon: '🍈',
  },
  {
    id: 'PUMPKIN',
    nameVi: 'Bí đỏ',
    nameEn: 'Pumpkin',
    aliases: ['bí đỏ', 'bí ngô'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 20,
    icon: '🎃',
  },
  {
    id: 'PINEAPPLE',
    nameVi: 'Dứa / Thơm',
    nameEn: 'Pineapple',
    aliases: ['dứa', 'thơm', 'khóm'],
    category: 'fruit',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 7,
    icon: '🍍',
  },
  {
    id: 'BEAN_SPROUTS',
    nameVi: 'Giá đỗ',
    nameEn: 'Bean sprouts',
    aliases: ['giá đỗ', 'giá sống'],
    category: 'vegetable',
    defaultUnit: 'g',
    defaultShelfLifeDays: 3,
    icon: '🌱',
  },
  {
    id: 'CHAYOTE',
    nameVi: 'Su su',
    nameEn: 'Chayote',
    aliases: ['su su', 'quả su su'],
    category: 'vegetable',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 10,
    icon: '🍐',
  },
  {
    id: 'LEMONGRASS',
    nameVi: 'Sả tươi',
    nameEn: 'Lemongrass',
    aliases: ['sả', 'củ sả', 'cây sả'],
    category: 'spice',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 14,
    icon: '🌾',
  },
  {
    id: 'LIME',
    nameVi: 'Chanh tươi',
    nameEn: 'Lime',
    aliases: ['chanh', 'quả chanh', 'nước cốt chanh'],
    category: 'fruit',
    defaultUnit: 'piece',
    defaultShelfLifeDays: 14,
    icon: '🍋',
  },
  {
    id: 'RICE_PAPER',
    nameVi: 'Bánh tráng cuốn',
    nameEn: 'Rice paper',
    aliases: ['bánh tráng', 'bánh đa nem', 'ram'],
    category: 'grain',
    defaultUnit: 'pack',
    defaultShelfLifeDays: 180,
    icon: '🫓',
  }
];

import {
  endOfCivilDayEpochMs,
  isValidIanaTimeZone,
  normalizeMultilingualText,
  type SupportedLocale,
} from './i18n';

/** Normalize catalog names and OCR labels without guessing species or ingredients. */
export function normalizeIngredientText(input: string): string {
  return normalizeMultilingualText(input);
}

const LOCALIZED_CANONICAL_INGREDIENT_NAMES: Readonly<
  Record<string, Partial<Record<SupportedLocale, string>>>
> = Object.freeze({
  PORK_BELLY: { ja: '豚バラ肉', de: 'Schweinebauch', fr: 'Poitrine de porc', es: 'Panceta de cerdo', it: 'Pancetta fresca' },
  PORK_LOIN: { ja: '豚ロース', de: 'Schweinelende', fr: 'Longe de porc', es: 'Lomo de cerdo', it: 'Lonza di maiale' },
  PORK_RIBS: { ja: '豚スペアリブ', de: 'Schweinerippchen', fr: 'Travers de porc', es: 'Costillas de cerdo', it: 'Costine di maiale' },
  GROUND_PORK: { ja: '豚ひき肉', de: 'Schweinehackfleisch', fr: 'Porc haché', es: 'Carne picada de cerdo', it: 'Macinato di maiale' },
  BEEF_SIRLOIN: { ja: '牛サーロイン', de: 'Rinderlende', fr: 'Faux-filet de bœuf', es: 'Solomillo de ternera', it: 'Controfiletto di manzo' },
  CHICKEN_THIGH: { ja: '鶏もも肉', de: 'Hähnchenschenkel', fr: 'Haut de cuisse de poulet', es: 'Contramuslo de pollo', it: 'Sovracoscia di pollo' },
  CHICKEN_BREAST: { ja: '鶏むね肉', de: 'Hähnchenbrust', fr: 'Blanc de poulet', es: 'Pechuga de pollo', it: 'Petto di pollo' },
  CHICKEN_WING: { ja: '手羽先', de: 'Hähnchenflügel', fr: 'Ailes de poulet', es: 'Alitas de pollo', it: 'Ali di pollo' },
  SHRIMP: { ja: 'えび', de: 'Garnelen', fr: 'Crevettes', es: 'Gambas', it: 'Gamberi' },
  SQUID: { ja: 'いか', de: 'Tintenfisch', fr: 'Calamar', es: 'Calamar', it: 'Calamaro' },
  SALMON: { ja: '鮭', de: 'Lachs', fr: 'Saumon', es: 'Salmón', it: 'Salmone' },
  MACKEREL: { ja: 'さば', de: 'Makrele', fr: 'Maquereau', es: 'Caballa', it: 'Sgombro' },
  FISH_FRESHWATER: { ja: '白身魚', de: 'Süßwasserfisch', fr: 'Poisson d’eau douce', es: 'Pescado blanco', it: 'Pesce d’acqua dolce' },
  CRAB_MEAT: { ja: 'かに身', de: 'Krabbenfleisch', fr: 'Chair de crabe', es: 'Carne de cangrejo', it: 'Polpa di granchio' },
  CHICKEN_EGG: { ja: '鶏卵', de: 'Hühnerei', fr: 'Œuf de poule', es: 'Huevo de gallina', it: 'Uovo di gallina' },
  TOFU: { ja: '豆腐', de: 'Tofu', fr: 'Tofu', es: 'Tofu', it: 'Tofu' },
  TOMATO: { ja: 'トマト', de: 'Tomate', fr: 'Tomate', es: 'Tomate', it: 'Pomodoro' },
  CARROT: { ja: 'にんじん', de: 'Karotte', fr: 'Carotte', es: 'Zanahoria', it: 'Carota' },
  CABBAGE: { ja: 'キャベツ', de: 'Weißkohl', fr: 'Chou blanc', es: 'Repollo', it: 'Cavolo cappuccio' },
  BROCCOLI: { ja: 'ブロッコリー', de: 'Brokkoli', fr: 'Brocoli', es: 'Brócoli', it: 'Broccoli' },
  CUCUMBER: { ja: 'きゅうり', de: 'Gurke', fr: 'Concombre', es: 'Pepino', it: 'Cetriolo' },
  SPINACH: { ja: 'ほうれん草', de: 'Spinat', fr: 'Épinards', es: 'Espinacas', it: 'Spinaci' },
  WATER_SPINACH: { ja: '空芯菜', de: 'Wasserspinat', fr: 'Liseron d’eau', es: 'Espinaca de agua', it: 'Spinacio d’acqua' },
  BOK_CHOY: { ja: 'チンゲン菜', de: 'Pak Choi', fr: 'Pak-choï', es: 'Pak choi', it: 'Pak choi' },
  BEAN_SPROUTS: { ja: 'もやし', de: 'Sojasprossen', fr: 'Pousses de haricot mungo', es: 'Brotes de soja', it: 'Germogli di soia' },
  MUSHROOM_SHIITAKE: { ja: 'しいたけ', de: 'Shiitake-Pilze', fr: 'Shiitaké', es: 'Setas shiitake', it: 'Funghi shiitake' },
  ONION: { ja: '玉ねぎ', de: 'Zwiebel', fr: 'Oignon', es: 'Cebolla', it: 'Cipolla' },
  GARLIC: { ja: 'にんにく', de: 'Knoblauch', fr: 'Ail', es: 'Ajo', it: 'Aglio' },
  GINGER: { ja: 'しょうが', de: 'Ingwer', fr: 'Gingembre', es: 'Jengibre', it: 'Zenzero' },
  SCALLION: { ja: '青ねぎ', de: 'Frühlingszwiebel', fr: 'Cébette', es: 'Cebolleta', it: 'Cipollotto' },
  CHILI: { ja: '唐辛子', de: 'Chilischote', fr: 'Piment', es: 'Guindilla', it: 'Peperoncino' },
  LEMONGRASS: { ja: 'レモングラス', de: 'Zitronengras', fr: 'Citronnelle', es: 'Hierba limón', it: 'Citronella' },
  CILANTRO: { ja: 'パクチー', de: 'Koriander', fr: 'Coriandre', es: 'Cilantro', it: 'Coriandolo' },
  PINEAPPLE: { ja: 'パイナップル', de: 'Ananas', fr: 'Ananas', es: 'Piña', it: 'Ananas' },
  BITTER_MELON: { ja: 'ゴーヤ', de: 'Bittermelone', fr: 'Margose', es: 'Melón amargo', it: 'Zucca amara' },
  CHAYOTE: { ja: 'ハヤトウリ', de: 'Chayote', fr: 'Chayote', es: 'Chayote', it: 'Chayote' },
  KIMCHI: { ja: 'キムチ', de: 'Kimchi', fr: 'Kimchi', es: 'Kimchi', it: 'Kimchi' },
  FRESH_MILK: { ja: '牛乳', de: 'Frischmilch', fr: 'Lait frais', es: 'Leche fresca', it: 'Latte fresco' },
  BUTTER: { ja: 'バター', de: 'Butter', fr: 'Beurre', es: 'Mantequilla', it: 'Burro' },
  CHEDDAR_CHEESE: { ja: 'チェダーチーズ', de: 'Cheddar-Käse', fr: 'Cheddar', es: 'Queso cheddar', it: 'Cheddar' },
  RICE: { ja: '米', de: 'Reis', fr: 'Riz', es: 'Arroz', it: 'Riso' },
  RICE_NOODLE: { ja: 'ライスヌードル', de: 'Reisnudeln', fr: 'Nouilles de riz', es: 'Fideos de arroz', it: 'Spaghetti di riso' },
  NOODLE: { ja: '中華麺', de: 'Nudeln', fr: 'Nouilles', es: 'Fideos', it: 'Tagliolini' },
  SPAGHETTI_PASTA: { ja: 'スパゲッティ', de: 'Spaghetti', fr: 'Spaghetti', es: 'Espaguetis', it: 'Spaghetti' },
  RICE_PAPER: { ja: 'ライスペーパー', de: 'Reispapier', fr: 'Galettes de riz', es: 'Papel de arroz', it: 'Carta di riso' },
  FISH_SAUCE: { ja: 'ナンプラー', de: 'Fischsauce', fr: 'Sauce de poisson', es: 'Salsa de pescado', it: 'Salsa di pesce' },
  SOY_SAUCE: { ja: '醤油', de: 'Sojasauce', fr: 'Sauce soja', es: 'Salsa de soja', it: 'Salsa di soia' },
  OYSTER_SAUCE: { ja: 'オイスターソース', de: 'Austernsauce', fr: 'Sauce d’huître', es: 'Salsa de ostras', it: 'Salsa di ostriche' },
  COOKING_OIL: { ja: 'サラダ油', de: 'Speiseöl', fr: 'Huile de cuisson', es: 'Aceite de cocina', it: 'Olio da cucina' },
  SHRIMP_PASTE: { ja: 'シュリンプペースト', de: 'Garnelenpaste', fr: 'Pâte de crevettes', es: 'Pasta de gambas', it: 'Pasta di gamberetti' },
});

import {
  GLOBAL_EXTENDED_INGREDIENTS,
  findGlobalIngredientMetadata,
  localizeAnyCanonicalIngredientName,
} from './global-ingredients';

export function localizeCanonicalIngredientName(
  ingredientId: string,
  locale: SupportedLocale = 'en',
  fallback?: string,
): string {
  const ingredient = findCanonicalIngredientById(ingredientId);
  if (ingredient) {
    if (locale === 'vi') return ingredient.nameVi;
    if (locale === 'en') return ingredient.nameEn;
    return LOCALIZED_CANONICAL_INGREDIENT_NAMES[ingredient.id]?.[locale] ?? ingredient.nameEn;
  }
  return localizeAnyCanonicalIngredientName(ingredientId, locale, fallback) ?? fallback ?? ingredientId;
}

function uniqueIngredient(matches: CanonicalIngredient[]): CanonicalIngredient | null {
  const ids = new Set(matches.map((ingredient) => ingredient.id));
  return ids.size === 1 ? matches[0] : null;
}

function matchesLocalizedName(ingredientId: string, normalizedTarget: string): boolean {
  const map = LOCALIZED_CANONICAL_INGREDIENT_NAMES[ingredientId];
  if (map && Object.values(map).some(
    (label) => typeof label === 'string' && normalizeIngredientText(label) === normalizedTarget,
  )) {
    return true;
  }
  const globalMeta = findGlobalIngredientMetadata(ingredientId);
  if (!globalMeta) return false;
  return Object.values(globalMeta.localizedNames).some(
    (label) => typeof label === 'string' && normalizeIngredientText(label) === normalizedTarget,
  );
}

const OCR_QUANTITY_UNIT_SUFFIX_RE =
  /(?:\s+\d+(?:\s+\d+)?\s*(?:kg|g|gram|gam|ml|cl|dl|l|lit|qua|cai|con|goi|hop|bich|tui|pack|pcs?|stk?|bund|piece|丁|ぱっく|袋|本|玉|束|個|枚|切れ))+$/u;

export function findCanonicalIngredient(
  input: string,
  options?: { includeGlobalLocales?: boolean },
): CanonicalIngredient | null {
  if (!input) return null;
  const checkGlobal = options?.includeGlobalLocales === true;
  const pool = checkGlobal ? [...CANONICAL_INGREDIENTS, ...GLOBAL_EXTENDED_INGREDIENTS] : CANONICAL_INGREDIENTS;
  const id = input.trim().toLowerCase();
  const byId = pool.find((ingredient) => ingredient.id.toLowerCase() === id);
  if (byId) return byId;

  const clean = normalizeIngredientText(input);
  if (!clean) return null;
  const byName = uniqueIngredient(pool.filter((ingredient) =>
    normalizeIngredientText(ingredient.nameVi) === clean ||
    normalizeIngredientText(ingredient.nameEn) === clean ||
    (checkGlobal && matchesLocalizedName(ingredient.id, clean))));
  if (byName) return byName;
  const byAlias = uniqueIngredient(pool.filter((ingredient) =>
    ingredient.aliases.some((alias) => normalizeIngredientText(alias) === clean)));
  if (byAlias) return byAlias;

  // OCR sometimes appends a separate numeric quantity and unit. Strip only
  // that complete suffix, never arbitrary words or substrings.
  const withoutQuantity = clean.replace(OCR_QUANTITY_UNIT_SUFFIX_RE, '');
  if (withoutQuantity === clean) return null;
  return uniqueIngredient(pool.filter((ingredient) =>
    normalizeIngredientText(ingredient.nameVi) === withoutQuantity ||
    normalizeIngredientText(ingredient.nameEn) === withoutQuantity ||
    (checkGlobal && matchesLocalizedName(ingredient.id, withoutQuantity)) ||
    ingredient.aliases.some((alias) => normalizeIngredientText(alias) === withoutQuantity)));
}

/** Resolve a catalog ID without applying the fuzzy name/alias matching above. */
export function findCanonicalIngredientById(
  input: unknown,
  options?: { includeGlobalLocales?: boolean },
): CanonicalIngredient | null {
  if (typeof input !== 'string') return null;
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  const v1 = CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id.toLowerCase() === clean);
  if (v1) return v1;
  if (options?.includeGlobalLocales) {
    return GLOBAL_EXTENDED_INGREDIENTS.find((ingredient) => ingredient.id.toLowerCase() === clean) || null;
  }
  return null;
}

export * from './i18n';
export * from './units';
export * from './culinary-units';
export * from './allergens';
export * from './expiry-parser';
export * from './global-ingredients';
export * from './availability';
export * from './quantity';
export * from './culinary-ingredients-v4';

// Calculate freshness status given expiry date or added date
export function computeFreshness(
  expiryDate?: string,
  addedDate?: string,
  shelfLifeDays = 7,
  options?: { timeZone?: string; nowMs?: number },
): FreshnessStatus {
  const nowMs = options?.nowMs ?? Date.now();
  let targetExpiryMs: number;

  if (expiryDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) && options?.timeZone && isValidIanaTimeZone(options.timeZone)) {
      targetExpiryMs = endOfCivilDayEpochMs(expiryDate, options.timeZone);
    } else {
      targetExpiryMs = new Date(expiryDate).getTime();
    }
  } else if (addedDate) {
    targetExpiryMs = new Date(addedDate).getTime() + shelfLifeDays * 24 * 60 * 60 * 1000;
  } else {
    return 'fresh';
  }

  const diffHours = (targetExpiryMs - nowMs) / (1000 * 60 * 60);

  if (diffHours <= 0) return 'expiring';
  if (diffHours <= 24) return 'expiring';
  if (diffHours <= 72) return 'use_soon'; // <= 3 days
  return 'fresh';
}

// Export Frigo Week domain modules
export * from './week';
export * from './foundation';
export * from './meal-planning-api';
export * from './meal-shopping-api';
// T11 canonical inventory read model
export * from './inventory-read-authority';
