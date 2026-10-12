import clsx from 'clsx';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_RANGES, type AdminMetric, type AdminRange } from '@shared/admin';
import { AdminApiError } from '../api/client';
import { errorMessage } from '../lib/errors';
import { vi } from '../i18n/vi';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

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

export function PermissionDenied() {
  return (
    <div className="state state-denied" role="alert" data-testid="admin-permission-denied">
      <h1 data-testid="admin-page-title">{vi.permissionDenied.title}</h1>
      <p>{vi.permissionDenied.body}</p>
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
