'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { AlertTriangle, RefreshCcw, Home, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    headingRef.current?.focus();
    if (process.env.NODE_ENV === 'production') {
      console.error('RUMI Error Digest:', error.digest ?? 'N/A');
    } else {
      console.error('RUMI Dev Error:', {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      });
    }
  }, [error]);

  const containerVariants: Variants = useMemo(() => {
    if (reducedMotion) return { initial: {}, animate: {}, exit: {} };
    return {
      initial: { opacity: 0, y: 20 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
      },
      exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
    };
  }, [reducedMotion]);

  const iconVariants: Variants = useMemo(() => {
    if (reducedMotion) return { initial: {}, animate: {} };
    return {
      initial: { scale: 0.9, opacity: 0 },
      animate: {
        scale: 1,
        opacity: 1,
        transition: { duration: 0.3, delay: 0.08, ease: 'easeOut' },
      },
    };
  }, [reducedMotion]);

  const displayMessage =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Our team has been notified.'
      : error.message || 'Something went wrong';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-background px-4 py-12"
    >
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={containerVariants}
        className="w-full max-w-lg"
      >
        <div className="overflow-hidden rounded-2xl bg-card shadow-xl border border-border">
          <div className="p-8 sm:p-10">
            <motion.div
              variants={iconVariants}
              className="mb-6 flex justify-center"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute h-20 w-20 rounded-full bg-destructive/10 animate-pulse" />
                <div className="relative rounded-full bg-destructive/10 p-4">
                  <AlertTriangle
                    className="h-10 w-10 text-destructive"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </motion.div>

            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mb-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl focus:outline-none"
            >
              Oops! Something went wrong
            </h1>

            <p className="mb-6 text-center text-sm text-muted-foreground sm:text-base">
              {displayMessage}
            </p>

            {error.digest && (
              <div className="mb-6 rounded-lg bg-muted/50 p-3">
                <p className="text-center text-xs text-muted-foreground">
                  <span className="font-medium">Error ID:</span>{' '}
                  <code className="rounded bg-background/80 px-2 py-0.5 font-mono text-xs">
                    {error.digest}
                  </code>
                </p>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Share this ID with support if the issue persists
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                onClick={reset}
                className="w-full shadow-sm hover:shadow-md transition-shadow"
              >
                <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Try again
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                Return to homepage
              </Button>
            </div>

            <div className="mt-6 text-center">
              <a
                href="mailto:support@rumi.app"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Contact support
              </a>
            </div>
          </div>

          <div className="border-t border-border bg-muted/30 px-8 py-4">
            <p className="text-center text-xs text-muted-foreground">
              🔒 Your data is safe. We have logged this error and will
              investigate.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
