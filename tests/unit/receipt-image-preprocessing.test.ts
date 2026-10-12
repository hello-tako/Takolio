import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVATE_IMAGE_JPEG_QUALITY, readPrivateImage, RECEIPT_LOSSLESS_MAX_BYTES } from '../../src/web/lib/private-image';
import { resetPrivateSession } from '../../src/web/lib/private-session';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
class DeferredReader {
  static LOADING = 1;
  static readers: DeferredReader[] = [];
  readyState = 1;
  result: string | null = null;
  onload: (() => void) | null = null;
  abort = vi.fn();
  readAsDataURL = vi.fn();
  constructor() { DeferredReader.readers.push(this); }
}
const sizedBlob = (size: number, type = 'image/png') => new Blob([new Uint8Array(size)], { type });
async function flush() { await Promise.resolve(); await Promise.resolve(); }
function canvasFixture(width = 1000, height = 1600) {
  const close = vi.fn();
  const calls: { callback: BlobCallback; type?: string; quality?: number }[] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }),
    toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => { calls.push({ callback, type, quality }); }) };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  return { canvas, calls, close };
}
function readBlob() { return DeferredReader.readers[0]?.readAsDataURL.mock.calls[0]?.[0]; }
function changeSession(action: string) {
  if (action === 'household') localStorage.setItem('frigo_household_id', 'b');
  else if (action === 'account') localStorage.setItem('frigo_user_id', 'b');
  else resetPrivateSession();
}
beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('FileReader', DeferredReader);
  DeferredReader.readers = [];
  localStorage.setItem('frigo_user_id', 'a');
  localStorage.setItem('frigo_household_id', 'a');
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('receipt lossless policy', () => {
  it.each(['image/png', 'image/jpeg'])('preserves the original %s at the exact size/dimension boundary', async (type) => {
    const fixture = canvasFixture(2000, 1000);
    const original = sizedBlob(RECEIPT_LOSSLESS_MAX_BYTES, type);
    readPrivateImage(original, vi.fn(), 'receipt');
    await flush();
    expect(readBlob()).toBe(original);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(fixture.close).toHaveBeenCalledOnce();
  });
  it.each(['default', 'photo'] as const)('retains JPEG82 and the smaller-source rule for %s callers', async (purpose) => {
    const { calls } = canvasFixture();
    const original = sizedBlob(20);
    const jpeg = sizedBlob(10, 'image/jpeg');
    readPrivateImage(original, vi.fn(), purpose === 'default' ? undefined : purpose);
    await flush();
    expect(calls[0]).toMatchObject({ type: 'image/jpeg', quality: PRIVATE_IMAGE_JPEG_QUALITY });
    calls[0].callback(jpeg);
    expect(readBlob()).toBe(jpeg);
  });
  it('retains a smaller photo original even when JPEG would grow it', async () => {
    const { calls } = canvasFixture();
    const original = sizedBlob(20);
    readPrivateImage(original, vi.fn());
    await flush(); calls[0].callback(sizedBlob(21, 'image/jpeg'));
    expect(readBlob()).toBe(original);
  });
  it.each(['oversize_bytes', 'other_mime', 'oversize_dimensions', 'empty'] as const)('encodes %s receipts and accepts PNG at the byte boundary', async (reason) => {
    const { canvas, calls, close } = canvasFixture(reason === 'oversize_dimensions' ? 4000 : 1000, reason === 'oversize_dimensions' ? 3000 : 1600);
    const original = sizedBlob(reason === 'oversize_bytes' ? RECEIPT_LOSSLESS_MAX_BYTES + 1 : reason === 'empty' ? 0 : 10,
      reason === 'other_mime' ? 'image/webp' : 'image/png');
    readPrivateImage(original, vi.fn(), 'receipt');
    await flush();
    expect(calls[0].type).toBe('image/png');
    expect(Math.max(canvas.width, canvas.height)).toBe(reason === 'oversize_dimensions' ? 2000 : 1600);
    const png = sizedBlob(RECEIPT_LOSSLESS_MAX_BYTES);
    calls[0].callback(png);
    expect(readBlob()).toBe(png);
    expect(calls).toHaveLength(1);
    expect(close).toHaveBeenCalledOnce();
  });
  it.each(['null', 'empty', 'wrong_mime', 'oversize'] as const)('falls back to JPEG82 on %s PNG output', async (reason) => {
    const { calls } = canvasFixture(4000, 3000);
    const original = sizedBlob(10);
    readPrivateImage(original, vi.fn(), 'receipt');
    await flush();
    const png = reason === 'null' ? null : sizedBlob(reason === 'empty' ? 0 : reason === 'oversize' ? RECEIPT_LOSSLESS_MAX_BYTES + 1 : 10,
      reason === 'wrong_mime' ? 'image/jpeg' : 'image/png');
    calls[0].callback(png);
    expect(calls[1]).toMatchObject({ type: 'image/jpeg', quality: PRIVATE_IMAGE_JPEG_QUALITY });
    const resizedJpeg = sizedBlob(30, 'image/jpeg');
    calls[1].callback(resizedJpeg);
    expect(readBlob()).toBe(resizedJpeg);
  });
  it('tries JPEG when PNG encoding throws', async () => {
    const { canvas, calls } = canvasFixture(4000, 3000);
    canvas.toBlob.mockImplementationOnce(() => { throw new Error('unsupported PNG'); });
    readPrivateImage(sizedBlob(10), vi.fn(), 'receipt');
    await flush();
    expect(calls[0].type).toBe('image/jpeg');
    calls[0].callback(null);
    expect(readBlob()).toBeDefined();
  });
  it('retains the original if the delayed JPEG encoder throws', async () => {
    const { canvas, calls } = canvasFixture(4000, 3000);
    const original = sizedBlob(10);
    readPrivateImage(original, vi.fn(), 'receipt');
    await flush();
    canvas.toBlob.mockImplementationOnce(() => { throw new Error('unsupported JPEG'); });
    calls[0].callback(null);
    expect(readBlob()).toBe(original);
  });
  it('retains decode-failure fallback without changing the source bytes', async () => {
    canvasFixture();
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('damaged'));
    const original = sizedBlob(10);
    readPrivateImage(original, vi.fn(), 'receipt');
    await flush();
    expect(readBlob()).toBe(original);
  });
});

