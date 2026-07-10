'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareAgentProfileProps {
  name: string;
  url: string;
}

export function ShareAgentProfile({ name, url }: ShareAgentProfileProps) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    const absoluteUrl = typeof window !== 'undefined'
      ? new URL(url, window.location.origin).toString()
      : url;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} — Agent on Rumia`,
          text: `Find student hostels near DeKUT with ${name} on Rumia`,
          url: absoluteUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    setLoading(true);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success('Profile link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleShare}
      variant="outline"
      size="lg"
      className="h-14 w-full rounded-2xl border-2 border-slate-200 font-bold text-base gap-2"
      aria-label="Share agent profile"
    >
      {loading ? (
        <Check className="h-5 w-5 text-emerald-600" />
      ) : (
        <Share2 className="h-5 w-5" />
      )}
      Share Profile
    </Button>
  );
}
