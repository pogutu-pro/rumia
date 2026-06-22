import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Hostel listing preview';
// Smaller canvas + JPEG keeps output well under WhatsApp's 300 KB og:image limit
export const size = { width: 600, height: 315 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ county: string; area: string; slug: string }>;
}

export default async function ListingOgImage({ params }: Props) {
  try {
    const { slug } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Use service-role key so RLS on listing_images never blocks the join
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/listings?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=title,price,location,listing_images(r2_url,display_order)&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const rows = res.ok ? await res.json() : [];
    const listing = rows[0];

    const title = listing?.title ?? 'Student Hostel Near DeKUT';
    const price = listing?.price ? `KES ${Number(listing.price).toLocaleString()}/mo` : '';
    const location = listing?.location ?? 'Nyeri, Kenya';
    const images = (listing?.listing_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order);
    const coverUrl = images[0]?.r2_url ?? null;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            fontFamily: 'sans-serif',
            position: 'relative',
            backgroundColor: '#0f172a',
          }}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
            }}
          />

          <div style={{ position: 'relative', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {`Student Hostel · ${location}`}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, maxWidth: '480px' }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
              {price && (
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{price}</div>
              )}
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Near DeKUT · Nyeri</div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.5px',
            }}
          >
            RUMIA
          </div>
        </div>
      ),
      { ...size }
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
            backgroundColor: '#0f172a',
            padding: '48px',
          }}
        >
          <div style={{ fontSize: '42px', fontWeight: 900, color: '#34d399', marginBottom: '8px' }}>
            RUMIA
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
            Student Hostels Near DeKUT
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
            Nyeri, Kenya
          </div>
        </div>
      ),
      { ...size }
    );
  }
}
