'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getManagerUser, type ManagerActionResult } from './manager';
import { checkManagerCampusScope } from '@/lib/utils/manager';
import { cleanPhone, isValidKenyanPhone } from '@/lib/utils/phone';
import { sendPushToUser, getManagerUserIdsForCampus } from '@/lib/push';
import { createAppNotification } from './notifications';
import {
  HOSTEL_REQUEST_FEE,
  BUDGET_OPTIONS,
} from '@/lib/constants/hostel-requests';
import type {
  CreateHostelRequestInput,
  HostelRequest,
  HostelRequestWithCampus,
  HostelRequestStatus,
} from '@/types';

const VALID_STATUSES: HostelRequestStatus[] = [
  'waiting',
  'contacted',
  'finding',
  'hostel_found',
  'completed',
  'cancelled',
];

const VALID_GENDERS = ['male', 'female', 'no_preference'];
const VALID_ROOM_TYPES = ['single', 'shared', 'bedsitter', 'one_bedroom', 'no_preference'];
const VALID_FURNISHINGS = ['furnished', 'unfurnished', 'no_preference'];
const VALID_STAY_PREFERENCES = ['alone', 'sharing', 'no_preference'];

function isValidEnum(value: string, allowed: string[], field: string): string | null {
  if (!allowed.includes(value)) {
    return `Please choose a valid ${field}.`;
  }
  return null;
}

/**
 * Student submits a "Find Me a Hostel" request. Creates the row, then fires
 * in-app + push notifications to the managers responsible for the campus.
 */
export async function createHostelRequestAction(
  input: CreateHostelRequestInput,
): Promise<ManagerActionResult<HostelRequest>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to submit a request.' };
  }

  const phone = cleanPhone((input.phone ?? '').trim());
  if (!isValidKenyanPhone(phone)) {
    return {
      success: false,
      error: 'Please enter a valid Kenyan phone number starting with 07, 01, +2547 or +2541.',
    };
  }

  if (!input.budget_range || !BUDGET_OPTIONS.some((b) => b.value === input.budget_range)) {
    return { success: false, error: 'Please choose a budget range.' };
  }

  const genderErr = isValidEnum(input.gender, VALID_GENDERS, 'gender');
  if (genderErr) return { success: false, error: genderErr };
  const roomErr = isValidEnum(input.room_type, VALID_ROOM_TYPES, 'room type');
  if (roomErr) return { success: false, error: roomErr };
  const furnishErr = isValidEnum(input.furnishing, VALID_FURNISHINGS, 'furnishing');
  if (furnishErr) return { success: false, error: furnishErr };
  const stayErr = isValidEnum(
    input.stay_preference ?? 'no_preference',
    VALID_STAY_PREFERENCES,
    'stay preference',
  );
  if (stayErr) return { success: false, error: stayErr };

  const zone = input.preferred_zone?.trim() || null;

  // Resolve the student's campus for routing the request + manager notification.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, campus_id, home_campus_id')
    .eq('id', user.id)
    .maybeSingle();
  const campusId = profile?.home_campus_id || profile?.campus_id;
  if (!campusId) {
    return {
      success: false,
      error: 'Please complete your campus details in your profile first.',
    };
  }

  const { data: campus } = await supabase
    .from('campuses')
    .select('id, name, hostel_finding_fee')
    .eq('id', campusId)
    .maybeSingle();
  const campusName = campus?.name ?? 'your campus';
  const studentName = profile?.full_name?.trim() || 'Student';
  const fee = campus?.hostel_finding_fee ?? HOSTEL_REQUEST_FEE;

  const { data: created, error } = await supabase
    .from('hostel_requests')
    .insert({
      user_id: user.id,
      student_name: studentName,
      phone,
      campus_id: campusId,
      preferred_zone: zone,
      budget_range: input.budget_range,
      gender: input.gender,
      room_type: input.room_type,
      furnishing: input.furnishing,
      stay_preference: input.stay_preference ?? 'no_preference',
      move_in_date: input.move_in_date || null,
      additional_requirements: input.additional_requirements?.trim() || null,
      fee,
      status: 'waiting',
    })
    .select('*')
    .single();

  if (error || !created) {
    return { success: false, error: error?.message || 'Failed to submit your request. Please try again.' };
  }

  revalidatePath('/account');

  // Notify the campus manager(s) — in-app + push. Falls back to admins.
  const managerIds = await getManagerUserIdsForCampus(campusId);
  const title = 'New hostel request';
  const body = `${studentName} needs help finding a hostel near ${campusName} (${zone || 'any area'}). Tap to review.`;
  const url = '/manager/requests';

  await Promise.all(
    managerIds.map(async (managerId) => {
      await createAppNotification({ userId: managerId, title, body, url });
      await sendPushToUser(managerId, { title, body, url, tag: `hostel-request-${created.id}` });
    }),
  ).catch(() => {});

  return { success: true, data: created as HostelRequest };
}

