import { ImageResponse } from 'next/og';
import { getCampusBySlug } from '@/lib/data/campuses';
import type { Campus } from '@/types';

export const runtime = 'nodejs';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'image/webp,image/jpeg,image/png,*/*' },
    });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp(buffer).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    const campus = await getCampusBySlug('dekut');

    if (!slug) {
      return fallbackImage(campus);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Use service-role key so RLS on listing_images never blocks the join
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/listings?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=title,price,location,listing_images(r2_url,display_order)&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const rows = res.ok ? await res.json() : [];
    const listing = rows[0];

    const shortName = campus.short_name ?? 'DeKUT';
    const city = campus.city ?? 'Nyeri';
    const title = listing?.title ?? `Student Hostel Near ${shortName}`;
    const price = listing?.price ? `KES ${Number(listing.price).toLocaleString()}/mo` : '';
    const location = listing?.location ?? `${city}, Kenya`;
    const images = (listing?.listing_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order);
    const coverUrl = images[0]?.r2_url ?? null;
    const coverDataUrl = coverUrl ? await fetchImageAsDataUrl(coverUrl) : null;

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
          {coverDataUrl && (
            <img
              src={coverDataUrl}
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
          <div style={{ position: 'relative', padding: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {`Student Hostel · ${location}`}
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, maxWidth: '600px' }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
              {price && (
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>{price}</div>
              )}
              <div style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600 }}>Near {shortName} · {city}</div>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: '28px',
              right: '32px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '18px',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.5px',
            }}
          >
            RUMIA
          </div>
        </div>
      ),
      {
        width: 800,
        height: 420,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      }
    );
  } catch {
    return fallbackImage();
  }
}

function fallbackImage(campus?: Campus) {
  const shortName = campus?.short_name ?? 'DeKUT';
  const city = campus?.city ?? 'Nyeri';

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
        <div style={{ fontSize: '64px', fontWeight: 900, color: '#34d399', marginBottom: '16px' }}>
          RUMIA
        </div>
        <div style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
          Student Hostels Near {shortName}
        </div>
        <div style={{ fontSize: '20px', color: '#94a3b8', marginTop: '12px' }}>
          {city}, Kenya
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}
