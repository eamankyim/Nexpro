import imageCompression from 'browser-image-compression';

/** Reject originals larger than this before compression (browser may still OOM on huge decode). */
export const PRODUCT_IMAGE_MAX_INPUT_BYTES = 40 * 1024 * 1024;

/** Files at or below this size are uploaded as-is to save CPU. */
export const PRODUCT_IMAGE_SKIP_COMPRESS_MAX_BYTES = 400 * 1024;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
};

/**
 * Compress a product image in the browser before upload (smaller payload, fewer server/DB issues).
 * @param {File} file
 * @param {{ onProgress?: (percent: number) => void }} [options] - onProgress: 0–100 while compressing (skipped for small files; see PRODUCT_IMAGE_SKIP_COMPRESS_MAX_BYTES)
 * @returns {Promise<File>}
 */
export async function compressProductImageFile(file, options = {}) {
  const { onProgress } = options;
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file');
  }
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > PRODUCT_IMAGE_MAX_INPUT_BYTES) {
    throw new Error(
      `Image is too large (max ${PRODUCT_IMAGE_MAX_INPUT_BYTES / 1024 / 1024}MB). Try a smaller photo.`
    );
  }

  if (file.size <= PRODUCT_IMAGE_SKIP_COMPRESS_MAX_BYTES) {
    return file;
  }

  const blob = await imageCompression(file, {
    ...COMPRESSION_OPTIONS,
    onProgress: (p) => {
      const n = Number(p);
      if (!Number.isFinite(n)) return;
      // Library may report 0–1 or 0–100 depending on version
      const pct = n >= 0 && n <= 1 ? Math.round(n * 100) : Math.min(100, Math.round(n));
      onProgress?.(pct);
    },
  });

  const base = (file.name || 'product').replace(/\.[^.]+$/, '') || 'product';
  const type = blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}
