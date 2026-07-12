import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processImage, generateBlurPlaceholder, getImageMetadata } from '@/lib/image/processor';
import { LISTING_VARIANTS, AGENT_VARIANTS } from '@/lib/image/variants';
import { generateImageBasePath, getVariantKey, getBlurKey } from '@/lib/image/keys';
import { validateUpload } from '@/lib/image/validate';
import { uploadBuffer, uploadBuffers, getPublicUrl, isConfigured } from '@/lib/r2/client';

interface ProcessRequest {
  filename: string;
  contentType: string;
  purpose: 'listing' | 'agent' | 'og';
  dataUrl: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Cloud storage not configured.' }, { status: 500 });
  }

  let body: ProcessRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { filename, contentType, purpose, dataUrl } = body;

  if (!filename || !contentType || !dataUrl || !purpose) {
    return NextResponse.json(
      { error: 'filename, contentType, purpose, and dataUrl are required' },
      { status: 400 },
    );
  }

  const fakeFile = new File([Buffer.from('')], filename, { type: contentType });
  const validationErrors = validateUpload(fakeFile);
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: validationErrors.map((e) => e.message).join(' ') },
      { status: 400 },
    );
  }

  let inputBuffer: Buffer;
  try {
    const base64 = dataUrl.split(',')[1];
    inputBuffer = Buffer.from(base64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
  }

  if (inputBuffer.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image data exceeds 10MB limit' }, { status: 400 });
  }

  try {
    const metadata = await getImageMetadata(inputBuffer);
    if (metadata.width < 100 || metadata.height < 100) {
      return NextResponse.json(
        { error: `Image too small: ${metadata.width}x${metadata.height}. Minimum is 100x100.` },
        { status: 400 },
      );
    }

    const variants = purpose === 'agent' ? AGENT_VARIANTS : LISTING_VARIANTS;

    const result = await processImage(inputBuffer, variants, 'webp');

    const basePath = generateImageBasePath(user.id, filename);

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

    const { data: imageUpload } = await supabase
      .from('image_uploads')
      .insert({
        original_filename: filename,
        width: result.original.width,
        height: result.original.height,
        file_size: result.original.size,
        format: result.original.format,
        thumbnail_key: thumbnailKey,
        small_key: smallKey,
        medium_key: mediumKey,
        large_key: largeKey,
      })
      .select('id')
      .single();

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
