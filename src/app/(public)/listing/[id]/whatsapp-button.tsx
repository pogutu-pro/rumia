'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';

interface WhatsappButtonProps {
  listingId: string | number;
  agentId: string | number;
  agentPhone: string;
}

export function WhatsappButton({
  listingId,
  agentId,
  agentPhone,
}: WhatsappButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Fire POST request to track lead
      const response = await fetch('/api/track-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: listingId,
          agent_id: agentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record lead');
      }

      const data = await response.json();
      
      // Open WhatsApp URL in a new tab
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      } else {
        const cleanPhone = agentPhone.replace(/[^\d+]/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
      }
      
      toast.success('Connecting to agent via WhatsApp...');
    } catch (error) {
      console.error('Lead attribution error:', error);
      // Fallback redirect directly to WhatsApp
      const cleanPhone = agentPhone.replace(/[^\d+]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
      toast.error('Lead tracking failed, connecting directly to agent...');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] text-white font-bold rounded-xl transition-all duration-300 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 border-0"
    >
      <MessageCircle className="h-5 w-5 fill-current" />
      {isLoading ? 'Connecting...' : 'Check Availability on WhatsApp'}
    </Button>
  );
}
