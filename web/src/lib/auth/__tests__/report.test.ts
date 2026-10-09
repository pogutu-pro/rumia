import * as Sentry from '@sentry/nextjs';
import { errorCodeForStatus, reportAuthFailure } from '../report';

jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('reportAuthFailure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a tagged, grouped event for real failures', () => {
    reportAuthFailure({ stage: 'callback', cause: 'backend_500', status: 500 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'auth callback failed: backend_500',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ auth_stage: 'callback', auth_cause: 'backend_500', http_status: '500' }),
        fingerprint: ['auth', 'callback', 'backend_500'],
      }),
    );
  });

  it('uses warning level for client-side statuses such as 429', () => {
    reportAuthFailure({ stage: 'start', cause: 'backend_429', status: 429 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('only leaves a breadcrumb for expected outcomes like cancelling Google', () => {
    reportAuthFailure({ stage: 'google_error', cause: 'access_denied', expected: true });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
  });

  it('never throws', () => {
    (Sentry.captureMessage as jest.Mock).mockImplementationOnce(() => {
      throw new Error('sentry down');
    });
    expect(() => reportAuthFailure({ stage: 'refresh', cause: 'backend_unreachable' })).not.toThrow();
  });
});

describe('errorCodeForStatus', () => {
  it('maps backend outcomes to distinct user messages', () => {
    expect(errorCodeForStatus(429)).toBe('rate_limited');
    expect(errorCodeForStatus(503)).toBe('server_unavailable');
    expect(errorCodeForStatus(undefined)).toBe('server_unavailable');
    expect(errorCodeForStatus(401)).toBe('auth_failed');
  });
});
