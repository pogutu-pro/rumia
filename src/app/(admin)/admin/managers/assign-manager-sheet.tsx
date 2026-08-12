'use client';

import { useState, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { searchAgentsToPromoteAction, assignManagerRoleAction } from '@/app/actions/staff';
import { adminRevalidateManagersAction } from '@/app/actions/admin-managers';
import { toast } from 'sonner';

interface AssignManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campuses: any[];
  regions: any[];
  initialManager?: any;
}

interface AgentCandidate {
  id: string;
  email: string;
  full_name: string;
  campus_name: string;
}

export default function AssignManagerSheet({
  open,
  onOpenChange,
  campuses,
  regions,
  initialManager,
}: AssignManagerSheetProps) {
  const [query, setQuery] = useState(initialManager?.email || '');
  const [results, setResults] = useState<AgentCandidate[]>([]);
  const [selected, setSelected] = useState<AgentCandidate | null>(initialManager || null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [isPending, startTransition] = useTransition();

  const [scope, setScope] = useState<'campus' | 'region'>(
    initialManager?.managed_region_id ? 'region' : 'campus'
  );
  const [campusId, setCampusId] = useState(initialManager?.managed_campus_id || '');
  const [regionId, setRegionId] = useState(initialManager?.managed_region_id || '');

  const [error, setError] = useState('');

  // Managers are promoted from the existing agent pool — never arbitrary users.
  const handleSearch = () => {
    if (query.trim().length < 2) {
      setError('Type at least 2 characters to search agents');
      return;
    }
    setError('');
    setHasSearched(false);
    startSearch(async () => {
      const res = await searchAgentsToPromoteAction(query);
      if (res.success) {
        setResults(res.data || []);
        setHasSearched(true);
      } else {
        setError(res.error);
      }
    });
  };

  const handleChoose = (candidate: AgentCandidate) => {
    setSelected(candidate);
    setResults([]);
    setHasSearched(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError('Please search and select an agent to promote');
      return;
    }
    if (scope === 'campus' && !campusId) {
      setError('Please select a campus');
      return;
    }
    if (scope === 'region' && !regionId) {
      setError('Please select a region');
      return;
    }

    setError('');
    startTransition(async () => {
      const res = await assignManagerRoleAction(selected.id, {
        role: 'manager',
        managed_campus_id: scope === 'campus' ? campusId : null,
        managed_region_id: scope === 'region' ? regionId : null,
      });

      if (res.success) {
        await adminRevalidateManagersAction();
        toast.success(
          selected && initialManager
            ? `${selected.full_name} reassigned as manager`
            : `${selected?.full_name || 'User'} promoted to manager`
        );
        onOpenChange(false);
      } else {
        setError(res.error || 'Failed to assign manager');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader className="mb-6">
          <SheetTitle>{initialManager ? 'Reassign Manager' : 'Promote Agent to Manager'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!initialManager && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-search" className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Search Existing Agents
              </Label>
              <div className="flex gap-2">
                <Input
                  id="agent-search"
                  type="text"
                  placeholder="Agent name or email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isSearching}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="shrink-0"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Promotion is available to the existing agent pool only.
              </p>

              {hasSearched && (
                <div className="mt-1 rounded-xl border border-slate-200 overflow-hidden">
                  {results.length === 0 ? (
                    <p className="text-sm text-slate-500 p-4 text-center">No agents match your search</p>
                  ) : (
                    results.map((candidate) => (
                      <button
                        type="button"
                        key={candidate.id}
                        onClick={() => handleChoose(candidate)}
                        className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <span className="mt-0.5 text-emerald-600"><UserCheck className="w-4 h-4" /></span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{candidate.full_name}</span>
                          <span className="block text-xs text-slate-500">{candidate.email}</span>
                          <span className="block text-xs text-slate-400 mt-0.5">{candidate.campus_name}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="font-semibold text-slate-900 text-sm">{selected.full_name}</div>
              <div className="text-xs text-slate-500">{selected.email}</div>
            </div>
          )}

          {selected && (
            <>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-900">Scope</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="campus"
                      checked={scope === 'campus'}
                      onChange={() => setScope('campus')}
                      className="text-slate-900 focus:ring-slate-900 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-slate-700">Campus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="region"
                      checked={scope === 'region'}
                      onChange={() => setScope('region')}
                      className="text-slate-900 focus:ring-slate-900 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-slate-700">Region</span>
                  </label>
                </div>
              </div>

              {scope === 'campus' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manager-campus" className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Select Campus
                  </Label>
                  <select
                    id="manager-campus"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 w-full bg-white"
                  >
                    <option value="">-- Choose Campus --</option>
                    {campuses.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'region' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manager-region" className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Select Region
                  </Label>
                  <select
                    id="manager-region"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 w-full bg-white"
                  >
                    <option value="">-- Choose Region --</option>
                    {regions.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {!selected && initialManager && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Reassign the existing manager below to a new scope.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selected}>
              {isPending ? 'Saving...' : 'Save Assignment'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}