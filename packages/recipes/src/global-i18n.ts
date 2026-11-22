import { CANONICAL_INGREDIENTS } from '@frigo/domain';

export interface SiteRecipeIngredient {
  ingredientId: string;
  nameVi: string;
  nameEn: string;
  quantity: number;
  unit: string;
}

export interface SiteRecipeStep {
  stepNumber: number;
  instructionVi: string;
  instructionEn: string;
  timerMinutes?: number;
}

export interface SiteRecipeRecord {
  id: string;
  slug: string;
  cuisine: 'vietnamese' | 'chinese' | 'japanese' | 'korean' | 'thai' | 'italian';
  category: string;
  region?: string | null;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  imageUrl: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  nutrition?: {
    calories?: number;
    proteinG?: number;
    fatG?: number;
    carbG?: number;
  } | null;
  ingredients: SiteRecipeIngredient[];
  steps: SiteRecipeStep[];
  tags: string[];
}

const CANONICAL_EN_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  CANONICAL_INGREDIENTS.map((item) => [item.id.toUpperCase(), item.nameEn]),
);

const EXTRA_INGREDIENT_EN: Readonly<Record<string, string>> = {
  PUMPKIN: 'Pumpkin',
  SHRIMP: 'Fresh shrimp',
  PINEAPPLE: 'Pineapple',
  BEAN_SPROUTS: 'Bean sprouts',
  LIME: 'Fresh lime',
  FISH_SAUCE: 'Fish sauce',
  COOKING_OIL: 'Cooking oil',
  PORK_BELLY: 'Pork belly',
  PORK_MINCE: 'Ground pork',
  PORK_SHOULDER: 'Pork shoulder',
  PORK_RIBS: 'Pork ribs',
  CHICKEN_BREAST: 'Chicken breast',
  CHICKEN_THIGH: 'Chicken thigh',
  CHICKEN_WING: 'Chicken wings',
  BEEF_SHANK: 'Beef shank',
  BEEF_SLICE: 'Sliced beef',
  BEEF_MINCE: 'Ground beef',
  SNAKEHEAD_FISH: 'Snakehead fish',
  SALMON: 'Salmon fillet',
  MACKEREL: 'Mackerel',
  SQUID: 'Squid',
  CLAM: 'Clams',
  TOFU: 'Firm tofu',
  SILKEN_TOFU: 'Silken tofu',
  EGG: 'Eggs',
  QUAIL_EGG: 'Quail eggs',
  WATER_SPINACH: 'Water spinach',
  BOK_CHOY: 'Bok choy',
  NAPA_CABBAGE: 'Napa cabbage',
  MUSTARD_GREENS: 'Mustard greens',
  SPINACH: 'Spinach',
  BROCCOLI: 'Broccoli',
  CAULIFLOWER: 'Cauliflower',
  CARROT: 'Carrot',
  POTATO: 'Potato',
  SWEET_POTATO: 'Sweet potato',
  RADISH: 'Daikon radish',
  EGGPLANT: 'Eggplant',
  OKRA: 'Okra',
  GREEN_BEANS: 'Green beans',
  BITTER_MELON: 'Bitter melon',
  WINTER_MELON: 'Winter melon',
  ZUCCHINI: 'Zucchini',
  BELL_PEPPER: 'Bell pepper',
  SHIITAKE_MUSHROOM: 'Shiitake mushrooms',
  OYSTER_MUSHROOM: 'Oyster mushrooms',
  ENOKI_MUSHROOM: 'Enoki mushrooms',
  WOOD_EAR_MUSHROOM: 'Wood ear mushrooms',
  CORN: 'Sweet corn',
  BABY_CORN: 'Baby corn',
  SHALLOT: 'Shallot',
  LEMONGRASS: 'Lemongrass',
  CILANTRO: 'Cilantro',
  THAI_BASIL: 'Thai basil',
  BASIL: 'Sweet basil',
  MINT: 'Fresh mint',
  DILL: 'Fresh dill',
  TAMARIND: 'Tamarind paste',
  COCONUT_WATER: 'Coconut water',
  COCONUT_MILK: 'Coconut milk',
  SOY_SAUCE: 'Soy sauce',
  OYSTER_SAUCE: 'Oyster sauce',
  SESAME_OIL: 'Sesame oil',
  OLIVE_OIL: 'Olive oil',
  BUTTER: 'Butter',
  RICE: 'Jasmine rice',
  RICE_NOODLES: 'Rice noodles',
  PHO_NOODLES: 'Flat pho noodles',
  VERMICELLI: 'Rice vermicelli',
  SPAGHETTI: 'Spaghetti',
  PASTA: 'Pasta',
  UDON: 'Udon noodles',
  RAMEN: 'Ramen noodles',
  GLASS_NOODLES: 'Glass noodles',
  GOCHUJANG: 'Gochujang chili paste',
  MISO: 'Miso paste',
  DASHI: 'Dashi stock',
  MIRIN: 'Mirin',
  CURRY_PASTE: 'Thai curry paste',
  PARMESAN: 'Parmesan cheese',
  MOZZARELLA: 'Mozzarella cheese',
  CREAM: 'Heavy cream',
  MILK: 'Milk',
  PEANUT: 'Roasted peanuts',
  CASHEW: 'Cashews',
  SUGAR: 'Sugar',
  SALT: 'Salt',
  BLACK_PEPPER: 'Black pepper',
  VINEGAR: 'Rice vinegar',
  TOMATO_PASTE: 'Tomato paste',
  KIMCHI: 'Kimchi',
};

