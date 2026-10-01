import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/client';
import { managerApi } from '@/lib/api/manager';

/** Thin same-origin proxy to FastAPI `POST /manager/campuses` (admin only, enforced there). */
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Missing campus name' }, { status: 400 });
    }

    const campus = await managerApi.createCampus({ name: name.trim() });
    return NextResponse.json({ success: true, campus: { id: campus.id, name: campus.name } });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return NextResponse.json(
        { error: err.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: err.status },
      );
    }
    if (err instanceof ApiError && err.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('Create campus exception:', err);
    return NextResponse.json({ error: 'Failed to create campus' }, { status: 500 });
  }
}
