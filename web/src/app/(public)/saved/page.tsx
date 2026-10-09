import type { Metadata } from 'next';
import { SavedPlaces } from './saved-places';

export const metadata: Metadata = {
  title: 'Saved places | Rumia',
  robots: { index: false },
};

export default function SavedPage() {
  return <SavedPlaces />;
}
