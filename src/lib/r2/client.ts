import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2AccountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  if (!r2AccountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL_IMMUTABLE,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

export async function uploadBuffer(key: string, buffer: Buffer, contentType: string) {
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL_IMMUTABLE,
  }));
}

export async function uploadBuffers(
  entries: Array<{ key: string; buffer: Buffer; contentType: string }>,
): Promise<void> {
  await Promise.all(
    entries.map(({ key, buffer, contentType }) =>
      uploadBuffer(key, buffer, contentType),
    ),
  );
}

export async function deleteFile(key: string) {
  await getClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }));
}

export function getPublicUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

export function isConfigured(): boolean {
  return !!(r2AccountId && accessKeyId && secretAccessKey && process.env.R2_BUCKET_NAME);
}
