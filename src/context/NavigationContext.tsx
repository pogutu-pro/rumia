"use client";

import { createContext, useContext, useState, useCallback } from "react";

type Direction = "left" | "right" | null;

interface NavigationContextType {
  direction: Direction;
  setDirection: (d: Direction) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  direction: null,
  setDirection: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [direction, setDirectionState] = useState<Direction>(null);

  const setDirection = useCallback((d: Direction) => {
    setDirectionState(d);
    if (d !== null) {
      setTimeout(() => setDirectionState(null), 260);
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ direction, setDirection }}>
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigationDirection = () => useContext(NavigationContext);
