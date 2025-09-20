import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ 
      success: true, 
      message: '會話已清除，請重新登入' 
    });
    
    // Clear the session cookie by setting it to expire immediately
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/' // Ensure it clears the cookie for the entire site
    });

    return response;
  } catch (error) {
    console.error('Clear session error:', error);
    return NextResponse.json(
      { error: '清除會話失敗' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Also allow GET method for easier testing
  return POST(request);
}
