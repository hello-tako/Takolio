// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { TakoMascot } from '../../src/web/components/common/TakoMascot';
import { TAKOLIO_BRAND } from '../../src/web/lib/takolio-brand';
import { TAKOSAN_BRAND } from '../../src/web/lib/takosan-brand';

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); vi.unstubAllGlobals(); });

it('retains the single compatibility contract and original vector paths for protected consumers', () => {
  expect(TAKOSAN_BRAND).toBe(TAKOLIO_BRAND);
  expect(TAKOLIO_BRAND.mascot.celebrate).toBe('/takolio/v1/mascot/tako-cheering.svg');
  expect(TAKOLIO_BRAND.logos.horizontal).toBe('/takolio/v1/logo/horizontal-primary.svg');
  expect(renderToStaticMarkup(<TakoMascot pose="cooking" size={128} />)).toContain('alt="" aria-hidden="true" width="128" height="128"');
});

it('keeps small mascot uses in vector form', () => {
  const html = renderToStaticMarkup(<TakoMascot pose="wave" size={64} />);
  expect(html).not.toContain('<source');
  expect(html).toContain(TAKOLIO_BRAND.mascot.wave);
});

it('removes a failed raster source and recovers to SVG without losing the pose or reserved size', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  cleanup = async () => { await act(async () => root.unmount()); host.remove(); };
  await act(async () => root.render(<TakoMascot pose="thinking" size={128} />));
  expect(host.querySelector('source')?.getAttribute('srcset')).toContain('tako-thinking-512.webp');
  await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(host.querySelector('source')).toBeNull();
  expect(host.querySelector('img')?.getAttribute('src')).toBe(TAKOLIO_BRAND.mascot.thinking);
  expect(host.querySelector('img')?.getAttribute('width')).toBe('128');
  await act(async () => root.render(<TakoMascot pose="cooking" size={128} />));
  expect(host.querySelector('source')?.getAttribute('srcset')).toContain('tako-cooking-512.webp');
});
