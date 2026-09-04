'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Inbox, Loader2 } from 'lucide-react';
import {
  getMyNotificationsAction,
  getUnreadNotificationsCountAction,
  markNotificationReadAction,
} from '@/app/actions/notifications';
import type { AppNotification } from '@/types';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

interface NotificationBellProps {
  initialCount?: number;
}

const POLL_INTERVAL_MS = 60000;

export function NotificationBell({ initialCount = 0 }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Poll only the unread badge count while the dropdown is closed. The full
  // list is fetched lazily when the user opens it, and polling is paused while
  // the tab is hidden. This keeps background churn to one light server action.
  const refreshCount = useCallback(async () => {
    const count = await getUnreadNotificationsCountAction();
    setUnreadCount(count);
  }, []);

  const refreshAll = useCallback(async () => {
    const [count, items] = await Promise.all([
      getUnreadNotificationsCountAction(),
      getMyNotificationsAction(10),
    ]);
    setUnreadCount(count);
    setNotifications(items);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refreshCount();
    }, 0);
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      if (openRef.current) {
        void refreshAll();
      } else {
        void refreshCount();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refreshCount, refreshAll]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    }
  };

  const handleItemClick = async (notification: AppNotification) => {
    if (!notification.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
      await markNotificationReadAction(notification.id);
    }
    setOpen(false);
    if (notification.url) {
      router.push(notification.url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200/80 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {unreadCount > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {unreadCount} unread
              </span>
            ) : (
              <Bell className="h-4 w-4 text-slate-300" />
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center space-y-1.5">
                <Inbox className="h-6 w-6 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleItemClick(notification)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0',
                    !notification.is_read && 'bg-amber-50/40',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full mt-1.5 shrink-0',
                        notification.is_read ? 'bg-transparent' : 'bg-amber-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">
                        {notification.title}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatDate(notification.created_at, 'd MMM HH:mm')}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}