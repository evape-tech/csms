import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { OperationLogger } from '@/lib/operationLogger';
import { withAdminAuth } from '@/lib/auth/authMiddleware';

async function handleDeduct(request: NextRequest) {
  try {
    const { userId, amount, reason, note } = await request.json();

    // 驗證必需參數
    if (!userId || !amount || amount <= 0) {
      // 記錄失敗操作
      try {
        await OperationLogger.logWalletOperation(
          'UPDATE',
          userId || 'unknown',
          amount || 0,
          'DEDUCT',
          `扣款失敗: 參數錯誤 - 金額: ${amount}`,
          request
        );
      } catch (logError) {
        if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
          return NextResponse.json({ 
            error: '認證已過期，請重新登入',
            redirectTo: '/login'
          }, { status: 401 });
        }
      }
      
      return NextResponse.json({ 
        error: '缺少必需參數或金額無效' 
      }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      // 記錄失敗操作
      try {
        await OperationLogger.logWalletOperation(
          'UPDATE',
          userId,
          Number(amount),
          'DEDUCT',
          `扣款失敗: 未提供扣款原因`,
          request
        );
      } catch (logError) {
        if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
          return NextResponse.json({ 
            error: '認證已過期，請重新登入',
            redirectTo: '/login'
          }, { status: 401 });
        }
      }
      
      return NextResponse.json({ 
        error: '請提供扣款原因' 
      }, { status: 400 });
    }

    const db = getDatabaseClient();

    // 獲取用戶當前錢包
    const walletResult = await db.$queryRaw`
      SELECT id, balance FROM user_wallets WHERE user_id = ${userId}
    `;

    if (!Array.isArray(walletResult) || walletResult.length === 0) {
      // 記錄失敗操作
      try {
        await OperationLogger.logWalletOperation(
          'UPDATE',
          userId,
          Number(amount),
          'DEDUCT',
          `扣款失敗: 用戶錢包不存在`,
          request
        );
      } catch (logError) {
        if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
          return NextResponse.json({ 
            error: '認證已過期，請重新登入',
            redirectTo: '/login'
          }, { status: 401 });
        }
      }
      
      return NextResponse.json({ 
        error: '用戶錢包不存在' 
      }, { status: 404 });
    }

    const wallet = walletResult[0] as any;
    const walletId = wallet.id;
    const oldBalance = Number(wallet.balance);

    // 檢查餘額是否足夠
    if (oldBalance < Number(amount)) {
      // 記錄失敗操作
      try {
        await OperationLogger.logWalletOperation(
          'UPDATE',
          userId,
          Number(amount),
          'DEDUCT',
          `扣款失敗: 餘額不足 (目前餘額: $${oldBalance}, 扣款金額: $${amount})`,
          request
        );
      } catch (logError) {
        if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
          return NextResponse.json({ 
            error: '認證已過期，請重新登入',
            redirectTo: '/login'
          }, { status: 401 });
        }
      }
      
      return NextResponse.json({ 
        error: `餘額不足，目前餘額：$${oldBalance.toFixed(2)}` 
      }, { status: 400 });
    }

    const newBalance = oldBalance - Number(amount);

    // 更新錢包餘額
    await db.$executeRaw`
      UPDATE user_wallets 
      SET balance = ${newBalance}, updatedAt = NOW()
      WHERE user_id = ${userId}
    `;

    // 記錄交易
    await db.$executeRaw`
      INSERT INTO wallet_transactions (
        user_id, 
        wallet_id, 
        transaction_type, 
        amount, 
        balance_before, 
        balance_after, 
        description, 
        status, 
        createdAt, 
        updatedAt
      )
      VALUES (
        ${userId}, 
        ${walletId}, 
        'WITHDRAWAL', 
        ${Number(amount)}, 
        ${oldBalance}, 
        ${newBalance}, 
        ${`${reason}${note ? ` - ${note}` : ''}`}, 
        'COMPLETED', 
        NOW(), 
        NOW()
      )
    `;

    // 記錄成功操作日誌
    try {
      await OperationLogger.logWalletOperation(
        'UPDATE',
        userId,
        Number(amount),
        'DEDUCT',
        `成功扣款 $${amount} - 原因: ${reason} - 餘額: $${oldBalance} → $${newBalance}${note ? ` - 備註: ${note}` : ''}`,
        request
      );
    } catch (logError) {
      if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
        return NextResponse.json({ 
          error: '認證已過期，請重新登入',
          redirectTo: '/login'
        }, { status: 401 });
      }
      console.error('日誌記錄失敗:', logError);
    }

    return NextResponse.json({
      success: true,
      message: '扣款成功',
      amount: Number(amount),
      newBalance: newBalance
    });

  } catch (error) {
    console.error('扣款錯誤:', error);
    
    // 記錄錯誤日誌
    try {
      const { userId, amount } = await request.json().catch(() => ({}));
      await OperationLogger.log({
        actionType: 'UPDATE',
        entityType: 'WALLET',
        entityId: userId || 'unknown',
        entityName: `用戶錢包: ${userId || 'unknown'}`,
        description: `扣款失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      if (logError instanceof Error && logError.message === 'AUTHENTICATION_REQUIRED') {
        return NextResponse.json({ 
          error: '認證已過期，請重新登入',
          redirectTo: '/login'
        }, { status: 401 });
      }
      console.error('錯誤日誌記錄失敗:', logError);
    }
    
    return NextResponse.json({ 
      error: '扣款失敗，請稍後再試' 
    }, { status: 500 });
  }
}

// 使用認證中介軟體包裝 API
export const POST = withAdminAuth(handleDeduct);