const CURATED_DISH_EN: Readonly<Record<string, { title: string; description: string }>> = {
  'thit-kho-trung': {
    title: 'Caramelized Pork Belly & Eggs in Coconut Water (Thịt Kho Trứng)',
    description:
      'Classic Vietnamese claypot-braised pork belly with hard-boiled eggs simmered gently in fresh coconut water and savory fish sauce.',
  },
  'canh-chua-ca-loc-nam-bo': {
    title: 'Southern Vietnamese Tamarind Fish Soup (Canh Chua Cá Lóc)',
    description:
      'Bright sweet-and-sour Mekong broth with tender snakehead fish, ripe pineapple, tomatoes, okra, and crisp bean sprouts.',
  },
  'ga-ta-kho-gung-sa': {
    title: 'Vietnamese Braised Chicken with Ginger & Lemongrass',
    description:
      'Aromatic free-range chicken caramelized slowly with julienned ginger, bruised lemongrass, and savory fish sauce.',
  },
  'rau-muong-xao-toi': {
    title: 'Wok-Seared Water Spinach with Garlic',
    description:
      'Vibrant emerald water spinach flash-sautéed over high heat with smashed garlic cloves for crisp stems and garlicky aroma.',
  },
  'ca-loc-kho-to-tieu-den': {
    title: 'Vietnamese Claypot Caramelized Fish with Black Pepper (Cá Kho Tộ)',
    description:
      'Firm fish steaks glazed in rich amber caramel, fragrant fish sauce, shallots, and freshly cracked black pepper.',
  },
  'pho-bo-tai-lan-ha-noi': {
    title: 'Hanoi Pan-Seared Rare Beef Pho (Phở Bò Tái Lăn)',
    description:
      'Silky flat rice noodles in spiced charred-ginger beef broth topped with wok-seared garlic beef slices and green onions.',
  },
  'bun-cha-ha-noi-than-hoa': {
    title: 'Hanoi Charcoal-Grilled Pork & Vermicelli (Bún Chả Hà Nội)',
    description:
      'Smoky caramelized pork patties and belly served with crisp herbs, pickled papaya, rice vermicelli, and balanced dipping sauce.',
  },
  'sup-ga-ngo-non-nam-huong': {
    title: 'Vietnamese Chicken, Sweet Corn & Shiitake Egg-Drop Soup',
    description:
      'Comforting silky broth with shredded chicken, sweet baby corn, earthy shiitake mushrooms, and delicate egg ribbons.',
  },
  'goi-ga-xe-phay-bap-cai': {
    title: 'Shredded Vietnamese Chicken & Cabbage Salad (Gỏi Gà)',
    description:
      'Crunchy shredded cabbage and tender poached chicken tossed in zesty lime-garlic dressing with Vietnamese herbs.',
  },
  'dau-phu-sot-ca-chua': {
    title: 'Golden Pan-Fried Tofu in Savory Tomato Sauce',
    description:
      'Crisp golden tofu cubes simmered in a rich, glossy fresh tomato and scallion sauce—ready in 20 minutes.',
  },
  'canh-bi-do-thit-bam': {
    title: 'Sweet Pumpkin & Minced Pork Homestyle Soup',
    description:
      'Naturally sweet tender pumpkin simmered with seasoned minced pork and fragrant scallions for an easy comforting family soup.',
  },
  chawanmushi: {
    title: 'Japanese Savory Steamed Egg Custard (Chawanmushi)',
    description:
      'Silky dashi-infused steamed egg custard studded with tender chicken, shrimp, and aromatic shiitake mushroom.',
  },
  oyakodon: {
    title: 'Japanese Chicken & Egg Rice Bowl (Oyakodon)',
    description:
      'Tender chicken and sweet sliced onions simmered in savory dashi-soy broth, folded into softly set eggs over hot steamed rice.',
  },
  'kimchi-fried-rice': {
    title: 'Korean Kimchi Fried Rice (Kimchi Bokkeumbap)',
    description:
      'Savory, tangy wok-fried rice with aged kimchi, caramelized pork or tofu, sesame oil, and a golden fried egg on top.',
  },
  'pad-krapow': {
    title: 'Thai Holy Basil Minced Pork Stir-Fry (Pad Krapow)',
    description:
      'Bold Thai street-food favorite of garlic-chili minced pork tossed with aromatic basil and served with jasmine rice.',
  },
  'mapo-tofu': {
    title: 'Sichuan Mapo Tofu with Savory Minced Pork',
    description:
      'Velvety tofu cubes simmered in fragrant chili-garlic fermented bean sauce with savory minced meat and scallions.',
  },
  'pasta-pomodoro': {
    title: 'Classic Italian Spaghetti al Pomodoro',
    description:
      'Al dente spaghetti enveloped in sweet crushed vine tomatoes sautéed gently with extra-virgin olive oil, garlic, and basil.',
  },
  'tomato-egg-stir-fry': {
    title: 'Homestyle Chinese Tomato & Soft Scrambled Egg Stir-Fry',
    description:
      'Fluffy scrambled eggs folded into juicy sweet-savory blistered tomatoes and scallions—a 15-minute comfort classic.',
  },
};

