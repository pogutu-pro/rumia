import type { Metadata } from 'next';
import { listingsApi } from '@/lib/api/listings';
import { VideosFeed } from '@/components/videos/videos-feed';
import type { Listing } from '@/types';

export const metadata: Metadata = {
  title: 'Property Videos · Rumia',
  description:
    'Discover student hostels, apartments, and short-stay properties through short video tours. Watch, save, and contact agents directly.',
};

// Revalidate every 10 minutes so new video listings surface quickly
export const revalidate = 600;

export default async function VideosPage() {
  let initialListings: Listing[] = [];
  let initialPage = 1;
  let initialPages = 1;
  let initialError = false;

  try {
    const res = await listingsApi.getFeedServer({
      has_video: true,
      limit: 20,
    });
    initialListings = res.items;
    initialPage = res.page;
    initialPages = Math.ceil(res.total / res.limit);
  } catch {
    initialError = true;
  }

  return (
    <VideosFeed
      initialListings={initialListings}
      initialPage={initialPage}
      initialPages={initialPages}
      initialError={initialError}
    />
  );
}
