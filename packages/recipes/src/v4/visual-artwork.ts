import { normalizeIngredientText } from '@takolio/domain';
import type { Recipe } from '../types';
import type { DishArtworkIdV4, DishPhotoSlugV5, RecipeArtworkV4 } from './types';

export const DISH_ARTWORK_V4_BASE_PATH = '/takolio/v5/dishes';
export const DISH_PHOTO_V5_BASE_PATH = '/takolio/v5/dishes';
export const DISH_PHOTO_V5_FALLBACK_URL = '/takolio/v5/dishes/thit-kho-tau.webp';

export const ALL_DISH_PHOTO_SLUGS_V5: readonly DishPhotoSlugV5[] = [
  'bo-kho-banh-mi',
  'bo-xao-can-toi',
  'bun-bo-hue',
  'bun-cha-ha-noi',
  'ca-chien-mam-gung',
  'ca-kho-to',
  'canh-bi-do-suon',
  'canh-chua-ca',
  'canh-cua-rau-day',
  'canh-ga-chien-mam',
  'canh-kho-qua',
  'canh-ngao-chua',
  'chao-ga-gung',
  'com-tam-suon',
  'dau-phu-sot-ca',
  'ga-hap-la-chanh',
  'ga-kho-gung',
  'gl-chinese-wok',
  'gl-italian-pasta',
  'gl-japanese-donburi',
  'gl-korean-bibimbap',
  'gl-thai-curry',
  'goi-cuon-tom-thit',
  'nem-ran-cha-gio',
  'pho-bo-ha-noi',
  'rau-luoc-kho-quet',
  'rau-muong-xao',
  'suon-xao-chua-ngot',
  'thit-kho-tau',
  'thit-luoc-ca-phao',
  'tom-rim-mam',
  'trung-chien-thit',
] as const;

interface ArtworkDescriptor {
  id: DishArtworkIdV4;
  categoryLabelVi: string;
  accentTone: RecipeArtworkV4['accentTone'];
}

export const DISH_ARTWORK_CATALOG_V4: Record<DishArtworkIdV4, ArtworkDescriptor> = {
  'vn-braised-claypot': {
    id: 'vn-braised-claypot',
    categoryLabelVi: 'Món kho & rim niêu đất',
    accentTone: 'terracotta',
  },
  'vn-sour-soup': {
    id: 'vn-sour-soup',
    categoryLabelVi: 'Món canh & lẩu thanh ngọt',
    accentTone: 'jade',
  },
  'vn-stirfry-greens': {
    id: 'vn-stirfry-greens',
    categoryLabelVi: 'Món xào lửa lớn giòn ngọt',
    accentTone: 'jade',
  },
  'vn-pho-noodle': {
    id: 'vn-pho-noodle',
    categoryLabelVi: 'Phở, bún & miến truyền thống',
    accentTone: 'amber',
  },
  'vn-tofu-vegetarian': {
    id: 'vn-tofu-vegetarian',
    categoryLabelVi: 'Món chay & đậu phụ thanh tịnh',
    accentTone: 'jade',
  },
  'vn-grilled-lemongrass': {
    id: 'vn-grilled-lemongrass',
    categoryLabelVi: 'Món nướng & hương sả thơm',
    accentTone: 'terracotta',
  },
  'vn-crispy-fried': {
    id: 'vn-crispy-fried',
    categoryLabelVi: 'Món chiên vàng giòn rụm',
    accentTone: 'amber',
  },
  'vn-porridge-congee': {
    id: 'vn-porridge-congee',
    categoryLabelVi: 'Cháo & súp ấm bụng',
    accentTone: 'amber',
  },
  'vn-fresh-rolls': {
    id: 'vn-fresh-rolls',
    categoryLabelVi: 'Gỏi cuốn & nộm thanh mát',
    accentTone: 'jade',
  },
  'vn-steamed-rice-tray': {
    id: 'vn-steamed-rice-tray',
    categoryLabelVi: 'Mâm cơm nhà & món hấp luộc',
    accentTone: 'amber',
  },
  'gl-japanese-donburi': {
    id: 'gl-japanese-donburi',
    categoryLabelVi: 'Ẩm thực Nhật Bản',
    accentTone: 'cobalt',
  },
  'gl-korean-bibimbap': {
    id: 'gl-korean-bibimbap',
    categoryLabelVi: 'Ẩm thực Hàn Quốc',
    accentTone: 'terracotta',
  },
  'gl-italian-pasta': {
    id: 'gl-italian-pasta',
    categoryLabelVi: 'Ẩm thực Ý (Pasta)',
    accentTone: 'terracotta',
  },
  'gl-thai-curry': {
    id: 'gl-thai-curry',
    categoryLabelVi: 'Ẩm thực Thái Lan',
    accentTone: 'amber',
  },
  'gl-chinese-wok': {
    id: 'gl-chinese-wok',
    categoryLabelVi: 'Ẩm thực Trung Hoa',
    accentTone: 'terracotta',
  },
  'culinary-signature-default': {
    id: 'culinary-signature-default',
    categoryLabelVi: 'Món ngon bếp Takolio',
    accentTone: 'amber',
  },
};

