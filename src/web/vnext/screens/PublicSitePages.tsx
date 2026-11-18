import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/useAuthStore';
import { vnextHref } from '../feature';
import { trackPublicConversion, useVNextSeo } from '../lib/seo';
import { PublicMarketingShell } from '../components/Shells';
import { TkvBadge, TkvButton, TkvSurface, TkvTextField } from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { MascotIllustration, VerifiedDishImage } from '../components/VNextMedia';

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
    className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 overflow-x-auto"
  >
    <ul className="inline-flex items-center gap-2 pb-1">
      {FEATURE_SUBNAV.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <Link
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center whitespace-nowrap border transition-colors',
                active
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
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
    imageSrc: '/takolio/vnext/marketing/hero-m01-kitchen-studio-table.webp',
    imageSrc640: '/takolio/vnext/marketing/hero-m01-kitchen-studio-table-640w.webp',
    imageAlt: 'Mâm cơm gia đình Việt trên bàn gỗ sồi ấm sáng từ nguyên liệu sẵn có trong tủ lạnh',
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
        code: 'A',
        heading: 'Ảnh riêng tư theo phiên hộ gia đình',
        body: 'Ảnh quét chỉ gắn với hộ gia đình của bạn, không chia sẻ chéo giữa các tài khoản hay bộ nhớ đệm.',
      },
      {
        code: 'B',
        heading: 'Giữ nguyên bằng chứng OCR gốc trên hóa đơn',
        body: 'Khi duyệt hóa đơn siêu thị (C14), hệ thống giữ đối chiếu dòng OCR gốc và không tự bịa giá tiền thiếu.',
      },
      {
        code: 'C',
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
    imageSrc: '/takolio/vnext/food/thit-kho-trung.webp',
    imageSrc640: '/takolio/vnext/food/thit-kho-trung-640w.webp',
    imageAlt: 'Thịt kho tàu nước dừa trứng gà ta óng màu cánh gián trong bát gốm ấm',
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
    imageAlt: 'Nồi gang xanh lá ninh món ăn trên bếp sạch sẽ cùng sả gừng hành lá',
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
        detail: 'Chữ cỡ lớn dễ đọc từ xa, bộ hẹn giờ gắn theo từng công đoạn và tùy chọn đọc giọng nói khi tay bận.',
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
        detail: 'Sắp xếp mục cần mua rõ ràng giữa phần đang thiếu và phần đã cho vào giỏ để đi siêu thị hoặc chợ nhanh hơn.',
      },
      {
        icon: 'check',
        title: 'Đánh dấu đã mua',
        detail: 'Hoạt động mượt ngay cả khi sóng yếu ở tầng hầm siêu thị với hàng đợi đồng bộ ngoại tuyến minh bạch.',
      },
      {
        icon: 'fridge',
        title: 'Nhập kho có xác nhận',
        detail: 'Chuyển các mục đã mua vào tủ lạnh thông qua sổ cái xác nhận máy chủ, ngăn chặn nhân đôi số lượng.',
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
  useVNextSeo({
    title: spec.title,
    description: `${spec.subtitle} ${spec.truthNote}`,
    canonicalPath: spec.canonicalPath,
  });

  return (
    <PublicMarketingShell screenId={spec.screenId}>
      <FeatureSubnavBar activeId={spec.screenId} />

      {/* Hero matching M02..M08 wireframes 1:1 */}
      <section
        aria-labelledby={`tkv-${spec.screenId}-h1`}
        className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Title + Subtitle + 3 Structured Highlight Cards */}
          <div className="lg:col-span-6 space-y-5">
            <TkvBadge tone="success" icon="sparkles">
              {spec.eyebrow}
            </TkvBadge>

            <div className="space-y-2.5">
              <h1
                id={`tkv-${spec.screenId}-h1`}
                className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink)] leading-[1.15]"
              >
                {spec.title}
              </h1>
              <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">
                {spec.subtitle}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {spec.bullets.map((b) => (
                <TkvSurface key={b.title} className="p-4 sm:p-5 flex items-start gap-3.5">
                  <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                    <VNextIcon name={b.icon} size={22} />
                  </span>
                  <div className="space-y-1 min-w-0">
                    <h2 className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink)]">
                      {b.title}
                    </h2>
                    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                      {b.detail}
                    </p>
                  </div>
                </TkvSurface>
              ))}
            </div>
          </div>

          {/* Right Column: Mint Studio Showcase + Full-Width Coral CTA matching wireframe */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-[28px] bg-[var(--tkv-surface-mint)] p-4 sm:p-6 border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-float)] space-y-4">
              <div className="rounded-[20px] overflow-hidden aspect-[4/3] bg-white shadow-sm">
                <img
                  src={spec.imageSrc640}
                  srcSet={`${spec.imageSrc640} 640w, ${spec.imageSrc} 1200w`}
                  sizes="(max-width: 1024px) 100vw, 560px"
                  alt={spec.imageAlt}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="rounded-2xl bg-white/90 border border-[var(--tkv-border)] p-4 space-y-2">
                <p className="text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1.5">
                  <VNextIcon name="shield" size={15} />
                  <span>{spec.truthBadge}</span>
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                  {spec.truthNote}
                </p>
              </div>
            </div>

            <TkvButton
              variant="coral"
              size="lg"
              fullWidth
              iconRight="arrow-right"
              onClick={() => {
                trackPublicConversion('feature_primary_cta', { screenId: spec.screenId });
                navigate(vnextHref(spec.ctaHref));
              }}
            >
              {spec.ctaLabel}
            </TkvButton>
          </div>
        </div>
      </section>

      {/* Deep-Dive Section */}
      <section className="bg-[var(--tkv-surface)] border-y border-[var(--tkv-border)] py-12 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            {spec.deepDiveTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {spec.deepDiveSteps.map((st) => (
              <TkvSurface key={st.code} tone="mint" className="p-5 space-y-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--tkv-primary)] text-white text-xs font-extrabold">
                  {st.code}
                </span>
                <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                  {st.heading}
                </h3>
                <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{st.body}</p>
              </TkvSurface>
            ))}
          </div>

          {spec.screenId === 'M06' && (
            <div className="pt-4 space-y-4">
              <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                Một số món ăn xác minh nguyên liệu trong kho công thức
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SHOWCASE_RECIPES.map((r) => (
                  <TkvSurface key={r.slug} padded={false} className="overflow-hidden flex flex-col">
                    <VerifiedDishImage slug={r.slug} title={r.title} aspectClass="aspect-[4/3]" />
                    <div className="p-4 space-y-1">
                      <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                        {r.title}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)]">{r.meta}</p>
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

/**
 * M09 — Các gói Takolio (`/pricing`).
 * Matches M09.png 1:1 while honoring Owner Decision 4 (`BLOCKED_CONTENT` commercial pricing truth:
 * zero fabricated public VND figures; authoritative prices are loaded inside authenticated `/plus`).
 */
export const M09PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, householdId, isGuest } = useAuthStore();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [isStarting, setIsStarting] = useState(false);

  useVNextSeo({
    title: 'Các gói Takolio',
    description: 'Lựa chọn gói Miễn phí hoặc Takolio Plus phù hợp nhu cầu căn bếp gia đình.',
    canonicalPath: '/pricing',
  });

  const handleStartFree = async () => {
    trackPublicConversion('pricing_start_free');
    if (userId && householdId) {
      navigate(vnextHref('/'));
      return;
    }
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/household'));
    } catch {
      navigate(vnextHref('/auth?mode=register'));
    } finally {
      setIsStarting(false);
    }
  };

  const plusDestination =
    userId && householdId && !isGuest
      ? '/plus'
      : vnextHref('/auth?mode=login&returnTo=%2Fplus');

  return (
    <PublicMarketingShell screenId="M09">
      <section aria-labelledby="tkv-m09-h1" className="max-w-[1060px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-3 max-w-2xl">
          <TkvBadge tone="warning" icon="info">
            Minh bạch biểu phí theo dữ liệu máy chủ
          </TkvBadge>
          <h1 id="tkv-m09-h1" className="tkv-heading text-3xl sm:text-[2.65rem] font-extrabold text-[var(--tkv-ink)]">
            Các gói Takolio
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)]">
            Lựa chọn gói phù hợp với nhu cầu sử dụng của hộ gia đình bạn.
          </p>
        </div>

        {/* 2-Column Plan Cards matching M09.png */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <TkvSurface className="p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]">
                Cơ bản cho mọi gia đình
              </span>
              <h2 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-primary)]">
                Miễn phí
              </h2>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                Giá và quyền lợi hiển thị theo hệ thống chính thức. Bắt đầu ngay không cần thẻ thanh toán.
              </p>
              <ul className="space-y-2.5 pt-2 text-sm text-[var(--tkv-ink)]">
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="check" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Quản lý tồn kho tủ lạnh theo lô và cảnh báo hạn dùng</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="check" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Tra cứu kho công thức món Việt & chế độ nấu từng bước có timer</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="check" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Danh sách đi chợ đồng bộ ngoại tuyến và đối chiếu định lượng</span>
                </li>
              </ul>
            </div>

            <TkvButton
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isStarting}
              onClick={handleStartFree}
              data-testid="m09-free-cta"
            >
              Bắt đầu
            </TkvButton>
          </TkvSurface>

          <TkvSurface tone="mint" className="p-6 sm:p-8 flex flex-col justify-between gap-6 border-[var(--tkv-border-strong)]">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white text-[var(--tkv-primary)] border border-[var(--tkv-border)]">
                <VNextIcon name="crown" size={14} />
                <span>Nâng cao cho căn bếp bận rộn</span>
              </span>
              <h2 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-primary)]">
                Takolio Plus
              </h2>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                Giá và quyền lợi hiển thị theo hệ thống chính thức tại trang tài khoản /plus sau khi đăng nhập.
              </p>
              <ul className="space-y-2.5 pt-2 text-sm text-[var(--tkv-ink)]">
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="sparkles" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Mở rộng hạn mức quét AI tủ lạnh & hóa đơn có bước duyệt trước khi lưu</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="calendar" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Lập thực đơn tuần chuyên sâu & tối ưu danh sách đi chợ theo lịch</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="shield" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                  <span>Thanh toán VietQR / PayOS bảo mật trực tiếp từ phiên đã xác thực</span>
                </li>
              </ul>
            </div>

            <TkvButton
              variant="coral"
              size="lg"
              fullWidth
              onClick={() => {
                trackPublicConversion('pricing_view_plus');
                navigate(plusDestination);
              }}
              data-testid="m09-plus-cta"
            >
              Xem các gói
            </TkvButton>
          </TkvSurface>
        </div>

        <TkvSurface tone="saffron" className="p-4 sm:p-5 text-xs sm:text-sm text-[var(--tkv-ink)] flex items-start gap-3">
          <VNextIcon name="info" size={18} className="text-[var(--tkv-warning)] shrink-0 mt-0.5" />
          <p>
            <strong>Ghi chú minh bạch thương mại (M09):</strong> Trang giới thiệu công khai không niêm yết cứng số tiền khi chưa kết nối API bảng giá công khai. Mọi mức phí và chu kỳ thanh toán luôn được lấy trực tiếp từ máy chủ tại mục <strong>Takolio Plus (/plus)</strong> sau khi bạn đăng nhập.
          </p>
        </TkvSurface>
      </section>
    </PublicMarketingShell>
  );
};

