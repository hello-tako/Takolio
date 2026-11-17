import React, { useCallback, useState } from 'react';
import clsx from 'clsx';
import { CulinaryCinemaStage, type CinemaAmbientRimTone } from './CulinaryCinemaStage';
import {
  ClaypotBraiseIcon,
  FreshnessShieldIcon,
  NavFridgeIcon,
  NavScanApertureIcon,
  WokFlameIcon,
} from '../../design-system/icons';

export type HeroHotspotId = 'overview' | 'fridge' | 'cooktop' | 'scan';

export interface HeroKitchenDiorama3DProps {
  activeHotspot?: HeroHotspotId;
  onSelectHotspot?: (hotspot: HeroHotspotId) => void;
  className?: string;
}

interface ChapterSpec {
  actLabel: string;
  title: string;
  summary: string;
  telemetry: string;
  videoSrc: string;
  posterSrc: string;
  rimTone: CinemaAmbientRimTone;
}

const CHAPTER_SPECS: Record<HeroHotspotId, ChapterSpec> = {
  overview: {
    actLabel: 'CHƯƠNG 01–04 · REEL ĐIỆN ẢNH',
    title: 'Không Gian Bếp Việt Hiện Đại · 4 Hồi Liên Hoàn',
    summary:
      'Từ khoang lạnh FEFO đẫm sương sớm, thớt gỗ dao rèn thủ công, chảo gang bùng lửa đến mâm cơm sum vầy nắng chiều.',
    telemetry: 'Nhiệt độ nồi đất 96°C · Lô hạn dùng FEFO đã đồng bộ · 0% nhựa giả lập',
    videoSrc: '/takolio/v5/videos/hero-hearth-reel.mp4',
    posterSrc: '/takolio/v5/posters/wok-poster.webp',
    rimTone: 'ember',
  },
  fridge: {
    actLabel: 'KHOANG 01 · TỦ LẠNH VAULT',
    title: 'Tủ lạnh FEFO 3 ngăn thông minh',
    summary:
      'Tự động xếp hạng nguyên liệu sắp hết hạn lên trước để cứu thực phẩm kịp thời và tiết kiệm ngân sách gia đình.',
    telemetry: 'Độ ẩm ngăn rau 92% · Ưu tiên xuất kho FEFO chuẩn xác · Chống lãng phí',
    videoSrc: '/takolio/v5/videos/fridge-vault-loop.mp4',
    posterSrc: '/takolio/v5/posters/fridge-poster.webp',
    rimTone: 'jade',
  },
  cooktop: {
    actLabel: 'KHOANG 02 · NỒI ĐẤT BÁT TRÀNG',
    title: 'Bếp Mâm Cơm Gia Đình Việt',
    summary:
      'Gợi ý mâm cơm hài hòa món mặn – canh – xào từ chính đồ có sẵn trong bếp, canh lửa chuẩn xác từng nồi.',
    telemetry: 'Nồi đất kho tộ 96°C · Sốt cánh gián sánh kẹo · Đạo diễn đa nồi song song',
    videoSrc: '/takolio/v5/videos/cook-claypot.mp4',
    posterSrc: '/takolio/v5/posters/claypot-poster.webp',
    rimTone: 'amber',
  },
  scan: {
    actLabel: 'KHOANG 03 · BÀN SƠ CHẾ & QUÉT AI',
    title: 'Quét AI Đa Chế Độ & Nhận Diện Tức Thì',
    summary:
      'Chụp ảnh kệ tủ lạnh hoặc hóa đơn siêu thị — luôn mở bước Kiểm tra trước khi thêm để bạn duyệt chuẩn từng món.',
    telemetry: 'Dao rèn & Thớt gỗ óc chó · Nhận diện nguyên liệu Việt · Kiểm tra trước khi thêm',
    videoSrc: '/takolio/v5/videos/cook-prep.mp4',
    posterSrc: '/takolio/v5/posters/prep-poster.webp',
    rimTone: 'jade',
  },
};

