import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '@/lib/auth/authHelper';
import DatabaseUtils from '@/lib/database/utils';
import { PaymentRepository } from '@/servers/repositories/paymentRepository';

export const dynamic = 'force-dynamic';
export const maxDuration = 35; // 允許最多 35 秒

/**
 * 建立支付訂單（多種支付方式）
 * 
 * 支持的支付方式：
 * 1. credit_card (TapPay) - 同步直接扣款
 * 2. line_pay (Line Pay) - 返回支付 URL
 * 3. easy_wallet (EasyWallet/優游付) - 返回支付 URL
 * 
 * POST /api/users/me/payment/create-order
 * 
 * Request Body:
 * {
 *   amount: number,
 *   description: string,
 *   paymentMethod: "credit_card" | "line_pay" | "easy_wallet",
 *   transactionId?: string,
 *   metadata: {
 *     // For credit_card
 *     prime?: string,
 *     
 *     // Common
 *     name?: string,
 *     phone?: string,
 *     email?: string
 *   }
 * }
 * 
 * Success Response (200):
 * 
 * Credit Card:
 * {
 *   success: true,
 *   orderId: "ORDER_xxx",
 *   externalOrderId: "REC_xxx",
 *   status: "COMPLETED" | "FAILED",
 *   amount: 1000,
 *   paymentUrl?: undefined,
 *   message: "充值成功" | "充值失敗"
 * }
 * 
* Line Pay / EasyWallet:
 * {
 *   success: true,
 *   orderId: "ORDER_xxx",
 *   status: "PENDING",
 *   amount: 1000,
  paymentUrl: "https://pay.line.me/..." or "https://easywallet.com.tw/",
 *   message: "請前往支付頁面"
 * }
 * 
 * Error Response (400/401/500):
 * {
 *   success: false,
 *   error: "錯誤訊息"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證用戶身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: '未登入或 token 無效'
      }, { status: 401 });
    }

    const body = await request.json();
    const { amount, description, paymentMethod = 'credit_card', transactionId, metadata } = body;

    // 驗證必要參數
    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: '金額無效'
      }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({
        success: false,
        error: '訂單描述不能為空'
      }, { status: 400 });
    }

    console.log('🚀 開始建立支付訂單:', { userId: currentUser.userId, amount, paymentMethod });

    const paymentProvider = process.env.PAYMENT_PROVIDER || 'tappay';
    let result;
    switch (paymentMethod) {
      case 'tappay_credit':
        if (!metadata?.prime) {
          return NextResponse.json({
            success: false,
            error: '信用卡支付缺少 prime token'
          }, { status: 400 });
        }
        result = await PaymentRepository.createCreditCardOrder({
          userId: currentUser.userId,
          amount,
          description,
          transactionId,
          metadata
        });
        break;
      case 'tappay_linepay':
        result = await PaymentRepository.createLinePayOrder({
            userId: currentUser.userId,
            amount,
            description,
            transactionId,
            metadata
          });
        break;
      case 'direct_linepay':
        result = await PaymentRepository.createDirectLinePayOrder({
          userId: currentUser.userId,
          amount,
          description,
          transactionId,
          metadata
        });
        break;
      case 'tappay_easywallet':
        result = await PaymentRepository.createEasyWalletOrder({
          userId: currentUser.userId,
          amount,
          description,
          transactionId,
          metadata
        });
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `不支持的支付方式: ${paymentMethod}`
        }, { status: 400 });
    }

    if (!result?.success) {
      console.error('❌ 建立支付訂單失敗:', result?.error);
      return NextResponse.json({
        success: false,
        error: result?.error || '建立支付訂單失敗'
      }, { status: 400 });
    }

    console.log('✅ 支付訂單已建立:', { orderId: result.orderId, paymentMethod });

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      externalOrderId: result.externalOrderId,
      status: result.status,
      amount: result.amount,
      payment_url: result.payment_url,
      message: result.message
    });

  } catch (error) {
    console.error('❌ 建立支付訂單異常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '建立訂單失敗'
    }, { status: 500 });
  }
}

