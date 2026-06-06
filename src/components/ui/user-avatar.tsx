import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';

interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-xl font-bold',
};

export function UserAvatar({
  name,
  imageUrl,
  size = 'md',
  className,
  ...props
}: UserAvatarProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(name);
  const sizeClass = sizeClasses[size];

  return (
    <Avatar className={cn(sizeClass, className)} {...props}>
      <AvatarImage src={imageUrl || undefined} alt={name} />
      <AvatarFallback
        className={cn(
          'bg-primary/10 text-primary font-medium',
          size === 'xl' && 'border-4 border-white',
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
