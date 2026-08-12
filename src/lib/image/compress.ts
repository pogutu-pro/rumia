export interface CompressedImage {
  file: File;
  width: number;
  height: number;
  skipped: boolean;
}

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

const MAX_DIMENSION = 1920;
const QUALITY = 0.8;

export async function compressImage(
  source: File,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const maxDimension = options.maxDimension ?? MAX_DIMENSION;
  const quality = options.quality ?? QUALITY;

  if (source.type === 'image/gif') {
    return { file: source, width: 0, height: 0, skipped: true };
  }

  const objectUrl = URL.createObjectURL(source);

  try {
    let image: HTMLImageElement;
    try {
      image = await loadImage(objectUrl);
    } catch {
      // HEIC/HEIF (iPhone default) can't be decoded by every browser.
      // Safari can, so we try; otherwise pass the original through and let
      // the server (sharp/libheif) process it.
      if (source.type === 'image/heic' || source.type === 'image/heif') {
        return { file: source, width: 0, height: 0, skipped: true };
      }
      throw new Error('Unable to read image file');
    }
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) {
      return { file: source, width: 0, height: 0, skipped: true };
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvasWidth = Math.max(1, Math.round(width * scale));
    const canvasHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file: source, width, height, skipped: true };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    const mime = supportsWebpEncoding() ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob || blob.size === 0) {
      return { file: source, width, height, skipped: true };
    }

    if (blob.size >= source.size) {
      return { file: source, width, height, skipped: true };
    }

    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const name = source.name.replace(/\.[^/.]+$/, '') + '.' + ext;

    return {
      file: new File([blob], name, { type: mime, lastModified: Date.now() }),
      width: canvasWidth,
      height: canvasHeight,
      skipped: false,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function supportsWebpEncoding(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document
      .createElement('canvas')
      .toDataURL('image/webp')
      .startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to read image file'));
    img.decoding = 'async';
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      type,
      quality,
    );
  });
}