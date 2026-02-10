import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  iat?: number;
  exp?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Extract JWT from HTTP-only cookie
    const sessionCookie = request.cookies.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify and decode JWT
    const decoded = jwt.verify(
      sessionCookie.value,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;

    // Return user data
    return NextResponse.json({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    });
  } catch (error) {
    console.error('Auth ME endpoint error:', error);
    
    // Invalid or expired token
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}
