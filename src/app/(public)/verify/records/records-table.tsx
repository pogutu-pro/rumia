'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, CreditCard, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface OfficialRecord {
  hostel_name: string;
  zone?: string;
  contacts?: string;
  payments?: string;
}

interface OfficialRecordsTableProps {
  records: OfficialRecord[];
}

const ZONE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  MAIN: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'NYERI VIEW': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  EMBASSY: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  NYARIBO: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  KENYATTA: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
};

function getZoneStyle(zone?: string) {
  const key = (zone || '').toUpperCase();
  return ZONE_COLORS[key] ?? { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
}

function maskContact(contacts?: string): string {
  if (!contacts) return '—';
  // Show first 4 digits of each number, mask the rest
  return contacts.replace(/(\d{4})(\d+)/g, (_, a, b) => `${a}${'•'.repeat(Math.min(b.length, 6))}`);
}

export function OfficialRecordsTable({ records }: OfficialRecordsTableProps) {
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allZones = useMemo(() => {
    const z = new Set<string>();
    records.forEach((r) => { if (r.zone) z.add(r.zone.toUpperCase()); });
    return Array.from(z).sort();
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records.filter((r) => {
      const matchesSearch =
        !q ||
        r.hostel_name.toLowerCase().includes(q) ||
        (r.payments || '').toLowerCase().includes(q) ||
        (r.zone || '').toLowerCase().includes(q);
      const matchesZone =
        zoneFilter === 'ALL' || (r.zone || '').toUpperCase() === zoneFilter;
      return matchesSearch && matchesZone;
    });
  }, [records, search, zoneFilter]);

  return (
    <section id="records" className="scroll-mt-20">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#1B1B18]">
            All official records
          </h2>
          <p className="mt-0.5 text-sm text-[#1B1B18]/50">
            Showing {filtered.length} of {records.length} hostels
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostel or payment…"
            className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-400">
            /
          </kbd>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 sm:right-9"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Zone filter */}
      <div className="mt-4 flex gap-1.5 flex-wrap">
        <button
          onClick={() => setZoneFilter('ALL')}
          className={cn(
            'rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
            zoneFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
          )}
        >
          All zones
        </button>
        {allZones.map((z) => {
          const style = getZoneStyle(z);
          return (
            <button
              key={z}
              onClick={() => setZoneFilter(z)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
                zoneFilter === z
                  ? 'bg-slate-900 text-white shadow-sm'
                  : `${style.bg} ${style.text} hover:opacity-80`,
              )}
            >
              {z}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      {search && (
        <p className="text-xs text-slate-400 mt-4 mb-3 font-medium">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{search}&quot;
        </p>
      )}

      {/* Table — desktop */}
      <div className="hidden sm:block mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Hostel Name
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide w-32">
                  Zone
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide w-36">
                  Contact
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Payment Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="mx-auto w-fit rounded-2xl bg-slate-50 p-4">
                      <Search className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-600 text-sm">
                      No records match your search
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Try a different hostel name, zone, or payment number.
                    </p>
                    <button
                      onClick={() => { setSearch(''); setZoneFilter('ALL'); }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear filters
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((record, i) => {
                  const style = getZoneStyle(record.zone);
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {record.hostel_name}
                      </td>
                      <td className="py-3 px-4">
                        {record.zone ? (
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', style.bg, style.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                            {record.zone}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {maskContact(record.contacts)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {record.payments || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden mt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
            <Search className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-600 text-sm">
              No records match your search
            </p>
            <button
              onClick={() => { setSearch(''); setZoneFilter('ALL'); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((record, i) => {
            const style = getZoneStyle(record.zone);
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-800 text-sm leading-snug">
                    {record.hostel_name}
                  </p>
                  {record.zone && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0', style.bg, style.text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                      {record.zone}
                    </span>
                  )}
                </div>
                {record.contacts && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="font-mono">{maskContact(record.contacts)}</span>
                  </div>
                )}
                {record.payments && (
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <CreditCard className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{record.payments}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
        <p>
          Contact numbers are partially masked for privacy. If a number you were given does not appear here,{' '}
          <Link href="/verify" className="font-semibold text-slate-700 hover:underline">
            use the checker
          </Link>{' '}
          to verify. Data sourced from{' '}
          <strong className="text-slate-700">DeKUT Official Student Housing List</strong>, July 2026.
        </p>
      </div>
    </section>
  );
}
