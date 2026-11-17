import React, { type RefObject } from 'react';

interface GoogleAuthSectionProps {
  buttonRef: RefObject<HTMLDivElement>;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  clientId: string | null;
  onRetry: () => void;
}

/** Google GSI mount + honest availability states (T16 GSI contract). */
export const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
  buttonRef,
  status,
  clientId,
  onRetry,
}) => (
  <div className="space-y-2">
    <div
      ref={buttonRef}
      className="w-full flex justify-center items-center min-h-[44px] rounded-pill"
    />
    {status === 'loading' && (
      <p role="status" className="text-center text-xs font-medium text-tk-muted">
        Đang kết nối Google…
      </p>
    )}
    {status === 'unavailable' && (
      <div className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-3.5 py-2.5 text-center text-xs text-tk-turmeric-deep">
        <p>
          {clientId
            ? 'Không tải được Google Sign-In. Hãy kiểm tra chặn nội dung hoặc thử lại.'
            : 'Google Sign-In chưa được cấu hình. Bạn vẫn có thể tiếp tục bằng email bên dưới.'}
        </p>
        {clientId && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 font-extrabold underline tap-target inline-flex items-center justify-center px-3 cursor-pointer"
          >
            Tải lại Google Sign-In
          </button>
        )}
      </div>
    )}
  </div>
);
