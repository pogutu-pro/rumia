'use client';

import * as React from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { useDropzone, FileRejection, Accept } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';

interface FileUploadProps {
  onFileAccepted: (file: File) => void;
  onFileRemoved: (file: File) => void;
  acceptedMimeTypes?: string;
  maxSize?: number; // in bytes
  label?: string;
  description?: string;
  currentFiles?: File[];
  disabled?: boolean;
}

/**
 * Drag-and-drop file upload component with robust error handling and accessibility.
 */
export function FileUpload({
  onFileAccepted,
  onFileRemoved,
  acceptedMimeTypes = 'image/*,application/pdf',
  maxSize = 5 * 1024 * 1024, // Default 5MB
  label = 'Attach File',
  description = "Drag 'n' drop a file here, or click to select.",
  currentFiles = [],
  disabled = false,
}: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = React.useState(0);

  // Convert comma-separated MIME types string to Accept type expected by react-dropzone
  const accepted: Accept | undefined = React.useMemo(() => {
    if (!acceptedMimeTypes) return undefined;
    return Object.fromEntries(
      acceptedMimeTypes.split(',').map((type) => [type.trim(), []]),
    );
  }, [acceptedMimeTypes]);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      acceptedFiles.forEach((file) => {
        onFileAccepted(file);
        // Simulate a simple fixed upload progress animation
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
      });

      fileRejections.forEach(({ file, errors }) => {
        errors.forEach((error: { code: string; message: any }) => {
          if (error.code === 'file-too-large') {
            toast.error(`File rejected: ${file.name}`, {
              description: `File size exceeds the limit of ${(maxSize / 1024 / 1024).toFixed(2)} MB.`,
            });
          } else if (error.code === 'file-invalid-type') {
            toast.error(`File rejected: ${file.name}`, {
              description: `Invalid file type. Accepted types: ${acceptedMimeTypes}`,
            });
          } else {
            toast.error(`File rejected: ${file.name}`, {
              description: error.message,
            });
          }
        });
      });
    },
    [onFileAccepted, acceptedMimeTypes, maxSize],
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isFileDialogActive,
    open: openFileDialog, // useful for accessibility: explicit open on button click
  } = useDropzone({
    onDrop,
    accept: accepted,
    maxSize,
    multiple: false, // Single file upload as current spec
    disabled,
    noClick: true, // Disable click on entire dropzone, better for accessibility with button below
    noKeyboard: false, // Allow keyboard interaction
  });

  return (
    <div
      className={cn(
        'p-4 border-2 border-dashed rounded-lg transition-colors duration-200',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/50',
        disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
      )}
    >
      {/* Dropzone Area */}
      <div
        {...getRootProps()}
        className="cursor-pointer text-center p-4"
        aria-disabled={disabled}
      >
        <input {...getInputProps()} aria-label={label} />
        <UploadCloud
          className="mx-auto h-10 w-10 text-primary mb-3"
          aria-hidden="true"
        />
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Optional Button to open file dialog for better accessibility */}
      {!disabled && (
        <div className="flex justify-center mt-2">
          <Button variant="secondary" onClick={openFileDialog} type="button">
            Select File
          </Button>
        </div>
      )}

      {/* Progress Bar */}
      {uploadProgress > 0 && (
        <Progress
          value={uploadProgress}
          className="h-2 w-full mt-4"
          aria-live="polite"
        />
      )}

      {/* Current Files List */}
      {currentFiles.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${index}`}
          className="flex items-center justify-between p-2 mt-2 border rounded-md bg-muted/50"
          aria-label={`Uploaded file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`}
        >
          <div className="flex items-center space-x-3 truncate">
            <FileText
              className="h-5 w-5 text-primary shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm font-medium truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onFileRemoved(file)}
            aria-label={`Remove file ${file.name}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
