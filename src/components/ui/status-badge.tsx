import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';

export type StatusVariant =
  | 'active'
  | 'pending'
  | 'rejected'
  | 'success'
  | 'draft'
  | 'info';

interface StatusBadgeProps
  extends React.ComponentPropsWithoutRef<typeof Badge> {
  status: string;
  variantMap?: Record<string, StatusVariant>;
}

const defaultVariantMap: Record<string, StatusVariant> = {
  active: 'success',
  confirmed: 'success',
  available: 'success',
  paid: 'success',
  pending: 'pending',
  processing: 'pending',
  awaiting: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected',
  failed: 'rejected',
  draft: 'info',
  archived: 'info',
};

const variantClasses: Record<StatusVariant, string> = {
  active: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
  pending:
    'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200',
  rejected: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
  success: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
  info: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
};

export function StatusBadge({
  status,
  variantMap = defaultVariantMap,
  className,
  ...props
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const variantKey =
    variantMap[normalizedStatus] ||
    defaultVariantMap[normalizedStatus] ||
    'draft';

  const classNames = cn(
    'text-xs font-semibold py-1 px-2.5 rounded-full border',
    variantClasses[variantKey],
    className,
  );

  return (
    <span className={classNames} {...props}>
      {status}
    </span>
  );
}
