export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 4096;
export const MIN_DIMENSION = 100;
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export interface ValidationError {
  code: string;
  message: string;
}

export function validateUpload(file: File): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: `Unsupported format: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF.`,
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File is ${mb}MB. Maximum is 10MB.`,
    });
  }

  if (file.size === 0) {
    errors.push({
      code: 'EMPTY_FILE',
      message: 'File is empty.',
    });
  }

  return errors;
}

export function validateImageBuffer(buffer: Buffer): ValidationError[] {
  const errors: ValidationError[] = [];

  if (buffer.length === 0) {
    errors.push({
      code: 'EMPTY_BUFFER',
      message: 'Image buffer is empty.',
    });
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES * 1.5) {
    errors.push({
      code: 'BUFFER_TOO_LARGE',
      message: 'Processed image exceeds maximum allowed size.',
    });
  }

  return errors;
}
