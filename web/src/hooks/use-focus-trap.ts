import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
): void {
  // Keep a ref to the restore target so the cleanup fn in the effect can always
  // reach it even after `active` has changed back to false.
  const restoreTargetRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) {
      // Restore focus to the previously focused element when deactivated.
      const target = restoreTargetRef.current;
      if (target && typeof (target as HTMLElement).focus === 'function') {
        (target as HTMLElement).focus();
      }
      restoreTargetRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Save the element that was focused before the trap activated.
    restoreTargetRef.current = document.activeElement;

    // Collect focusable elements fresh on every activation so dynamic content
    // inside the panel is always accounted for.
    const getFocusableElements = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'),
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        // Shift+Tab: move backwards, wrap from first → last.
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: move forwards, wrap from last → first.
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Do NOT restore focus on unmount — the component may be unmounting as
      // part of a page navigation or an error boundary recovery, and calling
      // .focus() in those situations can cause errors or unexpected scrolling.
    };
  }, [active, containerRef]);
}
