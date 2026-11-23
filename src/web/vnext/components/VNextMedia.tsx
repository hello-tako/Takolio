import React, { useState } from 'react';
import type { BrandDirection } from '../feature';
import type { ResolvedRecipeImage } from '../../lib/recipe-media';

/**
 * Verified 1:1 Recipe Photo Provenance Registry for Takolio Kitchen Studio.
 * Retains PR #62's verified Vietnamese culinary assets.
 */
export const VERIFIED_VNEXT_RECIPE_MEDIA: Record<
  string,
  {
    assetId: string;
    src: string;
    src640: string;
    altVi: string;
    verifiedIngredientsSummary: string;
  }
> = {
  'thit-kho-trung': {
    assetId: 'FOOD-VN-KHO-01',
    src: '/takolio/vnext/food/thit-kho-trung.webp',
    src640: '/takolio/vnext/food/thit-kho-trung-640w.webp',
    altVi: 'Thịt kho tàu nước dừa trứng gà ta óng màu cánh gián trong bát gốm ấm',
    verifiedIngredientsSummary: 'Thịt ba chỉ 400g · Trứng gà ta 4 quả · Nước mắm Phú Quốc · Nước dừa',
  },
  'canh-chua-ca-loc-nam-bo': {
    assetId: 'FOOD-VN-CANH-01',
    src: '/takolio/vnext/food/canh-chua-ca-loc-nam-bo.webp',
    src640: '/takolio/vnext/food/canh-chua-ca-loc-nam-bo-640w.webp',
    altVi: 'Bát canh chua cá lóc Nam Bộ với dứa, cà chua, đậu bắp, giá đỗ và ngò ôm',
    verifiedIngredientsSummary: 'Cá lóc 400g · Cà chua · Dứa · Giá đỗ · Ngò gai & ngò ôm',
  },
  'ga-ta-kho-gung-sa': {
    assetId: 'FOOD-VN-KHO-03',
    src: '/takolio/vnext/food/ga-ta-kho-gung-sa.webp',
    src640: '/takolio/vnext/food/ga-ta-kho-gung-sa-640w.webp',
    altVi: 'Đùi gà ta kho gừng thái sợi và sả băm vàng óng trong thố gốm',
    verifiedIngredientsSummary: 'Thịt đùi gà ta 500g · Gừng già thái sợi 40g · Sả tươi · Nước mắm',
  },
  'rau-muong-xao-toi': {
    assetId: 'FOOD-VN-XAO-01',
    src: '/takolio/vnext/food/rau-muong-xao-toi.webp',
    src640: '/takolio/vnext/food/rau-muong-xao-toi-640w.webp',
    altVi: 'Đĩa rau muống xào tỏi xanh mướt điểm tép tỏi ta phi vàng',
    verifiedIngredientsSummary: 'Rau muống ngọn non 1 bó · Tỏi ta đập dập · Nước mắm',
  },
  'ca-loc-kho-to-tieu-den': {
    assetId: 'FOOD-VN-KHO-02',
    src: '/takolio/vnext/food/ca-loc-kho-to-tieu-den.webp',
    src640: '/takolio/vnext/food/ca-loc-kho-to-tieu-den-640w.webp',
    altVi: 'Niêu đất cá lóc kho tộ tiêu đen kèm tóp mỡ vàng giòn và hành lá',
    verifiedIngredientsSummary: 'Cá lóc cắt khứa 500g · Thịt ba chỉ tóp mỡ · Tiêu đen · Nước mắm',
  },
  'pho-bo-tai-lan-ha-noi': {
    assetId: 'FOOD-VN-BUN-01',
    src: '/takolio/vnext/food/pho-bo-tai-lan-ha-noi.webp',
    src640: '/takolio/vnext/food/pho-bo-tai-lan-ha-noi-640w.webp',
    altVi: 'Bát phở bò tái lăn Hà Nội nước dùng trong với hành tây, hành hoa và chanh tươi',
    verifiedIngredientsSummary: 'Thịt bò thăn 400g · Bánh phở tươi 500g · Gừng nướng & hồi quế',
  },
  'sup-ga-ngo-non-nam-huong': {
    assetId: 'FOOD-07',
    src: '/takolio/vnext/food/sup-ga-ngo-non-nam-huong.webp',
    src640: '/takolio/vnext/food/sup-ga-ngo-non-nam-huong-640w.webp',
    altVi: 'Tô súp gà ngô non nấm hương trứng hoa rắc hành ngò',
    verifiedIngredientsSummary: 'Ức gà xé sợi · Ngô non · Nấm hương · Trứng gà ta đánh vân',
  },
  chawanmushi: {
    assetId: 'FOOD-08',
    src: '/takolio/vnext/food/chawanmushi.webp',
    src640: '/takolio/vnext/food/chawanmushi-640w.webp',
    altVi: 'Chén sứ trứng hấp Chawanmushi Nhật Bản kèm tôm và nấm hương',
    verifiedIngredientsSummary: 'Trứng gà mịn · Nước dùng thanh · Tôm tươi · Nấm hương',
  },
  'goi-ga-xe-phay-bap-cai': {
    assetId: 'FOOD-09',
    src: '/takolio/vnext/food/goi-ga-xe-phay-bap-cai.webp',
    src640: '/takolio/vnext/food/goi-ga-xe-phay-bap-cai-640w.webp',
    altVi: 'Đĩa gỏi gà xé phay trộn bắp cải hành tây rau răm hành phi',
    verifiedIngredientsSummary: 'Thịt gà luộc xé phay · Bắp cải bào · Hành tây · Rau răm & chanh ớt',
  },
  'dau-phu-sot-ca-chua': {
    assetId: 'FOOD-10',
    src: '/takolio/vnext/food/dau-phu-sot-ca-chua.webp',
    src640: '/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp',
    altVi: 'Đĩa đậu phụ lướt ván sốt cà chua rắc hành lá tươi',
    verifiedIngredientsSummary: 'Đậu phụ trắng chiên vàng · Cà chua chín · Hành hoa · Nước mắm',
  },
  'canh-bi-do-thit-bam': {
    assetId: 'FOOD-11',
    src: '/takolio/vnext/food/canh-bi-do-thit-bam.webp',
    src640: '/takolio/vnext/food/canh-bi-do-thit-bam-640w.webp',
    altVi: 'Tô canh bí đỏ thịt bằm hạt sen điểm ngò gai',
    verifiedIngredientsSummary: 'Bí đỏ dẻo · Thịt heo bằm · Hạt sen · Ngò gai & hành lá',
  },
  'bun-cha-ha-noi-than-hoa': {
    assetId: 'FOOD-12',
    src: '/takolio/vnext/food/bun-cha-ha-noi-than-hoa.webp',
    src640: '/takolio/vnext/food/bun-cha-ha-noi-than-hoa-640w.webp',
    altVi: 'Mẹt bún chả nướng than hoa Hà Nội kèm nước chấm đu đủ và rau sống',
    verifiedIngredientsSummary: 'Chả viên & thịt ba chỉ nướng · Bún rối · Đu đủ xanh · Rau thơm',
  },
  'tomato-egg-stir-fry': {
    assetId: 'FOOD-GL-03',
    src: '/takolio/vnext/food/tomato-egg-stir-fry.webp',
    src640: '/takolio/vnext/food/tomato-egg-stir-fry-640w.webp',
    altVi: 'Đĩa cà chua xào trứng vàng ươm điểm hành lá tươi trên nền gốm sáng',
    verifiedIngredientsSummary: 'Trứng gà tươi · Cà chua chín mọng · Hành lá · Gia vị vừa ăn',
  },
  'chinese-tomato-egg': {
    assetId: 'FOOD-GL-12',
    src: '/takolio/vnext/food/tomato-egg-stir-fry.webp',
    src640: '/takolio/vnext/food/tomato-egg-stir-fry-640w.webp',
    altVi: 'Đĩa trứng xào cà chua vàng ươm điểm hành lá tươi trên nền gốm sáng',
    verifiedIngredientsSummary: 'Trứng gà tươi · Cà chua chín mọng · Hành lá · Gia vị vừa ăn',
  },
  'com-chien-trung-toi-hanh-hoa': {
    assetId: 'FOOD-VN-SANG-01',
    src: '/takolio/vnext/food/com-chien-trung-toi-hanh-hoa.webp',
    src640: '/takolio/vnext/food/com-chien-trung-toi-hanh-hoa-640w.webp',
    altVi: 'Tô cơm chiên trứng tỏi phi vàng giòn rắc hành hoa tươi trên bàn gỗ ấm',
    verifiedIngredientsSummary: 'Cơm nguội hạt tơi · Trứng gà ta · Tỏi phi vàng · Hành hoa',
  },
};

