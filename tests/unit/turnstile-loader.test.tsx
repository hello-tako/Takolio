// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); delete window.turnstile; delete window.onTurnstileLoad; });
describe('bounded Turnstile SDK loader', () => {
  it('times out, clears only its owned script, and permits a later mount to retry', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.resetModules(); vi.useFakeTimers();
    const { TurnstileWidget } = await import('../../src/web/components/common/TurnstileWidget');
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host); const token = vi.fn();
    await act(async () => root.render(<TurnstileWidget siteKey="test" onToken={token} />));
    const scripts = () => document.querySelectorAll('script[src*="challenges.cloudflare.com"]');
    expect(scripts()).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(token).toHaveBeenLastCalledWith(null);
    expect(scripts()).toHaveLength(0);
    await act(async () => root.render(null));
    await act(async () => root.render(<TurnstileWidget siteKey="test" onToken={token} />));
    expect(scripts()).toHaveLength(1);
    await act(async () => root.unmount()); host.remove();
    await vi.advanceTimersByTimeAsync(15000);
    expect(scripts()).toHaveLength(0);
  });
});
