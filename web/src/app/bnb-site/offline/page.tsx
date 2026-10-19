import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Served by the service worker (/offline on this host) when there is no connection. */
export default function BnbOffline() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="font-bnb-display text-4xl font-bold tracking-tight text-bnb-ink">You are offline</h1>
      <p className="mt-3 max-w-md text-bnb-stone">Reconnect to see stays. Pages you opened before may still load.</p>
    </section>
  );
}
