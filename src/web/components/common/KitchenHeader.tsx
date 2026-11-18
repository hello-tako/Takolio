import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Minimal accessible back-link anchor for standalone domain detail views (hidden inside ConsumerStudioShell). */
export function KitchenHeader({
  backTo,
  backLabel = 'Quay lại',
}: {
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <header className="kitchen-header">
      {backTo && (
        <Link to={backTo} aria-label={backLabel} className="kitchen-icon-link">
          {backLabel}
        </Link>
      )}
      <Link to="/scan" className="kitchen-header-scan">
        Quét nguyên liệu
      </Link>
    </header>
  );
}

export function KitchenPageHeading({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="kitchen-page-heading">
      <div className="min-w-0">
        {eyebrow && <p className="kitchen-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && (
          <div className="mt-2 text-sm text-semantic-text-secondary">{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}