describe('receipt asynchronous privacy fences', () => {
  it.each(['cancel', 'household', 'account', 'reset'])('stops before PNG/JPEG callbacks after %s', async (action) => {
    const { calls } = canvasFixture(4000, 3000);
    const deliver = vi.fn();
    const cancel = readPrivateImage(sizedBlob(10), deliver, 'receipt');
    await flush();
    if (action === 'cancel') cancel(); else changeSession(action);
    calls[0].callback(null);
    expect(calls).toHaveLength(1);
    expect(DeferredReader.readers).toHaveLength(0);
    expect(deliver).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'household', 'account', 'reset'])('ignores delayed JPEG after %s', async (action) => {
    const { calls } = canvasFixture(4000, 3000);
    const cancel = readPrivateImage(sizedBlob(10), vi.fn(), 'receipt');
    await flush(); calls[0].callback(null);
    if (action === 'cancel') cancel(); else changeSession(action);
    calls[1].callback(sizedBlob(10, 'image/jpeg'));
    expect(DeferredReader.readers).toHaveLength(0);
  });
  it.each(['cancel', 'household', 'account', 'reset'])('ignores a queued original FileReader after %s', async (action) => {
    canvasFixture();
    const deliver = vi.fn();
    const cancel = readPrivateImage(sizedBlob(10), deliver, 'receipt');
    await flush();
    const reader = DeferredReader.readers[0];
    const queued = reader.onload!;
    if (action === 'cancel') cancel(); else changeSession(action);
    reader.result = 'data:image/png;base64,dGVzdA==';
    queued();
    expect(deliver).not.toHaveBeenCalled();
    if (action === 'cancel') expect(reader.abort).toHaveBeenCalledOnce();
  });
  it('closes a bitmap resolved after cancellation without creating a canvas', async () => {
    const { close } = canvasFixture(4000, 3000);
    let resolve!: (value: ImageBitmap) => void;
    vi.mocked(createImageBitmap).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const cancel = readPrivateImage(sizedBlob(10), vi.fn(), 'receipt');
    cancel(); resolve({ width: 4000, height: 3000, close } as unknown as ImageBitmap);
    await flush();
    expect(close).toHaveBeenCalled();
    expect(document.createElement).not.toHaveBeenCalled();
  });
});
