import { ApiError, apiFetch } from '../client';
import { authClient } from '../../auth/client';

jest.mock('../../auth/client', () => ({
  authClient: {
    getSession: jest.fn(),
    refreshSession: jest.fn(),
  },
}));

const mockAuth = authClient as unknown as {
  getSession: jest.Mock;
  refreshSession: jest.Mock;
};

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

type FetchMock = jest.MockedFunction<typeof fetch>;

describe('apiFetch', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('resolves relative endpoints against the API base URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 5 }));
    await apiFetch('/search');
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url.startsWith(`${API_BASE_URL}/search`)).toBe(true);
  });

  it('appends params, skipping undefined and null values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await apiFetch('/listings', {
      params: { campus_slug: 'dekut', q: undefined, zone: null, min_price: 1000, limit: 12 },
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('campus_slug=dekut');
    expect(url).toContain('min_price=1000');
    expect(url).toContain('limit=12');
    expect(url).not.toContain('q=');
    expect(url).not.toContain('zone=');
  });

  it('returns parsed JSON on success', async () => {
    const data = { items: [{ id: '1' }], total: 1, page: 1, pages: 1 };
    fetchMock.mockResolvedValueOnce(jsonResponse(data));
    const result = await apiFetch('/listings');
    expect(result).toEqual(data);
  });

  it('returns an empty object for 204', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 204));
    const result = await apiFetch('/profiles/me/wishlist/x', { method: 'DELETE' });
    expect(result).toEqual({});
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('sends JSON body and bearer token when authenticated', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok123' } },
      error: null,
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await apiFetch('/reviews', {
      method: 'POST',
      body: JSON.stringify({ listing_id: 'l1', rating: 5, text: 'Great stay' }),
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(String(init.body)).toContain('"rating":5');
  });

  it('refreshes once and retries on 401 with the new token', async () => {
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'old-token' } },
      error: null,
    });
    mockAuth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token' } },
      error: null,
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: '1' }] }));

    const result = await apiFetch('/profiles/me/wishlist');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>)['Authorization']).toBe('Bearer new-token');
    expect(result).toEqual({ data: [{ id: '1' }] });
  });

  it('throws ApiError with detail message and code for error responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: { message: 'Zone not found', code: 'ZONE_NOT_FOUND' } }, 404),
    );
    await expect(apiFetch('/zones')).rejects.toMatchObject<Partial<ApiError>>({
      message: 'Zone not found',
      code: 'ZONE_NOT_FOUND',
      status: 404,
    });
  });

  it('throws ApiError with statusText when the body is not JSON', async () => {
    const res = { ok: false, status: 502, statusText: 'Bad Gateway' } as Response;
    fetchMock.mockResolvedValueOnce(res);
    await expect(apiFetch('/search')).rejects.toThrow('Bad Gateway');
  });

  it('throws a TIMEOUT_ERROR on abort', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    await expect(apiFetch('/search')).rejects.toMatchObject({ code: 'TIMEOUT_ERROR', status: 408 });
  });

  it('wraps network failures as NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(apiFetch('/search')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });
});