'use client';

import * as React from 'react';
import { AlertCircle, PlusCircle, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils/cn';

type EmptyStateVariant = 'default' | 'search' | 'add' | 'alert';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmptyStateVariant;
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
}

const variantConfig = {
  default: { icon: 'Frown' as IconName },
  search: { icon: 'Search' as IconName },
  add: { icon: 'CirclePlus' as IconName },
  alert: { icon: 'CircleAlert' as IconName },
} satisfies Record<EmptyStateVariant, { icon: IconName }>;

export function EmptyState({
  variant = 'default',
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const { icon } = variantConfig[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/50 py-16 px-6 text-center',
        className,
      )}
      {...props}
    >
      <div className="mb-6 rounded-full bg-muted p-5">
        <Icon
          name={icon}
          size={40}
          className="text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
        {title}
      </h2>

      {description && (
        <p className="max-w-sm text-muted-foreground text-balance">
          {description}
        </p>
      )}

      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export default EmptyState;
