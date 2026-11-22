import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { vnextHref } from '../feature';
import {
  buildPlatformWebAppJsonLd,
  trackPublicConversion,
  useVNextSeo,
} from '../lib/seo';
import {
  isSatelliteComRuntime,
  navigateToAppSurface,
  resolveAppSurfaceHref,
} from '../lib/domain-surface';
import { PublicMarketingShell } from '../components/Shells';
import { TkvButton, TkvSurface } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import {
  BEMAM_MASCOT_SHOWCASE,
  BrandFeatureIcon,
  type BrandFeatureIconKey,
  CulinaryHillsBanner,
  MascotIllustration,
  VERIFIED_VNEXT_RECIPE_MEDIA,
  VerifiedDishImage,
} from '../components/VNextMedia';

const HERO_PILLAR_CARDS: ReadonlyArray<{
  icon: BrandFeatureIconKey;
  title: string;
  to: string;
}> = [
  { icon: 'fridge', title: 'Quản lý tủ lạnh', to: '/features/fridge' },
  { icon: 'recipes', title: 'Gợi ý món ăn', to: '/features/recipes' },
  { icon: 'planner', title: 'Lên thực đơn 7 ngày', to: '/features/meal-planning' },
  { icon: 'shopping', title: 'Danh sách mua sắm', to: '/features/shopping' },
  { icon: 'cooking', title: 'Nấu ăn từng bước', to: '/features/cooking' },
];

const CORE_FEATURE_CARDS: ReadonlyArray<{
  icon: BrandFeatureIconKey;
  title: string;
  subtitle: string;
  description: string;
  to: string;
}> = [
  {
    icon: 'fridge',
    title: 'Tủ lạnh',
    subtitle: 'Quản lý nguyên liệu',
    description: 'Theo dõi tồn kho theo từng lô, ngăn bảo quản và cảnh báo hạn dùng rõ ràng giữa hạn bao bì và hạn ước tính.',
    to: '/features/fridge',
  },
  {
    icon: 'scan',
    title: 'Quét nguyên liệu',
    subtitle: 'Nhận diện bằng AI',
    description: 'Chụp ngăn mát hoặc hóa đơn đi chợ để AI tạo bản nháp gợi ý. Bạn luôn kiểm duyệt trước khi lưu vào kho.',
    to: '/features/ai-scan',
  },
  {
    icon: 'recipes',
    title: 'Công thức',
    subtitle: 'Món ngon dễ làm',
    description: 'Kho món ăn gia đình Việt đối chiếu định lượng gram, ml, quả/cái và tự quy đổi khẩu phần 1–20 người.',
    to: '/features/recipes',
  },
  {
    icon: 'planner',
    title: 'Thực đơn',
    subtitle: 'Lên kế hoạch 7 ngày',
    description: 'Xếp lịch bữa sáng, trưa, tối cân bằng dinh dưỡng cho cả gia đình và đổi món linh hoạt khi bận rộn.',
    to: '/features/meal-planning',
  },
  {
    icon: 'shopping',
    title: 'Mua sắm',
    subtitle: 'Danh sách thông minh',
    description: 'Tự động trừ phần nguyên liệu đang sẵn trong tủ lạnh để chỉ liệt kê đúng lượng cần mua thêm khi đi chợ.',
    to: '/features/shopping',
  },
  {
    icon: 'cooking',
    title: 'Nấu ăn',
    subtitle: 'Hướng dẫn từng bước',
    description: 'Chế độ nấu cỡ chữ lớn, hẹn giờ ngay tại bước cần canh lửa và chỉ trừ tồn kho sau khi xác nhận hoàn thành.',
    to: '/features/cooking',
  },
];

const SHOWCASE_SLUGS = [
  { slug: 'thit-kho-trung', title: 'Thịt kho trứng', time: '30 phút', servings: '4 người', level: 'Dễ làm' },
  { slug: 'canh-chua-ca-loc-nam-bo', title: 'Canh chua cá lóc Nam Bộ', time: '25 phút', servings: '4 người', level: 'Dễ làm' },
  { slug: 'ga-ta-kho-gung-sa', title: 'Gà ta kho gừng sả', time: '25 phút', servings: '4 người', level: 'Đậm đà' },
  { slug: 'rau-muong-xao-toi', title: 'Rau muống xào tỏi', time: '10 phút', servings: '3 người', level: 'Nhanh gọn' },
] as const;

