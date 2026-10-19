import type { StayImage } from './stay-format';

/**
 * Listing photos are stored as fixed variants next to each other on R2: thumb (400×300, cropped), card (800×600,
 * cropped), gallery (≤1200 wide, uncropped) and large (≤1600 wide, uncropped). RumiaBnB frames photos itself (tall
 * tiles, carousels, full-screen), so it always asks for an uncropped variant; only tiny thumbnails use `thumb`.
 */
export type PhotoSize = 'thumb' | 'gallery' | 'large';

const VARIANT = /\/(thumb|card|gallery|large|original)\.(webp|jpe?g|png)$/i;

export function photoUrl(url: string, size: PhotoSize): string {
  const m = url.match(VARIANT);
  if (!m) return url; // not a stored listing photo (e.g. a YouTube thumbnail): use as is
  return `${url.slice(0, m.index)}/${size}.${m[2]}`;
}

/** Taller than wide (phone photos held upright). Unknown size counts as landscape. */
export function isPortrait(img: Pick<StayImage, 'width' | 'height'>): boolean {
  return !!(img.width && img.height && img.height > img.width * 1.1);
}

/** Most of the photos are portrait: layouts switch to tall frames so less of each photo is cut away. */
export function mostlyPortrait(images: StayImage[]): boolean {
  if (images.length === 0) return false;
  return images.filter(isPortrait).length * 2 > images.length;
}
