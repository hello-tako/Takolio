import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { subscribe, type PendingOp } from '../../lib/sync';
import { api } from '../../services/api';
import { ConfirmDialog } from './ConfirmDialog';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState<number | null>(0);
  const [syncError, setSyncError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [blocked, setBlocked] = useState<PendingOp | null>(null);
  const [confirmation, setConfirmation] = useState<PendingOp | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      setConfirmation(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = subscribe((count) => {
      setPending(count);
      try {
        const conflict = api.getBlockedWeekSwap();
        setBlocked(conflict);
        if (!conflict) setConfirmation(null);
      } catch {
        setPending(null);
        setBlocked(null);
        setConfirmation(null);
      }
      if (count === 0) setSyncError(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const handleSyncNow = async (discardWeekSwapConflict?: PendingOp) => {
    if (syncing || isOffline) return;
    setSyncing(true);
    setSyncError(false);
    setConfirmation(null);
    try {
      const result = await api.retryPendingWrites(
        discardWeekSwapConflict ? { discardWeekSwapConflict } : undefined,
      );
      setPending(result.remaining);
      const conflict = api.getBlockedWeekSwap();
      setBlocked(conflict);
      if (discardWeekSwapConflict && conflict) setSyncError(true);
    } catch {
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOffline && pending === 0 && !syncError && !blocked) return null;

  return (
    <>
      <div
        className={clsx(
          'sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2.5 border-b px-4 py-2.5 text-xs text-white shadow-elevated animate-slide-up',
          syncError || blocked
            ? 'border-tk-flame/30 bg-tk-sanctuary'
            : 'border-white/10 bg-tk-sanctuary',
        )}
      >
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex min-w-0 flex-1 basis-52 items-center gap-2.5 font-semibold"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-tk-turmeric/20 text-tk-turmeric">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
          <span className="leading-snug tk-tabular">
            {blocked
              ? 'Yêu cầu đổi món xung đột với dữ liệu đã lưu. Yêu cầu vẫn được giữ trên thiết bị.'
              : syncError
                ? 'Không thể đồng bộ. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.'
                : pending === null
                  ? 'Không thể xác định trạng thái đồng bộ. Hãy kiểm tra bộ nhớ trình duyệt trước khi tiếp tục.'
                  : isOffline
                    ? 'Đang ở chế độ Ngoại tuyến. Thay đổi đã lưu sẽ được đồng bộ khi có mạng.'
                    : `Đang chờ đồng bộ (${pending} thay đổi).`}
            {blocked &&
              syncError &&
              ' Chưa thể tải lại và bỏ yêu cầu. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.'}
          </span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {!isOffline && (pending === null || pending > 0 || syncError || blocked) && (
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={syncing}
              aria-label="Đồng bộ ngay"
              className="tap-target inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-tk-flame px-3 py-1.5 font-bold text-white shadow-xs transition-colors hover:bg-tk-flame-hover disabled:opacity-60"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', syncing && 'animate-spin')} />
              <span>{syncing ? 'Đang…' : 'Đồng bộ ngay'}</span>
            </button>
          )}
          {!isOffline && blocked && (
            <button
              type="button"
              onClick={() => setConfirmation(blocked)}
              disabled={syncing}
              className="tap-target rounded-full border border-white/30 bg-white/10 px-3 py-1.5 font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
            >
              Tải lại và bỏ yêu cầu đổi món
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmation && !!blocked && !isOffline}
        title="Bỏ yêu cầu đổi món bị xung đột?"
        description="Takolio sẽ tải thực đơn hiện tại và chỉ bỏ yêu cầu đổi món này khỏi hàng chờ. Các thay đổi khác vẫn được giữ. Bạn có thể chọn món lại sau đó."
        confirmText="Tải lại và bỏ yêu cầu"
        cancelText="Giữ yêu cầu"
        destructive
        onConfirm={() => {
          if (confirmation) void handleSyncNow(confirmation);
        }}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );
};
