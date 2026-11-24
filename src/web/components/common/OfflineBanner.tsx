import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { subscribe, type PendingOp } from '../../lib/sync';
import { api } from '../../services/api';
import { useLocaleText } from '../../i18n/app-i18n';
import { ConfirmDialog } from './ConfirmDialog';

export const OfflineBanner: React.FC = () => {
  const { l } = useLocaleText();
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
      <div className="bg-semantic-warning-soft border-b border-semantic-border text-semantic-text-primary px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 animate-slide-up">
        <span role="status" aria-live="polite" aria-atomic="true" className="font-medium flex flex-1 basis-48 items-center gap-2 min-w-0 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-semantic-warning shrink-0" aria-hidden="true" />
          <WifiOff className="w-3.5 h-3.5 text-semantic-warning-strong shrink-0" />
          <span>
            {blocked
              ? l(
                  'Yêu cầu đổi món xung đột với dữ liệu đã lưu. Yêu cầu vẫn được giữ trên thiết bị.',
                  'Your meal swap request conflicts with saved data. It is still kept on this device.',
                )
              : syncError
                ? l(
                    'Không thể đồng bộ. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.',
                    'Unable to sync. Please check your connection and browser storage, then try again.',
                  )
                : pending === null
                  ? l(
                      'Không thể xác định trạng thái đồng bộ. Hãy kiểm tra bộ nhớ trình duyệt trước khi tiếp tục.',
                      'Unable to check sync status. Please verify browser storage before continuing.',
                    )
                  : isOffline
                    ? l(
                        'Đang ở chế độ Ngoại tuyến. Thay đổi đã lưu sẽ được đồng bộ khi có mạng.',
                        'You are offline. Saved changes will sync once you reconnect.',
                      )
                    : l(
                        `Đang chờ đồng bộ (${pending} thay đổi).`,
                        `Pending sync (${pending} ${pending === 1 ? 'change' : 'changes'}).`,
                      )}
            {blocked &&
              syncError &&
              l(
                ' Chưa thể tải lại và bỏ yêu cầu. Hãy kiểm tra kết nối và bộ nhớ trình duyệt, rồi thử lại.',
                ' Unable to reload and discard the request. Please check your connection and browser storage, then try again.',
              )}
          </span>
        </span>
        {!isOffline && (pending === null || pending > 0 || syncError || blocked) && (
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={syncing}
            aria-label={l('Đồng bộ ngay', 'Sync now')}
            className="tap-target shrink-0 inline-flex items-center justify-center gap-1 rounded-full bg-semantic-action-primary hover:bg-semantic-action-primary-hover text-semantic-on-action-primary px-3 py-1 font-semibold disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? l('Đang…', 'Syncing…') : l('Đồng bộ ngay', 'Sync now')}
          </button>
        )}
        {!isOffline && blocked && (
          <button
            type="button"
            onClick={() => setConfirmation(blocked)}
            disabled={syncing}
            className="tap-target rounded-full border border-semantic-border-strong bg-semantic-surface px-3 py-1 font-semibold text-semantic-text-primary disabled:opacity-60 transition-colors"
          >
            {l('Tải lại và bỏ yêu cầu đổi món', 'Reload and discard meal swap')}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmation && !!blocked && !isOffline}
        title={l('Bỏ yêu cầu đổi món bị xung đột?', 'Discard conflicting meal swap?')}
        description={l(
          'Takolio sẽ tải thực đơn hiện tại và chỉ bỏ yêu cầu đổi món này khỏi hàng chờ. Các thay đổi khác vẫn được giữ. Bạn có thể chọn món lại sau đó.',
          'Takolio will reload the current meal plan and remove only this meal swap from the queue. Other changes will be kept, and you can pick a dish again afterward.',
        )}
        confirmText={l('Tải lại và bỏ yêu cầu', 'Reload and discard')}
        cancelText={l('Giữ yêu cầu', 'Keep request')}
        destructive
        onConfirm={() => { if (confirmation) void handleSyncNow(confirmation); }}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );
};
