import Link from 'next/link';

export default function BnbNotFound() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="font-bnb-display text-4xl font-bold tracking-tight text-bnb-ink">This page does not exist</h1>
      <p className="mt-3 max-w-md text-bnb-stone">The link may be old, or the stay is no longer listed.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-bnb-forest px-5 font-semibold text-bnb-mist hover:bg-bnb-pine"
      >
        See all stays
      </Link>
    </section>
  );
}
