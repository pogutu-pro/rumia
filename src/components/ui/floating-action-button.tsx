'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  hideOnScroll?: boolean;
}

export function FloatingActionButton({
  onClick,
  icon = <Plus className="h-6 w-6" />,
  label,
  className,
  hideOnScroll = true,
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);

  React.useEffect(() => {
    if (!hideOnScroll) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        setIsVisible(false);
      } else {
        // Scrolling up
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, hideOnScroll]);

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed z-40 shadow-2xl transition-all duration-300 touch-manipulation",
        "bg-emerald-600 hover:bg-emerald-700 text-white",
        "active:scale-95",
        label ? "rounded-full px-6 h-14 gap-2" : "rounded-full h-14 w-14 p-0",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none",
        // Position: bottom-right, above bottom nav on mobile
        "bottom-20 right-4 md:bottom-6 md:right-6",
        className
      )}
      style={{
        bottom: label ? 'calc(4rem + env(safe-area-inset-bottom))' : 'calc(4rem + env(safe-area-inset-bottom))',
      }}
    >
      {icon}
      {label && <span className="font-semibold">{label}</span>}
    </Button>
  );
}
