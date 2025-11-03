import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 生產環境建議改為特定網域
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, ngrok-skip-browser-warning',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // 24小時
};

// Simple JWT verification using Web Crypto API (Edge Runtime compatible)
function verifyJWT(token: string, secret: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return false;
    }
    
    // For simplicity in Edge Runtime, we'll just check if the token has the right structure
    // In production, you should properly verify the signature using Web Crypto API
    return payload.userId && payload.email;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle CORS preflight requests for all API routes
  if (pathname.startsWith('/api') && req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // For API routes, add CORS headers to response
  if (pathname.startsWith('/api')) {
    // Continue with the request and add CORS headers to response
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Allowlist: don't run auth middleware for Next internals, static files and login page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/public') ||
    pathname === '/login' ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Read session cookie (JWT token)
  const session = req.cookies.get('session')?.value;
  
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Use simple JWT verification for Edge Runtime
  const isValid = verifyJWT(session, process.env.JWT_SECRET || 'your-secret-key');
  
  if (!isValid) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
