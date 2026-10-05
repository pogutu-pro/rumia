jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));
jest.mock('../profiles', () => ({ profilesApi: { updateMe: jest.fn() } }));

import * as Sentry from '@sentry/nextjs';
import { ApiError } from '../client';
import { profilesApi } from '../profiles';
import { classifySaveError, saveProfile } from '../profile-save';
import { isRefreshRejected } from '@/lib/auth/session';

const updateMe = profilesApi.updateMe as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const run = async (p: Promise<any>) => {
  const settled = p.then((v) => v);
  await jest.runAllTimersAsync();
  return settled;
};

describe('saveProfile', () => {
  it('rejects an invalid phone without calling the API', async () => {
    const r = await saveProfile({ phone: '12345', campus_input: 'Moi University' });
    expect(r).toMatchObject({ success: false, kind: 'validation' });
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('sends the confirmed flag and returns what the server stored', async () => {
    updateMe.mockResolvedValue({ phone: '0712345678', home_campus_id: null, home_campus_name: 'Moi University', home_campus_confirmed_at: '2026-10-05T00:00:00Z' });
    const r = await saveProfile({ phone: '0712 345 678', campus_input: 'Moi University' });
    expect(updateMe).toHaveBeenCalledWith({ phone: '0712 345 678', campus_input: 'Moi University', home_campus_confirmed: true });
    expect(r).toMatchObject({ success: true, updated: { home_campus_id: null, home_campus_name: 'Moi University' } });
  });

  it('retries transient failures and then succeeds', async () => {
    updateMe.mockRejectedValueOnce(new ApiError(503, 'x')).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ phone: '0712345678', home_campus_confirmed_at: 'now' });
    const r = await run(saveProfile({ phone: '0712345678', campus_input: 'A' }));
    expect(updateMe).toHaveBeenCalledTimes(3);
    expect(r.success).toBe(true);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not retry or alert on an expired session', async () => {
    updateMe.mockRejectedValue(new ApiError(401, 'x'));
    const r = await run(saveProfile({ phone: '0712345678', campus_input: 'A' }));
    expect(updateMe).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ success: false, kind: 'auth' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('alerts Sentry only for genuine server faults', async () => {
    updateMe.mockRejectedValue(new ApiError(500, 'boom'));
    const r = await run(saveProfile({ phone: '0712345678', campus_input: 'A' }));
    expect(r).toMatchObject({ success: false, kind: 'server' });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('classifySaveError', () => {
  it.each([[429, 'unavailable'], [502, 'unavailable'], [422, 'validation'], [404, 'server']])('status %i -> %s', (status, kind) => {
    expect(classifySaveError(new ApiError(status, 'x')).kind).toBe(kind);
  });
});

describe('isRefreshRejected', () => {
  it.each([[400, true], [401, true], [403, true], [429, false], [500, false], [503, false]])('%i -> %s', (status, expected) => {
    expect(isRefreshRejected(status)).toBe(expected);
  });
});
