import type { Metadata } from 'next';
import { VideoPanel } from '@/components/videos/video-panel';

export const metadata: Metadata = {
  title: 'Property Videos · Rumia',
  description:
    'Discover student hostels, apartments, and short-stay properties through short video tours. Watch, save, and contact agents directly.',
};

export default function VideosPage() {
  return (
    <>
      {/* Preconnect to YouTube for faster poster and player loads */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://img.youtube.com" />
      <div id="main-content" className="mx-auto h-[calc(100dvh-var(--shell-header-h)-var(--bottom-nav-h))] max-w-md border-x border-line">
        <h1 className="sr-only">Property video tours</h1>
        <VideoPanel variant="page" />
      </div>
    </>
  );
}
