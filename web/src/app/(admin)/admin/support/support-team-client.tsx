'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Crown, ShieldCheck, Sparkles, Users, Eye, ArrowDown, ArrowUp } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { updateAgentSupportAction } from '@/app/actions/admin';
import { cn } from '@/lib/utils/cn';

interface SupportAgent {
  id: string;
  name: string;
  profile_photo_url?: string | null;
  bio?: string | null;
  verified: boolean;
  whatsapp: string;
  phone: string;
  slug?: string | null;
  status: string;
  is_featured: boolean;
  is_founder: boolean;
  is_support: boolean;
  support_rank: number;
  is_owner: boolean;
}

interface SupportTeamClientProps {
  agents: SupportAgent[];
}

type PendingKey = string;

export function SupportTeamClient({ agents }: SupportTeamClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingKey | null>(null);

  const sorted = [...agents].sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    return (a.support_rank ?? 0) - (b.support_rank ?? 0);
  });

  const supportAgents = sorted.filter((a) => a.is_support);
  const unsupported = sorted.filter((a) => !a.is_support);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setPending(key);
    const result = await fn();
    setPending(null);
    if (result.success) {
      toast.success('Support team updated');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Something went wrong');
    }
  }

  function toggleSupport(agent: SupportAgent) {
    run(`support:${agent.id}`, () =>
      updateAgentSupportAction(agent.id, { is_support: !agent.is_support }),
    );
  }

  function setOwner(agent: SupportAgent) {
    if (agent.is_owner) return;
    run(`owner:${agent.id}`, () => updateAgentSupportAction(agent.id, { is_owner: true }));
  }

  function shiftRank(agent: SupportAgent, dir: -1 | 1) {
    const nextRank = (agent.support_rank ?? 0) + dir;
    if (nextRank < 0) return;
    run(`rank:${agent.id}`, () =>
      updateAgentSupportAction(agent.id, { support_rank: nextRank }),
    );
  }

  const badge = (agent: SupportAgent) =>
    agent.is_featured ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
        <ShieldCheck className="h-2.5 w-2.5" /> Official
      </span>
    ) : agent.is_founder ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-[9px] font-bold uppercase tracking-wider">
        <Sparkles className="h-2.5 w-2.5" /> Founder
      </span>
    ) : agent.verified ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
        <ShieldCheck className="h-2.5 w-2.5" /> Verified
      </span>
    ) : null;

  const AgentRow = ({ agent, owner = false }: { agent: SupportAgent; owner?: boolean }) => (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all',
        owner
          ? 'bg-gradient-to-br from-amber-50 via-white to-emerald-50/40 border-amber-200 shadow-[0_2px_12px_-2px_rgba(251,191,36,0.25)]'
          : agent.is_support
            ? 'bg-white border-emerald-200/70 shadow-sm'
            : 'bg-white border-slate-200/80 shadow-sm',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative shrink-0">
          <UserAvatar name={agent.name} imageUrl={agent.profile_photo_url} size="lg" />
          {owner && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 ring-2 ring-white">
              <Crown className="h-3.5 w-3.5 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{agent.name}</span>
            {badge(agent)}
            {owner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider">
                <Crown className="h-2.5 w-2.5" /> Main Support
              </span>
            )}
            {agent.is_support && !owner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">
                On Hakikisha
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {agent.whatsapp || agent.phone}
            {agent.is_support && (
              <span className="ml-2 text-emerald-600 font-semibold">Rank {agent.support_rank}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:justify-end">
        {agent.is_support && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRank(agent, -1)}
              disabled={pending !== null || agent.support_rank === 0}
              aria-label="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRank(agent, 1)}
              disabled={pending !== null}
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          variant={owner ? 'secondary' : 'default'}
          size="sm"
          onClick={() => setOwner(agent)}
          disabled={pending !== null || owner}
        >
          {owner ? 'Platform Owner' : 'Make Main Support'}
        </Button>
        <Button
          variant={agent.is_support ? 'destructive' : 'default'}
          size="sm"
          onClick={() => toggleSupport(agent)}
          disabled={pending !== null}
        >
          {agent.is_support ? 'Remove from page' : 'Show on Hakikisha'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Customer Support Team</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose which agents appear on the Hakikisha page, set their rank, and pick the platform owner
          (main support). The owner gets a unique hero card at the top — no verification required.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Live preview on /verify</h2>
            <p className="text-xs text-slate-500">
              {supportAgents.length} support agent{supportAgents.length !== 1 ? 's' : ''} shown
              {sorted.some((a) => a.is_owner) ? ' — platform owner pinned at top' : ''}.
            </p>
          </div>
        </div>

        {supportAgents.length === 0 ? (
          <div className="text-center py-10">
            <Users className="h-10 w-10 mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No agents on the Hakikisha page yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Use “Show on Hakikisha” below to build your customer-support team.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {supportAgents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} owner={agent.is_owner} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">All agents</h2>
            <p className="text-xs text-slate-500">
              Pick from {unsupported.length} agent{unsupported.length !== 1 ? 's' : ''} not yet on the page.
            </p>
          </div>
        </div>

        {unsupported.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">All agents are on the Hakikisha page.</p>
        ) : (
          <div className="space-y-3">
            {unsupported.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 text-xs text-slate-500">
        <Eye className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Changes apply instantly on the public Hakikisha page. The platform owner card shows regardless of
          verification status, boosting trust for students.
        </p>
      </div>
    </div>
  );
}
