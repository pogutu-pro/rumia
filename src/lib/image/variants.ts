export interface ImageVariant {
  name: string;
  width: number;
  height: number | null;
  quality: number;
}

export const LISTING_VARIANTS: ImageVariant[] = [
  { name: 'thumb', width: 400, height: 300, quality: 75 },
  { name: 'card', width: 800, height: 600, quality: 80 },
  { name: 'gallery', width: 1200, height: null, quality: 82 },
  { name: 'large', width: 1600, height: null, quality: 80 },
];

export const AGENT_VARIANTS: ImageVariant[] = [
  { name: 'avatar', width: 200, height: 200, quality: 80 },
  { name: 'profile', width: 400, height: null, quality: 80 },
  { name: 'cover', width: 1200, height: null, quality: 80 },
];

export const OG_VARIANT: ImageVariant = {
  name: 'og',
  width: 1200,
  height: 630,
  quality: 80,
};

export function buildVariantKey(
  basePath: string,
  variant: ImageVariant,
  format: string,
): string {
  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : format === 'image/avif' ? 'avif' : 'png';
  return `${basePath}/${variant.name}.${ext}`;
}

export function buildBlurKey(basePath: string): string {
  return `${basePath}/blur.webp`;
}

export function variantFromName(name: string): ImageVariant | undefined {
  return [...LISTING_VARIANTS, ...AGENT_VARIANTS, OG_VARIANT].find(
    (v) => v.name === name,
  );
}
