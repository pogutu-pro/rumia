"use client";

import { usePathname } from "next/navigation";
import { useNavigationDirection } from "@/context/NavigationContext";

export function AnimatedMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { direction } = useNavigationDirection();

  const animationClass =
    direction === "left"  ? "slide-in-from-right" :
    direction === "right" ? "slide-in-from-left"  : "";

  return (
    <main className={`pb-[calc(4rem+env(safe-area-inset-bottom))] ${animationClass}`}>
      {children}
    </main>
  );
}
