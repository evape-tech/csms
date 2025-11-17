import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '@/lib/database/utils';
import { PaymentRepository } from '@/servers/repositories/paymentRepository';
import { InvoiceRepository } from '@/servers/repositories/invoiceRepository';
import { databaseService } from '@/lib/database/service';

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
    
    // Print the full callback JSON for easier debugging (pretty-printed)
    try {
      console.log('📥 收到 TapPay 回調 (full):\n' + JSON.stringify(callbackData, null, 2));
    } catch (e) {
      // Fallback in case JSON.stringify fails
      console.log('📥 收到 TapPay 回調:', callbackData);
    }

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
    const result = await PaymentRepository.updatePaymentOrderFromCallback({
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

    // 如果支付成功，開立發票並透過 TapPay 發送給用戶
    if (paymentStatus === 'COMPLETED') {
      try {
        // 獲取支付訂單資訊
        const paymentOrder = await databaseService.getPaymentOrder(callbackData.order_number);
        
        if (paymentOrder) {
          // 獲取用戶資訊 (user_id 是 UUID 字串，不是數字 ID)
          const user = await databaseService.getUserByUuid(paymentOrder.user_id);
          
          if (user && user.email) {
            console.log('📄 開始開立發票...', {
              orderId: callbackData.order_number,
              userId: user.id,
              email: user.email
            });

            // 呼叫 TapPay 發票 API
            const invoiceResult = await InvoiceRepository.issueInvoice({
              orderId: callbackData.order_number,
              amount: callbackData.amount,
              customerEmail: user.email,
              customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || '顧客',
              customerPhone: user.phone || '',
              description: paymentOrder.description || '充電錢包充值',
              userId: user.uuid, // 傳入用戶 UUID，用於保存發票
              tradeId: callbackData.rec_trade_id // 傳入交易 ID
            });

            if (invoiceResult.success) {
              console.log('✅ 發票已成功開立並透過 TapPay 發送至:', user.email);
            } else {
              console.error('⚠️ 發票開立失敗，但支付已成功:', invoiceResult.error);
              // 發票失敗不影響支付結果，只記錄錯誤
            }
          } else {
            console.warn('⚠️ 無法獲取用戶 email，跳過發票開立');
          }
        }
      } catch (invoiceError) {
        console.error('⚠️ 發票處理異常，但支付已成功:', invoiceError);
        // 發票異常不影響支付結果，只記錄錯誤
      }
    }

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