export type MascotPose =
  | 'welcome'
  | 'guide'
  | 'fridge'
  | 'scanning'
  | 'empty-fridge'
  | 'cooking'
  | 'shopping'
  | 'achievement'
  | 'offline'
  | 'error'
  | 'vector';

const MASCOT_POSE_MAP: Record<MascotPose, { base: string; vnextBase: string; alt: string }> = {
  welcome: {
    base: '/takolio/brand-v2/mascot/bemam-01-welcome',
    vnextBase: '/takolio/vnext/mascot/pose-01-welcome',
    alt: 'Bé Mầm Bếp — Mascot Takolio đội mũ đầu bếp mầm xanh, quàng khăn coral vẫy tay chào',
  },
  guide: {
    base: '/takolio/brand-v2/mascot/bemam-03-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-02-guide',
    alt: 'Bé Mầm Bếp — Mascot Takolio đồng hành kiểm kê tủ lạnh và gợi ý thực đơn',
  },
  fridge: {
    base: '/takolio/brand-v2/mascot/bemam-03-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-02-guide',
    alt: 'Bé Mầm Bếp — Mascot Takolio đứng cạnh tủ lạnh mở đầy rau củ tươi ngon',
  },
  scanning: {
    base: '/takolio/brand-v2/mascot/bemam-02-scanning',
    vnextBase: '/takolio/vnext/mascot/pose-03-scanning',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm máy ảnh xanh lá quét nhận diện nguyên liệu bằng AI',
  },
  'empty-fridge': {
    base: '/takolio/brand-v2/mascot/bemam-07-empty-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-04-empty-fridge',
    alt: 'Bé Mầm Bếp — Mascot Takolio bên ngăn tủ lạnh sạch sẽ đang chờ thêm nguyên liệu',
  },
  cooking: {
    base: '/takolio/brand-v2/mascot/bemam-04-cooking',
    vnextBase: '/takolio/vnext/mascot/pose-05-cooking',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm muỗng gỗ nấu ăn từng bước bên nồi súp nghi ngút khói',
  },
  shopping: {
    base: '/takolio/brand-v2/mascot/bemam-05-shopping',
    vnextBase: '/takolio/brand-v2/mascot/bemam-05-shopping',
    alt: 'Bé Mầm Bếp — Mascot Takolio xách giỏ rau củ tươi cùng danh sách mua sắm thông minh',
  },
  achievement: {
    base: '/takolio/brand-v2/mascot/bemam-06-achievement',
    vnextBase: '/takolio/vnext/mascot/pose-06-achievement',
    alt: 'Bé Mầm Bếp — Mascot Takolio ôm huy hiệu tích xanh hoàn thành bữa ăn ngon đủ dinh dưỡng',
  },
  offline: {
    base: '/takolio/brand-v2/mascot/bemam-08-offline-care',
    vnextBase: '/takolio/vnext/mascot/pose-07-offline',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm muỗng gỗ giữ an toàn dữ liệu bếp khi ngoại tuyến',
  },
  error: {
    base: '/takolio/brand-v2/mascot/bemam-08-offline-care',
    vnextBase: '/takolio/vnext/mascot/pose-08-error',
    alt: 'Bé Mầm Bếp — Mascot Takolio nhẹ nhàng hỗ trợ khôi phục kết nối bếp',
  },
  vector: {
    base: '/takolio/brand-v2/mascot/bemam-01-welcome',
    vnextBase: '/takolio/vnext/mascot/pose-01-welcome',
    alt: 'Bé Mầm Bếp — Mascot chính thức của Takolio',
  },
};

