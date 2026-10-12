import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
const LOAD_TIMEOUT_MS = 15_000;
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (window.onTurnstileLoad === loaded) delete window.onTurnstileLoad;
      script.onerror = null;
      if (error) {
        scriptPromise = null;
        script.remove();
        reject(error);
      } else resolve();
    };
    const loaded = () => finish(window.turnstile ? undefined : new Error('Turnstile API unavailable'));
    const timer = setTimeout(() => finish(new Error('Turnstile load deadline')), LOAD_TIMEOUT_MS);
    window.onTurnstileLoad = loaded;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => finish(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string | null) => void;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ siteKey, onToken }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [ready, setReady] = useState(Boolean(window.turnstile));

  useEffect(() => {
    let active = true;
    if (!ready) {
      loadTurnstileScript()
        .then(() => { if (active) setReady(true); })
        .catch(() => { if (active) onTokenRef.current(null); });
    }
    return () => { active = false; };
  }, [ready]);

  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !api || !containerRef.current) return;
    let active = true;
    let widgetId: string | undefined;
    // Consumer rerenders must not restart a challenge; old generations cannot publish.
    const publish = (token: string | null) => { if (active) onTokenRef.current(token); };
    try {
      widgetId = api.render(containerRef.current, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (token: string) => publish(token),
        'expired-callback': () => publish(null),
        'error-callback': () => publish(null),
        'timeout-callback': () => publish(null),
      });
    } catch {
      publish(null);
    }
    return () => {
      active = false;
      onTokenRef.current(null);
      if (widgetId !== undefined) {
        try { api.remove(widgetId); } catch { /* The SDK may already have removed its frame. */ }
      }
    };
  }, [ready, siteKey]);

  return <div ref={containerRef} className="cf-turnstile" />;
};
