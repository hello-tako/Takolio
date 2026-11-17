import React from 'react';
import { CookingReview } from '../components/cooking/CookingReview';
import { useCookingStore } from '../stores/useCookingStore';
import { ActionButton, BentoCard } from '../design-system/v4/AtelierPrimitives';
import { NavRecipesIcon, TakolioWordmarkLockup } from '../design-system/icons';
import { TakoChef3D } from '../components/3d';

export const CookingCompletePage: React.FC = () => {
  const runId = useCookingStore((state) => state.runId);
  if (runId) {
    return <CookingReview key={runId} />;
  }

  return (
    <div className="cooking-empty min-h-dvh bg-tk-canvas flex flex-col items-center justify-center p-6">
      <BentoCard tone="ceramic" padding="lg" className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <TakolioWordmarkLockup size={30} tone="ink" />
        </div>
        <div className="flex justify-center">
          <TakoChef3D pose="cook" size={140} interactive={false} />
        </div>
        <span className="cooking-eyebrow inline-block text-xs font-extrabold uppercase tracking-wider text-tk-flame">
          Takolio · Bếp nhà thông minh
        </span>
        <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-tk-ink">
          Không có món ăn đang hoàn tất
        </h1>
        <p className="text-sm text-tk-secondary leading-relaxed">
          Chọn một công thức yêu thích và bắt đầu nấu để kiểm tra lượng nguyên liệu thực dùng trong tủ lạnh.
        </p>
        <div className="pt-2">
          <ActionButton
            variant="flame"
            size="lg"
            fullWidth
            icon={<NavRecipesIcon size={18} tone="cream" />}
            to="/recipes"
          >
            Xem công thức
          </ActionButton>
        </div>
      </BentoCard>
    </div>
  );
};