/**
 * Fetches the signed-in student's own hostel requests (newest first).
 */
export async function getMyHostelRequestsAction(): Promise<HostelRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('hostel_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data as HostelRequest[]) || [];
}

/**
 * Student cancels one of their own requests (only while waiting/contacted).
 */
export async function cancelMyHostelRequestAction(
  requestId: string,
): Promise<ManagerActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'You must be signed in.' };

  const { data: request, error: fetchError } = await supabase
    .from('hostel_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Request not found.' };
  }

  if (request.status !== 'waiting' && request.status !== 'contacted') {
    return {
      success: false,
      error: 'This request can no longer be cancelled.',
    };
  }

  const { error } = await supabase
    .from('hostel_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  return { success: true };
}

/**
 * Student edits one of their own requests (only while waiting/contacted). The
 * update is applied with the service-role client so the student can never
 * tamper with the `fee` column — only the fields they chose are written.
 * Managers see the change after the manager requests page is revalidated.
 */
export async function updateMyHostelRequestAction(
  requestId: string,
  input: CreateHostelRequestInput,
): Promise<ManagerActionResult<HostelRequest>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'You must be signed in to update a request.',
    };
  }

  const phone = cleanPhone((input.phone ?? '').trim());
  if (!isValidKenyanPhone(phone)) {
    return {
      success: false,
      error:
        'Please enter a valid Kenyan phone number starting with 07, 01, +2547 or +2541.',
    };
  }

  if (!input.budget_range || !BUDGET_OPTIONS.some((b) => b.value === input.budget_range)) {
    return { success: false, error: 'Please choose a budget range.' };
  }

  const genderErr = isValidEnum(input.gender, VALID_GENDERS, 'gender');
  if (genderErr) return { success: false, error: genderErr };
  const roomErr = isValidEnum(input.room_type, VALID_ROOM_TYPES, 'room type');
  if (roomErr) return { success: false, error: roomErr };
  const furnishErr = isValidEnum(input.furnishing, VALID_FURNISHINGS, 'furnishing');
  if (furnishErr) return { success: false, error: furnishErr };
  const stayErr = isValidEnum(
    input.stay_preference ?? 'no_preference',
    VALID_STAY_PREFERENCES,
    'stay preference',
  );
  if (stayErr) return { success: false, error: stayErr };

  const { data: request, error: fetchError } = await supabaseAdmin
    .from('hostel_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Request not found.' };
  }

  if (request.user_id !== user.id) {
    return { success: false, error: 'You can only update your own requests.' };
  }

  if (request.status !== 'waiting' && request.status !== 'contacted') {
    return {
      success: false,
      error: 'This request is already being processed and can no longer be edited.',
    };
  }

  const zone = input.preferred_zone?.trim() || null;

  const { error } = await supabaseAdmin
    .from('hostel_requests')
    .update({
      phone,
      preferred_zone: zone,
      budget_range: input.budget_range,
      gender: input.gender,
      room_type: input.room_type,
      furnishing: input.furnishing,
      stay_preference: input.stay_preference ?? 'no_preference',
      move_in_date: input.move_in_date || null,
      additional_requirements: input.additional_requirements?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/manager/requests');

  const { data: updated } = await supabaseAdmin
    .from('hostel_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  return { success: true, data: (updated as HostelRequest) || undefined };
}

/**
 * Student permanently deletes one of their own requests. Only allowed for
 * requests that are already `cancelled`, so active requests can never be
 * removed from the manager's queue by the student. Uses the service-role
 * client with an explicit ownership check.
 */
export async function deleteMyHostelRequestAction(
  requestId: string,
): Promise<ManagerActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: request, error: fetchError } = await supabaseAdmin
    .from('hostel_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Request not found.' };
  }

  if (request.user_id !== user.id) {
    return { success: false, error: 'You can only delete your own requests.' };
  }

  if (request.status !== 'cancelled') {
    return {
      success: false,
      error: 'Only cancelled requests can be removed.',
    };
  }

  const { error } = await supabaseAdmin
    .from('hostel_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/manager/requests');
  return { success: true };
}

