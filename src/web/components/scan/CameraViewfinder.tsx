import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { PRIVATE_IMAGE_JPEG_QUALITY, PRIVATE_IMAGE_MAX_DIMENSION } from '../../lib/private-image';
import {
  NavScanApertureIcon,
  ReceiptScanIcon,
} from '../../design-system/icons';

interface CameraViewfinderProps {
  onCapture: (base64: string) => void;
  onSelectFromGallery: () => void;
  scanType: 'fridge' | 'food' | 'receipt';
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  onCapture,
  onSelectFromGallery,
  scanType,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(true);

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

        const track = mediaStream.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities ? track.getCapabilities() : {};
        setHasTorchSupport(Boolean(capabilities.torch));
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

    void startCamera();

    return () => {
      active = false;
      ownedStream?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

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
      // Ignore constraint failure on unsupported devices
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const ModeHudIcon = scanType === 'receipt' ? ReceiptScanIcon : NavScanApertureIcon;

  return (
    <div className="relative w-full h-[clamp(320px,52dvh,540px)] rounded-[28px] overflow-hidden bg-tk-sanctuary flex items-center justify-center border border-white/15 shadow-elevated">
      {/* Live Camera Video */}
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

      {/* Sanctuary Fallback Viewfinder when Camera Blocked/Unavailable */}
      {(hasCameraError || isStartingCamera) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3.5 bg-tk-sanctuary/95 backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-tk-sanctuary-elevated border border-white/15 flex items-center justify-center text-white shadow-card">
            <NavScanApertureIcon size={30} tone="flame" active />
          </div>
          <div>
            <p className="font-heading font-extrabold text-base text-white">
              {hasCameraError ? 'Camera không sẵn sàng' : 'Đang khởi động ống kính AI…'}
            </p>
            <p className="text-xs sm:text-sm text-white/75 mt-1 max-w-xs leading-relaxed">
              {hasCameraError
                ? 'Bạn vẫn có thể tải ảnh trực tiếp từ thư viện thiết bị để AI phân tích.'
                : 'Vui lòng cho phép quyền truy cập máy ảnh nếu trình duyệt hiển thị lời nhắc.'}
            </p>
          </div>
          {hasCameraError && (
            <button
              type="button"
              onClick={onSelectFromGallery}
              className="px-4.5 py-2.5 rounded-2xl bg-tk-flame hover:bg-tk-flame-hover text-white font-extrabold text-sm flex items-center gap-2 shadow-float tap-target transition-tap active:scale-[0.98] cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Tải ảnh từ thư viện</span>
            </button>
          )}
        </div>
      )}

      {/* Pro AI Vision HUD & Precision Corner Reticle Overlay */}
      <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {hasTorchSupport ? (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className={clsx(
                'w-11 h-11 rounded-2xl flex items-center justify-center backdrop-blur-md transition-tap tap-target border cursor-pointer',
                isTorchOn
                  ? 'bg-tk-turmeric text-tk-ink border-tk-turmeric'
                  : 'bg-tk-sanctuary-card/75 text-white border-white/15 hover:bg-tk-sanctuary-elevated',
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
            <div className="w-11" />
          )}

          <div className="min-w-0 max-w-[68%] px-3 py-1.5 rounded-full bg-tk-sanctuary-card/85 backdrop-blur-md text-xs sm:text-sm font-heading font-bold text-white border border-white/15 shadow-card flex items-center gap-1.5">
            <ModeHudIcon size={15} tone="cream" active />
            <span className="truncate">
              {scanType === 'receipt'
                ? 'Căn chỉnh toàn bộ hóa đơn vào khung'
                : scanType === 'fridge'
                  ? 'Hướng vào ngăn tủ để nhận diện thực phẩm'
                  : 'Đặt nguyên liệu vào tâm khung ngắm'}
            </span>
          </div>

          <button
            type="button"
            onClick={switchCamera}
            className="w-11 h-11 rounded-2xl bg-tk-sanctuary-card/75 backdrop-blur-md text-white border border-white/15 flex items-center justify-center tap-target hover:bg-tk-sanctuary-elevated transition-tap cursor-pointer"
            aria-label="Đổi camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Precision Sculpted Corner Reticle Brackets */}
        <div className="relative flex-1 my-3 flex items-center justify-center">
          <div
            className={clsx(
              'border border-white/20 transition-tap duration-300 relative overflow-hidden',
              scanType === 'receipt'
                ? 'w-[80%] h-[90%] rounded-2xl'
                : 'w-[86%] h-[84%] rounded-[24px]',
            )}
          >
            {/* 4 Precision Corner Reticle Brackets */}
            <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-tk-flame rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-tk-flame rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-tk-flame rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-tk-flame rounded-br-xl" />

            {/* Subtle Center Alignment Guides */}
            {scanType === 'receipt' ? (
              <div className="absolute inset-x-4 top-1/4 bottom-1/4 border-y border-dashed border-white/20" />
            ) : (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/25" />
            )}

            {/* Terracotta AI Vision Laser Sweep */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-tk-flame to-transparent shadow-glow motion-safe:animate-[scanLaser_2.5s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Bottom Shutter & Gallery Trigger Dock */}
        <div className="flex items-center justify-around pointer-events-auto pb-1">
          <button
            type="button"
            onClick={onSelectFromGallery}
            className="px-4 py-2.5 rounded-2xl bg-tk-sanctuary-card/80 border border-white/15 backdrop-blur-md text-white flex items-center gap-2 tap-target hover:bg-tk-sanctuary-elevated active:scale-95 transition-tap cursor-pointer"
            title="Thư viện"
            aria-label="Thư viện"
          >
            <ImageIcon className="w-5 h-5 text-tk-jade-mint" />
            <span className="text-sm font-heading font-extrabold">Thư viện</span>
          </button>

          {/* Concentric Atelier Shutter Button */}
          <button
            type="button"
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-[3px] border-white/90 flex items-center justify-center bg-white/10 active:scale-95 transition-transform p-1.5 tap-target shadow-float cursor-pointer"
            aria-label="Chụp ảnh"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-tk-sunken flex items-center justify-center shadow-md">
              <Camera className="w-8 h-8 text-tk-flame stroke-[2.2]" />
            </div>
          </button>

          <div className="w-11" />
        </div>
      </div>
    </div>
  );
};
