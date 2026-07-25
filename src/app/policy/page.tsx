import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/layouts/public-footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Rumia privacy policy — how we collect, use, and protect your personal data as a student using our hostel discovery platform near DeKUT, Nyeri.',
};

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content:
      'Rumia is a hostel discovery platform operated by Stratnovo, a technology company registered in Kenya. This Privacy Policy explains how we collect, use, and protect information when you use Rumia to find student accommodation near Dedan Kimathi University of Technology (DeKUT) in Nyeri, Kenya. By using Rumia, you agree to the practices described in this policy.',
  },
  {
    id: 'information-we-collect',
    title: '2. Information We Collect',
    content: null,
    subsections: [
      {
        subtitle: 'Information you provide:',
        items: [
          'Full name (from Google OAuth or manual input)',
          'Email address',
          'Phone number (required to contact agents or landlords via WhatsApp)',
          'University and year of study',
          'Tour booking preferences (hostel selection, preferred date and time)',
        ],
      },
      {
        subtitle: 'Information collected automatically:',
        items: [
          'Pages and listings you view',
          'Search terms and filters used',
          'Device type, browser, and approximate location',
          'Time and frequency of visits',
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Your Information',
    content: null,
    items: [
      'Display relevant hostel listings based on your search and location preferences',
      'Connect you with student agents or landlords when you initiate contact through WhatsApp',
      'Track contact leads for commission attribution and platform operations',
      'Process and manage tour bookings',
      'Send platform notifications and updates (WhatsApp or email)',
      'Improve search results, listing quality, and platform performance',
      'Detect and prevent fraudulent listings or abuse',
    ],
    note: 'We do not use your information for unrelated advertising.',
  },
  {
    id: 'information-sharing',
    title: '4. Information Sharing',
    content: null,
    items: [
      'When you choose to contact an agent or landlord through Rumia, your name and phone number are shared with that party via WhatsApp so they can respond to your enquiry.',
      'When you book a tour, your name, phone number, and tour preferences are shared with the assigned student agent.',
      'We do not sell your personal data to third parties. We may share data with:',
    ],
    subList: [
      'Infrastructure providers (Supabase for database hosting, Cloudflare for storage) under strict data processing terms',
      'Analytics tools to understand platform usage in aggregate',
      'Law enforcement if required by Kenyan law',
    ],
    note: 'WhatsApp communication happens outside Rumia\'s control. Once your phone number is shared with an agent or landlord via WhatsApp, Rumia cannot control how that party uses your information.',
  },
  {
    id: 'data-security',
    title: '5. Data Storage and Security',
    content:
      'Your data is stored on Supabase-hosted infrastructure with industry-standard security measures including encryption at rest and in transit. Access to personal data is restricted to authorised Stratnovo personnel only. No system is completely secure. If you suspect unauthorised access to your account, contact us immediately.',
  },
  {
    id: 'cookies',
    title: '6. Cookies and Session Data',
    content: null,
    items: [
      'Keeping you logged in (session cookies)',
      'Storing your pending contact state during OAuth redirects (session storage, cleared after use)',
      'Understanding how users navigate the platform (analytics)',
    ],
    note: 'You can disable cookies in your browser settings, though some features may not work correctly.',
  },
  {
    id: 'your-rights',
    title: '7. Your Rights',
    content: null,
    items: [
      'Request a copy of the data we hold about you',
      'Request correction of inaccurate data',
      'Request deletion of your account and associated data',
      'Opt out of non-essential data collection',
    ],
    note: 'To exercise any of these rights, email privacy@rumia.co.ke. We will respond within 14 days.',
  },
  {
    id: 'age-policy',
    title: "8. Children's Policy",
    content:
      'Rumia is intended for university students aged 18 and above. We do not knowingly collect data from minors. If you believe a minor has registered, contact us and we will remove their account.',
  },
  {
    id: 'changes',
    title: '9. Changes to This Policy',
    content:
      'We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page. Continued use of Rumia after changes are posted constitutes your acceptance of the updated policy.',
  },
  {
    id: 'contact',
    title: '10. Contact',
    content: null,
    contact: true,
    lines: [
      'Email: privacy@rumia.co.ke',
      'Company: Stratnovo, Nyeri, Kenya',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-900 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-black text-xl font-heading tracking-tight">
              RUMIA
            </span>
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-500">
            <Link
              href="/terms"
              className="transition-colors hover:text-emerald-600"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-slate-900">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Effective Date: June 1, 2025 &middot; Last Updated: July 25, 2025
            </p>
          </div>

          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2 className="text-xl md:text-2xl font-bold font-heading text-slate-900 mb-4">
                  {section.title}
                </h2>

                {section.content && (
                  <p className="text-slate-700 leading-relaxed">
                    {section.content}
                  </p>
                )}

                {section.items && (
                  <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700 leading-relaxed">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.subsections &&
                  section.subsections.map((sub, i) => (
                    <div key={i} className="mt-4">
                      <p className="font-semibold text-slate-800">
                        {sub.subtitle}
                      </p>
                      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-slate-700 leading-relaxed">
                        {sub.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}

                {section.subList && (
                  <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700 leading-relaxed">
                    {section.subList.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.note && (
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    {section.note}
                  </p>
                )}

                {section.contact && (
                  <div className="mt-3 space-y-1 text-slate-700 leading-relaxed">
                    {section.lines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
