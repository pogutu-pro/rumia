import { leadsApi, LeadTrackError, type LeadTrackResult } from '@/lib/api/leads';
import { POST } from '../route';

jest.mock('@/lib/api/leads', () => {
  const actual = jest.requireActual('@/lib/api/leads');
  return { ...actual, leadsApi: { trackServer: jest.fn() } };
});

const trackServer = leadsApi.trackServer as jest.Mock;

const tracked: LeadTrackResult = {
  recorded: true,
  contact_type: 'rumia_agent',
  agent: { name: 'Agent A', whatsapp: '0722000000', phone: '0722000001' },
  listing: {
    title: 'Hostel One',
    price: 12000,
    area: 'Boma',
    has_video: false,
    is_full: false,
    pays_commission: false,
    landlord_phone: '0711000000',
  },
  consultation_fee: 100,
};

let ipCounter = 0;
function req(body: unknown) {
  // unique IP per request so the in-process rate limiter never interferes
  ipCounter += 1;
  return new Request('http://localhost/api/track-lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `198.51.100.${ipCounter}` },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => trackServer.mockReset());

describe('POST /api/track-lead (proxy to FastAPI)', () => {
  it('rejects a body without listing_id/agent_id', async () => {
    const res = await POST(req({ contact_type: 'rumia_agent' }));
    expect(res.status).toBe(400);
    expect(trackServer).not.toHaveBeenCalled();
  });

  it('forwards the visitor IP and returns a WhatsApp link to the agent', async () => {
    trackServer.mockResolvedValue(tracked);
    const res = await POST(
      req({ listing_id: 'l1', agent_id: 'a1', contact_type: 'rumia_agent', fee_accepted: true }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.whatsappUrl).toContain('wa.me/+254722000000');
    expect(trackServer.mock.calls[0][0]).toMatchObject({
      listing_id: 'l1',
      contact_type: 'rumia_agent',
      fee_accepted: true,
    });
    expect(trackServer.mock.calls[0][1]).toMatch(/^198\.51\.100\./);
  });

  it('uses the landlord phone for hostel_owner contact', async () => {
    trackServer.mockResolvedValue({ ...tracked, contact_type: 'hostel_owner' });
    const res = await POST(req({ listing_id: 'l1', agent_id: 'a1', contact_type: 'hostel_owner' }));
    const json = await res.json();
    expect(json.whatsappUrl).toContain('wa.me/+254711000000');
  });

  it('maps FEE_REQUIRED and REQUIRES_AGENT conflicts to the legacy response shapes', async () => {
    trackServer.mockRejectedValueOnce(new LeadTrackError(409, 'FEE_REQUIRED', 'Fee disclosure required'));
    let res = await POST(req({ listing_id: 'l1', agent_id: 'a1' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ requiresFee: true });

    trackServer.mockRejectedValueOnce(new LeadTrackError(409, 'REQUIRES_AGENT', 'Hostel is full'));
    res = await POST(req({ listing_id: 'l1', agent_id: 'a1', contact_type: 'hostel_owner' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ requiresAgent: true });
  });

  it('maps a missing listing to 404', async () => {
    trackServer.mockRejectedValueOnce(new LeadTrackError(404, 'NOT_FOUND', 'Listing not found'));
    const res = await POST(req({ listing_id: 'l1', agent_id: 'a1' }));
    expect(res.status).toBe(404);
  });
});
