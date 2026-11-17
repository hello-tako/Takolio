import type { ReactNode } from 'react';
import { KitchenHeader, KitchenPageHeading } from '../../components/common/KitchenHeader';

export function WeekWorkspace({
  title,
  description,
  backTo = '/week',
  action,
  narrow = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  backTo?: string;
  action?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="week-workspace min-h-screen bg-tk-canvas text-tk-ink">
      <KitchenHeader backTo={backTo} backLabel="Quay lại thực đơn tuần" />
      <div
        className={`week-body mx-auto px-4 pb-24 pt-4 sm:px-6 ${
          narrow ? 'week-body-narrow max-w-2xl' : 'max-w-6xl'
        }`}
      >
        <KitchenPageHeading
          eyebrow="BẾP NHÀ / THỰC ĐƠN TUẦN"
          title={title}
          description={description}
          action={action}
        />
        <div className="mt-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export const weekCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

export const weekDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );

export const mealLabels = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' };
