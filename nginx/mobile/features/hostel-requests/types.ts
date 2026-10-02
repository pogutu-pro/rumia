export interface HostelRequest {
  id: string;
  user_id: string;
  student_name: string;
  phone: string;
  campus_id: string;
  campus_name?: string | null;
  preferred_zone?: string | null;
  budget_range: string;
  gender: string;
  room_type: string;
  furnishing: string;
  stay_preference: string;
  move_in_date?: string | null;
  additional_requirements?: string | null;
  status: string;
  fee: number;
  created_at: string;
  updated_at: string;
}

export interface HostelRequestInput {
  phone: string;
  preferred_zone?: string | null;
  budget_range: string;
  gender: string;
  room_type: string;
  furnishing: string;
  stay_preference: string;
  move_in_date?: string | null;
  additional_requirements?: string | null;
}

export type HostelRequestUpdateInput = Partial<HostelRequestInput>;

export interface HostelRequestZoneOption {
  id: string;
  name: string;
}

export interface HostelRequestFormConfig {
  has_campus: boolean;
  campus_id?: string | null;
  campus_name?: string | null;
  fee: number;
  zones: HostelRequestZoneOption[];
}

export interface HostelRequestStatusMeta {
  label: string;
  description: string;
}

export const HOSTEL_REQUEST_STATUSES: Record<string, HostelRequestStatusMeta> = {
  waiting: { label: 'Waiting', description: 'Request submitted and awaiting a manager.' },
  contacted: { label: 'Contacted', description: 'A manager has reached out to you.' },
  finding: { label: 'Finding a Hostel', description: 'We are searching for a suitable hostel.' },
  hostel_found: { label: 'Hostel Found', description: 'A matching hostel has been identified.' },
  completed: { label: 'Completed', description: 'Request fulfilled successfully.' },
  cancelled: { label: 'Cancelled', description: 'This request has been cancelled.' },
};

export function hostelRequestStatusLabel(status: string): string {
  return HOSTEL_REQUEST_STATUSES[status]?.label ?? status;
}

export function hostelRequestStatusDescription(status: string): string {
  return HOSTEL_REQUEST_STATUSES[status]?.description ?? '';
}