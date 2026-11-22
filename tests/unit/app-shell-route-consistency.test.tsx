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

describe('vNext ConsumerStudioShell 5-destination Brand Board navigation consistency', () => {
  it.each([
    ['/', 'Trang chủ'],
    ['/recipes', 'Trang chủ'],
    ['/recipes/thit-kho-trung', 'Trang chủ'],
    ['/fridge', 'Tủ lạnh'],
    ['/fridge/lot-1', 'Tủ lạnh'],
    ['/scan', 'Tủ lạnh'],
    ['/planner', 'Thực đơn'],
    ['/planner/new', 'Thực đơn'],
    ['/shopping', 'Mua sắm'],
    ['/me', 'Cá nhân'],
    ['/settings/privacy', 'Cá nhân'],
    ['/plus', 'Cá nhân'],
    ['/notifications', 'Cá nhân'],
  ])('highlights %s under its canonical 5-root destination (%s)', (route, expectedActiveLabel) => {
    const roots = getConsumerRoots();
    expect(roots).toHaveLength(5);
    expect(roots.map((r) => r.label)).toEqual([
      'Trang chủ',
      'Tủ lạnh',
      'Thực đơn',
      'Mua sắm',
      'Cá nhân',
    ]);

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
