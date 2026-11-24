import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { LOCALE_CATALOG } from '../../../shared/locales';
import { useLocaleText } from '../../i18n/app-i18n';
import { useAuthStore } from '../../stores/useAuthStore';
import { vnextHref } from '../feature';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildPricingJsonLd,
  buildStoriesBlogJsonLd,
  trackPublicConversion,
  useVNextSeo,
} from '../lib/seo';
import {
  isSatelliteComRuntime,
  navigateToAppSurface,
  resolveAppSurfaceHref,
} from '../lib/domain-surface';
import { PublicMarketingShell } from '../components/Shells';
import { TkvSurface } from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import {
  buildRegionalPriceReferences,
  DEFAULT_VND_PRICES,
  formatGlobalMinorCurrency,
  marketCodeForCurrency,
  type GlobalDisplayCurrency,
  type RegionalPriceReference,
} from '../../../shared/global-pricing';
import {
  CulinaryHillsBanner,
  MascotIllustration,
  VerifiedDishImage,
} from '../components/VNextMedia';

type LocalePicker = (vi: string, en: string) => string;

function buildFeatureSubnav(l: LocalePicker): Array<{ id: string; label: string; to: string }> {
  return [
    { id: 'M02', label: l('Cách hoạt động', 'How It Works'), to: '/how-it-works' },
    { id: 'M03', label: 'AI Scan', to: '/features/ai-scan' },
    { id: 'M04', label: l('Tủ lạnh', 'Smart Fridge'), to: '/features/fridge' },
    { id: 'M05', label: l('Thực đơn tuần', 'Weekly Meal Plan'), to: '/features/meal-planning' },
    { id: 'M06', label: l('Kho công thức', 'Recipes'), to: '/features/recipes' },
    { id: 'M07', label: l('Nấu từng bước', 'Guided Cooking'), to: '/features/cooking' },
    { id: 'M08', label: l('Đi chợ', 'Shopping List'), to: '/features/shopping' },
  ];
}

