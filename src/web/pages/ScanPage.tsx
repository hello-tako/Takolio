import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScanStore } from '../stores/useScanStore';
import { api } from '../services/api';
import { CameraViewfinder } from '../components/scan/CameraViewfinder';
import {
  ScanProcessingState,
  type ScanProcessingStage,
} from '../components/scan/ScanProcessingState';
import { ArrowLeft, AlertCircle, ImagePlus } from 'lucide-react';
import { Button } from '../components/common/Button';
import { capturePrivateSession } from '../lib/private-session';
import { readPrivateImage } from '../lib/private-image';
import { ApiError } from '../services/http';
import { scanApiErrorMessage, type ScanQuota } from '../lib/scan-errors';
import { AiScanPendingStage } from '../vnext/components/Skeletons';
import { useLocaleText } from '../i18n/app-i18n';

export const ScanPage: React.FC = () => {
  const { l } = useLocaleText();
  const navigate = useNavigate();
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

  const tabs = [
    { id: 'fridge' as const, label: l('Tủ lạnh', 'Fridge') },
    { id: 'food' as const, label: l('Nguyên liệu', 'Ingredients') },
    { id: 'receipt' as const, label: l('Hóa đơn', 'Receipt') },
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
    cancelRead.current = readPrivateImage(file, (base64) => {
      setImage(base64, base64);
      void startAIScan(base64);
    }, activeTab === 'receipt' ? 'receipt' : 'photo');
  };

  const startAIScan = async (base64: string) => {
    if (inFlight.current) return;
    const owner = `${localStorage.getItem('frigo_user_id')}:${localStorage.getItem('frigo_household_id')}`;
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
      setProcessing(true, l('Đang quét hóa đơn mua sắm...', 'Scanning shopping receipt...'));
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

    setProcessing(true, l('Đang tải ảnh lên...', 'Uploading photo...'));
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

  return (
    <div className="scan-workspace">
      <header className="scan-workspace-header">
        <button
          className="kitchen-icon-link"
          aria-label={l('Quay lại tủ lạnh', 'Back to fridge')}
          onClick={() => {
            reset();
            navigate('/fridge');
          }}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <p className="kitchen-eyebrow">{l('Thêm vào tủ · Bước 1 / 3', 'Add to fridge · Step 1 of 3')}</p>
          <h1>{l('Chụp ảnh, rồi kiểm tra', 'Snap a photo, then review')}</h1>
        </div>
      </header>
      <div className="scan-workspace-grid">
        <section className="scan-guide">
          <div className="scan-modes" role="group" aria-label={l('Chế độ quét', 'Scan mode')}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
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
              >
                {tab.label}
              </button>
            ))}
          </div>
          <h2>
            {activeTab === 'receipt'
              ? l('Đọc hóa đơn mua sắm', 'Read a grocery receipt')
              : activeTab === 'food'
                ? l('Thêm nguyên liệu mới', 'Add new ingredients')
                : l('Xem những gì đang có', 'See what is in your fridge')}
          </h2>
          <p>
            {activeTab === 'receipt'
              ? l(
                  'Chụp toàn bộ hóa đơn, kể cả tên cửa hàng và ngày mua.',
                  'Capture the full receipt, including store name and purchase date.',
                )
              : l(
                  'Chụp thực phẩm rõ nét; bạn sẽ sửa tên, lượng và nơi bảo quản ở bước tiếp theo.',
                  'Take a clear photo of your food; you will review names, quantities, and storage in the next step.',
                )}
          </p>
          <details className="scan-help">
            <summary>{l('Mẹo chụp ảnh rõ hơn', 'Tips for clearer scans')}</summary>
            <ol>
              <li>{l('Đủ sáng, giữ máy ổn định và tránh bóng phản chiếu.', 'Use good lighting, hold steady, and avoid glare.')}</li>
              <li>
                {activeTab === 'receipt'
                  ? l(
                      'Giữ chữ và các dòng hàng trong khung, không cắt mất mép.',
                      'Keep all text and line items inside the frame without cropping edges.',
                    )
                  : l(
                      'Để nguyên liệu dễ nhìn; chụp nhãn nếu cần đọc tên hoặc hạn dùng.',
                      'Keep ingredients clearly visible; include labels if you want names or expiry dates read.',
                    )}
              </li>
              <li>{l('AI chỉ tạo bản nháp. Tủ được cập nhật sau khi bạn xác nhận.', 'AI only prepares a draft. Your fridge updates only after you confirm.')}</li>
            </ol>
          </details>
          {quota?.plan === 'free' && (
            <p className="scan-quota" data-testid="scan-quota">
              {l(
                `Còn ${quota.remaining}/${quota.limit} lượt quét miễn phí trong tháng`,
                `${quota.remaining}/${quota.limit} free scans remaining this month`,
              )}
            </p>
          )}
        </section>
        <section className="scan-camera-region" aria-label={l('Chụp hoặc chọn ảnh', 'Capture or choose a photo')}>
          {imagePreviewUrl ? (
            <div className="scan-preview">
              <img src={imagePreviewUrl} alt={l('Ảnh vừa chọn để quét', 'Selected photo for scanning')} />
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
              onManualEntry={() => {
                reset();
                navigate('/fridge?action=add');
              }}
            />
          )}
          {isProcessing && (
            <div className="mt-4 flex flex-col gap-3">
              <AiScanPendingStage
                previewUrl={imagePreviewUrl}
                statusText={statusText}
                modeLabel={activeTab === 'receipt' ? l('OCR Hóa đơn Takolio', 'Takolio Receipt OCR') : 'AI Vision Takolio'}
              />
              <div className="sr-only">
                <ScanProcessingState
                  stage={processingStage}
                  kind={activeTab === 'receipt' ? 'receipt' : 'fridge'}
                />
                <p>{statusText}</p>
              </div>
            </div>
          )}
          {errorMsg && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-semantic-danger/30 bg-semantic-danger-soft p-4 text-sm text-semantic-danger-strong"
            >
              <div className="flex gap-2">
                <AlertCircle size={20} className="shrink-0" aria-hidden="true" />
                <p>{errorMsg}</p>
              </div>
              {errorCode !== 'SCAN_QUOTA_EXCEEDED' && (
                <button
                  className="mt-2 min-h-11 underline"
                  onClick={() => {
                    if (!commandRef.current) return;
                    const image = commandRef.current.image;
                    if (!retryIsRecovery) commandRef.current = null;
                    void startAIScan(image);
                  }}
                >
                  {retryIsRecovery ? l('Kiểm tra lại', 'Check again') : l('Thử xử lý lại', 'Try again')}
                </button>
              )}
            </div>
          )}
          {imagePreviewUrl && (
            <div className="scan-camera-actions">
              <Button variant="outline" disabled={isProcessing} onClick={chooseNewImage}>
                <ImagePlus size={18} aria-hidden="true" /> {l('Chọn ảnh khác', 'Choose another photo')}
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
