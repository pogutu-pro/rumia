'use client';

import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';
import { AgentProfileForm } from './agent-profile-form';

interface AgentProfileClientProps {
  agent: Record<string, any>;
}

export function AgentProfileClient({ agent }: AgentProfileClientProps) {
  return (
    <>
      <AgentProfileForm agent={agent} />

      <div className="mt-10 pt-8 border-t border-slate-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Notifications</h2>
          <p className="text-sm text-slate-500">
            Get alerted when students send inquiries or book tours.
          </p>
        </div>
        <NotificationSettings />
      </div>

      <PushNotificationPrompt />
    </>
  );
}
