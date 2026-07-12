import { createHash } from 'crypto';

export function generateImageBasePath(
  userId: string,
  originalFilename: string,
): string {
  const hash = createHash('sha256')
    .update(`${userId}-${originalFilename}-${Date.now()}`)
    .digest('hex')
    .slice(0, 12);

  const safeName = originalFilename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);

  return `${userId}/${safeName}_${hash}`;
}

export function getVariantKey(
  basePath: string,
  variantName: string,
  format: string,
): string {
  const ext = format === 'image/jpeg'
    ? 'jpg'
    : format === 'image/webp'
      ? 'webp'
      : format === 'image/avif'
        ? 'avif'
        : 'png';
  return `${basePath}/${variantName}.${ext}`;
}

export function getBlurKey(basePath: string): string {
  return `${basePath}/blur.webp`;
}
