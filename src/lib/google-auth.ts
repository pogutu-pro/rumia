export const GOOGLE_AUTH_ENABLED = false;

type Listener = () => void;

let listeners: Listener[] = [];

export function onGoogleAuthBlocked(callback: Listener) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

export function openGoogleAuthModal() {
  listeners.forEach((l) => l());
}
