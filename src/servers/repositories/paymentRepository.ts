/**
 * Payment Service - 統一處理第三方金流邏輯
 * 
 * 職責：
 * - 呼叫第三方金流 API
 * - 業務邏輯處理
 * - 錯誤處理和日誌
 * 
 * 數據庫操作委託給 DatabaseService
 * 支持同步模式：前端發起支付 → 後端等待 TapPay 回調 → 一次性返回最終結果
 */

import axios from 'axios';
import { nanoid } from 'nanoid';
import { databaseService } from '../../lib/database/service.js';

interface CreateOrderParams {
  userId: string;
  amount: number;
  description: string;
  metadata?: Record<string, any>;
  transactionId?: string;
}

interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  externalOrderId?: string;
  status?: string;
  amount?: number;
  payment_url?: string;  // 用於 Line Pay、優游付等需要重導向的支付方式
  message?: string;
  error?: string;
}

interface OrderStatusResult {
  success: boolean;
  orderId?: string;
  status?: string;
  amount?: number;
  paymentMethod?: string;
  paidAt?: Date;
  error?: string;
}

// 用於存儲待定訂單的回調結果（內存中的臨時存儲）
interface PendingOrder {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}

// 不再需要待定訂單機制（使用同步模式）
// const pendingOrders: Map<string, PendingOrder> = new Map();

export class PaymentRepository {
  /**
   * 建立信用卡支付訂單（TapPay）- 同步模式
   * 
   * 流程：
   * 1. 建立訂單記錄
   * 2. 呼叫 TapPay API（阻塞式，等待結果）
   * 3. 根據結果立即更新錢包
   * 4. 返回最終結果
   */
  static async createCreditCardOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const { userId, amount, description, metadata = {}, transactionId } = params;

      if (!amount || amount <= 0) {
        return {
          success: false,
          error: '金額無效'
        };
      }

      if (!metadata.prime) {
        return {
          success: false,
          error: '缺少 TapPay prime token'
        };
      }

      // 生成內部訂單ID
      const orderId = this.generateOrderId();

      // 1. 建立訂單記錄（使用 DatabaseService）
      await databaseService.createPaymentOrder({
        orderId,
        userId,
        amount,
        description,
        transactionId,
        metadata,
        paymentMethod: 'credit_card',
        idTag: metadata.idTag,
        cpid: metadata.cpid,
        cpsn: metadata.cpsn,
        connectorId: metadata.connectorId
      });

      console.log('✅ 訂單已建立:', { orderId });

      // 2. 呼叫 TapPay API（同步等待結果）
      const tapPayResult = await this.callTapPayAPI({
        orderId,
        amount,
        description,
        metadata
      });

      // 3. 根據結果更新訂單和錢包
      if (!tapPayResult.success) {
        // 支付失敗
        await databaseService.updatePaymentOrderStatus(orderId, 'FAILED');
        console.error('❌ TapPay API 呼叫失敗:', tapPayResult.error);
        return {
          success: false,
          orderId,
          status: 'FAILED',
          amount,
          message: '充值失敗',
          error: tapPayResult.error
        };
      }

      // 檢查是否需要 3D Secure 驗證
      if (tapPayResult.payment_url) {
        // 有 payment_url，表示需要 3D 驗證，訂單狀態設為 PENDING
        await databaseService.updatePaymentOrderStatus(orderId, 'PENDING');
        console.log('🔐 需要 3D Secure 驗證:', { orderId, payment_url: tapPayResult.payment_url });
        
        return {
          success: true,
          orderId,
          externalOrderId: tapPayResult.externalOrderId,
          status: 'PENDING',
          amount,
          payment_url: tapPayResult.payment_url,
          message: '請前往 3D Secure 驗證頁面'
        };
      }

      // 沒有 payment_url，表示直接扣款成功
      await databaseService.updatePaymentOrderWithCallback(
        orderId,
        {
          status: 0,
          rec_trade_id: tapPayResult.externalOrderId,
          order_number: orderId
        },
        'COMPLETED'
      );

      console.log('✅ 充值成功:', { orderId, externalOrderId: tapPayResult.externalOrderId });

