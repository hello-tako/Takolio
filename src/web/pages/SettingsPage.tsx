import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AccountPage } from '../components/common/AccountPage';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Globe, Smartphone, Trash2, Wifi } from 'lucide-react';
import { LOCALE_CATALOG, SUPPORTED_LOCALES, type SupportedLocale, type UnitSystem } from '../../shared/locales';
import { useLocaleText } from '../i18n/app-i18n';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const SettingsPage: React.FC = () => {
  const { locale, unitSystem, copy: appCopy, setLocale, setUnitSystem, l } = useLocaleText();
  const [localeSaved, setLocaleSaved] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
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
    if (!deferredPrompt) { setShowInstallHelp(true); return; }
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch {
      setActionError(
        l(
          'Chưa mở được cửa sổ cài đặt. Hãy thử hướng dẫn cài thủ công.',
          'Could not open the install prompt. Try the manual install instructions.',
        ),
      );
      setDeferredPrompt(null);
    } finally { setInstalling(false); }
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
        l(
          'Chưa xóa được bộ nhớ đệm. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.',
          'Could not clear the app cache. Please check browser storage permissions and try again.',
        ),
      );
    } finally { setClearing(false); }
  };

  return (
    <AccountPage
      title={l('Cài đặt ứng dụng', 'App settings')}
      description={l(
        'Mở bếp nhanh hơn, quản lý tài nguyên trên thiết bị.',
        'Open your kitchen faster and manage on-device storage.',
      )}
    >
      <Card className="p-5 space-y-3">
        <h2 className="flex items-center gap-2">
          <Smartphone size={20} className="shrink-0" aria-hidden="true" />{' '}
          {l('Takolio trên điện thoại', 'Takolio on your phone')}
        </h2>
        <p>
          {isStandalone
            ? l(
                'Bạn đang mở Takolio từ ứng dụng đã cài trên màn hình chính.',
                'You are using Takolio from your installed home screen app.',
              )
            : l(
                'Thêm Takolio vào màn hình chính để mở nhanh. Một số dữ liệu đã lưu có thể xem khi mất mạng; tính năng cần máy chủ vẫn cần kết nối.',
                'Add Takolio to your home screen for faster access. Some saved data stays available offline; server-backed features still require a connection.',
              )}
        </p>
        {!isStandalone && (
          <Button variant="outline" fullWidth onClick={handleInstallPwa} isLoading={installing}>
            {l('Cài đặt lên màn hình chính', 'Install to home screen')}
          </Button>
        )}
      </Card>
      <Card className="p-5 space-y-3">
        <h2 className="flex items-center gap-2">
          <Wifi size={20} className="shrink-0" aria-hidden="true" />{' '}
          {l('Bộ nhớ đệm ứng dụng', 'App cache')}
        </h2>
        <p>
          {l(
            'Xóa tài nguyên ứng dụng đã lưu trên trình duyệt. Thao tác này không xóa dữ liệu ngoại tuyến hoặc thay đổi chưa đồng bộ của bạn.',
            'Clear cached app assets stored in your browser. This does not delete your offline kitchen data or unsynced changes.',
          )}
        </p>
        <Button variant="outline" fullWidth className="gap-2" onClick={handleClearCache} isLoading={clearing}>
          <Trash2 size={18} className="shrink-0" aria-hidden="true" />{' '}
          {l('Xóa bộ nhớ đệm ứng dụng', 'Clear app cache')}
        </Button>
        {cacheCleared && <p role="status">{l('Đã xóa bộ nhớ đệm ứng dụng.', 'App cache cleared.')}</p>}
      </Card>
      {actionError && <p role="alert" className="text-semantic-danger-strong">{actionError}</p>}
      <Card className="p-5 space-y-3">
        <h2 className="flex items-center gap-2">
          <Globe size={20} className="shrink-0" aria-hidden="true" /> {appCopy.settings.languageHeading}
        </h2>
        <p>{appCopy.settings.languageDesc}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex flex-col gap-1 flex-1 text-sm font-semibold">
            <span>{l('Ngôn ngữ / Language', 'Language')}</span>
            <select
              aria-label={l('Ngôn ngữ hiển thị', 'Display language')}
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value as SupportedLocale);
                setLocaleSaved(true);
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-semantic-border bg-semantic-surface text-semantic-text-primary text-sm font-semibold"
            >
              {SUPPORTED_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_CATALOG[code].nativeName} ({LOCALE_CATALOG[code].englishName})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 flex-1 text-sm font-semibold">
            <span>{appCopy.settings.unitHeading}</span>
            <select
              aria-label={appCopy.settings.unitHeading}
              value={unitSystem}
              onChange={(e) => {
                setUnitSystem(e.target.value as UnitSystem);
                setLocaleSaved(true);
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-semantic-border bg-semantic-surface text-semantic-text-primary text-sm font-semibold"
            >
              <option value="metric">{appCopy.settings.unitMetric}</option>
              <option value="imperial">{appCopy.settings.unitImperial}</option>
            </select>
          </label>
        </div>
        {localeSaved && <p role="status">{appCopy.settings.savedNotice}</p>}
      </Card>
      <Link to="/settings/privacy" className="account-text-link">
        {l('Xem quyền riêng tư & dữ liệu', 'View privacy & data settings')}
      </Link>
      <details className="account-build-info">
        <summary>{l('Thông tin phiên bản', 'Version info')}</summary>
        <p>Takolio v{import.meta.env.VITE_APP_VERSION} · Build {import.meta.env.VITE_GIT_COMMIT || 'local'} · {import.meta.env.VITE_BUILD_TIMESTAMP || 'local build'}</p>
      </details>
      <ConfirmDialog
        open={showInstallHelp}
        title={l('Cài đặt Takolio lên màn hình chính', 'Install Takolio to home screen')}
        description={l(
          'Trên iPhone (Safari): nhấn nút Chia sẻ rồi chọn "Thêm vào MH chính". Trên Android (Chrome): nhấn menu ba chấm rồi chọn "Cài đặt ứng dụng".',
          'On iPhone (Safari): tap the Share button and choose "Add to Home Screen". On Android (Chrome): open the three-dot menu and select "Install app".',
        )}
        confirmText={l('Đã hiểu', 'Got it')}
        cancelText={l('Đóng', 'Close')}
        onConfirm={() => setShowInstallHelp(false)}
        onCancel={() => setShowInstallHelp(false)}
      />
    </AccountPage>
  );
};