export const BEMAM_MASCOT_SHOWCASE: ReadonlyArray<{
  pose: MascotPose;
  title: string;
  subtitle: string;
}> = [
  { pose: 'welcome', title: 'Chào hỏi', subtitle: 'Đồng hành' },
  { pose: 'scanning', title: 'Quét nguyên liệu', subtitle: 'Nhận diện bằng AI' },
  { pose: 'fridge', title: 'Kiểm kê tủ lạnh', subtitle: 'Theo dõi hạn dùng' },
  { pose: 'cooking', title: 'Nấu ăn', subtitle: 'Nấu từng bước' },
  { pose: 'shopping', title: 'Mua sắm', subtitle: 'Tạo danh sách thông minh' },
  { pose: 'achievement', title: 'Hoàn thành', subtitle: 'Ăn ngon, đủ dinh dưỡng' },
];

export type BrandFeatureIconKey =
  | 'fridge'
  | 'scan'
  | 'recipes'
  | 'planner'
  | 'shopping'
  | 'cooking';

export const BRAND_FEATURE_ICONS: Record<
  BrandFeatureIconKey,
  { src: string; src128: string; label: string; tint: 'mint' | 'coral' }
> = {
  fridge: {
    src: '/takolio/brand-v2/icons/feature-fridge.webp',
    src128: '/takolio/brand-v2/icons/feature-fridge-128w.webp',
    label: 'Quản lý tủ lạnh',
    tint: 'mint',
  },
  scan: {
    src: '/takolio/brand-v2/icons/feature-scan.webp',
    src128: '/takolio/brand-v2/icons/feature-scan-128w.webp',
    label: 'Quét nguyên liệu AI',
    tint: 'mint',
  },
  recipes: {
    src: '/takolio/brand-v2/icons/feature-recipes.webp',
    src128: '/takolio/brand-v2/icons/feature-recipes-128w.webp',
    label: 'Gợi ý món ăn',
    tint: 'coral',
  },
  planner: {
    src: '/takolio/brand-v2/icons/feature-planner.webp',
    src128: '/takolio/brand-v2/icons/feature-planner-128w.webp',
    label: 'Lên thực đơn 7 ngày',
    tint: 'mint',
  },
  shopping: {
    src: '/takolio/brand-v2/icons/feature-shopping.webp',
    src128: '/takolio/brand-v2/icons/feature-shopping-128w.webp',
    label: 'Danh sách mua sắm',
    tint: 'mint',
  },
  cooking: {
    src: '/takolio/brand-v2/icons/feature-cooking.webp',
    src128: '/takolio/brand-v2/icons/feature-cooking-128w.webp',
    label: 'Nấu ăn từng bước',
    tint: 'coral',
  },
};

