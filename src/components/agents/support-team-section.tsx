import { Headset, ShieldCheck } from 'lucide-react';
import { SupportOwnerCard } from '@/components/agents/support-owner-card';
import { AgentCard } from '@/components/agents/agent-card';

interface SupportTeamAgent {
  id: string;
  name: string;
  slug?: string | null;
  profile_photo_url?: string | null;
  bio?: string | null;
  service_areas?: string[] | null;
  languages?: string[] | null;
  verified?: boolean | null;
  whatsapp: string;
  portfolio_url?: string | null;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  is_owner?: boolean | null;
  support_rank?: number | null;
  pochi_la_biashara_number?: string | null;
  expected_name?: string | null;
}

export interface SupportTeamSectionProps {
  agents: SupportTeamAgent[];
}

export function SupportTeamSection({ agents }: SupportTeamSectionProps) {
  if (agents.length === 0) return null;

  const owner = agents.find((a) => a.is_owner);
  const team = agents.filter((a) => !a.is_owner);

  return (
    <section className="mt-16 border-t border-[#1B1B18]/10 pt-10">
      <div className="flex items-center gap-2">
        <Headset className="h-5 w-5 text-[#1B1B18]/70" />
        <h2 className="text-lg font-bold text-[#1B1B18]">Talk to a Real Human</h2>
      </div>
      <p className="mt-1 text-sm text-[#1B1B18]/50">
        The Rumia team is here to help you verify before you pay. The platform owner is one WhatsApp message away,
        and a hand-picked support team is ready to assist.
      </p>

      {owner && (
        <div className="mt-6">
          <SupportOwnerCard agent={owner} />
        </div>
      )}

      {team.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1B1B18]/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            Customer Support Team
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {team.map((agent) => (
              <AgentCard key={agent.id} agent={agent} showBio />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