const FAQ_ITEMS = [
  {
    id: 'faq-free',
    q: 'Takolio có miễn phí không?',
    a: 'Có. Bạn có thể sử dụng miễn phí các tính năng cốt lõi gồm quản lý tủ lạnh theo lô, tra cứu kho công thức món ăn gia đình, chế độ nấu từng bước có hẹn giờ và danh sách đi chợ. Gói Takolio Plus là tùy chọn mở rộng hạn mức AI Scan và tiện ích lập kế hoạch nâng cao.',
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
    q: 'Tính năng nào có trong Plus?',
    a: 'Chi tiết quyền lợi và biểu phí hiện hành của Takolio Plus được hiển thị trực tiếp từ máy chủ tại trang /plus sau khi bạn đăng nhập tài khoản đã xác thực.',
  },
] as const;

/**
 * M10 — Câu hỏi thường gặp (`/faq`).
 * Accessible accordion matching M10.png 1:1.
 */
export const M10FaqPage: React.FC = () => {
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0].id);

  useVNextSeo({
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp minh bạch về cách hoạt động, AI Scan, quyền riêng tư hộ gia đình và gói Takolio Plus.',
    canonicalPath: '/faq',
  });

  return (
    <PublicMarketingShell screenId="M10">
      <section aria-labelledby="tkv-m10-h1" className="max-w-[920px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="space-y-2.5">
          <TkvBadge tone="success" icon="help">
            Giải đáp minh bạch
          </TkvBadge>
          <h1 id="tkv-m10-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink)]">
            Câu hỏi thường gặp
          </h1>
          <p className="text-base text-[var(--tkv-ink-secondary)]">
            Những thông tin quan trọng trước khi bạn đưa Takolio vào căn bếp hằng ngày.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            const expanded = openId === item.id;
            const panelId = `${item.id}-panel`;
            return (
              <TkvSurface key={item.id} padded={false} className="overflow-hidden">
                <h2>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenId(expanded ? '' : item.id)}
                    className="tkv-focusable w-full min-h-[60px] px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[var(--tkv-surface-mint)]/40 transition-colors"
                  >
                    <span className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink)]">
                      {item.q}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                      <VNextIcon name={expanded ? 'minus' : 'plus'} size={16} />
                    </span>
                  </button>
                </h2>
                {expanded && (
                  <div
                    id={panelId}
                    role="region"
                    className="px-5 pb-5 pt-1 text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed border-t border-[var(--tkv-border)]/60"
                  >
                    {item.a}
                  </div>
                )}
              </TkvSurface>
            );
          })}
        </div>
      </section>
    </PublicMarketingShell>
  );
};

