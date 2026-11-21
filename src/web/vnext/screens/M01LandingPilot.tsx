import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
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
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import {
  MascotIllustration,
  VERIFIED_VNEXT_RECIPE_MEDIA,
  VerifiedDishImage,
} from '../components/VNextMedia';
import { InteractiveKitchenLoopSvg } from '../interactive-svg/InteractiveKitchenLoopSvg';

const LazySunlitKitchenStage3D = lazy(() =>
  import('../webgl/SunlitKitchenStage3D').then((m) => ({
    default: m.SunlitKitchenStage3D,
  })),
);

const WORKFLOW_STEPS: Array<{
  step: string;
  title: string;
  description: string;
  icon: VNextIconName;
}> = [
  {
    step: '01',
    title: 'Kiểm tra & quét tủ lạnh',
    description:
      'Ghi lại thực phẩm đang có bằng tay hoặc chụp ảnh AI. Bạn luôn kiểm tra tên, định lượng và hạn dùng trước khi lưu vào kho.',
    icon: 'scan',
  },
  {
    step: '02',
    title: 'Chọn món & lập thực đơn tuần',
    description:
      'Đối chiếu nguyên liệu theo đúng đơn vị và khẩu phần gia đình để gợi ý bữa ăn khả thi và lên lịch cả tuần nhẹ đầu.',
    icon: 'calendar',
  },
  {
    step: '03',
    title: 'Đi chợ đúng nhu cầu & nấu từng bước',
    description:
      'Tự động trừ phần sẵn có để lập danh sách mua thêm, hướng dẫn nấu có hẹn giờ và chỉ trừ tồn kho sau khi bạn xác nhận đã nấu.',
    icon: 'recipes',
  },
];

const FEATURE_PILLS: Array<{ code: string; label: string; icon: VNextIconName }> = [
  { code: '01', label: 'Quản lý tủ lạnh theo lô', icon: 'fridge' },
  { code: '02', label: 'Gợi ý món đúng định lượng', icon: 'recipes' },
  { code: '03', label: 'Lên thực đơn 7 ngày', icon: 'calendar' },
  { code: '04', label: 'Danh sách đi chợ trừ tồn', icon: 'shopping' },
  { code: '05', label: 'AI Scan duyệt trước khi lưu', icon: 'scan' },
];

const SHOWCASE_SLUGS = [
  { slug: 'thit-kho-trung', title: 'Thịt kho tàu nước dừa trứng béo ngậy', time: '45 phút', servings: '4 người' },
  { slug: 'canh-chua-ca-loc-nam-bo', title: 'Canh chua cá lóc Nam Bộ', time: '25 phút', servings: '4 người' },
  { slug: 'ga-ta-kho-gung-sa', title: 'Gà ta kho gừng sả đậm đà', time: '25 phút', servings: '4 người' },
  { slug: 'rau-muong-xao-toi', title: 'Rau muống xào tỏi xanh giòn', time: '10 phút', servings: '3 người' },
] as const;

const GEO_COMPARISON_ROWS = [
  {
    criterion: 'Theo dõi tồn kho tủ lạnh',
    takolio: 'Theo lô nguyên liệu, ngăn nhiệt độ, phiên bản dữ liệu và phân biệt rõ hạn in bao bì với hạn ước tính.',
    manual: 'Dễ quên cập nhật sau khi nấu, khó chia sẻ nhất quán.',
    genericRecipeApp: 'Không quản lý lượng thực tế đang còn trong tủ.',
  },
  {
    criterion: 'Nhận diện nguyên liệu & hóa đơn AI',
    takolio: 'AI gợi ý bản nháp kèm độ tin cậy; bắt buộc người dùng duyệt trước khi lưu vào kho.',
    manual: 'Nhập từng dòng mất thời gian sau mỗi lần đi chợ.',
    genericRecipeApp: 'Ít hỗ trợ hoặc tự ghi đè thiếu kiểm chứng.',
  },
  {
    criterion: 'Đối chiếu công thức & khẩu phần',
    takolio: 'Nhân chia chính xác cho 1–20 người theo gram, ml, quả/cái và tính lượng mua thiếu ròng.',
    manual: 'Phải tự nhẩm tính khi tăng giảm số người ăn.',
    genericRecipeApp: 'Thường chỉ khớp tên nguyên liệu mà bỏ qua đơn vị đo.',
  },
  {
    criterion: 'Trừ tồn kho sau khi nấu',
    takolio: 'Chỉ trừ kho đúng 1 lần (idempotent) sau khi bạn xác nhận hoàn thành bữa ăn ở bước C22.',
    manual: 'Thường bị bỏ sót khiến số liệu lệch dần.',
    genericRecipeApp: 'Không kết nối vòng lặp nấu ăn với tồn kho.',
  },
] as const;

