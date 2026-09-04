import { apiFetch } from '../../lib/api/client';
import type {
  HostelRequest,
  HostelRequestFormConfig,
  HostelRequestInput,
  HostelRequestUpdateInput,
} from './types';

export const hostelRequestsKey = ['my-hostel-requests'] as const;
export const hostelConfigKey = ['hostel-request-config'] as const;

export function fetchMyHostelRequests() {
  return apiFetch<HostelRequest[]>('/hostel-requests/me');
}

export function fetchHostelRequestFormConfig() {
  return apiFetch<HostelRequestFormConfig>('/hostel-requests/form-config');
}

export function createHostelRequest(input: HostelRequestInput) {
  return apiFetch<HostelRequest>('/hostel-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateHostelRequest(id: string, input: HostelRequestUpdateInput) {
  return apiFetch<HostelRequest>(`/hostel-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function cancelHostelRequest(id: string) {
  return apiFetch<HostelRequest>(`/hostel-requests/${id}/cancel`, { method: 'POST' });
}

export function deleteHostelRequest(id: string) {
  return apiFetch<{ message: string }>(`/hostel-requests/${id}`, { method: 'DELETE' });
}