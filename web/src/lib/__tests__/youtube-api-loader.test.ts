/** @jest-environment jsdom */
describe('preloadYouTubeAPI', () => {
  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = '';
    delete (window as unknown as { YT?: unknown }).YT;
  });

  it('opens the connections and starts the script once, however often it is called', async () => {
    const { preloadYouTubeAPI } = await import('../youtube-api-loader');
    preloadYouTubeAPI();
    preloadYouTubeAPI();
    expect(document.querySelectorAll('link[rel="preconnect"]')).toHaveLength(2);
    expect(document.querySelectorAll('script[src*="youtube.com/iframe_api"]')).toHaveLength(1);
  });

  it('never throws when the script cannot be fetched', async () => {
    const { preloadYouTubeAPI } = await import('../youtube-api-loader');
    expect(() => preloadYouTubeAPI()).not.toThrow();
    (document.querySelector('script') as HTMLScriptElement).onerror?.(new Event('error'));
    await Promise.resolve();
  });

  it('lets a later Play press retry after a failure', async () => {
    const { loadYouTubeAPI, preloadYouTubeAPI } = await import('../youtube-api-loader');
    preloadYouTubeAPI();
    (document.querySelector('script') as HTMLScriptElement).onerror?.(new Event('error'));
    await Promise.resolve();
    (window as unknown as { YT: unknown }).YT = { Player: function Player() {} };
    await expect(loadYouTubeAPI()).resolves.toBeDefined();
  });
});
