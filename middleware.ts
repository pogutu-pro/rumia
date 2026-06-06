import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Minimal middleware for Rumia Marketplace.
 * Protects /dashboard and /admin routes — everything else is public.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard authenticated routes
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase client that can read/write cookies in the middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookie mutations to the response
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (important for Supabase Auth token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user visits /auth/login, redirect to dashboard
  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
