import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ImagePlus, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../stores/useAuthStore';
import { useScanStore } from '../stores/useScanStore';
import { api } from '../services/api';
import { CameraViewfinder } from '../components/scan/CameraViewfinder';
import {
  ScanProcessingState,
  type ScanProcessingStage,
} from '../components/scan/ScanProcessingState';
import { Button } from '../components/common/Button';
import { AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import {
  CrownPlusIcon,
  NavFridgeIcon,
  NavScanApertureIcon,
  ReceiptScanIcon,
  TakolioLogoMark,
  type TakolioIconProps,
} from '../design-system/icons';
import { capturePrivateSession } from '../lib/private-session';
import { readPrivateImage } from '../lib/private-image';
import { ApiError } from '../services/http';
import { scanApiErrorMessage, type ScanQuota } from '../lib/scan-errors';

export const ScanPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuthStore();
  const authUserId = auth?.userId;
  const authHouseholdId = auth?.householdId;
  const authIsPlus = Boolean(auth?.isPlus);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<{ id: string; image: string; type: string; owner: string } | null>(
    null,
  );
  const inFlight = useRef(false);
  const cancelRead = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cancelRead.current?.();
      commandRef.current = null;
    },
    [],
  );

  const {
    imagePreviewUrl,
    isProcessing,
    statusText,
    setImage,
    setScanType,
    setProcessing,
    setScanResults,
    reset,
  } = useScanStore();

  const [activeTab, setActiveTab] = useState<'fridge' | 'food' | 'receipt'>('fridge');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryIsRecovery, setRetryIsRecovery] = useState(false);
  const [quota, setQuota] = useState<ScanQuota | null>(null);
  const [processingStage, setProcessingStage] = useState<ScanProcessingStage>('uploading');

  const refreshQuota = async () => {
    const isCurrent = capturePrivateSession();
    try {
      const me = await api.getMe({ requireServer: true });
      if (isCurrent()) setQuota(me?.user?.subscription ?? null);
    } catch {
      if (isCurrent()) setQuota(null);
    }
  };

  useEffect(() => {
    void refreshQuota();
  }, []);

  const tabs: ReadonlyArray<{
    id: 'fridge' | 'food' | 'receipt';
    label: string;
    Icon: React.FC<TakolioIconProps>;
    tone: TakolioIconProps['tone'];
  }> = [
    { id: 'fridge', label: 'Quét Tủ lạnh', Icon: NavFridgeIcon, tone: 'jade' },
    { id: 'food', label: 'Nhận diện Nguyên liệu', Icon: NavScanApertureIcon, tone: 'flame' },
    { id: 'receipt', label: 'Quét Hóa đơn siêu thị', Icon: ReceiptScanIcon, tone: 'turmeric' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    cancelRead.current?.();
    commandRef.current = null;
    setErrorMsg(null);
    setErrorCode(null);
    setRetryIsRecovery(false);
    cancelRead.current = readPrivateImage(
      file,
      (base64) => {
        setImage(base64, base64);
        void startAIScan(base64);
      },
      activeTab === 'receipt' ? 'receipt' : 'photo',
    );
  };

  const startAIScan = async (base64: string) => {
    if (inFlight.current) return;

    const storeSnapshot = typeof useAuthStore.getState === 'function' ? useAuthStore.getState() : null;
    const resolvedUserId =
      authUserId ||
      storeSnapshot?.userId ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('frigo_user_id') : '') ||
      '';
    const resolvedHouseholdId =
      authHouseholdId ||
      storeSnapshot?.householdId ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('frigo_household_id') : '') ||
      '';
    const owner = `${resolvedUserId}:${resolvedHouseholdId}`;

    if (
      !commandRef.current ||
      commandRef.current.image !== base64 ||
      commandRef.current.type !== activeTab ||
      commandRef.current.owner !== owner
    ) {
      commandRef.current = { id: crypto.randomUUID(), image: base64, type: activeTab, owner };
    }
    const commandId = commandRef.current.id;
    const sessionIsCurrent = capturePrivateSession();
    const isCurrent = () => sessionIsCurrent() && commandRef.current?.id === commandId;
    inFlight.current = true;
    setErrorMsg(null);
    setErrorCode(null);
    setRetryIsRecovery(false);

    if (activeTab === 'receipt') {
      setProcessingStage('uploading');
      setProcessing(true, 'Đang quét hóa đơn mua sắm...');
      try {
        const receiptRes = await api.scanReceipt(base64, commandId);

        if (!isCurrent()) return;
        setProcessing(false);
        void refreshQuota();
        useScanStore.getState().bindImageToScan(receiptRes.id);
        navigate(`/scan/receipt-review?scanId=${encodeURIComponent(receiptRes.id)}`);
      } catch (error) {
        if (!isCurrent()) return;
        setErrorCode(error instanceof ApiError ? error.code : null);
        setRetryIsRecovery(
          error instanceof ApiError &&
            ((error.kind === 'offline' && error.retryable === true) ||
              ['QUEUE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code || '')) &&
            (error.payload?.scan as { status?: string } | undefined)?.status !== 'failed',
        );
        setErrorMsg(scanApiErrorMessage(error, 'receipt', quota));
        void refreshQuota();
        setProcessing(false);
      } finally {
        inFlight.current = false;
      }
      return;
    }

    setProcessing(true, 'Đang tải ảnh lên...');
    setProcessingStage('uploading');
    try {
      const scanRes = await api.scanFridge(base64, activeTab, commandId);

      if (!isCurrent()) return;
      void refreshQuota();
      setScanResults(
        scanRes.id,
        scanRes.items,
        scanRes.status === 'ready' || scanRes.status === 'confirmed' ? scanRes.status : null,
      );
      useScanStore.getState().bindImageToScan(scanRes.id);
      navigate(`/scan/${scanRes.id}/review`);
    } catch (error) {
      if (!isCurrent()) return;
      setErrorCode(error instanceof ApiError ? error.code : null);
      setRetryIsRecovery(
        error instanceof ApiError &&
          ((error.kind === 'offline' && error.retryable === true) ||
            ['QUEUE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code || '')) &&
          (error.payload?.scan as { status?: string } | undefined)?.status !== 'failed',
      );
      setErrorMsg(scanApiErrorMessage(error, activeTab, quota));
      void refreshQuota();
      setProcessing(false);
    } finally {
      inFlight.current = false;
    }
  };

  const chooseNewImage = () => {
    if (isProcessing) return;
    cancelRead.current?.();
    cancelRead.current = null;
    commandRef.current = null;
    reset();
    setScanType(activeTab);
    setErrorMsg(null);
    setErrorCode(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const isPlusPlan = quota?.plan === 'plus' || authIsPlus;

  return (
    <div className="scan-workspace bg-tk-canvas text-tk-ink">
      {/* Studio Header */}
      <header className="scan-workspace-header flex-wrap justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="kitchen-icon-link !rounded-2xl !border-tk-stone/85 !bg-white hover:!bg-tk-sunken transition-colors cursor-pointer"
            aria-label="Quay lại tủ lạnh"
            onClick={() => {
              reset();
              navigate('/fridge');
            }}
          >
            <ArrowLeft size={20} aria-hidden="true" className="text-tk-ink" />
          </button>
          <div>
            <p className="kitchen-eyebrow !mb-0.5 !text-tk-flame">
              <TakolioLogoMark size={16} tone="flame" active />
              <span>AI Vision &amp; OCR Studio · Bước 1 / 3</span>
            </p>
            <h1 className="font-heading text-tk-ink">Chụp ảnh, rồi kiểm tra</h1>
          </div>
        </div>

        {/* Clear Plus / Free Quota Header Badge */}
        {isPlusPlan ? (
          <AtelierBadge tone="turmeric" icon={<CrownPlusIcon size={14} tone="turmeric" active />}>
            Takolio Plus · Quét AI không giới hạn
          </AtelierBadge>
        ) : (
          quota?.plan === 'free' && (
            <Link to="/plus">
              <AtelierBadge
                tone="flame"
                icon={<CrownPlusIcon size={14} tone="turmeric" active />}
                className="tk-tabular"
              >
                Còn {quota.remaining}/{quota.limit} lượt quét · Nâng cấp Plus
              </AtelierBadge>
            </Link>
          )
        )}
      </header>

      <div className="scan-workspace-grid">
        {/* Left Studio Control & Guide Column */}
        <section className="scan-guide rounded-[28px] border border-tk-stone/85 bg-white p-5 sm:p-6 shadow-card">
          {/* 3-Mode Segmented Tabs */}
          <div
            className="scan-modes !rounded-2xl !border-tk-stone/80 !bg-tk-sunken !p-1.5"
            role="group"
            aria-label="Chế độ quét"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  disabled={isProcessing}
                  onClick={() => {
                    cancelRead.current?.();
                    cancelRead.current = null;
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setActiveTab(tab.id);
                    setScanType(tab.id);
                    commandRef.current = null;
                    setImage('', '');
                    setErrorMsg(null);
                    setErrorCode(null);
                  }}
                  className={clsx(
                    '!rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-extrabold transition-colors cursor-pointer',
                    active
                      ? '!bg-tk-jade !text-white shadow-xs'
                      : '!bg-transparent text-tk-secondary hover:text-tk-ink',
                  )}
                >
                  <TabIcon size={17} tone={active ? 'cream' : tab.tone} active={active} />
                  <span className="text-center leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <h2 className="font-heading text-tk-ink">
            {activeTab === 'receipt'
              ? 'Đọc hóa đơn siêu thị bằng OCR'
              : activeTab === 'food'
                ? 'Nhận diện nguyên liệu mới mua'
                : 'Quét toàn cảnh ngăn tủ lạnh'}
          </h2>
          <p className="text-tk-secondary leading-relaxed">
            {activeTab === 'receipt'
              ? 'Chụp toàn bộ hóa đơn, kể cả tên cửa hàng, ngày mua và từng dòng mặt hàng. Bạn luôn có thể sửa hoặc thêm mặt hàng thủ công ở bước sau.'
              : 'Chụp thực phẩm rõ nét; bạn sẽ kiểm tra lại tên, lượng, đơn vị và nơi bảo quản trước khi lưu vào tủ.'}
          </p>

          {/* Direct File Upload Button */}
          <div className="mt-4">
            <button
              type="button"
              disabled={isProcessing}
              onClick={chooseNewImage}
              className="tap-target w-full flex items-center justify-center gap-2 rounded-2xl border border-tk-stone bg-tk-sunken/70 hover:bg-tk-sunken px-4 py-3 text-xs sm:text-sm font-extrabold text-tk-ink transition-colors disabled:opacity-55 cursor-pointer"
            >
              <Upload size={17} className="text-tk-flame" aria-hidden="true" />
              <span>Tải ảnh từ thiết bị / thư viện</span>
            </button>
          </div>

          <details className="scan-help rounded-2xl border border-tk-stone/70 bg-tk-canvas px-4 py-1 mt-4">
            <summary className="!text-tk-jade">Mẹo chụp ảnh rõ hơn</summary>
            <ol className="!text-tk-secondary">
              <li>Đủ sáng, giữ máy ổn định và tránh bóng phản chiếu trên bao bì.</li>
              <li>
                {activeTab === 'receipt'
                  ? 'Giữ chữ và các dòng hàng nằm trọn trong khung ngắm, không cắt mất mép hóa đơn.'
                  : 'Đặt nguyên liệu tách biệt dễ nhìn; hướng nhãn hạn dùng về phía ống kính nếu có.'}
              </li>
              <li>AI chỉ tạo bản nháp kiểm tra. Tủ lạnh chỉ cập nhật sau khi bạn xác nhận.</li>
            </ol>
          </details>

          {quota?.plan === 'free' && (
            <div
              className="scan-quota mt-4 rounded-2xl border border-tk-stone/80 bg-tk-sunken/60 p-3.5 space-y-2"
              data-testid="scan-quota"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-tk-ink tk-tabular">
                <span>
                  Còn {quota.remaining}/{quota.limit} lượt quét miễn phí trong tháng
                </span>
                <Link to="/plus" className="text-tk-flame hover:underline">
                  Mở khóa Plus →
                </Link>
              </div>
              <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                <span
                  className="block h-full rounded-full bg-tk-jade"
                  style={{
                    width: `${quota.limit > 0 ? Math.min(100, Math.round((quota.remaining / quota.limit) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right Camera / Preview & Processing Region */}
        <section className="scan-camera-region" aria-label="Chụp hoặc chọn ảnh">
          {imagePreviewUrl ? (
            <div className="scan-preview !rounded-[28px] !bg-tk-sanctuary border border-white/15 shadow-elevated">
              <img src={imagePreviewUrl} alt="Ảnh vừa chọn để quét" />
            </div>
          ) : (
            <CameraViewfinder
              scanType={activeTab}
              onCapture={(base64) => {
                commandRef.current = null;
                setImage(base64, base64);
                void startAIScan(base64);
              }}
              onSelectFromGallery={() => fileInputRef.current?.click()}
            />
          )}

          {isProcessing && (
            <div className="mt-4">
              <ScanProcessingState
                stage={processingStage}
                kind={activeTab === 'receipt' ? 'receipt' : 'fridge'}
              />
              <p className="sr-only">{statusText}</p>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-4 text-sm text-tk-berry-deep shadow-xs"
            >
              <div className="flex gap-2.5">
                <AlertCircle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                <p className="font-semibold">{errorMsg}</p>
              </div>
              {errorCode !== 'SCAN_QUOTA_EXCEEDED' && (
                <button
                  type="button"
                  className="mt-2 min-h-11 underline font-extrabold cursor-pointer"
                  onClick={() => {
                    if (!commandRef.current) return;
                    const image = commandRef.current.image;
                    if (!retryIsRecovery) commandRef.current = null;
                    void startAIScan(image);
                  }}
                >
                  {retryIsRecovery ? 'Kiểm tra lại' : 'Thử xử lý lại'}
                </button>
              )}
            </div>
          )}

          {imagePreviewUrl && (
            <div className="scan-camera-actions">
              <Button variant="outline" disabled={isProcessing} onClick={chooseNewImage}>
                <ImagePlus size={18} aria-hidden="true" /> Chọn ảnh khác
              </Button>
            </div>
          )}
        </section>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
