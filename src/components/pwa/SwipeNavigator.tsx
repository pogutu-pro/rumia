"use client";

import { useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useNavigationDirection } from "@/context/NavigationContext";

const TAB_ROUTES = ["/", "/hostels", "/verify", "/auth/login"] as const;

function getCurrentIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/hostels") return 1;
  if (pathname.startsWith("/verify")) return 2;
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account")
  ) return 3;
  return -1;
}

export function SwipeNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setDirection } = useNavigationDirection();

  const currentIndex = getCurrentIndex(pathname);
  const isDetailPage = pathname.startsWith("/hostels/");
  const isSwipeable = currentIndex !== -1 && !isDetailPage;

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const lastSampleXRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Reset transform after navigation completes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "translateX(0)";
  }, [pathname]);

  const initialStyle: React.CSSProperties = {
    transform: "translateX(0px)",
    transition: "none",
    willChange: "transform",
    touchAction: "pan-y",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;

      isDraggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      lastSampleXRef.current = e.clientX;
      lastSampleTimeRef.current = Date.now();

      const el = containerRef.current;
      if (el) {
        el.setPointerCapture(e.pointerId);
        el.style.transition = "none";
      }
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = e.clientX - startXRef.current;
      const idx = currentIndexRef.current;
      const atLeftEdge = idx === 0 && delta > 0;
      const atRightEdge = idx === TAB_ROUTES.length - 1 && delta < 0;

      const resistance = atLeftEdge || atRightEdge ? 0.12 : 1;

      const now = Date.now();
      if (now - lastSampleTimeRef.current > 20) {
        lastSampleXRef.current = e.clientX;
        lastSampleTimeRef.current = now;
      }

      const el = containerRef.current;
      if (el) {
        el.style.transform = `translateX(${delta * resistance}px)`;
      }
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || e.pointerId !== pointerIdRef.current) return;

      isDraggingRef.current = false;
      pointerIdRef.current = null;

      const delta = e.clientX - startXRef.current;
      const screenWidth = window.innerWidth;
      const idx = currentIndexRef.current;

      const recentDelta = e.clientX - lastSampleXRef.current;
      const recentElapsed = Math.max(Date.now() - lastSampleTimeRef.current, 1);
      const velocity = Math.abs(recentDelta) / recentElapsed;

      const shouldNavigate =
        Math.abs(delta) > 8 &&
        (Math.abs(delta) > screenWidth * 0.25 || velocity > 0.35);

      if (shouldNavigate) {
        const swipedLeft = delta < 0;
        const targetIndex = idx + (swipedLeft ? 1 : -1);
        if (targetIndex >= 0 && targetIndex < TAB_ROUTES.length) {
          setDirection(swipedLeft ? "left" : "right");
          router.push(TAB_ROUTES[targetIndex]);
          return;
        }
      }

      // Spring back
      const el = containerRef.current;
      if (el) {
        el.style.transition = "transform 250ms cubic-bezier(0.25, 0.1, 0.25, 1)";
        el.style.transform = "translateX(0)";
      }
    },
    [router, setDirection]
  );

  const handlePointerCancel = useCallback(() => {
    isDraggingRef.current = false;
    pointerIdRef.current = null;
    const el = containerRef.current;
    if (el) {
      el.style.transition = "transform 250ms cubic-bezier(0.25, 0.1, 0.25, 1)";
      el.style.transform = "translateX(0)";
    }
  }, []);

  if (!isSwipeable) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      className="swipe-container"
      style={initialStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {children}
    </div>
  );
}
