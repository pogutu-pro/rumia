export interface ProcessedImageResult {
  url: string;
  thumbnailUrl: string;
  blurUrl: string;
  originalUrl: string;
  variantUrls: Record<string, string>;
  width: number;
  height: number;
  format: string;
  size: number;
  imageUploadId: string | null;
}

export async function processAndUploadImage(
  file: File,
  purpose: 'listing' | 'agent' | 'og' = 'listing',
): Promise<ProcessedImageResult> {
  const dataUrl = await readFileAsDataUrl(file);

  const res = await fetch('/api/images/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      purpose,
      dataUrl,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to process image');
  }

  return res.json();
}

export async function uploadToR2(file: File): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!res.ok) throw new Error('Failed to get upload URL');

  const { uploadUrl, key } = await res.json();

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!upload.ok) throw new Error('Failed to upload file');

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
