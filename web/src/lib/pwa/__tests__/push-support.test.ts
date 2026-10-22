/** @jest-environment jsdom */
import { pushSupported } from '../push-support';

describe('pushSupported', () => {
  const original = { Notification: (window as any).Notification, PushManager: (window as any).PushManager };

  afterEach(() => {
    (window as any).Notification = original.Notification;
    (window as any).PushManager = original.PushManager;
  });

  it('is false on iPhone Safari, which has no Notification global outside the home-screen app', () => {
    delete (window as any).Notification;
    expect(pushSupported()).toBe(false);
  });

  it('is true when the browser has notifications, push and service workers', () => {
    (window as any).Notification = function Notification() {};
    (window as any).PushManager = function PushManager() {};
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    expect(pushSupported()).toBe(true);
  });
});
