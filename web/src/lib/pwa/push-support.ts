/**
 * Can this browser show web push notifications at all?
 *
 * iPhone Safari (and Chrome on iPhone, which is Safari underneath) has no `Notification` global unless the site
 * was added to the home screen. Reading `Notification.permission` there throws a ReferenceError, which crashed
 * /account for every iPhone user. Check this before touching `Notification`.
 */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  );
}
