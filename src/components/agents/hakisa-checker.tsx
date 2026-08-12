'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ShieldCheck, CircleOff, ExternalLink, AlertTriangle, Check, Phone, Building2, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import {
  extractVerificationSignals,
  parseOfficialRecord,
  buildOfficialPhoneIndex,
  type OfficialDeKutRecord,
  type ListingMatchCandidate,
} from '@/lib/utils/dekut-verification';
import officialRecordsData from '@/lib/data/dekut-official-records.json';

const OFFICIAL_RECORDS: OfficialDeKutRecord[] = officialRecordsData.map((record) =>
  parseOfficialRecord(record),
);

const OFFICIAL_PHONE_INDEX = buildOfficialPhoneIndex(OFFICIAL_RECORDS);

interface HakisaCheckerProps {
  rumiaListings?: ListingMatchCandidate[];
}

type ResultState = 'verified' | 'mismatch' | 'not-found' | 'multiple';
type SearchMode = 'phone' | 'hostel' | 'paybill' | 'till';

interface VerifiedData {
  hostelName: string;
  officialContact: string;
  officialPayment: string;
  verifiedDate: string;
  onRumia: boolean;
  listingUrl?: string;
}

interface MultipleData {
  hostels: string[];
}

interface MismatchData {
  officialContact: string;
  providedContact: string;
}

const MODE_CONFIG: Record<SearchMode, { label: string; icon: React.ReactNode; placeholder: string; inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] }> = {
  phone: {
    label: 'Phone Number',
    icon: <Phone className="h-4 w-4" />,
    placeholder: 'e.g. 0728XXXXXX',
    inputMode: 'tel',
  },
  hostel: {
    label: 'Hostel Name',
    icon: <Building2 className="h-4 w-4" />,
    placeholder: 'e.g. Urban Suites',
    inputMode: 'text',
  },
  paybill: {
    label: 'Paybill Number',
    icon: <CreditCard className="h-4 w-4" />,
    placeholder: 'e.g. 247247 or 522533',
    inputMode: 'text',
  },
  till: {
    label: 'Till Number',
    icon: <CreditCard className="h-4 w-4" />,
    placeholder: 'e.g. 9383225',
    inputMode: 'numeric',
  },
};

function formatPhone(val: string) {
  if (val.length <= 3) return val;
  return `${val.slice(0, 3)} ${val.slice(3)}`;
}

function VerifiedResult({ data }: { data: VerifiedData }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden">
      <div className="bg-emerald-600 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-50">
          <ShieldCheck className="h-4 w-4" />
          Verified
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-xl font-bold text-emerald-900">{data.hostelName}</h3>
          <p className="mt-1 text-sm text-emerald-600 font-medium">Verified by Rumia</p>
        </div>

        <div className="space-y-3 rounded-xl bg-white border border-emerald-100 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Phone Number</span>
            <span className="font-mono font-bold text-slate-900">
              {formatPhone(data.officialContact.slice(0, 3) + 'XXXXXXXX')}
            </span>
          </div>
          <div className="border-t border-emerald-50" />
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Payment Details</span>
            <span className="font-bold text-slate-900">
              {data.officialPayment || '-'}
            </span>
          </div>
          <div className="border-t border-emerald-50" />
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Last updated</span>
            <span className="font-semibold text-slate-700">{data.verifiedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" />
          Safe to proceed.
        </div>

        {data.onRumia && data.listingUrl ? (
          <Link
            href={data.listingUrl}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-500 active:scale-[0.98]"
          >
            View Listing
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link
            href="/verify/report"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            Report Information
          </Link>
        )}
      </div>
    </div>
  );
}

