import { fetchPublicApi } from './config';

export interface Region {
  id: string;
  slug: string;
  name: string;
  [key: string]: unknown;
}

export const regionsApi = {
  /** All administrative regions (public). */
  listServer: () => fetchPublicApi<Region[]>('/regions'),
};
