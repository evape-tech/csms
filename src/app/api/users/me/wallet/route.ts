import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../lib/database/service.js';

// 強制動態渲染
export const dynamic = 'force-dynamic';

/**
 * 查詢當前用戶的錢包餘額
 * 
 * 支援：
 * - Cookie 認證（管理後台使用）
 * - Authorization Bearer Token 認證（外部使用者網站使用）
 * 
 * 無論是管理員還是一般用戶，都只能查詢自己的錢包
 * 
 * @route GET /api/users/me/wallet
 * @auth Cookie 或 Bearer Token
 * @returns { success: boolean, wallet: { balance, currency, status, ... } }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API /api/users/me/wallet] 查詢錢包餘額請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 獲取當前用戶（支援多種認證方式）
    const currentUser = AuthHelper.getCurrentUser(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: '未登入或 token 無效' },
        { status: 401 }
      );
    }
    
    console.log('🔍 [API /api/users/me/wallet] 當前用戶:', {
      userId: currentUser.userId,
      email: currentUser.email,
      role: currentUser.role
    });
    
    // 查詢錢包資訊
    let wallet = await databaseService.getUserWalletByUserId(currentUser.userId);
    
    // 如果錢包不存在，自動創建一個
    if (!wallet) {
      console.log('📝 [API /api/users/me/wallet] 錢包不存在，自動創建新錢包');
      wallet = await databaseService.createUserWallet(currentUser.userId, 0);
      console.log('✅ [API /api/users/me/wallet] 新錢包已創建');
    }
    
    console.log('✅ [API /api/users/me/wallet] 查詢成功:', {
      userId: currentUser.userId,
      balance: wallet.balance
    });
    
    return NextResponse.json({
      success: true,
      wallet: {
        id: Number(wallet.id),
        userId: wallet.user_id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        status: wallet.status,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        exists: true
      }
    });
    
  } catch (error) {
    console.error('[API /api/users/me/wallet] 錯誤:', error);
    return NextResponse.json(
      { error: '查詢錢包失敗' },
      { status: 500 }
    );
  }
}
