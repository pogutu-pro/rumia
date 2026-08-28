import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface BrandedLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  text?: string;
  showProgress?: boolean;
}

export function BrandedLoader({
  className,
  size = 120,
  text = 'Preparing your Rumia experience',
  showProgress = true,
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
        className={cn(
          'relative flex items-center justify-center',
          text ? 'mb-5' : ''
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src="/images/logo/logo.svg"
          alt="Rumia Logo"
          fill
          priority
          sizes={`${size}px`}
          className="object-contain"
        />
      </div>
      {text && (
        <>
          <p className="text-center text-sm font-semibold text-foreground/80 tracking-wide">
            {text}
          </p>
          {showProgress && (
            <div className="progress-bar mt-4" role="presentation" aria-hidden="true" />
          )}
        </>
      )}
    </div>
  );
}
