const RELOAD_KEY = 'rumia:chunk:reloaded';
const RELOAD_WINDOW_MS = 60_000;

/**
 * A deploy replaces every hashed chunk. A tab (or cached page) from the previous build then asks
 * for files that 404 and webpack crashes ("l[e] is not a function", ChunkLoadError, "Loading
 * chunk N failed"). One hard reload fetches the new HTML and the matching chunks.
 */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return (
    /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(message) ||
    /\b\w{1,2}\[\w{1,2}\] is not a function$/.test(message.trim())
  );
}

/** Reloads at most once per minute so a genuinely broken build cannot cause a reload loop. */
export function reloadOnceForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** The chunk URL a webpack/Next "Loading chunk … failed" error names, when it names one. */
export function chunkUrlFrom(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const match = message.match(/https?:\/\/[^\s)'"]+\/_next\/static\/[^\s)'"]+/) ?? message.match(/\/_next\/static\/[^\s)'"]+/);
  return match ? match[0] : null;
}

/**
 * Is this file really gone (a deploy replaced the build), rather than a load that failed on a flaky connection?
 * Only a definite 404/410 counts; a network error or any other answer means "leave the page alone".
 */
export async function isGoneFromServer(url: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetcher(url, { method: 'HEAD', cache: 'no-store' });
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

/**
 * Reload for a new build only when one has actually happened. Weak mobile connections drop script and font loads
 * all the time; treating each drop as a deploy reloaded the page under people mid-scroll.
 */
export async function reloadIfBuildChanged(error: unknown, url: string | null = chunkUrlFrom(error)): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (url) return (await isGoneFromServer(url)) && reloadOnceForNewBuild();
  // No file to check: only the error shapes a stale build produces (a renamed export) are trusted on their own.
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /\b\w{1,2}\[\w{1,2}\] is not a function$/.test(message.trim()) && reloadOnceForNewBuild();
}
