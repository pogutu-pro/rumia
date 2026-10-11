/**
 * youtube-api-loader.ts
 *
 * Singleton loader for the YouTube IFrame Player API.
 * Ensures the <script> tag is injected exactly once and returns
 * a cached Promise<typeof YT> that resolves when the API is ready.
 *
 * If the script fails or never becomes ready within the timeout, the
 * promise rejects and the cache is cleared so a later call can retry
 * (e.g. after the user gestures). Consumers can then fall back to a
 * plain iframe instead of hanging on a black screen.
 *
 * Usage:
 *   const YT = await loadYouTubeAPI();
 *   const player = new YT.Player(divRef, { ... });
 */

const API_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
// Generous: on a slow mobile connection the loader can legitimately take this long. The player shows a
// "still loading" hint well before this and falls back to a plain embed when it is reached.
const API_TIMEOUT_MS = 20000;

let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeAPI(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    // If the API is already loaded (e.g. by another script), resolve immediately
    if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error('YouTube IFrame API load timed out'));
    }, API_TIMEOUT_MS);

    // Queue our callback — YT API calls window.onYouTubeIframeAPIReady
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      prev?.();
      resolve(window.YT);
    };

    // Inject the script tag once
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = API_SCRIPT_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('Failed to load YouTube IFrame API script'));
      };
      document.head.appendChild(script);
    }
  }).catch((err: unknown) => {
    apiPromise = null;
    throw err;
  });

  return apiPromise;
}

/**
 * Start fetching the player API ahead of the press on Play, and open the connections it will need.
 * Safe to call any number of times; failure is silent here and surfaces (with a fallback) when Play is pressed.
 */
export function preloadYouTubeAPI(): void {
  if (typeof document === 'undefined') return;
  for (const href of ['https://www.youtube.com', 'https://i.ytimg.com']) {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    document.head.appendChild(link);
  }
  loadYouTubeAPI().catch(() => {
    /* reported when the person presses Play */
  });
}