const STORIES_GUIDES = [
  {
    id: '5-mon-nhanh-toi-ban-ron',
    title: '5 món ăn nhanh cho tối bận rộn',
    readTime: '4 phút đọc · Mẹo thực đơn',
    excerpt:
      'Cách kết hợp trứng, đậu phụ, rau theo mùa và thịt thái sẵn để hoàn thành mâm cơm nóng hổi dưới 25 phút sau giờ làm.',
    slug: 'dau-phu-sot-ca-chua',
    points: [
      'Ưu tiên 1 món mặn nhanh (đậu phụ sốt cà chua, gà kho gừng) kết hợp 1 món canh hoặc rau xào tỏi.',
      'Kiểm tra mục “Nguyên liệu nên dùng sớm” trên trang Hôm nay trước khi ra chợ chiều.',
      'Dùng bộ lọc thời gian tối đa ≤ 25 phút trong Kho công thức để lọc ngay các món gọn bước.',
    ],
  },
  {
    id: 'bao-quan-rau-dung-cach',
    title: 'Bảo quản rau đúng cách',
    readTime: '5 phút đọc · Tủ lạnh thông minh',
    excerpt:
      'Phân loại rau ăn lá, củ quả và gia vị tươi theo độ ẩm ngăn mát để giữ độ giòn lâu hơn và giảm hao hụt.',
    slug: 'rau-muong-xao-toi',
    points: [
      'Không rửa ướt sũng rau ăn lá trước khi cất hộp; lót giấy thấm khô và ghi nhận mốc hạn ước tính 3 ngày.',
      'Tách riêng hành lá, ngò rí, sả ớt vào nhóm gia vị tươi để dễ kiểm tra khi chuẩn bị nấu.',
      'Thực hiện đối soát tồn kho cuối tuần trước khi lên thực đơn tuần mới.',
    ],
  },
  {
    id: 'bua-com-30-phut',
    title: 'Bữa cơm 30 phút',
    readTime: '4 phút đọc · Đứng bếp nhẹ đầu',
    excerpt:
      'Sắp xếp thứ tự sơ chế — ướp trước, nấu canh song song, xào rau sau cùng — với bộ hẹn giờ từng bước trên Takolio.',
    slug: 'sup-ga-ngo-non-nam-huong',
    points: [
      'Mở bước Chuẩn bị nấu (C20) để bày đủ định lượng ra bàn trước khi bật bếp.',
      'Tận dụng hẹn giờ trên từng bước nấu để không quên nồi kho hoặc nồi canh đang sôi.',
      'Xác nhận lượng thực tế đã dùng ở cuối bữa để tủ lạnh luôn phản ánh đúng số nguyên liệu còn lại.',
    ],
  },
] as const;

