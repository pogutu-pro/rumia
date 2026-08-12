'use client';

import * as React from 'react';
import { UploadCloud, X, GripVertical, Image as ImageIcon } from 'lucide-react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export type UploadedFile = File & { preview: string; id: string };

interface MultiImageUploadProps {
  files: UploadedFile[];
  setFiles: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

interface SortableItemProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
}

function SortableItem({ file, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center bg-card border rounded-lg shadow-sm h-20 p-2 group transition-shadow',
        isDragging && 'shadow-lg opacity-80 border-primary/50'
      )}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="h-full px-2 flex items-center border-r mr-3 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      </div>

      {/* Image Preview */}
      <div className="relative h-full w-16 rounded-md overflow-hidden mr-4 shrink-0">
        <Image
          src={file.preview}
          alt={file.name}
          fill
          sizes="100px"
          className="object-cover"
        />
      </div>

      {/* File Details */}
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(file.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

/**
 * Component for uploading, previewing, and reordering multiple images.
 */
export function MultiImageUpload({
  files,
  setFiles,
  maxFiles = 10,
  maxSize = 5 * 1024 * 1024, // Default 5MB
}: MultiImageUploadProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Check if new files exceed maxFiles limit
      const totalFiles = files.length + acceptedFiles.length;
      if (totalFiles > maxFiles) {
        toast.error('Upload Limit Exceeded', {
          description: `You can only upload a maximum of ${maxFiles} images. Please remove some existing files.`,
        });
        acceptedFiles = acceptedFiles.slice(0, maxFiles - files.length); // Only take valid number
      }

      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        ...file,
        id: Math.random().toString(36).substring(2, 9), // Unique ID for sorting
        preview: URL.createObjectURL(file),
      }));

      setFiles([...files, ...newFiles]);

      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((error) => {
          toast.error(`File rejected: ${rejection.file.name}`, {
            description: error.message,
          });
        });
      });
    },
    [files, maxFiles, setFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] },
    maxSize: maxSize,
    multiple: true,
  } as any);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);

      setFiles(arrayMove(files, oldIndex, newIndex));
    }
  };

  const handleRemove = (id: string) => {
    setFiles(files.filter((file) => file.id !== id));
    // Revoke the object URL to free up memory
    const fileToRemove = files.find((file) => file.id === id);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  React.useEffect(() => {
    // Cleanup URLs when component unmounts
    return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
  }, [files]);

  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'p-8 border-2 border-dashed rounded-xl text-center transition-all duration-200 cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50',
        )}
      >
        <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
        <UploadCloud className="mx-auto h-10 w-10 text-primary mb-3" />
        <p className="text-base font-semibold text-foreground">
          Drag & drop your photos here
        </p>
        <p className="text-sm text-muted-foreground">
          or click to browse. Max {maxFiles} images (5MB per file).
        </p>
        {files.length > 0 && (
          <p className="mt-2 text-xs font-medium text-primary">
            {files.length} / {maxFiles} uploaded
          </p>
        )}
      </div>

      {/* File List / Sortable Preview */}
      {files.length > 0 && (
        <div className="border rounded-xl p-4 bg-muted/20">
          <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <span>Manage Photos (Drag to Reorder)</span>
          </h3>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={files.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3">
                {files.map((file) => (
                  <SortableItem
                    key={file.id}
                    file={file}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
