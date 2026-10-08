/** Pure helpers for the contact flow (kept apart from the component so they can be tested). */

const PENDING_KEY = 'rumia_followups';
const WINDOW_MS = 30 * 60 * 1000; // ask "did they reply?" only within 30 minutes of the contact

export interface PendingFollowUp {
  ref: string;
  name: string;
  at: number;
}

/** Digits-only international number for wa.me; accepts 07…, 7…, +254… forms. */
export function waNumber(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

/** Used only when logging the contact failed: still get the person to the owner, without a reference code. */
export function fallbackWhatsAppUrl(phone: string | null | undefined, title: string): string | null {
  const number = waNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hi, I found *${title}* on Rumia. Is it still available?`)}`;
}

export function rememberFollowUp(entry: PendingFollowUp, store: Storage = window.localStorage): void {
  try {
    const list: PendingFollowUp[] = JSON.parse(store.getItem(PENDING_KEY) || '[]');
    list.push(entry);
    store.setItem(PENDING_KEY, JSON.stringify(list.slice(-5)));
  } catch {
    // storage unavailable: the prompt is a nicety, skip it
  }
}

export function dueFollowUp(now: number = Date.now(), store: Storage = window.localStorage): PendingFollowUp | null {
  try {
    const list: PendingFollowUp[] = JSON.parse(store.getItem(PENDING_KEY) || '[]');
    const fresh = list.filter((e) => now - e.at <= WINDOW_MS);
    if (fresh.length !== list.length) store.setItem(PENDING_KEY, JSON.stringify(fresh));
    return fresh.length ? fresh[fresh.length - 1] : null;
  } catch {
    return null;
  }
}

export function clearFollowUp(ref: string, store: Storage = window.localStorage): void {
  try {
    const list: PendingFollowUp[] = JSON.parse(store.getItem(PENDING_KEY) || '[]');
    store.setItem(PENDING_KEY, JSON.stringify(list.filter((e) => e.ref !== ref)));
  } catch {
    // ignore
  }
}
