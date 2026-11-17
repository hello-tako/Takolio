import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  AllergenShieldIcon,
  ClaypotBraiseIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  IngredientSwapIcon,
  MultiTimerIcon,
  NavFridgeIcon,
  NavScanApertureIcon,
  ReceiptScanIcon,
  ThreeDOrbitBadgeIcon,
  VoiceWaveTakoIcon,
  WakeLockSunIcon,
  ZoneCoolIcon,
} from '../../design-system/icons';

const PILLAR_SECTIONS = [
  {
    id: 'fefo-engine',
    badge: 'Lõi Quản Trị Tồn Kho',
    title: 'Động cơ Lô Hạn Dùng FEFO 3 Ngăn Không Gian',
    subtitle:
      'Không còn những túi rau úa vàng hay hộp thịt đông lạnh bị lãng quên sau cánh tủ.',
    image: '/takolio/v4/brand/smart-fridge-poster.webp',
    imageAlt: 'Mô hình 3D tủ lạnh thông minh 3 ngăn FEFO của Takolio',
    highlights: [
      {
        icon: ZoneCoolIcon,
        title: 'Phân tầng Ngăn mát · Ngăn đông · Tủ khô',
        desc: 'Mỗi nguyên liệu được lưu theo lô nhập kho thực tế và tự động xếp hạng ưu tiên xuất trước khi hạn dùng tới gần.',
      },
      {
        icon: FreshnessShieldIcon,
        title: 'Minh bạch 3 mức độ tin cậy hạn dùng',
        desc: 'Phân biệt rõ hạn in trên bao bì (Chính xác), hạn ước tính theo nhóm thực phẩm tươi sống (Ước tính) và chưa rõ hạn.',
      },
      {
        icon: ReceiptScanIcon,
        title: 'Quét AI kệ tủ & OCR Hóa đơn siêu thị',
        desc: 'Chụp hóa đơn WinMart, Co.opmart, Bách Hóa Xanh hoặc chụp trực tiếp ngăn tủ — bạn luôn kiểm tra và chỉnh sửa trước khi nhập kho.',
      },
    ],
  },
  {
    id: 'recipe-dag',
    badge: 'Đạo Diễn Mâm Cơm Việt',
    title: 'Đồ Thị Công Thức V4 DAG & Ghép Mâm Cơm Đa Nồi',
    subtitle:
      'Thiết kế riêng cho cấu trúc bữa cơm gia đình Việt: Mặn đậm đà, Canh thanh mát, Xào giòn ngọt.',
    image: '/takolio/v4/brand/mam-com-poster.webp',
    imageAlt: 'Mâm cơm gia đình Việt 3D với món kho, canh chua và rau xào',
    highlights: [
      {
        icon: HouseholdTrayIcon,
        title: 'Cân bằng vai trò dinh dưỡng & vùng miền',
        desc: 'Tự động phối hợp món chính, món canh, món rau theo khẩu vị Bắc – Trung – Nam và tận dụng chéo nguyên liệu sẵn có.',
      },
      {
        icon: ClaypotBraiseIcon,
        title: 'Lịch trình nấu song song tiết kiệm 35% thời gian',
        desc: 'Trong lúc nồi thịt kho liu riu 20 phút, Takolio nhắc bạn nhặt rau và đun nước canh để cả mâm chín nóng cùng lúc.',
      },
      {
        icon: AllergenShieldIcon,
        title: 'Khiên chắn dị ứng & nguyên liệu cấm tuyệt đối',
        desc: 'Loại trừ cứng hải sản giáp xác, đậu phộng, sữa, gluten hoặc nguyên liệu kiêng kỵ của từng thành viên ngay từ bước lập kế hoạch.',
      },
    ],
  },
] as const;

