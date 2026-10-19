'use client';

import { KIND_PAGES } from '@/lib/seo/kinds';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
  FaLinkedinIn,
} from 'react-icons/fa6';
import { useGatedWhatsApp } from '@/hooks/use-gated-whatsapp';
import { BNB_SEPARATE } from '@/lib/site/separation';
import { BNB_ORIGIN } from '@/lib/site/hosts';

interface FooterProps {
  whatsappNumber?: string;
  /** Live markets, for the crawlable links below. Optional: pages without them simply show no market links. */
  markets?: Array<{ slug: string; name: string }>;
}

export const Footer = React.memo(function Footer({
  whatsappNumber,
  markets = [],
}: FooterProps) {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const isBnbPage = pathname === '/bnb' || pathname.startsWith('/bnb/');

  // Keep the original wa.me/254… (no leading +) format for byte-identical output.
  const waDigits = (whatsappNumber ?? '+254114845619').replace(/\D/g, '');
  const waMessage = isBnbPage
    ? 'Hi Rumia, I found you on your website. I\u0027m looking for a short-stay property.'
    : 'Hi Rumia, I found you on your website. I\u0027m looking for a hostel near DeKUT.';
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`;

  // Contacting Rumia via the footer requires a signed-in visitor (transferred
  // from the agent-card gating) so sign-in cannot be bypassed.
  const { isGating, handleClick } = useGatedWhatsApp({
    storageKey: 'rumia_pending_footer_whatsapp',
    contactId: 'footer',
    whatsappUrl: waHref,
  });

  return (
    <footer className="w-full border-t border-line bg-subtle text-ink-muted">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-between pb-6 border-b border-line">
          {/* Logo & Slogan */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                <Image
                  src="/images/logo/logo.svg"
                  alt="Rumia Logo"
                  width={40}
                  height={40}
                  sizes="40px"
                />
              </div>
              <span className="font-heading font-extrabold text-xl text-ink tracking-tight">
                RUMIA
              </span>
            </Link>
            <p className="text-sm text-ink-muted font-medium text-center md:text-left">
              {isBnbPage
                ? 'Comfortable short stays and direct host connections.'
                : 'Real places to rent, confirmed by owners.'}
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex justify-center gap-8 text-sm font-bold">
            <Link
              href={isBnbPage ? '/bnb' : '/hostels'}
              className="hover:text-ink transition-colors"
            >
              {isBnbPage ? 'Browse RumiaBnB' : 'Browse Hostels'}
            </Link>
            <Link
              href="/auth/login"
              className="hover:text-ink transition-colors"
            >
              Login
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex justify-center md:justify-end gap-4">
            {[
              {
                href: 'https://www.instagram.com/rumia_kenya',
                icon: <FaInstagram className="h-5 w-5" />,
                label: 'Instagram',
              },
              {
                href: 'https://www.tiktok.com/@rumia_kenya',
                icon: <FaTiktok className="h-5 w-5" />,
                label: 'TikTok',
              },
              {
                href: 'https://www.linkedin.com/company/127854119',
                icon: <FaLinkedinIn className="h-5 w-5" />,
                label: 'LinkedIn',
              },
            ].map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="p-2.5 rounded-xl bg-raised border border-line hover:border-primary/40 hover:text-primary transition-colors"
              >
                {social.icon}
              </a>
            ))}

            {/* WhatsApp — gated behind sign-in */}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              onClick={handleClick}
              className="p-2.5 rounded-xl bg-raised border border-line hover:border-primary/40 hover:text-primary transition-colors"
            >
              {isGating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FaWhatsapp className="h-5 w-5" />
              )}
            </a>
          </div>
        </div>

        {/* Browse by market and type: gives every page a crawlable path into the market pages */}
        {markets.length > 0 && (
          <nav aria-label="Browse places to rent" className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-ink-muted">
            {markets.slice(0, 8).map((m) => (
              <Link key={m.slug} href={`/${m.slug}`} className="hover:text-ink transition-colors">Rentals in {m.name}</Link>
            ))}
            {KIND_PAGES.map((k) => (
              <Link key={k.slug} href={`/${markets[0].slug}/${k.slug}`} className="hover:text-ink transition-colors">
                {k.label} in {markets[0].name}
              </Link>
            ))}
            {BNB_SEPARATE && (
              <a href={`${BNB_ORIGIN}/`} className="hover:text-ink transition-colors">
                Short stays on RumiaBnB
              </a>
            )}
          </nav>
        )}

        {/* Copyright & Legal Links */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted font-medium">
          <p>&copy; {currentYear} RUMIA. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/policy" className="hover:text-ink transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink transition-colors">
              Terms of Service
            </Link>
          </div>
          <p>Built in Kenya, for people looking for a place to stay.</p>
        </div>
      </div>
    </footer>
  );
});
