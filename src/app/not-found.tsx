'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Home, ArrowLeft, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const containerVariants: Variants = useMemo(() => {
    if (reducedMotion) return { initial: {}, animate: {} };
    return {
      initial: { opacity: 0, y: 20 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
      },
    };
  }, [reducedMotion]);

  const itemVariants: Variants = useMemo(() => {
    if (reducedMotion) return { initial: {}, animate: {} };
    return {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.32 } },
    };
  }, [reducedMotion]);

  return (
    <main
      role="main"
      aria-labelledby="not-found-heading"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-12"
    >
      <motion.div
        initial="initial"
        animate="animate"
        variants={containerVariants}
        className="w-full max-w-2xl"
      >
        <div className="overflow-hidden rounded-2xl card-base">
          <div className="p-8 sm:p-12">
            <motion.div
              variants={itemVariants}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-2xl" />
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-6">
                    <MapPin
                      className="h-16 w-16 text-primary"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <h1
                    ref={headingRef}
                    id="not-found-heading"
                    tabIndex={-1}
                    className="text-8xl font-bold tracking-tight text-foreground/10 focus:outline-none"
                  >
                    404
                  </h1>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              transition={{ delay: 0.08 }}
              className="mb-8 text-center"
            >
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Page not found
              </h2>
              <p className="text-base text-muted-foreground sm:text-lg">
                We could not find the page you are looking for. Try one of the
                options below.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              transition={{ delay: 0.16 }}
              className="flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <Button
                size="lg"
                className="w-full btn-primary sm:w-auto"
                onClick={() => router.push('/')}
              >
                <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                Go to homepage
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full btn-outline sm:w-auto"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Go back
              </Button>
            </motion.div>

            <motion.div
              variants={itemVariants}
              transition={{ delay: 0.24 }}
              className="mt-10 border-t border-border pt-8"
            >
              <h3 className="mb-4 text-center text-sm font-semibold text-foreground">
                Popular pages
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/hostels"
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <div className="rounded-md bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                    <Search
                      className="h-5 w-5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Find hostels</p>
                    <p className="text-xs text-muted-foreground">
                      Browse available accommodations
                    </p>
                  </div>
                </Link>


              </div>
            </motion.div>
          </div>

          <div className="border-t border-border bg-muted/30 px-8 py-4">
            <p className="text-center text-xs text-muted-foreground">
              Need help?{' '}
              <a
                href="mailto:support@rumi.app"
                className="font-medium text-primary hover:underline"
              >
                Contact our support team
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
