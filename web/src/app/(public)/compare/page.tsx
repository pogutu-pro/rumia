'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Trash2,
  Check,
  X,
  MessageCircle,
  MapPin,
  BedDouble,
  ShieldCheck,
  Wifi,
  Droplets,
  Zap,
  Wallet,
  Users,
  Search,
  GitCompareArrows,
  Star,
  Navigation,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Share2,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompareStore, type CompareSelection } from '@/stores/compare-store';
import { cn } from '@/lib/utils/cn';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { listingsClientApi } from '@/lib/api/listings-client';
import { listingToCompareSelection, type CompareListingSource } from '@/lib/compare/to-selection';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';

function cleanPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.startsWith('+') ? clean : clean.replace(/^0?/, '+254');
}

// ── Animation Variants ──────────────────────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardEntrance = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  },
};

// ── Best Value Badge ────────────────────────────────────────────────────────

function BestValueBadge({
  label,
  icon: Icon,
}: {
  label: string;
  icon: React.ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Boolean Display ─────────────────────────────────────────────────────────

function BooleanValue({
  value,
  label,
}: {
  value: boolean | null | undefined;
  label?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <span className="text-slate-300 text-sm">—</span>
    );
  }
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100/80">
        <Check className="h-3 w-3" />
      </span>
      {label || 'Included'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
        <X className="h-3 w-3" />
      </span>
      Not included
    </span>
  );
}

// ── Amenity Chips ───────────────────────────────────────────────────────────

function AmenityChips({ amenities }: { amenities: string[] | null | undefined }) {
  if (!amenities || amenities.length === 0) {
    return <span className="text-slate-300 text-sm">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {amenities.map((a) => (
        <span
          key={a}
          className="inline-flex items-center rounded-full bg-slate-100/80 border border-slate-200/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200/60"
        >
          {a}
        </span>
      ))}
    </div>
  );
}

// ── Price Display ───────────────────────────────────────────────────────────

function PriceDisplay({
  h,
  isLowest,
  size = 'default',
}: {
  h: CompareSelection;
  isLowest?: boolean;
  size?: 'default' | 'large';
}) {
  const price = h.price_single ?? h.price_sharing ?? h.price;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'font-black text-slate-900 tabular-nums',
          size === 'large' ? 'text-lg' : 'text-sm',
          isLowest && 'text-emerald-600',
        )}
      >
        KES {price.toLocaleString()}
      </span>
      <span className="text-xs font-medium text-slate-400">/mo</span>
      {isLowest && (
        <BestValueBadge label="Best Price" icon={Star} />
      )}
    </div>
  );
}

// ── Skeleton Loading ────────────────────────────────────────────────────────

function CompareSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-6 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>

        <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: '120px repeat(3, 1fr)' }}>
          <div />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <Skeleton className="aspect-4/3 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block mt-6 rounded-2xl border border-slate-100 bg-white p-6 space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="grid gap-4" style={{ gridTemplateColumns: '120px repeat(3, 1fr)' }}>
              <Skeleton className="h-4 w-20" />
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ count }: { count: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="min-h-[60vh] flex items-center justify-center"
    >
      <div className="text-center space-y-6 max-w-sm">
        <motion.div
          initial={shouldReduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4, type: 'spring', damping: 20 }}
          className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 flex items-center justify-center ring-1 ring-emerald-200/60 shadow-sm"
        >
          {count === 0 ? (
            <GitCompareArrows className="h-10 w-10 text-emerald-500" />
          ) : (
            <Users className="h-10 w-10 text-emerald-500" />
          )}
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {count === 0
              ? 'No hostels selected'
              : 'Select at least 2 hostels'}
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {count === 0
              ? 'Browse hostels and tap Compare to add them here. You can compare up to 4 hostels side by side.'
              : 'Add one more hostel from the search results to start comparing prices, amenities, and locations.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/hostels"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-600/10 active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            Browse Hostels
          </Link>
          {count === 1 && (
            <Link
              href="/hostels"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Results
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Desktop Comparison Row ──────────────────────────────────────────────────

function DesktopCompareRow({
  label,
  icon: Icon,
  children,
  isHighlight,
  className,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isHighlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-4 py-3.5 px-6 border-b border-slate-100/80 last:border-0 transition-colors duration-200',
        isHighlight && 'bg-emerald-50/30',
        className,
      )}
      style={{ gridTemplateColumns: '140px 1fr' }}
      role="row"
    >
      <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        {label}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)` }}>
        {children}
      </div>
    </div>
  );
}

// ── Desktop Comparison Cell ─────────────────────────────────────────────────

function DesktopCell({
  children,
  isBest,
  className,
}: {
  children: React.ReactNode;
  isBest?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-sm font-medium text-slate-700 flex items-center min-h-[28px]',
        isBest && 'text-emerald-700 font-semibold',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Desktop Table ───────────────────────────────────────────────────────────

function DesktopCompareTable({
  hostels,
  onRemove,
}: {
  hostels: CompareSelection[];
  onRemove: (id: string) => void;
}) {
  const cols = hostels.length;
  const shouldReduceMotion = useReducedMotion();

  const lowestPrice = Math.min(
    ...hostels.map((h) => h.price_single ?? h.price_sharing ?? h.price),
  );

  const depositValues = hostels.map((h) =>
    typeof h.deposit === 'number' ? h.deposit : Infinity,
  );
  const lowestDeposit = Math.min(...depositValues);
  const hasAnyDeposit = depositValues.some((d) => d !== Infinity);

  const moveInValues = hostels.map((h) => {
    const p = h.price_single ?? h.price_sharing ?? h.price;
    const d = typeof h.deposit === 'number' ? h.deposit : 0;
    return p + d;
  });
  const bestMoveIn = Math.min(...moveInValues);

  const shortestDistance = hostels.reduce(
    (best, h) => {
      const order = ['walking-500m', '5-10min', '1-2km', '3km', 'over-3km'];
      const idx = order.indexOf(h.distanceCategory || '');
      if (idx === -1) return best;
      if (best.idx === -1 || idx < best.idx) return { idx, id: h.id };
      return best;
    },
    { idx: -1, id: '' },
  );

  return (
    <div className="hidden md:block h-[calc(100vh-160px)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm scrollbar-hide">
      {/* Sticky Header Row */}
      <div
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200/60"
      >
        <div
          className="grid gap-4 pb-4"
          style={{ gridTemplateColumns: `140px repeat(${cols}, 1fr)` }}
        >
          <div className="flex items-end pb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Attribute
            </span>
          </div>
          <AnimatePresence mode="popLayout">
            {hostels.map((h) => {
              const href = h.slug
                ? `/hostels/${h.county ?? 'nyeri'}/${h.area ?? 'dekut'}/${h.slug}`
                : `/listing/${h.id}`;
              const isLowestPrice =
                (h.price_single ?? h.price_sharing ?? h.price) === lowestPrice &&
                cols > 1;

              return (
                <motion.div
                  key={h.id}
                  variants={shouldReduceMotion ? undefined : cardEntrance}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className="relative bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 group"
                >
                  <Link href={href} className="block">
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      <Image
                        src={h.imageUrl || FALLBACK_IMAGE}
                        alt={h.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="300px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </Link>

                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={href}
                          className="font-bold text-sm text-slate-900 line-clamp-1 hover:text-emerald-600 transition-colors"
                        >
                          {h.title}
                        </Link>
                        {h.area && (
                          <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{h.area}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <PriceDisplay h={h} isLowest={isLowestPrice} />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.gender && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                            h.gender === 'female'
                              ? 'bg-pink-50 text-pink-600 border border-pink-200/60'
                              : h.gender === 'male'
                                ? 'bg-blue-50 text-blue-600 border border-blue-200/60'
                                : 'bg-slate-100 text-slate-600 border border-slate-200/60',
                          )}
                        >
                          <Users className="h-2.5 w-2.5" />
                          {h.gender === 'female'
                            ? 'Ladies'
                            : h.gender === 'male'
                              ? 'Gents'
                              : 'Mixed'}
                        </span>
                      )}
                      {h.distanceCategory && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200/60">
                          <Navigation className="h-2.5 w-2.5" />
                          {getDistanceBadgeText(h.distanceCategory) || h.distanceCategory}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemove(h.id)}
                    className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-slate-400 shadow-sm border border-slate-200/50 transition-all duration-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200/50 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Remove ${h.title} from comparison`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Comparison Body */}
      <motion.div
        variants={shouldReduceMotion ? undefined : stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Price */}
        <DesktopCompareRow label="Price" icon={Wallet}>
          {hostels.map((h) => {
            const isLowest =
              (h.price_single ?? h.price_sharing ?? h.price) === lowestPrice &&
              cols > 1;
            return (
              <DesktopCell key={h.id} isBest={isLowest}>
                <PriceDisplay h={h} isLowest={isLowest} />
              </DesktopCell>
            );
          })}
        </DesktopCompareRow>

        {/* Deposit */}
        <DesktopCompareRow label="Deposit" icon={CreditCard}>
          {hostels.map((h) => {
            const numDeposit =
              typeof h.deposit === 'number' ? h.deposit : null;
            const isLowest =
              hasAnyDeposit &&
              numDeposit !== null &&
              numDeposit === lowestDeposit &&
              cols > 1;
            return (
              <DesktopCell key={h.id} isBest={isLowest}>
                <span className="flex items-center gap-2">
                  <span className="truncate">
                    {numDeposit !== null
                      ? `KES ${numDeposit.toLocaleString()}`
                      : '—'}
                  </span>
                  {isLowest && <BestValueBadge label="Lowest" icon={Star} />}
                </span>
              </DesktopCell>
            );
          })}
        </DesktopCompareRow>

        {/* Total to Move In */}
        <DesktopCompareRow label="Total to Move In" icon={Wallet}>
          {hostels.map((h) => {
            const price =
              h.price_single ?? h.price_sharing ?? h.price;
            const deposit =
              typeof h.deposit === 'number' ? h.deposit : 0;
            const total = price + deposit;
            const isBest = total === bestMoveIn && cols > 1;
            return (
              <DesktopCell key={h.id} isBest={isBest}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold tabular-nums">
                    KES {total.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    rent + deposit
                  </span>
                  {isBest && <BestValueBadge label="Best Value" icon={Star} />}
                </span>
              </DesktopCell>
            );
          })}
        </DesktopCompareRow>

        {/* Room Type */}
        <DesktopCompareRow label="Room Type" icon={BedDouble}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <span className="truncate">
                {h.roomType || h.roomTypeEnum?.replace('_', ' ') || '—'}
              </span>
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Distance */}
        <DesktopCompareRow label="Distance" icon={Navigation}>
          {hostels.map((h) => {
            const badge = getDistanceBadgeText(h.distanceCategory);
            const text = badge
              ? badge + (h.distanceToCampus ? ` (${h.distanceToCampus})` : '')
              : h.distanceToCampus || '—';
            const isClosest =
              shortestDistance.id === h.id && cols > 1;
            return (
              <DesktopCell key={h.id} isBest={isClosest}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{text}</span>
                  {isClosest && <BestValueBadge label="Closest" icon={Star} />}
                </span>
              </DesktopCell>
            );
          })}
        </DesktopCompareRow>

        {/* Amenities */}
        <DesktopCompareRow label="Amenities" icon={Check}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <AmenityChips amenities={h.amenities} />
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Bathroom */}
        <DesktopCompareRow label="Bathroom" icon={Droplets}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <span className="truncate">{h.bathroomType || '—'}</span>
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* WiFi */}
        <DesktopCompareRow label="WiFi" icon={Wifi}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <BooleanValue value={h.wifiIncluded} label="WiFi Included" />
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Water */}
        <DesktopCompareRow label="Water" icon={Droplets}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <BooleanValue value={h.waterIncluded} label="Water Included" />
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Electricity */}
        <DesktopCompareRow label="Electricity" icon={Zap}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <BooleanValue
                value={h.electricityIncluded}
                label="Electricity Included"
              />
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Security */}
        <DesktopCompareRow label="Security" icon={ShieldCheck}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              {h.securityType ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate capitalize">{h.securityType}</span>
                </span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Gender */}
        <DesktopCompareRow label="Gender" icon={Users}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              {h.gender ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      h.gender === 'female'
                        ? 'bg-pink-400'
                        : h.gender === 'male'
                          ? 'bg-blue-400'
                          : 'bg-slate-400',
                    )}
                  />
                  <span className="capitalize">
                    {h.gender === 'female'
                      ? 'Ladies Only'
                      : h.gender === 'male'
                        ? 'Gents Only'
                        : 'Mixed'}
                  </span>
                </span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Payment */}
        <DesktopCompareRow label="Payment" icon={CreditCard}>
          {hostels.map((h) => (
            <DesktopCell key={h.id}>
              <span className="truncate text-sm">
                {h.mpesaDetails || 'M-Pesa'}
              </span>
            </DesktopCell>
          ))}
        </DesktopCompareRow>

        {/* Agent / WhatsApp CTA Row */}
        <div
          className="grid gap-4 py-5 px-6 border-t border-slate-200/80 bg-gradient-to-r from-slate-50/50 to-emerald-50/20"
          style={{ gridTemplateColumns: `140px repeat(${cols}, 1fr)` }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <MessageCircle className="h-4 w-4 shrink-0 text-slate-400" />
            Agent
          </div>
          {hostels.map((h) => {
            const phone = h.agentWhatsapp || h.agentPhone || '';
            const waPhone = phone ? cleanPhone(phone) : '';
            return (
              <div key={h.id} className="space-y-2.5">
                <p className="text-sm font-semibold text-slate-700">
                  {h.agentName || 'Rumia Agent'}
                </p>
                {waPhone ? (
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-600/10 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    aria-label={`Contact ${h.agentName || 'agent'} via WhatsApp`}
                  >
                    <MessageCircle className="h-4 w-4 fill-current" />
                    Contact via WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    No contact available
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ── Mobile Comparison Table Row Config ──────────────────────────────────────

interface MobileRow {
  key: string;
  label: string;
  icon: React.ElementType;
  render: (h: CompareSelection, ctx: MobileRowContext) => React.ReactNode;
}

interface MobileRowContext {
  lowestPrice: number;
  closestId: string;
  cols: number;
  hostels: CompareSelection[];
}

function buildMobileRows(ctx: MobileRowContext): MobileRow[] {
  return [
    {
      key: 'price',
      label: 'Price',
      icon: Wallet,
      render: (h) => {
        const price = h.price_single ?? h.price_sharing ?? h.price;
        const isLowest = price === ctx.lowestPrice && ctx.cols > 1;
        return (
          <span className={cn('font-bold tabular-nums flex flex-col gap-0.5', isLowest ? 'text-emerald-600' : 'text-slate-900')}>
            <span>KES {price.toLocaleString()}/mo</span>
            {h.price_single && h.price_sharing && (
              <span className="text-[10px] font-medium text-slate-400">
                KES {h.price_single.toLocaleString()} for 1 · KES {h.price_sharing.toLocaleString()} sharing
              </span>
            )}
            {isLowest && (
              <BestValueBadge label="Best Price" icon={Star} />
            )}
          </span>
        );
      },
    },
    {
      key: 'distance',
      label: 'Distance',
      icon: Navigation,
      render: (h) => {
        const badge = getDistanceBadgeText(h.distanceCategory);
        const text = badge || h.distanceToCampus || '—';
        const isClosest = h.id === ctx.closestId && ctx.cols > 1;
        return (
          <span className={cn('flex flex-col gap-1', isClosest && 'text-emerald-700')}>
            <span className="font-medium">{text}</span>
            {isClosest && <BestValueBadge label="Closest" icon={Star} />}
          </span>
        );
      },
    },
    {
      key: 'room_type',
      label: 'Room Type',
      icon: BedDouble,
      render: (h) => (
        <span className="font-medium">
          {h.roomType || h.roomTypeEnum?.replace('_', ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'bathroom',
      label: 'Bathroom',
      icon: Droplets,
      render: (h) => (
        <span className="font-medium capitalize">{h.bathroomType || '—'}</span>
      ),
    },
    {
      key: 'amenities',
      label: 'Amenities',
      icon: Check,
      render: (h) => <AmenityChips amenities={h.amenities} />,
    },
    {
      key: 'wifi',
      label: 'WiFi',
      icon: Wifi,
      render: (h) => (
        <span className={cn(
          'inline-flex items-center gap-1.5 font-semibold',
          h.wifiIncluded ? 'text-emerald-600' : 'text-slate-400',
        )}>
          {h.wifiIncluded
            ? <><Check className="h-4 w-4" /> Included</>
            : <><X className="h-4 w-4" /> No</>
          }
        </span>
      ),
    },
    {
      key: 'water',
      label: 'Water',
      icon: Droplets,
      render: (h) => (
        <span className={cn(
          'inline-flex items-center gap-1.5 font-semibold',
          h.waterIncluded ? 'text-emerald-600' : 'text-slate-400',
        )}>
          {h.waterIncluded
            ? <><Check className="h-4 w-4" /> Included</>
            : <><X className="h-4 w-4" /> No</>
          }
        </span>
      ),
    },
    {
      key: 'electricity',
      label: 'Electricity',
      icon: Zap,
      render: (h) => (
        <span className={cn(
          'inline-flex items-center gap-1.5 font-semibold',
          h.electricityIncluded ? 'text-emerald-600' : 'text-slate-400',
        )}>
          {h.electricityIncluded
            ? <><Check className="h-4 w-4" /> Included</>
            : <><X className="h-4 w-4" /> No</>
          }
        </span>
      ),
    },
    {
      key: 'security',
      label: 'Security',
      icon: ShieldCheck,
      render: (h) => (
        h.securityType ? (
          <span className="inline-flex items-center gap-1.5 font-semibold capitalize">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            {h.securityType}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      ),
    },
    {
      key: 'deposit',
      label: 'Deposit',
      icon: CreditCard,
      render: (h) => {
        const numDeposit = typeof h.deposit === 'number' ? h.deposit : null;
        const allDeposits = ctx.hostels
          .map((x) => (typeof x.deposit === 'number' ? x.deposit : Infinity));
        const minDeposit = Math.min(...allDeposits);
        const isLowest = numDeposit !== null && numDeposit === minDeposit && ctx.cols > 1;
        return (
          <span className={cn('font-medium tabular-nums flex flex-col gap-1', isLowest && 'text-emerald-700')}>
            <span>{numDeposit !== null ? `KES ${numDeposit.toLocaleString()}` : '—'}</span>
            {isLowest && <BestValueBadge label="Lowest" icon={Star} />}
          </span>
        );
      },
    },
    {
      key: 'total_move_in',
      label: 'Total to Move In',
      icon: Wallet,
      render: (h) => {
        const price = h.price_single ?? h.price_sharing ?? h.price;
        const deposit = typeof h.deposit === 'number' ? h.deposit : 0;
        const total = price + deposit;
        const allTotals = ctx.hostels.map((x) => {
          const p = x.price_single ?? x.price_sharing ?? x.price;
          const d = typeof x.deposit === 'number' ? x.deposit : 0;
          return p + d;
        });
        const minTotal = Math.min(...allTotals);
        const isLowest = total === minTotal && ctx.cols > 1;
        return (
          <span className={cn('font-bold tabular-nums flex flex-col gap-1', isLowest ? 'text-emerald-600' : 'text-slate-900')}>
            <span>KES {total.toLocaleString()}</span>
            <span className="text-[10px] font-medium text-slate-400">rent + deposit</span>
            {isLowest && <BestValueBadge label="Best Value" icon={Star} />}
          </span>
        );
      },
    },
    {
      key: 'furnishing',
      label: 'Furnishing',
      icon: BedDouble,
      render: (h) => {
        const items = h.furnishingItems;
        const count = Array.isArray(items) ? items.length : 0;
        const level = count === 0 ? 'Empty' : count <= 3 ? 'Semi-furnished' : 'Furnished';
        const color = count === 0 ? 'text-slate-400' : count <= 3 ? 'text-amber-600' : 'text-emerald-600';
        if (!Array.isArray(items) || count === 0) {
          return <span className="text-slate-400">Empty</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <span className={cn('font-semibold', color)}>{level}</span>
            <div className="flex flex-wrap gap-1">
              {items.slice(0, 4).map((item) => (
                <span key={item} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                  {item}
                </span>
              ))}
              {items.length > 4 && (
                <span className="text-[10px] text-slate-400 font-medium">+{items.length - 4}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'gender',
      label: 'Gender',
      icon: Users,
      render: (h) => (
        h.gender ? (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <span className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              h.gender === 'female' ? 'bg-pink-400' : h.gender === 'male' ? 'bg-blue-400' : 'bg-slate-400',
            )} />
            {h.gender === 'female' ? 'Ladies Only' : h.gender === 'male' ? 'Gents Only' : 'Mixed'}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      ),
    },
    {
      key: 'agent',
      label: 'Agent',
      icon: MessageCircle,
      render: (h) => {
        const phone = h.agentWhatsapp || h.agentPhone || '';
        const waPhone = phone ? cleanPhone(phone) : '';
        return (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">
              {h.agentName || 'Rumia Agent'}
            </span>
            {waPhone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95"
              >
                <MessageCircle className="h-3 w-3 fill-current" />
                WhatsApp
              </a>
            )}
          </div>
        );
      },
    },
  ];
}

// ── Mobile Comparison Table ────────────────────────────────────────────────

function MobileCompareTable({
  hostels,
  onRemove,
}: {
  hostels: CompareSelection[];
  onRemove: (id: string) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const cols = hostels.length;

  const lowestPrice = Math.min(
    ...hostels.map((h) => h.price_single ?? h.price_sharing ?? h.price),
  );

  const closestDistance = (() => {
    const order = ['walking-500m', '5-10min', '1-2km', '3km', 'over-3km'];
    let best = { idx: Infinity, id: '' };
    hostels.forEach((h) => {
      const idx = order.indexOf(h.distanceCategory || '');
      if (idx !== -1 && idx < best.idx) {
        best = { idx, id: h.id };
      }
    });
    return best.id;
  })();

  const ctx: MobileRowContext = {
    lowestPrice,
    closestId: closestDistance,
    cols,
    hostels,
  };

  const rows = buildMobileRows(ctx);

  // Sync header scroll with body scroll and vice-versa
  const handleBodyScroll = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (body && header) {
      header.scrollLeft = body.scrollLeft;
    }
    requestAnimationFrame(() => setIsSyncing(false));
  }, [isSyncing]);

  const handleHeaderScroll = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (body && header) {
      body.scrollLeft = header.scrollLeft;
    }
    requestAnimationFrame(() => setIsSyncing(false));
  }, [isSyncing]);

  const hostelColWidth = cols <= 2 ? 160 : cols === 3 ? 140 : 120;
  const attrColWidth = 100;

  return (
    <div className="md:hidden pb-52">
      {/* Scroll hint */}
      {cols > 2 && (
        <div className="flex items-center gap-1.5 px-1 mb-3 text-[11px] font-semibold text-slate-400">
          <span>Swipe to see all hostels</span>
          <ChevronRight className="h-3.5 w-3.5 animate-pulse" />
        </div>
      )}

      {/* Comparison table wrapper */}
      <div className="relative rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">

        {/* ── Sticky Header Row (hostel images + names) ─────────────────── */}
        <div
          ref={headerScrollRef}
          onScroll={handleHeaderScroll}
          className="overflow-hidden"
        >
          <div
            className="flex"
            style={{ width: `${attrColWidth + hostelColWidth * cols}px` }}
          >
            {/* Top-left corner cell — sticky */}
            <div
              className="sticky left-0 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-r border-slate-200/60 flex items-center justify-center"
              style={{ width: `${attrColWidth}px`, minWidth: `${attrColWidth}px`, height: '80px' }}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Compare
              </span>
            </div>

            {/* Hostel header cells */}
            {hostels.map((h) => {
              const href = h.slug
                ? `/hostels/${h.county ?? 'nyeri'}/${h.area ?? 'dekut'}/${h.slug}`
                : `/listing/${h.id}`;
              return (
                <div
                  key={h.id}
                  className="border-b border-slate-200/60 bg-slate-50/95 backdrop-blur-sm relative flex flex-col items-center"
                  style={{ width: `${hostelColWidth}px`, minWidth: `${hostelColWidth}px` }}
                >
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemove(h.id)}
                    className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow-sm border border-slate-200/50 transition-all hover:bg-red-50 hover:text-red-500 cursor-pointer"
                    aria-label={`Remove ${h.title}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>

                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 mt-2 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm">
                    <Image
                      src={h.imageUrl || FALLBACK_IMAGE}
                      alt={h.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>

                  {/* Name */}
                  <Link href={href} className="px-2 pb-2 pt-1.5 text-center block w-full">
                    <h3 className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-tight hover:text-emerald-600 transition-colors">
                      {h.title}
                    </h3>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable Body ───────────────────────────────────────────── */}
        <div
          ref={bodyScrollRef}
          onScroll={handleBodyScroll}
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          <div
            className="flex flex-col"
            style={{ width: `${attrColWidth + hostelColWidth * cols}px` }}
          >
            {rows.map((row, rowIdx) => (
              <div
                key={row.key}
                className={cn(
                  'flex border-b border-slate-100/80 last:border-0',
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30',
                )}
              >
                {/* Attribute label — sticky left */}
                <div
                  className={cn(
                    'sticky left-0 z-20 flex items-center gap-2 px-3 bg-inherit border-r border-slate-200/60',
                    row.key === 'amenities' ? 'items-start py-3' : 'items-center py-3',
                  )}
                  style={{ width: `${attrColWidth}px`, minWidth: `${attrColWidth}px` }}
                >
                  <row.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                    {row.label}
                  </span>
                </div>

                {/* Value cells */}
                {hostels.map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      'py-3 px-3 flex items-center border-r border-slate-100/40 last:border-r-0',
                      row.key === 'amenities' ? 'flex-wrap gap-1' : '',
                    )}
                    style={{ width: `${hostelColWidth}px`, minWidth: `${hostelColWidth}px` }}
                  >
                    {row.render(h, ctx)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrateCompare = useCompareStore((s) => s.hydrateFromStorage);
  const loadFromIds = useCompareStore((s) => s.loadFromIds);
  const hydrated = useCompareStore((s) => s.hydrated);
  const selectedIds = useCompareStore((s) => s.selectedIds);
  const selections = useCompareStore((s) => s.selections);
  const addSelection = useCompareStore((s) => s.addSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);
  const clearSelection = useCompareStore((s) => s.clearSelection);
  const urlSyncDone = useRef(false);

  // Fetch full listing data from Supabase for the given IDs
  const fetchListingsFromSupabase = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const { items } = await listingsClientApi
        .getFeed({ ids, limit: ids.length })
        .catch(() => ({ items: [] as CompareListingSource[] }));
      if (items.length === 0) return;

      const remoteSelections: Record<string, CompareSelection> = {};
      (items as unknown as CompareListingSource[]).forEach((item) => {
        remoteSelections[item.id] = listingToCompareSelection(item);
      });

      loadFromIds(ids, remoteSelections);
    },
    [loadFromIds],
  );

  // Hydrate from localStorage first
  useEffect(() => {
    hydrateCompare();
  }, [hydrateCompare]);

  // After hydration, verify data completeness and refetch if any selection
  // was stored from a source that only provided partial fields (e.g. homepage
  // FeaturedHostelCard).  This fixes the "first comparison in session shows
  // dashes for everything except price" bug.
  const enrichedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (enrichedRef.current) return;
    const state = useCompareStore.getState();
    if (state.selectedIds.length === 0) return;

    const hasIncomplete = state.selectedIds.some((id) => {
      const s = state.selections[id];
      if (!s) return true;
      return (
        s.distanceCategory === undefined &&
        s.roomType === undefined &&
        s.amenities === undefined
      ) || s.deposit === undefined;
    });

    if (!hasIncomplete) {
      enrichedRef.current = true;
      return;
    }

    enrichedRef.current = true;
    fetchListingsFromSupabase(state.selectedIds);
  }, [hydrated, fetchListingsFromSupabase]);

  // Handle URL-based comparison (?ids=id1,id2,...)
  useEffect(() => {
    if (urlSyncDone.current) return;
    const idsParam = searchParams.get('ids');
    if (!idsParam) return;

    const urlIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    if (urlIds.length === 0) return;

    urlSyncDone.current = true;

    // Check if these IDs are already in the store WITH complete data
    const currentIds = useCompareStore.getState().selectedIds;
    const alreadyLoaded = urlIds.every((id) => {
      const s = useCompareStore.getState().selections[id];
      return s && s.distanceCategory !== undefined;
    });
    if (alreadyLoaded) return;

    fetchListingsFromSupabase(urlIds);
  }, [searchParams, fetchListingsFromSupabase]);

  // Sync URL params when selections change
  useEffect(() => {
    if (!hydrated || selectedIds.length === 0) return;
    const currentParam = searchParams.get('ids');
    const newParam = selectedIds.join(',');
    if (currentParam !== newParam) {
      router.replace(`/compare?ids=${newParam}`, { scroll: false });
    }
  }, [selectedIds, hydrated, router, searchParams]);

  const hostels = selectedIds
    .map((id) => selections[id])
    .filter(Boolean) as CompareSelection[];

  const handleRemove = useCallback(
    (id: string) => {
      removeSelection(id);
      toast.success('Hostel removed', {
        description: 'The hostel has been removed from your comparison.',
      });
    },
    [removeSelection],
  );

  const handleClear = useCallback(() => {
    clearSelection();
    router.replace('/compare', { scroll: false });
    toast.success('Comparison cleared', {
      description: 'All hostels have been removed.',
    });
  }, [clearSelection, router]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied!', {
        description: 'Share this comparison with friends or family.',
      });
    }).catch(() => {
      toast.info('Share this link', { description: url });
    });
  }, []);

  if (!hydrated) {
    return <CompareSkeleton />;
  }

  if (hostels.length === 0 || hostels.length === 1) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-6 lg:py-10">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <EmptyState count={hostels.length} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-6 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/hostels"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] cursor-pointer"
              aria-label="Back to search"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                Compare Hostels
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                {hostels.length} of {typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 4} hostels selected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
              title="Share comparison link"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <Link
              href="/hostels"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              Add More
            </Link>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </button>
          </div>
        </motion.div>

        {/* Desktop Table */}
        <DesktopCompareTable hostels={hostels} onRemove={handleRemove} />

        {/* Mobile Table */}
        <MobileCompareTable hostels={hostels} onRemove={handleRemove} />

        <div className="mt-10">
          <EarlyAccessBanner />
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <ComparePageContent />
    </Suspense>
  );
}
