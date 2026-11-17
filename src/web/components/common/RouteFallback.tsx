import React from 'react';
import { TAKOLIO_BRAND } from '../../lib/takolio-brand';

/** Branded V4 Terra-Botanical Suspense fallback shown while a lazy route chunk loads. */
export const RouteFallback: React.FC = () => (
  <div
    className="min-h-dvh bg-tk-canvas text-tk-ink flex flex-col items-center justify-center gap-5 px-6"
    role="status"
    aria-live="polite"
    aria-label="Đang tải trang"
  >
    <div className="relative flex items-center justify-center w-22 h-22 rounded-[26px] bg-white border border-tk-stone/80 shadow-card">
      <img src={TAKOLIO_BRAND.symbol} alt="" width={64} height={64} className="w-16 h-16 object-contain" />
    </div>
    <div className="flex items-center gap-2.5 rounded-pill bg-white/90 border border-tk-stone/70 px-4 py-2 shadow-xs">
      <div className="animate-spin w-4.5 h-4.5 border-2 border-tk-flame border-t-transparent rounded-full motion-reduce:animate-none" />
      <p className="text-sm text-tk-secondary font-bold tracking-tight">Đang chuẩn bị gian bếp…</p>
    </div>
  </div>
);
