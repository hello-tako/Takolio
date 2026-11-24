import React, { useEffect, useState } from 'react';
import { Clock3, LoaderCircle, ScanLine, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocaleText } from '../../i18n/app-i18n';

export type ScanProcessingStage = 'uploading' | 'queued' | 'analyzing' | 'validating' | 'preparing';

const STAGES: ReadonlyArray<{ id: ScanProcessingStage; vi: string; en: string }> = [
  { id: 'uploading', vi: 'Đang gửi ảnh', en: 'Uploading photo' },
  { id: 'queued', vi: 'Đã xếp hàng xử lý', en: 'Queued for processing' },
  { id: 'analyzing', vi: 'AI đang đọc nội dung', en: 'AI is reading the image' },
  { id: 'validating', vi: 'Đang kiểm tra kết quả', en: 'Validating results' },
  { id: 'preparing', vi: 'Đang chuẩn bị kết quả', en: 'Preparing review list' },
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
  const { l } = useLocaleText();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setElapsedSeconds(elapsed);
      // Polling has a bounded lifetime too; do not leave a background timer
      // alive after the UI has switched to its timeout/retry message.
      if (elapsed >= 90) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentIndex = STAGE_INDEX[stage];
  const stageLabel = l(STAGES[currentIndex].vi, STAGES[currentIndex].en);
  return (
    <div
      data-testid="scan-processing-state"
      className={clsx(
        'rounded-2xl border border-semantic-border bg-white/95 text-semantic-text-primary shadow-lg',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {stageLabel}.
      </p>
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-semantic-accent-soft text-semantic-text-primary">
          <ScanLine className="h-5 w-5" />
          <span className="absolute inset-0 rounded-xl border border-semantic-action-primary/40 scan-processing-motion motion-safe:animate-ping" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold">
            {kind === 'receipt'
              ? l('Đang xử lý hóa đơn…', 'Processing receipt…')
              : l('Đang xử lý nguyên liệu…', 'Processing ingredients…')}
          </p>
          <p className="mt-0.5 text-sm text-semantic-text-secondary">
            {l(
              'Bạn có thể chờ ở màn hình này; kết quả chỉ hiện khi AI xử lý xong và đã được kiểm tra.',
              'You can wait on this screen; results appear once AI processing and validation finish.',
            )}
          </p>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 scan-processing-motion motion-safe:animate-pulse text-semantic-accent" />
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm" aria-label={l('Trạng thái bản quét', 'Scan status')}>
        <LoaderCircle
          className="h-4 w-4 scan-processing-motion motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span>{stageLabel}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-semantic-text-muted">
        <Clock3 className="h-3.5 w-3.5" />
        <span>
          {l(
            `Đã chờ ${elapsedSeconds < 1 ? 'dưới 1 giây' : `${elapsedSeconds} giây`}`,
            `Elapsed ${elapsedSeconds < 1 ? '< 1s' : `${elapsedSeconds}s`}`,
          )}
        </span>
        <span aria-hidden="true">·</span>
        <span>{l('Kết quả chưa sẵn sàng', 'Results not ready yet')}</span>
      </div>
    </div>
  );
};
