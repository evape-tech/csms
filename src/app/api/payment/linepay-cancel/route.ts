import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/servers/repositories/paymentRepository';
import { databaseService } from '@/lib/database/service';
import { linePayService } from '@/servers/services/linePayService';
import DatabaseUtils from '@/lib/database/utils';

export const dynamic = 'force-dynamic';

/**
 * LINE Pay 直連 - 支付取消回調 API
 * 
 * 此 API 處理用戶在 LINE Pay 支付頁面取消支付的情況
 * 用戶取消支付後，LINE Pay 會將用戶重導向到此 URL
 * 
 * GET /api/payment/linepay-cancel?orderId=xxx
 * 
 * Query Parameters:
 *   orderId: 內部訂單 ID
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const transactionId = searchParams.get('transactionId');

    console.log('📥 [LINE Pay 直連取消] 收到回調:', { orderId, transactionId });

    // orderId 是必要的
    if (!orderId) {
      console.error('❌ [LINE Pay 直連取消] 缺少 orderId');
      return redirectToResult('cancelled', '缺少訂單 ID');
    }

    // 查詢訂單資訊
    const paymentOrder = await databaseService.getPaymentOrder(orderId);

    if (!paymentOrder) {
      console.error('❌ [LINE Pay 直連取消] 訂單不存在:', orderId);
      return redirectToResult('cancelled', '訂單不存在');
    }

    // 確保是 LINE Pay 直連訂單
    if (paymentOrder.payment_method !== 'linepay_direct') {
      console.warn('⚠️ [LINE Pay 直連取消] 訂單支付方式不符:', paymentOrder.payment_method);
    }

    // 取消訂單
    const result = await PaymentRepository.cancelDirectLinePayOrder(orderId);

    if (!result.success) {
      console.error('❌ [LINE Pay 直連取消] 取消訂單失敗:', result.error);
      // 即使取消失敗，也重導向到取消頁面
    }

    console.log('✅ [LINE Pay 直連取消] 訂單已取消:', { orderId });

    // 重導向到取消結果頁面
    return redirectToResult('cancelled', '支付已取消', orderId);

  } catch (error) {
    console.error('❌ [LINE Pay 直連取消] 處理異常:', error);
    return redirectToResult('cancelled', error instanceof Error ? error.message : '處理失敗');
  }
}

/**
 * 重導向到結果頁面
 */
function redirectToResult(
  status: 'cancelled' | 'error',
  message: string,
  orderId?: string
): NextResponse {
  const frontendUrl = linePayService.getFrontendRedirectUrl() || process.env.LINE_PAY_FRONTEND_REDIRECT_URL;
  
  if (!frontendUrl) {
    // 如果沒有設定前端重導向 URL，返回 JSON 回應
    return NextResponse.json({
      success: false,
      status,
      message,
      orderId,
      provider: 'linepay_direct'
    });
  }

  const params = new URLSearchParams({
    status,
    message,
    provider: 'linepay_direct'
  });

  if (orderId) params.set('orderId', orderId);

  const redirectUrl = `${frontendUrl}?${params.toString()}`;
  
  return NextResponse.redirect(redirectUrl);
}
