export interface InAppBrowserInfo {
  isInApp: boolean;
  /** Friendly app name when we can tell (for the message), else null. */
  app: string | null;
  platform: 'android' | 'ios' | 'other';
}

/**
 * Google refuses OAuth sign-in inside embedded webviews (error 403 disallowed_useragent), which is
 * where links opened from WhatsApp, Instagram, Facebook or TikTok land. This is a best-effort
 * User-Agent check; a false positive only shows a notice, it never blocks sign-in.
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserInfo {
  const ua = userAgent || '';
  const platform: InAppBrowserInfo['platform'] = /android/i.test(ua)
    ? 'android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'ios'
      : 'other';

  const named: Array<[RegExp, string]> = [
    [/Instagram/i, 'Instagram'],
    [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
    [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
    [/Snapchat/i, 'Snapchat'],
    [/LinkedInApp/i, 'LinkedIn'],
    [/Twitter/i, 'X'],
    [/Line\//i, 'LINE'],
    [/WhatsApp/i, 'WhatsApp'],
  ];
  for (const [pattern, app] of named) {
    if (pattern.test(ua)) return { isInApp: true, app, platform };
  }

  // Android WebView: Chrome engine with the "wv" marker.
  if (platform === 'android' && /;\s*wv\)/.test(ua)) return { isInApp: true, app: null, platform };
  // iOS WebView: WebKit engine without the Safari token (real Safari and Chrome iOS include it).
  if (platform === 'ios' && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) {
    return { isInApp: true, app: null, platform };
  }
  return { isInApp: false, app: null, platform };
}

/** Android intent link that asks Chrome to open this exact page. */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  const path = `${url.host}${url.pathname}${url.search}`;
  return `intent://${path}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
}
