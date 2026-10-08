'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { PropertyRead, SearchCard } from '@/lib/api/rumia';
import { KIND_LABEL, includedLine, ksh, pricePerPeriod, statusLabel, unitLabel } from '@/lib/rumia/format';

interface Props {
  cards: SearchCard[];
  properties: Record<string, PropertyRead>; // keyed by slug
}

function cheapest(p: PropertyRead) {
  const available = p.units.filter((u) => u.count_available > 0);
  return (available.length ? available : p.units).slice().sort((a, b) => a.price_amount - b.price_amount)[0];
}

/**
 * The decision facts only (ux/04 §4.3): price, move-in cost, what is included, availability, walk time
 * to the user's landmark, and the verification facts. Everything else is one tap away.
 */
export function CompareTable({ cards, properties }: Props) {
  const present = cards.filter((c) => properties[c.slug]);

  interface Row {
    label: string;
    values: string[];
  }
  const table: Row[] = [];

  const add = (label: string, pick: (p: PropertyRead) => string) => {
    table.push({ label, values: present.map((c) => pick(properties[c.slug])) });
  };

  add('Price', (p) => {
    const u = cheapest(p);
    return u ? `${pricePerPeriod(u.price_amount, u.price_period)} · ${unitLabel(u)}` : '';
  });
  add('Move in', (p) => {
    const u = cheapest(p);
    return u?.move_in_total ? ksh(u.move_in_total) : '';
  });
  add('Included', (p) => includedLine(p.included_utilities) || '—');
  add('Availability', (p) => p.facts.find((f) => f.kind === 'availability')?.text ?? statusLabel(p.status));
  add('Walk times', (p) => p.landmarks.map((l) => `${l.walk_min} min walk to ${l.name}`).join(', ') || '—');
  add('What Rumia knows', (p) => p.facts.filter((f) => f.kind !== 'availability').map((f) => f.text).join(' · ') || '—');

  return (
    <div className="overflow-x-auto rounded-rum-media border border-rum-line bg-rum-raised">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">Compare the places you selected</caption>
        <thead>
          <tr>
            <th scope="col" className="w-32 p-3 text-left align-bottom text-base font-semibold text-rum-muted">
              Compare
            </th>
            {present.map((c) => (
              <th key={c.listing_id ?? c.id} scope="col" className="min-w-[13rem] p-3 text-left align-top">
                <div className="relative aspect-[4/3] overflow-hidden rounded-rum-media bg-rum-sunken">
                  {c.cover_url ? (
                    <Image src={c.cover_url} alt="" fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover" />
                  ) : (
                    <div className="h-full w-full bg-rum-sunken" />
                  )}
                </div>
                <p className="mt-2 text-base font-semibold text-rum-text">{c.name}</p>
                <p className="text-sm text-rum-muted">
                  {c.place_name ? `${KIND_LABEL[c.kind] ?? c.kind} · ${c.place_name}` : KIND_LABEL[c.kind] ?? c.kind}
                </p>
                <Link href={`/p/${c.slug}`} className="mt-1 inline-block text-sm font-semibold text-rum-accent underline underline-offset-2">
                  View place
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr key={row.label} className="border-t border-rum-line">
              <th scope="row" className="p-3 text-left align-top font-medium text-rum-muted">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={present[i].slug} className="p-3 align-top whitespace-pre-line text-rum-text">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}