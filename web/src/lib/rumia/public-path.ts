/**
 * Which paths belong to the rebuilt public experience. The old chrome (bottom tab bar, compare tray and
 * MobileMain padding) is kept only for the legacy apps it still serves (account, dashboard, admin, manager);
 * every public page rendered by the new IA gets the new top bar and footer instead.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/hostels') ||
    pathname.startsWith('/bnb') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/agent/') ||
    pathname.startsWith('/listing/') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/book-tour') ||
    pathname.startsWith('/browse') ||
    pathname.startsWith('/compare') ||
    pathname.startsWith('/auth') ||
    pathname === '/saved' ||
    pathname.startsWith('/workspace') ||
    pathname.startsWith('/ops')
  );
}