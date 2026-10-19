'use client';

import { useState } from 'react';
import Image from 'next/image';
import { photoUrl, type PhotoSize } from '@/lib/site/photos';

/**
 * A listing photo at an uncropped stored size (see lib/site/photos.ts). Served straight from R2 (already resized and
 * WebP), so Next does not re-encode it. Falls back to the stored URL if that size is missing on an old upload.
 */
export function Photo({
  src,
  size = 'gallery',
  alt,
  className,
  priority,
  blur,
  sizes,
}: {
  src: string;
  size?: PhotoSize;
  alt: string;
  className?: string;
  priority?: boolean;
  blur?: string | null;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? src : photoUrl(src, size)}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      placeholder={blur ? 'blur' : 'empty'}
      blurDataURL={blur ?? undefined}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
