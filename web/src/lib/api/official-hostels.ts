import { serverApi } from './server';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

export interface OfficialHostelsOverview {
  official_hostels: OfficialHostel[];
  listings: AgentListingHostel[];
}

export interface OfficialHostelInput {
  hostel_name: string;
  zone?: string | null;
  contacts?: string | null;
  payments?: string | null;
  source?: string | null;
  verified_date?: string | null;
}

export const officialHostelsApi = {
  /** Official DeKUT records next to every platform listing's contact/payment details. */
  overviewServer: () => serverApi.get<OfficialHostelsOverview>('/official-hostels/overview'),
  listServer: () => serverApi.get<OfficialHostel[]>('/official-hostels'),
};
