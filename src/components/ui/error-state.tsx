import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = 'Error',
  message = 'Something went wrong. Please try again.',
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
       <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn("flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded-md", className)}
       >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium flex-1">{message}</p>
        {onRetry && (
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/20" onClick={onRetry}>
                <RefreshCw className="h-3 w-3" />
                <span className="sr-only">Retry</span>
            </Button>
        )}
       </motion.div>
    )
  }

  return (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
            'flex flex-col items-center justify-center text-center p-6 rounded-lg bg-muted/30 border-2 border-dashed border-muted-foreground/20',
            className
      )}
    >
      <div className="bg-destructive/10 p-3 rounded-full mb-3">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </motion.div>
  );
}