const FeatureSubnavBar: React.FC<{ activeId: string }> = ({ activeId }) => {
  const { l } = useLocaleText();
  const subnavItems = useMemo(() => buildFeatureSubnav(l), [l]);

  return (
    <nav
      aria-label={l('Điều hướng chi tiết tính năng', 'Feature details navigation')}
      className="max-w-[1200px] mx-auto pt-4 overflow-x-auto no-scrollbar"
    >
      <ul className="inline-flex items-center gap-2 px-4 sm:px-6 pb-1">
        {subnavItems.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'tkv-focusable min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center whitespace-nowrap border transition-colors',
                  active
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

interface FeatureStorySpec {
  screenId: 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08';
  canonicalPath: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: string;
  imageSrc640: string;
  imageAlt: string;
  truthBadge: string;
  truthNote: string;
  bullets: Array<{ icon: VNextIconName; title: string; detail: string }>;
  deepDiveTitle: string;
  deepDiveSteps: Array<{ code: string; heading: string; body: string }>;
}

function buildFeatureStories(l: LocalePicker): Record<FeatureStorySpec['screenId'], FeatureStorySpec> {
  return {
    M02: {
      screenId: 'M02',
      canonicalPath: '/how-it-works',
      eyebrow: l('Vòng lặp căn bếp khép kín', 'Closed-loop kitchen workflow'),
      title: l('Takolio hoạt động thế nào', 'How Takolio Works'),
      subtitle: l(
        'Từ những gì có sẵn trong tủ đến bữa ăn hoàn chỉnh.',
        'From what is already in your fridge to a complete home-cooked meal.',
      ),
      ctaLabel: l('Khám phá Takolio', 'Explore Takolio'),
      ctaHref: '/auth?mode=register',
      imageSrc: '/takolio/vnext/marketing/m02-closed-loop-kitchen.webp',
      imageSrc640: '/takolio/vnext/marketing/m02-closed-loop-kitchen-640w.webp',
      imageAlt: l(
        'Bàn bếp sáng thoáng với nguyên liệu sơ chế gốm sứ chuẩn bị cho vòng lặp nấu ăn khép kín',
        'Bright kitchen counter with ceramic bowls of prepped ingredients ready for closed-loop cooking',
      ),
      truthBadge: l('Kiểm soát thủ công ở mọi điểm ghi kho', 'Manual approval at every inventory write'),
      truthNote: l(
        'Không tự động trừ kho hay lưu kết quả AI khi chưa có xác nhận trực tiếp từ bạn.',
        'Never deducts stock or saves AI scan results without your direct confirmation.',
      ),
      bullets: [
        {
          icon: 'fridge',
          title: l('Kiểm tra tủ lạnh', 'Check your fridge'),
          detail: l(
            'Ghi nhận lô nguyên liệu theo ngăn bảo quản, số lượng, đơn vị đo và nhãn hạn dùng rõ ràng.',
            'Track ingredient batches by storage zone, quantity, unit, and clear expiry labels.',
          ),
        },
        {
          icon: 'calendar',
          title: l('Lên thực đơn', 'Plan your meals'),
          detail: l(
            'Chọn món hoặc tạo lịch 7 ngày dựa trên định lượng thực tế và khẩu phần hộ gia đình.',
            'Choose dishes or build a 7-day schedule grounded in real quantities and household servings.',
          ),
        },
        {
          icon: 'shopping',
          title: l('Đi chợ đúng nhu cầu', 'Shop only what you need'),
          detail: l(
            'Tự tính phần còn thiếu sau khi đối chiếu tồn kho để tránh mua trùng hoặc bỏ quên.',
            'Automatically calculates shortfalls against on-hand stock to prevent duplicates and forgotten items.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Bốn mắt xích liên kết chặt chẽ trong căn bếp',
        'Four tightly connected links in your kitchen',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Nhập kho minh bạch (C03 · C12)', 'Transparent stock entry (C03 · C12)'),
          body: l(
            'Thêm tay hoặc chụp ảnh tủ lạnh/hóa đơn — mọi dòng nhận diện đều đi qua màn hình duyệt trước khi cập nhật.',
            'Add manually or snap your fridge or receipt — every recognized item goes through a review screen before saving.',
          ),
        },
        {
          code: '02',
          heading: l('Đối chiếu công thức theo đơn vị (C18 · C19)', 'Unit-accurate recipe matching (C18 · C19)'),
          body: l(
            'Hệ thống so sánh gram, ml, quả/cái thay vì chỉ khớp tên, báo rõ trường hợp lệch đơn vị đo.',
            'Compares grams, milliliters, and piece counts rather than just names, flagging any unit mismatch clearly.',
          ),
        },
        {
          code: '03',
          heading: l('Lập lịch tuần & đi chợ ròng (C23 · C27 · C29)', 'Weekly planning & net shopping (C23 · C27 · C29)'),
          body: l(
            'Tổng hợp nhu cầu cả tuần, hỗ trợ đánh dấu ngoại tuyến và nhập kho sau đi chợ không nhân đôi.',
            'Aggregates weekly demand, supports offline check-off, and restocks purchases back into your fridge without duplicates.',
          ),
        },
        {
          code: '04',
          heading: l('Đứng bếp & xác nhận tiêu thụ (C21 · C22)', 'Guided cooking & confirmed usage (C21 · C22)'),
          body: l(
            'Hướng dẫn từng bước kèm bộ đếm giờ; chỉ trừ tồn kho đúng một lần khi bạn bấm hoàn tất bữa ăn.',
            'Step-by-step instructions with built-in timers; deducts inventory exactly once when you confirm meal completion.',
          ),
        },
      ],
    },
    M03: {
      screenId: 'M03',
      canonicalPath: '/features/ai-scan',
      eyebrow: l('Nhận diện có kiểm duyệt', 'Human-reviewed recognition'),
      title: l('AI Scan nguyên liệu', 'AI Ingredient Scan'),
      subtitle: l(
        'Chụp ảnh rồi kiểm tra từng nguyên liệu trước khi lưu.',
        'Snap a photo and review every detected ingredient before saving.',
      ),
      ctaLabel: l('Thử quét nguyên liệu', 'Try AI ingredient scan'),
      ctaHref: '/auth?mode=login&returnTo=%2Fscan',
      imageSrc: '/takolio/vnext/marketing/m03-fresh-produce-scan.webp',
      imageSrc640: '/takolio/vnext/marketing/m03-fresh-produce-scan-640w.webp',
      imageAlt: l(
        'Rau củ trứng tươi đặt trên mặt bàn bếp chuẩn bị quét nhận diện nguyên liệu',
        'Fresh vegetables and eggs laid out on a kitchen counter ready for AI ingredient scanning',
      ),
      truthBadge: l('Review-before-save bắt buộc', 'Mandatory review-before-save'),
      truthNote: l(
        'AI có thể nhầm nhãn hoặc định lượng; Takolio không bao giờ tự ghi thẳng vào tủ lạnh khi bạn chưa duyệt.',
        'AI can misread labels or quantities; Takolio never writes directly to your fridge without your approval.',
      ),
      bullets: [
        {
          icon: 'scan',
          title: l('Chụp ảnh thực phẩm', 'Capture food or receipts'),
          detail: l(
            'Hỗ trợ mở camera trực tiếp hoặc chọn ảnh từ máy, kèm chế độ nhập tay ngay khi từ chối quyền camera.',
            'Open your camera directly or choose a photo from your device, with instant manual entry if camera access is declined.',
          ),
        },
        {
          icon: 'sparkles',
          title: l('AI gợi ý nhận diện', 'AI draft detection'),
          detail: l(
            'Hiển thị tiến trình xử lý, mức độ tin cậy từng dòng và cảnh báo rõ các mục cần kiểm tra kỹ.',
            'Shows live processing progress, per-line confidence levels, and clear flags for items that need a closer look.',
          ),
        },
        {
          icon: 'check',
          title: l('Bạn xác nhận kết quả', 'You confirm every item'),
          detail: l(
            'Chỉnh sửa tên, số lượng, đơn vị, ngăn bảo quản hoặc bỏ qua dòng sai trước khi xác nhận nhập kho.',
            'Edit names, quantities, units, and storage zones — or skip wrong rows — before committing to inventory.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Nguyên tắc an toàn ảnh chụp & hóa đơn (C09–C14)',
        'Photo & receipt safety principles (C09–C14)',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Ảnh riêng tư theo phiên hộ gia đình', 'Private photos per household session'),
          body: l(
            'Ảnh quét chỉ gắn với hộ gia đình của bạn, không chia sẻ chéo giữa các tài khoản hay bộ nhớ đệm.',
            'Scanned photos belong strictly to your household and are never shared across accounts or browser caches.',
          ),
        },
        {
          code: '02',
          heading: l('Giữ nguyên bằng chứng OCR gốc trên hóa đơn', 'Preserves original receipt OCR lines'),
          body: l(
            'Khi duyệt hóa đơn siêu thị (C14), hệ thống giữ đối chiếu dòng OCR gốc và không tự bịa giá tiền thiếu.',
            'When reviewing supermarket receipts (C14), Takolio keeps the original OCR text alongside each item and never fabricates missing prices.',
          ),
        },
        {
          code: '03',
          heading: l('Chống gửi trùng khi mạng chập chờn', 'Duplicate protection on flaky networks'),
          body: l(
            'Khóa xác nhận idempotent đảm bảo bấm lại khi mạng chậm không tạo hai lô nguyên liệu trùng nhau.',
            'Idempotent confirmation keys ensure retrying on a slow connection never creates duplicate inventory batches.',
          ),
        },
      ],
    },
    M04: {
      screenId: 'M04',
      canonicalPath: '/features/fridge',
      eyebrow: l('Quản lý tồn kho theo lô', 'Batch-level inventory tracking'),
      title: l('Tủ lạnh thông minh', 'Smart Fridge'),
      subtitle: l(
        'Biết nhà còn gì, sắp hết hạn gì và cần dùng gì trước.',
        'Know what you have, what expires soon, and what to cook first.',
      ),
      ctaLabel: l('Mở tủ lạnh thông minh', 'Open Smart Fridge'),
      ctaHref: '/auth?mode=login&returnTo=%2Ffridge',
      imageSrc: '/takolio/vnext/marketing/m04-smart-fridge.webp',
      imageSrc640: '/takolio/vnext/marketing/m04-smart-fridge-640w.webp',
      imageAlt: l(
        'Ngăn tủ lạnh gia đình sắp xếp gọn nguyên liệu rau củ trứng đậu phụ trong hộp thủy tinh',
        'Organized family fridge shelves with fresh produce, eggs, and tofu in clear glass containers',
      ),
      truthBadge: l('Phân biệt hạn in trên bao bì & hạn ước tính', 'Separates printed expiry from estimates'),
      truthNote: l(
        'Các mốc +3/+5/+7 ngày luôn được gắn nhãn “Ước tính” để bạn chủ động kiểm tra cảm quan thực phẩm.',
        'Default +3/+5/+7 day dates are always labeled "Estimated" so you can check food freshness with your own senses.',
      ),
      bullets: [
        {
          icon: 'fridge',
          title: l('Phân loại nguyên liệu', 'Organized by zone & group'),
          detail: l(
            'Quản lý rõ ngăn mát, ngăn đông và tủ khô cùng bộ lọc nhóm thực phẩm đồng bộ qua địa chỉ trang.',
            'Separates fridge, freezer, and pantry stock with URL-synced food category filters.',
          ),
        },
        {
          icon: 'timer',
          title: l('Theo dõi hạn dùng', 'Expiry priority (FEFO)'),
          detail: l(
            'Ưu tiên nguyên liệu nên dùng sớm (FEFO) để giảm lãng phí bữa ăn hằng ngày.',
            'Prioritizes ingredients that expire first (FEFO) to cut everyday kitchen food waste.',
          ),
        },
        {
          icon: 'refresh',
          title: l('Cập nhật lượng thực tế', 'Accurate multi-device updates'),
          detail: l(
            'Kiểm soát phiên bản dữ liệu (If-Match) giúp hai thiết bị trong nhà không ghi đè nhầm số lượng của nhau.',
            'Optimistic concurrency (If-Match) prevents two devices in the same household from accidentally overwriting quantities.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Trạng thái trung thực cho từng lô thực phẩm (C03–C08)',
        'Honest status for every food batch (C03–C08)',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Tách biệt tủ trống và bộ lọc không khớp', 'Distinguishes empty fridge from zero filter matches'),
          body: l(
            'Khi tìm kiếm không có kết quả, ứng dụng đề xuất xóa bộ lọc thay vì báo nhầm tủ lạnh đang trống.',
            'When a search returns no items, Takolio offers to clear filters instead of falsely claiming your fridge is empty.',
          ),
        },
        {
          code: '02',
          heading: l('Ghi nhận thời điểm mở nắp & nguồn nhập', 'Tracks opened date & entry source'),
          body: l(
            'Chi tiết lô nguyên liệu (C06) hiển thị rõ nguồn thêm tay, quét tủ hay nhập từ hóa đơn.',
            'Batch details (C06) clearly display whether an item was added manually, scanned from the fridge, or imported from a receipt.',
          ),
        },
        {
          code: '03',
          heading: l('Đối soát tồn kho định kỳ (C08)', 'Periodic stock reconciliation (C08)'),
          body: l(
            'Rà soát nhanh các lô lâu chưa cập nhật để tồn kho luôn sát với căn bếp thật.',
            'Quickly audit older batches so your digital inventory stays aligned with your real kitchen.',
          ),
        },
      ],
    },
    M05: {
      screenId: 'M05',
      canonicalPath: '/features/meal-planning',
      eyebrow: l('Chủ động bữa cơm cả tuần', 'Proactive weekly meal prep'),
      title: l('Lên thực đơn tuần', 'Weekly Meal Planning'),
      subtitle: l(
        'Chủ động kế hoạch bữa ăn, khẩu phần và phần còn thiếu.',
        'Plan meals, serving sizes, and missing groceries ahead of time.',
      ),
      ctaLabel: l('Lập thực đơn tuần', 'Build weekly meal plan'),
      ctaHref: '/auth?mode=login&returnTo=%2Fplanner',
      imageSrc: '/takolio/vnext/marketing/m05-meal-planning-prep.webp',
      imageSrc640: '/takolio/vnext/marketing/m05-meal-planning-prep-640w.webp',
      imageAlt: l(
        'Bàn gỗ sơ chế nguyên liệu theo khẩu phần tuần cho gia đình Việt',
        'Wooden kitchen counter with prepped weekly ingredients portioned for family meals',
      ),
      truthBadge: l('Tính toán định lượng tất định trên máy chủ', 'Deterministic server-side quantity math'),
      truthNote: l(
        'Định lượng nguyên liệu và danh sách mua ròng được tính bằng công thức toán học chính xác, không dùng AI suy đoán.',
        'Ingredient amounts and net shopping shortfalls are calculated with exact deterministic math — never AI guesswork.',
      ),
      bullets: [
        {
          icon: 'calendar',
          title: l('Lịch ăn 7 ngày', '7-day meal schedule'),
          detail: l(
            'Xem trọn lịch bữa sáng, trưa, tối trên bảng làm việc máy tính hoặc thẻ ngày gọn gàng trên điện thoại.',
            'View breakfast, lunch, and dinner in a full desktop week grid or streamlined daily cards on mobile.',
          ),
        },
        {
          icon: 'swap',
          title: l('Đổi món dễ dàng', 'Effortless meal swaps'),
          detail: l(
            'Xem trước thay đổi nguyên liệu trước khi áp dụng đổi món vào lịch tuần hiện tại.',
            'Preview exact ingredient changes before confirming a meal swap in your active weekly schedule.',
          ),
        },
        {
          icon: 'shopping',
          title: l('Tính nguyên liệu cần mua', 'Automatic shortfall calculation'),
          detail: l(
            'Tự động gom nhu cầu nguyên liệu cả tuần và trừ đi lượng đang có trong tủ lạnh.',
            'Totals ingredient needs across the full week and subtracts what is already in your fridge.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Thiết kế cho nhịp sinh hoạt thật của gia đình (C23–C26)',
        'Built for real household routines (C23–C26)',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Tùy chỉnh ngày nấu và thời gian tối đa', 'Customize cooking days & max prep time'),
          body: l(
            'Chọn đúng những bữa gia đình thực sự nấu tại nhà và giới hạn số phút đứng bếp ngày thường.',
            'Pick only the meals you actually cook at home and cap weeknight cooking minutes.',
          ),
        },
        {
          code: '02',
          heading: l('Lưu trữ gắn với tài khoản hộ gia đình', 'Synced to your household account'),
          body: l(
            'Thực đơn tuần được đồng bộ theo phiên bản (revision) để luôn nhất quán khi mở lại trên thiết bị khác.',
            'Weekly plans sync with revision tracking so schedules stay consistent across every family device.',
          ),
        },
        {
          code: '03',
          heading: l('Tương thích mượt với luồng đi chợ tuần', 'Seamless handoff to weekly shopping'),
          body: l(
            'Chuyển thẳng từ lịch tuần sang danh sách mua sắm ròng chỉ bằng một thao tác.',
            'Generate a net grocery list straight from your weekly plan in a single tap.',
          ),
        },
      ],
    },
    M06: {
      screenId: 'M06',
      canonicalPath: '/features/recipes',
      eyebrow: l('Ẩm thực gia đình gần gũi', 'Everyday family cooking'),
      title: l('Kho công thức', 'Recipe Library'),
      subtitle: l(
        'Tìm món theo nguyên liệu sẵn có và thời gian nấu.',
        'Find dishes matched to your on-hand ingredients and available cook time.',
      ),
      ctaLabel: l('Khám phá kho món ăn', 'Explore recipe library'),
      ctaHref: '/auth?mode=login&returnTo=%2Frecipes',
      imageSrc: '/takolio/vnext/marketing/m06-vietnamese-recipes.webp',
      imageSrc640: '/takolio/vnext/marketing/m06-vietnamese-recipes-640w.webp',
      imageAlt: l(
        'Mâm cơm gia đình Việt với thịt kho trứng nước dừa, canh chua và rau xanh trên bát đĩa gốm sứ',
        'Family dinner spread with braised pork and eggs, tamarind soup, and sautéed greens in ceramic bowls',
      ),
      truthBadge: l('Ảnh món ăn khớp đúng công thức xác minh', 'Verified dish photos matched to recipes'),
      truthNote: l(
        'Mỗi ảnh món ăn đều khớp nguyên liệu của đúng công thức đó; món chưa có ảnh xác minh sẽ hiển thị biểu tượng trung thực.',
        'Every featured photo matches the exact ingredients of that recipe; dishes without verified photos show an honest placeholder.',
      ),
      bullets: [
        {
          icon: 'recipes',
          title: l('Món ăn gia đình', 'Home-cooked favorites'),
          detail: l(
            'Tuyển chọn các món kho, canh, xào, bún phở quen thuộc với định lượng rõ ràng cho bữa cơm Việt.',
            'Curated everyday braises, soups, stir-fries, and noodle bowls across global home cuisines with clear portions.',
          ),
        },
        {
          icon: 'check',
          title: l('Công thức nhiều bước', 'Clear multi-step instructions'),
          detail: l(
            'Trình bày mạch lạc từng bước sơ chế, ướp và nấu kèm thời gian dự kiến cụ thể.',
            'Structured step-by-step prep, marinating, and cooking stages with realistic timing.',
          ),
        },
        {
          icon: 'filter',
          title: l('Bộ lọc theo sở thích', 'Flexible kitchen filters'),
          detail: l(
            'Lọc theo nhóm món, vùng miền, thời gian nấu tối đa hoặc ưu tiên món nấu ngay không cần mua thêm.',
            'Filter by cuisine, dish category, max cook time, or prioritize dishes you can cook right now with zero extra shopping.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Món ngon gia đình tiêu biểu trong kho công thức',
        'Smart tools built into every recipe',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Thay đổi khẩu phần linh hoạt (1–20 người)', 'Flexible serving scaling (1–20 people)'),
          body: l(
            'Tăng giảm số người ăn trên trang chi tiết món (C18) để hệ thống nhân chia lại toàn bộ nguyên liệu tức thì.',
            'Adjust household servings on any recipe page (C18) to recalculate every ingredient quantity instantly.',
          ),
        },
        {
          code: '02',
          heading: l('Bổ sung phần thiếu vào giỏ đi chợ', 'Send only missing items to shopping'),
          body: l(
            'Chỉ thêm đúng lượng nguyên liệu còn thiếu vào danh sách mua hàng ngay từ màn hình công thức.',
            'Add just the exact missing ingredient shortfalls to your shopping list straight from the recipe screen.',
          ),
        },
        {
          code: '03',
          heading: l('Lưu món yêu thích theo tài khoản', 'Save household favorites'),
          body: l(
            'Đánh dấu các món hợp khẩu vị gia đình để tìm lại nhanh mỗi tuần (C17).',
            'Bookmark dishes your family loves so you can pull them back into any weekly plan in seconds (C17).',
          ),
        },
      ],
    },
    M07: {
      screenId: 'M07',
      canonicalPath: '/features/cooking',
      eyebrow: l('Không gian đứng bếp tập trung', 'Focused kitchen workspace'),
      title: l('Nấu ăn từng bước', 'Step-by-Step Cooking'),
      subtitle: l(
        'Tập trung vào món ăn với timer và hướng dẫn rõ ràng.',
        'Stay focused at the stove with built-in timers and crisp instructions.',
      ),
      ctaLabel: l('Trải nghiệm chế độ nấu', 'Try Guided Cooking mode'),
      ctaHref: '/auth?mode=login&returnTo=%2Frecipes%2Fthit-kho-trung',
      imageSrc: '/takolio/vnext/marketing/m07-guided-cooking.webp',
      imageSrc640: '/takolio/vnext/marketing/m07-guided-cooking-640w.webp',
      imageAlt: l(
        'Nồi gang ninh món ăn trên bếp sạch sẽ cùng sả gừng hành lá',
        'Cast-iron pot simmering on a clean kitchen stove beside fresh lemongrass, ginger, and scallions',
      ),
      truthBadge: l('Chỉ trừ kho khi bạn xác nhận hoàn thành', 'Deducts inventory only upon completion'),
      truthNote: l(
        'Mở màn chuẩn bị nấu hoặc thoát giữa chừng sẽ không bao giờ tự ý trừ nguyên liệu trong tủ lạnh.',
        'Opening prep mode or exiting mid-recipe never automatically deducts ingredients from your fridge.',
      ),
      bullets: [
        {
          icon: 'check',
          title: l('Chuẩn bị nguyên liệu', 'Ingredient prep checklist'),
          detail: l(
            'Rà soát toàn bộ nguyên liệu và dụng cụ cần thiết ở bước chuẩn bị (C20) trước khi bật bếp.',
            'Check off every scaled ingredient and essential tool during prep (C20) before turning on the heat.',
          ),
        },
        {
          icon: 'timer',
          title: l('Nấu theo từng bước', 'Cook one clear step at a time'),
          detail: l(
            'Không gian bàn bếp sáng thoáng chữ lớn dễ đọc từ xa, bộ hẹn giờ vòng tròn gắn theo từng công đoạn và tùy chọn đọc giọng nói.',
            'Bright, large-type layout easy to read at arm’s length, with circular per-step countdown timers and optional hands-free voice guidance.',
          ),
        },
        {
          icon: 'sparkles',
          title: l('Xác nhận hoàn thành', 'Confirm completion accurately'),
          detail: l(
            'Xem lại lượng thực tế đã dùng ở bước kết thúc (C22) để cập nhật tồn kho chính xác, chống trừ kép.',
            'Review actual quantities used at the finish step (C22) to update your fridge accurately without double deduction.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Tối ưu cho thao tác thực tế cạnh bếp lửa (C20–C22)',
        'Designed for real hands-on cooking at the stove (C20–C22)',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Loại bỏ thanh điều hướng gây xao nhãng', 'Distraction-free cooking canvas'),
          body: l(
            'Chế độ đứng bếp ẩn các menu phụ để toàn bộ màn hình dành cho bước hiện tại và nút chuyển bước lớn.',
            'Cooking mode hides secondary navigation so the screen focuses on the current step and large next/previous controls.',
          ),
        },
        {
          code: '02',
          heading: l('Giữ màn hình sáng an toàn (Wake Lock)', 'Keep screen awake safely (Wake Lock)'),
          body: l(
            'Hỗ trợ giữ sáng màn hình trên trình duyệt tương thích để bạn không phải chạm tay ướt mở khóa liên tục.',
            'Uses Screen Wake Lock on supported browsers so you never have to unlock your phone with wet hands.',
          ),
        },
        {
          code: '03',
          heading: l('Khôi phục tiến độ khi tải lại trang', 'Resumes progress after page reload'),
          body: l(
            'Trạng thái bước đang nấu và hẹn giờ được bảo toàn để không mất mạch nấu ăn.',
            'Active step state and running timers are preserved so you never lose your place mid-meal.',
          ),
        },
      ],
    },
    M08: {
      screenId: 'M08',
      canonicalPath: '/features/shopping',
      eyebrow: l('Đi chợ gọn gàng, không mua thừa', 'Calm, zero-duplicate grocery runs'),
      title: l('Danh sách đi chợ', 'Smart Shopping List'),
      subtitle: l(
        'Chỉ mua đúng phần còn thiếu sau khi kiểm tra tồn kho.',
        'Buy only the exact shortfall after subtracting what is already in your fridge.',
      ),
      ctaLabel: l('Mở danh sách đi chợ', 'Open Shopping List'),
      ctaHref: '/auth?mode=login&returnTo=%2Fshopping',
      imageSrc: '/takolio/vnext/marketing/m08-smart-shopping-basket.webp',
      imageSrc640: '/takolio/vnext/marketing/m08-smart-shopping-basket-640w.webp',
      imageAlt: l(
        'Giỏ mây đi chợ đầy rau muống cà chua trứng gà chanh gừng tươi',
        'Woven market basket filled with fresh leafy greens, tomatoes, eggs, limes, and ginger',
      ),
      truthBadge: l('Hỗ trợ ngoại tuyến & chống nhập kho trùng', 'Offline-ready & duplicate-safe restocking'),
      truthNote: l(
        'Takolio không tự đặt hàng qua bên thứ ba; bạn hoàn toàn chủ động nơi mua và xác nhận khi cất đồ vào tủ.',
        'Takolio never places third-party orders automatically; you choose where to shop and confirm before restocking your fridge.',
      ),
      bullets: [
        {
          icon: 'shopping',
          title: l('Nhóm theo khu vực mua', 'Grouped by store aisle'),
          detail: l(
            'Sắp xếp mục cần mua theo quầy kệ và chế độ đi chợ nhanh một tay để đi siêu thị hoặc chợ thuận tiện.',
            'Organizes items by aisle with a one-handed quick-shop view for faster supermarket or market trips.',
          ),
        },
        {
          icon: 'check',
          title: l('Đánh dấu đã mua', 'Check off items offline'),
          detail: l(
            'Hoạt động mượt ngay cả khi sóng yếu ở tầng hầm siêu thị với hàng đợi đồng bộ ngoại tuyến minh bạch.',
            'Works reliably even in weak-signal grocery basements with a transparent offline sync queue.',
          ),
        },
        {
          icon: 'fridge',
          title: l('Nhập kho có xác nhận', 'Confirmed fridge restocking'),
          detail: l(
            'Chuyển các mục đã mua vào tủ lạnh thông qua quy trình duyệt nhập kho, ngăn chặn nhân đôi số lượng.',
            'Move purchased items straight into your fridge via a review step that prevents duplicate quantities.',
          ),
        },
      ],
      deepDiveTitle: l(
        'Khép kín chu trình từ chợ về tủ lạnh (C27–C29)',
        'Close the loop from market to fridge (C27–C29)',
      ),
      deepDiveSteps: [
        {
          code: '01',
          heading: l('Gắn nguồn gốc món ăn cho từng mục mua', 'Tracks recipe origin per item'),
          body: l(
            'Biết rõ nguyên liệu này phục vụ món nào trong thực đơn tuần hoặc được thêm thủ công.',
            'See exactly which meal-plan dishes require each item — or whether it was added manually.',
          ),
        },
        {
          code: '02',
          heading: l('Hiển thị rõ trạng thái chờ đồng bộ (pendingSync)', 'Clear offline sync status (pendingSync)'),
          body: l(
            'Không bao giờ báo đã lưu máy chủ khi thiết bị đang ngoại tuyến — hiển thị số thao tác chờ gửi rõ ràng.',
            'Never claims changes are synced to the server while offline — displays the exact count of queued actions.',
          ),
        },
        {
          code: '03',
          heading: l('Duyệt nhập kho sau buổi chợ (C29)', 'Post-shop restock review (C29)'),
          body: l(
            'Kiểm tra lại khối lượng thực mua và ngăn bảo quản trước khi chính thức cộng vào tủ lạnh.',
            'Verify actual purchased amounts and storage zones before adding them to your fridge inventory.',
          ),
        },
      ],
    },
  };
}

function buildShowcaseRecipes(l: LocalePicker) {
  return [
    {
      slug: 'thit-kho-trung',
      title: l('Thịt kho tàu nước dừa trứng béo ngậy', 'Caramelized Pork Belly & Eggs in Coconut Water'),
      meta: l('45 phút · 4 người', '45 min · 4 servings'),
    },
    {
      slug: 'canh-chua-ca-loc-nam-bo',
      title: l('Canh chua cá lóc Nam Bộ', 'Southern Vietnamese Tamarind Fish Soup'),
      meta: l('25 phút · 4 người', '25 min · 4 servings'),
    },
    {
      slug: 'bun-cha-ha-noi-than-hoa',
      title: l('Bún chả nướng than hoa Hà Nội', 'Hanoi Charcoal-Grilled Pork & Vermicelli (Bun Cha)'),
      meta: l('40 phút · 4 người', '40 min · 4 servings'),
    },
    {
      slug: 'sup-ga-ngo-non-nam-huong',
      title: l('Súp gà ngô non nấm hương trứng hoa', 'Sweet Corn, Shiitake & Egg Drop Chicken Soup'),
      meta: l('18 phút · 4 người', '18 min · 4 servings'),
    },
    {
      slug: 'goi-ga-xe-phay-bap-cai',
      title: l('Gỏi gà xé phay bắp cải hành tây', 'Shredded Chicken & Crunchy Cabbage Salad'),
      meta: l('25 phút · 4 người', '25 min · 4 servings'),
    },
    {
      slug: 'dau-phu-sot-ca-chua',
      title: l('Đậu phụ lướt ván sốt cà chua', 'Crispy Tofu in Savory Tomato Sauce'),
      meta: l('20 phút · 3 người', '20 min · 3 servings'),
    },
  ] as const;
}

const FeatureStoryLayout: React.FC<{ screenId: FeatureStorySpec['screenId'] }> = ({ screenId }) => {
  const navigate = useNavigate();
  const { l, locale } = useLocaleText();
  const spec = useMemo(() => buildFeatureStories(l)[screenId], [l, screenId]);
  const showcaseRecipes = useMemo(() => buildShowcaseRecipes(l), [l]);
  const breadcrumbJsonLd = useMemo(
    () =>
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: spec.title, path: spec.canonicalPath },
      ]),
    [spec.title, spec.canonicalPath],
  );

  useVNextSeo({
    title: spec.title,
    description: `${spec.subtitle} ${spec.truthNote}`,
    canonicalPath: spec.canonicalPath,
    domainSurface: 'marketing',
    ogImage: spec.imageSrc,
    ogImageAlt: spec.imageAlt,
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
    jsonLd: breadcrumbJsonLd,
  });

  const hasInteractiveLab =
    spec.screenId === 'M02' ||
    spec.screenId === 'M03' ||
    spec.screenId === 'M04' ||
    spec.screenId === 'M05' ||
    spec.screenId === 'M07';

  return (
    <PublicMarketingShell screenId={spec.screenId}>
      <FeatureSubnavBar activeId={spec.screenId} />

      <section
        aria-labelledby={`tkv-${spec.screenId}-h1`}
        className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Title + Subtitle + 3 Structured Highlight Cards */}
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
              <span>{spec.eyebrow}</span>
            </span>

            <div className="space-y-2.5">
              <h1
                id={`tkv-${spec.screenId}-h1`}
                className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink,#152E2C)] leading-[1.15]"
              >
                {spec.title}
              </h1>
              <p className="text-base sm:text-lg text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                {spec.subtitle}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {spec.bullets.map((b) => (
                <div
                  key={b.title}
                  className="rounded-[20px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-4 sm:p-5 flex items-start gap-3.5"
                >
                  <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                    <VNextIcon name={b.icon} size={20} />
                  </span>
                  <div className="space-y-1 min-w-0">
                    <h2 className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {b.title}
                    </h2>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                      {b.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Crisp Sunlit Ceramic Showcase + Terracotta CTA */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-[24px] bg-white p-4 sm:p-5 border border-[var(--tkv-border,#DCE6DE)] shadow-soft space-y-4">
              <div className="rounded-[18px] overflow-hidden aspect-[4/3] bg-[var(--tkv-surface-mint)]">
                <img
                  src={spec.imageSrc640}
                  srcSet={`${spec.imageSrc640} 640w, ${spec.imageSrc} 1200w`}
                  sizes="(max-width: 1024px) 100vw, 560px"
                  alt={spec.imageAlt}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="rounded-2xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] p-4 space-y-1.5">
                <p className="text-xs font-extrabold text-[var(--tkv-sage-ink,#134C39)] inline-flex items-center gap-1.5">
                  <VNextIcon name="shield" size={15} className="text-[var(--tkv-sage,#196149)]" />
                  <span>{spec.truthBadge}</span>
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                  {spec.truthNote}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                trackPublicConversion('feature_primary_cta', { screenId: spec.screenId });
                navigateToAppSurface(vnextHref(spec.ctaHref), navigate);
              }}
              className="tkv-focusable w-full min-h-[52px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>{spec.ctaLabel}</span>
              <VNextIcon name="arrow-right" size={18} />
            </button>
          </div>
        </div>

        {/* Bé Mầm Bếp & Culinary Banner */}
        {hasInteractiveLab && (
          <div className="mt-10 pt-8 border-t border-[var(--tkv-border)]">
            <CulinaryHillsBanner />
          </div>
        )}
      </section>

      {/* Deep-Dive Section */}
      <section className="bg-white border-y border-[var(--tkv-border,#DCE6DE)] py-12 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
            {spec.deepDiveTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {spec.deepDiveSteps.map((st) => (
              <div
                key={st.code}
                className="rounded-[20px] bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-5 space-y-2.5"
              >
                <span className="tkv-heading tabular-nums inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-accent-ink,#B33A22)] text-xs font-extrabold">
                  {st.code}
                </span>
                <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {st.heading}
                </h3>
                <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">{st.body}</p>
              </div>
            ))}
          </div>

          {spec.screenId === 'M06' && (
            <div className="pt-4 space-y-4">
              <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                {l(
                  'Một số món ăn xác minh nguyên liệu trong kho công thức',
                  'Featured verified dishes from the recipe library',
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {showcaseRecipes.map((r) => (
                  <TkvSurface key={r.slug} padded={false} className="overflow-hidden flex flex-col bg-white border-[var(--tkv-border,#DCE6DE)]">
                    <VerifiedDishImage slug={r.slug} title={r.title} aspectClass="aspect-[4/3]" />
                    <div className="p-4 space-y-1">
                      <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">
                        {r.title}
                      </p>
                      <p className="text-xs font-semibold tabular-nums text-[var(--tkv-ink-muted,#52706A)]">{r.meta}</p>
                    </div>
                  </TkvSurface>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicMarketingShell>
  );
};

export const M02HowItWorksPage: React.FC = () => <FeatureStoryLayout screenId="M02" />;
export const M03AiScanFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M03" />;
export const M04FridgeFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M04" />;
export const M05MealPlanningFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M05" />;
export const M06RecipesFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M06" />;
export const M07CookingFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M07" />;
export const M08ShoppingFeaturePage: React.FC = () => <FeatureStoryLayout screenId="M08" />;

interface PublicBillingPlanDto {
  plan: 'monthly' | 'annual';
  amountVnd: number;
  currency: string;
}

interface PublicPricingBundle {
  plans: PublicBillingPlanDto[];
  regionalCatalog: RegionalPriceReference[];
}

const M09_CURRENCIES: readonly GlobalDisplayCurrency[] = ['VND', 'JPY', 'EUR', 'USD', 'GBP'];

async function fetchLivePricingBundle(): Promise<PublicPricingBundle | null> {
  const endpoints = isSatelliteComRuntime()
    ? ['/api/v1/public/pricing']
    : ['https://takolio.com/api/v1/public/pricing'];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { credentials: 'omit' });
      if (!res.ok) continue;
      const body = (await res.json()) as { plans?: unknown; regionalCatalog?: RegionalPriceReference[] };
      if (!Array.isArray(body?.plans)) continue;
      const valid = body.plans.filter(
        (item): item is PublicBillingPlanDto =>
          Boolean(item) &&
          typeof item === 'object' &&
          ((item as PublicBillingPlanDto).plan === 'monthly' ||
            (item as PublicBillingPlanDto).plan === 'annual') &&
          typeof (item as PublicBillingPlanDto).amountVnd === 'number' &&
          Number.isFinite((item as PublicBillingPlanDto).amountVnd) &&
          (item as PublicBillingPlanDto).amountVnd > 0,
      );
      if (valid.length > 0) {
        const monthlyVnd = valid.find((p) => p.plan === 'monthly')?.amountVnd ?? DEFAULT_VND_PRICES.monthly;
        const annualVnd = valid.find((p) => p.plan === 'annual')?.amountVnd ?? DEFAULT_VND_PRICES.annual;
        const catalog =
          Array.isArray(body.regionalCatalog) && body.regionalCatalog.length > 0
            ? body.regionalCatalog
            : buildRegionalPriceReferences({ monthly: monthlyVnd, annual: annualVnd });
        return { plans: valid, regionalCatalog: catalog };
      }
    } catch {
      // Try next endpoint gracefully
    }
  }
  return null;
}

function buildM09MiniFaq(l: LocalePicker) {
  return [
    {
      q: l('Tôi có thể thanh toán bằng hình thức nào?', 'Which payment methods are supported?'),
      a: l(
        'Tại Việt Nam bạn quét VietQR tức thì (không tự động trừ tiền). Ở Nhật Bản, Châu Âu và quốc tế bạn thanh toán bằng thẻ Visa/Mastercard/JCB, Apple Pay, Google Pay, SEPA hoặc Amazon Pay qua Dodo Payments.',
        'In Vietnam you can pay instantly with VietQR (no automatic recurring charge). In Japan, Europe, and worldwide you can pay with Visa, Mastercard, JCB, Apple Pay, Google Pay, SEPA, or Amazon Pay via Dodo Payments.',
      ),
    },
    {
      q: l('Có tự động gia hạn ẩn khi dùng gói Miễn phí không?', 'Are there any hidden renewals on the Free plan?'),
      a: l(
        'Không. Gói Miễn phí không yêu cầu thẻ hay tài khoản ngân hàng. Với gói Pro quốc tế, bạn có thể dừng gia hạn bất cứ lúc nào ngay trong trang /plus hoặc Dodo Customer Portal.',
        'No. The Free plan never requires a card or bank account. For international Pro subscriptions, you can cancel auto-renewal anytime from /plus or the Dodo Customer Portal.',
      ),
    },
    {
      q: l('Đổi điện thoại có bị mất gói Pro không?', 'Will I lose my Pro plan if I switch phones?'),
      a: l(
        'Không. Quyền lợi Takolio Pro gắn liền với tài khoản đã xác thực của bạn và tự động đồng bộ trên mọi thiết bị.',
        'No. Your Takolio Pro benefits stay linked to your verified account and automatically sync across all your devices.',
      ),
    },
  ] as const;
}

/**
 * M09 — Các gói Takolio (`/pricing`).
 * Calm Kitchen Commerce unified pricing page matching `takolio.com/pricing` & `/plus` 1:1,
 * with billing cycle switcher, live regional currencies, and deep-linked handoff into `/plus`.
 */
export const M09PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { l, locale } = useLocaleText();
  const { userId, householdId, isGuest } = useAuthStore();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [selectedCurrency, setSelectedCurrency] = useState<GlobalDisplayCurrency>(() =>
    locale === 'vi' ? 'VND' : LOCALE_CATALOG[locale].defaultCurrency,
  );

  useEffect(() => {
    setSelectedCurrency(locale === 'vi' ? 'VND' : LOCALE_CATALOG[locale].defaultCurrency);
  }, [locale]);

  const displayedCurrencies = useMemo<GlobalDisplayCurrency[]>(() => {
    const def = locale === 'vi' ? 'VND' : LOCALE_CATALOG[locale].defaultCurrency;
    return M09_CURRENCIES.includes(def) ? [...M09_CURRENCIES] : [...M09_CURRENCIES, def];
  }, [locale]);

  const miniFaq = useMemo(() => buildM09MiniFaq(l), [l]);

  const livePricingQuery = useQuery({
    queryKey: ['public-billing-plans'],
    queryFn: fetchLivePricingBundle,
    staleTime: 60_000,
    retry: false,
  });

  const livePlans = livePricingQuery.data?.plans ?? null;
  const regionalCatalog = useMemo(
    () => livePricingQuery.data?.regionalCatalog ?? buildRegionalPriceReferences(DEFAULT_VND_PRICES),
    [livePricingQuery.data],
  );
  const currentTier =
    regionalCatalog.find((c) => c.currency === selectedCurrency) ?? regionalCatalog[0];
  const pricingJsonLd = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: l('Các gói Takolio', 'Takolio Plans'), path: '/pricing' },
      ]),
      buildPricingJsonLd(livePlans, locale),
    ],
    [l, livePlans, locale],
  );

  useVNextSeo({
    title: l('Các gói Takolio', 'Takolio Plans'),
    description: l(
      'Lựa chọn gói Miễn phí hoặc Takolio Pro phù hợp nhu cầu căn bếp gia đình.',
      'Choose Takolio Free or Takolio Pro to fit your household kitchen.',
    ),
    canonicalPath: '/pricing',
    domainSurface: 'marketing',
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
    jsonLd: pricingJsonLd,
  });

  const handleStartFree = async () => {
    trackPublicConversion('pricing_start_free');
    if (isSatelliteComRuntime()) {
      window.location.assign(resolveAppSurfaceHref('/auth?mode=guest'));
      return;
    }
    if (userId && householdId) {
      navigate(vnextHref('/'));
      return;
    }
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/welcome'));
    } catch {
      navigate(vnextHref('/auth?mode=register'));
    } finally {
      setIsStarting(false);
    }
  };

  const marketCode = marketCodeForCurrency(currentTier.currency);
  const plusPathWithSelection = `/plus?plan=${billingCycle}&market=${encodeURIComponent(marketCode)}`;
  const plusDestination =
    userId && householdId && !isGuest
      ? plusPathWithSelection
      : vnextHref(`/auth?mode=login&returnTo=${encodeURIComponent(plusPathWithSelection)}`);

  const activeMinor = billingCycle === 'annual' ? currentTier.annualMinor : currentTier.monthlyMinor;
  const activeFormatted = formatGlobalMinorCurrency(
    activeMinor,
    currentTier.currency,
    currentTier.minorDigits,
    currentTier.localeDefault,
  );
  const monthlyEquivFormatted = formatGlobalMinorCurrency(
    Math.round(currentTier.annualMinor / 12),
    currentTier.currency,
    currentTier.minorDigits,
    currentTier.localeDefault,
  );

  const freePerks = [
    l('Quản lý tồn kho tủ lạnh theo lô và cảnh báo hạn dùng', 'Batch-level fridge inventory with expiry alerts'),
    l('Tra cứu kho công thức & chế độ nấu từng bước có timer', 'Full recipe library & step-by-step cooking mode with timers'),
    l('Danh sách đi chợ đồng bộ ngoại tuyến và đối chiếu định lượng', 'Offline-capable shopping list with exact quantity matching'),
  ];

  const proPerks = [
    l(
      'AI nhận diện hoá đơn & nguyên liệu tủ lạnh không giới hạn (có duyệt trước khi lưu)',
      'Expanded AI receipt & fridge ingredient scanning (always review before saving)',
    ),
    l(
      'Lập thực đơn tuần chuyên sâu & tối ưu danh sách đi chợ theo lịch',
      'Advanced weekly meal planning & schedule-optimized net shopping lists',
    ),
    l(
      '500+ công thức chuẩn hoá kèm dinh dưỡng & trợ lý giọng nói rảnh tay',
      '500+ standardized recipes with nutrition info & hands-free voice sous-chef',
    ),
    l(
      'Thanh toán linh hoạt: VietQR (Việt Nam) hoặc Thẻ / Apple Pay (Quốc tế)',
      'Flexible checkout: VietQR (Vietnam) or Card / Apple Pay / Google Pay (Global)',
    ),
  ];

  return (
    <PublicMarketingShell screenId="M09">
      <section aria-labelledby="tkv-m09-h1" className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-9">
        {/* Centered Calm Kitchen Editorial Header */}
        <header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)]" aria-hidden="true" />
            <span>{l('Biểu phí minh bạch · Việt Nam & Quốc tế', 'Transparent Pricing · Vietnam & Global')}</span>
          </span>
          <h1 id="tkv-m09-h1" className="tkv-heading text-3xl sm:text-[2.75rem] font-black text-[var(--tkv-ink)] leading-tight">
            {l('Các gói Takolio', 'Takolio Plans')}
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">
            {l(
              'Bắt đầu miễn phí trọn đời, nâng cấp Takolio Pro bất cứ khi nào căn bếp cần thêm trợ lực AI.',
              'Start free forever, and upgrade to Takolio Pro whenever your kitchen needs extra AI power.',
            )}
          </p>
        </header>

        {/* Tactile Billing Cycle Toggle + Currency Pill Selector */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-3 sm:px-5 shadow-[var(--tkv-shadow-card)]">
          <div
            role="group"
            aria-label={l('Chu kỳ thanh toán', 'Billing cycle')}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--tkv-surface-subtle)] p-1 border border-[var(--tkv-border)] w-full md:w-auto"
          >
            <button
              type="button"
              aria-pressed={billingCycle === 'annual'}
              onClick={() => setBillingCycle('annual')}
              className={clsx(
                'tkv-focusable min-h-[42px] flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-full px-4 text-xs sm:text-sm font-extrabold transition-colors',
                billingCycle === 'annual'
                  ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              <span>{l('Gói 1 năm', 'Annual')}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-black',
                  billingCycle === 'annual'
                    ? 'bg-[var(--tkv-saffron)] text-[var(--tkv-ink)]'
                    : 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)]',
                )}
              >
                {l('Tiết kiệm 17%', 'Save 17%')}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={billingCycle === 'monthly'}
              onClick={() => setBillingCycle('monthly')}
              className={clsx(
                'tkv-focusable min-h-[42px] flex-1 md:flex-initial inline-flex items-center justify-center rounded-full px-4 text-xs sm:text-sm font-extrabold transition-colors',
                billingCycle === 'monthly'
                  ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              {l('Gói 1 tháng', 'Monthly')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={l('Tiền tệ hiển thị', 'Display currency')}>
            {displayedCurrencies.map((code) => {
              const active = selectedCurrency === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCurrency(code)}
                  className={clsx(
                    'tkv-focusable min-h-[38px] rounded-full px-3 text-xs font-extrabold transition-colors',
                    active
                      ? 'bg-[var(--tkv-ink)] text-white'
                      : 'bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
                  )}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Balanced Living Kitchen Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Free Tier */}
          <div className="rounded-[28px] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-6 sm:p-8 flex flex-col justify-between gap-7 shadow-[var(--tkv-shadow-card)]">
            <div className="space-y-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]">
                {l('Cơ bản cho mọi gia đình', 'Essential for every household')}
              </span>
              <div className="space-y-1">
                <h2 className="tkv-heading text-2xl sm:text-3xl font-black text-[var(--tkv-ink)]">
                  {l('Miễn phí', 'Free')}
                </h2>
                <p className="tkv-heading tabular-nums text-3xl sm:text-4xl font-black text-[var(--tkv-ink)] pt-1">
                  0 <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">{l('/ trọn đời cơ bản', '/ free core forever')}</span>
                </p>
              </div>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                {l(
                  'Bắt đầu ngay không cần thẻ thanh toán — đầy đủ vòng lặp quản lý tủ lạnh, công thức và đi chợ cốt lõi.',
                  'Start right away with no credit card — complete core fridge inventory, recipes, and shopping list loop.',
                )}
              </p>
              <ul className="space-y-3 pt-1 text-sm text-[var(--tkv-ink)]">
                {freePerks.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)]">
                      <VNextIcon name="check" size={12} />
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              disabled={isStarting}
              onClick={() => void handleStartFree()}
              data-testid="m09-free-cta"
              className="tkv-focusable w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-strong)] text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)] font-extrabold text-base transition-colors disabled:opacity-60"
            >
              {isStarting ? l('Đang mở…', 'Opening…') : l('Bắt đầu miễn phí', 'Start Free')}
            </button>
          </div>

          {/* Takolio Pro Tier */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[var(--tkv-surface)] via-[var(--tkv-bg)] to-[var(--tkv-surface-mint)] text-[var(--tkv-ink)] border-2 border-[var(--tkv-primary)] p-6 sm:p-8 flex flex-col justify-between gap-7 shadow-[var(--tkv-shadow-elevated)]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border border-[var(--tkv-border-saffron)]">
                    <VNextIcon name="crown" size={13} />
                    <span>{l('Phổ biến cho căn bếp bận rộn', 'Popular for busy kitchens')}</span>
                  </span>
                  <h2 className="tkv-heading text-2xl sm:text-3xl font-black text-[var(--tkv-ink)]">
                    Takolio Pro
                  </h2>
                </div>
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-1.5 shadow-xs">
                  <img
                    src="/takolio/vnext/mascot/pose-06-achievement-256w.webp"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-4" data-testid="m09-live-prices">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="tkv-heading tabular-nums text-3xl sm:text-4xl font-black text-[var(--tkv-ink)]">
                      {activeFormatted}
                    </span>
                    <span className="text-xs font-bold text-[var(--tkv-ink-muted)]">
                      / {billingCycle === 'annual' ? l('năm', 'year') : l('tháng', 'month')}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <span className="rounded-full bg-[var(--tkv-surface-mint)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums">
                      ~{monthlyEquivFormatted}/{l('tháng', 'mo')}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--tkv-ink-secondary)] leading-relaxed">
                  {currentTier.currency === 'VND'
                    ? l(
                        'Thanh toán VietQR tức thì · Không tự động trừ tiền.',
                        'Instant VietQR payment · No hidden auto-renewal.',
                      )
                    : l(
                        'Thanh toán quốc tế qua Thẻ, Apple Pay, Google Pay, SEPA · Đã gồm thuế (Dodo Payments).',
                        'Global checkout via Card, Apple Pay, Google Pay & SEPA · Tax-inclusive (Dodo Payments).',
                      )}
                </p>
              </div>

              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                {l(
                  'Mở rộng toàn bộ sức mạnh AI quét tủ lạnh, lập thực đơn tuần tự động và 500+ công thức chuẩn hoá.',
                  'Unlock full AI fridge & receipt scanning, automated weekly meal planning, and 500+ standardized recipes.',
                )}
              </p>
              <ul className="space-y-3 text-sm text-[var(--tkv-ink)]">
                {proPerks.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]">
                      <VNextIcon name="check" size={12} />
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => {
                trackPublicConversion('pricing_view_plus');
                navigateToAppSurface(plusDestination, navigate);
              }}
              data-testid="m09-plus-cta"
              className="tkv-focusable tkv-tactile w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] text-white font-extrabold text-base shadow-[var(--tkv-shadow-cta)] transition-colors"
            >
              {l('Chọn Takolio Pro', 'Choose Takolio Pro')}
            </button>
          </div>
        </div>

        {/* Calm Billing Reassurance Mini-FAQ */}
        <div className="rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 sm:p-6 space-y-3 shadow-[var(--tkv-shadow-card)]">
          <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
            {l('Câu hỏi thường gặp về thanh toán', 'Frequently asked billing questions')}
          </h2>
          <div className="divide-y divide-[var(--tkv-border)]">
            {miniFaq.map((item) => (
              <details key={item.q} className="group py-3 first:pt-1 last:pb-1">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-bold text-[var(--tkv-ink)]">
                  <span>{item.q}</span>
                  <VNextIcon name="chevron-right" size={16} className="shrink-0 text-[var(--tkv-ink-muted)] transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-4 sm:p-5 text-xs sm:text-sm text-[var(--tkv-ink-secondary)] flex items-start gap-3">
          <VNextIcon name="info" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
          <p className="min-w-0">
            <strong className="text-[var(--tkv-ink)]">{l('Nguyên tắc minh bạch thương mại:', 'Commercial transparency policy:')}</strong>{' '}
            {l(
              'Biểu phí hiển thị trên trang này luôn đồng bộ trực tiếp từ hệ thống thanh toán chính thức và không bao giờ hiển thị giá ước đoán.',
              'Prices shown on this page always sync directly from our official billing system and never display guessed rates.',
            )}
          </p>
        </div>
      </section>
    </PublicMarketingShell>
  );
};

function buildFaqItems(l: LocalePicker) {
  return [
    {
      id: 'faq-free',
      q: l('Takolio có miễn phí không?', 'Is Takolio free to use?'),
      a: l(
        'Có. Bạn có thể sử dụng miễn phí các tính năng cốt lõi gồm quản lý tủ lạnh theo lô, tra cứu kho công thức món ăn gia đình, chế độ nấu từng bước có hẹn giờ và danh sách đi chợ. Gói Takolio Pro là tùy chọn mở rộng hạn mức AI Scan và tiện ích lập kế hoạch nâng cao.',
        'Yes. Core features are free forever — including batch-level fridge tracking, the family recipe library, step-by-step guided cooking with timers, and smart shopping lists. Takolio Pro is an optional upgrade for expanded AI Scan quotas and advanced weekly planning.',
      ),
    },
    {
      id: 'faq-ai',
      q: l('AI nhận diện có chính xác tuyệt đối không?', 'Is AI ingredient recognition 100% accurate?'),
      a: l(
        'Không. Hình ảnh thực tế trong tủ lạnh hoặc hóa đơn có thể bị mờ, khuất góc hoặc thiếu hạn sử dụng. Vì vậy Takolio áp dụng nguyên tắc bắt buộc “duyệt trước khi lưu”: AI chỉ đề xuất danh sách nháp, còn bạn là người kiểm tra và xác nhận cuối cùng.',
        'No. Real fridge photos and grocery receipts can be blurry, partially obscured, or missing expiry dates. That is why Takolio enforces a strict review-before-save rule: AI only proposes an editable draft, and you always check and confirm before saving.',
      ),
    },
    {
      id: 'faq-guest',
      q: l('Có cần đăng ký để dùng thử?', 'Do I need an account to try Takolio?'),
      a: l(
        'Bạn có thể bấm “Bắt đầu miễn phí” để khởi tạo phiên dùng thử khách ngay lập tức. Khi muốn lưu trữ thực đơn tuần lâu dài hoặc đồng bộ trên thiết bị khác, bạn có thể đăng ký tài khoản email hoặc Google.',
        'No. Click "Start Free" to launch an instant guest trial right away. Whenever you want to save long-term weekly meal plans or sync across devices, you can register with email or Google.',
      ),
    },
    {
      id: 'faq-privacy',
      q: l('Dữ liệu cá nhân được sử dụng ra sao?', 'How is my personal and household data protected?'),
      a: l(
        'Dữ liệu tồn kho, lịch sử quét, thực đơn và giỏ đi chợ được phân tách nghiêm ngặt theo mã hộ gia đình (household_id). Khi đăng xuất hoặc đổi tài khoản trên cùng trình duyệt, bộ nhớ đệm cục bộ của phiên trước được xóa sạch.',
        'Inventory batches, scan history, meal plans, and shopping lists are strictly isolated per household (household_id). When you sign out or switch accounts on the same browser, the previous session’s local cache is wiped clean.',
      ),
    },
    {
      id: 'faq-plus',
      q: l('Tính năng nào có trong Takolio Pro?', 'What is included in Takolio Pro?'),
      a: l(
        'Chi tiết quyền lợi và biểu phí hiện hành của Takolio Pro được đồng bộ trực tiếp từ máy chủ tại trang /plus sau khi bạn đăng nhập tài khoản đã xác thực.',
        'Current Takolio Pro benefits and live billing rates sync directly from the server on the /plus page once you sign in with a verified account.',
      ),
    },
  ] as const;
}

/**
 * M10 — Câu hỏi thường gặp (`/faq`).
 * Accessible accordion + instant client-side search filter.
 */
export const M10FaqPage: React.FC = () => {
  const { l, locale } = useLocaleText();
  const faqItems = useMemo(() => buildFaqItems(l), [l]);
  const [openId, setOpenId] = useState<string>('faq-free');
  const [searchQuery, setSearchQuery] = useState('');
  const faqJsonLd = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: l('Câu hỏi thường gặp', 'Frequently Asked Questions'), path: '/faq' },
      ]),
      buildFaqJsonLd(faqItems, locale),
    ],
    [l, faqItems, locale],
  );

  useVNextSeo({
    title: l('Câu hỏi thường gặp', 'Frequently Asked Questions'),
    description: l(
      'Giải đáp minh bạch về cách hoạt động, AI Scan, quyền riêng tư hộ gia đình và gói Takolio Pro.',
      'Clear answers about how Takolio works, AI Scan, household privacy, and Takolio Pro.',
    ),
    canonicalPath: '/faq',
    domainSurface: 'marketing',
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
    jsonLd: faqJsonLd,
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFaq = normalizedQuery
    ? faqItems.filter(
        (item) =>
          item.q.toLowerCase().includes(normalizedQuery) ||
          item.a.toLowerCase().includes(normalizedQuery),
      )
    : faqItems;

  return (
    <PublicMarketingShell screenId="M10">
      <section aria-labelledby="tkv-m10-h1" className="max-w-[920px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-2.5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>{l('Giải đáp minh bạch', 'Clear Answers')}</span>
          </span>
          <h1 id="tkv-m10-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
            {l('Câu hỏi thường gặp', 'Frequently Asked Questions')}
          </h1>
          <p className="text-base text-[var(--tkv-ink-soft,#3C5954)]">
            {l(
              'Những thông tin quan trọng trước khi bạn đưa Takolio vào căn bếp hằng ngày.',
              'Everything you should know before bringing Takolio into your everyday kitchen.',
            )}
          </p>
        </div>

        {/* Instant Accessible FAQ Search */}
        <div className="relative flex items-center">
          <label htmlFor="m10-faq-search" className="sr-only">
            {l('Tìm câu hỏi thường gặp', 'Search frequently asked questions')}
          </label>
          <span className="absolute left-4 text-[var(--tkv-ink-muted,#52706A)] pointer-events-none">
            <VNextIcon name="search" size={18} />
          </span>
          <input
            id="m10-faq-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={l('Tìm câu hỏi...', 'Search questions...')}
            className="tkv-focusable w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-[var(--tkv-border,#DCE6DE)] focus:border-[var(--tkv-primary,#196149)] text-base text-[var(--tkv-ink,#152E2C)] placeholder:text-[var(--tkv-ink-muted,#52706A)] transition-colors"
          />
        </div>

        {filteredFaq.length === 0 ? (
          <div
            role="status"
            className="rounded-[20px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 text-center space-y-3"
          >
            <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">
              {l(
                `Không tìm thấy câu hỏi khớp từ khóa “${searchQuery.trim()}”`,
                `No questions found matching "${searchQuery.trim()}"`,
              )}
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="tkv-focusable min-h-[44px] px-4 py-2 rounded-xl bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white text-xs sm:text-sm font-bold transition-colors"
            >
              {l('Hiển thị tất cả câu hỏi', 'Show all questions')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaq.map((item) => {
              const expanded = Boolean(normalizedQuery) || openId === item.id;
              const panelId = `${item.id}-panel`;
              return (
                <div
                  key={item.id}
                  className="rounded-[20px] bg-white border border-[var(--tkv-border,#DCE6DE)] overflow-hidden"
                >
                  <h2>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpenId(openId === item.id ? '' : item.id)}
                      className="tkv-focusable w-full min-h-[60px] px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[var(--tkv-bg,#FFF9F1)] transition-colors"
                    >
                      <span className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                        {item.q}
                      </span>
                      <span className="w-8 h-8 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                        <VNextIcon name={expanded ? 'minus' : 'plus'} size={16} />
                      </span>
                    </button>
                  </h2>
                  {expanded && (
                    <div
                      id={panelId}
                      role="region"
                      className="px-5 pb-5 pt-2 text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed border-t border-[var(--tkv-border,#DCE6DE)]"
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PublicMarketingShell>
  );
};

function buildStoriesGuides(l: LocalePicker) {
  return [
    {
      id: '5-mon-nhanh-toi-ban-ron',
      title: l('5 món ăn nhanh cho tối bận rộn', '5 Quick Dinners for Busy Weeknights'),
      readTime: l('04 phút đọc · Mẹo thực đơn', '4 min read · Meal Strategy'),
      excerpt: l(
        'Cách kết hợp trứng, đậu phụ, rau theo mùa và thịt thái sẵn để hoàn thành mâm cơm nóng hổi dưới 25 phút sau giờ làm.',
        'How to pair eggs, tofu, seasonal greens, and pre-sliced proteins to put a hot, balanced dinner on the table in under 25 minutes.',
      ),
      coverSrc: '/takolio/vnext/food/dau-phu-sot-ca-chua.webp',
      coverSrc640: '/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp',
      coverAlt: l(
        'Mâm cơm chiều 25 phút ấm áp với đậu phụ sốt cà chua, rau xanh và cơm trắng trong bát gốm sứ',
        'Warm 25-minute weeknight dinner with tomato-braised tofu, greens, and steamed rice in ceramic bowls',
      ),
      publishedAt: '2026-11-18',
      points: [
        l(
          'Ưu tiên 1 món mặn nhanh (đậu phụ sốt cà chua, gà kho gừng) kết hợp 1 món canh hoặc rau xào tỏi.',
          'Pair one quick savory main (tomato-braised tofu or ginger chicken) with one light soup or garlic-sautéed green.',
        ),
        l(
          'Kiểm tra mục “Nguyên liệu nên dùng sớm” trên trang Hôm nay trước khi ra chợ chiều.',
          'Check the "Use soon" shelf on the Today screen before making an afternoon grocery stop.',
        ),
        l(
          'Dùng bộ lọc thời gian tối đa ≤ 20 phút trong Kho công thức để lọc ngay các món gọn bước.',
          'Use the 20-minute max cook time filter in the Recipe Library to surface low-prep dishes immediately.',
        ),
      ],
    },
    {
      id: 'bao-quan-rau-dung-cach',
      title: l('Bảo quản rau đúng cách', 'How to Store Vegetables Properly'),
      readTime: l('05 phút đọc · Tủ lạnh thông minh', '5 min read · Smart Fridge'),
      excerpt: l(
        'Phân loại rau ăn lá, củ quả và gia vị tươi theo độ ẩm ngăn mát để giữ độ giòn lâu hơn và giảm hao hụt.',
        'Sort leafy greens, root vegetables, and fresh aromatics by fridge humidity to keep produce crisp longer and reduce waste.',
      ),
      coverSrc: '/takolio/vnext/marketing/m04-smart-fridge.webp',
      coverSrc640: '/takolio/vnext/marketing/m04-smart-fridge-640w.webp',
      coverAlt: l(
        'Rau ăn lá tươi giòn bảo quản trong hộp thủy tinh lót khăn giấy sạch trong ngăn mát sáng thoáng',
        'Crisp leafy greens stored in paper-lined glass containers inside a bright refrigerator',
      ),
      publishedAt: '2026-11-16',
      points: [
        l(
          'Không rửa ướt sũng rau ăn lá trước khi cất hộp; lót giấy thấm khô và ghi nhận mốc hạn ước tính 3 ngày.',
          'Avoid storing dripping-wet leafy greens; line containers with dry paper towel and log a 3-day freshness estimate.',
        ),
        l(
          'Tách riêng hành lá, ngò rí, sả ớt vào nhóm gia vị tươi để dễ kiểm tra khi chuẩn bị nấu.',
          'Group scallions, cilantro, lemongrass, and chili in a dedicated fresh-aromatics box so they stay visible during prep.',
        ),
        l(
          'Thực hiện đối soát tồn kho cuối tuần trước khi lên thực đơn tuần mới.',
          'Run a quick weekend stock check before building your next weekly meal plan.',
        ),
      ],
    },
    {
      id: 'bua-com-30-phut',
      title: l('Bữa cơm 30 phút song song hai bếp', '30-Minute Two-Burner Parallel Dinner'),
      readTime: l('04 phút đọc · Đứng bếp nhẹ đầu', '4 min read · Calm Cooking'),
      excerpt: l(
        'Sắp xếp thứ tự sơ chế — ướp trước, nấu canh song song, xào rau sau cùng — với bộ hẹn giờ từng bước trên Takolio.',
        'Sequence your cooking — marinate first, simmer soup in parallel, stir-fry greens last — using Takolio’s step timers.',
      ),
      coverSrc: '/takolio/vnext/marketing/m07-guided-cooking.webp',
      coverSrc640: '/takolio/vnext/marketing/m07-guided-cooking-640w.webp',
      coverAlt: l(
        'Hai nồi gốm và chảo xào vận hành song song trên mặt bếp sáng với khay nguyên liệu sơ chế gọn gàng',
        'Two pots and a skillet cooking in parallel on a bright stove beside neatly prepped ingredient trays',
      ),
      publishedAt: '2026-11-14',
      points: [
        l(
          'Mở bước Chuẩn bị nấu để bày đủ định lượng ra bàn trước khi bật bếp.',
          'Open the Cooking Prep checklist to lay out exact scaled ingredients before turning on the stove.',
        ),
        l(
          'Tận dụng hẹn giờ trên từng bước nấu để không quên nồi kho hoặc nồi canh đang sôi.',
          'Use per-step timers so simmering braises and soups never overcook while you prep.',
        ),
        l(
          'Xác nhận lượng thực tế đã dùng ở cuối bữa để tủ lạnh luôn phản ánh đúng số nguyên liệu còn lại.',
          'Confirm actual quantities used when dinner finishes so your fridge always reflects what remains.',
        ),
      ],
    },
    {
      id: 'so-che-gia-vi-tuoi-bep-viet',
      title: l('Sơ chế hành tỏi sả gừng cho cả tuần', 'Weekly Aromatics Prep: Shallots, Garlic, Lemongrass & Ginger'),
      readTime: l('05 phút đọc · Mise-en-place gia đình', '5 min read · Weekly Mise-en-Place'),
      excerpt: l(
        'Chuẩn bị sẵn khay gia vị thơm Việt Nam vào chiều Chủ Nhật giúp tiết kiệm 10 phút đứng bếp mỗi buổi tối trong tuần.',
        'Prepping a fresh aromatics tray on Sunday afternoon saves 10 minutes of weeknight chopping every evening.',
      ),
      coverSrc: '/takolio/vnext/marketing/m05-meal-planning-prep.webp',
      coverSrc640: '/takolio/vnext/marketing/m05-meal-planning-prep-640w.webp',
      coverAlt: l(
        'Hành tím, tỏi ta, sả cây, gừng tươi và ớt đỏ xếp ngay ngắn trong chén gốm trắng trên thớt gỗ',
        'Shallots, garlic, lemongrass stalks, fresh ginger, and red chili neatly arranged in white ceramic bowls on a wooden board',
      ),
      publishedAt: '2026-11-12',
      points: [
        l(
          'Bóc sẵn hành tím, tỏi khô để ráo hoàn toàn trong hũ kín lót giấy thấm ở ngăn mát trên (4°C).',
          'Store peeled, completely dry shallots and garlic in a paper-lined airtight jar on the top fridge shelf (4°C).',
        ),
        l(
          'Sả cây cắt khúc vừa ăn, phần gốc băm nhỏ cấp đông theo viên để sẵn sàng cho món kho gừng sả.',
          'Cut lemongrass stalks for broths and freeze minced lower stems in meal-sized portions for quick braises.',
        ),
        l(
          'Ghi nhận từng hũ gia vị vào Tủ lạnh thông minh để không mua trùng khi đi chợ giữa tuần.',
          'Log your prepped jars in Smart Fridge so you never buy duplicate bundles midweek.',
        ),
      ],
    },
    {
      id: 'xoay-vong-tu-lanh-khong-lang-phi',
      title: l('Quy tắc xoay vòng FEFO chống lãng phí', 'Zero-Waste FEFO Fridge Rotation'),
      readTime: l('06 phút đọc · Quản trị thực phẩm', '6 min read · Food Management'),
      excerpt: l(
        'Áp dụng nguyên tắc hết hạn trước — nấu trước (First-Expired, First-Out) cho ngăn rau củ và thực phẩm tươi sống.',
        'Apply the First-Expired, First-Out (FEFO) rule to your crisper drawer and perishable ingredients.',
      ),
      coverSrc: '/takolio/vnext/marketing/m08-smart-shopping-basket.webp',
      coverSrc640: '/takolio/vnext/marketing/m08-smart-shopping-basket-640w.webp',
      coverAlt: l(
        'Khay gốm ưu tiên nấu trước tập hợp các nguyên liệu tươi cần chế biến trong 48 giờ tới',
        'Priority ceramic tray gathering fresh ingredients scheduled to be cooked within the next 48 hours',
      ),
      publishedAt: '2026-11-10',
      points: [
        l(
          'Dành riêng một khay gốm hoặc hộp trong suốt ở ngang tầm mắt cho các lô thực phẩm còn 1–2 ngày.',
          'Reserve one clear container at eye level for batches with 1–2 days of freshness left.',
        ),
        l(
          'Bật bộ lọc “Đủ nguyên liệu” trên Takolio để tìm ngay các món tận dụng trọn khay ưu tiên đó.',
          'Enable the "Ready to cook" filter in Takolio to find dishes that use up everything in your priority tray.',
        ),
        l(
          'Luôn phân biệt hạn dùng in trên bao bì với hạn ước tính cảm quan trước khi chế biến.',
          'Always distinguish printed package dates from estimated freshness and check food visually before cooking.',
        ),
      ],
    },
    {
      id: 'bi-quyet-kho-to-ni-dat-dam-vi',
      title: l('Bí quyết kho tộ nồi đất lên màu hổ phách', 'Secrets to Glossy Amber Claypot Braising'),
      readTime: l('05 phút đọc · Tinh hoa món kho Việt', '5 min read · Braising Craft'),
      excerpt: l(
        'Canh chuẩn tỷ lệ nước màu dừa, nước mắm nhĩ và nhiệt độ lửa riu để thịt kho trứng mềm rục mà nước kho vẫn trong.',
        'Dial in caramel glaze, savory fish sauce, and gentle simmering heat for tender braised pork and eggs in a clear amber broth.',
      ),
      coverSrc: '/takolio/vnext/food/thit-kho-trung.webp',
      coverSrc640: '/takolio/vnext/food/thit-kho-trung-640w.webp',
      coverAlt: l(
        'Nồi đất nung kho thịt ba chỉ trứng gà nước dừa sôi lăn tăn ánh màu hổ phách ấm nắng',
        'Earthenware claypot simmering pork belly and eggs in golden amber coconut broth',
      ),
      publishedAt: '2026-11-08',
      points: [
        l(
          'Ướp thịt với hành tím băm và nước mắm ngon tối thiểu 20 phút trước khi thắng nước màu.',
          'Marinate pork with minced shallot and quality fish sauce for at least 20 minutes before caramelizing.',
        ),
        l(
          'Châm nước dừa tươi ấm xâm xấp mặt thịt rồi hạ lửa riu liu riu để mỡ trong và thấm đều.',
          'Pour in warm fresh coconut water just to cover, then lower to a gentle simmer so the pork turns melt-in-the-mouth tender.',
        ),
        l(
          'Sử dụng bộ hẹn giờ công đoạn trong chế độ nấu từng bước trên Takolio để canh chuẩn 35–40 phút ninh mềm.',
          'Use the stage timer in Takolio’s Guided Cooking mode to time the 35–40 minute tender simmer accurately.',
        ),
      ],
    },
  ] as const;
}

/**
 * M11 — Takolio Stories (`/stories`).
 */
export const M11StoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { l, locale } = useLocaleText();
  const storiesGuides = useMemo(() => buildStoriesGuides(l), [l]);
  const [selectedId, setSelectedId] = useState<string>('5-mon-nhanh-toi-ban-ron');
  const selected = storiesGuides.find((g) => g.id === selectedId) ?? storiesGuides[0];
  const storiesJsonLd = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: 'Takolio Stories', path: '/stories' },
      ]),
      buildStoriesBlogJsonLd(storiesGuides, locale),
    ],
    [storiesGuides, locale],
  );

  useVNextSeo({
    title: l('Takolio Stories — Cẩm nang căn bếp gia đình', 'Takolio Stories — Home Kitchen Playbook'),
    description: l(
      'Cảm hứng cho mỗi bữa ăn và những mẹo quản lý căn bếp gia đình thực tế.',
      'Inspiration for everyday meals and practical home kitchen management tips.',
    ),
    canonicalPath: '/stories',
    domainSurface: 'marketing',
    ogType: 'article',
    ogImage: selected.coverSrc,
    ogImageAlt: selected.coverAlt,
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
    jsonLd: storiesJsonLd,
  });

  return (
    <PublicMarketingShell screenId="M11">
      <section aria-labelledby="tkv-m11-h1" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-2.5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>{l('Cẩm nang bếp gia đình', 'Home Kitchen Playbook')}</span>
          </span>
          <h1 id="tkv-m11-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
            Takolio Stories
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-soft,#3C5954)]">
            {l(
              'Cảm hứng cho mỗi bữa ăn, mẹo bảo quản thực phẩm và kỹ thuật đứng bếp thực tế cho gia đình Việt.',
              'Meal inspiration, smart storage tips, and practical home-cooking techniques for busy families.',
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storiesGuides.map((story) => {
            const active = story.id === selected.id;
            return (
              <article
                key={story.id}
                id={story.id}
                className={clsx(
                  'rounded-[22px] bg-white border overflow-hidden flex flex-col justify-between transition-colors',
                  active
                    ? 'border-[var(--tkv-primary,#196149)] ring-1 ring-[var(--tkv-primary,#196149)] shadow-soft'
                    : 'border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                )}
              >
                <div>
                  <div className="p-3 bg-[var(--tkv-surface-mint)]">
                    <div className="overflow-hidden rounded-2xl aspect-[4/3] bg-white">
                      <img
                        src={story.coverSrc640}
                        srcSet={`${story.coverSrc640} 640w, ${story.coverSrc} 1200w`}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                        alt={story.coverAlt}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="p-5 space-y-2">
                    <p className="text-xs tabular-nums font-bold text-[var(--tkv-ink-muted,#52706A)]">
                      {story.readTime}
                    </p>
                    <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {story.title}
                    </h2>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                      {story.excerpt}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(story.id)}
                    className={clsx(
                      'tkv-focusable w-full min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold border transition-colors',
                      active
                        ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                        : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border-strong,#B8CABE)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)]',
                    )}
                  >
                    {active
                      ? l('Đang xem hướng dẫn dưới đây', 'Viewing guide below')
                      : l('Đọc hướng dẫn chi tiết', 'Read full guide')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Expanded Guide Reader */}
        <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--tkv-border,#DCE6DE)] pb-3">
            <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
              {selected.title}
            </h2>
            <span className="text-xs tabular-nums font-bold text-[var(--tkv-ink-muted,#52706A)]">
              {selected.readTime}
            </span>
          </div>
          <ul className="space-y-2.5 text-sm sm:text-base text-[var(--tkv-ink,#152E2C)]">
            {selected.points.map((pt) => (
              <li key={pt} className="flex items-start gap-2.5">
                <VNextIcon name="check" size={18} className="text-[var(--tkv-sage,#196149)] shrink-0 mt-1" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateToAppSurface(vnextHref('/auth?mode=register'), navigate)}
              className="tkv-focusable min-h-[44px] px-5 py-2 rounded-xl bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
            >
              <span>{l('Áp dụng ngay trong căn bếp Takolio', 'Apply now in your Takolio kitchen')}</span>
              <VNextIcon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </section>
    </PublicMarketingShell>
  );
};

/**
 * M12 — Giới thiệu · Liên hệ · Pháp lý (`/about`, `/contact`, `/privacy`, `/terms`).
 * Honest structured Support & Feedback Guide (zero fake copy-paste `<pre>` submission, zero non-synthetic emails).
 */
export const M12CompanyLegalPage: React.FC = () => {
  const { pathname } = useLocation();
  const { l, locale } = useLocaleText();
  const section: 'about' | 'contact' | 'privacy' | 'terms' = pathname.startsWith('/contact')
    ? 'contact'
    : pathname.startsWith('/privacy')
      ? 'privacy'
      : pathname.startsWith('/terms')
        ? 'terms'
        : 'about';

  const titles: Record<typeof section, { title: string; canonical: string; desc: string }> = {
    about: {
      title: l('Giới thiệu · Liên hệ · Pháp lý', 'About · Contact · Legal'),
      canonical: '/about',
      desc: l(
        'Giới thiệu về sứ mệnh căn bếp gia đình và kiến trúc dữ liệu minh bạch của Takolio.',
        'Learn about Takolio’s family kitchen mission and transparent data architecture.',
      ),
    },
    contact: {
      title: l('Liên hệ Takolio', 'Contact Takolio'),
      canonical: '/contact',
      desc: l(
        'Hướng dẫn hỗ trợ sản phẩm, tra cứu thông tin phiên và đóng góp ý kiến cho Takolio.',
        'Product support guide, session diagnostics, and transparent feedback guidance for Takolio.',
      ),
    },
    privacy: {
      title: l('Chính sách bảo mật', 'Privacy Policy'),
      canonical: '/privacy',
      desc: l(
        'Nguyên tắc phân tách dữ liệu theo hộ gia đình, xử lý ảnh quét AI và bảo vệ phiên đăng nhập trên Takolio.',
        'Household data isolation principles, AI scan image handling, and session protection on Takolio.',
      ),
    },
    terms: {
      title: l('Điều khoản sử dụng', 'Terms of Service'),
      canonical: '/terms',
      desc: l(
        'Quy định sử dụng dịch vụ, trách nhiệm kiểm duyệt kết quả AI và điều khoản tài khoản Takolio.',
        'Service usage terms, AI review responsibilities, and account terms for Takolio.',
      ),
    },
  };

  const activeTitle = titles[section].title;
  const activeCanonical = titles[section].canonical;
  const activeDesc = titles[section].desc;

  const legalJsonLd = useMemo(
    () =>
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: activeTitle, path: activeCanonical },
      ]),
    [activeTitle, activeCanonical],
  );

  useVNextSeo({
    title: activeTitle,
    description: activeDesc,
    canonicalPath: activeCanonical,
    domainSurface: 'marketing',
    lang: LOCALE_CATALOG[locale].bcp47,
    ogLocale: LOCALE_CATALOG[locale].ogLocale,
    jsonLd: legalJsonLd,
  });

  const tabs = [
    { key: 'about', label: l('Giới thiệu', 'About'), to: '/about' },
    { key: 'contact', label: l('Liên hệ', 'Contact'), to: '/contact' },
    { key: 'privacy', label: l('Chính sách bảo mật', 'Privacy Policy'), to: '/privacy' },
    { key: 'terms', label: l('Điều khoản sử dụng', 'Terms of Service'), to: '/terms' },
  ];

  return (
    <PublicMarketingShell screenId="M12">
      <section aria-labelledby="tkv-m12-h1" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        {/* M12 Family Tabs */}
        <nav aria-label={l('Nhóm trang Giới thiệu, Liên hệ và Pháp lý', 'About, Contact, and Legal navigation')} className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              to={t.to}
              aria-current={section === t.key ? 'page' : undefined}
              className={clsx(
                'tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-sm font-bold inline-flex items-center border transition-colors',
                section === t.key
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                  : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Content Column */}
          <div className="lg:col-span-7 space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-xs font-bold text-[var(--tkv-sage-ink,#134C39)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#196149)]" aria-hidden="true" />
              <span>{l('Cam kết minh bạch & Bảo vệ dữ liệu hộ gia đình', 'Transparency & Household Data Protection')}</span>
            </span>

            <h1 id="tkv-m12-h1" className="tkv-heading text-3xl sm:text-[2.5rem] font-extrabold text-[var(--tkv-ink,#152E2C)] leading-tight">
              {activeTitle}
            </h1>

            <p className="text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
              {l(
                'Thông tin về sản phẩm, hướng dẫn hỗ trợ và chính sách bảo vệ dữ liệu căn bếp gia đình.',
                'Product information, self-service support guidance, and household kitchen data protection policies.',
              )}
            </p>

            {section === 'about' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <div className="flex items-center gap-4">
                  <MascotIllustration pose="welcome" size={64} className="shrink-0 border border-[var(--tkv-border)] bg-[var(--tkv-bg)]" />
                  <div className="min-w-0">
                    <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                      {l('Triết lý Bữa ngon, nhẹ đầu của Takolio', 'Takolio’s "Good meals, light mind." philosophy')}
                    </h2>
                    <p className="text-sm">
                      {l(
                        'Ăn đủ. Mua đủ. Dùng hết — giảm lãng phí thực phẩm, bớt áp lực nghĩ món mỗi chiều.',
                        'Eat enough. Buy enough. Use it all — cut food waste and take the stress out of daily meal decisions.',
                      )}
                    </p>
                  </div>
                </div>
                <p>
                  {l(
                    'Takolio được thiết kế cho nhịp sống gia đình Việt hiện đại: kết nối trực tiếp những nguyên liệu đang nằm trong tủ lạnh với kho công thức quen thuộc, lịch ăn 7 ngày và danh sách đi chợ ròng.',
                    'Takolio is built for modern family life: connecting the ingredients already inside your fridge directly to everyday recipes, 7-day meal plans, and net shopping lists.',
                  )}
                </p>
                <p>
                  {l(
                    'Mọi tính năng đều đặt sự trung thực dữ liệu lên hàng đầu: phân biệt rõ hạn dùng ước tính và hạn in trên bao bì, yêu cầu người dùng duyệt kết quả AI trước khi lưu, và cô lập tuyệt đối dữ liệu giữa các hộ gia đình.',
                    'Every feature puts data honesty first: clearly separating printed expiry dates from freshness estimates, requiring user approval before saving AI results, and strictly isolating data between households.',
                  )}
                </p>
              </div>
            )}

            {section === 'privacy' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {l('Tóm tắt kỹ thuật bảo vệ dữ liệu hiện hành trên hệ thống', 'Active technical data protection summary')}
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Cô lập theo hộ gia đình:', 'Household isolation:')}</strong>{' '}
                    {l(
                      'Tồn kho, lịch tuần, giỏ mua sắm và ảnh quét đều được kiểm tra quyền sở hữu theo ',
                      'Inventory, weekly plans, shopping lists, and scan photos all enforce ownership checks by ',
                    )}
                    <code>household_id</code>
                    {l(' ở tầng máy chủ.', ' on the server.')}
                  </li>
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Phiên đăng nhập an toàn:', 'Secure sessions:')}</strong>{' '}
                    {l('Xác thực bằng cookie ', 'Authentication uses ')}
                    <code>HttpOnly</code>
                    {l(
                      '; khi đăng xuất hoặc đổi tài khoản, bộ nhớ tạm trên trình duyệt được dọn sạch.',
                      ' cookies; signing out or switching accounts wipes cached session data from the browser.',
                    )}
                  </li>
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Ảnh quét AI:', 'AI scan images:')}</strong>{' '}
                    {l(
                      'Chỉ gửi xử lý khi bạn chủ động bấm chụp/tải lên và không tự động nhập kho nếu chưa xác nhận.',
                      'Processed only when you actively capture or upload a photo, and never saved to inventory without your confirmation.',
                    )}
                  </li>
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Quyền xuất & xóa dữ liệu:', 'Data export & deletion rights:')}</strong>{' '}
                    {l(
                      'Người dùng có thể quản lý phiên, xóa bộ nhớ đệm cục bộ và gửi yêu cầu hỗ trợ tài khoản minh bạch trong phần Quyền riêng tư.',
                      'You can manage active sessions, clear local cache, and submit transparent account data requests inside Privacy Settings.',
                    )}
                  </li>
                </ul>
              </div>
            )}

            {section === 'terms' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {l('Nguyên tắc sử dụng dịch vụ', 'Service usage principles')}
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Kiểm tra an toàn thực phẩm:', 'Food safety checks:')}</strong>{' '}
                    {l(
                      'Nhãn hạn dùng ước tính và gợi ý AI chỉ mang tính hỗ trợ quản lý; người dùng luôn kiểm tra thực tế tình trạng thực phẩm và dị ứng của gia đình trước khi chế biến.',
                      'Estimated expiry labels and AI suggestions are planning aids only; always inspect actual food freshness and check household allergens before cooking.',
                    )}
                  </li>
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Định lượng & dinh dưỡng:', 'Portions & nutrition:')}</strong>{' '}
                    {l(
                      'Chỉ các công thức có nguồn dinh dưỡng xác minh mới hiển thị chỉ số macro; ứng dụng không thay thế tư vấn y khoa.',
                      'Only recipes with verified nutrition sources display macro data; this app does not replace medical or dietary advice.',
                    )}
                  </li>
                  <li>
                    <strong className="text-[var(--tkv-ink,#152E2C)]">{l('Gói Takolio Pro:', 'Takolio Pro plans:')}</strong>{' '}
                    {l(
                      'Quyền lợi và giao dịch thanh toán tuân theo thông tin chính thức tại màn hình ',
                      'Entitlements and billing transactions follow authoritative details displayed on the ',
                    )}
                    <code>/plus</code>
                    {l(' khi đăng nhập.', ' screen when signed in.')}
                  </li>
                </ul>
              </div>
            )}

            {section === 'contact' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-3 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {l('Nguyên tắc hỗ trợ minh bạch', 'Transparent support policy')}
                </h2>
                <p>
                  {l(
                    'Cổng gửi yêu cầu trực tiếp trên web công khai chưa bật trong phiên bản hiện hành. Thay vì hiển thị biểu mẫu giả lập báo gửi thành công, Takolio cung cấp danh mục tự kiểm tra trạng thái phiên, đối soát thanh toán và hướng dẫn xử lý sự cố ngay bên cạnh.',
                    'Public web ticket submission is not enabled in this release. Rather than showing a fake contact form that pretends to submit, Takolio provides live self-service session checks, billing reconciliation steps, and troubleshooting guides right beside this panel.',
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Right Structured Support & Feedback Guide (replaces fake copy-paste <pre>) */}
          <div className="lg:col-span-5">
            <div className="rounded-[24px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 sm:p-7 space-y-5 shadow-xs">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-[var(--tkv-ink-muted,#52706A)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                  <span>{l('Hướng dẫn hỗ trợ & phản hồi', 'Support & feedback guide')}</span>
                </span>
                <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {l('Trung tâm hỗ trợ tự phục vụ', 'Self-service support center')}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                  {l(
                    'Tra cứu nhanh cách xử lý các tình huống thường gặp về tài khoản, bản quét AI và giao dịch Takolio Pro.',
                    'Quickly look up answers for common account, AI scan, and Takolio Pro billing questions.',
                  )}
                </p>
              </div>

              <ol className="space-y-3 text-xs sm:text-sm">
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">01.</span>
                    {l('Đối soát giao dịch Takolio Pro', 'Reconcile Takolio Pro payments')}
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    {l('Đăng nhập và mở mục ', 'Sign in and open ')}
                    <strong>Takolio Pro (/plus)</strong>
                    {l(
                      ' để xem trạng thái lệnh VietQR trực tiếp từ máy chủ hoặc mở lại lệnh đang chờ mà không cần chuyển khoản lại.',
                      ' to inspect live server-verified VietQR or global payment statuses, or resume pending checkouts without paying twice.',
                    )}
                  </p>
                </li>
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">02.</span>
                    {l('Kiểm tra đồng bộ & phiên bản ứng dụng', 'Check sync status & app version')}
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    {l('Tại ', 'In ')}
                    <strong>{l('Cài đặt ứng dụng', 'App Settings')}</strong>
                    {l(' và ', ' and ')}
                    <strong>{l('Quyền riêng tư', 'Privacy')}</strong>
                    {l(
                      ', bạn có thể kiểm tra số thao tác ngoại tuyến đang chờ đồng bộ, mã phiên bản build và làm mới bộ nhớ đệm an toàn.',
                      ', you can inspect pending offline operations, check the build version, and safely refresh local cache.',
                    )}
                  </p>
                </li>
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">03.</span>
                    {l('Bảo mật thông tin khi gửi phản hồi', 'Protect sensitive info when requesting help')}
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    {l('Chỉ đính kèm mã hỗ trợ bản quét (', 'Share only your scan support ID (')}
                    <code>supportId</code>
                    {l(
                      ') hoặc 4 số cuối mã đơn thanh toán — không bao giờ chia sẻ mật khẩu hoặc mã OTP 6 chữ số.',
                      ') or the last 4 digits of an order ID — never share your password or 6-digit OTP codes.',
                    )}
                  </p>
                </li>
              </ol>

              <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Link
                  to="/faq"
                  className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--tkv-primary,#196149)] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[var(--tkv-primary-hover,#134C39)] shadow-xs transition-colors"
                >
                  <span>{l('Tra cứu FAQ', 'Browse FAQ')}</span>
                  <VNextIcon name="arrow-right" size={15} />
                </Link>
                {isSatelliteComRuntime() ? (
                  <a
                    href={resolveAppSurfaceHref('/auth?mode=login')}
                    className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] text-xs sm:text-sm font-bold inline-flex items-center justify-center hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
                  >
                    {l('Đăng nhập kiểm tra phiên', 'Sign in to check session')}
                  </a>
                ) : (
                  <Link
                    to={vnextHref('/auth?mode=login')}
                    className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] text-xs sm:text-sm font-bold inline-flex items-center justify-center hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
                  >
                    {l('Đăng nhập kiểm tra phiên', 'Sign in to check session')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicMarketingShell>
  );
};
