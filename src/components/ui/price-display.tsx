import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface PriceDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | string;
  currency?: string;
  locale?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isPromotional?: boolean;
  showDecimals?: boolean;
  promotionalClassName?: string;
}

export function PriceDisplay({
  amount,
  currency = 'KES',
  locale = 'en-KE',
  size = 'md',
  isPromotional = false,
  showDecimals = true,
  promotionalClassName,
  className,
  ...props
}: PriceDisplayProps) {
  const numericAmount =
    typeof amount === 'string' ? parseFloat(amount) : amount;

  const formatter = React.useMemo(() => {
    if (numericAmount == null || isNaN(numericAmount)) return null;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    });
  }, [locale, currency, showDecimals, numericAmount]);

  if (!formatter) {
    return (
      <span className={cn('text-muted-foreground', className)} {...props}>
        N/A
      </span>
    );
  }

  const formattedPrice = formatter.format(numericAmount);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
    xl: 'text-2xl font-bold',
  };

  return (
    <span
      className={cn(
        sizeClasses[size],
        isPromotional
          ? (promotionalClassName ??
              'text-primary line-through decoration-destructive')
          : undefined,
        className,
      )}
      aria-label={`Price: ${formattedPrice}`}
      {...props}
    >
      {formattedPrice}
    </span>
  );
}
