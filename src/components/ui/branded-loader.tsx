import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface BrandedLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  text?: string;
}

export function BrandedLoader({
  className,
  size = 120,
  text = 'Preparing your Rumia experience',
  ...props
}: BrandedLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8',
        className
      )}
      {...props}
    >
      <div 
        className="relative flex items-center justify-center mb-8"
        style={{ width: size, height: size }}
      >
        <Image
          src="/images/logo/logo.svg"
          alt="Rumia Logo"
          fill
          priority
          className="object-contain"
        />
      </div>
      {text && (
        <p className="text-center text-sm font-medium text-muted-foreground tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
}
