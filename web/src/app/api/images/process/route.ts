import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { imagesApi } from '@/lib/api/images';
import { processImage } from '@/lib/image/processor';
import { LISTING_VARIANTS, AGENT_VARIANTS } from '@/lib/image/variants';
import { generateImageBasePath, getVariantKey, getBlurKey } from '@/lib/image/keys';
import { ALLOWED_MIME_TYPES } from '@/lib/image/validate';
import { uploadBuffer, uploadBuffers, getPublicUrl, isConfigured } from '@/lib/r2/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PURPOSES = ['listing', 'agent', 'og'] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Cloud storage not configured.' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const file = formData.get('file');
  const rawPurpose = formData.get('purpose');
  const purpose = PURPOSES.includes(rawPurpose as any) ? (rawPurpose as typeof PURPOSES[number]) : 'listing';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported format: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF, HEIC.` },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Image data is empty' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image data exceeds 10MB limit. Please upload a smaller photo.' },
      { status: 400 },
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const variants = purpose === 'agent' ? AGENT_VARIANTS : LISTING_VARIANTS;

    const result = await processImage(inputBuffer, variants, 'webp');

    const sourceWidth = result.metadata.width;
    const sourceHeight = result.metadata.height;
    if (sourceWidth < 100 || sourceHeight < 100) {
      return NextResponse.json(
        { error: `Image too small: ${sourceWidth}x${sourceHeight}. Minimum is 100x100.` },
        { status: 400 },
      );
    }

    const basePath = generateImageBasePath(user.id, file.name);

    const uploads: Array<{ key: string; buffer: Buffer; contentType: string }> = [];

    uploads.push({
      key: getVariantKey(basePath, 'original', result.original.format),
      buffer: result.original.buffer,
      contentType: result.original.format,
    });

    for (const [name, variant] of Object.entries(result.variants)) {
      uploads.push({
        key: getVariantKey(basePath, name, variant.format),
        buffer: variant.buffer,
        contentType: variant.format,
      });
    }

    const blurBuffer = Buffer.from(result.blurPlaceholder.replace('data:image/webp;base64,', ''), 'base64');
    uploads.push({
      key: getBlurKey(basePath),
      buffer: blurBuffer,
      contentType: 'image/webp',
    });

    await uploadBuffers(uploads);

    // Record metadata in image_uploads table
    const thumbnailKey = getVariantKey(basePath, 'thumb', 'image/webp');
    const smallKey = getVariantKey(basePath, 'card', 'image/webp');
    const mediumKey = getVariantKey(basePath, 'gallery', 'image/webp');
    const largeKey = getVariantKey(basePath, 'large', 'image/webp');

    // Registration failure must not lose the upload: the image is already in R2 and the
    // client can still use the URLs; only listing cleanup linkage would be missing.
    const imageUpload = await imagesApi
      .registerUploadServer({
        original_filename: file.name,
        width: result.original.width,
        height: result.original.height,
        file_size: result.original.size,
        format: result.original.format,
        thumbnail_key: thumbnailKey,
        small_key: smallKey,
        medium_key: mediumKey,
        large_key: largeKey,
      })
      .catch((err) => {
        console.error('Image upload registration failed:', err);
        return null;
      });

    const primaryVariant = purpose === 'agent' ? 'profile' : 'card';
    const primaryUrl = getPublicUrl(getVariantKey(basePath, primaryVariant, 'image/webp'));

    const thumbnailUrl = getPublicUrl(getVariantKey(basePath, 'thumb', 'image/webp'));
    const blurUrl = getPublicUrl(getBlurKey(basePath));

    const originalKey = getVariantKey(basePath, 'original', result.original.format);
    const originalUrl = getPublicUrl(originalKey);

    const variantUrls: Record<string, string> = {};
    for (const name of Object.keys(result.variants)) {
      variantUrls[name] = getPublicUrl(getVariantKey(basePath, name, 'image/webp'));
    }

    return NextResponse.json({
      url: primaryUrl,
      thumbnailUrl,
      blurUrl,
      originalUrl,
      variantUrls,
      width: result.original.width,
      height: result.original.height,
      format: result.original.format,
      size: result.original.size,
      imageUploadId: imageUpload?.id || null,
    });
  } catch (error: any) {
    console.error('Image processing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process image' },
      { status: 500 },
    );
  }
}