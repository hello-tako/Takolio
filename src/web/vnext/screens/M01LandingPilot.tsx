import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOCALE_CATALOG } from '../../../shared/locales';
import { localizeErrorText, useLocaleText } from '../../i18n/app-i18n';
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
  type MascotPose,
  VERIFIED_VNEXT_RECIPE_MEDIA,
  VerifiedDishImage,
} from '../components/VNextMedia';

type LocalePicker = (vi: string, en: string) => string;

function buildHeroPillarCards(l: LocalePicker): ReadonlyArray<{
  icon: BrandFeatureIconKey;
  title: string;
  to: string;
}> {
  return [
    { icon: 'fridge', title: l('Quản lý tủ lạnh', 'Smart Fridge'), to: '/features/fridge' },
    { icon: 'recipes', title: l('Gợi ý món ăn', 'Meal Suggestions'), to: '/features/recipes' },
    { icon: 'planner', title: l('Lên thực đơn 7 ngày', '7-Day Meal Plan'), to: '/features/meal-planning' },
    { icon: 'shopping', title: l('Danh sách mua sắm', 'Shopping List'), to: '/features/shopping' },
    { icon: 'cooking', title: l('Nấu ăn từng bước', 'Guided Cooking'), to: '/features/cooking' },
  ];
}

function buildCoreFeatureCards(l: LocalePicker): ReadonlyArray<{
  icon: BrandFeatureIconKey;
  title: string;
  subtitle: string;
  description: string;
  exploreLabel: string;
  to: string;
}> {
  return [
    {
      icon: 'fridge',
      title: l('Tủ lạnh', 'Smart Fridge'),
      subtitle: l('Quản lý nguyên liệu', 'Ingredient Tracking'),
      description: l(
        'Theo dõi tồn kho theo từng lô, ngăn bảo quản và cảnh báo hạn dùng rõ ràng giữa hạn bao bì và hạn ước tính.',
        'Track stock by batch and storage zone with clear alerts distinguishing printed package dates from freshness estimates.',
      ),
      exploreLabel: l('Khám phá tủ lạnh', 'Explore Smart Fridge'),
      to: '/features/fridge',
    },
    {
      icon: 'scan',
      title: l('Quét nguyên liệu', 'AI Scan'),
      subtitle: l('Nhận diện bằng AI', 'AI Recognition'),
      description: l(
        'Chụp ngăn mát hoặc hóa đơn đi chợ để AI tạo bản nháp gợi ý. Bạn luôn kiểm duyệt trước khi lưu vào kho.',
        'Snap your fridge shelves or grocery receipt so AI creates a draft list. You always review before saving to inventory.',
      ),
      exploreLabel: l('Khám phá quét nguyên liệu', 'Explore AI Scan'),
      to: '/features/ai-scan',
    },
    {
      icon: 'recipes',
      title: l('Công thức', 'Recipes'),
      subtitle: l('Món ngon dễ làm', 'Verified Home Dishes'),
      description: l(
        'Kho món ăn gia đình Việt đối chiếu định lượng gram, ml, quả/cái và tự quy đổi khẩu phần 1–20 người.',
        'Verified family recipes matched by exact gram, ml, and unit quantities that automatically scale for 1–20 servings.',
      ),
      exploreLabel: l('Khám phá công thức', 'Explore Recipes'),
      to: '/features/recipes',
    },
    {
      icon: 'planner',
      title: l('Thực đơn', 'Meal Plan'),
      subtitle: l('Lên kế hoạch 7 ngày', '7-Day Planning'),
      description: l(
        'Xếp lịch bữa sáng, trưa, tối cân bằng dinh dưỡng cho cả gia đình và đổi món linh hoạt khi bận rộn.',
        'Schedule balanced breakfasts, lunches, and dinners for the whole household and swap dishes effortlessly on busy days.',
      ),
      exploreLabel: l('Khám phá thực đơn', 'Explore Meal Plan'),
      to: '/features/meal-planning',
    },
    {
      icon: 'shopping',
      title: l('Mua sắm', 'Shopping'),
      subtitle: l('Danh sách thông minh', 'Smart Net List'),
      description: l(
        'Tự động trừ phần nguyên liệu đang sẵn trong tủ lạnh để chỉ liệt kê đúng lượng cần mua thêm khi đi chợ.',
        'Automatically subtracts ingredients already in your fridge so your list only shows what you still need to buy.',
      ),
      exploreLabel: l('Khám phá mua sắm', 'Explore Shopping'),
      to: '/features/shopping',
    },
    {
      icon: 'cooking',
      title: l('Nấu ăn', 'Cooking'),
      subtitle: l('Hướng dẫn từng bước', 'Step-by-Step Guide'),
      description: l(
        'Chế độ nấu cỡ chữ lớn, hẹn giờ ngay tại bước cần canh lửa và chỉ trừ tồn kho sau khi xác nhận hoàn thành.',
        'Large-text cooking mode with built-in step timers and one-time stock deduction only after you confirm completion.',
      ),
      exploreLabel: l('Khám phá nấu ăn', 'Explore Cooking'),
      to: '/features/cooking',
    },
  ];
}

