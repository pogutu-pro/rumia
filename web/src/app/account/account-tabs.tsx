'use client';

import { LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type AccountTab = 'overview' | 'tours' | 'saved' | 'feedback' | 'settings' | 'agent-application';

const TABS: Array<{ id: 'overview' | 'settings'; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface AccountTabsProps {
  active: AccountTab;
  onChange: (tab: AccountTab) => void;
}

export function AccountTabs({ active, onChange }: AccountTabsProps) {
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-2 py-1" aria-label="Account tabs">
          {TABS.map((tab) => {
            const isActive = active === tab.id || (tab.id === 'overview' && active !== 'settings');
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors relative border-b-2 whitespace-nowrap',
                  isActive
                    ? 'text-slate-900 border-slate-900 font-semibold'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
