import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

const r2AccountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

let s3: S3Client | null = null;
if (r2AccountId && accessKeyId && secretAccessKey) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function GET(request: NextRequest) {
  // Require authenticated session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const filetype = searchParams.get('filetype') || 'image/jpeg';

    if (!filename) {
      return NextResponse.json({ error: 'Missing filename parameter' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(filetype)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    if (!s3 || !bucketName) {
      return NextResponse.json({ error: 'Cloud storage is not configured properly.' }, { status: 500 });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueKey = `${user.id}/${Date.now()}-${cleanFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      ContentType: filetype,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${publicUrlBase.replace(/\/$/, '')}/${uniqueKey}`;

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
