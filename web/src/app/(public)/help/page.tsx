import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, BellRing, Building2, CalendarCheck, Clock, Eye, Menu, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help & safety',
  description: 'How Rumia checks places, how to avoid deposit scams, what to check on a viewing, and how to report a problem.',
};

const facts = [
  {
    icon: CalendarCheck,
    heading: 'Available — confirmed by the owner',
    body: 'A staff member or the owner reconfirmed it recently. If it says “Not confirmed recently”, ask before you visit.',
  },
  {
    icon: BadgeCheck,
    heading: 'Visited by Rumia',
    body: 'Someone on the Rumia team walked through the place and confirmed what is actually there, not just what the advert says.',
  },
  {
    icon: Building2,
    heading: 'In the registry',
    body: 'The place is on the list of buildings recognised for student housing — often the same list the campus keeps.',
  },
  {
    icon: Clock,
    heading: 'Walk times',
    body: 'Walking minutes to the campuses and popular spots, measured on foot — not by car.',
  },
];

const viewingChecklist = [
  'See the exact room and unit you would move into — not “one like it”.',
  'Confirm who you will pay, and what the rent includes (water, Wi-Fi, hot water).',
  'Ask about power, parking, security and whether there is a caretaker on site.',
  'Pay only after you have moved in — first month, agreed in writing or on WhatsApp.',
  'Note the owner’s phone and every payment detail so Rumia can verify them.',
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">Help &amp; safety</h1>
        <p className="text-base text-rum-muted">Short answers to the questions that matter when you are renting.</p>
      </header>

      <div className="mt-8 space-y-10">
        <section aria-labelledby="what-rumia-checks">
          <h2 id="what-rumia-checks" className="text-xl font-semibold text-rum-text">What Rumia checks</h2>
          <p className="mt-2 text-sm text-rum-muted">
            Every place shows its evidence under “What Rumia knows”. Each line is a dated fact — nothing is assumed.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <li key={f.heading} className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
                <f.icon className="h-5 w-5 text-rum-accent" aria-hidden="true" />
                <h3 className="mt-2 text-base font-semibold text-rum-text">{f.heading}</h3>
                <p className="mt-1 text-sm text-rum-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="avoid-scams">
          <h2 id="avoid-scams" className="text-xl font-semibold text-rum-text">How to avoid deposit scams</h2>
          <div className="mt-4 rounded-rum-media border border-rum-line bg-rum-raised p-4 text-sm text-rum-text">
            <p className="font-semibold">Never pay a deposit before you have seen the room.</p>
            <p className="mt-1">
              Be careful if anyone rushes you to pay, asks for money to “hold” a place, or sends a photo and demands an
              M-Pesa payment before you visit. A real landlord lets you look first.
            </p>
            <p className="mt-3">
              About to pay anything?{' '}
              <Link href="/check" className="font-semibold text-rum-accent underline underline-offset-2">
                Check a phone number, name or M-Pesa detail before you send money
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="viewing-checklist">
          <h2 id="viewing-checklist" className="text-xl font-semibold text-rum-text">What to check on a viewing</h2>
          <ul className="mt-4 space-y-2">
            {viewingChecklist.map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-text">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-rum-accent" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-to-report">
          <h2 id="how-to-report" className="text-xl font-semibold text-rum-text">How to report a problem</h2>
          <div className="mt-4 space-y-3 text-sm text-rum-text">
            <p className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
              <ShieldAlert className="mb-2 h-5 w-5 text-rum-accent" aria-hidden="true" />
              Every place has a <strong>Report</strong> button. Tell us anything from a wrong detail to a suspected scam —
              it goes straight to the people who check places.
            </p>
            <p className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
              <BellRing className="mb-2 h-5 w-5 text-rum-accent" aria-hidden="true" />
              You can also file a report from{' '}
              <Link href="/verify/report" className="font-semibold text-rum-accent underline underline-offset-2">
                the report form
              </Link>{' '}
              or ask the team to double-check something on{' '}
              <Link href="/verify" className="font-semibold text-rum-accent underline underline-offset-2">
                the verification page
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="list-a-property">
          <h2 id="list-a-property" className="text-xl font-semibold text-rum-text">How to list a property</h2>
          <p className="mt-2 text-sm text-rum-text">
            <span className="rounded-rum-media border border-rum-line bg-rum-raised p-4 block">
              Choose <Menu className="mr-1 inline h-4 w-4 text-rum-muted" aria-hidden="true" />
              <span className="font-semibold">List your property</span> in the menu to start. A Rumia team member confirms
              the details — including a visit — before it goes live, the same way every place here is checked.
            </span>
          </p>
        </section>

        <p className="text-sm text-rum-muted">
          Still stuck? Every place lists its contact on a card you can reach directly on WhatsApp.
        </p>
      </div>
    </div>
  );
}