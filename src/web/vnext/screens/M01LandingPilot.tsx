import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { vnextHref } from '../feature';
import { trackPublicConversion, useVNextSeo } from '../lib/seo';
import { PublicMarketingShell } from '../components/Shells';
import { TkvButton, TkvSurface } from '../components/Primitives';
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
      {/* Hero Section — Sumi Edition Editorial Monochrome */}
      <section aria-labelledby="m01-hero-heading" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[var(--sumi-border,#E4E4E0)] text-xs font-bold text-[var(--sumi-ink,#111315)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
              <span>Trợ lý bếp thông minh cho gia đình hiện đại</span>
            </span>

            <h1
              id="m01-hero-heading"
              className="tkv-heading text-[2rem] sm:text-[2.75rem] lg:text-[3.1rem] font-extrabold text-[var(--sumi-ink,#111315)] tracking-tight leading-[1.14]"
            >
              Hôm nay ăn gì?
              <span className="block text-[var(--sumi-muted,#5C5F62)] mt-1">Để Takolio giúp bạn.</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--sumi-muted,#5C5F62)] max-w-xl leading-relaxed">
              Quản lý thực phẩm, chọn món ngon từ nguyên liệu sẵn có, lên thực đơn tuần và đi chợ thông minh — giữ trọn dữ liệu riêng tư cho từng hộ gia đình.
            </p>

            {guestError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-white border border-[var(--sumi-border-strong,#CFCFC9)] text-sm font-semibold text-[var(--sumi-ink,#111315)] flex items-center gap-2.5"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--sumi-dot,#C84B31)] shrink-0" aria-hidden="true" />
                <span>{guestError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isStarting}
                onClick={() => void handleStartFree()}
                data-testid="m01-start-free-cta"
                className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--sumi-ink,#111315)] hover:bg-[var(--sumi-ink-hover,#23262A)] text-white font-bold text-base inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <span>{isStarting ? 'Đang mở căn bếp…' : 'Bắt đầu miễn phí'}</span>
                <VNextIcon name="arrow-right" size={18} />
              </button>
              <Link
                to="/how-it-works"
                className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--sumi-border-strong,#CFCFC9)] text-[var(--sumi-ink,#111315)] font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[var(--sumi-canvas,#F7F7F5)] transition-colors"
              >
                <span>Khám phá cách hoạt động</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--sumi-muted,#5C5F62)]">
              <Link
                to={vnextHref('/auth?mode=register')}
                className="tkv-focusable font-bold text-[var(--sumi-ink,#111315)] underline"
              >
                Tạo tài khoản đồng bộ
              </Link>
              <span aria-hidden="true">·</span>
              <span>
                Đã có tài khoản?{' '}
                <Link to={vnextHref('/auth?mode=login')} className="font-bold text-[var(--sumi-ink,#111315)] underline">
                  Đăng nhập
                </Link>
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[24px] bg-white p-3 sm:p-4 border border-[var(--sumi-border,#E4E4E0)] shadow-xs">
              <div className="relative overflow-hidden rounded-[18px] aspect-[16/10] bg-[var(--sumi-canvas,#F7F7F5)]">
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
                  <MascotIllustration pose="welcome" size={40} decorative className="border border-[var(--sumi-border,#E4E4E0)]" />
                  <div>
                    <p className="text-xs font-extrabold text-[var(--sumi-ink,#111315)]">
                      Vòng lặp bếp khép kín
                    </p>
                    <p className="text-xs text-[var(--sumi-muted,#5C5F62)]">
                      Tủ lạnh → Món ăn → Thực đơn → Đi chợ → Đứng bếp
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--sumi-canvas,#F7F7F5)] border border-[var(--sumi-border,#E4E4E0)] text-[11px] font-bold text-[var(--sumi-ink,#111315)]">
                  <VNextIcon name="shield" size={13} />
                  <span>Tách biệt theo hộ gia đình</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Capability Architectural Strip */}
        <div id="tkv-features" className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FEATURE_PILLS.map((pill) => (
            <div
              key={pill.label}
              className="rounded-2xl bg-white border border-[var(--sumi-border,#E4E4E0)] px-3.5 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-[var(--sumi-canvas,#F7F7F5)] border border-[var(--sumi-border,#E4E4E0)] text-[var(--sumi-ink,#111315)] flex items-center justify-center shrink-0">
                <VNextIcon name={pill.icon} size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold text-[var(--sumi-muted,#5C5F62)] tabular-nums">
                  {pill.code}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[var(--sumi-ink,#111315)] leading-snug">
                  {pill.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* M02 Preview Section — 3-Step Closed-Loop Kitchen Workflow */}
      <section
        id="tkv-how-it-works"
        aria-labelledby="m01-workflow-heading"
        className="border-y border-[var(--sumi-border,#E4E4E0)] bg-white py-12 sm:py-16 px-4 sm:px-6"
      >
        <div className="max-w-[1200px] mx-auto space-y-7">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--sumi-muted,#5C5F62)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
              <span>Cách Takolio hoạt động</span>
            </span>
            <h2 id="m01-workflow-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--sumi-ink,#111315)]">
              Từ nguyên liệu trong tủ đến bữa cơm trọn vẹn chỉ với 3 bước
            </h2>
            <p className="text-sm sm:text-base text-[var(--sumi-muted,#5C5F62)]">
              AI hỗ trợ nhận diện nhanh — quyền kiểm duyệt và xác nhận cuối cùng luôn thuộc về bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-[20px] bg-[var(--sumi-canvas,#F7F7F5)] border border-[var(--sumi-border,#E4E4E0)] p-5 sm:p-6 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono tabular-nums text-xs font-extrabold px-2.5 py-1 rounded-full bg-white border border-[var(--sumi-border,#E4E4E0)] text-[var(--sumi-ink,#111315)]">
                      Bước {item.step}
                    </span>
                    <span className="w-10 h-10 rounded-xl bg-[var(--sumi-ink,#111315)] text-white flex items-center justify-center">
                      <VNextIcon name={item.icon} size={18} />
                    </span>
                  </div>
                  <h3 className="tkv-heading text-lg font-extrabold text-[var(--sumi-ink,#111315)]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--sumi-muted,#5C5F62)] leading-relaxed">
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
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--sumi-muted,#5C5F62)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
              <span>Kho công thức Việt chuẩn định lượng</span>
            </span>
            <h2 id="m01-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--sumi-ink,#111315)]">
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
            <TkvSurface key={dish.slug} padded={false} className="overflow-hidden flex flex-col bg-white border-[var(--sumi-border,#E4E4E0)]">
              <VerifiedDishImage slug={dish.slug} title={dish.title} />
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="tkv-heading text-base font-extrabold text-[var(--sumi-ink,#111315)] line-clamp-2">
                    {dish.title}
                  </h3>
                  <p className="text-xs text-[var(--sumi-muted,#5C5F62)]">
                    {VERIFIED_VNEXT_RECIPE_MEDIA[dish.slug]?.verifiedIngredientsSummary}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-mono tabular-nums font-bold text-[var(--sumi-ink,#111315)] pt-2 border-t border-[var(--sumi-border,#E4E4E0)]">
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

      {/* M09 Transparent Pro Notice */}
      <section id="tkv-plus" aria-labelledby="m01-plus-heading" className="max-w-[1200px] mx-auto pb-14 px-4 sm:px-6">
        <div className="rounded-[24px] bg-[var(--sumi-ink,#111315)] text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-xs font-bold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
              <span>Các gói sử dụng Takolio</span>
            </span>
            <h2 id="m01-plus-heading" className="tkv-heading text-xl sm:text-2xl font-extrabold text-white">
              Bắt đầu miễn phí với tủ lạnh, kho công thức và thực đơn cơ bản
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Mức phí và hạn mức gói <strong>Takolio Pro</strong> luôn được đọc trực tiếp từ máy chủ thanh toán chính thức — minh bạch biểu phí VND và không hiển thị giá ước đoán giả định.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              disabled={isStarting}
              onClick={() => void handleStartFree()}
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white text-[var(--sumi-ink,#111315)] text-sm font-extrabold inline-flex items-center hover:bg-[var(--sumi-canvas,#F7F7F5)] transition-colors"
            >
              {isStarting ? 'Đang mở…' : 'Dùng thử miễn phí'}
            </button>
            <Link
              to="/pricing"
              className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] border border-white/25 text-sm font-bold text-white inline-flex items-center hover:bg-white/10 transition-colors"
            >
              Xem biểu phí Pro
            </Link>
          </div>
        </div>
      </section>
    </PublicMarketingShell>
  );
};
