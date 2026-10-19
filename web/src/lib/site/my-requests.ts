/** Booking requests made in this browser, so a guest can find their status links again without an account. */

const KEY = 'rumiabnb_requests';
const MAX = 10;

export interface SavedRequest {
  token: string;
  title: string;
  checkIn: string;
  checkOut: string;
}

export function myRequests(): SavedRequest[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((r) => r && typeof r.token === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRequest(r: SavedRequest): void {
  try {
    const rest = myRequests().filter((x) => x.token !== r.token);
    window.localStorage.setItem(KEY, JSON.stringify([r, ...rest].slice(0, MAX)));
  } catch {
    // storage blocked: the confirmation page still shows the link
  }
}
