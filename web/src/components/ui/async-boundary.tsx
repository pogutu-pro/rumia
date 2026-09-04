import React from 'react';
import { BrandedLoader } from '@/components/ui/branded-loader';
import { ErrorState } from '@/components/ui/error-state';
import { motion, AnimatePresence } from 'framer-motion';

interface AsyncBoundaryProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  compact?: boolean; // For inline errors/loading
  mode?: 'default' | 'skeleton' | 'page'; // default = spinner
}

export function AsyncBoundary({
  isLoading = false,
  isError = false,
  error,
  onRetry,
  children,
  loadingFallback,
  errorFallback,
  compact = false,
  mode = 'default',
}: AsyncBoundaryProps) {
  
  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    
    if (mode === 'page') {
        return (
            <div className="flex items-center justify-center min-h-[50vh] w-full">
                <BrandedLoader />
            </div>
        )
    }

    if (mode === 'skeleton') {
        // Consumer should provide a skeleton via loadingFallback for best results,
        // but this is a generic fallback if they forget.
        return (
             <div className="w-full space-y-4 p-4 animate-in fade-in">
                 <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                 <div className="space-y-2">
                     <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                     <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                 </div>
             </div>
        )
    }

    return (
        <div className="flex items-center justify-center p-8 w-full min-h-[100px]">
            <BrandedLoader size={compact ? 40 : 80} text={compact ? '' : undefined} className={compact ? 'p-0' : ''} />
        </div>
    );
  }

  if (isError) {
    if (errorFallback) return <>{errorFallback}</>;

    return (
      <ErrorState 
        message={error?.message}
        onRetry={onRetry}
        compact={compact}
        className={compact ? "" : "w-full my-4"}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
        <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    </AnimatePresence>
  );
}
