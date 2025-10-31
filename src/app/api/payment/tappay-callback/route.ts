import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '@/lib/database/utils';
import { PaymentService } from '@/servers/services/paymentService';

export const dynamic = 'force-dynamic';

/**
 * TapPay 支付回調 API
 * 
 * POST /api/payment/tappay-callback
 * 
 * TapPay 會在支付完成後呼叫此 API 通知結果
 * 
 * Request Body (TapPay 回調格式):
 * {
 *   status: number,              // 0 表示成功，其他表示失敗
 *   msg: string,                 // 訊息
 *   rec_trade_id: string,        // TapPay 交易ID
 *   order_number: string,        // 訂單編號（我們傳給 TapPay 的）
 *   amount: number,              // 交易金額
 *   currency: string,            // 幣別
 *   acquirer: string,            // 收單銀行
 *   auth_code: string,           // 授權碼
 *   card_secret: {
 *     card_token: string,
 *     card_key: string
 *   },
 *   transaction_time_millis: number  // 交易時間戳
 * }
 * 
 * Response:
 * {
 *   success: true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const callbackData = await request.json();
    
    console.log('📥 收到 TapPay 回調:', {
      status: callbackData.status,
      orderId: callbackData.order_number,
      recTradeId: callbackData.rec_trade_id,
      amount: callbackData.amount
    });

    // 驗證必要參數
    if (!callbackData.order_number) {
      console.error('❌ TapPay 回調缺少訂單編號');
      return NextResponse.json({
        success: false,
        error: '缺少訂單編號'
      }, { status: 400 });
    }

    // 判斷支付狀態
    const paymentStatus = callbackData.status === 0 ? 'COMPLETED' : 'FAILED';

    // 更新訂單狀態和錢包
    const result = await PaymentService.updatePaymentOrderFromCallback({
      orderId: callbackData.order_number,
      callbackData: {
        status: callbackData.status,
        msg: callbackData.msg,
        rec_trade_id: callbackData.rec_trade_id,
        amount: callbackData.amount,
        currency: callbackData.currency,
        acquirer: callbackData.acquirer,
        auth_code: callbackData.auth_code,
        transaction_time_millis: callbackData.transaction_time_millis
      },
      status: paymentStatus
    });

    if (!result.success) {
      console.error('❌ 處理 TapPay 回調失敗:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    console.log(`✅ TapPay 回調處理成功: ${callbackData.order_number} - ${paymentStatus}`);

    // 返回成功給 TapPay
    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('❌ TapPay 回調處理異常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'TapPay 回調處理失敗'
    }, { status: 500 });
  }
}
