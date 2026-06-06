'use client';

import * as React from 'react';
import { Camera, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

interface ImageUploadProps {
  onImageChange: (file: File | null) => void;
  currentImageUrl?: string | null;
  aspectRatio?: '16/9' | '4/3' | '1/1';
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  onImageChange,
  currentImageUrl,
  aspectRatio = '1/1',
  label = 'Upload Image',
  className,
  disabled = false,
}: ImageUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(
    currentImageUrl || null,
  );

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return toast.error('File rejected.', {
          description: 'Only image files are accepted.',
        });
      }
      const file = acceptedFiles[0];
      const filePreview = URL.createObjectURL(file);
      setPreview(filePreview);
      onImageChange(file);
    },
    [onImageChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] },
    maxFiles: 1,
    disabled,
  });

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageChange(null);
    if (preview && !currentImageUrl) {
      URL.revokeObjectURL(preview);
    }
  };

  const paddingBottom = React.useMemo(() => {
    switch (aspectRatio) {
      case '16/9':
        return '56.25%';
      case '4/3':
        return '75%';
      case '1/1':
      default:
        return '100%';
    }
  }, [aspectRatio]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}

      <div
        {...getRootProps()}
        style={{ paddingBottom }}
        className={cn(
          'relative w-full cursor-pointer rounded-xl border-2 border-dashed transition-colors duration-200',
          'bg-muted/30 group',
          isDragActive
            ? 'border-primary'
            : 'border-border hover:border-muted-foreground/50',
          disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
        )}
      >
        <input {...getInputProps()} />

        {preview || currentImageUrl ? (
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={preview || currentImageUrl || ''}
              alt="Preview"
              fill
              className="object-cover rounded-xl"
              sizes="(max-width: 600px) 100vw, 50vw"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl">
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10"
                onClick={handleRemove}
                aria-label="Remove image"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <Camera className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Click or drag photo</p>
            <p className="text-xs">
              {aspectRatio !== '1/1'
                ? `(Recommended Aspect: ${aspectRatio})`
                : 'for Avatar/Profile'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
