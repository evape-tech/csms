import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// ensure admin initialized similarly to session route
if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(path)) {
        const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin in verify route:', e);
  }
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|; )session=([^;]+)/);
    const session = match ? decodeURIComponent(match[1]) : null;
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    // verify session cookie using Firebase Admin
    const decoded = await admin.auth().verifySessionCookie(session, true);
    return NextResponse.json({ ok: true, uid: decoded.uid, email: decoded.email });
  } catch (err) {
    console.error('verify failed', err);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
