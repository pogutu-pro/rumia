'use client';

import { useCallback, useEffect, useState } from 'react';
import { rumia } from '@/lib/api/rumia';

export interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
}

export interface WorkspaceProperty {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  status: string;
  last_confirmed_at: string | null;
  contacts_7d: number;
  awaiting_reply: number;
}

export interface Attention {
  property_id: string;
  slug: string;
  name: string;
  kind: 'confirm_availability' | 'resume' | 'finish_draft' | 'reply' | string;
  text: string;
}

export interface Workspace {
  orgs: WorkspaceOrg[];
  properties: WorkspaceProperty[];
  attention: Attention[];
}

/** What the lister's organisations and places need today. Reloads after any change they make. */
export function useWorkspace() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await rumia.GET('/api/v1/me/workspace').catch(() => null);
      if (!active) return;
      if (!res?.data) {
        setState('error');
        return;
      }
      setWs(res.data as unknown as Workspace);
      setState('ready');
    })();
    return () => {
      active = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ws, state, reload };
}

/** "Confirmed 3 days ago", or a plain prompt when it never was. */
export function confirmedText(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Not confirmed yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Not confirmed yet';
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 60) return mins <= 1 ? 'Confirmed just now' : `Confirmed ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Confirmed ${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `Confirmed ${days} day${days === 1 ? '' : 's'} ago`;
}

export async function confirmAvailable(propertyId: string): Promise<boolean> {
  const res = await rumia.POST('/api/v1/properties/{property_id}/confirm', { params: { path: { property_id: propertyId } } }).catch(() => null);
  return !!res && !res.error;
}
