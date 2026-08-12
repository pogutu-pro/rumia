export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

const defaultOptions: CompressOptions = {
  maxWidth: 1600,
  quality: 0.8,
  format: 'image/webp',
};

let _supportsWebp: boolean | null = null;

function supportsWebp(): boolean {
  if (_supportsWebp !== null) return _supportsWebp;
  const canvas = document.createElement('canvas');
  _supportsWebp = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  return _supportsWebp;
}

export function compressImage(file: File, options: CompressOptions = {}): Promise<{
  blob: Blob;
  fileName: string;
  fileType: string;
}> {
  const opts = { ...defaultOptions, ...options };
  const format = supportsWebp() ? (opts.format as 'image/webp' | 'image/jpeg') : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (opts.maxWidth && width > opts.maxWidth) {
        height = Math.round(height * (opts.maxWidth / width));
        width = opts.maxWidth;
      }

      if (opts.maxHeight && height > opts.maxHeight) {
        width = Math.round(width * (opts.maxHeight / height));
        height = opts.maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const ext = format === 'image/webp' ? 'webp' : 'jpg';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            resolve({
              blob,
              fileName: `${baseName}.${ext}`,
              fileType: format,
            });
          } else {
            reject(new Error('Compression failed — no blob returned'));
          }
        },
        format,
        opts.quality,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
}
