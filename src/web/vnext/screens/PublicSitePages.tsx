import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
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

const FEATURE_SUBNAV: Array<{ id: string; label: string; to: string }> = [
  { id: 'M02', label: 'Cách hoạt động', to: '/how-it-works' },
  { id: 'M03', label: 'AI Scan', to: '/features/ai-scan' },
  { id: 'M04', label: 'Tủ lạnh', to: '/features/fridge' },
  { id: 'M05', label: 'Thực đơn tuần', to: '/features/meal-planning' },
  { id: 'M06', label: 'Kho công thức', to: '/features/recipes' },
  { id: 'M07', label: 'Nấu từng bước', to: '/features/cooking' },
  { id: 'M08', label: 'Đi chợ', to: '/features/shopping' },
];

const FeatureSubnavBar: React.FC<{ activeId: string }> = ({ activeId }) => (
  <nav
    aria-label="Điều hướng chi tiết tính năng"
    className="max-w-[1200px] mx-auto pt-4 overflow-x-auto no-scrollbar"
  >
    <ul className="inline-flex items-center gap-2 px-4 sm:px-6 pb-1">
      {FEATURE_SUBNAV.map((item) => {
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

const FEATURE_STORIES: Record<FeatureStorySpec['screenId'], FeatureStorySpec> = {
  M02: {
    screenId: 'M02',
    canonicalPath: '/how-it-works',
    eyebrow: 'Vòng lặp căn bếp khép kín',
    title: 'Takolio hoạt động thế nào',
    subtitle: 'Từ những gì có sẵn trong tủ đến bữa ăn hoàn chỉnh.',
    ctaLabel: 'Khám phá Takolio',
    ctaHref: '/auth?mode=register',
    imageSrc: '/takolio/vnext/marketing/m02-closed-loop-kitchen.webp',
    imageSrc640: '/takolio/vnext/marketing/m02-closed-loop-kitchen-640w.webp',
    imageAlt: 'Bàn bếp sáng thoáng với nguyên liệu sơ chế gốm sứ chuẩn bị cho vòng lặp nấu ăn khép kín',
    truthBadge: 'Kiểm soát thủ công ở mọi điểm ghi kho',
    truthNote: 'Không tự động trừ kho hay lưu kết quả AI khi chưa có xác nhận trực tiếp từ bạn.',
    bullets: [
      {
        icon: 'fridge',
        title: 'Kiểm tra tủ lạnh',
        detail: 'Ghi nhận lô nguyên liệu theo ngăn bảo quản, số lượng, đơn vị đo và nhãn hạn dùng rõ ràng.',
      },
      {
        icon: 'calendar',
        title: 'Lên thực đơn',
        detail: 'Chọn món hoặc tạo lịch 7 ngày dựa trên định lượng thực tế và khẩu phần hộ gia đình.',
      },
      {
        icon: 'shopping',
        title: 'Đi chợ đúng nhu cầu',
        detail: 'Tự tính phần còn thiếu sau khi đối chiếu tồn kho để tránh mua trùng hoặc bỏ quên.',
      },
    ],
    deepDiveTitle: 'Bốn mắt xích liên kết chặt chẽ trong căn bếp',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Nhập kho minh bạch (C03 · C12)',
        body: 'Thêm tay hoặc chụp ảnh tủ lạnh/hóa đơn — mọi dòng nhận diện đều đi qua màn hình duyệt trước khi cập nhật.',
      },
      {
        code: '02',
        heading: 'Đối chiếu công thức theo đơn vị (C18 · C19)',
        body: 'Hệ thống so sánh gram, ml, quả/cái thay vì chỉ khớp tên, báo rõ trường hợp lệch đơn vị đo.',
      },
      {
        code: '03',
        heading: 'Lập lịch tuần & đi chợ ròng (C23 · C27 · C29)',
        body: 'Tổng hợp nhu cầu cả tuần, hỗ trợ đánh dấu ngoại tuyến và nhập kho sau đi chợ không nhân đôi.',
      },
      {
        code: '04',
        heading: 'Đứng bếp & xác nhận tiêu thụ (C21 · C22)',
        body: 'Hướng dẫn từng bước kèm bộ đếm giờ; chỉ trừ tồn kho đúng một lần khi bạn bấm hoàn tất bữa ăn.',
      },
    ],
  },
  M03: {
    screenId: 'M03',
    canonicalPath: '/features/ai-scan',
    eyebrow: 'Nhận diện có kiểm duyệt',
    title: 'AI Scan nguyên liệu',
    subtitle: 'Chụp ảnh rồi kiểm tra từng nguyên liệu trước khi lưu.',
    ctaLabel: 'Thử quét nguyên liệu',
    ctaHref: '/auth?mode=login&returnTo=%2Fscan',
    imageSrc: '/takolio/vnext/marketing/m03-fresh-produce-scan.webp',
    imageSrc640: '/takolio/vnext/marketing/m03-fresh-produce-scan-640w.webp',
    imageAlt: 'Rau củ trứng tươi đặt trên mặt bàn bếp chuẩn bị quét nhận diện nguyên liệu',
    truthBadge: 'Review-before-save bắt buộc',
    truthNote: 'AI có thể nhầm nhãn hoặc định lượng; Takolio không bao giờ tự ghi thẳng vào tủ lạnh khi bạn chưa duyệt.',
    bullets: [
      {
        icon: 'scan',
        title: 'Chụp ảnh thực phẩm',
        detail: 'Hỗ trợ mở camera trực tiếp hoặc chọn ảnh từ máy, kèm chế độ nhập tay ngay khi từ chối quyền camera.',
      },
      {
        icon: 'sparkles',
        title: 'AI gợi ý nhận diện',
        detail: 'Hiển thị tiến trình xử lý, mức độ tin cậy từng dòng và cảnh báo rõ các mục cần kiểm tra kỹ.',
      },
      {
        icon: 'check',
        title: 'Bạn xác nhận kết quả',
        detail: 'Chỉnh sửa tên, số lượng, đơn vị, ngăn bảo quản hoặc bỏ qua dòng sai trước khi xác nhận nhập kho.',
      },
    ],
    deepDiveTitle: 'Nguyên tắc an toàn ảnh chụp & hóa đơn (C09–C14)',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Ảnh riêng tư theo phiên hộ gia đình',
        body: 'Ảnh quét chỉ gắn với hộ gia đình của bạn, không chia sẻ chéo giữa các tài khoản hay bộ nhớ đệm.',
      },
      {
        code: '02',
        heading: 'Giữ nguyên bằng chứng OCR gốc trên hóa đơn',
        body: 'Khi duyệt hóa đơn siêu thị (C14), hệ thống giữ đối chiếu dòng OCR gốc và không tự bịa giá tiền thiếu.',
      },
      {
        code: '03',
        heading: 'Chống gửi trùng khi mạng chập chờn',
        body: 'Khóa xác nhận idempotent đảm bảo bấm lại khi mạng chậm không tạo hai lô nguyên liệu trùng nhau.',
      },
    ],
  },
  M04: {
    screenId: 'M04',
    canonicalPath: '/features/fridge',
    eyebrow: 'Quản lý tồn kho theo lô',
    title: 'Tủ lạnh thông minh',
    subtitle: 'Biết nhà còn gì, sắp hết hạn gì và cần dùng gì trước.',
    ctaLabel: 'Mở tủ lạnh thông minh',
    ctaHref: '/auth?mode=login&returnTo=%2Ffridge',
    imageSrc: '/takolio/vnext/marketing/m04-smart-fridge.webp',
    imageSrc640: '/takolio/vnext/marketing/m04-smart-fridge-640w.webp',
    imageAlt: 'Ngăn tủ lạnh gia đình sắp xếp gọn nguyên liệu rau củ trứng đậu phụ trong hộp thủy tinh',
    truthBadge: 'Phân biệt hạn in trên bao bì & hạn ước tính',
    truthNote: 'Các mốc +3/+5/+7 ngày luôn được gắn nhãn “Ước tính” để bạn chủ động kiểm tra cảm quan thực phẩm.',
    bullets: [
      {
        icon: 'fridge',
        title: 'Phân loại nguyên liệu',
        detail: 'Quản lý rõ ngăn mát, ngăn đông và tủ khô cùng bộ lọc nhóm thực phẩm đồng bộ qua địa chỉ trang.',
      },
      {
        icon: 'timer',
        title: 'Theo dõi hạn dùng',
        detail: 'Ưu tiên nguyên liệu nên dùng sớm (FEFO) để giảm lãng phí bữa ăn hằng ngày.',
      },
      {
        icon: 'refresh',
        title: 'Cập nhật lượng thực tế',
        detail: 'Kiểm soát phiên bản dữ liệu (If-Match) giúp hai thiết bị trong nhà không ghi đè nhầm số lượng của nhau.',
      },
    ],
    deepDiveTitle: 'Trạng thái trung thực cho từng lô thực phẩm (C03–C08)',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Tách biệt tủ trống và bộ lọc không khớp',
        body: 'Khi tìm kiếm không có kết quả, ứng dụng đề xuất xóa bộ lọc thay vì báo nhầm tủ lạnh đang trống.',
      },
      {
        code: '02',
        heading: 'Ghi nhận thời điểm mở nắp & nguồn nhập',
        body: 'Chi tiết lô nguyên liệu (C06) hiển thị rõ nguồn thêm tay, quét tủ hay nhập từ hóa đơn.',
      },
      {
        code: '03',
        heading: 'Đối soát tồn kho định kỳ (C08)',
        body: 'Rà soát nhanh các lô lâu chưa cập nhật để tồn kho luôn sát với căn bếp thật.',
      },
    ],
  },
  M05: {
    screenId: 'M05',
    canonicalPath: '/features/meal-planning',
    eyebrow: 'Chủ động bữa cơm cả tuần',
    title: 'Lên thực đơn tuần',
    subtitle: 'Chủ động kế hoạch bữa ăn, khẩu phần và phần còn thiếu.',
    ctaLabel: 'Lập thực đơn tuần',
    ctaHref: '/auth?mode=login&returnTo=%2Fplanner',
    imageSrc: '/takolio/vnext/marketing/m05-meal-planning-prep.webp',
    imageSrc640: '/takolio/vnext/marketing/m05-meal-planning-prep-640w.webp',
    imageAlt: 'Bàn gỗ sơ chế nguyên liệu theo khẩu phần tuần cho gia đình Việt',
    truthBadge: 'Tính toán định lượng tất định trên máy chủ',
    truthNote: 'Định lượng nguyên liệu và danh sách mua ròng được tính bằng công thức toán học chính xác, không dùng AI suy đoán.',
    bullets: [
      {
        icon: 'calendar',
        title: 'Lịch ăn 7 ngày',
        detail: 'Xem trọn lịch bữa sáng, trưa, tối trên bảng làm việc máy tính hoặc thẻ ngày gọn gàng trên điện thoại.',
      },
      {
        icon: 'swap',
        title: 'Đổi món dễ dàng',
        detail: 'Xem trước thay đổi nguyên liệu trước khi áp dụng đổi món vào lịch tuần hiện tại.',
      },
      {
        icon: 'shopping',
        title: 'Tính nguyên liệu cần mua',
        detail: 'Tự động gom nhu cầu nguyên liệu cả tuần và trừ đi lượng đang có trong tủ lạnh.',
      },
    ],
    deepDiveTitle: 'Thiết kế cho nhịp sinh hoạt thật của gia đình (C23–C26)',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Tùy chỉnh ngày nấu và thời gian tối đa',
        body: 'Chọn đúng những bữa gia đình thực sự nấu tại nhà và giới hạn số phút đứng bếp ngày thường.',
      },
      {
        code: '02',
        heading: 'Lưu trữ gắn với tài khoản hộ gia đình',
        body: 'Thực đơn tuần được đồng bộ theo phiên bản (revision) để luôn nhất quán khi mở lại trên thiết bị khác.',
      },
      {
        code: '03',
        heading: 'Tương thích mượt với luồng đi chợ tuần',
        body: 'Chuyển thẳng từ lịch tuần sang danh sách mua sắm ròng chỉ bằng một thao tác.',
      },
    ],
  },
  M06: {
    screenId: 'M06',
    canonicalPath: '/features/recipes',
    eyebrow: 'Ẩm thực gia đình gần gũi',
    title: 'Kho công thức',
    subtitle: 'Tìm món theo nguyên liệu sẵn có và thời gian nấu.',
    ctaLabel: 'Khám phá kho món ăn',
    ctaHref: '/auth?mode=login&returnTo=%2Frecipes',
    imageSrc: '/takolio/vnext/marketing/m06-vietnamese-recipes.webp',
    imageSrc640: '/takolio/vnext/marketing/m06-vietnamese-recipes-640w.webp',
    imageAlt: 'Mâm cơm gia đình Việt với thịt kho trứng nước dừa, canh chua và rau xanh trên bát đĩa gốm sứ',
    truthBadge: 'Ảnh món ăn khớp đúng công thức xác minh',
    truthNote: 'Mỗi ảnh món ăn đều khớp nguyên liệu của đúng công thức đó; món chưa có ảnh xác minh sẽ hiển thị biểu tượng trung thực.',
    bullets: [
      {
        icon: 'recipes',
        title: 'Món ăn gia đình',
        detail: 'Tuyển chọn các món kho, canh, xào, bún phở quen thuộc với định lượng rõ ràng cho bữa cơm Việt.',
      },
      {
        icon: 'check',
        title: 'Công thức nhiều bước',
        detail: 'Trình bày mạch lạc từng bước sơ chế, ướp và nấu kèm thời gian dự kiến cụ thể.',
      },
      {
        icon: 'filter',
        title: 'Bộ lọc theo sở thích',
        detail: 'Lọc theo nhóm món, vùng miền, thời gian nấu tối đa hoặc ưu tiên món nấu ngay không cần mua thêm.',
      },
    ],
    deepDiveTitle: 'Món ngon gia đình tiêu biểu trong kho công thức',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Thay đổi khẩu phần linh hoạt (1–20 người)',
        body: 'Tăng giảm số người ăn trên trang chi tiết món (C18) để hệ thống nhân chia lại toàn bộ nguyên liệu tức thì.',
      },
      {
        code: '02',
        heading: 'Bổ sung phần thiếu vào giỏ đi chợ',
        body: 'Chỉ thêm đúng lượng nguyên liệu còn thiếu vào danh sách mua hàng ngay từ màn hình công thức.',
      },
      {
        code: '03',
        heading: 'Lưu món yêu thích theo tài khoản',
        body: 'Đánh dấu các món hợp khẩu vị gia đình để tìm lại nhanh mỗi tuần (C17).',
      },
    ],
  },
  M07: {
    screenId: 'M07',
    canonicalPath: '/features/cooking',
    eyebrow: 'Không gian đứng bếp tập trung',
    title: 'Nấu ăn từng bước',
    subtitle: 'Tập trung vào món ăn với timer và hướng dẫn rõ ràng.',
    ctaLabel: 'Trải nghiệm chế độ nấu',
    ctaHref: '/auth?mode=login&returnTo=%2Frecipes%2Fthit-kho-trung',
    imageSrc: '/takolio/vnext/marketing/m07-guided-cooking.webp',
    imageSrc640: '/takolio/vnext/marketing/m07-guided-cooking-640w.webp',
    imageAlt: 'Nồi gang ninh món ăn trên bếp sạch sẽ cùng sả gừng hành lá',
    truthBadge: 'Chỉ trừ kho khi bạn xác nhận hoàn thành',
    truthNote: 'Mở màn chuẩn bị nấu hoặc thoát giữa chừng sẽ không bao giờ tự ý trừ nguyên liệu trong tủ lạnh.',
    bullets: [
      {
        icon: 'check',
        title: 'Chuẩn bị nguyên liệu',
        detail: 'Rà soát toàn bộ nguyên liệu và dụng cụ cần thiết ở bước chuẩn bị (C20) trước khi bật bếp.',
      },
      {
        icon: 'timer',
        title: 'Nấu theo từng bước',
        detail: 'Không gian bàn bếp sáng thoáng chữ lớn dễ đọc từ xa, bộ hẹn giờ vòng tròn gắn theo từng công đoạn và tùy chọn đọc giọng nói.',
      },
      {
        icon: 'sparkles',
        title: 'Xác nhận hoàn thành',
        detail: 'Xem lại lượng thực tế đã dùng ở bước kết thúc (C22) để cập nhật tồn kho chính xác, chống trừ kép.',
      },
    ],
    deepDiveTitle: 'Tối ưu cho thao tác thực tế cạnh bếp lửa (C20–C22)',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Loại bỏ thanh điều hướng gây xao nhãng',
        body: 'Chế độ đứng bếp ẩn các menu phụ để toàn bộ màn hình dành cho bước hiện tại và nút chuyển bước lớn.',
      },
      {
        code: '02',
        heading: 'Giữ màn hình sáng an toàn (Wake Lock)',
        body: 'Hỗ trợ giữ sáng màn hình trên trình duyệt tương thích để bạn không phải chạm tay ướt mở khóa liên tục.',
      },
      {
        code: '03',
        heading: 'Khôi phục tiến độ khi tải lại trang',
        body: 'Trạng thái bước đang nấu và hẹn giờ được bảo toàn để không mất mạch nấu ăn.',
      },
    ],
  },
  M08: {
    screenId: 'M08',
    canonicalPath: '/features/shopping',
    eyebrow: 'Đi chợ gọn gàng, không mua thừa',
    title: 'Danh sách đi chợ',
    subtitle: 'Chỉ mua đúng phần còn thiếu sau khi kiểm tra tồn kho.',
    ctaLabel: 'Mở danh sách đi chợ',
    ctaHref: '/auth?mode=login&returnTo=%2Fshopping',
    imageSrc: '/takolio/vnext/marketing/m08-smart-shopping-basket.webp',
    imageSrc640: '/takolio/vnext/marketing/m08-smart-shopping-basket-640w.webp',
    imageAlt: 'Giỏ mây đi chợ đầy rau muống cà chua trứng gà chanh gừng tươi',
    truthBadge: 'Hỗ trợ ngoại tuyến & chống nhập kho trùng',
    truthNote: 'Takolio không tự đặt hàng qua bên thứ ba; bạn hoàn toàn chủ động nơi mua và xác nhận khi cất đồ vào tủ.',
    bullets: [
      {
        icon: 'shopping',
        title: 'Nhóm theo khu vực mua',
        detail: 'Sắp xếp mục cần mua theo quầy kệ và chế độ đi chợ nhanh một tay để đi siêu thị hoặc chợ thuận tiện.',
      },
      {
        icon: 'check',
        title: 'Đánh dấu đã mua',
        detail: 'Hoạt động mượt ngay cả khi sóng yếu ở tầng hầm siêu thị với hàng đợi đồng bộ ngoại tuyến minh bạch.',
      },
      {
        icon: 'fridge',
        title: 'Nhập kho có xác nhận',
        detail: 'Chuyển các mục đã mua vào tủ lạnh thông qua quy trình duyệt nhập kho, ngăn chặn nhân đôi số lượng.',
      },
    ],
    deepDiveTitle: 'Khép kín chu trình từ chợ về tủ lạnh (C27–C29)',
    deepDiveSteps: [
      {
        code: '01',
        heading: 'Gắn nguồn gốc món ăn cho từng mục mua',
        body: 'Biết rõ nguyên liệu này phục vụ món nào trong thực đơn tuần hoặc được thêm thủ công.',
      },
      {
        code: '02',
        heading: 'Hiển thị rõ trạng thái chờ đồng bộ (pendingSync)',
        body: 'Không bao giờ báo đã lưu máy chủ khi thiết bị đang ngoại tuyến — hiển thị số thao tác chờ gửi rõ ràng.',
      },
      {
        code: '03',
        heading: 'Duyệt nhập kho sau buổi chợ (C29)',
        body: 'Kiểm tra lại khối lượng thực mua và ngăn bảo quản trước khi chính thức cộng vào tủ lạnh.',
      },
    ],
  },
};

