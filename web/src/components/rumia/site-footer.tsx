import Link from 'next/link';

/** Footer from ux/04 §1.1.8: Help & safety · List your property · About · Terms · Privacy. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-rum-line bg-rum-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p className="text-sm text-rum-muted">
          © {year} Rumia · Real places to rent, confirmed by owners
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-rum-text">
          <Link href="/help" className="underline-offset-2 hover:underline">Help &amp; safety</Link>
          <Link href="/workspace" className="underline-offset-2 hover:underline">List your property</Link>
          <Link href="/about" className="underline-offset-2 hover:underline">About</Link>
          <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
          <Link href="/policy" className="underline-offset-2 hover:underline">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}