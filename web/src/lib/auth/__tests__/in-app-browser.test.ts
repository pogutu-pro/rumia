import { chromeIntentUrl, detectInAppBrowser } from '../in-app-browser';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_ANDROID = `${ANDROID_WEBVIEW} Instagram 330.0.0.40.108 Android`;
const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IOS_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('detectInAppBrowser', () => {
  it('does not flag real browsers', () => {
    expect(detectInAppBrowser(CHROME_ANDROID).isInApp).toBe(false);
    expect(detectInAppBrowser(SAFARI_IOS).isInApp).toBe(false);
    expect(detectInAppBrowser('').isInApp).toBe(false);
  });

  it('names apps that identify themselves', () => {
    expect(detectInAppBrowser(INSTAGRAM_ANDROID)).toMatchObject({ isInApp: true, app: 'Instagram', platform: 'android' });
    expect(detectInAppBrowser(FACEBOOK_IOS)).toMatchObject({ isInApp: true, app: 'Facebook', platform: 'ios' });
  });

  it('flags anonymous Android and iOS webviews (such as the WhatsApp browser)', () => {
    expect(detectInAppBrowser(ANDROID_WEBVIEW)).toMatchObject({ isInApp: true, app: null, platform: 'android' });
    expect(detectInAppBrowser(IOS_WEBVIEW)).toMatchObject({ isInApp: true, app: null, platform: 'ios' });
  });
});

describe('chromeIntentUrl', () => {
  it('builds an Android intent that reopens the same page in Chrome', () => {
    expect(chromeIntentUrl('https://rumia.co.ke/auth/login?next=%2Fsaved')).toBe(
      'intent://rumia.co.ke/auth/login?next=%2Fsaved#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});