const SHOWCASE_RECIPES = [
  { slug: 'thit-kho-trung', title: 'Thịt kho tàu nước dừa trứng béo ngậy', meta: '45 phút · 4 người' },
  { slug: 'canh-chua-ca-loc-nam-bo', title: 'Canh chua cá lóc Nam Bộ', meta: '25 phút · 4 người' },
  { slug: 'bun-cha-ha-noi-than-hoa', title: 'Bún chả nướng than hoa Hà Nội', meta: '40 phút · 4 người' },
  { slug: 'sup-ga-ngo-non-nam-huong', title: 'Súp gà ngô non nấm hương trứng hoa', meta: '18 phút · 4 người' },
  { slug: 'goi-ga-xe-phay-bap-cai', title: 'Gỏi gà xé phay bắp cải hành tây', meta: '25 phút · 4 người' },
  { slug: 'dau-phu-sot-ca-chua', title: 'Đậu phụ lướt ván sốt cà chua', meta: '20 phút · 3 người' },
] as const;

const FeatureStoryLayout: React.FC<{ spec: FeatureStorySpec }> = ({ spec }) => {
  const navigate = useNavigate();
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
                Một số món ăn xác minh nguyên liệu trong kho công thức
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SHOWCASE_RECIPES.map((r) => (
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

export const M02HowItWorksPage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M02} />;
export const M03AiScanFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M03} />;
export const M04FridgeFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M04} />;
export const M05MealPlanningFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M05} />;
export const M06RecipesFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M06} />;
export const M07CookingFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M07} />;
export const M08ShoppingFeaturePage: React.FC = () => <FeatureStoryLayout spec={FEATURE_STORIES.M08} />;

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

