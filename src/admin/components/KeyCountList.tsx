import { EmptyState } from './ui';
import { vi } from '../i18n/vi';

export function KeyCountList({
  items,
  labelOf,
}: {
  items: Array<{ key: string; count: number }>;
  labelOf?: (key: string) => string;
}) {
  if (items.length === 0) return <EmptyState title={vi.common.emptyTitle} body={vi.ai.noRows} />;
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <ul className="count-list">
      {items.map((item) => {
        const sharePct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const barWidth = total > 0 ? Math.max(item.count > 0 ? 4 : 0, (item.count / total) * 100) : 0;
        return (
          <li key={item.key}>
            <div className="count-row-top">
              <span>{labelOf ? labelOf(item.key) : item.key}</span>
              <span className="count-row-meta">
                <strong>{item.count.toLocaleString('vi-VN')}</strong>
                {total > 0 ? <span className="count-share">({sharePct}%)</span> : null}
              </span>
            </div>
            <div className="count-bar-track" aria-hidden="true">
              <div className="count-bar-fill" style={{ width: `${barWidth}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
