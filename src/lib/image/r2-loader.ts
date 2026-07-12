const R2_HOSTNAME = 'pub-35395ff8fc144313adfa903807f2a359.r2.dev';

export default function r2Loader({ src, width, quality }: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (src.includes(R2_HOSTNAME) || src.includes('.r2.dev/')) {
    return src;
  }
  const q = quality || 75;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}
