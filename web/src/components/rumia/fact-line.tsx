import { BadgeCheck, CalendarCheck, Clock, Phone } from 'lucide-react';
import type { components } from '@/lib/api/schema';

type Fact = components['schemas']['FactRead'];

const ICON: Record<string, typeof BadgeCheck> = {
  availability: CalendarCheck,
  visit: BadgeCheck,
  registry: BadgeCheck,
  contact: Phone,
};

/** One plain, dated sentence of evidence. The icon is decoration; the sentence carries the meaning. */
export function FactLine({ fact, stale = false }: { fact: Fact; stale?: boolean }) {
  const Icon = stale ? Clock : (ICON[fact.kind] ?? BadgeCheck);
  return (
    <li className="flex items-start gap-2 text-sm text-rum-text">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${stale ? 'text-rum-caution' : 'text-rum-positive'}`} aria-hidden="true" />
      <span>{fact.text}</span>
    </li>
  );
}