const CHAPTER_HOTSPOTS: ReadonlyArray<{
  id: Exclude<HeroHotspotId, 'overview'>;
  label: string;
  sublabel: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    id: 'fridge',
    label: 'Tủ lạnh FEFO',
    sublabel: '3 khoang',
    renderIcon: (active) => (
      <NavFridgeIcon size={14} tone={active ? 'cream' : 'jade'} active={active} />
    ),
  },
  {
    id: 'cooktop',
    label: 'Bếp Mâm Cơm',
    sublabel: '96°C',
    renderIcon: (active) => (
      <ClaypotBraiseIcon size={14} tone={active ? 'cream' : 'flame'} active={active} />
    ),
  },
  {
    id: 'scan',
    label: 'Quét AI',
    sublabel: 'Sơ chế',
    renderIcon: (active) => (
      <NavScanApertureIcon size={14} tone={active ? 'cream' : 'turmeric'} active={active} />
    ),
  },
];

export const HeroKitchenDiorama3D: React.FC<HeroKitchenDiorama3DProps> = ({
  activeHotspot: controlledHotspot,
  onSelectHotspot,
  className,
}) => {
  const [internalHotspot, setInternalHotspot] = useState<HeroHotspotId>('overview');
  const currentHotspot = controlledHotspot ?? internalHotspot;
  const spec = CHAPTER_SPECS[currentHotspot] ?? CHAPTER_SPECS.overview;

  const selectSpot = useCallback(
    (spot: HeroHotspotId) => {
      const next = currentHotspot === spot && spot !== 'overview' ? 'overview' : spot;
      setInternalHotspot(next);
      onSelectHotspot?.(next);
    },
    [currentHotspot, onSelectHotspot],
  );

  return (
    <CulinaryCinemaStage
      videoSrc={spec.videoSrc}
      posterSrc={spec.posterSrc}
      ariaLabel="Sân khấu điện ảnh không gian bếp Takolio"
      studioBadgeLabel="FILM · 35MM HEARTH"
      liveLabel="35MM LIVE"
      ambientRimTone={spec.rimTone}
      className={clsx(
        'min-h-[360px] w-full sm:min-h-[440px]',
        className,
      )}
    >
      {/* Top-Left Chapter Act Pill + Interactive Hotspot Chapter Triggers */}
      <div className="pointer-events-auto absolute left-3.5 top-3.5 right-36 sm:right-56 z-20 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => selectSpot('overview')}
          aria-pressed={currentHotspot === 'overview'}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide transition-colors cursor-pointer',
            currentHotspot === 'overview'
              ? 'border-tk-flame bg-tk-flame text-white shadow-float'
              : 'tk-glass-dark text-white/85 hover:text-white',
          )}
        >
          <WokFlameIcon size={13} tone="cream" active={currentHotspot === 'overview'} />
          <span>Reel 4 Hồi</span>
        </button>

        {CHAPTER_HOTSPOTS.map((spot) => {
          const active = currentHotspot === spot.id;
          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => selectSpot(spot.id)}
              aria-pressed={active}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-tap cursor-pointer',
                active
                  ? 'border-tk-jade bg-tk-jade text-white shadow-jade'
                  : 'tk-glass-dark text-white/90 hover:border-white/35 hover:bg-tk-sanctuary-elevated/90',
              )}
            >
              {spot.renderIcon(active)}
              <span>{spot.label}</span>
              <span
                className={clsx(
                  'hidden xl:inline rounded-full px-1.5 py-0.5 text-[10px] font-bold tk-tabular',
                  active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70',
                )}
              >
                {spot.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Dark-Glass Culinary Telemetry & Chapter Readout */}
      <div className="pointer-events-auto absolute inset-x-3.5 bottom-3.5 z-20 rounded-2xl tk-glass-dark px-4 py-3 text-white">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-tk-flame-glow">
                {spec.actLabel}
              </span>
              <span className="hidden sm:inline text-white/25">•</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-tk-jade-mint">
                <FreshnessShieldIcon size={12} tone="cream" active />
                <span>Chuẩn vị bếp nhà</span>
              </span>
            </div>
            <p className="truncate text-sm font-extrabold text-white">{spec.title}</p>
            <p className="line-clamp-2 text-xs leading-relaxed text-white/75">{spec.summary}</p>
          </div>

          {currentHotspot !== 'overview' && (
            <button
              type="button"
              onClick={() => selectSpot('overview')}
              className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-tk-flame hover:border-tk-flame cursor-pointer"
            >
              Xem trọn Reel
            </button>
          )}
        </div>

        <div className="mt-2.5 border-t border-white/12 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-white/70 tk-tabular">
          <span>{spec.telemetry}</span>
          <span className="text-tk-jade-mint font-bold">HEARTH CINEMA V5</span>
        </div>
      </div>
    </CulinaryCinemaStage>
  );
};
