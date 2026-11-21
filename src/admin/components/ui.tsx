import clsx from 'clsx';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_RANGES, type AdminMetric, type AdminRange, ADMIN_PERMISSION_LABELS_VI, type AdminPermission } from '@shared/admin';
import { AdminApiError } from '../api/client';
import { errorMessage } from '../lib/errors';
import { vi } from '../i18n/vi';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** Crisp #111315 Sumi Octopus Monogram SVG for Admin Console brand lockups (AD01–AD11). */
export function SumiOctopusMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3.5C8.134 3.5 5 6.522 5 10.25C5 12.42 6.06 14.34 7.72 15.55C7.35 17.2 6.3 18.45 4.85 19.15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3.5C15.866 3.5 19 6.522 19 10.25C19 12.42 17.94 14.34 16.28 15.55C16.65 17.2 17.7 18.45 19.15 19.15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 15.9C9.65 17.9 8.95 19.45 7.85 20.35M14.2 15.9C14.35 17.9 15.05 19.45 16.15 20.35"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="10.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 data-testid="admin-page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  testId,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const headingId = useId();
  return (
    <section className="card section" aria-labelledby={headingId} data-testid={testId}>
      <div className="section-head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone = 'neutral', children, testId }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <span className={clsx('badge', `badge-${tone}`)} data-testid={testId}>
      {children}
    </span>
  );
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button type={type} className={clsx('btn', `btn-${variant}`, className)} {...rest} />;
}

export function Notice({
  tone = 'info',
  title,
  children,
  testId,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div className={clsx('notice', `notice-${tone}`)} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} data-testid={testId}>
      {title ? <strong>{title}</strong> : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function FixtureBanner({ fixtureDataset }: { fixtureDataset: string | null }) {
  if (!fixtureDataset) return null;
  return (
    <div className="fixture-banner" role="status" data-testid="admin-fixture-banner">
      {vi.fixture.banner(fixtureDataset)}
    </div>
  );
}

export function LoadingState({ rows = 3, label = vi.common.loading }: { rows?: number; label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ title = vi.common.emptyTitle, body = vi.common.emptyBody }: { title?: string; body?: string }) {
  return (
    <div className="state state-empty" data-testid="admin-empty-state">
      <h3>{title}</h3>
      <p className="muted">{body}</p>
    </div>
  );
}

export function PermissionDenied({ permission }: { permission?: AdminPermission }) {
  return (
    <div className="state state-denied" role="alert" data-testid="admin-permission-denied">
      <h1 data-testid="admin-page-title">{vi.permissionDenied.title}</h1>
      <p>{vi.permissionDenied.body}</p>
      {permission ? (
        <p data-testid="admin-permission-missing">
          {vi.permissionDenied.missing} <strong>{ADMIN_PERMISSION_LABELS_VI[permission]}</strong>
        </p>
      ) : null}
      <Link className="btn btn-secondary" to="/">
        {vi.permissionDenied.back}
      </Link>
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="state state-denied" role="alert" data-testid="admin-auth-not-configured">
      <h1 data-testid="admin-page-title">{vi.notConfigured.title}</h1>
      <p>{vi.notConfigured.body}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof AdminApiError) {
    if (error.code === 'ADMIN_FORBIDDEN') return <PermissionDenied />;
    if (error.code === 'ADMIN_AUTH_NOT_CONFIGURED') return <NotConfigured />;
  }
  return (
    <div className="state state-error" role="alert" data-testid="admin-error-state">
      <h2>{vi.common.errorTitle}</h2>
      <p>{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {vi.common.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {errorMessage(error)}
    </p>
  );
}

const STATUS_TONE: Record<AdminMetric['status'], Tone> = { ok: 'success', partial: 'warning', unavailable: 'neutral' };

export function MetricStatusBadge({ status }: { status: AdminMetric['status'] }) {
  return <Badge tone={STATUS_TONE[status]}>{vi.labels.status[status]}</Badge>;
}

export function RangeSelect({ value, onChange }: { value: AdminRange; onChange: (next: AdminRange) => void }) {
  const id = useId();
  return (
    <div className="field-inline">
      <label htmlFor={id}>{vi.common.rangeLabel}</label>
      <select id={id} data-testid="admin-range-select" value={value} onChange={(event) => onChange(event.target.value as AdminRange)}>
        {ADMIN_RANGES.map((range) => (
          <option key={range} value={range}>
            {vi.common.rangeOptions[range]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pagination" aria-label={vi.pagination.label}>
      <Button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        {vi.common.previous}
      </Button>
      <span className="muted" aria-live="polite">
        {vi.common.pageInfo(page, totalPages, total)}
      </span>
      <Button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        {vi.common.next}
      </Button>
    </nav>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="def-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NotFoundNotice() {
  return (
    <div className="state state-empty" data-testid="admin-not-found">
      <h1 data-testid="admin-page-title">{vi.notFound.title}</h1>
      <p className="muted">{vi.notFound.body}</p>
      <Link className="btn btn-secondary" to="/">
        {vi.notFound.back}
      </Link>
    </div>
  );
}
