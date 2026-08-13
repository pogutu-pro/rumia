'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { FaInstagram, FaTiktok, FaWhatsapp, FaLinkedinIn } from 'react-icons/fa6';
import { useGatedWhatsApp } from '@/hooks/use-gated-whatsapp';

interface FooterProps {
  whatsappNumber?: string;
}

export const Footer = React.memo(function Footer({ whatsappNumber }: FooterProps) {
  const currentYear = new Date().getFullYear();

  // Keep the original wa.me/254… (no leading +) format for byte-identical output.
  const waDigits = (whatsappNumber ?? '+254114845619').replace(/\D/g, '');
  const waMessage =
    'Hi Rumia, I found you on your website. I\u0027m looking for a hostel near DeKUT.';
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`;

  // Contacting Rumia via the footer requires a signed-in visitor (transferred
  // from the agent-card gating) so sign-in cannot be bypassed.
  const { isGating, handleClick } = useGatedWhatsApp({
    storageKey: 'rumia_pending_footer_whatsapp',
    contactId: 'footer',
    whatsappUrl: waHref,
  });

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-between pb-8 border-b border-slate-800">
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
              <span className="font-black text-2xl text-white tracking-tight">RUMIA</span>
            </Link>
            <p className="text-sm text-slate-500 font-medium text-center md:text-left">
              Verified campus accommodations and simplified lead generation.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex justify-center gap-8 text-sm font-bold">
            <Link href="/hostels" className="hover:text-white transition-colors">
              Browse Hostels
            </Link>
            <Link href="/auth/login" className="hover:text-white transition-colors">
              Login
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex justify-center md:justify-end gap-4">
            {[
              { href: 'https://www.instagram.com/rumia_kenya', icon: <FaInstagram className="h-5 w-5" />, label: 'Instagram' },
              { href: 'https://www.tiktok.com/@rumia_kenya', icon: <FaTiktok className="h-5 w-5" />, label: 'TikTok' },
              { href: 'https://www.linkedin.com/company/127854119', icon: <FaLinkedinIn className="h-5 w-5" />, label: 'LinkedIn' },
            ].map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 hover:text-emerald-400 transition-all duration-300"
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
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 hover:text-emerald-400 transition-all duration-300"
            >
              {isGating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FaWhatsapp className="h-5 w-5" />}
            </a>
          </div>
        </div>

        {/* Copyright & Legal Links */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <p>&copy; {currentYear} RUMIA. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
          <p>Built with ❤️ for university students in Kenya.</p>
        </div>
      </div>
    </footer>
  );
});

