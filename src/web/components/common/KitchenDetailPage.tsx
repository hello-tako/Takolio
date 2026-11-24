import type { ReactNode } from 'react';
import { useLocaleText } from '../../i18n/app-i18n';
import { KitchenHeader, KitchenPageHeading } from './KitchenHeader';

export function KitchenDetailPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const { l } = useLocaleText();
  return (
    <div className="stock-detail-page">
      <KitchenHeader backTo="/fridge" backLabel={l('Về tủ lạnh', 'Back to fridge')} />
      <div className="stock-detail-workspace">
        <KitchenPageHeading title={title} eyebrow={l('Tủ của bạn', 'Your fridge')} description={description} />
        <div className="stock-detail-body">{children}</div>
      </div>
    </div>
  );
}