export const M01LandingPilot: React.FC = () => {
  const navigate = useNavigate();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const platformJsonLd = useMemo(() => buildPlatformWebAppJsonLd(), []);
  const satellite = isSatelliteComRuntime();

  useVNextSeo({
    title: 'Takolio — Bữa ngon, nhẹ đầu. | Trợ lý bếp gia đình thông minh với AI',
    description:
      'Ăn đủ. Mua đủ. Dùng hết. Quản lý tủ lạnh, quét nguyên liệu bằng AI, gợi ý món ngon chuẩn vị Việt, lên thực đơn 7 ngày và tạo danh sách mua sắm thông minh cùng Bé Mầm Bếp.',
    canonicalPath: '/',
    domainSurface: 'marketing',
    jsonLd: platformJsonLd,
  });

  const handleStartFree = async () => {
    trackPublicConversion('m01_start_free');
    setGuestError(null);
    if (isSatelliteComRuntime()) {
      window.location.assign(resolveAppSurfaceHref('/auth?mode=guest'));
      return;
    }
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/welcome'));
    } catch (err) {
      setGuestError(
        err instanceof Error
          ? err.message
          : 'Không thể khởi tạo phiên dùng thử ngay lúc này. Bạn có thể đăng ký tài khoản hoặc thử lại.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <PublicMarketingShell screenId="M01">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-10 sm:gap-12">
        {/* HERO SECTION — Exact Official Brand Board v2 (`board-2.jpg`) */}
        <section
          aria-labelledby="m01-hero-heading"
          className="tkv-leaf-wave-band rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] p-4 sm:p-10 shadow-[var(--tkv-shadow-elevated)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary)]" aria-hidden="true" />
                <span>Trợ lý bếp gia đình thông minh với AI</span>
              </div>

              <h1 id="m01-hero-heading" className="tkv-display tracking-tight">
                <span className="text-[var(--tkv-primary)]">Bữa ngon, </span>
                <span className="text-[var(--tkv-coral)]">nhẹ đầu.</span>
              </h1>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-1.5 text-sm sm:text-base font-extrabold text-[var(--tkv-primary)]">
                  Ăn đủ. Mua đủ. Dùng hết.
                </span>
              </div>

              <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed max-w-xl">
                Đồng hành cùng <strong>Bé Mầm Bếp</strong> quản lý nguyên liệu trong tủ lạnh, quét thực phẩm bằng AI, gợi ý mâm cơm gia đình khớp định lượng và lên thực đơn 7 ngày thật thảnh thơi.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <TkvButton
                  data-testid="m01-start-free-cta"
                  variant="primary"
                  size="lg"
                  isLoading={isStarting}
                  iconRight="arrow-right"
                  onClick={() => void handleStartFree()}
                >
                  Bắt đầu miễn phí ngay
                </TkvButton>
                <Link
                  to="/how-it-works"
                  className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface-coral)] hover:opacity-95 border border-[var(--tkv-border-coral)] text-[var(--tkv-ink)] font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Xem cách hoạt động</span>
                </Link>
              </div>

              {guestError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-sm font-semibold text-[var(--tkv-coral-ink)]"
                >
                  {guestError}
                </div>
              )}

              {/* 5 Quick Brand Board Feature Tiles (matching board-2.jpg top-left row) */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {HERO_PILLAR_CARDS.map((card) => (
                  <Link
                    key={card.to}
                    to={card.to}
                    className="tkv-focusable last:col-span-2 sm:last:col-span-1 rounded-2xl bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] p-2.5 flex flex-col items-center text-center gap-2 transition-colors min-w-0"
                  >
                    <BrandFeatureIcon name={card.icon} size={44} />
                    <span className="tkv-heading text-xs font-extrabold text-[var(--tkv-ink)] leading-snug">
                      {card.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Hero Right Visual — AI-Generated Bé Mầm Bếp Kitchen Scene (`board-2.jpg`) */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden border-2 border-[var(--tkv-border-mint)] bg-[var(--tkv-bg)] shadow-[var(--tkv-shadow-elevated)]">
                <img
                  src="/takolio/brand-v2/mascot/bemam-hero-kitchen-640w.webp"
                  srcSet="/takolio/brand-v2/mascot/bemam-hero-kitchen-640w.webp 640w, /takolio/brand-v2/mascot/bemam-hero-kitchen.webp 1280w"
                  sizes="(max-width: 1024px) 100vw, 580px"
                  alt="Bé Mầm Bếp cầm muỗng gỗ giơ ngón cái bên thố thịt kho trứng, tô canh chua cá và chén cơm trắng nóng hổi"
                  loading="eager"
                  className="w-full aspect-[16/10] object-cover"
                />
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 max-w-[calc(100%-24px)] rounded-full bg-[var(--tkv-primary)] text-white px-3.5 sm:px-4 py-1.5 shadow-[var(--tkv-shadow-float)] border border-white/30 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-saffron)] shrink-0" aria-hidden="true" />
                  <span className="tkv-heading text-xs sm:text-sm font-extrabold truncate">
                    Bé Mầm Bếp · Mascot Takolio
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BỘ ICON TÍNH NĂNG CỐT LÕI (6 AI-Generated Feature Cards per `board-2.jpg`) */}
        <section aria-labelledby="m01-features-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center rounded-full bg-[var(--tkv-primary)] text-white px-3.5 py-1 text-xs font-extrabold">
                Bộ tính năng cốt lõi
              </span>
              <h2 id="m01-features-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                Khép kín vòng lặp căn bếp gia đình
              </h2>
            </div>
            <Link
              to="/how-it-works"
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>Xem chi tiết quy trình</span>
              <VNextIcon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CORE_FEATURE_CARDS.map((feat) => (
              <Link
                key={feat.to}
                to={feat.to}
                className="tkv-focusable tkv-bento-card p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <BrandFeatureIcon name={feat.icon} size={50} />
                    <div className="min-w-0">
                      <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                        {feat.title}
                      </h3>
                      <p className="text-xs font-bold text-[var(--tkv-primary)]">
                        {feat.subtitle}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-snug">
                    {feat.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--tkv-primary)]">
                  <span>Khám phá {feat.title.toLowerCase()}</span>
                  <VNextIcon name="chevron-right" size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* BÉ MẦM BẾP — HÀNH ĐỘNG & BIỂU CẢM (6-Pose Mascot Gallery per `board-2.jpg`) */}
        <section
          aria-labelledby="m01-mascot-heading"
          data-testid="m01-bemam-showcase"
          className="rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] p-4 sm:p-7 space-y-5 shadow-[var(--tkv-shadow-card)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center rounded-full bg-[var(--tkv-primary)] text-white px-3.5 py-1 text-xs font-extrabold">
                Bé Mầm Bếp — Hành động & biểu cảm
              </span>
              <h2 id="m01-mascot-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                Người bạn nhỏ ấm áp trong mọi khoảnh khắc vào bếp
              </h2>
            </div>
            <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] max-w-md">
              Nồi sứ trắng đội mũ đầu bếp nảy mầm xanh, quàng khăn cam đỏ — luôn nhắc hạn dùng khéo léo và cổ vũ cả nhà ăn ngon.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {BEMAM_MASCOT_SHOWCASE.map((item) => (
              <div
                key={item.pose}
                className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-3 sm:p-3.5 flex flex-col items-center text-center gap-2 min-w-0"
              >
                <MascotIllustration pose={item.pose} size={116} className="w-20 h-20 sm:w-28 sm:h-28 max-w-full" />
                <div className="space-y-0.5 min-w-0">
                  <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-[var(--tkv-ink-muted)]">
                    ({item.subtitle})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GỢI Ý MÓN NGON HÔM NAY (`Hôm nay ăn gì?` Dish Preview) */}
        <section aria-labelledby="m01-dishes-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-coral-ink)]">
                Hôm nay ăn gì?
              </span>
              <h2 id="m01-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                Mâm cơm gia đình Việt từ nguyên liệu sẵn có
              </h2>
            </div>
            <Link
              to="/features/recipes"
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>Xem kho món ăn</span>
              <VNextIcon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHOWCASE_SLUGS.map((dish) => {
              const media = VERIFIED_VNEXT_RECIPE_MEDIA[dish.slug];
              return (
                <TkvSurface key={dish.slug} padded={false} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <VerifiedDishImage slug={dish.slug} title={dish.title} aspectClass="aspect-[4/3]" />
                    <div className="p-4 space-y-2">
                      <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                        {dish.title}
                      </h3>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] line-clamp-2">
                        {media?.verifiedIngredientsSummary}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap pt-1 text-xs font-semibold text-[var(--tkv-ink-muted)] tabular-nums">
                        <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-bold">
                          {dish.time}
                        </span>
                        <span>· {dish.servings}</span>
                        <span>· {dish.level}</span>
                      </div>
                    </div>
                  </div>
                </TkvSurface>
              );
            })}
          </div>
        </section>

        {/* GÓI MIỄN PHÍ & TAKOLIO PRO */}
        <section
          aria-labelledby="m01-pricing-heading"
          className="rounded-3xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-saffron)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-ink)]">
              <VNextIcon name="crown" size={14} className="text-[var(--tkv-warning)]" />
              <span>Minh bạch chi phí · Bắt đầu miễn phí</span>
            </span>
            <h2 id="m01-pricing-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
              Dùng miễn phí trọn bộ quản lý tủ lạnh, công thức & danh sách mua sắm
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              Nâng cấp <strong>Takolio Pro</strong> khi gia đình bạn cần mở rộng lượt quét AI mỗi tháng và lập thực đơn 7 ngày tự động không giới hạn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <TkvButton
              variant="primary"
              onClick={() =>
                satellite
                  ? window.location.assign(resolveAppSurfaceHref('/auth?mode=register'))
                  : navigateToAppSurface(vnextHref('/auth?mode=register'), navigate)
              }
            >
              Tạo tài khoản miễn phí
            </TkvButton>
            <Link
              to="/pricing"
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center justify-center transition-colors"
            >
              Xem bảng giá chi tiết
            </Link>
          </div>
        </section>

        {/* HOẠ TIẾT ĐỒI XANH & ĐẠO CỤ BẾP (`board.jpg` Decorative Strip) */}
        <CulinaryHillsBanner />
      </div>
    </PublicMarketingShell>
  );
};
