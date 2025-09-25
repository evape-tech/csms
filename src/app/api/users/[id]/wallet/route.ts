import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // 驗證管理員權限
    let currentUser;
    try {
      currentUser = await AuthUtils.getCurrentUser(request);
    } catch (error) {
      throw error;
    }

    if (!currentUser || !AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ 
        error: '未授權訪問', 
        code: 'AUTHENTICATION_REQUIRED',
        message: '請重新登入以獲取有效的認證憑證'
      }, { status: 401 });
    }

    const { id: userId } = await params;
    
    if (!userId) {
      return NextResponse.json({ 
        error: '缺少用戶 ID' 
      }, { status: 400 });
    }

    const db = getDatabaseClient();

    // 獲取用戶錢包資訊
    const walletResult = await db.$queryRaw`
      SELECT balance, currency, status, createdAt, updatedAt 
      FROM user_wallets 
      WHERE user_id = ${userId}
    `;

    if (!Array.isArray(walletResult) || walletResult.length === 0) {
      // 如果錢包不存在，返回預設值
      return NextResponse.json({
        balance: 0,
        currency: 'TWD',
        status: 'ACTIVE'
      });
    }

    const wallet = walletResult[0] as any;

    return NextResponse.json({
      balance: Number(wallet.balance),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    });

  } catch (error) {
    console.error('獲取錢包資訊錯誤:', error);
    return NextResponse.json({ 
      error: '獲取錢包資訊失敗' 
    }, { status: 500 });
  }
}