function MultipleResult({ data }: { data: MultipleData }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="bg-amber-500 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
          <AlertTriangle className="h-4 w-4" />
          Multiple Matches
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        <p className="text-sm text-amber-800 font-medium">
          This information matches multiple official records:
        </p>
        <div className="space-y-1.5">
          {data.hostels.map((name, i) => (
            <div key={name} className="flex items-center gap-2 text-base font-bold text-amber-900">
              {i > 0 && <span className="text-sm font-medium text-amber-500">or</span>}
              <span>{name}</span>
            </div>
          ))}
        </div>
        <Link
          href="/verify/records"
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-amber-400 active:scale-[0.98]"
        >
          View Records
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function MismatchResult({ data }: { data: MismatchData }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
      <div className="bg-red-600 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-50">
          <CircleOff className="h-4 w-4" />
          Details Don&apos;t Match
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        <div className="space-y-3 rounded-xl bg-white border border-red-100 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Official Contact</span>
            <span className="font-mono font-bold text-slate-900">
              {formatPhone(data.officialContact.slice(0, 3) + 'XXXXXXXX')}
            </span>
          </div>
          <div className="border-t border-red-50" />
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">You Entered</span>
            <span className="font-mono font-bold text-red-600">
              {formatPhone(data.providedContact.slice(0, 3) + 'XXXXXXXX')}
            </span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-red-700 font-medium">
          Please confirm directly with the hostel before making payment.
        </p>
        <Link
          href="/verify/records"
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-red-500 active:scale-[0.98]"
        >
          View Official Record
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function NotFoundResult() {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
      <div className="bg-red-600 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-50">
          <AlertTriangle className="h-4 w-4" />
          Unverified
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CircleOff className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-red-800 font-medium">
            This payment information has <strong>not</strong> been verified by Rumia. Proceed with caution.
          </p>
        </div>
        <div className="rounded-xl bg-white border border-red-100 p-4 text-sm space-y-2">
          <p className="font-bold text-red-700">Before making payment:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2 text-red-600">
              <span className="text-red-300 mt-0.5">&bull;</span>
              <span>Ask for a hostel tour.</span>
            </li>
            <li className="flex items-start gap-2 text-red-600">
              <span className="text-red-300 mt-0.5">&bull;</span>
              <span>Confirm ownership with the landlord.</span>
            </li>
            <li className="flex items-start gap-2 text-red-600">
              <span className="text-red-300 mt-0.5">&bull;</span>
              <span>Contact support if unsure.</span>
            </li>
          </ul>
        </div>
        <div className="flex gap-2">
          <Link
            href="/verify/report"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-red-500 active:scale-[0.98]"
          >
            Report Listing
          </Link>
          <a
            href="tel:+254"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

const MODES: { key: SearchMode; label: string; icon: React.ReactNode }[] = [
  { key: 'phone', label: 'Phone', icon: <Phone className="h-3.5 w-3.5" /> },
  { key: 'hostel', label: 'Hostel', icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: 'paybill', label: 'Paybill', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'till', label: 'Till Number', icon: <CreditCard className="h-3.5 w-3.5" /> },
];

export function HakisaChecker({ rumiaListings = [] }: HakisaCheckerProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>('phone');
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const mode = MODE_CONFIG[searchMode];

  const outcome = useMemo<{
    state: ResultState;
    verified?: VerifiedData;
    multiple?: MultipleData;
    mismatch?: MismatchData;
  } | null>(() => {
    if (!submitted || !value.trim()) return null;

    const signals = extractVerificationSignals(value.trim());
    const query = value.trim().toLowerCase();
    const cleanDigits = query.replace(/\D/g, '');
    const phoneSignal = signals.find((s) => s.kind === 'phone');
    const paymentSignal = signals.find((s) => s.kind === 'payment');

    // 1. Phone match
    if (phoneSignal) {
      const normalized = phoneSignal.value;
      const hostelsForPhone = OFFICIAL_PHONE_INDEX.get(normalized);

      if (hostelsForPhone && hostelsForPhone.length > 1) {
        return {
          state: 'multiple',
          multiple: { hostels: hostelsForPhone },
        };
      }

      if (hostelsForPhone && hostelsForPhone.length === 1) {
        const record = OFFICIAL_RECORDS.find((r) =>
          r.contacts.some((c) => c === normalized),
        );
        if (record) {
          return {
            state: 'verified',
            verified: buildVerifiedData(record, normalized, rumiaListings),
          };
        }
      }

      // Check Rumia listings directly for phone
      const matchingRumiaListing = rumiaListings.find((l) => {
        const phones = [l.landlord_phone, l.agent_phone, l.agent_whatsapp]
          .filter(Boolean)
          .map((p) => (p ? p.replace(/\D/g, '') : ''));
        const searchDigit = normalized.replace(/\D/g, '');
        return phones.some((p) => p && (p === searchDigit || p.endsWith(searchDigit.slice(-9))));
      });

      if (matchingRumiaListing) {
        return {
          state: 'verified',
          verified: buildListingVerifiedData(matchingRumiaListing),
        };
      }
    }

    // 2. Paybill / Till / Payment Match (if searchMode === 'paybill' || searchMode === 'till' || paymentSignal || cleanDigits 4-8 digits)
    if (searchMode === 'paybill' || searchMode === 'till' || paymentSignal || (cleanDigits.length >= 4 && cleanDigits.length <= 8)) {
      const payVal = paymentSignal?.value || cleanDigits || query;

      const officialPaymentMatches = OFFICIAL_RECORDS.filter((r) =>
        r.payments.some((p) => {
          const lowerP = p.toLowerCase();
          const pDigits = p.replace(/\D/g, '');
          return (
            lowerP.includes(query) ||
            (payVal && p.includes(payVal)) ||
            (cleanDigits && cleanDigits.length >= 4 && pDigits.includes(cleanDigits))
          );
        }),
      );

      const rumiaPaymentMatches = rumiaListings.filter((l) => {
        if (!l.mpesa_details) return false;
        const lowerM = l.mpesa_details.toLowerCase();
        const mDigits = l.mpesa_details.replace(/\D/g, '');
        return (
          lowerM.includes(query) ||
          (payVal && lowerM.includes(payVal)) ||
          (cleanDigits && cleanDigits.length >= 4 && mDigits.includes(cleanDigits))
        );
      });

      const totalMatchesCount = officialPaymentMatches.length + rumiaPaymentMatches.length;

      if (totalMatchesCount === 1) {
        if (officialPaymentMatches.length === 1) {
          const record = officialPaymentMatches[0];
          return {
            state: 'verified',
            verified: buildVerifiedData(
              record,
              phoneSignal?.value || record.contacts[0] || '',
              rumiaListings,
            ),
          };
        }
        if (rumiaPaymentMatches.length === 1) {
          return {
            state: 'verified',
            verified: buildListingVerifiedData(rumiaPaymentMatches[0]),
          };
        }
      }

      if (totalMatchesCount > 1) {
        const names = [
          ...officialPaymentMatches.map((r) => r.hostel_name),
          ...rumiaPaymentMatches.map((l) => l.title),
        ];
        return {
          state: 'multiple',
          multiple: { hostels: Array.from(new Set(names)) },
        };
      }
    }

    // 3. Name Match (Hostel name search or general string match)
    const officialNameMatches = OFFICIAL_RECORDS.filter((r) =>
      r.hostel_name.toLowerCase().includes(query),
    );

    const rumiaNameMatches = rumiaListings.filter((l) =>
      l.title.toLowerCase().includes(query) ||
      (l.specific_location && l.specific_location.toLowerCase().includes(query)),
    );

    const totalNameCount = officialNameMatches.length + rumiaNameMatches.length;

    if (officialNameMatches.length === 1 && rumiaNameMatches.length === 0) {
      const record = officialNameMatches[0];
      if (phoneSignal && !record.contacts.some((c) => c === phoneSignal.value)) {
        return {
          state: 'mismatch',
          mismatch: {
            officialContact: record.contacts[0],
            providedContact: phoneSignal.value,
          },
        };
      }
      return {
        state: 'verified',
        verified: buildVerifiedData(
          record,
          phoneSignal?.value || record.contacts[0],
          rumiaListings,
        ),
      };
    }

    if (rumiaNameMatches.length === 1 && officialNameMatches.length === 0) {
      return {
        state: 'verified',
        verified: buildListingVerifiedData(rumiaNameMatches[0]),
      };
    }

    if (totalNameCount > 1) {
      const names = [
        ...officialNameMatches.map((r) => r.hostel_name),
        ...rumiaNameMatches.map((l) => l.title),
      ];
      return {
        state: 'multiple',
        multiple: { hostels: Array.from(new Set(names)) },
      };
    }

    return { state: 'not-found' };
  }, [value, submitted, searchMode, rumiaListings]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (outcome?.state === 'not-found') {
      if (!audioRef.current) {
        audioRef.current = new Audio('/fah.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [outcome]);

  const handleCheck = () => {
    if (!value.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-7 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Hakikisha</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 leading-tight">
          Avoid hostel payment scams.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Before sending money, confirm whether a hostel, phone number or payment details have been verified by Rumia.
        </p>

        {/* Search mode tabs */}
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Search by</p>
          <div className="flex gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setSearchMode(m.key); setValue(''); setSubmitted(false); }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
                  searchMode === m.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input + Button */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
            {searchMode === 'phone' ? 'Enter phone number' : searchMode === 'hostel' ? 'Enter hostel name' : searchMode === 'paybill' ? 'Enter Paybill number' : 'Enter Till number'}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setSubmitted(false);
              }}
              placeholder={mode.placeholder}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-0 placeholder:text-slate-300 focus:border-slate-400 focus:ring-0"
              inputMode={mode.inputMode}
              spellCheck={false}
              autoComplete="off"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCheck();
              }}
            />
            <div className={cn(isFocused && 'hidden sm:block')}>
              <button
                type="button"
                onClick={handleCheck}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white min-h-[48px] transition-all hover:bg-slate-800 active:scale-[0.97] shadow-sm w-full sm:w-auto"
              >
                Verify Details
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fixed button above keyboard */}
      {isFocused && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg sm:hidden">
          <button
            type="button"
            onClick={handleCheck}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.97] shadow-sm"
          >
            Verify Details
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Results */}
      {outcome && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {outcome.state === 'verified' && outcome.verified && (
            <VerifiedResult data={outcome.verified} />
          )}
          {outcome.state === 'multiple' && outcome.multiple && (
            <MultipleResult data={outcome.multiple} />
          )}
          {outcome.state === 'mismatch' && outcome.mismatch && (
            <MismatchResult data={outcome.mismatch} />
          )}
          {outcome.state === 'not-found' && <NotFoundResult />}
        </div>
      )}

      {/* Trust indicators */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-slate-700">Verified by Rumia</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-slate-700">Takes less than 10 seconds</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-slate-700">Free to use</span>
          </div>
        </div>
      </div>

      {/* Browse link */}
      <Link
        href="/hostels"
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
      >
        Browse verified hostels
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function buildVerifiedData(
  record: OfficialDeKutRecord,
  contact: string,
  rumiaListings: ListingMatchCandidate[],
): VerifiedData {
  const onRumia = rumiaListings.some((listing) => {
    const phones = [
      listing.landlord_phone,
      listing.agent_phone,
      listing.agent_whatsapp,
    ].filter(Boolean) as string[];
    return record.contacts.some((rc) => phones.includes(rc));
  });

  const matchedListing = onRumia
    ? rumiaListings.find((listing) => {
        const phones = [
          listing.landlord_phone,
          listing.agent_phone,
          listing.agent_whatsapp,
        ].filter(Boolean) as string[];
        return record.contacts.some((rc) => phones.includes(rc));
      })
    : undefined;

  return {
    hostelName: record.hostel_name,
    officialContact: contact,
    officialPayment: record.payments[0],
    verifiedDate: '14 July 2026',
    onRumia,
    listingUrl: matchedListing
      ? matchedListing.slug
        ? `/hostels/${matchedListing.county || 'nyeri'}/${matchedListing.area || 'dekut'}/${matchedListing.slug}`
        : `/listing/${matchedListing.id}`
      : undefined,
  };
}

function buildListingVerifiedData(listing: ListingMatchCandidate): VerifiedData {
  const contact =
    listing.landlord_phone || listing.agent_phone || listing.agent_whatsapp || 'Verified Agent';
  const county = listing.county || 'nyeri';
  const area = listing.area || 'dekut';
  const slug = listing.slug;
  const listingUrl = slug
    ? `/hostels/${county}/${area}/${slug}`
    : `/listing/${listing.id}`;

  return {
    hostelName: listing.title,
    officialContact: contact,
    officialPayment: listing.mpesa_details || 'Verified on Rumia',
    verifiedDate: '14 July 2026',
    onRumia: true,
    listingUrl,
  };
}
