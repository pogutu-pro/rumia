'use client';

import * as React from 'react';
import { Share2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  text?: string;
  url: string;
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const isWebShareSupported =
    typeof navigator !== 'undefined' && 'share' in navigator;

  const handleWebShare = async () => {
    if (isWebShareSupported) {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        console.error('Sharing failed:', error);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!', {
        description: 'The listing URL is in your clipboard.',
      });
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  if (isWebShareSupported) {
    return (
      <Button variant="outline" onClick={handleWebShare} className="space-x-2">
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="space-x-2">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy Link</span>
        </DropdownMenuItem>
        {/* Additional share options (e.g. Email) can be added here */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
