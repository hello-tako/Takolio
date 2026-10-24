import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { subscribe } from '../../lib/sync';
import { api } from '../../services/api';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState<number | null>(0);
  const [syncError, setSyncError] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = subscribe((count) => {
      setPending(count);
      if (count === 0) setSyncError(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const handleSyncNow = async () => {
    if (syncing || isOffline) return;
    setSyncing(true);
    setSyncError(false);
    try {
      const result = await api.retryPendingWrites();
      setPending(result.remaining);
    } catch {
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOffline && pending === 0 && !syncError) return null;

  return (
    <div className="bg-takosan-navy text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 sticky top-0 z-50 animate-slide-up shadow-md">
      <span role="status" aria-live="polite" aria-atomic="true" className="font-medium flex flex-1 basis-48 items-center gap-2 min-w-0">
        <WifiOff className="w-3.5 h-3.5 text-takosan-yellow shrink-0" />
        <span>
          {syncError
            ? 'Không thể đồng bộ. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.'
            : pending === null
              ? 'Không thể xác định trạng thái đồng bộ. Hãy kiểm tra bộ nhớ trình duyệt trước khi tiếp tục.'
              : isOffline
                ? 'Đang ở chế độ Ngoại tuyến. Thay đổi đã lưu sẽ được đồng bộ khi có mạng.'
                : `Đang chờ đồng bộ (${pending} thay đổi).`}
        </span>
      </span>
      {!isOffline && (pending === null || pending > 0 || syncError) && (
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          aria-label="Đồng bộ ngay"
          className="tap-target shrink-0 inline-flex items-center justify-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Đang…' : 'Đồng bộ ngay'}
        </button>
      )}
    </div>
  );
};