export const FeaturesPage: React.FC = () => {
  return (
    <PublicLayout dataTestId="features-page">
      {/* Hero Header */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-14">
        <div className="max-w-3xl space-y-5">
          <AtelierBadge
            tone="jade"
            icon={<ThreeDOrbitBadgeIcon size={14} tone="jade" active />}
          >
            Kiến trúc Bếp Không Gian Takolio V4
          </AtelierBadge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-tk-ink leading-[1.12]">
            Bốn trụ cột công nghệ đứng sau mỗi mâm cơm thảnh thơi.
          </h1>
          <p className="text-base sm:text-lg text-tk-secondary leading-relaxed">
            Takolio không chỉ là sổ tay công thức. Đây là hệ điều hành căn bếp gia đình kết hợp mô
            phỏng không gian 3D, quản lý hạn dùng chuẩn kho vận FEFO và trợ lý AI Sous-Chef hiểu
            tường tận gia vị Việt.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ActionButton
              to="/auth?mode=register"
              variant="flame"
              size="lg"
              trailingIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />}
            >
              Trải nghiệm miễn phí ngay
            </ActionButton>
            <ActionButton to="/pricing" variant="ceramic" size="lg">
              Xem gói Miễn phí & Plus
            </ActionButton>
          </div>
        </div>
      </section>

      {/* Deep-Dive Architectural Sections */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12 pb-16">
        {PILLAR_SECTIONS.map((section, idx) => (
          <BentoCard key={section.id} tone="ceramic" padding="lg" className="shadow-elevated">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className={idx % 2 === 1 ? 'lg:col-span-6 lg:order-2 space-y-5' : 'lg:col-span-6 space-y-5'}>
                <AtelierBadge tone={idx === 0 ? 'jade' : 'flame'}>{section.badge}</AtelierBadge>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-tk-ink">
                  {section.title}
                </h2>
                <p className="text-sm sm:text-base text-tk-secondary leading-relaxed">
                  {section.subtitle}
                </p>
                <div className="space-y-4 pt-2">
                  {section.highlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="flex items-start gap-3.5 rounded-2xl bg-tk-canvas border border-tk-stone/70 p-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white border border-tk-stone flex items-center justify-center shrink-0">
                          <Icon size={20} tone={idx === 0 ? 'jade' : 'flame'} active />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-tk-ink">{item.title}</h3>
                          <p className="mt-1 text-xs sm:text-sm text-tk-secondary leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={idx % 2 === 1 ? 'lg:col-span-6 lg:order-1' : 'lg:col-span-6'}>
                <div className="rounded-[26px] overflow-hidden border border-tk-stone bg-tk-sunken p-3 shadow-card">
                  <img
                    src={section.image}
                    alt={section.imageAlt}
                    loading="lazy"
                    className="w-full h-72 sm:h-96 object-cover rounded-[20px]"
                  />
                </div>
              </div>
            </div>
          </BentoCard>
        ))}
      </section>

      {/* Dark Sanctuary Cooking Mode & AI Sous-Chef Showcase */}
      <section className="tk-sanctuary-theme py-16 sm:py-20 my-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <AtelierBadge tone="dark" icon={<WakeLockSunIcon size={14} tone="cream" active />}>
                Active Cooking Sanctuary
              </AtelierBadge>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Không gian Đứng Bếp Tối Giản: Rảnh tay khi tay ướt, chuẩn lửa từng giây.
              </h2>
              <p className="text-sm sm:text-base text-white/75 leading-relaxed">
                Khi bước vào chế độ nấu, giao diện chuyển sang nền gang đen chống chói, chữ lớn rõ
                ràng từ khoảng cách 1 mét và giữ màn hình luôn sáng suốt buổi nấu.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 p-4 space-y-2">
                  <MultiTimerIcon size={22} tone="flame" active />
                  <h3 className="text-sm font-bold text-white">Multi-Timer Dock Đa Bếp</h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Theo dõi đồng thời nồi kho, nồi nước dùng và chảo xào trên một thanh neo duy nhất.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 p-4 space-y-2">
                  <VoiceWaveTakoIcon size={22} tone="cream" active />
                  <h3 className="text-sm font-bold text-white">Khẩu lệnh &quot;Tako&quot; rảnh tay</h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Chuyển bước tiếp theo, đặt hẹn giờ hoặc đọc lại định lượng gia vị không cần chạm màn hình.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 p-4 space-y-2">
                  <AiSousChefSparkIcon size={22} tone="cream" active />
                  <h3 className="text-sm font-bold text-white">Cổng AI Sous-Chef Cứu Nguy</h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Gợi ý xử lý ngay khi món bị quá lửa, thiếu nước cốt dừa hay cần điều chỉnh khẩu phần gấp.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 p-4 space-y-2">
                  <IngredientSwapIcon size={22} tone="flame" active />
                  <h3 className="text-sm font-bold text-white">Đổi nguyên liệu thông minh</h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Tự động đối chiếu tủ lạnh nhà bạn để đề xuất nguyên liệu thay thế tương đương hương vị.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-[28px] bg-tk-sanctuary-card border border-white/15 p-4 shadow-elevated space-y-4">
                <img
                  src="/takolio/v4/brand/cookware-stage-poster.webp"
                  alt="Sân khấu nồi đất và chảo gang 3D trong chế độ nấu Sanctuary"
                  loading="lazy"
                  className="w-full h-72 sm:h-84 object-cover rounded-[20px]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-tk-flame" aria-hidden="true" />
                    Tự động trừ tồn kho FEFO ngay khi hoàn tất bữa nấu
                  </span>
                  <span className="rounded-pill bg-white/10 px-3 py-1 font-bold tk-tabular">
                    60 FPS WebGL PBR
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closed-Loop CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-12">
        <BentoCard tone="sunken" padding="lg" className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-tk-stone flex items-center justify-center">
            <NavScanApertureIcon size={24} tone="flame" active />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-tk-ink">
            Sẵn sàng kết nối tủ lạnh và mâm cơm nhà bạn?
          </h2>
          <p className="text-sm sm:text-base text-tk-secondary max-w-xl mx-auto">
            Mọi tính năng quản lý tủ lạnh FEFO, 500+ công thức và lập thực đơn tuần đều hoàn toàn
            miễn phí cho mọi gia đình Việt.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <ActionButton
              to="/auth?mode=register"
              variant="flame"
              size="lg"
              icon={<NavFridgeIcon size={18} tone="cream" active />}
            >
              Tạo tài khoản gia đình miễn phí
            </ActionButton>
          </div>
        </BentoCard>
      </section>
    </PublicLayout>
  );
};
