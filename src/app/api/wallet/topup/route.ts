import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { OperationLogger } from '@/lib/operationLogger';
import { withAdminAuth } from '@/lib/auth/authMiddleware';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

async function handleTopup(request: NextRequest) {
  try {
    const { userId, amount, method, note } = await request.json();

    // 驗證必需參數
    if (!userId || !amount || amount <= 0) {
      // 記錄失敗操作
      try {
        await OperationLogger.logWalletOperation(
          'UPDATE',
          userId || 'unknown',
          amount || 0,
          'TOPUP',
          `儲值失敗: 參數錯誤 - 金額: ${amount}`,
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

    const db = getDatabaseClient();

    // 獲取用戶當前錢包
    const walletResult = await db.$queryRaw`
      SELECT id, balance FROM user_wallets WHERE user_id = ${userId}
    `;

    let walletId;
    let oldBalance = 0;

    if (Array.isArray(walletResult) && walletResult.length > 0) {
      const wallet = walletResult[0] as any;
      walletId = wallet.id;
      oldBalance = Number(wallet.balance);
    } else {
      // 如果錢包不存在，創建一個
      await db.$executeRaw`
        INSERT INTO user_wallets (user_id, balance, currency, status, createdAt, updatedAt)
        VALUES (${userId}, 0.00, 'TWD', 'ACTIVE', NOW(), NOW())
      `;
      
      const newWalletResult = await db.$queryRaw`
        SELECT id FROM user_wallets WHERE user_id = ${userId}
      `;
      
      if (Array.isArray(newWalletResult) && newWalletResult.length > 0) {
        walletId = (newWalletResult[0] as any).id;
      }
    }

    const newBalance = oldBalance + Number(amount);

    // 更新錢包餘額
    await db.$executeRaw`
      UPDATE user_wallets 
      SET balance = ${newBalance}, updatedAt = NOW()
      WHERE user_id = ${userId}
    `;

    // 驗證支付方式是否存在於 billing_channels 中，如果不存在則使用有效的默認值
    let validPaymentMethod = method;
    if (method) {
      const paymentMethodExists = await db.$queryRaw`
        SELECT code FROM billing_channels WHERE code = ${method} AND status = 1
      `;
      if (!Array.isArray(paymentMethodExists) || paymentMethodExists.length === 0) {
        console.warn(`支付方式 '${method}' 不存在或未啟用，使用默認值 'rfid'`);
        validPaymentMethod = 'rfid'; // 使用資料庫中存在且啟用的支付方式
      }
    } else {
      // 如果沒有指定支付方式，獲取第一個啟用的支付方式
      const defaultPaymentMethod = await db.$queryRaw`
        SELECT code FROM billing_channels WHERE status = 1 LIMIT 1
      `;
      validPaymentMethod = Array.isArray(defaultPaymentMethod) && defaultPaymentMethod.length > 0 
        ? defaultPaymentMethod[0].code 
        : null;
    }

    // 記錄交易
    await db.$executeRaw`
      INSERT INTO wallet_transactions (
        user_id, 
        wallet_id, 
        transaction_type, 
        amount, 
        balance_before, 
        balance_after, 
        payment_method, 
        description, 
        status, 
        createdAt, 
        updatedAt
      )
      VALUES (
        ${userId}, 
        ${walletId}, 
        'DEPOSIT', 
        ${Number(amount)}, 
        ${oldBalance}, 
        ${newBalance}, 
        ${validPaymentMethod}, 
        ${note || '管理員儲值'}, 
        'COMPLETED', 
        NOW(), 
        NOW()
      )
    `;

    // 記錄操作日誌
    try {
      await OperationLogger.logWalletOperation(
        'UPDATE',
        userId,
        Number(amount),
        'TOPUP',
        `成功儲值 $${amount} (${method || 'cash'}) - 餘額: $${oldBalance} → $${newBalance}${note ? ` - 備註: ${note}` : ''}`,
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
      message: '儲值成功',
      amount: Number(amount),
      newBalance: newBalance
    });

  } catch (error) {
    console.error('儲值錯誤:', error);
    
    // 記錄錯誤日誌
    try {
      const { userId, amount } = await request.json().catch(() => ({}));
      await OperationLogger.log({
        actionType: 'UPDATE',
        entityType: 'WALLET',
        entityId: userId || 'unknown',
        entityName: `用戶錢包: ${userId || 'unknown'}`,
        description: `儲值失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
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
      error: '儲值失敗，請稍後再試' 
    }, { status: 500 });
  }
}

// 使用認證中介軟體包裝 API
export const POST = withAdminAuth(handleTopup);
