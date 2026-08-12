'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import type { Campus } from '@/types';

const DEFAULT_CAMPUS_PICKER_IMAGE = '/dekut.jpeg';

// Supplementary campus metadata for clean preview details
const CAMPUS_PREVIEWS: Record<
  string,
  {
    image: string;
    zones: string[];
    description: string;
  }
> = {
  dekut: {
    image: '/dekut.jpeg',
    zones: ['Gate A', 'Embassy', 'Boma', 'Nyeri View'],
    description:
      'Verified student hostels near Dedan Kimathi University of Technology, Nyeri.',
  },
  mmu: {
    image:
      'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=800',
    zones: ['Magadi Road', 'Ongata Rongai', 'Rimpa'],
    description: 'Hostels along Magadi Road and Ongata Rongai, Nairobi.',
  },
  ku: {
    image:
      'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800',
    zones: ['Kahawa Sukari', 'Kahawa Wendani', 'KM'],
    description: 'Hostels around Main Campus and Kahawa Sukari, Nairobi.',
  },
  uon: {
    image:
      'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=800',
    zones: ['Main Campus', 'Chiromo', 'Parklands'],
    description: 'Housing near Main, Chiromo and Parklands campuses, Nairobi.',
  },
  mmust: {
    image:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800',
    zones: ['Kakamega Town', 'Lurambi', 'Kefinco'],
    description: 'Student accommodation across Kakamega, Kenya.',
  },
  kisii: {
    image:
      'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=800',
    zones: ['Main Campus', 'Nyanchwa', 'Town Centre'],
    description: 'Verified student rooms near Main Campus, Kisii.',
  },
};

interface CampusPickerCardsProps {
  campuses: Campus[];
}

export function CampusPickerCards({ campuses }: CampusPickerCardsProps) {
  const [notifiedCampuses, setNotifiedCampuses] = useState<
    Record<string, boolean>
  >({});
  const router = useRouter();

  const handleNotifyMe = (campusName: string, slug: string) => {
    setNotifiedCampuses((prev) => ({ ...prev, [slug]: true }));
    toast.success(`Registered for ${campusName} updates`, {
      description:
        "We'll notify you as soon as hostels are available for this campus.",
    });
  };

  const handleCardClick = (campus: Campus, isActive: boolean) => {
    if (isActive) {
      const targetUrl = `/hostels/${campus.city.toLowerCase()}/${campus.slug}`;
      router.prefetch(targetUrl);
      router.push(targetUrl);
    } else {
      handleNotifyMe(campus.short_name ?? campus.name, campus.slug);
    }
  };

  return (
    <section
      id="campuses"
      className="py-10 sm:py-14 bg-slate-50/60 border-y border-slate-100"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            University Locations
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 mb-3">
            Find Hostels Near Your University
          </h2>
          <p className="text-slate-600 text-base font-medium leading-relaxed">
            Select your campus to browse verified student rooms, pricing, and
            direct agent WhatsApp contacts.
          </p>
        </div>

        {/* Campus Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campuses.map((campus) => {
            const isActive = campus.status === 'active';
            const preview = CAMPUS_PREVIEWS[campus.slug] || {
              image: campus.hero_image || DEFAULT_CAMPUS_PICKER_IMAGE,
              zones: [campus.city],
              description:
                campus.hero_subtext || `Student hostels near ${campus.name}.`,
            };

            const imageSrc =
              campus.hero_image || preview.image || DEFAULT_CAMPUS_PICKER_IMAGE;
            const targetUrl = `/hostels/${campus.city.toLowerCase()}/${campus.slug}`;
            const shortName = campus.short_name ?? campus.name;
            const isNotified = notifiedCampuses[campus.slug];

            return (
              <div
                key={campus.id}
                role="link"
                tabIndex={0}
                aria-label={
                  isActive
                    ? `Browse ${shortName} hostels`
                    : `Register for ${shortName} updates`
                }
                onClick={() => handleCardClick(campus, isActive)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(campus, isActive);
                  }
                }}
                className={cn(
                  'group flex flex-col bg-white border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer',
                  isActive
                    ? 'border-slate-200/80 shadow-xs hover:shadow-lg hover:border-emerald-500/40'
                    : 'border-slate-200/60 shadow-xs hover:border-slate-300',
                )}
              >
                {/* Image Header */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                  <Image
                    src={imageSrc}
                    alt={`${campus.name} Campus`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                      isActive ? '' : 'grayscale'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-slate-900/5" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-slate-600 text-xs font-semibold shadow-xs">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* City Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 text-xs font-medium shadow-xs">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {campus.city}
                    </span>
                  </div>

                  {/* Campus name overlay */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-extrabold text-white tracking-tight drop-shadow-sm">
                      {shortName}
                    </h3>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 mb-2 line-clamp-1">
                      {campus.name}
                    </p>

                    {/* Zone Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {preview.zones.map((zone) => (
                        <span
                          key={zone}
                          className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold"
                        >
                          {zone}
                        </span>
                      ))}
                    </div>

                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">
                      {preview.description}
                    </p>
                  </div>

                  {/* Action footer, integrated into the card */}
                  <div className="-mx-5 -mb-5 mt-auto rounded-b-2xl border-t border-slate-100 bg-white p-3">
                    {isActive ? (
                      <Link
                        href={targetUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-bold transition-colors hover:bg-slate-700"
                      >
                        Browse {shortName} hostels
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotifyMe(shortName, campus.slug);
                        }}
                        disabled={isNotified}
                        className={cn(
                          'flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-bold transition-colors',
                          isNotified
                            ? 'bg-slate-900/40 cursor-default'
                            : 'hover:bg-slate-700',
                        )}
                      >
                        {isNotified ? 'Registered' : 'Notify me when live'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
