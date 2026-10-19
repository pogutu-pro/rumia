import type { Metadata } from 'next';
import { ConciergeButton } from '@/components/bnb/concierge-button';

export const metadata: Metadata = {
  title: 'List your place',
  description: 'We film your place, put it in front of travellers on TikTok, Instagram and YouTube, and send you booking requests. You pay only for stays that happen.',
  alternates: { canonical: '/hosts' },
};

const POINTS = [
  { title: 'We come and film it', body: 'A visit, photos and a vertical video tour made for TikTok, Reels and Shorts.' },
  { title: 'We bring the guests', body: 'Your place goes out on our channels and to people asking us for a stay. Every enquiry carries a reference code, so you can see which ones came from us.' },
  { title: 'You confirm each request', body: 'Requests arrive with the dates, the number of guests and the price. You accept the ones that suit you and the guest pays you directly.' },
  { title: 'You pay for completed stays only', body: 'No listing fee and nothing upfront. A share of the room charges for each stay that actually happens, agreed with you before we start.' },
];

export default function HostsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
      <h1 className="max-w-3xl font-bnb-display text-[2.2rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-bnb-ink sm:text-5xl">
        Your place, filmed and in front of the guests who are looking.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-bnb-stone">
        RumiaBnB markets a small number of short stays around Nyeri and Mt Kenya. We visit every place before it goes up.
      </p>

      <ul className="mt-12 grid gap-8 sm:grid-cols-2">
        {POINTS.map((p) => (
          <li key={p.title} className="border-t-2 border-bnb-forest pt-4">
            <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">{p.title}</h2>
            <p className="mt-2 max-w-prose leading-relaxed text-bnb-stone">{p.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-14 rounded-[1.5rem] bg-bnb-forest p-6 text-bnb-mist sm:p-10">
        <h2 className="font-bnb-display text-2xl font-bold sm:text-3xl">Talk to us about your place</h2>
        <p className="mt-2 max-w-xl text-bnb-mist/80">Tell us where it is and how many guests it takes. We will arrange a visit.</p>
        <ConciergeButton className="mt-6" label="Message us on WhatsApp" variant="amber" />
      </div>
    </div>
  );
}
