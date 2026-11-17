import type { ReactNode } from 'react';
import { KitchenHeader, KitchenPageHeading } from './KitchenHeader';

export function AccountPage({
  title,
  description,
  eyebrow = 'Takolio · Bếp của bạn',
  action,
  children,
  backTo = '/me',
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  backTo?: string | null;
}) {
  return (
    <div className="account-page">
      <KitchenHeader backTo={backTo ?? undefined} />
      <div className="account-workspace">
        <KitchenPageHeading
          title={title}
          eyebrow={eyebrow}
          description={description}
          action={action}
        />
        <div className="account-body space-y-4">{children}</div>
      </div>
    </div>
  );
}
