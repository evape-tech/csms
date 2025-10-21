import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 根據充電交易 ID 查詢對應的錢包扣款記錄
 * @route POST /api/users/me/wallet/transactions
 * @auth 需要認證（Bearer Token 或 Cookie）
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    // 從 body 取得 transaction_id
    const body = await request.json();
    const { transaction_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少 transaction_id 參數' 
        },
        { status: 400 }
      );
    }

    console.log(`🔍 [API /api/users/me/wallet/transactions] User: ${currentUser.userId} 查詢錢包扣款記錄`);

    // 先驗證充電交易是否存在且屬於該使用者
    let chargingTransaction = await databaseService.getTransaction(transaction_id);
    
    // 如果找不到，且是數字，則嘗試用 id 查詢
    if (!chargingTransaction && !isNaN(Number(transaction_id))) {
      chargingTransaction = await databaseService.getTransactionById(Number(transaction_id));
    }

    if (!chargingTransaction) {
      console.log(`❌ [API /api/users/me/wallet/transactions] 充電交易不存在`);
      return NextResponse.json(
        { 
          success: false, 
          error: '找不到該筆充電交易' 
        },
        { status: 404 }
      );
    }

    // 驗證充電交易是否屬於該使用者
    if (chargingTransaction.user_id !== currentUser.userId) {
      console.log(`❌ [API /api/users/me/wallet/transactions] 權限不足`);
      return NextResponse.json(
        { 
          success: false, 
          error: '無權限查看此交易的錢包記錄' 
        },
        { status: 403 }
      );
    }

    // 查詢對應的錢包扣款記錄
    const walletTransaction = await databaseService.getWalletTransactionByChargingId(
      chargingTransaction.transaction_id
    );

    if (!walletTransaction) {
      console.log(`⚠️ [API /api/users/me/wallet/transactions] 找不到對應的錢包扣款記錄`);
      return NextResponse.json(
        { 
          success: false, 
          error: '該筆充電尚未產生錢包扣款記錄',
          message: '可能充電尚未完成或使用其他支付方式'
        },
        { status: 404 }
      );
    }

    console.log(`✅ [API /api/users/me/wallet/transactions] 找到錢包扣款記錄`);

    // 返回錢包扣款詳情
    const walletTransactionData = {
      id: Number(walletTransaction.id),
      user_id: walletTransaction.user_id,
      wallet_id: walletTransaction.wallet_id,
      transaction_type: walletTransaction.transaction_type,
      amount: Number(walletTransaction.amount),
      balance_before: Number(walletTransaction.balance_before),
      balance_after: Number(walletTransaction.balance_after),
      charging_transaction_id: walletTransaction.charging_transaction_id,
      billing_record_id: walletTransaction.billing_record_id ? Number(walletTransaction.billing_record_id) : null,
      payment_method: walletTransaction.payment_method,
      payment_reference: walletTransaction.payment_reference,
      description: walletTransaction.description,
      status: walletTransaction.status,
      created_at: walletTransaction.createdAt,
      updated_at: walletTransaction.updatedAt
    };

    return NextResponse.json({
      success: true,
      walletTransaction: walletTransactionData
    });

  } catch (error) {
    console.error(`[API /api/users/me/wallet/transactions] 錯誤:`, error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢錢包扣款記錄失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
