import sharp, { Sharp } from 'sharp';
import type { ImageVariant } from './variants';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ProcessResult {
  original: ProcessedImage;
  variants: Record<string, ProcessedImage>;
  blurPlaceholder: string;
}

const MAX_DIMENSION = 2400;
const INPUT_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export function isAcceptedFormat(mimeType: string): boolean {
  return INPUT_ACCEPTED.includes(mimeType);
}

export function getSharpInstance(input: Buffer | ArrayBuffer | Uint8Array): Sharp {
  return sharp(input).rotate();
}

export async function processVariant(
  input: Buffer | ArrayBuffer | Uint8Array,
  variant: ImageVariant,
  outputFormat: 'webp' | 'avif' | 'jpeg' = 'webp',
): Promise<ProcessedImage> {
  const pipeline = getSharpInstance(input);

  if (variant.height) {
    pipeline.resize(variant.width, variant.height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    });
  } else {
    pipeline.resize(variant.width, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (outputFormat === 'webp') {
    pipeline.webp({ quality: variant.quality, effort: 4 });
  } else if (outputFormat === 'avif') {
    pipeline.avif({ quality: variant.quality, effort: 4 });
  } else {
    pipeline.jpeg({ quality: variant.quality, mozjpeg: true });
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true });
  const fmt = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: fmt,
    size: result.info.size,
  };
}

export async function processOriginal(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<ProcessedImage> {
  const pipeline = getSharpInstance(input);

  pipeline.resize(MAX_DIMENSION, undefined, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  const metadata = await getSharpInstance(input).metadata();
  const originalFormat = metadata.format as string | undefined;

  if (originalFormat === 'jpeg') {
    pipeline.jpeg({ quality: 82, mozjpeg: true });
  } else if (originalFormat === 'png') {
    pipeline.png({ compressionLevel: 6 });
  } else if (originalFormat === 'gif') {
    pipeline.gif();
  } else {
    pipeline.webp({ quality: 82, effort: 4 });
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true });
  const fmt = originalFormat === 'jpeg'
    ? 'image/jpeg'
    : originalFormat === 'png'
      ? 'image/png'
      : `image/${originalFormat || 'webp'}`;

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: fmt,
    size: result.info.size,
  };
}

export async function generateBlurPlaceholder(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<string> {
  const buffer = await getSharpInstance(input)
    .resize(24, 16, { fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();

  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

export async function getImageMetadata(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<{ width: number; height: number; format: string }> {
  const metadata = await getSharpInstance(input).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
  };
}

export async function processImage(
  input: Buffer | ArrayBuffer | Uint8Array,
  variants: ImageVariant[],
  outputFormat: 'webp' | 'avif' | 'jpeg' = 'webp',
): Promise<ProcessResult> {
  const original = await processOriginal(input);

  const variantEntries: [string, ProcessedImage][] = await Promise.all(
    variants.map(async (variant) => {
      const processed = await processVariant(input, variant, outputFormat);
      return [variant.name, processed];
    }),
  );

  const blurPlaceholder = await generateBlurPlaceholder(input);

  return {
    original,
    variants: Object.fromEntries(variantEntries),
    blurPlaceholder,
  };
}
