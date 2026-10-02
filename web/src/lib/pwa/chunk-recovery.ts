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
    /^TypeError: \w+\[\w+\] is not a function$/.test(message.trim())
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
