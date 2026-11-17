import React, { useEffect, useState } from 'react';
import { Clock3, LoaderCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { TakoChef3D } from '../3d';
import { AiSousChefSparkIcon } from '../../design-system/icons';

export type ScanProcessingStage = 'uploading' | 'queued' | 'analyzing' | 'validating' | 'preparing';

const STAGES: ReadonlyArray<{ id: ScanProcessingStage; label: string }> = [
  { id: 'uploading', label: 'Đang gửi ảnh' },
  { id: 'queued', label: 'Đã xếp hàng xử lý' },
  { id: 'analyzing', label: 'AI đang đọc nội dung' },
  { id: 'validating', label: 'Đang kiểm tra kết quả' },
  { id: 'preparing', label: 'Đang chuẩn bị kết quả' },
];

const STAGE_INDEX: Record<ScanProcessingStage, number> = {
  uploading: 0,
  queued: 1,
  analyzing: 2,
  validating: 3,
  preparing: 4,
};

interface ScanProcessingStateProps {
  stage?: ScanProcessingStage;
  kind?: 'fridge' | 'receipt';
  compact?: boolean;
}

export const ScanProcessingState: React.FC<ScanProcessingStateProps> = ({
  stage = 'analyzing',
  kind = 'fridge',
  compact = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setElapsedSeconds(elapsed);
      if (elapsed >= 90) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentIndex = STAGE_INDEX[stage];
  const noun = kind === 'receipt' ? 'hóa đơn' : 'nguyên liệu';

  return (
    <div
      data-testid="scan-processing-state"
      className={clsx(
        'rounded-[24px] border border-tk-stone/85 bg-white text-tk-ink shadow-elevated',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {STAGES[currentIndex].label}.
      </p>

      <div className="flex items-center gap-4">
        {/* 3D Tako Chef in Radar Scan Pose */}
        <div className="shrink-0">
          <TakoChef3D pose="scan" size={compact ? 68 : 88} interactive={false} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-sm sm:text-base font-extrabold text-tk-ink">
              Đang xử lý {noun}…
            </p>
            <AiSousChefSparkIcon
              size={18}
              tone="flame"
              active
              className="scan-processing-motion motion-safe:animate-pulse"
            />
          </div>
          <p className="text-xs sm:text-sm text-tk-secondary leading-relaxed">
            Bạn có thể chờ ở màn hình này; kết quả chỉ hiện khi AI xử lý xong và đã được kiểm tra.
          </p>

          {/* Visual 5-segment progress track (no inactive stage text rendered) */}
          <div aria-hidden="true" className="grid grid-cols-5 gap-1.5 pt-1">
            {STAGES.map((s, idx) => (
              <span
                key={s.id}
                className={clsx(
                  'h-1.5 rounded-full transition-colors',
                  idx <= currentIndex ? 'bg-tk-flame' : 'bg-tk-sunken',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-tk-sunken/70 px-3.5 py-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-bold text-tk-ink" aria-label="Trạng thái bản quét">
          <LoaderCircle
            className="h-4 w-4 text-tk-flame scan-processing-motion motion-safe:animate-spin"
            aria-hidden="true"
          />
          <span>{STAGES[currentIndex].label}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-tk-muted tk-tabular">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Đã chờ {elapsedSeconds < 1 ? 'dưới 1 giây' : `${elapsedSeconds} giây`}</span>
          <span aria-hidden="true">·</span>
          <span>Kết quả chưa sẵn sàng</span>
        </div>
      </div>
    </div>
  );
};
