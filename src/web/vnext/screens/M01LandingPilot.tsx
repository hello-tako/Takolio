import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { vnextHref } from '../feature';
import { trackPublicConversion, useVNextSeo } from '../lib/seo';
import { PublicMarketingShell } from '../components/Shells';
import { TkvBadge, TkvButton, TkvSurface } from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { MascotIllustration, VERIFIED_VNEXT_RECIPE_MEDIA, VerifiedDishImage } from '../components/VNextMedia';

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

const FEATURE_PILLS: Array<{ label: string; icon: VNextIconName }> = [
  { label: 'Quản lý tủ lạnh theo lô', icon: 'fridge' },
  { label: 'Gợi ý món đúng định lượng', icon: 'recipes' },
  { label: 'Lên thực đơn 7 ngày', icon: 'calendar' },
  { label: 'Danh sách đi chợ trừ tồn', icon: 'shopping' },
  { label: 'AI Scan duyệt trước khi lưu', icon: 'scan' },
];

const SHOWCASE_SLUGS = [
  { slug: 'thit-kho-trung', title: 'Thịt kho tàu nước dừa trứng béo ngậy', time: '45 phút', servings: '4 người' },
  { slug: 'canh-chua-ca-loc-nam-bo', title: 'Canh chua cá lóc Nam Bộ', time: '25 phút', servings: '4 người' },
  { slug: 'ga-ta-kho-gung-sa', title: 'Gà ta kho gừng sả đậm đà', time: '25 phút', servings: '4 người' },
  { slug: 'rau-muong-xao-toi', title: 'Rau muống xào tỏi xanh giòn', time: '10 phút', servings: '3 người' },
] as const;

