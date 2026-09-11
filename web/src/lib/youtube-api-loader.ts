/**
 * youtube-api-loader.ts
 *
 * Singleton loader for the YouTube IFrame Player API.
 * Ensures the <script> tag is injected exactly once and returns
 * a cached Promise<typeof YT> that resolves when the API is ready.
 *
 * Usage:
 *   const YT = await loadYouTubeAPI();
 *   const player = new YT.Player(divRef, { ... });
 */

let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeAPI(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve) => {
    // If the API is already loaded (e.g. by another script), resolve immediately
    if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    // Queue our callback — YT API calls window.onYouTubeIframeAPIReady
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };

    // Inject the script tag once
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}
