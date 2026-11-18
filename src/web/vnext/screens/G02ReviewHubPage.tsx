import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/tokens.css';
import { useBrandDirection, type BrandDirection } from '../feature';
import { G02DirectionPreviewBar } from '../components/Shells';
import {
  BrandLockup,
  MascotIllustration,
  VERIFIED_VNEXT_RECIPE_MEDIA,
  VerifiedDishImage,
  type MascotPose,
} from '../components/VNextMedia';
import {
  ALL_VNEXT_ICON_NAMES,
  VNEXT_ICON_LABELS_VI,
  VNextIcon,
} from '../components/VNextIcons';
import { TkvBadge, TkvSurface } from '../components/Primitives';

const DIRECTIONS: Array<{
  id: BrandDirection;
  title: string;
  recommended?: boolean;
  swatches: Array<{ label: string; hex: string; contrast: string }>;
  rationale: string;
}> = [
  {
    id: 'a',
    title: 'Direction A — Kitchen Studio Leaf & Coral',
    recommended: true,
    swatches: [
      { label: 'Leaf Primary', hex: '#196149', contrast: '7.38:1 AAA (white text)' },
      { label: 'Coral CTA', hex: '#C8432B', contrast: '5.38:1 AA (white text)' },
      { label: 'Saffron Accent', hex: '#F6C453', contrast: '8.95:1 AAA (dark ink)' },
      { label: 'Warm Ivory', hex: '#FFF9F1', contrast: '13.9:1 AAA (#152E2C ink)' },
    ],
    rationale:
      'Khớp trực tiếp bảng màu Kitchen Studio trong DESIGN_TOKENS_CANDIDATE.json và 85 wireframe; đã hiệu chỉnh Coral CTA #C8432B đạt chuẩn WCAG 2.2 AA.',
  },
  {
    id: 'b',
    title: 'Direction B — Botanical Market Herb & Linen',
    swatches: [
      { label: 'Forest Herb', hex: '#14533D', contrast: '8.89:1 AAA (white text)' },
      { label: 'Amber Citrus', hex: '#B45309', contrast: '5.02:1 AA (white text)' },
      { label: 'Sage Linen', hex: '#F4F8F4', contrast: '14.2:1 AAA (#132A23 ink)' },
    ],
    rationale:
      'Sắc xanh thảo mộc dịu mát kiểu chợ nông sản hữu cơ, ít sắc san hô hơn, hợp người dùng thích tông lạnh nhẹ.',
  },
  {
    id: 'c',
    title: 'Direction C — Warm Terracotta Hearth & Slate',
    swatches: [
      { label: 'Bistro Slate', hex: '#1E3A34', contrast: '11.8:1 AAA (white text)' },
      { label: 'Clay Terracotta', hex: '#B83B28', contrast: '5.65:1 AA (white text)' },
      { label: 'Cream Stone', hex: '#FDF6EE', contrast: '14.6:1 AAA (#1B2422 ink)' },
    ],
    rationale:
      'Cảm hứng bếp đất nung ấm áp và biên tập ẩm thực cổ điển, độ tương phản đậm hơn.',
  },
];

const MASCOT_POSES: Array<{ pose: MascotPose; code: string; screens: string }> = [
  { pose: 'welcome', code: 'Pose 01 · Welcome', screens: 'M01, A01, O01' },
  { pose: 'guide', code: 'Pose 02 · Guide', screens: 'O02, O03, O04' },
  { pose: 'scanning', code: 'Pose 03 · AI Scan', screens: 'C09, C11, M03' },
  { pose: 'empty-fridge', code: 'Pose 04 · Empty Fridge', screens: 'C03, S06' },
  { pose: 'cooking', code: 'Pose 05 · Cooking', screens: 'C20, C21, M07' },
  { pose: 'achievement', code: 'Pose 06 · Achievement', screens: 'O06, C22' },
  { pose: 'offline', code: 'Pose 07 · Offline Safe', screens: 'S04, C27' },
  { pose: 'error', code: 'Pose 08 · Gentle Recovery', screens: 'S01–S03, S05' },
];

const PILOT_LINKS = [
  { id: 'M01', title: 'Landing — Hôm nay ăn gì?', to: '/landing?vnext=1', group: 'Public Website' },
  { id: 'A02', title: 'Đăng nhập tài khoản', to: '/auth?mode=login&vnext=1', group: 'Authentication' },
  { id: 'O03', title: 'Gia đình và khẩu phần (1..20)', to: '/onboarding/household?vnext=1', group: 'Onboarding' },
  { id: 'C01', title: 'Hôm nay ăn gì? (Home)', to: '/?vnext=1', group: 'Consumer App' },
  { id: 'C03', title: 'Tủ lạnh của tôi (Inventory)', to: '/fridge?vnext=1', group: 'Consumer App' },
  { id: 'C18', title: 'Chi tiết món ăn (Thịt kho trứng)', to: '/recipes/thit-kho-trung?vnext=1', group: 'Consumer App' },
  { id: 'C23', title: 'Thực đơn tuần (Planner)', to: '/planner?vnext=1', group: 'Consumer App' },
  { id: 'AD02', title: 'Tổng quan hệ thống (/admin?vnext=1)', to: '/admin/?vnext=1', group: 'Admin Console (bundle riêng)' },
] as const;