export interface RecipeArtworkInputV4 {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  cuisine?: Recipe['cuisine'] | string | null;
  category?: Recipe['category'] | string | null;
  tags?: readonly string[] | null;
  steps?: readonly { instruction: string }[] | null;
}

function makeArtwork(artworkId: DishArtworkIdV4, photoSlug: DishPhotoSlugV5): RecipeArtworkV4 {
  const meta = DISH_ARTWORK_CATALOG_V4[artworkId];
  return {
    artworkId,
    photoSlug,
    url: `${DISH_ARTWORK_V4_BASE_PATH}/${photoSlug}.webp`,
    fallbackUrl: DISH_PHOTO_V5_FALLBACK_URL,
    categoryLabelVi: meta.categoryLabelVi,
    accentTone: meta.accentTone,
    width: 1200,
    height: 900,
    aspectRatio: '4 / 3',
  };
}

/**
 * Deterministically maps ANY recipe (V1 static, D1 hydrated, V5 regional masterpiece, or AI-generated)
 * to one of the 32 live-action 35mm dish photographs under `/takolio/v5/dishes/<slug>.webp`
 * while preserving the V4 semantic `artworkId` taxonomy.
 */
export function resolveRecipeArtworkV4(
  recipe: RecipeArtworkInputV4 | null | undefined,
): RecipeArtworkV4 {
  if (!recipe) {
    return makeArtwork('culinary-signature-default', 'thit-kho-tau');
  }

  const cuisine = recipe.cuisine?.toLowerCase();
  if (cuisine === 'japanese') return makeArtwork('gl-japanese-donburi', 'gl-japanese-donburi');
  if (cuisine === 'korean') return makeArtwork('gl-korean-bibimbap', 'gl-korean-bibimbap');
  if (cuisine === 'italian') return makeArtwork('gl-italian-pasta', 'gl-italian-pasta');
  if (cuisine === 'thai') return makeArtwork('gl-thai-curry', 'gl-thai-curry');
  if (cuisine === 'chinese') return makeArtwork('gl-chinese-wok', 'gl-chinese-wok');

  const category = recipe.category?.toLowerCase() ?? '';
  const combinedText = [recipe.title ?? '', recipe.slug ?? '', ...(recipe.tags ?? [])]
    .map((part) => normalizeIngredientText(part))
    .filter(Boolean)
    .join(' _ ');

  // 1. Vegetarian / Tofu dishes (`dau phu` / `dau hu` / `chay`)
  if (
    category === 'mon_chay' ||
    category === 'chay' ||
    /\b(mon chay|chay|dau phu|dau hu|tau hu|dau khuon)\b/.test(combinedText)
  ) {
    return makeArtwork('vn-tofu-vegetarian', 'dau-phu-sot-ca');
  }

  // 2. Boiled vegetables with caramelized dip (`kho quet` / `rau cu luoc` / `rau luoc`)
  if (/\b(kho quet|rau cu luoc|rau luoc)\b/.test(combinedText)) {
    return makeArtwork('vn-steamed-rice-tray', 'rau-luoc-kho-quet');
  }

  // 3. Fried spring rolls (`nem ran` / `cha gio` / `ram tom` / `nem cua`)
  if (/\b(nem ran|cha gio|ram tom|nem cua|cha ram)\b/.test(combinedText)) {
    return makeArtwork('vn-crispy-fried', 'nem-ran-cha-gio');
  }

  // 4. Steamed fish/seafood/chicken (`ga hap` / `ga luoc` / `muc hap` / `tom hap` / `ca hap`)
  if (
    /\b((?:ga|muc|tom|ca)(?:\s+\w+){0,2}\s+(?:hap|luoc))\b/.test(combinedText) &&
    !/\b(goi|nom|pho|mien|chao|bun)\b/.test(combinedText)
  ) {
    const artId: DishArtworkIdV4 = /\b(sa|la chanh)\b/.test(combinedText)
      ? 'vn-grilled-lemongrass'
      : 'vn-steamed-rice-tray';
    return makeArtwork(artId, 'ga-hap-la-chanh');
  }

  // 5. Spicy/regional noodle bowls (`bun bo` / `mi quang` / `cao lau` / `bun cha ca` / `bun rieu`)
  if (
    /\b(bun bo|mi quang|cao lau|bun cha ca|bun rieu|bun mam|bun oc|banh da cua|bun doc mung)\b/.test(
      combinedText,
    )
  ) {
    return makeArtwork('vn-pho-noodle', 'bun-bo-hue');
  }

  // 6. Charcoal-grilled pork/chicken & Bún chả (`bun cha` / `thit nuong` / `ba chi nuong` / `ga nuong`)
  if (
    /\b(bun cha|thit nuong|ba chi nuong|ga nuong|nem lui|bo nuong)\b/.test(combinedText) &&
    !/\b(com tam)\b/.test(combinedText)
  ) {
    const artId: DishArtworkIdV4 =
      category === 'mon_bun_pho' || category === 'com-bun'
        ? 'vn-pho-noodle'
        : 'vn-grilled-lemongrass';
    return makeArtwork(artId, 'bun-cha-ha-noi');
  }

  // 7. Fresh rolls & salads (`goi cuon` / `goi` / `nom` / `cuon`)
  if (
    category === 'mon_cuon_nom' ||
    (/\b(goi cuon|pho cuon|banh trang cuon|nom|goi|cuon)\b/.test(combinedText) &&
      !/\b(mi goi|trung cuon|cha la lot)\b/.test(combinedText))
  ) {
    return makeArtwork('vn-fresh-rolls', 'goi-cuon-tom-thit');
  }

  // 8. Clear broth noodles (`pho` / `bun thang` / `mien` / `hu tieu` / `banh canh`)
  if (/\b(pho|bun thang|mien|hu tieu|banh canh)\b/.test(combinedText)) {
    return makeArtwork('vn-pho-noodle', 'pho-bo-ha-noi');
  }

  // 9. Rich stews & hotpots (`bo kho` / `gia cay` / `vit nau chao` / `lau`)
  if (/\b(bo kho|gia cay|vit nau chao|lau)\b/.test(combinedText) || category === 'mon_lau_tiec') {
    const artId: DishArtworkIdV4 =
      /\blau\b/.test(combinedText) || category === 'mon_lau_tiec'
        ? 'vn-sour-soup'
        : 'vn-braised-claypot';
    return makeArtwork(artId, 'bo-kho-banh-mi');
  }

  // 10. Porridge & soup starters (`chao` / `sup`)
  if (/\b(chao|sup)\b/.test(combinedText)) {
    return makeArtwork('vn-porridge-congee', 'chao-ga-gung');
  }

  // 11. Fried chicken wings & glazed chicken (`canh ga` / `ga chien` / `ga sot`)
  if (
    category !== 'mon_canh' &&
    category !== 'canh' &&
    /\b(canh ga|ga(?:\s+\w+)?\s+(?:chien|ran|sot))\b/.test(combinedText)
  ) {
    return makeArtwork('vn-crispy-fried', 'canh-ga-chien-mam');
  }

  // 12. Granular Vietnamese soups (`canh cua`, `kho qua`, `canh bi`, `canh ngao`, `canh chua`)
  if (/\b(canh cua|mong toi|rau day)\b/.test(combinedText)) {
    return makeArtwork('vn-sour-soup', 'canh-cua-rau-day');
  }
  if (/\b(kho qua|muop dang)\b/.test(combinedText)) {
    const artId: DishArtworkIdV4 =
      category === 'mon_xao' || category === 'xao' ? 'vn-stirfry-greens' : 'vn-sour-soup';
    return makeArtwork(artId, 'canh-kho-qua');
  }
  if (
    /\b(canh bi|canh suon|suon ham|canh nam(?!\s+bo)|canh mang|canh bong)\b/.test(combinedText) ||
    (/\bsu hao\b/.test(combinedText) && !/\bxao\b/.test(combinedText))
  ) {
    return makeArtwork('vn-sour-soup', 'canh-bi-do-suon');
  }
  if (/\b(canh ngao|ngheu|hen|trai|rong bien)\b/.test(combinedText)) {
    const artId: DishArtworkIdV4 =
      category === 'mon_xao' || category === 'xao' ? 'vn-stirfry-greens' : 'vn-sour-soup';
    return makeArtwork(artId, 'canh-ngao-chua');
  }
  if (
    category === 'mon_canh' ||
    category === 'canh' ||
    /\b(canh chua|canh ca|canh ca chua|canh rau|canh)\b/.test(combinedText)
  ) {
    return makeArtwork('vn-sour-soup', 'canh-chua-ca');
  }

  // 13. Granular braised / caramelized claypot dishes (`ca kho`, `ga kho`, `suon xao`, `tom rim`, `thit kho`)
  if (
    /\b(ca\s+(?:loc\s+)?kho|ca(?:\s+\w+){1,2}\s+kho|ca bong|ca(?:\s+\w+)?\s+om)\b/.test(
      combinedText,
    )
  ) {
    return makeArtwork('vn-braised-claypot', 'ca-kho-to');
  }
  if (
    /\b(ga(?:\s+\w+)?\s+(?:kho|rang|ro\s*ti)|vit(?:\s+\w+)?\s+(?:kho|rang|om))\b/.test(combinedText)
  ) {
    return makeArtwork('vn-braised-claypot', 'ga-kho-gung');
  }
  if (/\b(suon(?:\s+\w+){0,2}\s+(?:xao|kho|rim|ram))\b/.test(combinedText)) {
    return makeArtwork('vn-braised-claypot', 'suon-xao-chua-ngot');
  }
  if (/\b(tom(?:\s+\w+)?\s+(?:rim|kho|rang)|tep(?:\s+\w+)?\s+rang)\b/.test(combinedText)) {
    return makeArtwork('vn-braised-claypot', 'tom-rim-mam');
  }
  if (/\b(thit(?:\s+\w+){0,2}\s+kho|ba chi kho|oc nau chuoi)\b/.test(combinedText)) {
    return makeArtwork('vn-braised-claypot', 'thit-kho-tau');
  }

  // 14. Crispy fried fish (`ca chien` / `cha ca` / `ca hoi` / `ca tai tuong`)
  if (/\b(ca(?:\s+\w+){0,2}\s+chien|cha ca|ca hoi|ca tai tuong)\b/.test(combinedText)) {
    return makeArtwork('vn-crispy-fried', 'ca-chien-mam-gung');
  }

  // 15. Omelettes & steamed egg (`trung chien` / `trung duc` / `trung hap` / `cha ruoi`)
  if (
    /\b(trung chien|trung duc|trung hap|cha ruoi|trung cuon|mam chung|op la)\b/.test(combinedText)
  ) {
    return makeArtwork('vn-crispy-fried', 'trung-chien-thit');
  }

  // 16. Boiled / cold-cut / pickled-fish-sauce meats (`thit luoc` / `thit dong` / `bap bo` / `thit ngam`)
  if (
    /\b(thit(?:\s+\w+){0,2}\s+(?:luoc|dong|ngam)|ba chi luoc|bap bo)\b/.test(combinedText)
  ) {
    return makeArtwork('vn-steamed-rice-tray', 'thit-luoc-ca-phao');
  }

  // 17. Stir-fried greens vs Stir-fried beef/seafood (`rau muong`, `bo xao`)
  if (
    /\b(rau muong|su su xao|ngon su su|cai xao|dau co ve|dau cove|muop(?:\s+\w+)?\s+xao|rau xao)\b/.test(
      combinedText,
    )
  ) {
    return makeArtwork('vn-stirfry-greens', 'rau-muong-xao');
  }
  if (
    /\b((?:bo|thit bo|muc|tom|ga|su hao)(?:\s+\w+)?\s+xao|bo luc lac)\b/.test(combinedText) ||
    category === 'mon_xao' ||
    category === 'xao'
  ) {
    return makeArtwork('vn-stirfry-greens', 'bo-xao-can-toi');
  }

  // 18. Rice plates & fried rice (`com tam` / `com chien` / `com ga` / `com`)
  if (/\b(com tam|com chien|com rang|com ga|com)\b/.test(combinedText)) {
    return makeArtwork('vn-steamed-rice-tray', 'com-tam-suon');
  }

  // 19. Category fallbacks
  if (category === 'mon_kho' || category === 'man' || /\b(kho|rim|om)\b/.test(combinedText)) {
    return makeArtwork('vn-braised-claypot', 'thit-kho-tau');
  }
  if (category === 'mon_bun_pho' || category === 'com-bun' || /\bbun\b/.test(combinedText)) {
    return makeArtwork('vn-pho-noodle', 'pho-bo-ha-noi');
  }
  if (category === 'mon_chien' || /\b(chien|ran)\b/.test(combinedText)) {
    return makeArtwork('vn-crispy-fried', 'nem-ran-cha-gio');
  }
  if (category === 'mon_hap_luoc') {
    return makeArtwork('vn-steamed-rice-tray', 'thit-luoc-ca-phao');
  }

  return makeArtwork('vn-steamed-rice-tray', 'thit-kho-tau');
}
