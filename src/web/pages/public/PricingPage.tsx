import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  SegmentedTabs,
} from '../../design-system/v4/AtelierPrimitives';
import {
  CrownPlusIcon,
  FreshnessShieldIcon,
  NavScanApertureIcon,
  ReceiptScanIcon,
  VietQRBadgeIcon,
} from '../../design-system/icons';

type BillingCycle = 'monthly' | 'annual';

interface ComparisonRow {
  feature: string;
  free: string;
  plus: string;
  highlight?: boolean;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: 'Tủ lạnh Thông minh 3D & Quản lý lô hạn dùng FEFO',
    free: 'Không giới hạn',
    plus: 'Không giới hạn',
  },
  {
    feature: 'Kho 500+ Công thức chuẩn vị Bắc – Trung – Nam & Quốc tế',
    free: 'Toàn bộ 500+ món',
    plus: 'Toàn bộ 500+ món',
  },
  {
    feature: 'Đạo diễn Thực đơn Mâm cơm Tuần (Mặn · Canh · Xào)',
    free: 'Đầy đủ',
    plus: 'Đầy đủ + Ưu tiên giải cứu sâu',
  },
  {
    feature: 'Danh sách đi chợ thông minh & 1 chạm nhập kho',
    free: 'Đầy đủ',
    plus: 'Đầy đủ',
  },
  {
    feature: 'Chế độ Đứng Bếp Sanctuary (Multi-Timer, Wake Lock, Voice)',
    free: 'Đầy đủ',
    plus: 'Đầy đủ',
  },
  {
    feature: 'Đồng bộ hộ gia đình nhiều thành viên & Chế độ Ngoại tuyến',
    free: 'Tối đa 6 thành viên',
    plus: 'Tối đa 10 thành viên',
  },
  {
    feature: 'Quét AI Vision Tủ lạnh & OCR Hóa đơn siêu thị tự động',
    free: 'Nhập tay / duyệt mẫu cơ bản',
    plus: '100 lượt Quét AI & OCR / tháng',
    highlight: true,
  },
  {
    feature: 'Trợ lý AI Sous-Chef cứu nguy & thay thế nguyên liệu tức thì',
    free: 'Gợi ý quy tắc nền tảng',
    plus: 'Ưu tiên luồng AI tốc độ cao',
    highlight: true,
  },
] as const;

