import { compressImage, type CompressedImage } from '@/lib/image/compress';

export interface ProcessedImageResult {
  url: string;
  thumbnailUrl: string;
  blurUrl: string;
  originalUrl: string;
  variantUrls: Record<string, string>;
  width: number;
  height: number;
  format: string;
  size: number;
  imageUploadId: string | null;
}

export async function processAndUploadImage(
  file: File,
  purpose: 'listing' | 'agent' | 'og' = 'listing',
): Promise<ProcessedImageResult> {
  const compressed = await compressForUpload(file);

  const body = new FormData();
  body.append('file', compressed.file);
  body.append('purpose', purpose);
  body.append('originalSize', String(file.size));

  const res = await fetch('/api/images/process', {
    method: 'POST',
    body,
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message);
  }

  return res.json();
}

async function compressForUpload(file: File): Promise<CompressedImage> {
  try {
    return await compressImage(file);
  } catch {
    throw new Error(
      'This image could not be read. Please try a JPEG, PNG, WebP, GIF, AVIF, or HEIC photo.',
    );
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  } catch {
    // fall through
  }

  switch (res.status) {
    case 401:
      return 'Your session has expired. Please log in again.';
    case 413:
      return 'Image file is too large. Please choose a smaller photo.';
    default:
      return `Upload failed (HTTP ${res.status})`;
  }
}