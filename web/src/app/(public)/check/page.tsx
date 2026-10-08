import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckLookup } from '@/components/rumia/check/check-lookup';

export const metadata: Metadata = {
  title: 'Check before you pay',
  description: 'Check whether a phone number, M-Pesa detail or place is verified by Rumia before you send money.',
};

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">Check before you pay</h1>
        <p className="text-base text-rum-muted">
          About to send money for a room, deposit or &ldquo;booking fee&rdquo;? Check it here first — it is free and takes seconds.
        </p>
      </header>

      <div className="mt-6">
        <CheckLookup />
      </div>

      <section aria-labelledby="if-unsure" className="mt-10 rounded-rum-media border border-rum-line bg-rum-raised p-4 text-sm text-rum-text">
        <h2 id="if-unsure" className="text-base font-semibold">Still unsure?</h2>
        <p className="mt-1">
          Never pay a deposit before you&apos;ve seen the room. Read{' '}
          <Link href="/help" className="font-semibold text-rum-accent underline underline-offset-2">
            Help &amp; safety
          </Link>{' '}
          for what to look for on a viewing, or{' '}
          <Link href="/verify/report" className="font-semibold text-rum-accent underline underline-offset-2">
            report
          </Link>{' '}
          anything that looks wrong.
        </p>
      </section>
    </div>
  );
}