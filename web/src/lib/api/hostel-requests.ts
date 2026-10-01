import { serverApi } from './server';
import type {
  CreateHostelRequestInput,
  HostelRequest,
  HostelRequestStatus,
} from '@/types';

export interface ManagedHostelRequest extends HostelRequest {
  campus?: { id: string; name: string; slug: string } | null;
}

/** Server-side client for /hostel-requests (all rules, scoping and notifications live in FastAPI). */
export const hostelRequestsApi = {
  createServer: (input: CreateHostelRequestInput) =>
    serverApi.post<HostelRequest>('/hostel-requests', input),

  listMineServer: () => serverApi.get<HostelRequest[]>('/hostel-requests/me'),

  updateMineServer: (id: string, input: CreateHostelRequestInput) =>
    serverApi.patch<HostelRequest>(`/hostel-requests/${id}`, input),

  cancelMineServer: (id: string) =>
    serverApi.post<HostelRequest>(`/hostel-requests/${id}/cancel`),

  deleteMineServer: (id: string) => serverApi.delete<null>(`/hostel-requests/${id}`),

  /** Managers: requests for their campuses (admins: all). */
  listManagedServer: () => serverApi.get<ManagedHostelRequest[]>('/hostel-requests/manage'),

  getManagedServer: (id: string) =>
    serverApi.get<ManagedHostelRequest>(`/hostel-requests/manage/${id}`),

  updateStatusServer: (id: string, status: HostelRequestStatus) =>
    serverApi.patch<HostelRequest>(`/hostel-requests/${id}/status`, { status }),
};
