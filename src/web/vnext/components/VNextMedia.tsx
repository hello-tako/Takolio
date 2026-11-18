import React, { useState } from 'react';
import type { BrandDirection } from '../feature';
import type { ResolvedRecipeImage } from '../../lib/recipe-media';

/**
 * Verified 1:1 Recipe Photo Provenance Registry for vNext Kitchen Studio.
 * Only recipes whose exact ingredients & preparation were verified against
 * `packages/recipes/src/vietnamese-bank.ts` receive dedicated vNext photography.
 * All other recipes use their canonical verified `resolveRecipeImage` or honest neutral fallback.
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
};

export type MascotPose =
  | 'welcome'
  | 'guide'
  | 'scanning'
  | 'empty-fridge'
  | 'cooking'
  | 'achievement'
  | 'offline'
  | 'error'
  | 'vector';

const MASCOT_POSE_MAP: Record<Exclude<MascotPose, 'vector'>, { base: string; alt: string }> = {
  welcome: {
    base: '/takolio/vnext/mascot/pose-01-welcome',
    alt: 'Linh vật Bé Mầm Bếp vẫy tay chào mừng',
  },
  guide: {
    base: '/takolio/vnext/mascot/pose-02-guide',
    alt: 'Linh vật Bé Mầm Bếp cầm muôi gỗ hướng dẫn thiết lập bếp',
  },
  scanning: {
    base: '/takolio/vnext/mascot/pose-03-scanning',
    alt: 'Linh vật Bé Mầm Bếp cầm khung nhận diện nguyên liệu tươi',
  },
  'empty-fridge': {
    base: '/takolio/vnext/mascot/pose-04-empty-fridge',
    alt: 'Linh vật Bé Mầm Bếp bên ngăn tủ lạnh đang trống',
  },
  cooking: {
    base: '/takolio/vnext/mascot/pose-05-cooking',
    alt: 'Linh vật Bé Mầm Bếp khuấy nồi món ăn đang sôi',
  },
  achievement: {
    base: '/takolio/vnext/mascot/pose-06-achievement',
    alt: 'Linh vật Bé Mầm Bếp chúc mừng hoàn thành bữa ăn',
  },
  offline: {
    base: '/takolio/vnext/mascot/pose-07-offline',
    alt: 'Linh vật Bé Mầm Bếp giữ giỏ dữ liệu an toàn khi ngoại tuyến',
  },
  error: {
    base: '/takolio/vnext/mascot/pose-08-error',
    alt: 'Linh vật Bé Mầm Bếp nhẹ nhàng thông báo sự cố cần thử lại',
  },
};

export const BrandLockup: React.FC<{
  direction?: BrandDirection;
  compact?: boolean;
  showCandidateBadge?: boolean;
  className?: string;
}> = ({ direction = 'a', compact = false, showCandidateBadge = false, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} translate="no">
    {compact ? (
      <img
        src="/takolio/vnext/pwa/favicon-vnext.svg"
        alt="Takolio"
        width={36}
        height={36}
        className="w-9 h-9 rounded-xl shrink-0"
      />
    ) : (
      <img
        src={`/takolio/vnext/brand/lockup-direction-${direction}.svg`}
        alt="Takolio"
        width={154}
        height={34}
        className="h-[34px] w-auto shrink-0"
      />
    )}
    {showCandidateBadge && (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning)] border border-[var(--tkv-border)]">
        Bản thử {direction.toUpperCase()}
      </span>
    )}
  </span>
);

export const MascotIllustration: React.FC<{
  pose: MascotPose;
  size?: number;
  decorative?: boolean;
  className?: string;
}> = ({ pose, size = 128, decorative = false, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (pose === 'vector' || failed) {
    return (
      <img
        src="/takolio/vnext/mascot/mascot-master-vector.svg"
        alt={decorative ? '' : 'Linh vật Bé Mầm Bếp Takolio'}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        className={`aspect-square object-contain select-none ${className}`}
      />
    );
  }
  const meta = MASCOT_POSE_MAP[pose];
  return (
    <img
      src={`${meta.base}-256w.webp`}
      srcSet={`${meta.base}-256w.webp 256w, ${meta.base}.webp 512w`}
      sizes={`${size}px`}
      alt={decorative ? '' : meta.alt}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-square object-cover rounded-full select-none ${className}`}
    />
  );
};

export const VerifiedDishImage: React.FC<{
  slug?: string | null;
  title: string;
  canonicalFallbackSrc?: ResolvedRecipeImage | string | null;
  aspectClass?: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}> = ({
  slug,
  title,
  canonicalFallbackSrc,
  aspectClass = 'aspect-[4/3]',
  priority = false,
  compact = false,
  className = '',
}) => {
  const [errored, setErrored] = useState(false);
  const vnextEntry = slug ? VERIFIED_VNEXT_RECIPE_MEDIA[slug] : undefined;
  const resolvedFallbackUrl =
    typeof canonicalFallbackSrc === 'string'
      ? canonicalFallbackSrc
      : canonicalFallbackSrc && canonicalFallbackSrc.source !== 'placeholder'
        ? canonicalFallbackSrc.src
        : null;

  if (!errored && vnextEntry) {
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-mint)] ${aspectClass} ${className}`}>
        <img
          src={vnextEntry.src640}
          srcSet={`${vnextEntry.src640} 640w, ${vnextEntry.src} 1200w`}
          sizes="(max-width: 768px) 100vw, 560px"
          alt={vnextEntry.altVi}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (!errored && resolvedFallbackUrl) {
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-mint)] ${aspectClass} ${className}`}>
        <img
          src={resolvedFallbackUrl}
          alt={`Món ${title}`}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${compact ? 'gap-1 p-1.5' : 'gap-2 p-4'} overflow-hidden bg-[var(--tkv-surface-mint)] text-[var(--tkv-ink-muted)] text-center ${aspectClass} ${className}`}
    >
      <svg
        viewBox="0 0 64 48"
        width={compact ? 30 : 56}
        height={compact ? 22 : 42}
        fill="none"
        aria-hidden="true"
        className="text-[var(--tkv-primary)] opacity-75 shrink-0"
      >
        <path
          d="M24 8c0 3 3 4 3 7M32 6c0 3 3 4 3 7M40 8c0 3 3 4 3 7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M12 22h40c0 11.5-8.95 20-20 20S12 33.5 12 22Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M22 42h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={compact ? 'text-[10px] font-bold leading-tight' : 'text-xs font-semibold line-clamp-2'}>
        {compact ? 'Chưa có ảnh' : `Chưa có ảnh xác minh cho món ${title}`}
      </span>
    </div>
  );
};
