import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '../../../../lib/auth/auth';
import { OperationLogger } from '../../../../lib/operationLogger';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 在清除 session 前先獲取用戶信息用於日誌記錄
    let userEmail = 'unknown';
    try {
      const currentUser = await AuthUtils.getCurrentUser(request);
      if (currentUser && currentUser.email) {
        userEmail = currentUser.email;
      }
    } catch (error) {
      console.log('無法獲取當前用戶信息 (可能已過期):', error);
    }

    const res = NextResponse.json({ ok: true });
    // clear session cookie
    res.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    // 記錄登出日誌
    try {
      await OperationLogger.logAuthOperation(
        'LOGOUT',
        userEmail,
        true,
        `管理員登出 (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄登出日誌錯誤:', logError);
      // 登出成功但日誌記錄失敗，不影響登出流程
    }
    
    return res;
  } catch (err) {
    console.error('Failed to clear session cookie', err);
    
    // 記錄登出失敗日誌
    try {
      await OperationLogger.logAuthOperation(
        'LOGOUT',
        'unknown',
        false,
        `登出失敗: ${err instanceof Error ? err.message : 'Unknown error'} (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄登出失敗日誌錯誤:', logError);
    }
    
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
