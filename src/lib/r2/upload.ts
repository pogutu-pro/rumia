export async function uploadToR2(file: File): Promise<string> {
  // 1. Get presigned URL from our API
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!res.ok) throw new Error('Failed to get upload URL');

  const { uploadUrl, key } = await res.json();

  // 2. Upload directly to R2
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!upload.ok) throw new Error('Failed to upload file');

  // 3. Return the public URL
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}
