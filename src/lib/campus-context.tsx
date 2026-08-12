'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Campus } from '@/types';
import { DEKUT_CAMPUS_FALLBACK } from '@/lib/data/campus-fallback';

const CampusContext = createContext<Campus>(DEKUT_CAMPUS_FALLBACK);

interface CampusProviderProps {
  campus: Campus;
  children: ReactNode;
}

export function CampusProvider({ campus, children }: CampusProviderProps) {
  return (
    <CampusContext.Provider value={campus}>{children}</CampusContext.Provider>
  );
}

export function useCampus(): Campus {
  return useContext(CampusContext);
}
