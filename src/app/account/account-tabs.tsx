'use client';

import { CalendarCheck, Heart, MessageSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type AccountTab = 'tours' | 'saved' | 'feedback' | 'settings';

const TABS: Array<{ id: AccountTab; label: string; icon: typeof CalendarCheck }> = [
  { id: 'tours', label: 'Tours', icon: CalendarCheck },
  { id: 'saved', label: 'Saved', icon: Heart },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface AccountTabsProps {
  active: AccountTab;
  onChange: (tab: AccountTab) => void;
  tourCount?: number;
  savedCount?: number;
}

export function AccountTabs({ active, onChange, tourCount, savedCount }: AccountTabsProps) {
  return (
    <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            let count: number | undefined;
            if (tab.id === 'tours') count = tourCount;
            if (tab.id === 'saved') count = savedCount;

            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold transition-colors relative',
                  isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {count != null && count > 0 && (
                  <span className="ml-0.5 text-[10px] font-bold text-slate-400">
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-slate-900 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