export const M01LandingPilot: React.FC = () => {
  const navigate = useNavigate();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [heroView, setHeroView] = useState<'3d' | 'photo'>('3d');

  const platformJsonLd = useMemo(() => buildPlatformWebAppJsonLd(), []);
  const satellite = isSatelliteComRuntime();

  useVNextSeo({
    title: 'Hôm nay ăn gì? Để Takolio giúp bạn',
    description:
      'Quản lý thực phẩm trong tủ lạnh, chọn món ngon khớp định lượng, lên thực đơn tuần và đi chợ thông minh cho gia đình hiện đại.',
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
      {/* Hero Section — Sunlit Ceramic & Terracotta Herb + Live 3D WebGL Stage */}
      <section aria-labelledby="m01-hero-heading" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-xs font-bold text-[var(--tkv-accent-ink,#9E4322)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
              <span>Trợ lý bếp thông minh cho gia đình hiện đại</span>
            </span>

            <h1
              id="m01-hero-heading"
              className="tkv-display font-extrabold text-[var(--tkv-ink,#2C221E)]"
            >
              Hôm nay ăn gì?
              <span className="block text-[var(--tkv-primary,#D86A43)] mt-1">Để Takolio giúp bạn.</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--tkv-ink-soft,#5F524A)] max-w-xl leading-relaxed">
              Quản lý thực phẩm, chọn món ngon từ nguyên liệu sẵn có, lên thực đơn tuần và đi chợ thông minh — giữ trọn dữ liệu riêng tư cho từng hộ gia đình trên <strong className="text-[var(--tkv-ink,#2C221E)]">takolio.app</strong>.
            </p>

            {guestError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-sm font-semibold text-[var(--tkv-accent-ink,#9E4322)] flex items-center gap-2.5"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#D86A43)] shrink-0" aria-hidden="true" />
                <span>{guestError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isStarting}
                onClick={() => void handleStartFree()}
                data-testid="m01-start-free-cta"
                className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <span>{isStarting ? 'Đang mở căn bếp…' : 'Bắt đầu miễn phí'}</span>
                <VNextIcon name="arrow-right" size={18} />
              </button>
              <Link
                to="/how-it-works"
                className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#D5C3B3)] text-[var(--tkv-ink,#2C221E)] font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[var(--tkv-surface-muted,#F7EFE6)] transition-colors"
              >
                <span>Khám phá cách hoạt động</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--tkv-ink-soft,#5F524A)]">
              {satellite ? (
                <>
                  <a
                    href={resolveAppSurfaceHref('/auth?mode=register')}
                    className="tkv-focusable font-bold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] underline"
                  >
                    Tạo tài khoản đồng bộ
                  </a>
                  <span aria-hidden="true">·</span>
                  <span>
                    Đã có tài khoản?{' '}
                    <a
                      href={resolveAppSurfaceHref('/auth?mode=login')}
                      className="font-bold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] underline"
                    >
                      Đăng nhập
                    </a>
                  </span>
                </>
              ) : (
                <>
                  <Link
                    to={vnextHref('/auth?mode=register')}
                    className="tkv-focusable font-bold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] underline"
                  >
                    Tạo tài khoản đồng bộ
                  </Link>
                  <span aria-hidden="true">·</span>
                  <span>
                    Đã có tài khoản?{' '}
                    <Link
                      to={vnextHref('/auth?mode=login')}
                      className="font-bold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] underline"
                    >
                      Đăng nhập
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="tkv-bento-card p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--tkv-ink,#2C221E)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
                  <span>Bàn bếp Nắng Gốm Sứ</span>
                </span>
                <div
                  role="tablist"
                  aria-label="Chế độ hiển thị không gian bếp"
                  className="inline-flex items-center gap-1 p-0.5 rounded-full bg-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={heroView === '3d'}
                    onClick={() => setHeroView('3d')}
                    className={clsx(
                      'tkv-focusable min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-full text-xs font-bold transition-colors',
                      heroView === '3d'
                        ? 'bg-[var(--tkv-primary,#D86A43)] text-white shadow-xs'
                        : 'text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-ink,#2C221E)]',
                    )}
                  >
                    3D Tương tác (WebGL)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={heroView === 'photo'}
                    onClick={() => setHeroView('photo')}
                    className={clsx(
                      'tkv-focusable min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-full text-xs font-bold transition-colors',
                      heroView === 'photo'
                        ? 'bg-[var(--tkv-primary,#D86A43)] text-white shadow-xs'
                        : 'text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-ink,#2C221E)]',
                    )}
                  >
                    Ảnh mâm cơm Việt
                  </button>
                </div>
              </div>

              {heroView === '3d' ? (
                <Suspense
                  fallback={
                    <div className="relative overflow-hidden rounded-[18px] aspect-[16/10] bg-[var(--tkv-surface-muted,#F7EFE6)]">
                      <img
                        src="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp"
                        srcSet="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp 640w, /takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp 1280w"
                        sizes="(max-width: 1024px) 100vw, 580px"
                        alt="Mâm cơm gia đình Việt trên bàn gốm sứ ấm nắng"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  }
                >
                  <LazySunlitKitchenStage3D
                    posterSrc="/takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp"
                    posterSrcSet="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp 640w, /takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp 1280w"
                    posterAlt="Mâm cơm gia đình Việt với nồi đất nung và nguyên liệu tươi trên bàn gỗ sáng"
                  />
                </Suspense>
              ) : (
                <div className="relative overflow-hidden rounded-[18px] aspect-[16/10] bg-[var(--tkv-surface-muted,#F7EFE6)]">
                  <img
                    src="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp"
                    srcSet="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp 640w, /takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp 1280w"
                    sizes="(max-width: 1024px) 100vw, 580px"
                    alt="Mâm cơm gia đình Việt với thịt kho tàu trứng, canh chua cá lóc, rau muống xào tỏi và rổ nguyên liệu tươi"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="pt-0.5 flex items-center justify-between gap-3 px-1 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <MascotIllustration pose="welcome" size={40} decorative className="border border-[var(--tkv-border,#EAE0D5)] bg-[var(--tkv-bg,#FCF9F5)]" />
                  <div>
                    <p className="text-xs font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Vòng lặp bếp khép kín
                    </p>
                    <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)]">
                      Tủ lạnh → Món ăn → Thực đơn → Đi chợ → Đứng bếp
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-[11px] font-bold text-[var(--tkv-sage-ink,#355940)]">
                  <VNextIcon name="shield" size={13} className="text-[var(--tkv-sage,#4E7A5B)]" />
                  <span>Tách biệt theo hộ gia đình</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Capability Culinary Strip */}
        <div id="tkv-features" className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FEATURE_PILLS.map((pill) => (
            <div
              key={pill.label}
              className="rounded-2xl bg-white border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] px-3.5 py-3 flex items-center gap-2.5 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0">
                <VNextIcon name={pill.icon} size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold text-[var(--tkv-ink-muted,#87776E)] tabular-nums">
                  {pill.code}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[var(--tkv-ink,#2C221E)] leading-snug">
                  {pill.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* M02 Preview Section — Interactive 5-Station Closed-Loop SVG + 3-Step Workflow */}
      <section
        id="tkv-how-it-works"
        aria-labelledby="m01-workflow-heading"
        className="border-y border-[var(--tkv-border,#EAE0D5)] bg-white py-12 sm:py-16 px-4 sm:px-6"
      >
        <div className="max-w-[1200px] mx-auto space-y-7">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#87776E)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
              <span>Cách Takolio hoạt động</span>
            </span>
            <h2 id="m01-workflow-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
              Từ nguyên liệu trong tủ đến bữa cơm trọn vẹn chỉ với 3 bước
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#5F524A)]">
              Chạm vào từng trạm trong sơ đồ tương tác bên dưới để xem cơ chế đối chiếu định lượng và kiểm duyệt thủ công của Takolio.
            </p>
          </div>

          <InteractiveKitchenLoopSvg
            onNavigate={(href) => navigateToAppSurface(vnextHref(href), navigate)}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-[20px] bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)] p-5 sm:p-6 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono tabular-nums text-xs font-extrabold px-2.5 py-1 rounded-full bg-white border border-[var(--tkv-border,#EAE0D5)] text-[var(--tkv-ink,#2C221E)]">
                      Bước {item.step}
                    </span>
                    <span className="w-10 h-10 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center">
                      <VNextIcon name={item.icon} size={18} />
                    </span>
                  </div>
                  <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#2C221E)]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* M06 Preview Section — Verified Vietnamese Dish Showcase */}
      <section id="tkv-dishes" aria-labelledby="m01-dishes-heading" className="max-w-[1200px] mx-auto py-12 sm:py-16 px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#87776E)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)]" aria-hidden="true" />
              <span>Kho công thức Việt chuẩn định lượng</span>
            </span>
            <h2 id="m01-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
              Món cơm nhà quen thuộc, đối chiếu lượng có và thiếu rõ ràng
            </h2>
          </div>
          <TkvButton
            variant="quiet"
            size="sm"
            iconRight="arrow-right"
            onClick={() => void handleStartFree()}
          >
            Dùng thử kho món ăn
          </TkvButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SHOWCASE_SLUGS.map((dish) => (
            <TkvSurface key={dish.slug} padded={false} className="overflow-hidden flex flex-col bg-white border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)]">
              <VerifiedDishImage slug={dish.slug} title={dish.title} />
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#2C221E)] line-clamp-2">
                    {dish.title}
                  </h3>
                  <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)]">
                    {VERIFIED_VNEXT_RECIPE_MEDIA[dish.slug]?.verifiedIngredientsSummary}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-mono tabular-nums font-bold text-[var(--tkv-ink,#2C221E)] pt-2 border-t border-[var(--tkv-border,#EAE0D5)]">
                  <span className="inline-flex items-center gap-1 text-[var(--tkv-accent-ink,#9E4322)]">
                    <VNextIcon name="timer" size={14} />
                    {dish.time}
                  </span>
                  <span className="text-[var(--tkv-ink-soft,#5F524A)]">{dish.servings}</span>
                </div>
              </div>
            </TkvSurface>
          ))}
        </div>
      </section>

      {/* GEO Answer-First Summary & Comparison Matrix */}
      <section
        id="tkv-geo-summary"
        aria-labelledby="m01-geo-heading"
        className="max-w-[1200px] mx-auto pb-12 sm:pb-16 px-4 sm:px-6 space-y-5"
      >
        <div className="rounded-[24px] bg-white border border-[var(--tkv-border,#EAE0D5)] p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-sage-ink,#355940)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)]" aria-hidden="true" />
              <span>Vì sao gia đình Việt chọn Takolio</span>
            </span>
            <h2 id="m01-geo-heading" className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
              Takolio khác gì so với ghi chú thủ công hay ứng dụng công thức đơn lẻ?
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
              Takolio là trợ lý căn bếp khép kín vận hành trên hai không gian chuyên biệt: cổng thông tin ẩm thực công khai tại <strong className="text-[var(--tkv-ink,#2C221E)]">takolio.com</strong> và không gian bếp riêng tư cho từng hộ gia đình tại <strong className="text-[var(--tkv-ink,#2C221E)]">takolio.app</strong>.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--tkv-border,#EAE0D5)]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[var(--tkv-surface-muted,#F7EFE6)] text-[var(--tkv-ink,#2C221E)] border-b border-[var(--tkv-border,#EAE0D5)]">
                  <th scope="col" className="py-3.5 px-4 font-extrabold">Tiêu chí thực tế</th>
                  <th scope="col" className="py-3.5 px-4 font-extrabold text-[var(--tkv-accent-ink,#9E4322)]">Takolio Kitchen Studio</th>
                  <th scope="col" className="py-3.5 px-4 font-bold text-[var(--tkv-ink-soft,#5F524A)]">Ghi chú thủ công</th>
                  <th scope="col" className="py-3.5 px-4 font-bold text-[var(--tkv-ink-soft,#5F524A)]">App công thức đơn lẻ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tkv-border,#EAE0D5)]">
                {GEO_COMPARISON_ROWS.map((row) => (
                  <tr key={row.criterion} className="hover:bg-[var(--tkv-bg,#FCF9F5)] transition-colors">
                    <th scope="row" className="py-3.5 px-4 font-bold text-[var(--tkv-ink,#2C221E)] align-top">
                      {row.criterion}
                    </th>
                    <td className="py-3.5 px-4 text-[var(--tkv-ink,#2C221E)] font-medium align-top">
                      {row.takolio}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--tkv-ink-soft,#5F524A)] align-top">
                      {row.manual}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--tkv-ink-soft,#5F524A)] align-top">
                      {row.genericRecipeApp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* M09 Sunlit Terracotta-Linen Pro Notice */}
      <section id="tkv-plus" aria-labelledby="m01-plus-heading" className="max-w-[1200px] mx-auto pb-14 px-4 sm:px-6">
        <div className="rounded-[24px] bg-gradient-to-br from-[var(--tkv-pro-from,#FFF9F5)] via-[var(--tkv-pro-via,#FDF1EA)] to-[var(--tkv-pro-to,#F9E5D8)] border border-[var(--tkv-pro-border,#EBCBB9)] text-[var(--tkv-ink,#2C221E)] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-soft">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/85 border border-[var(--tkv-accent-border,#F2D5C7)] text-xs font-bold text-[var(--tkv-accent-ink,#9E4322)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
              <span>Các gói sử dụng Takolio</span>
            </span>
            <h2 id="m01-plus-heading" className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
              Bắt đầu miễn phí với tủ lạnh, kho công thức và thực đơn cơ bản
            </h2>
            <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
              Mức phí và hạn mức gói <strong className="text-[var(--tkv-ink,#2C221E)]">Takolio Pro</strong> luôn được đọc trực tiếp từ máy chủ thanh toán chính thức — minh bạch biểu phí VND và không hiển thị giá ước đoán giả định.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              disabled={isStarting}
              onClick={() => void handleStartFree()}
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white text-sm font-extrabold shadow-xs inline-flex items-center transition-colors"
            >
              {isStarting ? 'Đang mở…' : 'Dùng thử miễn phí'}
            </button>
            <Link
              to="/pricing"
              className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#D5C3B3)] text-sm font-bold text-[var(--tkv-ink,#2C221E)] inline-flex items-center hover:bg-[var(--tkv-surface-muted,#F7EFE6)] transition-colors"
            >
              Xem biểu phí Pro
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingShell>
  );
};
