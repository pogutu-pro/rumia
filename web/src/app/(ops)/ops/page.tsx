import type { Metadata } from 'next';
import Link from 'next/link';
import { OpsNav } from '@/components/rumia/ops/ops-console';

export const metadata: Metadata = {
  title: 'Ops · Rumia',
  description: 'Queues, review, reports and market health for the Rumia team.',
  robots: { index: false, follow: false },
};

const SECTIONS: Array<[string, string, string]> = [
  ['/ops/queues', 'Queues', 'What needs a human, oldest first.'],
  ['/ops/review', 'Review', 'Approve, request changes, reject; record site visits.'],
  ['/ops/reports', 'Reports', 'Seeker reports, highest priority first.'],
  ['/ops/health', 'Market health', 'Fresh supply against searches, per area.'],
];

export default function OpsHome() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold text-rum-text sm:text-3xl">Ops</h1>
        <p className="text-rum-muted">Keep supply real and fresh.</p>
      </header>
      <OpsNav />
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map(([href, label, hint]) => (
          <Link key={href} href={href} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
            <p className="text-base font-medium text-rum-text">{label}</p>
            <p className="text-sm text-rum-muted">{hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
