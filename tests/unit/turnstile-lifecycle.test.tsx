// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget } from '../../src/web/components/common/TurnstileWidget';

describe('Turnstile widget generation fencing', () => {
  let root: Root;
  let host: HTMLDivElement;
  let options: Record<string, unknown>;
  const render = vi.fn((_element: HTMLElement, value: Record<string, unknown>) => {
    options = value;
    return 'widget-1';
  });
  const remove = vi.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    window.turnstile = { render, remove, reset: vi.fn() };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    delete window.turnstile;
    vi.clearAllMocks();
  });
  it('updates the consumer callback without destroying a live challenge', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await act(async () => root.render(<TurnstileWidget siteKey="site" onToken={first} />));
    await act(async () => root.render(<TurnstileWidget siteKey="site" onToken={second} />));
    expect(render).toHaveBeenCalledTimes(1);
    await act(async () => (options.callback as (token: string) => void)('current-token'));
    expect(second).toHaveBeenLastCalledWith('current-token');
    expect(first).not.toHaveBeenCalled();
  });
  it('rejects late success and error callbacks after unmount', async () => {
    const onToken = vi.fn();
    await act(async () => root.render(<TurnstileWidget siteKey="site" onToken={onToken} />));
    await act(async () => root.render(null));
    onToken.mockClear();
    (options.callback as (token: string) => void)('late-token');
    (options['error-callback'] as () => void)();
    expect(onToken).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('invalidates an old site key and ignores its asynchronous receipt', async () => {
    const onToken = vi.fn();
    await act(async () => root.render(<TurnstileWidget siteKey="first" onToken={onToken} />));
    const oldOptions = options;
    await act(async () => root.render(<TurnstileWidget siteKey="second" onToken={onToken} />));
    onToken.mockClear();
    (oldOptions.callback as (token: string) => void)('old-site-token');
    expect(onToken).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(2);
  });
});