export const M01LandingPilot: React.FC = () => {
  const navigate = useNavigate();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  useVNextSeo({
    title: 'Hôm nay ăn gì? Để Takolio giúp bạn',
    description:
      'Quản lý thực phẩm trong tủ lạnh, chọn món ngon khớp định lượng, lên thực đơn tuần và đi chợ thông minh cho gia đình hiện đại.',
    canonicalPath: '/landing',
  });

  const handleStartFree = async () => {
    trackPublicConversion('m01_start_free');
    setGuestError(null);
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/household'));
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
    <PublicMarketingShell
      screenId="M01"
      onStartFree={handleStartFree}
      isStartingFree={isStarting}
    >
      {/* Hero Section — faithful to M01.png (Headline + Coral Primary CTA + Secondary Outline CTA + Framed Dish Visual) */}
      <section aria-labelledby="m01-hero-heading" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <TkvBadge tone="success" icon="sparkles">
              Trợ lý bếp thông minh cho gia đình hiện đại
            </TkvBadge>

            <h1
              id="m01-hero-heading"
              className="tkv-heading text-[2rem] sm:text-[2.75rem] lg:text-[3.1rem] font-extrabold text-[var(--tkv-ink)] tracking-tight leading-[1.14]"
            >
              Hôm nay ăn gì?
              <span className="block text-[var(--tkv-primary)] mt-1">Để Takolio giúp bạn.</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] max-w-xl leading-relaxed">
              Quản lý thực phẩm, chọn món ngon từ nguyên liệu sẵn có, lên thực đơn tuần và đi chợ thông minh — giữ trọn dữ liệu riêng tư cho từng hộ gia đình.
            </p>

            {guestError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/30 text-sm font-semibold text-[var(--tkv-danger)] flex items-center gap-2"
              >
                <VNextIcon name="error" size={18} />
                <span>{guestError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <TkvButton
                variant="coral"
                size="lg"
                iconRight="arrow-right"
                isLoading={isStarting}
                onClick={handleStartFree}
                data-testid="m01-start-free-cta"
              >
                Bắt đầu miễn phí
              </TkvButton>
              <Link
                to="/how-it-works"
                className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[var(--tkv-surface-mint)] transition-colors"
              >
                <span>Khám phá cách hoạt động</span>
              </Link>
            </div>

            <p className="text-xs text-[var(--tkv-ink-muted)]">
              Dùng thử ngay không cần thẻ thanh toán · Hoặc{' '}
              <Link to={vnextHref('/auth?mode=login')} className="font-bold text-[var(--tkv-primary)] underline">
                đăng nhập tài khoản đã có
              </Link>
              .
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[28px] bg-[var(--tkv-surface-mint)] p-3 sm:p-5 border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-card)]">
              <div className="relative overflow-hidden rounded-[22px] aspect-[16/10] bg-[var(--tkv-surface)]">
                <img
                  src="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp"
                  srcSet="/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp 640w, /takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp 1280w"
                  sizes="(max-width: 1024px) 100vw, 580px"
                  alt="Mâm cơm gia đình Việt với thịt kho tàu trứng, canh chua cá lóc, rau muống xào tỏi và rổ nguyên liệu tươi"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-3.5 flex items-center justify-between gap-3 px-1 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <MascotIllustration pose="welcome" size={44} decorative />
                  <div>
                    <p className="text-xs font-extrabold text-[var(--tkv-primary)]">
                      Vòng lặp bếp khép kín
                    </p>
                    <p className="text-xs text-[var(--tkv-ink-secondary)]">
                      Tủ lạnh → Món ăn → Thực đơn → Đi chợ → Đứng bếp
                    </p>
                  </div>
                </div>
                <TkvBadge tone="neutral" icon="shield">
                  Tách biệt theo hộ gia đình
                </TkvBadge>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Capability Strip matching M01 concept board */}
        <div id="tkv-features" className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FEATURE_PILLS.map((pill) => (
            <TkvSurface key={pill.label} padded={false} className="px-3.5 py-3 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                <VNextIcon name={pill.icon} size={18} />
              </span>
              <span className="text-xs sm:text-sm font-bold text-[var(--tkv-ink)] leading-snug">
                {pill.label}
              </span>
            </TkvSurface>
          ))}
        </div>
      </section>

      {/* M02 Preview Section — 3-Step Closed-Loop Kitchen Workflow */}
      <section
        id="tkv-how-it-works"
        aria-labelledby="m01-workflow-heading"
        className="border-y border-[var(--tkv-border)] bg-[var(--tkv-surface)] py-12 sm:py-16 px-4 sm:px-6"
      >
        <div className="max-w-[1200px] mx-auto space-y-7">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
              Cách Takolio hoạt động
            </span>
            <h2 id="m01-workflow-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
              Từ nguyên liệu trong tủ đến bữa cơm trọn vẹn chỉ với 3 bước
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
              AI hỗ trợ nhận diện nhanh — quyền kiểm duyệt và xác nhận cuối cùng luôn thuộc về bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {WORKFLOW_STEPS.map((item) => (
              <TkvSurface key={item.step} tone="mint" className="space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="tkv-heading text-sm font-extrabold px-2.5 py-1 rounded-full bg-white text-[var(--tkv-primary)]">
                      Bước {item.step}
                    </span>
                    <span className="w-10 h-10 rounded-2xl bg-[var(--tkv-primary)] text-white flex items-center justify-center">
                      <VNextIcon name={item.icon} size={20} />
                    </span>
                  </div>
                  <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </TkvSurface>
            ))}
          </div>
        </div>
      </section>

      {/* M06 Preview Section — Verified Vietnamese Dish Showcase */}
      <section id="tkv-dishes" aria-labelledby="m01-dishes-heading" className="max-w-[1200px] mx-auto py-12 sm:py-16 px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
              Kho công thức Việt chuẩn định lượng
            </span>
            <h2 id="m01-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
              Món cơm nhà quen thuộc, đối chiếu lượng có và thiếu rõ ràng
            </h2>
          </div>
          <TkvButton variant="secondary" size="sm" iconRight="arrow-right" onClick={handleStartFree}>
            Dùng thử kho món ăn
          </TkvButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SHOWCASE_SLUGS.map((dish) => (
            <TkvSurface key={dish.slug} padded={false} className="overflow-hidden flex flex-col">
              <VerifiedDishImage slug={dish.slug} title={dish.title} />
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] line-clamp-2">
                    {dish.title}
                  </h3>
                  <p className="text-xs text-[var(--tkv-ink-muted)]">
                    {VERIFIED_VNEXT_RECIPE_MEDIA[dish.slug]?.verifiedIngredientsSummary}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-[var(--tkv-primary)] pt-2 border-t border-[var(--tkv-border)]">
                  <span className="inline-flex items-center gap-1">
                    <VNextIcon name="timer" size={14} />
                    {dish.time}
                  </span>
                  <span>{dish.servings}</span>
                </div>
              </div>
            </TkvSurface>
          ))}
        </div>
      </section>

      {/* M09 Transparent Plus Notice (No invented prices — truthful server-authority callout) */}
      <section id="tkv-plus" aria-labelledby="m01-plus-heading" className="max-w-[1200px] mx-auto pb-14 px-4 sm:px-6">
        <TkvSurface tone="saffron" className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <TkvBadge tone="warning" icon="crown">
              Các gói sử dụng Takolio (M09)
            </TkvBadge>
            <h2 id="m01-plus-heading" className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
              Bắt đầu miễn phí với tủ lạnh, kho công thức và thực đơn cơ bản
            </h2>
            <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
              Mức phí và hạn mức gói <strong>Takolio Plus</strong> luôn được đọc trực tiếp từ máy chủ thanh toán chính thức sau khi bạn đăng nhập — không hiển thị giá ước đoán hay khuyến mại giả định trên trang giới thiệu.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <TkvButton variant="primary" size="md" onClick={handleStartFree} isLoading={isStarting}>
              Dùng thử miễn phí
            </TkvButton>
            <Link
              to="/auth?mode=login&returnTo=%2Fplus&vnext=1"
              className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border)] text-sm font-bold text-[var(--tkv-ink)] inline-flex items-center"
            >
              Đăng nhập xem gói Plus
            </Link>
          </div>
        </TkvSurface>
      </section>
    </PublicMarketingShell>
  );
};
