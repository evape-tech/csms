import { NextRequest, NextResponse } from 'next/server';
import { OperationLogger } from '@/lib/operationLogger';

export async function POST(request: NextRequest) {
  try {
    // 記錄登出操作
    try {
      // 嘗試從舊 token 獲取用戶信息用於日誌記錄
      const cookieHeader = request.headers.get('cookie');
      let userEmail = 'unknown';
      
      if (cookieHeader) {
        const sessionCookie = cookieHeader
          .split(';')
          .find(c => c.trim().startsWith('session='));
        
        if (sessionCookie) {
          const token = sessionCookie.split('=')[1];
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            userEmail = decoded?.email || 'unknown';
          } catch {
            // 忽略解析錯誤
          }
        }
      }

      await OperationLogger.logAuthOperation(
        'LOGOUT',
        userEmail,
        true,
        `管理員登出 (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄登出日誌失敗:', logError);
      // 登出操作不應因日誌記錄失敗而失敗
    }

    // 創建響應並清除 session cookie
    const response = NextResponse.json({
      success: true,
      message: '登出成功'
    });

    // 清除 session cookie
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 立即過期
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('登出錯誤:', error);
    return NextResponse.json(
      { error: '登出失敗' },
      { status: 500 }
    );
  }
}
