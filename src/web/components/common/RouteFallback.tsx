import React from 'react';

/** Branded Suspense fallback shown while a lazy route chunk loads. */
export const RouteFallback: React.FC = () => (
  <div
    className="takosan-rebuild min-h-dvh flex flex-col items-center justify-center gap-4"
    role="status"
    aria-live="polite"
    aria-label="Đang tải trang"
  >
    <img src="/takolio/vnext/mascot/pose-01-welcome.webp" alt="" width={64} height={64} className="w-16 h-16" />
    <div className="animate-spin w-7 h-7 border-2 border-takosan-green border-t-transparent rounded-full motion-reduce:animate-none" />
    <p className="text-base text-semantic-text-muted font-medium">Đang tải…</p>
  </div>
);