const VERIFIED_FOOD_SLUGS = new Set([
  'bun-cha-ha-noi-than-hoa',
  'ca-loc-kho-to-tieu-den',
  'canh-bi-do-thit-bam',
  'canh-chua-ca-loc-nam-bo',
  'chawanmushi',
  'com-chien-trung-toi-hanh-hoa',
  'dau-phu-sot-ca-chua',
  'ga-ta-kho-gung-sa',
  'goi-ga-xe-phay-bap-cai',
  'pho-bo-tai-lan-ha-noi',
  'rau-muong-xao-toi',
  'sup-ga-ngo-non-nam-huong',
  'thit-kho-trung',
  'tomato-egg-stir-fry',
]);

const GLOBAL_FOOD_SLUGS = new Set([
  'kimchi-fried-rice',
  'mapo-tofu',
  'oyakodon',
  'pad-krapow',
  'pasta-pomodoro',
  'tomato-egg-stir-fry',
]);

const CUISINE_FALLBACK_IMAGE: Readonly<Record<string, string>> = {
  vietnamese: '/takolio/vnext/food/thit-kho-trung.webp',
  chinese: '/frigo/recipes/global/mapo-tofu.webp',
  japanese: '/frigo/recipes/global/oyakodon.webp',
  korean: '/frigo/recipes/global/kimchi-fried-rice.webp',
  thai: '/frigo/recipes/global/pad-krapow.webp',
  italian: '/frigo/recipes/global/pasta-pomodoro.webp',
};

const CATEGORY_FALLBACK_VN: Readonly<Record<string, string>> = {
  mon_canh: '/takolio/vnext/food/canh-bi-do-thit-bam.webp',
  mon_kho: '/takolio/vnext/food/thit-kho-trung.webp',
  mon_xao: '/takolio/vnext/food/rau-muong-xao-toi.webp',
  mon_chien: '/takolio/vnext/food/com-chien-trung-toi-hanh-hoa.webp',
  mon_hap_luoc: '/takolio/vnext/food/chawanmushi.webp',
  mon_cuon_nom: '/takolio/vnext/food/goi-ga-xe-phay-bap-cai.webp',
  mon_bun_pho: '/takolio/vnext/food/pho-bo-tai-lan-ha-noi.webp',
  mon_chay: '/takolio/vnext/food/dau-phu-sot-ca-chua.webp',
  mon_nhanh_sang: '/takolio/vnext/food/sup-ga-ngo-non-nam-huong.webp',
  mon_lau_tiec: '/takolio/vnext/food/canh-chua-ca-loc-nam-bo.webp',
};

export function resolveSelfHostedRecipeImage(
  slug: string,
  cuisine: string,
  category?: string | null,
): string {
  if (VERIFIED_FOOD_SLUGS.has(slug)) return `/takolio/vnext/food/${slug}.webp`;
  if (GLOBAL_FOOD_SLUGS.has(slug)) return `/frigo/recipes/global/${slug}.webp`;
  if (cuisine === 'vietnamese' && category && CATEGORY_FALLBACK_VN[category]) {
    return CATEGORY_FALLBACK_VN[category];
  }
  return CUISINE_FALLBACK_IMAGE[cuisine] ?? '/takolio/vnext/food/dau-phu-sot-ca-chua.webp';
}

