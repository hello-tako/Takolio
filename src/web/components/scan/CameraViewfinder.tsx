import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, Image as ImageIcon, PlusCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { PRIVATE_IMAGE_JPEG_QUALITY, PRIVATE_IMAGE_MAX_DIMENSION } from '../../lib/private-image';

interface CameraViewfinderProps {
  onCapture: (base64: string) => void;
  onSelectFromGallery: () => void;
  onManualEntry?: () => void;
  scanType: 'fridge' | 'food' | 'receipt';
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  onCapture,
  onSelectFromGallery,
  onManualEntry,
  scanType,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(true);

  // Initialize camera stream
  useEffect(() => {
    let active = true;
    let ownedStream: MediaStream | null = null;
    setIsTorchOn(false);

    async function startCamera() {
      setIsStartingCamera(true);
      setHasCameraError(false);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera not supported');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        ownedStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Check torch support
        const track = mediaStream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorchSupport(true);
        } else {
          setHasTorchSupport(false);
        }
      } catch (err) {
        console.warn('Camera access could not be established:', err);
        if (active) {
          setHasCameraError(true);
        }
      } finally {
        if (active) {
          setIsStartingCamera(false);
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      ownedStream?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  // Handle capture
  const handleCapture = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      const sourceWidth = videoRef.current.videoWidth;
      const sourceHeight = videoRef.current.videoHeight;
      const scale = Math.min(1, PRIVATE_IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', PRIVATE_IMAGE_JPEG_QUALITY);
        onCapture(dataUrl);
        return;
      }
    }
    // If camera not ready, trigger gallery fallback
    onSelectFromGallery();
  };

  const toggleTorch = async () => {
    if (!stream || !hasTorchSupport) return;
    const track = stream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !isTorchOn }],
      });
      setIsTorchOn(!isTorchOn);
    } catch {
      // Ignore
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="scan-viewfinder-frame relative w-full h-[clamp(320px,50dvh,520px)] rounded-2xl overflow-hidden bg-[var(--tkv-ink)] flex items-center justify-center border border-white/15 shadow-xl">
      {/* Video stream */}
      {!hasCameraError && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={clsx(
            'w-full h-full object-cover transition-opacity duration-300',
            isStartingCamera ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Fallback Viewfinder if camera blocked/unavailable (C10) */}
      {(hasCameraError || isStartingCamera) && (
        <div className="absolute inset-0 z-10 overflow-y-auto flex flex-col items-center justify-center p-5 text-center space-y-3 bg-[var(--tkv-ink)]/95 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-heading font-bold text-sm text-[var(--tkv-bg)]">
              {hasCameraError ? 'Camera không sẵn sàng' : 'Đang bật camera...'}
            </p>
            <p className="text-sm text-white/80 mt-1 max-w-xs leading-relaxed">
              {hasCameraError
                ? 'Bạn có thể tải ảnh từ thư viện hoặc chuyển sang nhập nguyên liệu thủ công'
                : 'Vui lòng cấp quyền truy cập camera nếu được hỏi'}
            </p>
          </div>
          {hasCameraError && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onSelectFromGallery}
                className="px-4 py-2.5 rounded-xl bg-white text-[var(--tkv-ink)] hover:bg-[var(--tkv-bg)] font-semibold text-sm flex items-center gap-1.5 shadow-sm tap-target transition-tap active:scale-[0.98]"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>Tải ảnh từ thư viện</span>
              </button>
              {onManualEntry && (
                <button
                  type="button"
                  data-testid="c10-manual-entry-btn"
                  onClick={onManualEntry}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/25 text-white font-semibold text-sm flex items-center gap-1.5 tap-target transition-tap active:scale-[0.98]"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>Nhập nguyên liệu thủ công</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Viewfinder Guide Overlay */}
      <div className="absolute inset-3.5 pointer-events-none flex flex-col justify-between">
        {/* Top Controls */}
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {hasTorchSupport ? (
            <button
              type="button"
              onClick={toggleTorch}
              className={clsx(
                'w-11 h-11 shrink-0 rounded-xl flex items-center justify-center backdrop-blur-md transition-tap tap-target border border-white/15',
                isTorchOn
                  ? 'bg-white text-[var(--tkv-ink)]'
                  : 'bg-[var(--tkv-ink)]/75 text-white',
              )}
              aria-label="Đèn pin"
            >
              {isTorchOn ? (
                <Zap className="w-4 h-4 fill-current" />
              ) : (
                <ZapOff className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-11 shrink-0" />
          )}

          <div className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[var(--tkv-ink)]/80 backdrop-blur-md text-xs sm:text-sm font-heading font-semibold text-white border border-white/15 shadow-md inline-flex items-center justify-center gap-2 text-center leading-snug">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-coral)] shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">
              {scanType === 'receipt'
                ? 'Căn chỉnh toàn bộ hóa đơn vào khung'
                : scanType === 'fridge'
                  ? 'Hướng vào tủ lạnh để nhận diện thực phẩm'
                  : 'Đặt nguyên liệu vào giữa khung hình'}
            </span>
          </div>

          <button
            type="button"
            onClick={switchCamera}
            className="w-11 h-11 shrink-0 rounded-xl bg-[var(--tkv-ink)]/75 backdrop-blur-md text-white border border-white/15 flex items-center justify-center tap-target hover:bg-[var(--tkv-ink)]/90 transition-tap"
            aria-label="Đổi camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Target Frame */}
        <div className="relative flex-1 my-3 flex items-center justify-center">
          <div
            className={clsx(
              'border border-white/25 transition-tap duration-300 relative overflow-hidden',
              scanType === 'receipt' ? 'w-4/5 h-[90%] rounded-xl' : 'w-[85%] h-[85%] rounded-2xl',
            )}
          >
            {/* 4 Corner Markers */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-sm" />

            {/* Subtle Coral Scan Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--tkv-coral)] to-transparent motion-safe:animate-[scanLaser_2.5s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Bottom Shutter Trigger Bar */}
        <div className="grid grid-cols-3 items-center pointer-events-auto pb-1">
          <div className="justify-self-start">
            <button
              type="button"
              onClick={onSelectFromGallery}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--tkv-ink)]/75 border border-white/15 backdrop-blur-md text-white inline-flex items-center gap-1.5 tap-target hover:bg-[var(--tkv-ink)]/95 active:scale-95 transition-tap"
              title="Thư viện"
              aria-label="Thư viện"
            >
              <ImageIcon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-heading font-bold whitespace-nowrap">Thư viện</span>
            </button>
          </div>

          {/* Big Shutter Button */}
          <button
            type="button"
            onClick={handleCapture}
            className="justify-self-center w-20 h-20 rounded-full border-[3px] border-white/90 flex items-center justify-center bg-transparent active:scale-95 transition-transform p-1.5 tap-target shadow-lg"
            aria-label="Chụp ảnh"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-md">
              <Camera className="w-8 h-8 text-[var(--tkv-ink)] stroke-[2.2]" />
            </div>
          </button>

          <div />
        </div>
      </div>
    </div>
  );
};
