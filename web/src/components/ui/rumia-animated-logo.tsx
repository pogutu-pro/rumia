'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Animated "Rumia" Logo with Jumping Letters
 * 
 * Features:
 * - R and 'a' stay static
 * - u, m, i jump with staggered animation
 * - Each letter has unique Nano Banana color
 * - Smooth, playful animation
 * 
 * Nano Banana Color Palette:
 * - Vibrant Yellow: #FFD93D
 * - Bright Orange: #FF6B35
 * - Hot Pink: #FF006E
 * - Electric Purple: #8338EC
 * - Cyan Blue: #3A86FF
 */

interface RumiaAnimatedLogoProps {
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function RumiaAnimatedLogo({ 
  className, 
  size = 'md' 
}: RumiaAnimatedLogoProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const sizeClasses = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-6xl',
  };

  // Nano Banana colors for each letter
  const letterColors = {
    R: '#FF6B35',      // Bright Orange
    u: '#FFD93D',      // Vibrant Yellow
    m: '#FF006E',      // Hot Pink
    i: '#8338EC',      // Electric Purple
    a: '#3A86FF',      // Cyan Blue
  };

  // Animation delays for jumping letters (u, m, i)
  const jumpingLetters = [
    { letter: 'u', delay: '0s' },
    { letter: 'm', delay: '0.15s' },
    { letter: 'i', delay: '0.3s' },
  ];

  if (!mounted) {
    return (
      <div className={cn('inline-flex items-baseline font-black tracking-tight', sizeClasses[size], className)}>
        <span style={{ color: letterColors.R }}>R</span>
        <span style={{ color: letterColors.u }}>u</span>
        <span style={{ color: letterColors.m }}>m</span>
        <span style={{ color: letterColors.i }}>i</span>
        <span style={{ color: letterColors.a }}>a</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'inline-flex items-baseline font-black tracking-tight',
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label="Rumia"
    >
      {/* R - Static */}
      <span 
        className="inline-block"
        style={{ 
          color: letterColors.R,
          textShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
        }}
      >
        R
      </span>

      {/* u - Jumping */}
      <span 
        className="inline-block animate-jump"
        style={{ 
          color: letterColors.u,
          animationDelay: '0s',
          animationDuration: '1.5s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
          textShadow: '0 2px 8px rgba(255, 217, 61, 0.3)'
        }}
      >
        u
      </span>

      {/* m - Jumping */}
      <span 
        className="inline-block animate-jump"
        style={{ 
          color: letterColors.m,
          animationDelay: '0.15s',
          animationDuration: '1.5s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
          textShadow: '0 2px 8px rgba(255, 0, 110, 0.3)'
        }}
      >
        m
      </span>

      {/* i - Jumping */}
      <span 
        className="inline-block animate-jump"
        style={{ 
          color: letterColors.i,
          animationDelay: '0.3s',
          animationDuration: '1.5s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
          textShadow: '0 2px 8px rgba(131, 56, 236, 0.3)'
        }}
      >
        i
      </span>

      {/* a - Static */}
      <span 
        className="inline-block"
        style={{ 
          color: letterColors.a,
          textShadow: '0 2px 8px rgba(58, 134, 255, 0.3)'
        }}
      >
        a
      </span>

      <style>{`
        @keyframes jump {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .animate-jump {
          animation-name: jump;
        }
      `}</style>
    </div>
  );
}

// Compact version for header use
export function RumiaLogoCompact({ className }: { className?: string }) {
  return <RumiaAnimatedLogo size="sm" className={className} />;
}