/**
 * Fetches hostel requests scoped strictly to the manager's campus (or all for
 * super admins).
 */
export async function getManagerHostelRequestsAction(): Promise<HostelRequestWithCampus[]> {
  const manager = await getManagerUser();
  if (!manager) return [];

  const { context } = manager;
  const supabase = await createClient();

  let query = supabase
    .from('hostel_requests')
    .select(`
      *,
      campuses (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (!context.isSuperAdmin) {
    let allowedCampusIds: string[] = [];
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabase
        .from('campuses')
        .select('id')
        .eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map((c) => c.id);
      }
    }

    if (allowedCampusIds.length === 0) {
      return [];
    }
    query = query.in('campus_id', allowedCampusIds);
  }

  const { data } = await query;
  return (data as HostelRequestWithCampus[]) || [];
}

export async function getManagerHostelRequestByIdAction(
  requestId: string,
): Promise<HostelRequestWithCampus | null> {
  const manager = await getManagerUser();
  if (!manager) return null;

  const { context } = manager;
  const supabase = await createClient();

  const { data } = await supabase
    .from('hostel_requests')
    .select(`
      *,
      campuses (
        id,
        name,
        slug
      )
    `)
    .eq('id', requestId)
    .single();

  if (!data) return null;

  if (!context.isSuperAdmin) {
    const authorized = await checkManagerCampusScope(
      supabase,
      context,
      data.campus_id,
    );
    if (!authorized) return null;
  }

  return data as HostelRequestWithCampus;
}

/**
 * Manager updates a request status as the workflow progresses, and the student
 * is notified in-app + via push.
 */
export async function updateHostelRequestStatusAction(
  requestId: string,
  status: HostelRequestStatus,
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: 'Invalid status' };
  }

  const { context } = manager;
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('hostel_requests')
    .select('id, campus_id, user_id, student_name, status')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Request not found' };
  }

  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      request.campus_id,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot update requests outside your campus',
      };
    }
  }

  const { error } = await supabaseAdmin
    .from('hostel_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/requests');
  revalidatePath('/account');

  // Notify the student of the status change.
  const statusMeta = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'finding', label: 'Finding a Hostel' },
    { value: 'hostel_found', label: 'Hostel Found' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ].find((s) => s.value === status);
  const label = statusMeta?.label ?? status;
  const title = 'Hostel request update';
  const body = `Your hostel request status is now: ${label}. Check your account for details.`;
  const url = '/account?tab=overview';

  if (request.user_id) {
    await createAppNotification({ userId: request.user_id, title, body, url });
    await sendPushToUser(request.user_id, {
      title,
      body,
      url,
      tag: `hostel-request-update-${requestId}`,
    });
  }

  return { success: true };
}