import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Check, MapPin } from 'lucide-react';

const POINTS = [
  'Verified hostels near your campus, with real photos.',
  'Save places and book a viewing in a tap.',
  'Free for students. No password to remember.',
];

/**
 * The frame for sign-in and first-time setup: a narrow form column and, from laptop width up, a Rumia panel on the
 * right. Phones get only the form, so nothing pushes it below the fold or covers it (no bottom nav, no banners).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <div className="flex min-h-dvh flex-1 flex-col px-4 sm:px-10">
        <header className="flex h-16 shrink-0 items-center">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Rumia home">
            <Image src="/images/logo/logo-icon.svg" alt="" width={28} height={28} priority unoptimized className="h-7 w-7" />
            <span className="font-heading text-xl font-extrabold tracking-tight text-ink">Rumia</span>
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center pb-8 pt-4 sm:items-center sm:py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="shrink-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-ink-muted">
          By continuing you agree to the{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link> and{' '}
          <Link href="/policy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</Link>.
        </footer>
      </div>

      <aside className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-[46%] xl:w-1/2" aria-hidden="true">
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-[#04432c] px-12 pt-14 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'linear-gradient(to bottom, black, transparent 75%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 75%)',
            }}
          />
          <div className="relative max-w-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Find your next hostel before you even visit campus.
            </p>
            <ul className="mt-8 space-y-3">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[15px] text-emerald-50/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Check className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* A listing card as it appears on Rumia, so the panel shows the product rather than describing it. */}
          <div className="relative mt-auto flex flex-col items-center gap-4 pb-12 pt-12">
            <div className="w-[300px] -rotate-1 self-center rounded-xl bg-white p-3 text-ink shadow-xl">
              <p className="text-xs font-medium text-ink-muted">Viewing · Saturday 10:00</p>
              <p className="mt-1 text-sm font-semibold">Booked. The caretaker will meet you.</p>
            </div>
            <div className="w-[300px] rounded-2xl bg-white p-4 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
              <div className="h-36 rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-slate-100" />
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Sunrise Hostel</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <MapPin className="h-3 w-3" /> 6 min walk to campus
              </p>
              <p className="mt-2 text-sm font-semibold">
                KES 6,500 <span className="font-normal text-ink-muted">/ month</span>
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
