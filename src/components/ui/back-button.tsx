'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface BackButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  fallbackPath?: string;
}

export function BackButton({
  children,
  fallbackPath,
  className,
  ...props
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (fallbackPath) {
      router.push(fallbackPath);
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleBack}
      className={cn('text-sm font-medium hover:bg-muted p-2 h-auto', className)}
      aria-label="Go back to the previous page"
      {...props}
    >
      <ChevronLeft className="h-4 w-4 mr-1" />
      {children || 'Back'}
    </Button>
  );
}
