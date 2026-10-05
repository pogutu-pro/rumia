import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Loads the real public/sw.js into a sandbox with a fake Cache Storage so the routing rules
 * (what the worker touches, what it stores, what it serves when offline) are tested as shipped.
 */
function loadWorker() {
  const listeners: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, any>>();
  const cacheApi = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (req: any) => m.get(typeof req === 'string' ? req : req.url),
      put: async (req: any, res: any) => void m.set(typeof req === 'string' ? req : req.url, res),
      add: async () => undefined,
      delete: async (req: any) => m.delete(typeof req === 'string' ? req : req.url),
      keys: async () => [...m.keys()],
    };
  };
  const fetchMock = jest.fn();
  class FakeResponse {
    status: number; type = 'basic'; headers: { get: (k: string) => string | null }; body: string;
    constructor(body: string, init: any = {}) {
      this.body = body; this.status = init.status ?? 200;
      const h = new Map<string, string>(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
      this.headers = { get: (k: string) => h.get(k.toLowerCase()) ?? null };
    }
    clone() { return Object.assign(Object.create(FakeResponse.prototype), this); }
  }
  const sandbox: any = {
    self: { location: { origin: 'https://rumia.co.ke' }, addEventListener: (t: string, fn: any) => (listeners[t] = fn), skipWaiting: async () => undefined, clients: { claim: async () => undefined } },
    caches: { open: async (n: string) => cacheApi(n), keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n), match: undefined },
    fetch: fetchMock, Response: FakeResponse, Request: class {}, URL, Promise, setTimeout, clearTimeout, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../../public/sw.js'), 'utf8'), sandbox);

  const dispatch = (url: string, mode = 'navigate') => {
    let responded: Promise<any> | null = null;
    const waits: Promise<any>[] = [];
    listeners.fetch({
      request: { url, method: 'GET', mode }, respondWith: (p: Promise<any>) => (responded = Promise.resolve(p)), waitUntil: (p: Promise<any>) => waits.push(p),
    });
    return { intercepted: responded !== null, response: responded as Promise<any> | null, settle: () => Promise.all(waits) };
  };
  return { dispatch, fetchMock, FakeResponse, stores };
}

describe('service worker routing', () => {
  it.each(['/auth/google/callback?code=x&state=y', '/auth/login', '/account', '/dashboard/listings', '/admin', '/manager', '/api/healthz'])(
    'never intercepts %s, even full-page navigations',
    (p) => {
      const { dispatch } = loadWorker();
      expect(dispatch(`https://rumia.co.ke${p}`).intercepted).toBe(false);
    },
  );

  it('ignores cross-origin requests', () => {
    const { dispatch } = loadWorker();
    expect(dispatch('https://images.rumia.co.ke/a.webp', 'no-cors').intercepted).toBe(false);
  });

  it('waits for a slow network when nothing is saved instead of aborting', async () => {
    const { dispatch, fetchMock, FakeResponse } = loadWorker();
    fetchMock.mockImplementation(() => new Promise((r) => setTimeout(() => r(new FakeResponse('ok', { headers: { 'content-type': 'text/html' } })), 50)));
    const res = await dispatch('https://rumia.co.ke/hostels').response;
    expect(res.body).toBe('ok');
  });

  it('saves cacheable public pages and serves them when the network fails', async () => {
    const { dispatch, fetchMock, FakeResponse } = loadWorker();
    fetchMock.mockResolvedValueOnce(new FakeResponse('listing page', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 's-maxage=60' } }));
    const first = dispatch('https://rumia.co.ke/hostels/nyeri/dekut/x');
    await first.response;
    await first.settle();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const offline = await dispatch('https://rumia.co.ke/hostels/nyeri/dekut/x').response;
    expect(offline.body).toBe('listing page');
  });

  it('never stores no-store or private pages', async () => {
    const { dispatch, fetchMock, FakeResponse } = loadWorker();
    fetchMock.mockResolvedValueOnce(new FakeResponse('personal', { headers: { 'content-type': 'text/html', 'cache-control': 'private, no-store' } }));
    const first = dispatch('https://rumia.co.ke/hostels?x=1');
    await first.response;
    await first.settle();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = await dispatch('https://rumia.co.ke/hostels?x=1').response;
    expect(res.body).toBe('Offline');
    expect(res.status).toBe(503);
  });
});
