import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/servers/repositories/paymentRepository';
import { databaseService } from '@/lib/database/service';
import { linePayService } from '@/servers/services/linePayService';
import DatabaseUtils from '@/lib/database/utils';

export const dynamic = 'force-dynamic';

/**
 * LINE Pay 直連 - 支付確認回調 API
 * 
 * 此 API 處理 LINE Pay 直連支付完成後的確認流程
 * 用戶完成支付後，LINE Pay 會將用戶重導向到此 URL
 * 
 * ⚠️ 重要：此流程不開立發票（與 TapPay 整合的 LINE Pay 不同）
 * 
 * GET /api/payment/linepay-confirm?transactionId=xxx&orderId=xxx
 * 
 * Query Parameters:
 *   transactionId: LINE Pay 交易 ID
 *   orderId: 內部訂單 ID（我們傳給 LINE Pay 的）
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const orderId = searchParams.get('orderId');

    console.log('📥 [LINE Pay 直連確認] 收到回調:', { transactionId, orderId });

    // 驗證必要參數
    if (!transactionId) {
      console.error('❌ [LINE Pay 直連確認] 缺少 transactionId');
      return redirectToResult('error', '缺少交易 ID');
    }

    if (!orderId) {
      console.error('❌ [LINE Pay 直連確認] 缺少 orderId');
      return redirectToResult('error', '缺少訂單 ID');
    }

    // 查詢訂單資訊以獲取金額
    const paymentOrder = await databaseService.getPaymentOrder(orderId);

    if (!paymentOrder) {
      console.error('❌ [LINE Pay 直連確認] 訂單不存在:', orderId);
      return redirectToResult('error', '訂單不存在');
    }

    // 確保訂單狀態是待支付
    if (paymentOrder.status !== 'UNPAID') {
      console.warn('⚠️ [LINE Pay 直連確認] 訂單狀態非 UNPAID:', paymentOrder.status);
      // 如果已經是 COMPLETED 或 PAID，直接重導向成功頁面
      if (paymentOrder.status === 'COMPLETED' || paymentOrder.status === 'PAID') {
        return redirectToResult('success', '支付已完成');
      }
      return redirectToResult('error', '訂單狀態異常');
    }

    // 取得金額
    const amount = typeof paymentOrder.amount === 'number' 
      ? paymentOrder.amount 
      : parseFloat(paymentOrder.amount);

    console.log('🔄 [LINE Pay 直連確認] 開始確認支付:', {
      orderId,
      transactionId,
      amount
    });

    // 呼叫確認方法（不開立發票）
    const result = await PaymentRepository.confirmDirectLinePayOrder(
      orderId,
      transactionId,
      amount
    );

    if (!result.success) {
      console.error('❌ [LINE Pay 直連確認] 確認失敗:', result.error);
      return redirectToResult('error', result.error || '支付確認失敗');
    }

    console.log('✅ [LINE Pay 直連確認] 支付確認成功（不開立發票）:', {
      orderId,
      transactionId,
      amount
    });

    // 重導向到成功頁面
    return redirectToResult('success', '支付成功', orderId, amount);

  } catch (error) {
    console.error('❌ [LINE Pay 直連確認] 處理異常:', error);
    return redirectToResult('error', error instanceof Error ? error.message : '處理失敗');
  }
}

/**
 * 重導向到結果頁面
 */
function redirectToResult(
  status: 'success' | 'error',
  message: string,
  orderId?: string,
  amount?: number
): NextResponse {
  const frontendUrl = linePayService.getFrontendRedirectUrl() || process.env.LINE_PAY_FRONTEND_REDIRECT_URL;
  
  if (!frontendUrl) {
    // 如果沒有設定前端重導向 URL，返回 JSON 回應
    return NextResponse.json({
      success: status === 'success',
      message,
      orderId,
      amount,
      invoiceIssued: false // LINE Pay 直連不開立發票
    });
  }

  const params = new URLSearchParams({
    status,
    message,
    provider: 'linepay_direct',
    invoiceIssued: 'false' // LINE Pay 直連不開立發票
  });

  if (orderId) params.set('orderId', orderId);
  if (amount) params.set('amount', amount.toString());

  const redirectUrl = `${frontendUrl}?${params.toString()}`;
  
  return NextResponse.redirect(redirectUrl);
}