export const PricingPage: React.FC = () => {
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  return (
    <PublicLayout dataTestId="pricing-page">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-12 text-center space-y-5">
        <AtelierBadge tone="turmeric" icon={<CrownPlusIcon size={14} tone="turmeric" active />}>
          Bảng giá Minh Bạch · Không Quảng Cáo
        </AtelierBadge>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-tk-ink max-w-3xl mx-auto leading-[1.12]">
          Trọn vẹn căn bếp gia đình miễn phí. Nâng cấp khi bạn cần đôi mắt AI.
        </h1>
        <p className="text-base sm:text-lg text-tk-secondary max-w-2xl mx-auto leading-relaxed">
          Chỉ một ly cà phê mỗi tháng để tiết kiệm hàng trăm nghìn đồng thực phẩm bị bỏ quên trong
          tủ lạnh mỗi tuần.
        </p>

        <div className="pt-2 flex justify-center">
          <SegmentedTabs<BillingCycle>
            layoutId="pricing-cycle-tabs"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'monthly', label: 'Theo tháng (49.000đ)' },
              { value: 'annual', label: 'Theo năm (499.000đ)', badge: '-15%' },
            ]}
          />
        </div>
      </section>

      {/* Two Plan Cards */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Free Tier */}
          <BentoCard tone="ceramic" padding="lg" className="flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <AtelierBadge tone="jade" icon={<FreshnessShieldIcon size={14} tone="jade" active />}>
                  Dành cho mọi gia đình
                </AtelierBadge>
                <span className="text-xs font-bold text-tk-muted">Miễn phí trọn đời</span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-tk-ink">Takolio Miễn phí</h2>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-tk-ink tk-tabular">0đ</span>
                  <span className="text-sm font-semibold text-tk-muted">/ mãi mãi</span>
                </div>
                <p className="mt-2 text-sm text-tk-secondary leading-relaxed">
                  Đầy đủ công cụ quản lý tủ lạnh FEFO, lên thực đơn mâm cơm cả tuần và danh sách đi
                  chợ khép kín.
                </p>
              </div>

              <ul className="space-y-3 pt-2 text-sm text-tk-ink">
                {[
                  'Quản lý Tủ lạnh 3 ngăn FEFO không giới hạn mặt hàng',
                  'Trọn bộ 500+ công thức chuẩn vị Việt & quốc tế',
                  'Lập thực đơn Mâm cơm tuần (Mặn + Canh + Xào + Cơm)',
                  'Danh sách đi chợ tự động trừ tồn kho & 1 chạm nhập tủ',
                  'Chế độ nấu rảnh tay Sanctuary (Multi-Timer & Wake Lock)',
                  'Hoạt động mượt cả khi mất mạng (Offline-First)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4.5 h-4.5 text-tk-jade shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8">
              <ActionButton to="/auth?mode=register" variant="jade" size="lg" fullWidth>
                Bắt đầu miễn phí ngay
              </ActionButton>
            </div>
          </BentoCard>

          {/* Plus Tier */}
          <BentoCard
            tone="sanctuary"
            padding="lg"
            className="flex flex-col justify-between ring-2 ring-tk-flame"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <AtelierBadge tone="flame" icon={<CrownPlusIcon size={14} tone="flame" active />}>
                  Được yêu thích nhất
                </AtelierBadge>
                <span className="text-xs font-bold text-white/75">
                  {cycle === 'annual' ? 'Tiết kiệm 89.000đ/năm' : 'Linh hoạt từng tháng'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white">Takolio Plus</h2>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tk-tabular">
                    {cycle === 'annual' ? '499.000đ' : '49.000đ'}
                  </span>
                  <span className="text-sm font-semibold text-white/70">
                    {cycle === 'annual' ? '/ năm (~41.500đ/tháng)' : '/ tháng'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/80 leading-relaxed">
                  Tăng tốc nhập kho bằng Camera AI Vision & OCR hóa đơn siêu thị chỉ trong vài giây
                  sau mỗi buổi đi chợ.
                </p>
              </div>

              <div className="rounded-2xl bg-tk-sanctuary-elevated border border-white/12 p-3.5 flex items-center gap-3">
                <NavScanApertureIcon size={24} tone="flame" active />
                <div className="text-xs text-white/90 leading-relaxed">
                  <strong className="block text-sm text-white">
                    100 lượt Quét AI Vision & OCR Hóa đơn / tháng
                  </strong>
                  Chụp kệ tủ lạnh hoặc hóa đơn siêu thị dài — AI bóc tách tên món, khối lượng và gợi
                  ý hạn bảo quản tức thì.
                </div>
              </div>

              <ul className="space-y-3 pt-1 text-sm text-white/90">
                {[
                  'Bao gồm toàn bộ tính năng của gói Takolio Miễn phí',
                  '100 lượt Quét AI Vision thực phẩm tươi & OCR Hóa đơn/tháng',
                  'Bóc tách hóa đơn tiếng Việt từ siêu thị & chợ truyền thống',
                  'Ưu tiên tốc độ phản hồi cổng AI Sous-Chef giờ cao điểm',
                  'Chia sẻ hạn mức Plus cho các thành viên cùng hộ gia đình',
                  'Thanh toán VietQR / PayOS xác nhận tự động trong 5 giây',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4.5 h-4.5 text-tk-flame shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 space-y-3">
              <ActionButton
                to="/auth?mode=register&returnTo=%2Fplus"
                variant="flame"
                size="lg"
                fullWidth
                trailingIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />}
              >
                Nâng cấp Takolio Plus
              </ActionButton>
              <div className="flex items-center justify-center gap-2 text-xs text-white/70">
                <VietQRBadgeIcon size={16} tone="cream" active />
                <span>Hỗ trợ chuyển khoản VietQR Napas 24/7 qua PayOS</span>
              </div>
            </div>
          </BentoCard>
        </div>
      </section>

      {/* Detailed Feature Matrix */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-8">
        <BentoCard tone="ceramic" padding="md">
          <div className="flex items-center gap-2.5 mb-5">
            <ReceiptScanIcon size={22} tone="jade" active />
            <h2 className="text-xl font-extrabold text-tk-ink">So sánh chi tiết quyền lợi</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-tk-stone text-xs uppercase tracking-wider text-tk-muted">
                  <th className="py-3 pr-4 font-extrabold">Tính năng</th>
                  <th className="py-3 px-4 font-extrabold text-tk-ink">Miễn phí (0đ)</th>
                  <th className="py-3 pl-4 font-extrabold text-tk-flame-deep">Takolio Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tk-stone/60">
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className={row.highlight ? 'bg-tk-flame-soft/45' : undefined}
                  >
                    <td className="py-3.5 pr-4 font-semibold text-tk-ink">{row.feature}</td>
                    <td className="py-3.5 px-4 text-tk-secondary">{row.free}</td>
                    <td className="py-3.5 pl-4 font-bold text-tk-jade-deep">{row.plus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </section>
    </PublicLayout>
  );
};
