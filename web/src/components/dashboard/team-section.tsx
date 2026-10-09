'use client';

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { rumia } from '@/lib/api/rumia';
import { useWorkspace } from './workspace';

/** Lets an organisation's owner add a colleague who already has a Rumia account (a caretaker, a co-owner). */
export function TeamSection() {
  const { ws, state } = useWorkspace();
  const owned = (ws?.orgs ?? []).filter((o) => o.role === 'owner');
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const activeOrg = orgId || owned[0]?.id || '';

  if (state !== 'ready' || owned.length === 0) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    const res = await rumia.POST('/api/v1/orgs/{org_id}/members', { params: { path: { org_id: activeOrg } }, body: { email: value, role } }).catch(() => null);
    setBusy(false);
    if (!res || res.error) {
      toast.error('Could not add them. They need a Rumia account with that email first.');
      return;
    }
    toast.success('Added to your team.');
    setEmail('');
  }

  return (
    <section aria-labelledby="team-heading" className="rounded-2xl border border-slate-200/60 bg-white p-4 sm:p-5">
      <h2 id="team-heading" className="text-sm font-bold text-slate-900">
        Team
      </h2>
      <p className="mt-1 text-xs text-slate-500">Add someone who helps you run your places. They must already have a Rumia account.</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        {owned.length > 1 && (
          <label className="text-xs text-slate-600">
            Organisation
            <select value={activeOrg} onChange={(e) => setOrgId(e.target.value)} className="mt-1 block h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              {owned.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-[12rem] flex-1 text-xs text-slate-600">
          Their email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm">
            <option value="manager">Manager</option>
            <option value="agent">Agent</option>
          </select>
        </label>
        <button type="submit" disabled={busy || !email.trim()} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          Add
        </button>
      </form>
    </section>
  );
}
