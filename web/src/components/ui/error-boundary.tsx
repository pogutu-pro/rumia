'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertOctagon, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error in ErrorBoundary:', { error, errorInfo });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <Card className="border-slate-200 shadow-2xl bg-white">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-destructive/10 p-4 rounded-full mb-4 w-fit">
                  <AlertOctagon className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Something went wrong
                </h1>
                <p className="text-slate-500 mt-2 text-sm">
                  We encountered an unexpected error. Please reload or go back.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="rounded-md bg-slate-50 p-4 text-xs font-mono text-left overflow-auto max-h-[200px] border border-slate-200">
                    <p className="font-semibold text-destructive mb-1">Debug Error:</p>
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <pre className="mt-2 opacity-70 whitespace-pre-wrap">{this.state.error.stack}</pre>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={this.reset}
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  size="lg"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto min-w-[140px]"
                  variant="secondary"
                >
                  Reload Page
                </Button>
                <Button variant="default" size="lg" asChild className="w-full sm:w-auto min-w-[140px]">
                  <Link href="/dashboard">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
