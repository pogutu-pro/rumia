'use client';

import { AgentCard } from '@/components/agents/agent-card';

interface AgentGridProps {
  agents: Record<string, any>[];
}

export function AgentGrid({ agents }: AgentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {agents.map((agent: any) => (
        <AgentCard key={agent.id} agent={agent} showBio />
      ))}
    </div>
  );
}
