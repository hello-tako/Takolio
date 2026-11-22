import React, { type RefObject } from 'react';

interface GoogleAuthSectionProps {
  buttonRef: RefObject<HTMLDivElement | null>;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  clientId: string | null | undefined;
  onRetry: () => void;
}

/** Google GSI mount + honest availability states (T16 GSI contract) styled for Kitchen Studio vNext. */
export const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
  buttonRef,
  status,
  clientId,
  onRetry,
}) => (
  <div className="space-y-2" data-testid="google-auth-section">
    <div
      ref={buttonRef as RefObject<HTMLDivElement>}
      className={
        status === 'ready'
          ? 'w-full max-w-full overflow-hidden flex justify-center min-h-[44px]'
          : 'sr-only'
      }
    />
    {status === 'loading' && (
      <div
        role="status"
        className="w-full h-[44px] rounded-full border border-[var(--tkv-border-strong)] bg-[var(--tkv-bg)] flex items-center justify-center gap-2.5 text-sm font-semibold text-[var(--tkv-ink-secondary)] animate-pulse"
      >
        <span className="w-4 h-4 rounded-full border-2 border-[var(--tkv-primary)] border-t-transparent animate-spin" aria-hidden="true" />
        <span>Đang tải đăng nhập Google…</span>
      </div>
    )}
    {status === 'unavailable' && (
      <div className="rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3.5 py-2.5 text-center text-xs text-[var(--tkv-ink-secondary)]">
        <p>
          {clientId
            ? 'Trình duyệt đang chặn nút Google Sign-In. Bạn có thể dùng email bên dưới hoặc tải lại.'
            : 'Đăng nhập Google tạm thời chưa sẵn sàng. Bạn có thể tiếp tục bằng email bên dưới.'}
        </p>
        {clientId && (
          <button
            type="button"
            onClick={onRetry}
            className="tkv-focusable mt-1.5 inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg font-bold text-[var(--tkv-primary)] underline"
          >
            Tải lại nút Google
          </button>
        )}
      </div>
    )}
  </div>
);
