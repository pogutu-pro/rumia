'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, UserRound } from 'lucide-react';
import { myRequests, type SavedRequest } from '@/lib/site/my-requests';

/** The round menu at the right of the header: your requests, hosting, and Rumia. */
export function HostMenu() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'block px-4 py-3 text-sm text-bnb-ink hover:bg-bnb-mist';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setRequests(myRequests());
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label="Menu"
        className="flex items-center gap-2 rounded-full border border-bnb-line bg-white py-1.5 pl-3 pr-1.5 shadow-sm transition-shadow hover:shadow-md"
      >
        <Menu className="h-4 w-4 text-bnb-ink" aria-hidden />
        <span className="grid h-8 w-8 place-items-center rounded-full bg-bnb-stone text-white">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-bnb-line bg-white py-2 shadow-[0_12px_40px_rgba(16,24,40,0.16)]">
          {requests.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-xs font-semibold text-bnb-stone">Your requests</p>
              {requests.slice(0, 3).map((r) => (
                <Link key={r.token} href={`/r/${encodeURIComponent(r.token)}`} className={item} onClick={() => setOpen(false)}>
                  <span className="block font-semibold">{r.title}</span>
                  <span className="text-bnb-stone">
                    {r.checkIn} to {r.checkOut}
                  </span>
                </Link>
              ))}
              <hr className="my-2 border-bnb-line" />
            </>
          )}
          <Link href="/stays" className={`${item} font-semibold`} onClick={() => setOpen(false)}>
            Find a stay
          </Link>
          <Link href="/hosts" className={item} onClick={() => setOpen(false)}>
            List your place
          </Link>
          <Link href="/host" className={item} onClick={() => setOpen(false)}>
            Host sign-in
          </Link>
          <hr className="my-2 border-bnb-line" />
          <a href={(process.env.NEXT_PUBLIC_SITE_URL || 'https://rumia.co.ke').replace(/\/+$/, '')} className={item}>
            Hostels and monthly rentals on Rumia
          </a>
        </div>
      )}
    </div>
  );
}
