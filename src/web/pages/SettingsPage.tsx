import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AccountPage } from '../components/common/AccountPage';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { BentoCard, AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import { FreshnessShieldIcon, TakolioLogoMark } from '../design-system/icons';
import { Globe, Smartphone, Trash2, Wifi, ChevronRight } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const SettingsPage: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (installing) return;
    setActionError(null);
    if (!deferredPrompt) {
      setShowInstallHelp(true);
      return;
    }
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch {
      setActionError('Chưa mở được cửa sổ cài đặt. Hãy thử hướng dẫn cài thủ công.');
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleClearCache = async () => {
    setActionError(null);
    setCacheCleared(false);
    setClearing(true);
    try {
      if (!('caches' in window)) throw new Error('Cache storage unavailable');
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      setCacheCleared(true);
    } catch {
      setActionError(
        'Chưa xóa được bộ nhớ đệm. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.',
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <AccountPage
      title="Cài đặt ứng dụng"
      description="Mở bếp nhanh hơn từ màn hình chính và quản lý bộ nhớ đệm trên thiết bị."
    >
      <BentoCard tone="ceramic" padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-tk-flame-soft border border-tk-flame/20 flex items-center justify-center shrink-0">
              <Smartphone size={18} className="text-tk-flame" aria-hidden="true" />
            </span>
            Takolio trên điện thoại
          </h2>
          <AtelierBadge tone={isStandalone ? 'jade' : 'neutral'}>
            {isStandalone ? 'Đã cài đặt' : 'PWA'}
          </AtelierBadge>
        </div>
        <p className="text-sm text-tk-secondary leading-relaxed">
          {isStandalone
            ? 'Bạn đang mở Takolio từ ứng dụng đã cài trên màn hình chính.'
            : 'Thêm Takolio vào màn hình chính để vào bếp chỉ với 1 chạm. Tủ lạnh và danh sách đi chợ đã lưu vẫn xem được khi mất mạng.'}
        </p>
        {!isStandalone && (
          <Button variant="outline" fullWidth onClick={handleInstallPwa} isLoading={installing}>
            Cài đặt lên màn hình chính
          </Button>
        )}
      </BentoCard>

      <BentoCard tone="ceramic" padding="md" className="space-y-3">
        <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center shrink-0">
            <Wifi size={18} className="text-tk-jade" aria-hidden="true" />
          </span>
          Bộ nhớ đệm ứng dụng
        </h2>
        <p className="text-sm text-tk-secondary leading-relaxed">
          Xóa tài nguyên giao diện và ảnh 3D đã lưu tạm trên trình duyệt. Thao tác này tuyệt đối
          không xóa dữ liệu ngoại tuyến hoặc các thay đổi đi chợ/tủ lạnh đang chờ đồng bộ của bạn.
        </p>
        <Button variant="outline" fullWidth onClick={handleClearCache} isLoading={clearing}>
          <Trash2 size={18} aria-hidden="true" className="mr-1.5" /> Xóa bộ nhớ đệm ứng dụng
        </Button>
        {cacheCleared && (
          <p role="status" className="text-xs font-bold text-tk-jade-deep">
            Đã xóa bộ nhớ đệm ứng dụng.
          </p>
        )}
      </BentoCard>

      {actionError && (
        <p
          role="alert"
          className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
        >
          {actionError}
        </p>
      )}

      <BentoCard tone="ceramic" padding="md" className="space-y-2">
        <h2 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-2xl bg-tk-sunken border border-tk-stone flex items-center justify-center shrink-0">
            <Globe size={18} className="text-tk-ink" aria-hidden="true" />
          </span>
          Ngôn ngữ hiển thị
        </h2>
        <p className="text-sm text-tk-secondary leading-relaxed">
          Tiếng Việt chuẩn ẩm thực gia đình Việt. Bản giao diện đa ngôn ngữ đồng bộ đang được hoàn
          thiện.
        </p>
      </BentoCard>

      <Link
        to="/settings/privacy"
        className="flex items-center justify-between gap-3 rounded-2xl border border-tk-stone bg-white px-4 py-3.5 text-sm font-bold text-tk-ink shadow-xs hover:bg-tk-sunken/50 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <FreshnessShieldIcon size={18} tone="jade" active />
          Xem quyền riêng tư &amp; dữ liệu
        </span>
        <ChevronRight size={16} className="text-tk-muted" aria-hidden="true" />
      </Link>

      <details className="rounded-2xl border border-tk-stone/70 bg-tk-sunken/50 px-4 py-3 text-xs text-tk-muted">
        <summary className="cursor-pointer font-bold text-tk-secondary inline-flex items-center gap-1.5">
          <TakolioLogoMark size={15} tone="flame" />
          <span>Thông tin phiên bản</span>
        </summary>
        <p className="mt-2 tk-tabular">
          Takolio v{import.meta.env.VITE_APP_VERSION} · Build{' '}
          {import.meta.env.VITE_GIT_COMMIT || 'local'} ·{' '}
          {import.meta.env.VITE_BUILD_TIMESTAMP || 'local build'}
        </p>
      </details>

      <ConfirmDialog
        open={showInstallHelp}
        title="Cài đặt Takolio lên màn hình chính"
        description={
          'Trên iPhone (Safari): nhấn nút Chia sẻ rồi chọn "Thêm vào MH chính". Trên Android (Chrome): nhấn menu ba chấm rồi chọn "Cài đặt ứng dụng".'
        }
        confirmText="Đã hiểu"
        cancelText="Đóng"
        onConfirm={() => setShowInstallHelp(false)}
        onCancel={() => setShowInstallHelp(false)}
      />
    </AccountPage>
  );
};