const MASCOT_EN_SHOWCASE_LABELS: Partial<Record<MascotPose, { title: string; subtitle: string }>> = {
  welcome: { title: 'Welcome', subtitle: 'Always by your side' },
  scanning: { title: 'AI Scan', subtitle: 'AI ingredient detection' },
  fridge: { title: 'Fridge Check', subtitle: 'Track expiry dates' },
  cooking: { title: 'Cooking', subtitle: 'Step-by-step guide' },
  shopping: { title: 'Shopping', subtitle: 'Smart shopping list' },
  achievement: { title: 'Done', subtitle: 'Eat well, zero waste' },
};

function buildShowcaseDishes(l: LocalePicker) {
  return [
    {
      slug: 'thit-kho-trung',
      title: l('Thịt kho trứng', 'Caramelized Pork Belly & Eggs'),
      summaryEn: 'Pork belly 400g · 4 eggs · Fish sauce · Fresh coconut water',
      time: l('30 phút', '30 min'),
      servings: l('4 người', '4 servings'),
      level: l('Dễ làm', 'Easy'),
    },
    {
      slug: 'canh-chua-ca-loc-nam-bo',
      title: l('Canh chua cá lóc Nam Bộ', 'Southern Vietnamese Tamarind Fish Soup'),
      summaryEn: 'Snakehead fish 400g · Tomato · Pineapple · Bean sprouts · Fresh herbs',
      time: l('25 phút', '25 min'),
      servings: l('4 người', '4 servings'),
      level: l('Dễ làm', 'Easy'),
    },
    {
      slug: 'ga-ta-kho-gung-sa',
      title: l('Gà ta kho gừng sả', 'Braised Chicken with Ginger & Lemongrass'),
      summaryEn: 'Chicken thighs 500g · Julienned ginger 40g · Fresh lemongrass · Fish sauce',
      time: l('25 phút', '25 min'),
      servings: l('4 người', '4 servings'),
      level: l('Đậm đà', 'Savory'),
    },
    {
      slug: 'rau-muong-xao-toi',
      title: l('Rau muống xào tỏi', 'Garlic Stir-Fried Water Spinach'),
      summaryEn: '1 bunch young water spinach · Crushed garlic · Fish sauce',
      time: l('10 phút', '10 min'),
      servings: l('3 người', '3 servings'),
      level: l('Nhanh gọn', 'Quick'),
    },
  ] as const;
}

