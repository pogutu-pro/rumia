import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/layouts/public-footer';
import { getCampusBySlug } from '@/lib/data/campuses';

export async function generateMetadata(): Promise<Metadata> {
  const campus = await getCampusBySlug('dekut');
  const shortName = campus.short_name ?? 'DeKUT';
  const city = campus.city ?? 'Nyeri';

  return {
    title: 'Terms of Service',
    description: `Rumia terms of service — rules and guidelines for using our hostel discovery platform near ${shortName}, ${city}, Kenya.`,
  };
}

function buildSections(campus: { short_name: string | null; city: string | null }) {
  const shortName = campus.short_name ?? 'DeKUT';
  const city = campus.city ?? 'Nyeri';

  const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using Rumia, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. These terms apply to all users including students, student agents, and any landlords who interact with the platform.',
  },
  {
    id: 'description-of-service',
    title: '2. What Rumia Is (and Is Not)',
    content: null,
    paragraphs: [
      'Rumia is a hostel listing and lead generation platform. We connect students looking for accommodation near ' + shortName + ' with student agents who list available rooms on behalf of landlords.',
      'Rumia is not a rental agency. We do not own, manage, or guarantee any of the properties listed on the platform. We do not handle rent payments, tenancy agreements, or disputes between tenants and landlords. Any rental arrangement is strictly between the student, the agent, and the landlord.',
    ],
  },
  {
    id: 'contact-flow',
    title: '3. Contact Flow and Phone Numbers',
    content: null,
    paragraphs: [
      'When you choose to contact a listing on Rumia, you are presented with two options: Hostel Owner (direct contact with the landlord or caretaker) and Rumia Agent (contact through a student agent for guided assistance).',
      'To initiate contact, you must be signed in and have a valid Kenyan phone number saved to your profile. Your phone number is shared with the agent or landlord so they can respond to your enquiry via WhatsApp.',
      'Rumia collects and logs contact leads for commission tracking purposes. By contacting an agent or landlord through Rumia, you consent to your name and phone number being shared with that party.',
    ],
  },
  {
    id: 'student-responsibilities',
    title: '4. Student Responsibilities',
    content: null,
    items: [
      'Provide accurate personal information — including a valid Kenyan phone number — when registering or contacting an agent',
      'Use the platform only to find genuine accommodation for yourself',
      'Not misrepresent your identity or contact multiple agents for the same room simultaneously with no intent to rent',
      'Not use Rumia\'s agent contact details for spam or any purpose unrelated to finding accommodation',
      'Verify room conditions in person before paying any deposit or signing any agreement',
    ],
  },
  {
    id: 'agent-responsibilities',
    title: '5. Agent Responsibilities',
    content: null,
    items: [
      'Only list rooms that are genuinely available and accurately described',
      'Keep your listings up to date — mark rooms as taken once they are filled',
      'Not inflate pricing, misrepresent room conditions, or use misleading photos',
      'Respond to genuine student enquiries in good faith',
      'Not list rooms without the knowledge and approval of the landlord or caretaker',
      'Provide accurate phone numbers for both the agent WhatsApp and the hostel owner/landlord',
    ],
    note: 'Rumia reserves the right to remove any listing that is reported as inaccurate, misleading, or no longer available, and to suspend agents who repeatedly violate this.',
  },
  {
    id: 'commission',
    title: '6. Lead Generation and Commission',
    content: null,
    paragraphs: [
      'Rumia operates on a lead generation model. When a student contacts an agent through Rumia and subsequently moves into the listed property, a commission fee is owed to Rumia by the landlord.',
      'Some hostels are designated as commission-paying (managed by Rumia agents with landlord agreements), while others are not. The commission status is displayed on each listing.',
    ],
    items: [
      'The commission split is 40% to Rumia, 60% to the agent, based on the agreed commission rate with the landlord.',
      'Rumia\'s 40% share is non-negotiable and forms the basis of our business model.',
      'For non-commission hostels, a KES 50 consultation fee may apply when contacting a Rumia Agent. This fee is paid directly to the agent and is clearly disclosed before the contact is made.',
      'Agents and landlords who attempt to circumvent this arrangement — for example by redirecting students off-platform to avoid commission attribution — are in breach of these terms and will be permanently removed from the platform.',
    ],
  },
  {
    id: 'tour-bookings',
    title: '7. Tour Bookings and Pricing',
    content: null,
    paragraphs: [
      'Rumia offers a guided hostel tour service where a student agent accompanies you to visit hostels in person. Tours must be booked and paid for through the platform before the visit.',
    ],
    items: [
      'Hostel tour (from a listing details page or the /book-tour page): KSh 500 flat — visit one or more hostels in the same area',
      'Full search tour: pricing varies by zone (KSh 600 – KSh 1,500 depending on the area)',
      'Tour fees are a flat rate and do not depend on how many hostels you choose to visit',
      'Tour bookings are confirmed only after payment. Cancellations must be made at least 24 hours before the scheduled tour',
      'Rumia is not responsible for the outcome of any tour — a tour does not guarantee a room will be available',
    ],
  },
  {
    id: 'prohibited-conduct',
    title: '8. Prohibited Conduct',
    content: null,
    items: [
      'Creating fake, duplicate, or misleading listings',
      'Impersonating another agent, student, or landlord',
      'Deliberately redirecting students away from Rumia\'s tracked contact flow to avoid commission',
      'Harassing or spamming other users',
      'Using automated tools to scrape listings or contact information',
      'Providing false phone numbers or contact details',
      'Any activity that violates Kenyan law',
    ],
    note: 'Violations may result in immediate account suspension without notice.',
  },
  {
    id: 'intellectual-property',
    title: '9. Intellectual Property',
    content: null,
    paragraphs: [
      'The Rumia name, logo, platform design, and all content created by Stratnovo are the intellectual property of Stratnovo. You may not reproduce, copy, or use any part of the platform for commercial purposes without written permission.',
      'User-submitted content (listing photos, descriptions) remains the property of the submitter. By uploading content to Rumia, you grant Stratnovo a non-exclusive licence to display that content on the platform.',
    ],
  },
  {
    id: 'disclaimers',
    title: '10. Disclaimers',
    content: null,
    items: [
      'The accuracy of any listing submitted by an agent',
      'The conduct of any agent, landlord, or student using the platform',
      'Any dispute arising from a rental arrangement made through Rumia',
      'Any loss, damage, or dissatisfaction resulting from accommodation found through the platform',
      'WhatsApp availability or delivery of messages — WhatsApp is operated by a third party and is outside Rumia\'s control',
    ],
    note: 'Use Rumia\'s listings as a starting point. Always verify room conditions in person before paying any deposit or signing any agreement.',
    preamble:
      'Rumia facilitates connections between students and agents. We are not responsible for:',
  },
  {
    id: 'termination',
    title: '11. Account Termination',
    content:
      'Rumia reserves the right to suspend or permanently terminate any account that violates these Terms of Service, engages in fraudulent activity, or damages the reputation or operation of the platform. No refund of any kind will be issued upon termination for cause. You may delete your own account at any time by contacting us at legal@rumia.co.ke.',
  },
  {
    id: 'governing-law',
    title: '12. Governing Law',
    content:
      'These Terms of Service are governed by the laws of the Republic of Kenya. Any disputes arising from the use of Rumia shall be subject to the jurisdiction of Kenyan courts.',
  },
  {
    id: 'contact',
    title: '13. Contact',
    content: null,
    contact: true,
    lines: [
      'Email: legal@rumia.co.ke',
      `Company: Stratnovo, ${city}, Kenya`,
    ],
  },
];

  return sections;
}

export default async function TermsOfServicePage() {
  const campus = await getCampusBySlug('dekut');
  const sections = buildSections(campus);

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
              href="/policy"
              className="transition-colors hover:text-emerald-600"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-slate-900">
              Terms of Service
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

                {section.paragraphs &&
                  section.paragraphs.map((para, i) => (
                    <p key={i} className="text-slate-700 leading-relaxed mb-3 last:mb-0">
                      {para}
                    </p>
                  ))}

                {section.preamble && (
                  <p className="text-slate-700 leading-relaxed mb-3">
                    {section.preamble}
                  </p>
                )}

                {section.items && (
                  <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700 leading-relaxed">
                    {section.items.map((item, i) => (
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