/**
 * Official Takolio Brand Lockup (Rule 5b: AI-generated 3D Leaf Green Pot + Sprout raster mark + Nunito ExtraBold wordmark).
 */
export const BrandLockup: React.FC<{
  direction?: BrandDirection;
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
}> = ({ compact = false, showTagline = false, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} translate="no">
    <img
      src="/takolio/brand-v2/brand/takolio-logo-mark-128.webp"
      srcSet="/takolio/brand-v2/brand/takolio-logo-mark-128.webp 128w, /takolio/brand-v2/brand/takolio-logo-mark.webp 256w"
      sizes={compact ? '36px' : '42px'}
      alt="Takolio"
      width={compact ? 36 : 42}
      height={compact ? 36 : 42}
      className={compact ? 'w-9 h-9 rounded-xl shrink-0 object-contain' : 'w-10 h-10 rounded-xl shrink-0 object-contain'}
    />
    {!compact && (
      <span className="inline-flex flex-col min-w-0">
        <span className="tkv-heading text-[22px] font-black leading-none tracking-tight text-[var(--tkv-ink)] whitespace-nowrap">
          Takolio
        </span>
        {showTagline && (
          <span
            translate="yes"
            className="mt-1 text-[10.5px] font-semibold leading-snug tracking-normal text-[var(--tkv-ink-secondary)] truncate"
          >
            Trợ lý bếp gia đình thông minh với AI
          </span>
        )}
      </span>
    )}
  </span>
);

/**
 * AI-generated 3D-Clay Brand Feature Icon Tile (Rule 5b: zero hand-coded brand feature SVGs).
 */
