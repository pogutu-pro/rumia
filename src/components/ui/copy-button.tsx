'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

interface CopyButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  textToCopy: string;
  label?: string;
  successMessage?: string;
}

export function CopyButton({
  textToCopy,
  label = 'Copy',
  successMessage = 'Copied to clipboard!',
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy', {
        description: 'Please check your browser permissions.',
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn('space-x-1.5 transition-colors duration-200', className)}
      aria-label={`Copy: ${textToCopy}`}
      {...props}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="text-xs font-medium">{copied ? 'Copied' : label}</span>
    </Button>
  );
}
