"use client";

import { useEffect, useRef } from "react";

/**
 * Reference-counted body scroll lock.
 *
 * Multiple modals/overlays can call `useScrollLock(isOpen)` independently.
 * Body overflow is only restored when ALL consumers have released their lock.
 * This prevents the race condition where one modal closing clears the lock
 * while another modal is still open.
 */

let lockCount = 0;

function lockScroll() {
  lockCount++;
  if (lockCount === 1) {
    document.body.style.overflow = "hidden";
  }
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
  }
}

export function useScrollLock(isLocked: boolean) {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (isLocked && !wasLocked.current) {
      lockScroll();
      wasLocked.current = true;
    } else if (!isLocked && wasLocked.current) {
      unlockScroll();
      wasLocked.current = false;
    }

    return () => {
      if (wasLocked.current) {
        unlockScroll();
        wasLocked.current = false;
      }
    };
  }, [isLocked]);
}
