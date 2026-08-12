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
  metadata: { width: number; height: number; format: string };
}

const MAX_DIMENSION = 1920;
const INPUT_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];

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
  return buildVariant(getSharpInstance(input), variant, outputFormat);
}

export async function processOriginal(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<ProcessedImage> {
  const pipeline = getSharpInstance(input);
  const metadata = await pipeline.metadata();
  return buildOriginal(pipeline, metadata.format || 'unknown');
}

export async function generateBlurPlaceholder(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<string> {
  return buildBlur(getSharpInstance(input));
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
  // Decode the source once and derive every variant from the same pipeline.
  const base = getSharpInstance(input);
  const metadata = await base.metadata();
  const sourceFormat = metadata.format || 'unknown';

  const original = await buildOriginal(base.clone(), sourceFormat);

  const variantEntries: [string, ProcessedImage][] = await Promise.all(
    variants.map(async (variant) => {
      const processed = await buildVariant(base.clone(), variant, outputFormat);
      return [variant.name, processed];
    }),
  );

  const blurPlaceholder = await buildBlur(base.clone());

  return {
    original,
    variants: Object.fromEntries(variantEntries),
    blurPlaceholder,
    metadata: {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: sourceFormat,
    },
  };
}

async function buildOriginal(pipeline: Sharp, sourceFormat: string): Promise<ProcessedImage> {
  let out = pipeline.clone().resize(MAX_DIMENSION, undefined, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (sourceFormat === 'jpeg') {
    out = out.jpeg({ quality: 82, mozjpeg: true });
  } else if (sourceFormat === 'png') {
    out = out.png({ compressionLevel: 6 });
  } else if (sourceFormat === 'gif') {
    out = out.gif();
  } else {
    out = out.webp({ quality: 82, effort: 4 });
  }

  const result = await out.toBuffer({ resolveWithObject: true });
  const fmt = sourceFormat === 'jpeg'
    ? 'image/jpeg'
    : sourceFormat === 'png'
      ? 'image/png'
      : `image/${sourceFormat || 'webp'}`;

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: fmt,
    size: result.info.size,
  };
}

async function buildVariant(
  pipeline: Sharp,
  variant: ImageVariant,
  outputFormat: 'webp' | 'avif' | 'jpeg',
): Promise<ProcessedImage> {
  let out = pipeline.clone();

  if (variant.height) {
    out = out.resize(variant.width, variant.height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    });
  } else {
    out = out.resize(variant.width, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (outputFormat === 'webp') {
    out = out.webp({ quality: variant.quality, effort: 4 });
  } else if (outputFormat === 'avif') {
    out = out.avif({ quality: variant.quality, effort: 4 });
  } else {
    out = out.jpeg({ quality: variant.quality, mozjpeg: true });
  }

  const result = await out.toBuffer({ resolveWithObject: true });
  const fmt = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: fmt,
    size: result.info.size,
  };
}

async function buildBlur(pipeline: Sharp): Promise<string> {
  const buffer = await pipeline
    .clone()
    .resize(24, 16, { fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();

  return `data:image/webp;base64,${buffer.toString('base64')}`;
}