      return {
        success: true,
        orderId,
        externalOrderId: tapPayResult.externalOrderId,
        status: 'COMPLETED',
        amount,
        message: '充值成功'
      };

    } catch (error) {
      console.error('❌ 建立信用卡訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '建立訂單失敗'
      };
    }
  }

  /**
   * 建立 Line Pay 支付訂單
   * 
   * 流程：
   * 1. 建立訂單記錄
   * 2. 呼叫 Line Pay API 生成支付 URL
   * 3. 返回支付 URL 給前端
   * 4. 前端導向支付頁面，完成後 Line Pay 回調
   */
  static async createLinePayOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const { userId, amount, description, metadata = {}, transactionId } = params;

      if (!amount || amount <= 0) {
        return {
          success: false,
          error: '金額無效'
        };
      }

      // 生成內部訂單ID
      const orderId = this.generateOrderId();

      // 1. 建立訂單記錄
      await databaseService.createPaymentOrder({
        orderId,
        userId,
        amount,
        description,
        transactionId,
        metadata,
        paymentMethod: 'line_pay',
        idTag: metadata.idTag,
        cpid: metadata.cpid,
        cpsn: metadata.cpsn,
        connectorId: metadata.connectorId
      });

      console.log('✅ Line Pay 訂單已建立:', { orderId });

      // 2. 呼叫 Line Pay API 生成支付 URL
      const linePayResult = await this.callLinePayAPI({
        orderId,
        amount,
        description,
        metadata
      });

      if (!linePayResult.success) {
        await databaseService.updatePaymentOrderStatus(orderId, 'FAILED');
        console.error('❌ Line Pay API 呼叫失敗:', linePayResult.error);
        return {
          success: false,
          orderId,
          status: 'FAILED',
          amount,
          message: 'Line Pay 支付初始化失敗',
          error: linePayResult.error
        };
      }

      console.log('✅ Line Pay 支付 URL 已生成:', { orderId, payment_url: linePayResult.payment_url });

      return {
        success: true,
        orderId,
        status: 'PENDING',
        amount,
        payment_url: linePayResult.payment_url,
        message: '請前往 Line Pay 支付頁面'
      };

    } catch (error) {
      console.error('❌ 建立 Line Pay 訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '建立 Line Pay 訂單失敗'
      };
    }
  }

  /**
   * 建立 EasyWallet (優游付) 支付訂單
   * 
   * 流程：
   * 1. 建立訂單記錄
   * 2. 呼叫 EasyWallet API 生成支付 URL
   * 3. 返回支付 URL 給前端
   * 4. 前端導向支付頁面，完成後 EasyWallet 回調
   */
  static async createEasyWalletOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const { userId, amount, description, metadata = {}, transactionId } = params;

      if (!amount || amount <= 0) {
        return {
          success: false,
          error: '金額無效'
        };
      }

      // 生成內部訂單ID
      const orderId = this.generateOrderId();

      // 1. 建立訂單記錄
      await databaseService.createPaymentOrder({
        orderId,
        userId,
        amount,
        description,
        transactionId,
        metadata,
        paymentMethod: 'easy_wallet',
        idTag: metadata.idTag,
        cpid: metadata.cpid,
        cpsn: metadata.cpsn,
        connectorId: metadata.connectorId
      });

      console.log('✅ EasyWallet 訂單已建立:', { orderId });

      // 2. 呼叫 EasyWallet API 生成支付 URL
      const easyWalletResult = await this.callEasyWalletAPI({
        orderId,
        amount,
        description,
        metadata
      });

      if (!easyWalletResult.success) {
        await databaseService.updatePaymentOrderStatus(orderId, 'FAILED');
        console.error('❌ EasyWallet API 呼叫失敗:', easyWalletResult.error);
        return {
          success: false,
          orderId,
          status: 'FAILED',
          amount,
          message: 'EasyWallet 支付初始化失敗',
          error: easyWalletResult.error
        };
      }

      console.log('✅ EasyWallet 支付 URL 已生成:', { orderId, payment_url: easyWalletResult.payment_url });

      return {
        success: true,
        orderId,
        status: 'PENDING',
        amount,
        payment_url: easyWalletResult.payment_url,
        message: '請前往 EasyWallet 支付頁面'
      };

    } catch (error) {
      console.error('❌ 建立 EasyWallet 訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '建立 EasyWallet 訂單失敗'
      };
    }
  }

  /**
   * 查詢訂單狀態
   */
  static async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    try {
      const order = await databaseService.getPaymentOrder(orderId);

      if (!order) {
        return {
          success: false,
          error: '訂單不存在'
        };
      }

      return {
        success: true,
        orderId: order.payment_reference,
        status: order.status,
        amount: parseFloat(order.amount),
        paymentMethod: order.payment_method,
        paidAt: order.updatedAt
      };

    } catch (error) {
      console.error('❌ 查詢訂單狀態失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '查詢訂單失敗'
      };
    }
  }

  /**
   * 從回調更新支付訂單（用於 TapPay、Line Pay 等回調）
   */
  static async updatePaymentOrderFromCallback(params: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { orderId, callbackData, status } = params;

      // 更新訂單狀態和錢包
      await databaseService.updatePaymentOrderWithCallback(
        orderId,
        callbackData,
        status
      );

      console.log('✅ 訂單已從回調更新:', { orderId, status });

      return {
        success: true
      };

    } catch (error) {
      console.error('❌ 更新訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新訂單失敗'
      };
    }
  }

  // ===== Private Methods =====

  /**
   * 呼叫 Line Pay API
   */
  private static async callLinePayAPI(params: any): Promise<{ success: boolean; payment_url?: string; error?: string }> {
    try {
      const { orderId, amount, description, metadata } = params;
      // Use TapPay as the gateway for LinePay (TapPay-only flow).
      const tappayApiUrl = process.env.TAPPAY_API_URL;

      // Build payload aligned with callTapPayAPI structure so TapPay can act as the gateway for LinePay
      const payload = {
        partner_key: process.env.TAPPAY_PARTNER_KEY,
        merchant_id: process.env.TAPPAY_LINE_PAY_MERCHANT_ID,
        prime: metadata.prime,
        amount: amount,
        currency: 'TWD',
        details: description,
        order_number: orderId,
        cardholder: {
          phone_number: metadata?.phone || '',
          name: metadata?.name || '',
          email: metadata?.email || '',
        },
        packages: [
          {
            id: orderId,
            amount: amount,
            products: [
              {
                name: description,
                quantity: 1,
                price: amount,
              }
            ]
          }
        ],
        result_url: {
          frontend_redirect_url: process.env.TAPPAY_FRONTEND_REDIRECT_URL,
          backend_notify_url: process.env.TAPPAY_BACKEND_NOTIFY_URL + '/api/payment/tappay-callback'
        },
        three_domain_secure: true,
        remember: false,
      };

      console.log('📡 呼叫 TapPay (LinePay) API as gateway (TapPay-only):', { url: tappayApiUrl, orderId, amount });

      const response = await axios.post(tappayApiUrl as string, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.TAPPAY_PARTNER_KEY,
        },
      });

      // TapPay returns status === 0 on success
      if (response.data?.status === 0) {
        console.log('✅ TapPay(LinePay):', JSON.stringify(response.data, null, 2));
        if (response.data.payment_url) {
          console.log('✅ TapPay(LinePay) API 成功並返回 payment_url:', { orderId, payment_url: response.data.payment_url });
          return { success: true, payment_url: response.data.payment_url };
        }

        const maybeUrl = response.data?.body?.info?.paymentUrl?.web || response.data?.body?.payment_url;
        if (maybeUrl) {
          console.log('✅ TapPay(LinePay) API 成功並發現 payment_url:', { orderId, payment_url: maybeUrl });
          return { success: true, payment_url: maybeUrl };
        }

        console.log('✅ TapPay(LinePay) API 成功（無 payment_url）:', { orderId });
        return { success: true };
      }

      console.error('❌ TapPay(LinePay) API 失敗:', response.data);
      return { success: false, error: response.data?.msg || response.data?.message || 'TapPay LinePay API 失敗' };
    } catch (error: any) {
      console.error('❌ Line Pay API 異常:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Line Pay API 呼叫失敗',
      };
    }
  }

  /**
   * 呼叫 EasyWallet (優游付) API
   */
  private static async callEasyWalletAPI(params: any): Promise<{ success: boolean; payment_url?: string; error?: string }> {
    try {
      const { orderId, amount, description, metadata } = params;

      // Use TapPay gateway for EasyWallet as well (build TapPay-style payload)
      const tappayApiUrl = process.env.TAPPAY_API_URL;

      const payload = {
        partner_key: process.env.TAPPAY_PARTNER_KEY,
        merchant_id: process.env.TAPPAY_EASY_WALLET_MERCHANT_ID,
        prime: metadata.prime,
        amount: amount,
        currency: 'TWD',
        details: description,
        order_number: orderId,
        cardholder: {
          phone_number: metadata?.phone || '',
          name: metadata?.name || '',
          email: metadata?.email || '',
        },
        packages: [
          {
            id: orderId,
            amount: amount,
            products: [
              {
                name: description,
                quantity: 1,
                price: amount,
              }
            ]
          }
        ],
        result_url: {
          frontend_redirect_url: process.env.TAPPAY_FRONTEND_REDIRECT_URL,
          backend_notify_url: process.env.TAPPAY_BACKEND_NOTIFY_URL + '/api/payment/tappay-callback'
        },
        payment_method: 'EASYWALLET',
        three_domain_secure: false,
        remember: false,
      };

      console.log('📡 呼叫 TapPay (EasyWallet) API as gateway:', { url: tappayApiUrl, orderId, amount });

      const response = await axios.post(tappayApiUrl as string, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.TAPPAY_PARTNER_KEY,
        },
      });

      // TapPay returns status === 0 on success
      if (response.data?.status === 0) {
        // check for payment_url
        if (response.data.payment_url) {
          console.log('✅ TapPay(EasyWallet) API 成功並返回 payment_url:', { orderId, payment_url: response.data.payment_url });
          return { success: true, payment_url: response.data.payment_url };
        }

        const maybeUrl = response.data?.body?.info?.paymentUrl?.web || response.data?.body?.payment_url;
        if (maybeUrl) {
          console.log('✅ TapPay(EasyWallet) API 成功並發現 payment_url:', { orderId, payment_url: maybeUrl });
          return { success: true, payment_url: maybeUrl };
        }

        console.log('✅ TapPay(EasyWallet) API 成功（無 payment_url）:', { orderId });
        return { success: true };
      }

      console.error('❌ TapPay(EasyWallet) API 失敗:', response.data);
      return { success: false, error: response.data?.msg || response.data?.message || 'TapPay EasyWallet API 失敗' };
    } catch (error: any) {
      console.error('❌ EasyWallet API 異常:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'EasyWallet API 呼叫失敗',
      };
    }
  }

  /**
   * 呼叫 TapPay API
   */
  private static async callTapPayAPI(params: any): Promise<{ success: boolean; externalOrderId?: string; payment_url?: string; error?: string }> {
    try {
      const { orderId, amount, description, metadata } = params;

      // TapPay API 完整 URL
      const apiUrl = process.env.TAPPAY_API_URL;
      
      const payload = {
        partner_key: process.env.TAPPAY_PARTNER_KEY,
        merchant_id: process.env.TAPPAY_MERCHANT_ID,
        prime: metadata.prime,
        amount: amount,
        currency: 'TWD',
        details: description,
        cardholder: {
          phone_number: metadata.phone || '',
          name: metadata.name || '',
          email: metadata.email || '',
        },
        order_number: orderId,
        result_url: {
          frontend_redirect_url: process.env.TAPPAY_FRONTEND_REDIRECT_URL,
          backend_notify_url: process.env.TAPPAY_BACKEND_NOTIFY_URL + '/api/payment/tappay-callback'
        },
        three_domain_secure: true,
        remember: false,
      };

      console.log('📡 呼叫 TapPay API:', { url: apiUrl, orderId, amount });

      const response = await axios.post(apiUrl as string, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.TAPPAY_PARTNER_KEY,
        },
      });

      if (response.data.status === 0) {
        
        // Print the full JSON response from TapPay for easier debugging
        console.log('✅ TapPay API 成功:', JSON.stringify(response.data, null, 2));
        
        // 檢查是否有 payment_url（3D Secure 驗證）
        if (response.data.payment_url) {
          console.log('🔐 需要 3D Secure 驗證，返回 payment_url');
          return {
            success: true,
            externalOrderId: response.data.rec_trade_id,
            payment_url: response.data.payment_url,
          };
        }
        
        // 沒有 payment_url，表示直接扣款成功
        return {
          success: true,
          externalOrderId: response.data.rec_trade_id,
        };
      } else {
        console.error('❌ TapPay API 失敗:', response.data.msg);
        return {
          success: false,
          error: response.data.msg || 'TapPay API 失敗',
        };
      }
    } catch (error: any) {
      console.error('❌ TapPay API 異常:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'TapPay API 呼叫失敗',
      };
    }
  }

  /**
   * 生成訂單ID
   */
  private static generateOrderId(): string {
    const timestamp = Date.now();
    const nanoId = nanoid(9);
    return `ORDER_${timestamp}_${nanoId}`;
  }
}
