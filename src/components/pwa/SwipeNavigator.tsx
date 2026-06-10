"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useNavigationDirection } from "@/context/NavigationContext";

const TAB_ROUTES = ["/", "/hostels", "/saved", "/auth/login"] as const;

function getCurrentIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/hostels") return 1;
  if (pathname.startsWith("/saved")) return 2;
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

  const [translateX, setTranslateX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  if (!isSwipeable) return <>{children}</>;

  const navigateTo = useCallback(
    (targetIndex: number, swipedLeft: boolean) => {
      const screenWidth = window.innerWidth;
      const exitX = swipedLeft ? -screenWidth : screenWidth;

      setIsExiting(true);
      setTranslateX(exitX);

      setTimeout(() => {
        setDirection(swipedLeft ? "left" : "right");
        router.push(TAB_ROUTES[targetIndex]);
        setTranslateX(0);
        setIsExiting(false);
      }, 210);
    },
    [router, setDirection]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;
      if (isExiting) return;

      isDraggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      lastSampleXRef.current = e.clientX;
      lastSampleTimeRef.current = Date.now();

      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [isExiting]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = e.clientX - startXRef.current;
      const atLeftEdge = currentIndex === 0 && delta > 0;
      const atRightEdge = currentIndex === TAB_ROUTES.length - 1 && delta < 0;

      const resistance = atLeftEdge || atRightEdge ? 0.12 : 1;

      const now = Date.now();
      if (now - lastSampleTimeRef.current > 20) {
        lastSampleXRef.current = e.clientX;
        lastSampleTimeRef.current = now;
      }

      setTranslateX(delta * resistance);
    },
    [currentIndex]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || e.pointerId !== pointerIdRef.current) return;

      isDraggingRef.current = false;
      pointerIdRef.current = null;

      const delta = e.clientX - startXRef.current;
      const screenWidth = window.innerWidth;

      const recentDelta = e.clientX - lastSampleXRef.current;
      const recentElapsed = Math.max(Date.now() - lastSampleTimeRef.current, 1);
      const velocity = Math.abs(recentDelta) / recentElapsed;

      const shouldComplete =
        Math.abs(delta) > 10 &&
        (Math.abs(delta) > screenWidth * 0.28 || velocity > 0.4);

      if (shouldComplete) {
        const swipedLeft = delta < 0;
        const targetIndex = currentIndex + (swipedLeft ? 1 : -1);
        if (targetIndex >= 0 && targetIndex < TAB_ROUTES.length) {
          navigateTo(targetIndex, swipedLeft);
          return;
        }
      }

      setTranslateX(0);
    },
    [currentIndex, navigateTo]
  );

  const handlePointerCancel = useCallback(() => {
    isDraggingRef.current = false;
    pointerIdRef.current = null;
    setTranslateX(0);
  }, []);

  const getTransition = (): string => {
    if (isDraggingRef.current) return "none";
    if (isExiting) return "transform 210ms cubic-bezier(0.4, 0, 1, 1)";
    return "transform 380ms cubic-bezier(0.175, 0.885, 0.32, 1.275)";
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: getTransition(),
        willChange: "transform",
        touchAction: "pan-y",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {children}
    </div>
  );
}