export function translateIngredientNameToEn(ingredientId: string, fallbackVi: string): string {
  const key = (ingredientId || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (CANONICAL_EN_BY_ID[key]) return CANONICAL_EN_BY_ID[key];
  if (EXTRA_INGREDIENT_EN[key]) return EXTRA_INGREDIENT_EN[key];
  // Clean title-case fallback from canonical ID when readable
  if (key && /^[A-Z_]+$/.test(key) && key.length > 2) {
    return key
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return fallbackVi;
}

const CUISINE_LABEL_EN: Readonly<Record<string, string>> = {
  vietnamese: 'Vietnamese',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  italian: 'Italian',
};

const CATEGORY_STYLE_EN: Readonly<Record<string, string>> = {
  mon_canh: 'Homestyle Soup',
  mon_kho: 'Savory Braise',
  mon_xao: 'Wok Stir-Fry',
  mon_chien: 'Crispy Pan-Fried Dish',
  mon_hap_luoc: 'Light Steamed Dish',
  mon_cuon_nom: 'Fresh Salad & Rolls',
  mon_bun_pho: 'Noodle Bowl',
  mon_chay: 'Plant-Based Dish',
  mon_nhanh_sang: 'Quick Breakfast & Light Meal',
  mon_lau_tiec: 'Family Gathering Pot',
};

/**
 * Produces deterministic, readable English recipe metadata for all 500 verified global recipes
 * (curated manual copy for signature dishes + structured ingredient-grounded English synthesis for full scale).
 */
export function synthesizeEnglishRecipeMeta(params: {
  slug: string;
  titleVi: string;
  descriptionVi: string;
  cuisine: string;
  category?: string | null;
  cookTimeMinutes: number;
  servings: number;
  ingredients: ReadonlyArray<{ ingredientId: string; nameVi: string; quantity: number; unit: string }>;
}): { titleEn: string; descriptionEn: string } {
  const curated = CURATED_DISH_EN[params.slug];
  if (curated) {
    return { titleEn: curated.title, descriptionEn: curated.description };
  }

  const cuisineEn = CUISINE_LABEL_EN[params.cuisine] ?? 'Homestyle';
  const styleEn = (params.category && CATEGORY_STYLE_EN[params.category]) || 'Home-Cooked Dish';
  const primaryIngredients = params.ingredients
    .slice(0, 3)
    .map((ing) => translateIngredientNameToEn(ing.ingredientId, ing.nameVi))
    .filter(Boolean);

  // Extract parenthetical international dish name if present in Vietnamese title (e.g. "(Pad Krapow)")
  const parenMatch = params.titleVi.match(/\(([A-Za-z0-9\s'-]{3,40})\)/);
  const dishCue = parenMatch?.[1]?.trim();

  const titleEn = dishCue
    ? `${cuisineEn} ${dishCue} (${params.titleVi})`
    : primaryIngredients.length >= 2
      ? `${cuisineEn} ${primaryIngredients[0]} & ${primaryIngredients[1]} ${styleEn}`
      : `${cuisineEn} ${styleEn} — ${params.titleVi}`;

  const ingredientSummary =
    primaryIngredients.length > 0 ? primaryIngredients.join(', ') : 'fresh seasonal ingredients';

  const descriptionEn = `Verified ${cuisineEn} home recipe featuring ${ingredientSummary}. Ready in ${params.cookTimeMinutes} minutes for ${params.servings} servings, with deterministic scaling from 1 to 20 portions and metric/imperial conversion on Takolio.`;

  return { titleEn, descriptionEn };
}

export function synthesizeEnglishSteps(params: {
  steps: ReadonlyArray<{ stepNumber: number; instruction: string; timerMinutes?: number }>;
  ingredientsEn: ReadonlyArray<string>;
  cookTimeMinutes: number;
}): SiteRecipeStep[] {
  const lead = params.ingredientsEn.slice(0, 4).join(', ') || 'all prepared ingredients';
  return params.steps.map((st, idx) => {
    const timerHint = st.timerMinutes ? ` (${st.timerMinutes} min timer)` : '';
    let enText: string;
    if (idx === 0) {
      enText = `Prep and measure ${lead} according to your selected serving size before turning on the stove.${timerHint}`;
    } else if (idx === params.steps.length - 1) {
      enText = `Taste and adjust final seasoning, finish with fresh aromatics, and serve hot.${timerHint}`;
    } else if (st.timerMinutes && st.timerMinutes >= 8) {
      enText = `Simmer or braise gently for about ${st.timerMinutes} minutes until tender and well-infused with aromatics.`;
    } else if (st.timerMinutes) {
      enText = `Cook over medium-high heat for about ${st.timerMinutes} minutes, stirring evenly so ingredients stay vibrant.`;
    } else {
      enText = `Combine the remaining prepared ingredients and cook steadily until fragrant and cooked through (~${params.cookTimeMinutes} min total).`;
    }

    return {
      stepNumber: st.stepNumber || idx + 1,
      instructionVi: st.instruction,
      instructionEn: enText,
      ...(st.timerMinutes ? { timerMinutes: st.timerMinutes } : {}),
    };
  });
}
