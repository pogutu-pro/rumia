'use client';

import * as React from 'react';
import { icons, type LucideIcon, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type IconName = keyof typeof icons;

interface IconProps extends Omit<LucideProps, 'size' | 'strokeWidth'> {
  name: IconName;

  size?: number | string;

  strokeWidth?: number;
  className?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 24, strokeWidth = 2, className, ...props }, ref) => {
    const LucideIcon = icons[name as keyof typeof icons] as
      | LucideIcon
      | undefined;

    if (!LucideIcon) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Icon] Icon "${name}" not found in lucide-react`);
      }
      return (
        <div
          className={cn('shrink-0 rounded bg-muted/50', className)}
          style={{ width: size, height: size }}
        />
      );
    }

    return (
      <LucideIcon
        ref={ref}
        size={size}
        strokeWidth={strokeWidth}
        className={cn('shrink-0', className)}
        aria-hidden="true"
        focusable="false"
        {...props}
      />
    );
  },
);

Icon.displayName = 'Icon';