export const M01LandingPilot: React.FC = () => {
  const navigate = useNavigate();
  const { l, locale } = useLocaleText();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const heroPillarCards = useMemo(() => buildHeroPillarCards(l), [l]);
  const coreFeatureCards = useMemo(() => buildCoreFeatureCards(l), [l]);
  const showcaseDishes = useMemo(() => buildShowcaseDishes(l), [l]);
  const platformJsonLd = useMemo(() => buildPlatformWebAppJsonLd(locale), [locale]);
  const satellite = isSatelliteComRuntime();

  useVNextSeo({
    title: l(
      'Takolio — Bữa ngon, nhẹ đầu. | Trợ lý bếp gia đình thông minh với AI',
      'Takolio — Good meals, light mind. | Smart AI Family Kitchen Assistant',
    ),
    description: l(
      'Ăn đủ. Mua đủ. Dùng hết. Quản lý tủ lạnh, quét nguyên liệu bằng AI, gợi ý món ngon chuẩn vị Việt, lên thực đơn 7 ngày và tạo danh sách mua sắm thông minh cùng Bé Mầm Bếp.',
      'Eat enough. Buy enough. Use it all. Manage your fridge, scan ingredients with AI, discover portion-matched family recipes, plan 7-day menus, and build smart net shopping lists with Chef Sprout.',
    ),
    canonicalPath: '/',
    domainSurface: 'marketing',
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
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
      const fallbackMsg = l(
        'Không thể khởi tạo phiên dùng thử ngay lúc này. Bạn có thể đăng ký tài khoản hoặc thử lại.',
        'Unable to start a free trial session right now. You can create an account or try again.',
      );
      setGuestError(localizeErrorText(err, fallbackMsg, fallbackMsg, locale));
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
                <span>{l('Trợ lý bếp gia đình thông minh với AI', 'Smart AI Family Kitchen Assistant')}</span>
              </div>

              <h1 id="m01-hero-heading" className="tkv-display tracking-tight">
                <span className="text-[var(--tkv-primary)]">{l('Bữa ngon, ', 'Good meals, ')}</span>
                <span className="text-[var(--tkv-coral)]">{l('nhẹ đầu.', 'light mind.')}</span>
              </h1>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-1.5 text-sm sm:text-base font-extrabold text-[var(--tkv-primary)]">
                  {l('Ăn đủ. Mua đủ. Dùng hết.', 'Eat enough. Buy enough. Use it all.')}
                </span>
              </div>

              <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed max-w-xl">
                {l('Đồng hành cùng ', 'Cook alongside ')}
                <strong>{l('Bé Mầm Bếp', 'Chef Sprout')}</strong>
                {l(
                  ' quản lý nguyên liệu trong tủ lạnh, quét thực phẩm bằng AI, gợi ý mâm cơm gia đình khớp định lượng và lên thực đơn 7 ngày thật thảnh thơi.',
                  ' to track fridge ingredients, scan groceries with AI, get portion-matched family meal ideas, and plan 7 effortless days of meals.',
                )}
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
                  {l('Bắt đầu miễn phí ngay', 'Start free right now')}
                </TkvButton>
                <Link
                  to="/how-it-works"
                  className="tkv-focusable min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface-coral)] hover:opacity-95 border border-[var(--tkv-border-coral)] text-[var(--tkv-ink)] font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>{l('Xem cách hoạt động', 'See how it works')}</span>
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
                {heroPillarCards.map((card) => (
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
                  alt={l(
                    'Bé Mầm Bếp cầm muỗng gỗ giơ ngón cái bên thố thịt kho trứng, tô canh chua cá và chén cơm trắng nóng hổi',
                    'Chef Sprout holding a wooden spoon giving a thumbs up beside braised pork and eggs, tamarind fish soup, and warm steamed rice',
                  )}
                  loading="eager"
                  className="w-full aspect-[16/10] object-cover"
                />
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 max-w-[calc(100%-24px)] rounded-full bg-[var(--tkv-primary)] text-white px-3.5 sm:px-4 py-1.5 shadow-[var(--tkv-shadow-float)] border border-white/30 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-saffron)] shrink-0" aria-hidden="true" />
                  <span className="tkv-heading text-xs sm:text-sm font-extrabold truncate">
                    {l('Bé Mầm Bếp · Mascot Takolio', 'Chef Sprout · Takolio Mascot')}
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
                {l('Bộ tính năng cốt lõi', 'Core Features')}
              </span>
              <h2 id="m01-features-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {l('Khép kín vòng lặp căn bếp gia đình', 'Close the loop on every home kitchen')}
              </h2>
            </div>
            <Link
              to="/how-it-works"
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>{l('Xem chi tiết quy trình', 'See full workflow')}</span>
              <VNextIcon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {coreFeatureCards.map((feat) => (
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
                  <span>{feat.exploreLabel}</span>
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
                {l('Bé Mầm Bếp — Hành động & biểu cảm', 'Chef Sprout — Actions & Expressions')}
              </span>
              <h2 id="m01-mascot-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {l('Người bạn nhỏ ấm áp trong mọi khoảnh khắc vào bếp', 'A warm little companion for every moment in the kitchen')}
              </h2>
            </div>
            <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] max-w-md">
              {l(
                'Nồi sứ trắng đội mũ đầu bếp nảy mầm xanh, quàng khăn cam đỏ — luôn nhắc hạn dùng khéo léo và cổ vũ cả nhà ăn ngon.',
                'A cheerful white ceramic pot in a chef hat with a fresh green sprout and coral scarf — gently watching expiry dates and cheering on every home-cooked meal.',
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {BEMAM_MASCOT_SHOWCASE.map((item) => {
              const enLabel = MASCOT_EN_SHOWCASE_LABELS[item.pose];
              return (
                <div
                  key={item.pose}
                  className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-3 sm:p-3.5 flex flex-col items-center text-center gap-2 min-w-0"
                >
                  <MascotIllustration pose={item.pose} size={116} className="w-20 h-20 sm:w-28 sm:h-28 max-w-full" />
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                      {l(item.title, enLabel?.title ?? item.pose)}
                    </h3>
                    <p className="text-xs font-medium text-[var(--tkv-ink-muted)]">
                      ({l(item.subtitle, enLabel?.subtitle ?? '')})
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* GỢI Ý MÓN NGON HÔM NAY (`Hôm nay ăn gì?` Dish Preview) */}
        <section aria-labelledby="m01-dishes-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-coral-ink)]">
                {l('Hôm nay ăn gì?', 'What to cook today?')}
              </span>
              <h2 id="m01-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {l('Mâm cơm gia đình Việt từ nguyên liệu sẵn có', 'Home-cooked family meals from ingredients you already have')}
              </h2>
            </div>
            <Link
              to="/features/recipes"
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>{l('Xem kho món ăn', 'Browse recipes')}</span>
              <VNextIcon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {showcaseDishes.map((dish) => {
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
                        {l(media?.verifiedIngredientsSummary ?? '', dish.summaryEn)}
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
              <span>{l('Minh bạch chi phí · Bắt đầu miễn phí', 'Transparent pricing · Start free')}</span>
            </span>
            <h2 id="m01-pricing-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
              {l(
                'Dùng miễn phí trọn bộ quản lý tủ lạnh, công thức & danh sách mua sắm',
                'Use core fridge tracking, recipes & shopping lists completely free',
              )}
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              {l('Nâng cấp ', 'Upgrade to ')}
              <strong>Takolio Pro</strong>
              {l(
                ' khi gia đình bạn cần mở rộng lượt quét AI mỗi tháng và lập thực đơn 7 ngày tự động không giới hạn.',
                ' whenever your household needs expanded monthly AI scans and unlimited automated 7-day meal planning.',
              )}
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
              {l('Tạo tài khoản miễn phí', 'Create free account')}
            </TkvButton>
            <Link
              to="/pricing"
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center justify-center transition-colors"
            >
              {l('Xem bảng giá chi tiết', 'View detailed pricing')}
            </Link>
          </div>
        </section>

        {/* HOẠ TIẾT ĐỒI XANH & ĐẠO CỤ BẾP (`board.jpg` Decorative Strip) */}
        <CulinaryHillsBanner />
      </div>
    </PublicMarketingShell>
  );
};
