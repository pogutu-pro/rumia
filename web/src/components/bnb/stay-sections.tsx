'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bath, Car, Check, Coffee, Droplets, Flame, Lock, Mountain, Shirt, ShowerHead, Sofa, Snowflake, Trees, Tv, Utensils, WashingMachine, Wifi, Wind, X, Zap,
} from 'lucide-react';

const AMENITY_ICONS: Array<[RegExp, typeof Wifi]> = [
  [/wi-?fi|internet/i, Wifi],
  [/park/i, Car],
  [/kitchen|cook/i, Utensils],
  [/tv|netflix|dstv/i, Tv],
  [/hot (shower|water)|shower/i, ShowerHead],
  [/bath/i, Bath],
  [/washer|washing|laundry/i, WashingMachine],
  [/iron|hanger/i, Shirt],
  [/air ?con|ac\b|cooling/i, Snowflake],
  [/fan/i, Wind],
  [/fire|heater|heating/i, Flame],
  [/garden|yard|outdoor/i, Trees],
  [/view|balcony/i, Mountain],
  [/coffee|kettle|breakfast/i, Coffee],
  [/water/i, Droplets],
  [/power|backup|generator|solar/i, Zap],
  [/security|guard|lock|cctv/i, Lock],
  [/sofa|lounge|living/i, Sofa],
];

function iconFor(name: string) {
  return AMENITY_ICONS.find(([re]) => re.test(name))?.[1] ?? Check;
}

export function Amenities({ items }: { items: string[] }) {
  const shown = items.slice(0, 10);
  const row = (a: string) => {
    const Icon = iconFor(a);
    return (
      <li key={a} className="flex items-center gap-4 py-2 text-bnb-ink">
        <Icon className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
        {a}
      </li>
    );
  };
  return (
    <>
      <ul className="grid gap-x-8 sm:grid-cols-2">{shown.map(row)}</ul>
      {items.length > shown.length && (
        <Dialog.Root>
          <Dialog.Trigger className="mt-6 rounded-lg border border-bnb-ink px-5 py-3 font-semibold text-bnb-ink hover:bg-bnb-mist">
            Show all {items.length} amenities
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-6 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[36rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-bnb-display text-2xl font-bold text-bnb-ink">What this place offers</Dialog.Title>
                <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-bnb-mist" aria-label="Close">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
              <ul className="mt-4 divide-y divide-bnb-line">{items.map(row)}</ul>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

/** Long descriptions fold after a few lines, with "Show more". */
export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 360;
  return (
    <div>
      <p className={`max-w-prose whitespace-pre-line leading-relaxed text-bnb-ink ${!open && long ? 'line-clamp-6' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-3 font-semibold text-bnb-ink underline underline-offset-4">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
