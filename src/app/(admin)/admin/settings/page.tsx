'use client';

import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your account preferences and notifications.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Notifications</h2>
          <p className="text-sm text-slate-500">
            Get alerted about new agents, bookings, and system events.
          </p>
        </div>
        <NotificationSettings />
      </div>

      <PushNotificationPrompt />
    </div>
  );
}
