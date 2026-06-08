'use client';

import * as React from 'react';
import {
  Facebook,
  Instagram,
  MessageCircle,
  Share2,
  Twitter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  text?: string;
  url: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
  align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}

function buildAbsoluteUrl(url: string) {
  if (typeof window === 'undefined') return url;

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ShareButton({
  title,
  text,
  url,
  label = 'Share',
  showLabel = true,
  className,
  align = 'end',
  variant = 'outline',
  size = 'sm',
}: ShareButtonProps) {
  const absoluteUrl = React.useMemo(() => buildAbsoluteUrl(url), [url]);
  const shortText = text || title;
  const shareMessage = [title, text, absoluteUrl].filter(Boolean).join('\n');

  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(shortText);
  const encodedMessage = encodeURIComponent(shareMessage);

  const openShareWindow = (href: string) => {
    const width = 680;
    const height = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      href,
      '_blank',
      `popup,width=${width},height=${height},left=${left},top=${top}`,
    );

    if (popup) {
      popup.opener = null;
      popup.focus();
      return;
    }

    window.open(href, '_self');
  };

  const handleInstagramShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shortText, url: absoluteUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    // Instagram has no public web URL share intent, so keep the share copy ready.
    try {
      await copyText(shareMessage);
      toast.success('Instagram caption copied', {
        description: 'Paste it into Instagram with the hostel link ready.',
      });
      openShareWindow('https://www.instagram.com/');
    } catch {
      toast.error('Could not copy the Instagram caption.');
    }
  };

  const platforms = [
    {
      name: 'WhatsApp',
      description: 'Send with the listing preview',
      icon: MessageCircle,
      iconClassName: 'bg-emerald-50 text-emerald-600',
      onSelect: () =>
        openShareWindow(`https://wa.me/?text=${encodedMessage}`),
    },
    {
      name: 'Instagram',
      description: 'Use device share or copied caption',
      icon: Instagram,
      iconClassName: 'bg-pink-50 text-pink-600',
      onSelect: handleInstagramShare,
    },
    {
      name: 'X',
      description: 'Post the hostel link',
      icon: Twitter,
      iconClassName: 'bg-slate-100 text-slate-950',
      onSelect: () =>
        openShareWindow(
          `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
        ),
    },
    {
      name: 'Facebook',
      description: 'Share to your feed',
      icon: Facebook,
      iconClassName: 'bg-blue-50 text-blue-600',
      onSelect: () =>
        openShareWindow(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        ),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn('gap-1.5', className)}
          aria-label={label}
        >
          <Share2 className="h-4 w-4" />
          {showLabel && <span>{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-72 rounded-xl border-slate-200 p-2 shadow-xl"
      >
        {platforms.map((platform) => {
          const Icon = platform.icon;

          return (
            <DropdownMenuItem
              key={platform.name}
              onClick={platform.onSelect}
              className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-slate-50"
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  platform.iconClassName,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  {platform.name}
                </span>
                <span className="block truncate text-xs font-medium text-slate-500">
                  {platform.description}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
