import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'company_session';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Skip static assets, internal next files, and media
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  // Parse session if it exists
  let user = null;
  if (sessionCookie && sessionCookie.value) {
    try {
      const raw = sessionCookie.value.includes('.') ? sessionCookie.value.split('.')[0] : sessionCookie.value;
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      user = JSON.parse(decoded);
    } catch (e) {
      console.error('Proxy cookie parse failed:', e);
    }
  }

  const isRsc = request.headers.get('rsc') === '1' || request.headers.get('accept')?.includes('text/x-component');
  const redirectStatus = isRsc ? 307 : 302; // Use 302 for document navigation so browser strips RSC headers

  let response;

  // 1. Not logged in -> redirect to /login for protected routes & root /
  if (!user) {
    if (pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname === '/') {
      const loginUrl = new URL('/login', request.url);
      response = NextResponse.redirect(loginUrl, redirectStatus);
    } else {
      response = NextResponse.next();
    }
  } else {
    // 2. Logged in -> handle routing rules
    if (pathname === '/' || pathname.startsWith('/login')) {
      const target = user.role === 'ADMIN' ? '/admin' : '/staff';
      response = NextResponse.redirect(new URL(target, request.url), redirectStatus);
    } else if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
      if (pathname.startsWith('/admin/orders') || pathname.startsWith('/admin/clients')) {
        response = NextResponse.next();
      } else {
        response = NextResponse.redirect(new URL('/staff', request.url), redirectStatus);
      }
    } else if (pathname.startsWith('/staff') && user.role !== 'STAFF') {
      response = NextResponse.redirect(new URL('/admin', request.url), redirectStatus);
    } else {
      response = NextResponse.next();
    }
  }

  // Prevent browsers from caching HTML/RSC responses and mixing up RSC with document HTML
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Vary', 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept');

  return response;
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/staff/:path*'],
};