const M09_MINI_FAQ = [
  {
    q: 'Tôi có thể thanh toán bằng hình thức nào?',
    a: 'Tại Việt Nam bạn quét VietQR tức thì (không tự động trừ tiền). Ở Nhật Bản, Châu Âu và quốc tế bạn thanh toán bằng thẻ Visa/Mastercard/JCB, Apple Pay, Google Pay, SEPA hoặc Amazon Pay qua Dodo Payments.',
  },
  {
    q: 'Có tự động gia hạn ẩn khi dùng gói Miễn phí không?',
    a: 'Không. Gói Miễn phí không yêu cầu thẻ hay tài khoản ngân hàng. Với gói Pro quốc tế, bạn có thể dừng gia hạn bất cứ lúc nào ngay trong trang /plus hoặc Dodo Customer Portal.',
  },
  {
    q: 'Đổi điện thoại có bị mất gói Pro không?',
    a: 'Không. Quyền lợi Takolio Pro gắn liền với tài khoản đã xác thực của bạn và tự động đồng bộ trên mọi thiết bị.',
  },
] as const;

/**
 * M09 — Các gói Takolio (`/pricing`).
 * Calm Kitchen Commerce unified pricing page matching `takolio.com/pricing` & `/plus` 1:1,
 * with billing cycle switcher, live regional currencies, and deep-linked handoff into `/plus`.
 */
