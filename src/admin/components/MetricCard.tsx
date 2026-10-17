import { useId } from 'react';
import type { AdminMetric } from '@shared/admin';
import { formatByUnit } from '../lib/format';
import { vi } from '../i18n/vi';
import { MetricStatusBadge } from './ui';

export function MetricCard({ metric }: { metric: AdminMetric }) {
  const id = useId();
  const unavailable = metric.status === 'unavailable';
  return (
    <article className="card metric-card" data-testid={`admin-metric-${metric.key}`} aria-labelledby={`${id}-label`}>
      <header className="metric-head">
        <h3 id={`${id}-label`}>{metric.label}</h3>
        <MetricStatusBadge status={metric.status} />
      </header>
      <p className={`metric-value${unavailable ? ' is-muted' : ''}`}>
        {unavailable ? vi.common.notAvailable : formatByUnit(metric.value, metric.unit)}
      </p>
      {metric.note ? <p className="metric-note">{metric.note}</p> : null}
      <p className="metric-source">
        <span>{vi.common.source}: </span>
        <code>{metric.source}</code>
      </p>
      <details className="metric-definition">
        <summary>{vi.common.definitionToggle}</summary>
        <p>
          <strong>{vi.common.definition}: </strong>
          {metric.definition}
        </p>
      </details>
    </article>
  );
}
