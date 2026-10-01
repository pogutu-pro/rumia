'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { hostelRequestsApi, type ManagedHostelRequest } from '@/lib/api/hostel-requests';
import type { ManagerActionResult } from './manager';
import type {
  CreateHostelRequestInput,
  HostelRequest,
  HostelRequestWithCampus,
  HostelRequestStatus,
} from '@/types';

/**
 * Hostel requests ("Find Me a Hostel"). Validation, campus scoping, fee lookup and the
 * in-app/push notifications to managers and students all live in FastAPI
 * (`/hostel-requests`); these actions only call it and revalidate caches.
 */

function failure(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof ApiError) {
    return {
      success: false,
      error: err.status === 401 ? 'You must be signed in.' : err.message || fallback,
    };
  }
  return { success: false, error: fallback };
}

// The UI reads the embedded campus as `campuses` (legacy PostgREST shape).
function withCampus(request: ManagedHostelRequest): HostelRequestWithCampus {
  const { campus, ...rest } = request;
  return { ...rest, campuses: campus ?? null };
}

/** Student submits a request; FastAPI notifies the campus managers. */
export async function createHostelRequestAction(
  input: CreateHostelRequestInput,
): Promise<ManagerActionResult<HostelRequest>> {
  try {
    const data = await hostelRequestsApi.createServer(input);
    revalidatePath('/account');
    return { success: true, data };
  } catch (err) {
    return failure(err, 'Failed to submit your request. Please try again.');
  }
}

/** The signed-in student's own requests (newest first). */
export async function getMyHostelRequestsAction(): Promise<HostelRequest[]> {
  try {
    return await hostelRequestsApi.listMineServer();
  } catch {
    return [];
  }
}

/** Student cancels one of their own requests (only while waiting/contacted). */
export async function cancelMyHostelRequestAction(
  requestId: string,
): Promise<ManagerActionResult> {
  try {
    await hostelRequestsApi.cancelMineServer(requestId);
    revalidatePath('/account');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to cancel the request.');
  }
}

/** Student edits one of their own requests (only while waiting/contacted; the fee is never writable). */
export async function updateMyHostelRequestAction(
  requestId: string,
  input: CreateHostelRequestInput,
): Promise<ManagerActionResult<HostelRequest>> {
  try {
    const data = await hostelRequestsApi.updateMineServer(requestId, input);
    revalidatePath('/account');
    revalidatePath('/manager/requests');
    return { success: true, data };
  } catch (err) {
    return failure(err, 'Failed to update the request.');
  }
}

/** Student deletes one of their own requests; only cancelled ones may be removed. */
export async function deleteMyHostelRequestAction(
  requestId: string,
): Promise<ManagerActionResult> {
  try {
    await hostelRequestsApi.deleteMineServer(requestId);
    revalidatePath('/account');
    revalidatePath('/manager/requests');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete the request.');
  }
}

/** Requests scoped to the manager's campus/region (all for admins). */
export async function getManagerHostelRequestsAction(): Promise<HostelRequestWithCampus[]> {
  try {
    return (await hostelRequestsApi.listManagedServer()).map(withCampus);
  } catch {
    return [];
  }
}

/** One request, or null when it is missing or outside the manager's scope. */
export async function getManagerHostelRequestByIdAction(
  requestId: string,
): Promise<HostelRequestWithCampus | null> {
  try {
    return withCampus(await hostelRequestsApi.getManagedServer(requestId));
  } catch {
    return null;
  }
}

/** Manager moves a request along its workflow; the student is notified (in-app + push). */
export async function updateHostelRequestStatusAction(
  requestId: string,
  status: HostelRequestStatus,
): Promise<ManagerActionResult> {
  try {
    await hostelRequestsApi.updateStatusServer(requestId, status);
    revalidatePath('/manager/requests');
    revalidatePath('/account');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to update the request status.');
  }
}