export const BrandFeatureIcon: React.FC<{
  name: BrandFeatureIconKey;
  size?: number;
  decorative?: boolean;
  className?: string;
}> = ({ name, size = 48, decorative = true, className = '' }) => {
  const meta = BRAND_FEATURE_ICONS[name];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
        meta.tint === 'coral'
          ? 'bg-[var(--tkv-surface-coral)] border-[var(--tkv-border-coral)]'
          : 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)]'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={meta.src128}
        srcSet={`${meta.src128} 128w, ${meta.src} 256w`}
        sizes={`${size}px`}
        alt={decorative ? '' : meta.label}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        loading="lazy"
        className="w-full h-full object-cover select-none"
      />
    </span>
  );
};

/**
 * Official Bé Mầm Bếp AI-Generated Raster Mascot Illustration (Rule 5b: 100% raster WebP, zero SVG).
 */
export const MascotIllustration: React.FC<{
  pose: MascotPose;
  size?: number;
  decorative?: boolean;
  priority?: boolean;
  motion?: 'none' | 'idle' | 'cheer' | 'scan';
  className?: string;
}> = ({ pose, size = 128, decorative = false, priority = false, motion = 'none', className = '' }) => {
  const [useFallbackPath, setUseFallbackPath] = useState(false);
  const meta = MASCOT_POSE_MAP[pose] ?? MASCOT_POSE_MAP.welcome;
  const activeBase = useFallbackPath ? meta.base : meta.vnextBase;
  const motionClass =
    motion === 'idle'
      ? 'tkv-mascot-float'
      : motion === 'cheer'
        ? 'tkv-mascot-cheer'
        : motion === 'scan'
          ? 'tkv-mascot-float'
          : '';

  const imgEl = (
    <img
      src={`${activeBase}-256w.webp`}
      srcSet={`${activeBase}-256w.webp 256w, ${activeBase}.webp 512w`}
      sizes={`${size}px`}
      alt={decorative ? '' : meta.alt}
      title={decorative ? undefined : 'Bé Mầm Bếp — Mascot Takolio'}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (!useFallbackPath) setUseFallbackPath(true);
      }}
      className={`aspect-square rounded-2xl object-contain select-none ${motionClass} ${className}`}
    />
  );

  if (motion === 'scan') {
    return (
      <span className="relative inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] tkv-scan-aura"
        />
        <span className="relative z-10 inline-flex">{imgEl}</span>
      </span>
    );
  }

  return imgEl;
};

/**
 * Decorative Culinary Rolling Hills Banner (Rule 5b: AI-generated raster illustration matching board.jpg).
 */
export const CulinaryHillsBanner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`relative w-full overflow-hidden rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-bg)] ${className}`}
  >
    <img
      src="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp"
      srcSet="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp 640w, /takolio/brand-v2/decor/culinary-hills-strip.webp 1376w"
      sizes="(max-width: 768px) 100vw, 1200px"
      alt="Hoạ tiết mầm xanh, nồi cam đỏ, tô súp nghệ, thớt gỗ và cà chua tươi trên đồi xanh Takolio"
      loading="lazy"
      className="w-full h-[160px] sm:h-[240px] object-cover object-center select-none"
    />
  </div>
);

const LOCAL_DISH_PHOTO_POOL = [
  '/takolio/vnext/food/bun-cha-ha-noi-than-hoa-640w.webp',
  '/takolio/vnext/food/ga-ta-kho-gung-sa-640w.webp',
  '/takolio/vnext/food/tomato-egg-stir-fry-640w.webp',
  '/takolio/vnext/food/com-chien-trung-toi-hanh-hoa-640w.webp',
  '/takolio/vnext/food/rau-muong-xao-toi-640w.webp',
  '/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp',
  '/takolio/vnext/food/ca-loc-kho-to-tieu-den-640w.webp',
  '/takolio/vnext/food/pho-bo-tai-lan-ha-noi-640w.webp',
] as const;

