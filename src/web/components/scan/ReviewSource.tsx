import { useScanStore } from '../../stores/useScanStore';

export function ReviewSource({ scanId, verified }: { scanId: string; verified: boolean }) {
  const image = useScanStore((state) => state.imagePreviewUrl);
  const ownerScanId = useScanStore((state) => state.imageScanId);
  if (!verified || !scanId || ownerScanId !== scanId || !image) return null;
  return (
    <details className="review-source rounded-2xl border border-tk-stone/85 bg-white p-3.5 shadow-xs">
      <summary className="font-bold text-tk-ink">Xem ảnh vừa quét</summary>
      <img
        src={image}
        alt="Ảnh nguồn của bản quét đang mở"
        className="mt-2 !rounded-xl !bg-tk-sunken"
      />
    </details>
  );
}
