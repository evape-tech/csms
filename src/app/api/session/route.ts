import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin SDK: prefer GOOGLE_APPLICATION_CREDENTIALS file, fallback to FIREBASE_SERVICE_ACCOUNT env
if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(path)) {
        const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        console.warn('GOOGLE_APPLICATION_CREDENTIALS file not found at', path);
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    } else {
      console.warn('No Firebase service account provided via GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT');
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idToken = body.idToken;
    const nextUrl = body.next || '/dashboard';

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    if (!admin.apps.length) {
      // Admin not initialized - fall back to setting a cookie with the raw idToken (insecure)
      // This is only a temporary fallback for development. Do NOT use in production.
      const redirectUrl = nextUrl.startsWith('http') ? nextUrl : new URL(nextUrl, req.url).toString();
      const res = NextResponse.redirect(redirectUrl);
      // set cookie for 30 days
      res.cookies.set('session', idToken, {
        httpOnly: true,
        secure: false, // 內網 HTTP 訪問需要設為 false
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days (in seconds)
      });
      return res;
    }

    // Create a secure session cookie using Firebase Admin
    const expiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    const redirectUrl = nextUrl.startsWith('http') ? nextUrl : new URL(nextUrl, req.url).toString();
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: false, // 內網 HTTP 訪問需要設為 false
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn / 1000,
    });

    return response;
  } catch (err) {
    console.error('Failed to create session:', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
