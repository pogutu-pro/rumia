'use client';

import * as React from 'react';
import { SideNav } from './side-nav';
import { ShellProvider } from './shell-provider';
import { TopBar } from './top-bar';
import { NavHistoryTracker } from './nav-history';
import { VideoProvider } from '@/components/videos/video-provider';

interface AppShellProps {
  children: React.ReactNode;
  /** Optional right-hand panel (e.g. the Rumia Videos drawer); sits below the header. */
  rightPanel?: React.ReactNode;
}

/**
 * Sidebar + header + content (+ optional right panel). The page scrolls normally (window scroll is kept for
 * scroll restoration); the sidebar and header are sticky so navigation stays put.
 */
export function AppShell({ children, rightPanel }: AppShellProps) {
  return (
    <ShellProvider>
      <VideoProvider>
      <a
        href="#shell-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-page text-ink">
        <NavHistoryTracker />
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex min-w-0 flex-1">
            <main id="shell-content" className="min-w-0 flex-1">
              {children}
            </main>
            {rightPanel}
          </div>
        </div>
      </div>
      </VideoProvider>
    </ShellProvider>
  );
}
