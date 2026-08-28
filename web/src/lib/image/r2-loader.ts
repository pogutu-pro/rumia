const LISTING_VARIANTS = new Set(['thumb', 'card', 'gallery', 'large', 'original']);
const VARIANT_MATCH = /\/([a-z0-9_-]+)\.(webp|jpg|jpeg|png)$/i;

function variantForWidth(width: number): 'thumb' | 'card' | 'gallery' {
  if (width <= 400) return 'thumb';
  if (width <= 800) return 'card';
  return 'gallery';
}

export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (width <= 0) return src;

  const match = src.match(VARIANT_MATCH);
  if (!match) return src;

  const [, name, ext] = match;
  if (!LISTING_VARIANTS.has(name)) return src;

  const target = variantForWidth(width);
  if (target === name) return src;

  return `${src.slice(0, match.index)}/${target}.${ext}`;
}