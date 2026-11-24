import { useScanStore } from '../../stores/useScanStore';
import { useLocaleText } from '../../i18n/app-i18n';

export function ReviewSource({ scanId, verified }: { scanId: string; verified: boolean }) {
  const { l } = useLocaleText();
  const image = useScanStore((state) => state.imagePreviewUrl);
  const ownerScanId = useScanStore((state) => state.imageScanId);
  if (!verified || !scanId || ownerScanId !== scanId || !image) return null;
  return (
    <details className="review-source">
      <summary>{l('Xem ảnh vừa quét', 'View scanned photo')}</summary>
      <img src={image} alt={l('Ảnh nguồn của bản quét đang mở', 'Source photo for this scan')} />
    </details>
  );
}
