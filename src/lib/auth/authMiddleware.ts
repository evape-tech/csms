import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from './auth';

/**
 * 認證中介軟體 - 檢查管理員權限
 * 如果用戶未登入或不是管理員，返回 401 錯誤
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  try {
    const currentUser = await AuthUtils.getCurrentUser(request);
    
    if (!currentUser) {
      return NextResponse.json({ 
        error: '未登入，請重新登入',
        redirectTo: '/login'
      }, { status: 401 });
    }

    if (!AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ 
        error: '權限不足，需要管理員權限',
        redirectTo: '/login'
      }, { status: 403 });
    }

    // 認證成功，返回 null 表示可以繼續
    return null;
  } catch (error) {
    console.error('認證檢查失敗:', error);
    return NextResponse.json({ 
      error: '認證檢查失敗，請重新登入',
      redirectTo: '/login'
    }, { status: 401 });
  }
}

/**
 * 認證裝飾器 - 包裝 API 處理函數以自動檢查認證
 */
export function withAdminAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // 檢查認證
    const authError = await requireAdmin(request);
    if (authError) {
      return authError;
    }

    // 認證通過，執行原始處理函數
    return handler(request);
  };
}

/**
 * 用於 Server Actions 的認證檢查
 */
export async function requireAdminAction(): Promise<void> {
  try {
    const currentUser = await AuthUtils.getCurrentUser();
    
    if (!currentUser) {
      throw new Error('REDIRECT:/login');
    }

    if (!AuthUtils.isAdmin(currentUser)) {
      throw new Error('REDIRECT:/login');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('REDIRECT:')) {
      const { redirect } = await import('next/navigation');
      redirect(error.message.split(':')[1]);
    }
    throw error;
  }
}