/**
 * M11 — Takolio Stories (`/stories`).
 * Matches M11.png 3-card layout cleanly with interactive guide reader & honest `BLOCKED_CONTENT` CMS notice.
 */
export const M11StoriesPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(STORIES_GUIDES[0].id);
  const selected = STORIES_GUIDES.find((g) => g.id === selectedId) ?? STORIES_GUIDES[0];

  useVNextSeo({
    title: 'Takolio Stories',
    description: 'Cảm hứng cho mỗi bữa ăn và những mẹo quản lý căn bếp gia đình thực tế.',
    canonicalPath: '/stories',
    ogType: 'article',
  });

  return (
    <PublicMarketingShell screenId="M11">
      <section aria-labelledby="tkv-m11-h1" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2.5">
            <TkvBadge tone="success" icon="sparkles">
              Cẩm nang bếp gia đình
            </TkvBadge>
            <h1 id="tkv-m11-h1" className="tkv-heading text-3xl sm:text-[2.6rem] font-extrabold text-[var(--tkv-ink)]">
              Takolio Stories
            </h1>
            <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)]">
              Cảm hứng cho mỗi bữa ăn và những mẹo bếp thực tế.
            </p>
          </div>
        </div>

        {/* 3 Editorial Cards matching M11.png */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STORIES_GUIDES.map((story) => {
            const active = story.id === selected.id;
            return (
              <TkvSurface
                key={story.id}
                padded={false}
                className={clsx(
                  'overflow-hidden flex flex-col justify-between transition-colors',
                  active && 'ring-2 ring-[var(--tkv-primary)]',
                )}
              >
                <div>
                  <div className="p-3 bg-[var(--tkv-surface-mint)]">
                    <VerifiedDishImage
                      slug={story.slug}
                      title={story.title}
                      aspectClass="aspect-[4/3]"
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <p className="text-xs font-bold text-[var(--tkv-primary)]">{story.readTime}</p>
                    <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                      {story.title}
                    </h2>
                    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                      {story.excerpt}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <TkvButton
                    variant={active ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    onClick={() => setSelectedId(story.id)}
                  >
                    {active ? 'Đang xem hướng dẫn dưới đây' : 'Đọc hướng dẫn nhanh'}
                  </TkvButton>
                </div>
              </TkvSurface>
            );
          })}
        </div>

        {/* Expanded Guide Reader */}
        <TkvSurface tone="mint" className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
              {selected.title}
            </h2>
            <span className="text-xs font-bold text-[var(--tkv-primary)]">{selected.readTime}</span>
          </div>
          <ul className="space-y-2.5 text-sm sm:text-base text-[var(--tkv-ink)]">
            {selected.points.map((pt) => (
              <li key={pt} className="flex items-start gap-2.5">
                <VNextIcon name="check" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-1" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </TkvSurface>
      </section>
    </PublicMarketingShell>
  );
};

/**
 * M12 — Giới thiệu · Liên hệ · Pháp lý (`/about`, `/contact`, `/privacy`, `/terms`).
 * Implements the 4-route template family specified in `SCREENS/M12.md` & `M12.png`.
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

  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [draftPrepared, setDraftPrepared] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const titles: Record<typeof section, { title: string; canonical: string; desc: string }> = {
    about: {
      title: 'Giới thiệu · Liên hệ · Pháp lý',
      canonical: '/about',
      desc: 'Giới thiệu về sứ mệnh căn bếp gia đình và kiến trúc dữ liệu minh bạch của Takolio.',
    },
    contact: {
      title: 'Liên hệ Takolio',
      canonical: '/contact',
      desc: 'Kênh liên hệ hỗ trợ sản phẩm và đóng góp ý kiến cho đội ngũ phát triển Takolio.',
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

  useVNextSeo({
    title: titles[section].title,
    description: titles[section].desc,
    canonicalPath: titles[section].canonical,
  });

  const handlePrepareContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderEmail.trim() || !messageBody.trim()) return;
    setDraftPrepared(true);
  };

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
                'tkv-focusable min-h-[42px] px-4 py-2 rounded-full text-sm font-bold inline-flex items-center border transition-colors',
                section === t.key
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Content Column */}
          <div className="lg:col-span-7 space-y-5">
            <TkvBadge tone="success" icon="shield">
              Cam kết minh bạch & Bảo vệ dữ liệu hộ gia đình
            </TkvBadge>

            <h1 id="tkv-m12-h1" className="tkv-heading text-3xl sm:text-[2.5rem] font-extrabold text-[var(--tkv-ink)] leading-tight">
              {titles[section].title}
            </h1>

            <p className="text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              Thông tin về sản phẩm, hỗ trợ và chính sách bảo vệ dữ liệu căn bếp gia đình.
            </p>

            {section === 'about' && (
              <TkvSurface className="p-6 space-y-4 text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                <div className="flex items-center gap-4">
                  <MascotIllustration pose="welcome" size={72} />
                  <div>
                    <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                      Triết lý Kitchen Studio của Takolio
                    </h2>
                    <p className="text-sm">Giảm lãng phí thực phẩm, bớt áp lực nghĩ món mỗi chiều.</p>
                  </div>
                </div>
                <p>
                  Takolio được thiết kế cho nhịp sống gia đình Việt hiện đại: kết nối trực tiếp những nguyên liệu đang nằm trong tủ lạnh với kho công thức quen thuộc, lịch ăn 7 ngày và danh sách đi chợ ròng.
                </p>
                <p>
                  Mọi tính năng đều đặt sự trung thực dữ liệu lên hàng đầu: phân biệt rõ hạn dùng ước tính và hạn in trên bao bì, yêu cầu người dùng duyệt kết quả AI trước khi lưu, và cô lập tuyệt đối dữ liệu giữa các hộ gia đình.
                </p>
              </TkvSurface>
            )}

            {section === 'privacy' && (
              <TkvSurface className="p-6 space-y-4 text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Tóm tắt kỹ thuật bảo vệ dữ liệu hiện hành trên hệ thống
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li><strong>Cô lập theo hộ gia đình:</strong> Tồn kho, lịch tuần, giỏ mua sắm và ảnh quét đều được kiểm tra quyền sở hữu theo <code>household_id</code> ở tầng máy chủ.</li>
                  <li><strong>Phiên đăng nhập an toàn:</strong> Xác thực bằng cookie <code>HttpOnly</code>; khi đăng xuất hoặc đổi tài khoản, bộ nhớ tạm trên trình duyệt được dọn sạch.</li>
                  <li><strong>Ảnh quét AI:</strong> Chỉ gửi xử lý khi bạn chủ động bấm chụp/tải lên và không tự động nhập kho nếu chưa xác nhận.</li>
                  <li><strong>Quyền xuất/xóa dữ liệu (U10):</strong> Đang được lập đặc tả kỹ thuật (<code>RFC-002</code>) để triển khai quy trình tự phục vụ an toàn.</li>
                </ul>
              </TkvSurface>
            )}

            {section === 'terms' && (
              <TkvSurface className="p-6 space-y-4 text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Nguyên tắc sử dụng dịch vụ
                </h2>
                <ul className="space-y-2.5 list-disc pl-5">
                  <li><strong>Kiểm tra an toàn thực phẩm:</strong> Nhãn hạn dùng ước tính và gợi ý AI chỉ mang tính hỗ trợ quản lý; người dùng luôn kiểm tra thực tế tình trạng thực phẩm và dị ứng của gia đình trước khi chế biến.</li>
                  <li><strong>Định lượng & dinh dưỡng:</strong> Chỉ các công thức có nguồn dinh dưỡng xác minh mới hiển thị chỉ số macro; ứng dụng không thay thế tư vấn y khoa.</li>
                  <li><strong>Gói Takolio Plus:</strong> Quyền lợi và giao dịch thanh toán tuân theo thông tin chính thức tại màn hình <code>/plus</code> khi đăng nhập.</li>
                </ul>
              </TkvSurface>
            )}

            {section === 'contact' && (
              <TkvSurface tone="mint" className="p-6 space-y-2 text-sm text-[var(--tkv-ink-secondary)]">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Hỗ trợ & phản hồi sản phẩm
                </h2>
                <p>
                  Điền biểu mẫu bên cạnh để chuẩn bị nội dung liên hệ. Vì cổng gửi ticket tự động chưa bật trên môi trường công khai hiện tại, hệ thống sẽ tạo bản nháp hoàn chỉnh để bạn sao chép hoặc mở trình thư điện tử của mình một cách minh bạch (không giả lập báo gửi thành công).
                </p>
              </TkvSurface>
            )}
          </div>

          {/* Right Contact Card matching M12.png */}
          <div className="lg:col-span-5">
            <TkvSurface className="p-6 sm:p-7 space-y-4">
              <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-primary)]">
                Liên hệ Takolio
              </h2>
              <form onSubmit={handlePrepareContact} className="space-y-4">
                <TkvTextField
                  label="Họ và tên"
                  value={senderName}
                  onChange={(e) => {
                    setSenderName(e.target.value);
                    setDraftPrepared(false);
                  }}
                  placeholder="Nguyễn Văn A"
                  required
                />
                <TkvTextField
                  label="Email"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => {
                    setSenderEmail(e.target.value);
                    setDraftPrepared(false);
                  }}
                  placeholder="email@example.com"
                  required
                />
                <div className="space-y-2">
                  <label htmlFor="m12-contact-body" className="block text-sm font-bold text-[var(--tkv-ink)]">
                    Nội dung
                  </label>
                  <textarea
                    id="m12-contact-body"
                    rows={4}
                    required
                    value={messageBody}
                    onChange={(e) => {
                      setMessageBody(e.target.value);
                      setDraftPrepared(false);
                    }}
                    placeholder="Mô tả câu hỏi hoặc góp ý của bạn…"
                    className="tkv-focusable w-full rounded-[14px] border border-[var(--tkv-border-strong)] bg-[var(--tkv-bg)] px-3.5 py-2.5 text-sm text-[var(--tkv-ink)]"
                  />
                </div>
                <TkvButton type="submit" variant="primary" size="lg" fullWidth>
                  Chuẩn bị nội dung liên hệ
                </TkvButton>
              </form>

              {draftPrepared && (
                <div role="status" className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] p-4 text-xs text-[var(--tkv-ink)] space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-extrabold text-[var(--tkv-primary)]">
                      Đã chuẩn bị nội dung liên hệ sẵn sàng sao chép:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `Từ: ${senderName} <${senderEmail}>\nNội dung: ${messageBody}`;
                        void navigator.clipboard?.writeText(text).then(() => {
                          setCopiedDraft(true);
                          window.setTimeout(() => setCopiedDraft(false), 2500);
                        });
                      }}
                      className="tkv-focusable min-h-[34px] px-3 rounded-lg bg-white border border-[var(--tkv-border-strong)] font-extrabold text-[var(--tkv-primary)] hover:bg-[var(--tkv-bg)]"
                    >
                      {copiedDraft ? 'Đã sao chép!' : 'Sao chép nội dung'}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans bg-white/80 p-2.5 rounded-xl border border-[var(--tkv-border)]">
                    {`Từ: ${senderName} <${senderEmail}>\nNội dung: ${messageBody}`}
                  </pre>
                </div>
              )}
            </TkvSurface>
          </div>
        </div>
      </section>
    </PublicMarketingShell>
  );
};
