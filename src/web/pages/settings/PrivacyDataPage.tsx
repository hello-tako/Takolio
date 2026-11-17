import { AccountPage } from '../../components/common/AccountPage';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BentoCard, AtelierBadge } from '../../design-system/v4/AtelierPrimitives';
import {
  FreshnessShieldIcon,
  AiSousChefSparkIcon,
  ExpiryRescueBellIcon,
  AllergenShieldIcon,
} from '../../design-system/icons';

const PERMISSION_LABELS: Record<string, string> = {
  granted: 'đã cho phép',
  denied: 'đã chặn',
  default: 'chưa được yêu cầu',
  unsupported: 'trình duyệt không hỗ trợ',
};

export const PrivacyDataPage: React.FC = () => {
  const [browserPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  return (
    <AccountPage
      title="Quyền riêng tư & dữ liệu"
      description="Minh bạch cách Takolio bảo vệ dữ liệu tủ lạnh, AI Vision và quyền riêng tư của gia đình bạn."
    >
      <div className="space-y-4 pb-8">
        <BentoCard tone="ceramic" padding="md" className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2">
              <FreshnessShieldIcon size={20} tone="jade" active />
              <span>Phân tách dữ liệu theo Hộ gia đình</span>
            </h2>
            <AtelierBadge tone="jade">Cô lập dữ liệu</AtelierBadge>
          </div>
          <p className="text-sm text-tk-secondary leading-relaxed">
            Takolio lưu hồ sơ tài khoản, sở thích khẩu vị, nguyên liệu trong tủ lạnh FEFO, lịch sử
            quét và thực đơn thuộc hộ gia đình của bạn. Dữ liệu được phân tách nghiêm ngặt theo mã
            hộ; chỉ các thành viên bạn mời bằng mã <strong>TAKO-XXXX</strong> mới có quyền truy cập
            bếp chung.
          </p>
        </BentoCard>

        <BentoCard tone="ceramic" padding="md" className="space-y-2.5">
          <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2">
            <AiSousChefSparkIcon size={20} tone="jade" active />
            <span>Cách AI Vision &amp; Bếp Phó hoạt động</span>
          </h2>
          <p className="text-sm text-tk-secondary leading-relaxed">
            Khi bạn chụp ảnh tủ lạnh hoặc hóa đơn siêu thị, hình ảnh chỉ được xử lý để trích xuất
            danh sách nguyên liệu và hạn dùng. Hãy che các thông tin cá nhân trên hóa đơn trước khi
            quét. Mọi kết quả AI luôn qua bước xác nhận của bạn trước khi nhập vào tồn kho thật.
          </p>
        </BentoCard>

        <BentoCard tone="ceramic" padding="md" className="space-y-2.5">
          <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2">
            <ExpiryRescueBellIcon size={20} tone="turmeric" active />
            <span>Quyền trên trình duyệt</span>
          </h2>
          <p className="text-sm text-tk-secondary leading-relaxed">
            Quyền thông báo hiện tại:{' '}
            <strong>{PERMISSION_LABELS[browserPermission] ?? 'không xác định'}</strong>. Quyền máy
            ảnh và micro chỉ được bật khi bạn chủ động mở Quét AI hoặc Bếp Phó Giọng Nói. Bạn luôn
            có thể thu hồi trong cài đặt trình duyệt.
          </p>
        </BentoCard>

        <BentoCard tone="sunken" padding="md" className="space-y-2.5">
          <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2">
            <AllergenShieldIcon size={20} tone="flame" active />
            <span>Quản lý phiên &amp; tài khoản</span>
          </h2>
          <p className="text-sm text-tk-secondary leading-relaxed">
            Khi đăng xuất trên thiết bị này, toàn bộ bộ nhớ đệm riêng tư của phiên trước sẽ được xóa
            sạch ngay lập tức. Tính năng tự xuất tệp lưu trữ JSON và xóa vĩnh viễn tài khoản tự phục
            vụ đang được phát triển cho các bản cập nhật tiếp theo.
          </p>
          <Link
            to="/me"
            className="inline-flex text-xs font-extrabold text-tk-flame hover:underline pt-1"
          >
            Về trang Hồ sơ để quản lý phiên đăng nhập →
          </Link>
        </BentoCard>
      </div>
    </AccountPage>
  );
};
