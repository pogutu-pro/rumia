import type { Metadata } from 'next';
import { HostDashboard } from '@/components/bnb/host-dashboard';

export const metadata: Metadata = { title: 'Host dashboard', robots: { index: false, follow: false } };

export default function HostPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <HostDashboard />
    </div>
  );
}
