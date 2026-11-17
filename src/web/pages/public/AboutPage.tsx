import React from 'react';
import { ArrowRight } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../../design-system/v4/AtelierPrimitives';
import {
  ClaypotBraiseIcon,
  FreshnessShieldIcon,
  HerbSprigIcon,
  HouseholdTrayIcon,
} from '../../design-system/icons';
import { TakoChef3D } from '../../components/3d';

const PRINCIPLES = [
  {
    icon: FreshnessShieldIcon,
    tone: 'jade' as const,
    title: 'Trân quý từng nhánh rau, lát cá',
    description:
      'Mỗi hộ gia đình đô thị Việt Nam vô tình bỏ đi hàng triệu đồng thực phẩm mỗi năm chỉ vì khuất tầm mắt trong tủ lạnh. Takolio đưa những nguyên liệu sắp hết hạn ra ánh sáng để biến chúng thành món ngon đúng lúc.',
  },
  {
    icon: HouseholdTrayIcon,
    tone: 'flame' as const,
    title: 'Tôn vinh cấu trúc Mâm Cơm Gia Đình Việt',
    description:
      'Người Việt không ăn từng đĩa rời rạc như phương Tây. Một bữa tối ấm bụng cần bát canh chua thanh nhiệt, đĩa thịt kho đậm vị và đĩa rau luộc xanh mướt chấm nước mắm tỏi ớt.',
  },
  {
    icon: ClaypotBraiseIcon,
    tone: 'turmeric' as const,
    title: 'AI khiêm nhường — Người nội trợ giữ quyền quyết định',
    description:
      'AI của Takolio gợi ý định lượng, hạn dùng và thực đơn để giảm gánh nặng suy nghĩ, nhưng luôn để bạn kiểm tra, gia giảm và phê duyệt cuối cùng theo đúng nếp nhà mình.',
  },
];

export const AboutPage: React.FC = () => {
  return (
    <PublicLayout dataTestId="about-page">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <AtelierBadge tone="jade" icon={<HerbSprigIcon size={14} tone="jade" active />}>
              Triết Lý Terra-Botanical Atelier
            </AtelierBadge>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-tk-ink leading-[1.12]">
              Khi công nghệ mang hơi ấm của gốm Bát Tràng và lửa bếp chiều quê.
            </h1>
            <p className="text-base sm:text-lg text-tk-secondary leading-relaxed">
              Câu hỏi khó nhất lúc 5 giờ chiều không phải là nấu như thế nào, mà là{' '}
              <strong className="text-tk-ink">&quot;Tối nay nhà mình ăn gì từ đống đồ còn trong tủ?&quot;</strong>{' '}
              Takolio ra đời để giải phóng nỗi mệt mỏi vô hình đó cho hàng triệu căn bếp Việt.
            </p>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <BentoCard
              tone="ceramic"
              padding="md"
              className="w-full max-w-sm flex flex-col items-center text-center space-y-3"
            >
              <TakoChef3D pose="cook" size={210} interactive />
              <p className="text-sm font-extrabold text-tk-ink">
                Đầu bếp Tako — Người bạn giữ lửa gian bếp
              </p>
              <p className="text-xs text-tk-secondary leading-relaxed">
                Luôn nhớ từng quả cà chua chín, nhắc đúng giờ tắt bếp và không bao giờ phán xét bữa
                cơm bận rộn của bạn.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* Three Culinary Principles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRINCIPLES.map((item) => {
            const Icon = item.icon;
            return (
              <BentoCard key={item.title} tone="ceramic" padding="lg" className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-tk-sunken border border-tk-stone flex items-center justify-center">
                  <Icon size={24} tone={item.tone} active />
                </div>
                <h2 className="text-xl font-extrabold text-tk-ink">{item.title}</h2>
                <p className="text-sm text-tk-secondary leading-relaxed">{item.description}</p>
              </BentoCard>
            );
          })}
        </div>
      </section>

      {/* Culinary Editorial Strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-8">
        <BentoCard tone="sunken" padding="lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <img
                src="/takolio/v4/dishes/vn-steamed-rice-tray.webp"
                alt="Mâm cơm truyền thống Việt Nam trên khay gỗ ấm cúng"
                loading="lazy"
                className="w-full h-64 sm:h-72 object-cover rounded-[22px] border border-tk-stone shadow-card"
              />
            </div>
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-tk-ink">
                Mỗi bữa cơm nhà là một lần sum vầy trọn vẹn.
              </h2>
              <p className="text-sm sm:text-base text-tk-secondary leading-relaxed">
                Từ ngôn ngữ thiết kế gốm sứ mộc mạc, màu xanh lá thảo mộc đến sắc đỏ lửa bếp ấm áp,
                từng chi tiết trên Takolio V4 được chế tác để bạn cảm thấy thư thái ngay khoảnh khắc
                mở ứng dụng giữa gian bếp.
              </p>
              <div className="pt-2">
                <ActionButton
                  to="/landing"
                  variant="flame"
                  size="lg"
                  trailingIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />}
                >
                  Khám phá Gian Bếp 3D
                </ActionButton>
              </div>
            </div>
          </div>
        </BentoCard>
      </section>
    </PublicLayout>
  );
};
