import { EmptyState } from './ui';
import { vi } from '../i18n/vi';

export function KeyCountList({ items, labelOf }: { items: Array<{ key: string; count: number }>; labelOf?: (key: string) => string }) {
  if (items.length === 0) return <EmptyState title={vi.common.emptyTitle} body={vi.ai.noRows} />;
  return (
    <ul className="count-list">
      {items.map((item) => (
        <li key={item.key}>
          <span>{labelOf ? labelOf(item.key) : item.key}</span>
          <strong>{item.count.toLocaleString('vi-VN')}</strong>
        </li>
      ))}
    </ul>
  );
}