function hashDishKey(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickLocalDishFallbackPhoto(
  slug: string | null | undefined,
  title: string,
  fallbackSeed = 0,
): string {
  const key = `${slug ?? ''} ${title}`.toLowerCase();
  if (/chawanmushi|trứng hấp/.test(key)) return '/takolio/vnext/food/chawanmushi-640w.webp';
  if (/thit-kho|thịt kho|kho tàu/.test(key)) return '/takolio/vnext/food/thit-kho-trung-640w.webp';
  if (/canh-bi|bí đỏ|bí đao/.test(key)) return '/takolio/vnext/food/canh-bi-do-thit-bam-640w.webp';
  if (/canh|lẩu/.test(key)) return '/takolio/vnext/food/canh-chua-ca-loc-nam-bo-640w.webp';
  if (/súp|cháo/.test(key)) return '/takolio/vnext/food/sup-ga-ngo-non-nam-huong-640w.webp';
  if (/đậu phụ|đậu hũ|mapo|cà tím|món chay/.test(key))
    return '/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp';
  if (/cơm chiên|cơm cuộn|kimchi|kimbap|tokbokki/.test(key))
    return '/takolio/vnext/food/com-chien-trung-toi-hanh-hoa-640w.webp';
  if (/cá|chả cá|tôm|mực|ngao/.test(key)) return '/takolio/vnext/food/ca-loc-kho-to-tieu-den-640w.webp';
  if (/gà|oyakodon|curry|cà ri/.test(key)) return '/takolio/vnext/food/ga-ta-kho-gung-sa-640w.webp';
  if (/bún chả|nướng|nem|sườn|luộc|củ cải/.test(key))
    return '/takolio/vnext/food/bun-cha-ha-noi-than-hoa-640w.webp';
  if (/trứng|ốp la|banh-mi/.test(key)) return '/takolio/vnext/food/tomato-egg-stir-fry-640w.webp';
  if (/phở|bún|miến|mì|pasta|spaghetti/.test(key))
    return '/takolio/vnext/food/pho-bo-tai-lan-ha-noi-640w.webp';
  if (/gỏi|nộm|cuốn/.test(key)) return '/takolio/vnext/food/goi-ga-xe-phay-bap-cai-640w.webp';
  if (/xào|rau/.test(key)) return '/takolio/vnext/food/rau-muong-xao-toi-640w.webp';
  const idx = (hashDishKey(key) + fallbackSeed) % LOCAL_DISH_PHOTO_POOL.length;
  return LOCAL_DISH_PHOTO_POOL[idx];
}

export const VerifiedDishImage: React.FC<{
  slug?: string | null;
  title: string;
  canonicalFallbackSrc?: ResolvedRecipeImage | string | null;
  fallbackSeed?: number;
  aspectClass?: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}> = ({
  slug,
  title,
  canonicalFallbackSrc,
  fallbackSeed = 0,
  aspectClass = 'aspect-[4/3]',
  priority = false,
  className = '',
}) => {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const vnextEntry = slug ? VERIFIED_VNEXT_RECIPE_MEDIA[slug] : undefined;
  const resolvedFallbackUrl =
    typeof canonicalFallbackSrc === 'string'
      ? canonicalFallbackSrc
      : canonicalFallbackSrc && canonicalFallbackSrc.source !== 'placeholder'
        ? canonicalFallbackSrc.src
        : null;

  const imgRevealClass = `w-full h-full object-cover transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.03] ${
    loaded ? 'opacity-100 scale-100' : 'opacity-90 scale-[1.015]'
  }`;

  if (!errored && vnextEntry) {
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
        {!loaded && <span aria-hidden="true" className="absolute inset-0 tkv-shimmer pointer-events-none" />}
        <img
          src={vnextEntry.src640}
          srcSet={`${vnextEntry.src640} 640w, ${vnextEntry.src} 1200w`}
          sizes="(max-width: 768px) 100vw, 560px"
          alt={vnextEntry.altVi}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={imgRevealClass}
        />
      </div>
    );
  }

  if (!errored && resolvedFallbackUrl && resolvedFallbackUrl.startsWith('/takolio/')) {
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
        {!loaded && <span aria-hidden="true" className="absolute inset-0 tkv-shimmer pointer-events-none" />}
        <img
          src={resolvedFallbackUrl}
          alt={`Món ${title}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={imgRevealClass}
        />
      </div>
    );
  }

  const localCulinarySrc = pickLocalDishFallbackPhoto(slug, title, fallbackSeed);
  return (
    <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
      {!loaded && <span aria-hidden="true" className="absolute inset-0 tkv-shimmer pointer-events-none" />}
      <img
        src={localCulinarySrc}
        alt={`Món ${title}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={imgRevealClass}
      />
    </div>
  );
};
