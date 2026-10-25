import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
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
    const handleOffline = () => { setIsOffline(true); setConfirmation(null); };

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
      const result = await api.retryPendingWrites(discardWeekSwapConflict ? { discardWeekSwapConflict } : undefined);
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
      <div className="bg-takosan-navy text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 sticky top-0 z-50 animate-slide-up shadow-md">
        <span role="status" aria-live="polite" aria-atomic="true" className="font-medium flex flex-1 basis-48 items-center gap-2 min-w-0">
          <WifiOff className="w-3.5 h-3.5 text-takosan-yellow shrink-0" />
          <span>
            {blocked
              ? 'Yêu cầu đổi món xung đột với dữ liệu đã lưu. Yêu cầu vẫn được giữ trên thiết bị.'
              : syncError
                ? 'Không thể đồng bộ. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.'
                : pending === null
                  ? 'Không thể xác định trạng thái đồng bộ. Hãy kiểm tra bộ nhớ trình duyệt trước khi tiếp tục.'
                  : isOffline
                    ? 'Đang ở chế độ Ngoại tuyến. Thay đổi đã lưu sẽ được đồng bộ khi có mạng.'
                    : `Đang chờ đồng bộ (${pending} thay đổi).`}
            {blocked && syncError && ' Chưa thể tải lại và bỏ yêu cầu. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.'}
          </span>
        </span>
        {!isOffline && (pending === null || pending > 0 || syncError || blocked) && (
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={syncing}
            aria-label="Đồng bộ ngay"
            className="tap-target shrink-0 inline-flex items-center justify-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Đang…' : 'Đồng bộ ngay'}
          </button>
        )}
        {!isOffline && blocked && (
          <button
            type="button"
            onClick={() => setConfirmation(blocked)}
            disabled={syncing}
            className="tap-target rounded-full border border-white/40 px-2.5 py-1 font-semibold disabled:opacity-60"
          >
            Tải lại và bỏ yêu cầu đổi món
          </button>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmation && !!blocked && !isOffline}
        title="Bỏ yêu cầu đổi món bị xung đột?"
        description="Takolio sẽ tải thực đơn hiện tại và chỉ bỏ yêu cầu đổi món này khỏi hàng chờ. Các thay đổi khác vẫn được giữ. Bạn có thể chọn món lại sau đó."
        confirmText="Tải lại và bỏ yêu cầu"
        cancelText="Giữ yêu cầu"
        destructive
        onConfirm={() => { if (confirmation) void handleSyncNow(confirmation); }}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );
};
