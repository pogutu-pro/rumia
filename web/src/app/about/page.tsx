import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description: 'Rumia helps people find somewhere to live or stay in a Kenyan town — starting with Nyeri.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-rum-surface">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 lg:px-8">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">About Rumia</h1>
        <div className="space-y-4 text-base leading-relaxed text-rum-text">
          <p>
            Rumia is the trusted way to find somewhere to live or stay in a Kenyan town — starting with
            Nyeri. Every place is real and current, and what we claim about it is written as a dated
            fact: when the owner last confirmed it is available, what it really costs to move in, and
            who to message on WhatsApp.
          </p>
          <p>
            No sign-in is needed to browse, save or contact. If you own or manage rooms, apartments or
            hostels, you can <Link href="/workspace" className="font-medium underline underline-offset-2">list your property</Link>{' '}
            and keep it current in minutes.
          </p>
          <p>
            For keeping yourself safe when renting, read our{' '}
            <Link href="/help" className="font-medium underline underline-offset-2">Help &amp; safety</Link>{' '}
            page. Our <Link href="/policy" className="font-medium underline underline-offset-2">privacy policy</Link>{' '}
            and <Link href="/terms" className="font-medium underline underline-offset-2">terms</Link> explain how the site works.
          </p>
        </div>
      </div>
    </div>
  );
}