export const M09PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, householdId, isGuest } = useAuthStore();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [selectedCurrency, setSelectedCurrency] = useState<GlobalDisplayCurrency>('VND');

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
        { name: 'Các gói Takolio', path: '/pricing' },
      ]),
      buildPricingJsonLd(livePlans),
    ],
    [livePlans],
  );

  useVNextSeo({
    title: 'Các gói Takolio',
    description: 'Lựa chọn gói Miễn phí hoặc Takolio Pro phù hợp nhu cầu căn bếp gia đình.',
    canonicalPath: '/pricing',
    domainSurface: 'marketing',
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

  return (
    <PublicMarketingShell screenId="M09">
      <section aria-labelledby="tkv-m09-h1" className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-9">
        {/* Centered Calm Kitchen Editorial Header */}
        <header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)]" aria-hidden="true" />
            <span>Biểu phí minh bạch · Việt Nam & Quốc tế</span>
          </span>
          <h1 id="tkv-m09-h1" className="tkv-heading text-3xl sm:text-[2.75rem] font-black text-[var(--tkv-ink)] leading-tight">
            Các gói Takolio
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">
            Bắt đầu miễn phí trọn đời, nâng cấp Takolio Pro bất cứ khi nào căn bếp cần thêm trợ lực AI.
          </p>
        </header>

        {/* Tactile Billing Cycle Toggle + Currency Pill Selector */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-3 sm:px-5 shadow-[var(--tkv-shadow-card)]">
          <div
            role="group"
            aria-label="Chu kỳ thanh toán"
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
              <span>Gói 1 năm</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-black',
                  billingCycle === 'annual'
                    ? 'bg-[var(--tkv-saffron)] text-[var(--tkv-ink)]'
                    : 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)]',
                )}
              >
                Tiết kiệm 17%
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
              Gói 1 tháng
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Tiền tệ hiển thị">
            {M09_CURRENCIES.map((code) => {
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
                Cơ bản cho mọi gia đình
              </span>
              <div className="space-y-1">
                <h2 className="tkv-heading text-2xl sm:text-3xl font-black text-[var(--tkv-ink)]">
                  Miễn phí
                </h2>
                <p className="tkv-heading tabular-nums text-3xl sm:text-4xl font-black text-[var(--tkv-ink)] pt-1">
                  0 <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">/ trọn đời cơ bản</span>
                </p>
              </div>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                Bắt đầu ngay không cần thẻ thanh toán — đầy đủ vòng lặp quản lý tủ lạnh, công thức và đi chợ cốt lõi.
              </p>
              <ul className="space-y-3 pt-1 text-sm text-[var(--tkv-ink)]">
                {[
                  'Quản lý tồn kho tủ lạnh theo lô và cảnh báo hạn dùng',
                  'Tra cứu kho công thức & chế độ nấu từng bước có timer',
                  'Danh sách đi chợ đồng bộ ngoại tuyến và đối chiếu định lượng',
                ].map((item) => (
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
              {isStarting ? 'Đang mở…' : 'Bắt đầu miễn phí'}
            </button>
          </div>

          {/* Takolio Pro Tier */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[var(--tkv-surface)] via-[var(--tkv-bg)] to-[var(--tkv-surface-mint)] text-[var(--tkv-ink)] border-2 border-[var(--tkv-primary)] p-6 sm:p-8 flex flex-col justify-between gap-7 shadow-[var(--tkv-shadow-elevated)]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border border-[var(--tkv-border-saffron)]">
                    <VNextIcon name="crown" size={13} />
                    <span>Phổ biến cho căn bếp bận rộn</span>
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
                      / {billingCycle === 'annual' ? 'năm' : 'tháng'}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <span className="rounded-full bg-[var(--tkv-surface-mint)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums">
                      ~{monthlyEquivFormatted}/tháng
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--tkv-ink-secondary)] leading-relaxed">
                  {currentTier.currency === 'VND'
                    ? 'Thanh toán VietQR tức thì · Không tự động trừ tiền.'
                    : 'Thanh toán quốc tế qua Thẻ, Apple Pay, Google Pay, SEPA · Đã gồm thuế (Dodo Payments).'}
                </p>
              </div>

              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                Mở rộng toàn bộ sức mạnh AI quét tủ lạnh, lập thực đơn tuần tự động và 500+ công thức chuẩn hoá.
              </p>
              <ul className="space-y-3 text-sm text-[var(--tkv-ink)]">
                {[
                  'AI nhận diện hoá đơn & nguyên liệu tủ lạnh không giới hạn (có duyệt trước khi lưu)',
                  'Lập thực đơn tuần chuyên sâu & tối ưu danh sách đi chợ theo lịch',
                  '500+ công thức chuẩn hoá kèm dinh dưỡng & trợ lý giọng nói rảnh tay',
                  'Thanh toán linh hoạt: VietQR (Việt Nam) hoặc Thẻ / Apple Pay (Quốc tế)',
                ].map((item) => (
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
              Chọn Takolio Pro
            </button>
          </div>
        </div>

        {/* Calm Billing Reassurance Mini-FAQ */}
        <div className="rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 sm:p-6 space-y-3 shadow-[var(--tkv-shadow-card)]">
          <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
            Câu hỏi thường gặp về thanh toán
          </h2>
          <div className="divide-y divide-[var(--tkv-border)]">
            {M09_MINI_FAQ.map((item) => (
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
            <strong className="text-[var(--tkv-ink)]">Nguyên tắc minh bạch thương mại:</strong>{' '}
            Biểu phí hiển thị trên trang này luôn đồng bộ trực tiếp từ hệ thống thanh toán chính thức và không bao giờ hiển thị giá ước đoán.
          </p>
        </div>
      </section>
    </PublicMarketingShell>
  );
};

const FAQ_ITEMS = [
  {
    id: 'faq-free',
    q: 'Takolio có miễn phí không?',
    a: 'Có. Bạn có thể sử dụng miễn phí các tính năng cốt lõi gồm quản lý tủ lạnh theo lô, tra cứu kho công thức món ăn gia đình, chế độ nấu từng bước có hẹn giờ và danh sách đi chợ. Gói Takolio Pro là tùy chọn mở rộng hạn mức AI Scan và tiện ích lập kế hoạch nâng cao.',
  },
  {
    id: 'faq-ai',
    q: 'AI nhận diện có chính xác tuyệt đối không?',
    a: 'Không. Hình ảnh thực tế trong tủ lạnh hoặc hóa đơn có thể bị mờ, khuất góc hoặc thiếu hạn sử dụng. Vì vậy Takolio áp dụng nguyên tắc bắt buộc “duyệt trước khi lưu”: AI chỉ đề xuất danh sách nháp, còn bạn là người kiểm tra và xác nhận cuối cùng.',
  },
  {
    id: 'faq-guest',
    q: 'Có cần đăng ký để dùng thử?',
    a: 'Bạn có thể bấm “Bắt đầu miễn phí” để khởi tạo phiên dùng thử khách ngay lập tức. Khi muốn lưu trữ thực đơn tuần lâu dài hoặc đồng bộ trên thiết bị khác, bạn có thể đăng ký tài khoản email hoặc Google.',
  },
  {
    id: 'faq-privacy',
    q: 'Dữ liệu cá nhân được sử dụng ra sao?',
    a: 'Dữ liệu tồn kho, lịch sử quét, thực đơn và giỏ đi chợ được phân tách nghiêm ngặt theo mã hộ gia đình (household_id). Khi đăng xuất hoặc đổi tài khoản trên cùng trình duyệt, bộ nhớ đệm cục bộ của phiên trước được xóa sạch.',
  },
  {
    id: 'faq-plus',
    q: 'Tính năng nào có trong Takolio Pro?',
    a: 'Chi tiết quyền lợi và biểu phí hiện hành của Takolio Pro được đồng bộ trực tiếp từ máy chủ tại trang /plus sau khi bạn đăng nhập tài khoản đã xác thực.',
  },
] as const;

/**
 * M10 — Câu hỏi thường gặp (`/faq`).
 * Accessible accordion + instant client-side search filter.
 */
export const M10FaqPage: React.FC = () => {
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const faqJsonLd = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: 'Câu hỏi thường gặp', path: '/faq' },
      ]),
      buildFaqJsonLd(FAQ_ITEMS),
    ],
    [],
  );

  useVNextSeo({
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp minh bạch về cách hoạt động, AI Scan, quyền riêng tư hộ gia đình và gói Takolio Pro.',
    canonicalPath: '/faq',
    domainSurface: 'marketing',
    jsonLd: faqJsonLd,
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFaq = normalizedQuery
    ? FAQ_ITEMS.filter(
        (item) =>
          item.q.toLowerCase().includes(normalizedQuery) ||
          item.a.toLowerCase().includes(normalizedQuery),
      )
    : FAQ_ITEMS;

  return (
    <PublicMarketingShell screenId="M10">
      <section aria-labelledby="tkv-m10-h1" className="max-w-[920px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-2.5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>Giải đáp minh bạch</span>
          </span>
          <h1 id="tkv-m10-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
            Câu hỏi thường gặp
          </h1>
          <p className="text-base text-[var(--tkv-ink-soft,#3C5954)]">
            Những thông tin quan trọng trước khi bạn đưa Takolio vào căn bếp hằng ngày.
          </p>
        </div>

        {/* Instant Accessible FAQ Search */}
        <div className="relative flex items-center">
          <label htmlFor="m10-faq-search" className="sr-only">
            Tìm câu hỏi thường gặp
          </label>
          <span className="absolute left-4 text-[var(--tkv-ink-muted,#52706A)] pointer-events-none">
            <VNextIcon name="search" size={18} />
          </span>
          <input
            id="m10-faq-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm câu hỏi..."
            className="tkv-focusable w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-[var(--tkv-border,#DCE6DE)] focus:border-[var(--tkv-primary,#196149)] text-base text-[var(--tkv-ink,#152E2C)] placeholder:text-[var(--tkv-ink-muted,#52706A)] transition-colors"
          />
        </div>

        {filteredFaq.length === 0 ? (
          <div
            role="status"
            className="rounded-[20px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 text-center space-y-3"
          >
            <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">
              Không tìm thấy câu hỏi khớp từ khóa “{searchQuery.trim()}”
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="tkv-focusable min-h-[44px] px-4 py-2 rounded-xl bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white text-xs sm:text-sm font-bold transition-colors"
            >
              Hiển thị tất cả câu hỏi
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

const STORIES_GUIDES = [
  {
    id: '5-mon-nhanh-toi-ban-ron',
    title: '5 món ăn nhanh cho tối bận rộn',
    readTime: '04 phút đọc · Mẹo thực đơn',
    excerpt:
      'Cách kết hợp trứng, đậu phụ, rau theo mùa và thịt thái sẵn để hoàn thành mâm cơm nóng hổi dưới 25 phút sau giờ làm.',
    coverSrc: '/takolio/vnext/food/dau-phu-sot-ca-chua.webp',
    coverSrc640: '/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp',
    coverAlt: 'Mâm cơm chiều 25 phút ấm áp với đậu phụ sốt cà chua, rau xanh và cơm trắng trong bát gốm sứ',
    publishedAt: '2026-11-18',
    points: [
      'Ưu tiên 1 món mặn nhanh (đậu phụ sốt cà chua, gà kho gừng) kết hợp 1 món canh hoặc rau xào tỏi.',
      'Kiểm tra mục “Nguyên liệu nên dùng sớm” trên trang Hôm nay trước khi ra chợ chiều.',
      'Dùng bộ lọc thời gian tối đa ≤ 20 phút trong Kho công thức để lọc ngay các món gọn bước.',
    ],
  },
  {
    id: 'bao-quan-rau-dung-cach',
    title: 'Bảo quản rau đúng cách',
    readTime: '05 phút đọc · Tủ lạnh thông minh',
    excerpt:
      'Phân loại rau ăn lá, củ quả và gia vị tươi theo độ ẩm ngăn mát để giữ độ giòn lâu hơn và giảm hao hụt.',
    coverSrc: '/takolio/vnext/marketing/m04-smart-fridge.webp',
    coverSrc640: '/takolio/vnext/marketing/m04-smart-fridge-640w.webp',
    coverAlt: 'Rau ăn lá tươi giòn bảo quản trong hộp thủy tinh lót khăn giấy sạch trong ngăn mát sáng thoáng',
    publishedAt: '2026-11-16',
    points: [
      'Không rửa ướt sũng rau ăn lá trước khi cất hộp; lót giấy thấm khô và ghi nhận mốc hạn ước tính 3 ngày.',
      'Tách riêng hành lá, ngò rí, sả ớt vào nhóm gia vị tươi để dễ kiểm tra khi chuẩn bị nấu.',
      'Thực hiện đối soát tồn kho cuối tuần trước khi lên thực đơn tuần mới.',
    ],
  },
  {
    id: 'bua-com-30-phut',
    title: 'Bữa cơm 30 phút song song hai bếp',
    readTime: '04 phút đọc · Đứng bếp nhẹ đầu',
    excerpt:
      'Sắp xếp thứ tự sơ chế — ướp trước, nấu canh song song, xào rau sau cùng — với bộ hẹn giờ từng bước trên Takolio.',
    coverSrc: '/takolio/vnext/marketing/m07-guided-cooking.webp',
    coverSrc640: '/takolio/vnext/marketing/m07-guided-cooking-640w.webp',
    coverAlt: 'Hai nồi gốm và chảo xào vận hành song song trên mặt bếp sáng với khay nguyên liệu sơ chế gọn gàng',
    publishedAt: '2026-11-14',
    points: [
      'Mở bước Chuẩn bị nấu để bày đủ định lượng ra bàn trước khi bật bếp.',
      'Tận dụng hẹn giờ trên từng bước nấu để không quên nồi kho hoặc nồi canh đang sôi.',
      'Xác nhận lượng thực tế đã dùng ở cuối bữa để tủ lạnh luôn phản ánh đúng số nguyên liệu còn lại.',
    ],
  },
  {
    id: 'so-che-gia-vi-tuoi-bep-viet',
    title: 'Sơ chế hành tỏi sả gừng cho cả tuần',
    readTime: '05 phút đọc · Mise-en-place gia đình',
    excerpt:
      'Chuẩn bị sẵn khay gia vị thơm Việt Nam vào chiều Chủ Nhật giúp tiết kiệm 10 phút đứng bếp mỗi buổi tối trong tuần.',
    coverSrc: '/takolio/vnext/marketing/m05-meal-planning-prep.webp',
    coverSrc640: '/takolio/vnext/marketing/m05-meal-planning-prep-640w.webp',
    coverAlt: 'Hành tím, tỏi ta, sả cây, gừng tươi và ớt đỏ xếp ngay ngắn trong chén gốm trắng trên thớt gỗ',
    publishedAt: '2026-11-12',
    points: [
      'Bóc sẵn hành tím, tỏi khô để ráo hoàn toàn trong hũ kín lót giấy thấm ở ngăn mát trên (4°C).',
      'Sả cây cắt khúc vừa ăn, phần gốc băm nhỏ cấp đông theo viên để sẵn sàng cho món kho gừng sả.',
      'Ghi nhận từng hũ gia vị vào Tủ lạnh thông minh để không mua trùng khi đi chợ giữa tuần.',
    ],
  },
  {
    id: 'xoay-vong-tu-lanh-khong-lang-phi',
    title: 'Quy tắc xoay vòng FEFO chống lãng phí',
    readTime: '06 phút đọc · Quản trị thực phẩm',
    excerpt:
      'Áp dụng nguyên tắc hết hạn trước — nấu trước (First-Expired, First-Out) cho ngăn rau củ và thực phẩm tươi sống.',
    coverSrc: '/takolio/vnext/marketing/m08-smart-shopping-basket.webp',
    coverSrc640: '/takolio/vnext/marketing/m08-smart-shopping-basket-640w.webp',
    coverAlt: 'Khay gốm ưu tiên nấu trước tập hợp các nguyên liệu tươi cần chế biến trong 48 giờ tới',
    publishedAt: '2026-11-10',
    points: [
      'Dành riêng một khay gốm hoặc hộp trong suốt ở ngang tầm mắt cho các lô thực phẩm còn 1–2 ngày.',
      'Bật bộ lọc “Đủ nguyên liệu” trên Takolio để tìm ngay các món tận dụng trọn khay ưu tiên đó.',
      'Luôn phân biệt hạn dùng in trên bao bì với hạn ước tính cảm quan trước khi chế biến.',
    ],
  },
  {
    id: 'bi-quyet-kho-to-ni-dat-dam-vi',
    title: 'Bí quyết kho tộ nồi đất lên màu hổ phách',
    readTime: '05 phút đọc · Tinh hoa món kho Việt',
    excerpt:
      'Canh chuẩn tỷ lệ nước màu dừa, nước mắm nhĩ và nhiệt độ lửa riu để thịt kho trứng mềm rục mà nước kho vẫn trong.',
    coverSrc: '/takolio/vnext/food/thit-kho-trung.webp',
    coverSrc640: '/takolio/vnext/food/thit-kho-trung-640w.webp',
    coverAlt: 'Nồi đất nung kho thịt ba chỉ trứng gà nước dừa sôi lăn tăn ánh màu hổ phách ấm nắng',
    publishedAt: '2026-11-08',
    points: [
      'Ướp thịt với hành tím băm và nước mắm ngon tối thiểu 20 phút trước khi thắng nước màu.',
      'Châm nước dừa tươi ấm xâm xấp mặt thịt rồi hạ lửa riu liu riu để mỡ trong và thấm đều.',
      'Sử dụng bộ hẹn giờ công đoạn trong chế độ nấu từng bước trên Takolio để canh chuẩn 35–40 phút ninh mềm.',
    ],
  },
] as const;

/**
 * M11 — Takolio Stories (`/stories`).
 */
export const M11StoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(STORIES_GUIDES[0].id);
  const selected = STORIES_GUIDES.find((g) => g.id === selectedId) ?? STORIES_GUIDES[0];
  const storiesJsonLd = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: 'Takolio Stories', path: '/stories' },
      ]),
      buildStoriesBlogJsonLd(STORIES_GUIDES),
    ],
    [],
  );

  useVNextSeo({
    title: 'Takolio Stories — Cẩm nang căn bếp gia đình',
    description: 'Cảm hứng cho mỗi bữa ăn và những mẹo quản lý căn bếp gia đình thực tế.',
    canonicalPath: '/stories',
    domainSurface: 'marketing',
    ogType: 'article',
    ogImage: selected.coverSrc,
    ogImageAlt: selected.coverAlt,
    jsonLd: storiesJsonLd,
  });

  return (
    <PublicMarketingShell screenId="M11">
      <section aria-labelledby="tkv-m11-h1" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-2.5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>Cẩm nang bếp gia đình</span>
          </span>
          <h1 id="tkv-m11-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
            Takolio Stories
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-soft,#3C5954)]">
            Cảm hứng cho mỗi bữa ăn, mẹo bảo quản thực phẩm và kỹ thuật đứng bếp thực tế cho gia đình Việt.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STORIES_GUIDES.map((story) => {
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
                    {active ? 'Đang xem hướng dẫn dưới đây' : 'Đọc hướng dẫn chi tiết'}
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
              <span>Áp dụng ngay trong căn bếp Takolio</span>
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
  const section: 'about' | 'contact' | 'privacy' | 'terms' = pathname.startsWith('/contact')
    ? 'contact'
    : pathname.startsWith('/privacy')
      ? 'privacy'
      : pathname.startsWith('/terms')
        ? 'terms'
        : 'about';

  const titles: Record<typeof section, { title: string; canonical: string; desc: string }> = {
    about: {
      title: 'Giới thiệu · Liên hệ · Pháp lý',
      canonical: '/about',
      desc: 'Giới thiệu về sứ mệnh căn bếp gia đình và kiến trúc dữ liệu minh bạch của Takolio.',
    },
    contact: {
      title: 'Liên hệ Takolio',
      canonical: '/contact',
      desc: 'Hướng dẫn hỗ trợ sản phẩm, tra cứu thông tin phiên và đóng góp ý kiến cho Takolio.',
    },
    privacy: {
      title: 'Chính sách bảo mật',
      canonical: '/privacy',
      desc: 'Nguyên tắc phân tách dữ liệu theo hộ gia đình, xử lý ảnh quét AI và bảo vệ phiên đăng nhập trên Takolio.',
    },
    terms: {
      title: 'Điều khoản sử dụng',
      canonical: '/terms',
      desc: 'Quy định sử dụng dịch vụ, trách nhiệm kiểm duyệt kết quả AI và điều khoản tài khoản Takolio.',
    },
  };

  const legalJsonLd = useMemo(
    () =>
      buildBreadcrumbJsonLd([
        { name: 'Takolio', path: '/' },
        { name: titles[section].title, path: titles[section].canonical },
      ]),
    [section],
  );

  useVNextSeo({
    title: titles[section].title,
    description: titles[section].desc,
    canonicalPath: titles[section].canonical,
    domainSurface: 'marketing',
    jsonLd: legalJsonLd,
  });

  return (
    <PublicMarketingShell screenId="M12">
      <section aria-labelledby="tkv-m12-h1" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        {/* M12 Family Tabs */}
        <nav aria-label="Nhóm trang Giới thiệu, Liên hệ và Pháp lý" className="flex flex-wrap gap-2">
          {[
            { key: 'about', label: 'Giới thiệu', to: '/about' },
            { key: 'contact', label: 'Liên hệ', to: '/contact' },
            { key: 'privacy', label: 'Chính sách bảo mật', to: '/privacy' },
            { key: 'terms', label: 'Điều khoản sử dụng', to: '/terms' },
          ].map((t) => (
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
              <span>Cam kết minh bạch & Bảo vệ dữ liệu hộ gia đình</span>
            </span>

            <h1 id="tkv-m12-h1" className="tkv-heading text-3xl sm:text-[2.5rem] font-extrabold text-[var(--tkv-ink,#152E2C)] leading-tight">
              {titles[section].title}
            </h1>

            <p className="text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
              Thông tin về sản phẩm, hướng dẫn hỗ trợ và chính sách bảo vệ dữ liệu căn bếp gia đình.
            </p>

            {section === 'about' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <div className="flex items-center gap-4">
                  <MascotIllustration pose="welcome" size={64} className="shrink-0 border border-[var(--tkv-border)] bg-[var(--tkv-bg)]" />
                  <div className="min-w-0">
                    <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                      Triết lý Bữa ngon, nhẹ đầu của Takolio
                    </h2>
                    <p className="text-sm">Ăn đủ. Mua đủ. Dùng hết — giảm lãng phí thực phẩm, bớt áp lực nghĩ món mỗi chiều.</p>
                  </div>
                </div>
                <p>
                  Takolio được thiết kế cho nhịp sống gia đình Việt hiện đại: kết nối trực tiếp những nguyên liệu đang nằm trong tủ lạnh với kho công thức quen thuộc, lịch ăn 7 ngày và danh sách đi chợ ròng.
                </p>
                <p>
                  Mọi tính năng đều đặt sự trung thực dữ liệu lên hàng đầu: phân biệt rõ hạn dùng ước tính và hạn in trên bao bì, yêu cầu người dùng duyệt kết quả AI trước khi lưu, và cô lập tuyệt đối dữ liệu giữa các hộ gia đình.
                </p>
              </div>
            )}

            {section === 'privacy' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  Tóm tắt kỹ thuật bảo vệ dữ liệu hiện hành trên hệ thống
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Cô lập theo hộ gia đình:</strong> Tồn kho, lịch tuần, giỏ mua sắm và ảnh quét đều được kiểm tra quyền sở hữu theo <code>household_id</code> ở tầng máy chủ.</li>
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Phiên đăng nhập an toàn:</strong> Xác thực bằng cookie <code>HttpOnly</code>; khi đăng xuất hoặc đổi tài khoản, bộ nhớ tạm trên trình duyệt được dọn sạch.</li>
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Ảnh quét AI:</strong> Chỉ gửi xử lý khi bạn chủ động bấm chụp/tải lên và không tự động nhập kho nếu chưa xác nhận.</li>
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Quyền xuất & xóa dữ liệu:</strong> Người dùng có thể quản lý phiên, xóa bộ nhớ đệm cục bộ và gửi yêu cầu hỗ trợ tài khoản minh bạch trong phần Quyền riêng tư.</li>
                </ul>
              </div>
            )}

            {section === 'terms' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  Nguyên tắc sử dụng dịch vụ
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Kiểm tra an toàn thực phẩm:</strong> Nhãn hạn dùng ước tính và gợi ý AI chỉ mang tính hỗ trợ quản lý; người dùng luôn kiểm tra thực tế tình trạng thực phẩm và dị ứng của gia đình trước khi chế biến.</li>
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Định lượng & dinh dưỡng:</strong> Chỉ các công thức có nguồn dinh dưỡng xác minh mới hiển thị chỉ số macro; ứng dụng không thay thế tư vấn y khoa.</li>
                  <li><strong className="text-[var(--tkv-ink,#152E2C)]">Gói Takolio Pro:</strong> Quyền lợi và giao dịch thanh toán tuân theo thông tin chính thức tại màn hình <code>/plus</code> khi đăng nhập.</li>
                </ul>
              </div>
            )}

            {section === 'contact' && (
              <div className="rounded-[22px] bg-white border border-[var(--tkv-border,#DCE6DE)] p-6 space-y-3 text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  Nguyên tắc hỗ trợ minh bạch
                </h2>
                <p>
                  Cổng gửi yêu cầu trực tiếp trên web công khai chưa bật trong phiên bản hiện hành. Thay vì hiển thị biểu mẫu giả lập báo gửi thành công, Takolio cung cấp danh mục tự kiểm tra trạng thái phiên, đối soát thanh toán và hướng dẫn xử lý sự cố ngay bên cạnh.
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
                  <span>Hướng dẫn hỗ trợ & phản hồi</span>
                </span>
                <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  Trung tâm hỗ trợ tự phục vụ
                </h2>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                  Tra cứu nhanh cách xử lý các tình huống thường gặp về tài khoản, bản quét AI và giao dịch Takolio Pro.
                </p>
              </div>

              <ol className="space-y-3 text-xs sm:text-sm">
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">01.</span>
                    Đối soát giao dịch Takolio Pro
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    Đăng nhập và mở mục <strong>Takolio Pro (/plus)</strong> để xem trạng thái lệnh VietQR trực tiếp từ máy chủ hoặc mở lại lệnh đang chờ mà không cần chuyển khoản lại.
                  </p>
                </li>
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">02.</span>
                    Kiểm tra đồng bộ & phiên bản ứng dụng
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    Tại <strong>Cài đặt ứng dụng</strong> và <strong>Quyền riêng tư</strong>, bạn có thể kiểm tra số thao tác ngoại tuyến đang chờ đồng bộ, mã phiên bản build và làm mới bộ nhớ đệm an toàn.
                  </p>
                </li>
                <li className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 space-y-1">
                  <p className="font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    <span className="tabular-nums text-[var(--tkv-primary,#196149)] mr-1.5">03.</span>
                    Bảo mật thông tin khi gửi phản hồi
                  </p>
                  <p className="text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                    Chỉ đính kèm mã hỗ trợ bản quét (<code>supportId</code>) hoặc 4 số cuối mã đơn thanh toán — không bao giờ chia sẻ mật khẩu hoặc mã OTP 6 chữ số.
                  </p>
                </li>
              </ol>

              <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Link
                  to="/faq"
                  className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--tkv-primary,#196149)] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[var(--tkv-primary-hover,#134C39)] shadow-xs transition-colors"
                >
                  <span>Tra cứu FAQ</span>
                  <VNextIcon name="arrow-right" size={15} />
                </Link>
                {isSatelliteComRuntime() ? (
                  <a
                    href={resolveAppSurfaceHref('/auth?mode=login')}
                    className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] text-xs sm:text-sm font-bold inline-flex items-center justify-center hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
                  >
                    Đăng nhập kiểm tra phiên
                  </a>
                ) : (
                  <Link
                    to={vnextHref('/auth?mode=login')}
                    className="tkv-focusable min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] text-xs sm:text-sm font-bold inline-flex items-center justify-center hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
                  >
                    Đăng nhập kiểm tra phiên
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