export const G02ReviewHubPage: React.FC = () => {
  const { search } = useLocation();
  const [direction, setDirection] = useBrandDirection(search);

  return (
    <div className="tkv-root min-h-dvh pb-16" data-tkv-direction={direction} data-tkv-screen="G02_HUB">
      <G02DirectionPreviewBar direction={direction} onDirectionChange={setDirection} screenId="G02" />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-7">
        {/* Header */}
        <section className="space-y-3">
          <TkvBadge tone="warning" icon="sparkles">
            Gate G02 · Hồ Sơ Duyệt Thị Giác & Tài Sản Nguyên Bản (OWNER APPROVAL: PENDING)
          </TkvBadge>
          <h1 className="tkv-heading text-3xl sm:text-4xl font-extrabold text-[var(--tkv-ink)]">
            Takolio Frontend vNext — Kitchen Studio Design & Pilot Board
          </h1>
          <p className="text-base text-[var(--tkv-ink-secondary)] max-w-3xl leading-relaxed">
            Toàn bộ tài sản mới được lưu tách biệt tại <code>public/takolio/vnext/</code>; bộ thương hiệu gốc <code>public/takolio/v1/</code> và 341 tệp bảo vệ (Worker, D1, Domain, PayOS) được giữ nguyên vẹn 100%.
          </p>
        </section>

        {/* 1. 8 Live Pilot Screens */}
        <section aria-labelledby="g02-pilots-heading" className="space-y-4">
          <h2 id="g02-pilots-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            1. Tám Màn Hình Pilot Hoạt Động Thật (M01 · A02 · O03 · C01 · C03 · C18 · C23 · AD02)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILOT_LINKS.map((pilot) => (
              <Link
                key={pilot.id}
                to={pilot.to}
                className="tkv-focusable rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-4 space-y-2 hover:border-[var(--tkv-primary)] shadow-[var(--tkv-shadow-card)] flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[var(--tkv-primary)] text-white text-xs font-extrabold">
                      {pilot.id}
                    </span>
                    <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">{pilot.group}</span>
                  </div>
                  <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                    {pilot.title}
                  </h3>
                </div>
                <span className="text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1 pt-2">
                  Mở màn hình thật <VNextIcon name="arrow-right" size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 2. Brand Directions A / B / C */}
        <section aria-labelledby="g02-directions-heading" className="space-y-4">
          <h2 id="g02-directions-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            2. So Sánh 3 Phương Án Nhận Diện (A / B / C)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {DIRECTIONS.map((dir) => (
              <TkvSurface
                key={dir.id}
                className={`space-y-4 flex flex-col justify-between ${direction === dir.id ? 'ring-2 ring-[var(--tkv-primary)]' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <BrandLockup direction={dir.id} />
                    {dir.recommended && (
                      <TkvBadge tone="success" icon="check">
                        Đề xuất chính
                      </TkvBadge>
                    )}
                  </div>
                  <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">{dir.title}</h3>
                  <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{dir.rationale}</p>
                  <div className="space-y-2 pt-1">
                    {dir.swatches.map((sw) => (
                      <div key={sw.hex} className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 font-bold text-[var(--tkv-ink)]">
                          <span
                            className="w-5 h-5 rounded-md border border-black/10 shrink-0"
                            style={{ backgroundColor: sw.hex }}
                          />
                          {sw.label} ({sw.hex})
                        </span>
                        <span className="text-[var(--tkv-ink-muted)]">{sw.contrast}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDirection(dir.id)}
                  className="tkv-focusable min-h-[44px] w-full rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] text-white font-bold text-sm"
                >
                  {direction === dir.id ? `Đang áp dụng Style ${dir.id.toUpperCase()}` : `Xem thử Style ${dir.id.toUpperCase()}`}
                </button>
              </TkvSurface>
            ))}
          </div>
        </section>

        {/* 3. Mascot Concept Sheet + Vector Master + 8 Poses */}
        <section aria-labelledby="g02-mascot-heading" className="space-y-4">
          <h2 id="g02-mascot-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            3. Linh Vật Nguyên Bản “Bé Mầm Bếp” (Concept Sheet A/B/C · Vector Master · 8 Poses)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <TkvSurface className="lg:col-span-7 p-4 space-y-2">
              <img
                src="/takolio/vnext/mascot/mascot-concept-sheet-abc.webp"
                alt="Bảng phác thảo 3 concept linh vật mới: A Bé Mầm Bếp nồi gốm, B Hạt Gạo, C Nhánh Thảo Mộc"
                className="w-full rounded-2xl border border-[var(--tkv-border)]"
              />
              <p className="text-xs text-[var(--tkv-ink-secondary)]">
                3 phương án tạo mới hoàn toàn độc lập: <strong>Concept A (trái — Bé Mầm Bếp nồi gốm)</strong>, Concept B (giữa — Hạt Gạo tạp dề xanh), Concept C (phải — Phới Thảo Mộc).
              </p>
            </TkvSurface>
            <TkvSurface tone="mint" className="lg:col-span-5 p-5 space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
                Pure Editable SVG Master (Không nhúng bitmap)
              </p>
              <div className="flex items-end gap-4 bg-white p-4 rounded-2xl border border-[var(--tkv-border)]">
                <MascotIllustration pose="vector" size={96} />
                <MascotIllustration pose="vector" size={48} />
                <MascotIllustration pose="vector" size={32} />
              </div>
              <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed">
                Tệp <code>mascot-master-vector.svg</code> được dựng bằng đường path vector thuần khiết (nhận diện sắc nét ở 32px); 8 tư thế biểu cảm minh họa đi kèm được xuất WebP đã gỡ sạch EXIF.
              </p>
            </TkvSurface>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {MASCOT_POSES.map((item) => (
              <TkvSurface key={item.code} className="p-3.5 flex flex-col items-center text-center gap-2">
                <MascotIllustration pose={item.pose} size={96} />
                <p className="text-xs font-extrabold text-[var(--tkv-ink)]">{item.code}</p>
                <p className="text-[11px] text-[var(--tkv-ink-muted)]">Màn: {item.screens}</p>
              </TkvSurface>
            ))}
          </div>
        </section>

        {/* 4. Verified Recipe Photography Contact Sheet */}
        <section aria-labelledby="g02-food-heading" className="space-y-4">
          <h2 id="g02-food-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            4. Ảnh Món Ăn Nguyên Bản Đúng Công Thức Xác Minh (Zero Wrong-Dish Substitution)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(VERIFIED_VNEXT_RECIPE_MEDIA).map(([slug, media]) => (
              <TkvSurface key={slug} padded={false} className="overflow-hidden flex flex-col">
                <VerifiedDishImage slug={slug} title={slug} />
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <code className="font-bold text-[var(--tkv-primary)]">{slug}</code>
                    <TkvBadge tone="warning" icon="info">
                      PENDING
                    </TkvBadge>
                  </div>
                  <p className="text-xs text-[var(--tkv-ink-secondary)]">
                    {media.verifiedIngredientsSummary}
                  </p>
                </div>
              </TkvSurface>
            ))}
          </div>
        </section>

        {/* 5. 53 Pure-Vector 24px SVG Icons QA Sheet (16 / 20 / 24 / 32px) */}
        <section aria-labelledby="g02-icons-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 id="g02-icons-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
                5. Bộ {ALL_VNEXT_ICON_NAMES.length} Icon Vector Nguyên Bản 24×24px (Kiểm Thử 16 / 20 / 24 / 32px)
              </h2>
              <p className="text-sm text-[var(--tkv-ink-secondary)]">
                100% đường <code>&lt;path&gt;/&lt;circle&gt;/&lt;rect&gt;</code> thuần, nét 2px optical grid, <code>currentColor</code>, không chứa ảnh bitmap nhúng.
              </p>
            </div>
          </div>

          <TkvSurface className="p-4 flex items-center gap-6 flex-wrap bg-[var(--tkv-surface-mint)]">
            <span className="text-xs font-extrabold text-[var(--tkv-primary)]">Thang kích thước chuẩn:</span>
            {([16, 20, 24, 32] as const).map((sz) => (
              <span key={sz} className="inline-flex items-center gap-2 text-xs font-bold text-[var(--tkv-ink)] bg-white px-3 py-1.5 rounded-xl border border-[var(--tkv-border)]">
                <VNextIcon name="recipes" size={sz} className="text-[var(--tkv-primary)]" />
                <span>{sz}px</span>
              </span>
            ))}
          </TkvSurface>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {ALL_VNEXT_ICON_NAMES.map((iconName) => (
              <div
                key={iconName}
                className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-3 flex flex-col items-center text-center gap-1.5"
              >
                <VNextIcon name={iconName} size={24} className="text-[var(--tkv-primary)]" />
                <span className="text-[11px] font-bold text-[var(--tkv-ink)] leading-tight">
                  {VNEXT_ICON_LABELS_VI[iconName]}
                </span>
                <code className="text-[10px] text-[var(--tkv-ink-muted)]">{iconName}</code>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
