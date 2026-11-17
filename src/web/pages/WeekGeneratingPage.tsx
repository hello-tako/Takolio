import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MealPlan } from '@frigo/domain';
import { useWeekStore } from '../stores/useWeekStore';
import { TakoChef3D } from '../components/3d/TakoChef3D';
import { WeekWorkspace } from '../features/week/WeekWorkspace';
import { capturePrivateSession, currentPrivateScope } from '../lib/private-session';
import { todayLocalIso } from '../lib/format';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { Button } from '../components/common/Button';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';

export const WeekGeneratingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setupDraft, generatePlan } = useWeekStore();
  const request = useRef<Promise<MealPlan> | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const isCurrent = capturePrivateSession();
    const { userId, householdId } = currentPrivateScope();
    if (!userId || !householdId) {
      setError(new Error('Vui lòng xác minh phiên trước khi tạo thực đơn.'));
      return;
    }
    request.current ??= generatePlan({
      householdId,
      startDate: todayLocalIso(),
      householdSize: setupDraft.householdSize || 2,
      mealSlotsPreset: setupDraft.mealSlotsPreset || 'dinner_only',
      budgetTargetVnd:
        setupDraft.budgetTargetVnd !== undefined ? setupDraft.budgetTargetVnd : 750000,
      priorities: setupDraft.priorities || ['use_fridge'],
      shoppingFrequency: setupDraft.shoppingFrequency || 'once',
    });
    void request.current
      .then((plan) => {
        if (!cancelled && isCurrent()) navigate(`/week/${plan.id}`, { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled && isCurrent()) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [generatePlan, navigate, setupDraft]);

  return (
    <WeekWorkspace
      title={error ? 'Chưa tạo được thực đơn.' : 'Đang lên thực đơn cho tuần của bạn…'}
      narrow
      description="Thực đơn là kế hoạch dự kiến. Nguyên liệu trong tủ chỉ thay đổi khi bạn xác nhận mua thêm hoặc nấu."
    >
      <BentoCard
        tone="ceramic"
        padding="lg"
        className="week-paper week-generating flex flex-col items-center text-center space-y-4"
        aria-busy={!error}
      >
        <TakoChef3D pose={error ? 'wave' : 'think'} size={156} />
        {error ? (
          <div className="w-full space-y-3">
            <InlineError error={error} />
            <Button className="mt-2" onClick={() => navigate('/week/setup', { replace: true })}>
              Quay lại thiết lập
            </Button>
          </div>
        ) : (
          <InlineLoading label="Đang chờ kết quả tạo thực đơn…" />
        )}
        <p className="week-muted max-w-md text-xs leading-relaxed text-tk-secondary">
          Bạn có thể quay lại thực đơn tuần. Yêu cầu đang gửi có thể vẫn hoàn tất.
        </p>
      </BentoCard>
    </WeekWorkspace>
  );
};
