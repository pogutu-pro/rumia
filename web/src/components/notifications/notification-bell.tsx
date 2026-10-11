'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Poll only the unread count while closed; the list is fetched when opened. Polling pauses while the tab is hidden.
  // A failed poll keeps the last known count rather than showing a made-up one.
  const refreshCount = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadNotificationsCountAction());
    } catch {
      /* keep the previous count */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoadError(false);
    try {
      const [count, items] = await Promise.all([
        getUnreadNotificationsCountAction(),
        getMyNotificationsAction(10),
      ]);
      setUnreadCount(count);
      setNotifications(items);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshCount(), 0);
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      if (openRef.current) void refreshAll();
      else void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refreshCount, refreshAll]);

  // Outside click and Escape close the panel; Escape returns focus to the bell.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    }
  };

  const handleItemClick = async (notification: AppNotification) => {
    if (!notification.read) {
      // Reconcile with the server: undo the local change if marking as read fails.
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      const res = await markNotificationReadAction(notification.id).catch(() => null);
      if (!res || res.success === false) void refreshAll();
    }
    setOpen(false);
    if (notification.url) router.push(notification.url);
  };

  const handleMarkAll = async () => {
    const res = await markNotificationReadAction().catch(() => null);
    if (!res || res.success === false) {
      setLoadError(true);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-[calc(var(--shell-header-h)+0.5rem)] z-50 overflow-hidden rounded-2xl border border-line bg-raised shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div className="flex items-center justify-center py-8" role="status">
                <Loader2 className="h-5 w-5 animate-spin text-ink-muted" aria-label="Loading notifications" />
              </div>
            ) : loadError ? (
              <div role="alert" className="space-y-2 px-4 py-8 text-center">
                <p className="text-sm text-ink">We couldn&apos;t load your notifications.</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    void refreshAll().finally(() => setLoading(false));
                  }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="space-y-1.5 py-10 text-center">
                <Inbox className="mx-auto h-6 w-6 text-ink-muted" aria-hidden />
                <p className="text-sm text-ink-muted">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void handleItemClick(notification)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                        !notification.read && 'bg-primary/5',
                      )}
                    >
                      <span className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-primary')}
                        />
                        <span className="min-w-0 flex-1">
                          {!notification.read && <span className="sr-only">Unread: </span>}
                          <span className="block text-sm font-semibold text-ink">{notification.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-muted">{notification.body}</span>
                          <span className="mt-1 block text-[11px] text-ink-muted">
                            {formatDate(notification.created_at, 'd MMM HH:mm')}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
