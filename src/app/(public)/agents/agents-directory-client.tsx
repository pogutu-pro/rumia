'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { AgentCard } from '@/components/agents/agent-card';
import { HakisaChecker } from '@/components/agents/hakisa-checker';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils/cn';

const SERVICE_AREA_OPTIONS = [
  'Near Gate A', 'Near Gate B', 'Nyeri View', 'Kahawa Ridge',
  'Embassy Area', 'Nyaribo', 'Boma',
];

const LANGUAGE_OPTIONS = [
  'English', 'Kiswahili', 'Kikuyu', 'Luo', 'Kalenjin',
];

interface FilterContentProps {
  search: string;
  onSearchChange: (value: string) => void;
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (value: boolean) => void;
  sortOrder: 'name';
  onSortOrderChange: (value: 'name') => void;
  selectedAreas: string[];
  onAreasChange: (value: string[]) => void;
  selectedLanguages: string[];
  onLanguagesChange: (value: string[]) => void;
  onClear: () => void;
  mobile?: boolean;
  onMobileClose?: () => void;
}

function FilterContent({
  search,
  onSearchChange,
  verifiedOnly,
  onVerifiedOnlyChange,
  sortOrder,
  onSortOrderChange,
  selectedAreas,
  onAreasChange,
  selectedLanguages,
  onLanguagesChange,
  onClear,
  mobile,
  onMobileClose,
}: FilterContentProps) {
  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const handleClear = () => {
    onClear();
    if (mobile && onMobileClose) onMobileClose();
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-bold text-slate-700 mb-2 block">Search</label>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Name or area..."
          className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-emerald-400 focus:outline-none transition-colors"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(e) => onVerifiedOnlyChange(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm font-bold text-slate-700">Verified agents only</span>
      </label>

      <div>
        <label className="text-sm font-bold text-slate-700 mb-2 block">Sort by</label>
        <select
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value as 'name')}
          className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-emerald-400 focus:outline-none transition-colors bg-white"
        >
          <option value="name">Alphabetical</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 mb-2">Service Area</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREA_OPTIONS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => onAreasChange(toggleArray(selectedAreas, area))}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all',
                selectedAreas.includes(area)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
              )}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700 mb-2">Language</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onLanguagesChange(toggleArray(selectedLanguages, lang))}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all',
                selectedLanguages.includes(lang)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {(selectedAreas.length > 0 || selectedLanguages.length > 0 || verifiedOnly || search) && (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

interface AgentsDirectoryClientProps {
  agents: Record<string, any>[];
}

export function AgentsDirectoryClient({ agents }: AgentsDirectoryClientProps) {
  const [search, setSearch] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'name'>('name');
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = [...agents];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.service_areas?.some((s: string) => s.toLowerCase().includes(q)),
      );
    }

    if (selectedAreas.length > 0) {
      result = result.filter((a) =>
        selectedAreas.some((area) => (a.service_areas || []).includes(area)),
      );
    }

    if (selectedLanguages.length > 0) {
      result = result.filter((a) =>
        selectedLanguages.some((lang) => (a.languages || []).includes(lang)),
      );
    }

    if (verifiedOnly) {
      result = result.filter((a) => a.verified);
    }

    if (sortOrder === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    const featured = result.filter((a) => a.is_featured);
    const rest = result.filter((a) => !a.is_featured);
    result = [...featured, ...rest];

    return result;
  }, [agents, search, selectedAreas, selectedLanguages, verifiedOnly, sortOrder]);

  const clearFilters = () => {
    setSelectedAreas([]);
    setSelectedLanguages([]);
    setVerifiedOnly(false);
    setSearch('');
  };

  const filterProps: FilterContentProps = {
    search,
    onSearchChange: setSearch,
    verifiedOnly,
    onVerifiedOnlyChange: setVerifiedOnly,
    sortOrder,
    onSortOrderChange: setSortOrder,
    selectedAreas,
    onAreasChange: setSelectedAreas,
    selectedLanguages,
    onLanguagesChange: setSelectedLanguages,
    onClear: clearFilters,
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/hostels"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to listings
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Hostel Agents
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {filtered.length} agent{filtered.length !== 1 ? 's' : ''} helping students find home near DeKUT
            </p>
          </div>

          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden gap-2 h-10"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {(selectedAreas.length > 0 || selectedLanguages.length > 0 || verifiedOnly) && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    {selectedAreas.length + selectedLanguages.length + (verifiedOnly ? 1 : 0)}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterContent {...filterProps} mobile onMobileClose={() => setFilterOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <FilterContent {...filterProps} />
              </div>
              <HakisaChecker />
            </div>
          </aside>

          <div className="flex-1">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((agent: any) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    showBio={true}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-lg font-bold text-slate-700">No agents match your filters</p>
                <p className="text-sm text-slate-400 mt-1">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Clear all filters
                </button>
              </div>
            )}

            <div className="mt-8 lg:hidden">
              <HakisaChecker />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
