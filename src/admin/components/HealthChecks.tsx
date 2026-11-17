import clsx from 'clsx';
import type { AdminHealthCheck } from '@shared/admin';
import { vi } from '../i18n/vi';
import { Badge, type Tone } from './ui';

const HEALTH_TONE: Record<AdminHealthCheck['status'], Tone> = {
  ok: 'success',
  degraded: 'warning',
  error: 'danger',
  unavailable: 'neutral',
};

export function HealthCheckList({ checks, itemTestId }: { checks: AdminHealthCheck[]; itemTestId?: string }) {
  if (checks.length === 0) return <p className="muted">{vi.common.emptyBody}</p>;
  return (
    <ul className="check-list">
      {checks.map((check) => (
        <li key={check.key} className="check-item" data-testid={itemTestId}>
          <div className="check-head">
            <span className="check-title">
              <span
                className={clsx(
                  'status-dot',
                  check.status === 'ok' && 'is-ok',
                  check.status === 'degraded' && 'is-degraded',
                  check.status === 'error' && 'is-error',
                )}
                aria-hidden="true"
              />
              <strong>{check.label}</strong>
            </span>
            <Badge tone={HEALTH_TONE[check.status]}>{vi.labels.healthStatus[check.status]}</Badge>
          </div>
          <div className="check-meta">
            <Badge tone={check.observedBy === 'local' ? 'info' : 'warning'}>{vi.labels.observedBy[check.observedBy]}</Badge>
            <span className="mono muted">{check.key}</span>
            {check.detail ? <span className="muted">· {check.detail}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
