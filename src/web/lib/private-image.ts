import { capturePrivateSession } from './private-session';

// Receipt text remains readable at this size while avoiding multi-megapixel uploads.
export const PRIVATE_IMAGE_MAX_DIMENSION = 2_000;
export const PRIVATE_IMAGE_JPEG_QUALITY = 0.82;
export const RECEIPT_LOSSLESS_MAX_BYTES = 512 * 1024;

export function readPrivateImage(
  file: Blob,
  onLoad: (image: string) => void,
  purpose: 'photo' | 'receipt' = 'photo',
): () => void {
  const isCurrent = capturePrivateSession();
  let cancelled = false;

  let reader: FileReader | null = null;
  let bitmap: ImageBitmap | null = null;

  const readAsDataUrl = (blob: Blob) => {
    if (cancelled || !isCurrent()) return;
    reader = new FileReader();
    reader.onload = () => {
      if (!cancelled && isCurrent() && typeof reader?.result === 'string') onLoad(reader.result);
    };
    reader.readAsDataURL(blob);
  };

  const preprocess = async () => {
    if (typeof globalThis.createImageBitmap !== 'function' || typeof document === 'undefined') {
      readAsDataUrl(file);
      return;
    }

    try {
      bitmap = await globalThis.createImageBitmap(file);
      if (cancelled || !isCurrent()) return;

      const sourceWidth = bitmap.width;
      const sourceHeight = bitmap.height;
      const longestSide = Math.max(sourceWidth, sourceHeight);
      const scale = Math.min(1, PRIVATE_IMAGE_MAX_DIMENSION / longestSide);
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      if (purpose === 'receipt' && longestSide <= PRIVATE_IMAGE_MAX_DIMENSION
          && file.size > 0 && file.size <= RECEIPT_LOSSLESS_MAX_BYTES
          && ['image/png', 'image/jpeg'].includes(file.type)) {
        readAsDataUrl(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context || typeof canvas.toBlob !== 'function') {
        readAsDataUrl(file);
        return;
      }
      context.drawImage(bitmap, 0, 0, width, height);
      const readJpeg = () => {
        try {
          canvas.toBlob((compressed) => {
            if (cancelled || !isCurrent()) return;
            // Keep the dimension cap even when an unusual source compresses poorly.
            const resized = width !== sourceWidth || height !== sourceHeight;
            readAsDataUrl(compressed && (resized || compressed.size < file.size) ? compressed : file);
          }, 'image/jpeg', PRIVATE_IMAGE_JPEG_QUALITY);
        } catch {
          readAsDataUrl(file);
        }
      };
      if (purpose === 'receipt') {
        try {
          canvas.toBlob((lossless) => {
            if (cancelled || !isCurrent()) return;
            if (lossless?.type === 'image/png' && lossless.size > 0
                && lossless.size <= RECEIPT_LOSSLESS_MAX_BYTES) readAsDataUrl(lossless);
            else readJpeg();
          }, 'image/png');
        } catch {
          readJpeg();
        }
      } else readJpeg();
    } catch {
      // Decoding/canvas support is optional; the original reader remains reliable.
      readAsDataUrl(file);
    } finally {
      bitmap?.close();
      bitmap = null;
    }
  };

  void preprocess();

  return () => {
    cancelled = true;
    if (reader) {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    }
    bitmap?.close();
  };
}
