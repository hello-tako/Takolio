import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface WebGlViewportSize {
  width: number;
  height: number;
  dpr: number;
}

export interface UseWebGlLifecycleOptions {
  /** Minimum intersection ratio before pausing requestAnimationFrame. Defaults to 0.05. */
  minIntersectionRatio?: number;
  /** Initial width used prior to ResizeObserver measurement (e.g. SSR/JSDOM). */
  fallbackWidth?: number;
  /** Initial height used prior to ResizeObserver measurement (e.g. SSR/JSDOM). */
  fallbackHeight?: number;
}

export interface UseWebGlLifecycleResult {
  containerRef: React.RefObject<HTMLDivElement>;
  webglSupported: boolean;
  isInView: boolean;
  isPageVisible: boolean;
  prefersReducedMotion: boolean;
  shouldAnimate: boolean;
  size: WebGlViewportSize;
}

let cachedWebGlSupport: boolean | null = null;

/**
 * Safely probes WebGL / WebGL2 availability without throwing in JSDOM, Vitest,
 * or GPU-restricted headless browsers.
 */
export function detectWebGlSupport(): boolean {
  if (cachedWebGlSupport !== null) {
    return cachedWebGlSupport;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    if (
      typeof window.WebGLRenderingContext === 'undefined' &&
      typeof window.WebGL2RenderingContext === 'undefined'
    ) {
      cachedWebGlSupport = false;
      return false;
    }
    const probeCanvas = document.createElement('canvas');
    const gl =
      probeCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      probeCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      cachedWebGlSupport = false;
      return false;
    }
    // Release the temporary probe context cleanly if the extension exists
    const loseExt = (gl as WebGLRenderingContext).getExtension?.('WEBGL_lose_context');
    loseExt?.loseContext();
    cachedWebGlSupport = true;
    return true;
  } catch {
    cachedWebGlSupport = false;
    return false;
  }
}

function computeAdaptiveDpr(width: number): number {
  if (typeof window === 'undefined') return 1;
  const rawDpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1;
  const cap = width < 640 ? 1.5 : 2;
  return Math.min(rawDpr, cap);
}

function readInitialReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

function readInitialPageVisibility(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/**
 * Shared lifecycle controller for Takolio WebGL stages:
 * - IntersectionObserver (pauses RAF when < 5% visible)
 * - document.visibilitychange (pauses RAF when tab hidden)
 * - prefers-reduced-motion media query listener
 * - ResizeObserver with adaptive DPR (<= 1.5 on compact viewports, <= 2 on desktop)
 * - JSDOM-safe WebGL availability detection
 */
export function useWebGlLifecycle(
  options: UseWebGlLifecycleOptions = {},
): UseWebGlLifecycleResult {
  const {
    minIntersectionRatio = 0.05,
    fallbackWidth = 640,
    fallbackHeight = 380,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(() => detectWebGlSupport());
  const [isInView, setIsInView] = useState<boolean>(true);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() => readInitialPageVisibility());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    readInitialReducedMotion(),
  );
  const [size, setSize] = useState<WebGlViewportSize>(() => ({
    width: fallbackWidth,
    height: fallbackHeight,
    dpr: computeAdaptiveDpr(fallbackWidth),
  }));

  useEffect(() => {
    setWebglSupported(detectWebGlSupport());
  }, []);

  // Page visibility listener
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Reduced motion media query listener
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    if (!mql) return undefined;

    setPrefersReducedMotion(mql.matches);
    const onMotionChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onMotionChange);
      return () => mql?.removeEventListener('change', onMotionChange);
    }
    return undefined;
  }, []);

  // IntersectionObserver (< minIntersectionRatio pauses RAF)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          setIsInView(
            entry.isIntersecting && entry.intersectionRatio >= minIntersectionRatio,
          );
        },
        {
          threshold: [0, minIntersectionRatio, 0.25],
        },
      );
      observer.observe(el);
    } catch {
      setIsInView(true);
    }

    return () => {
      observer?.disconnect();
    };
  }, [minIntersectionRatio]);

  // ResizeObserver with adaptive DPR
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const updateFromElement = (rawWidth: number, rawHeight: number) => {
      const width = Math.max(1, Math.round(rawWidth || fallbackWidth));
      const height = Math.max(1, Math.round(rawHeight || fallbackHeight));
      const dpr = computeAdaptiveDpr(width);
      setSize((prev) => {
        if (prev.width === width && prev.height === height && prev.dpr === dpr) {
          return prev;
        }
        return { width, height, dpr };
      });
    };

    const rect = el.getBoundingClientRect();
    updateFromElement(
      rect.width || el.clientWidth || fallbackWidth,
      rect.height || el.clientHeight || fallbackHeight,
    );

    if (typeof ResizeObserver !== 'undefined') {
      try {
        const ro = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          updateFromElement(entry.contentRect.width, entry.contentRect.height);
        });
        ro.observe(el);
        return () => ro.disconnect();
      } catch {
        // Fall through to window resize listener if ResizeObserver fails
      }
    }

    if (typeof window !== 'undefined') {
      const onResize = () => {
        const nextRect = el.getBoundingClientRect();
        updateFromElement(
          nextRect.width || el.clientWidth || fallbackWidth,
          nextRect.height || el.clientHeight || fallbackHeight,
        );
      };
      window.addEventListener('resize', onResize, { passive: true });
      return () => window.removeEventListener('resize', onResize);
    }

    return undefined;
  }, [fallbackWidth, fallbackHeight]);

  const shouldAnimate =
    webglSupported && isInView && isPageVisible && !prefersReducedMotion;

  return {
    containerRef,
    webglSupported,
    isInView,
    isPageVisible,
    prefersReducedMotion,
    shouldAnimate,
    size,
  };
}
