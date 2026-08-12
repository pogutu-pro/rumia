'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

type LoadingSkeletonType =
  | 'card'
  | 'form'
  | 'list-item'
  | 'table-row'
  | 'avatar-list'
  | 'page-header'
  | 'profile';

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  type: LoadingSkeletonType;
  count?: number;
}

const presets = {
  card: (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  ),

  form: (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  ),

  'list-item': (
    <div className="flex items-center gap-4 py-4 border-b">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  ),

  'table-row': (
    <div className="grid grid-cols-12 gap-4 py-5 px-6 border-b">
      <Skeleton className="col-span-3 h-4" />
      <Skeleton className="col-span-2 h-4" />
      <Skeleton className="col-span-3 h-4" />
      <Skeleton className="col-span-2 h-4" />
      <Skeleton className="col-span-2 h-8 justify-self-end" />
    </div>
  ),

  'avatar-list': (count: number = 5) => (
    <div className="flex -space-x-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-10 w-10 rounded-full border-2 border-background"
        />
      ))}
    </div>
  ),

  'page-header': (
    <div className="space-y-4">
      <Skeleton className="h-9 w-96" />
      <Skeleton className="h-5 w-64" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  ),

  profile: (
    <div className="space-y-8">
      <div className="flex items-center gap-6">
        <Skeleton className="h-32 w-32 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  ),
} as const;

/**
 * Ultimate reusable skeleton loader – used across the entire RUMI app.
 * Beautiful, realistic, matches exact UI density, zero jank.
 */
export function LoadingSkeleton({
  type,
  count = 1,
  className,
  ...props
}: LoadingSkeletonProps) {
  const base =
    typeof presets[type] === 'function' ? presets[type](count) : presets[type];

  if (count <= 1 || typeof presets[type] === 'function') {
    return (
      <div className={className} {...props}>
        {base}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>{base}</React.Fragment>
      ))}
    </div>
  );
}
