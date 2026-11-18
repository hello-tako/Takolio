import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsumerStudioShell, getConsumerRoots } from '../../src/web/vnext/components/Shells';

const render = (route: string) =>
  renderToStaticMarkup(
    <StaticRouter location={route}>
      <ConsumerStudioShell screenId="C01">
        <div>Nội dung kiểm thử</div>
      </ConsumerStudioShell>
    </StaticRouter>,
  );

describe('vNext ConsumerStudioShell 5-destination navigation consistency', () => {
  it.each([
    ['/', 'Hôm nay'],
    ['/fridge', 'Tủ lạnh'],
    ['/fridge/lot-1', 'Tủ lạnh'],
    ['/recipes', 'Món ăn'],
    ['/recipes/thit-kho-trung', 'Món ăn'],
    ['/planner', 'Thực đơn'],
    ['/planner/new', 'Thực đơn'],
    ['/me', 'Tôi'],
    ['/settings/privacy', 'Tôi'],
    ['/plus', 'Tôi'],
    ['/notifications', 'Tôi'],
  ])('highlights %s under its canonical 5-root destination (%s)', (route, expectedActiveLabel) => {
    const roots = getConsumerRoots();
    expect(roots).toHaveLength(5);
    expect(roots.map((r) => r.label)).toEqual(['Hôm nay', 'Tủ lạnh', 'Món ăn', 'Thực đơn', 'Tôi']);

    const html = render(route);
    for (const r of roots) {
      expect(html).toContain(r.label);
    }
    const activeMatches = roots.filter((r) => r.match(route));
    expect(activeMatches).toHaveLength(1);
    expect(activeMatches[0].label).toBe(expectedActiveLabel);
    expect(html).toContain('aria-current="page"');
  });
});
