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
 * 
 * 支付平台：
 * - TapPay：信用卡、TapPay 整合的 LINE Pay、EasyWallet（會開立發票）
 * - LINE Pay 直連：直接呼叫 LINE Pay API（不透過 TapPay，不開立發票）
 */

import axios from 'axios';
import { nanoid } from 'nanoid';
import { databaseService } from '../../lib/database/service.js';
import { InvoiceRepository } from '@/servers/repositories/invoiceRepository';
import { logger } from '@/servers/utils';
import { linePayService } from '@/servers/services/linePayService';

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
        paymentMethod: 'tappay_credit_card',
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
        // 有 payment_url，表示需要 3D 驗證，訂單狀態設為 UNPAID
        await databaseService.updatePaymentOrderStatus(orderId, 'UNPAID');
        console.log('🔐 需要 3D Secure 驗證:', { orderId, payment_url: tapPayResult.payment_url });
        
        return {
          success: true,
          orderId,
          externalOrderId: tapPayResult.externalOrderId,
          status: 'UNPAID',
          amount,
          payment_url: tapPayResult.payment_url,
          message: '請前往 3D Secure 驗證頁面'
        };
      }

      // 沒有 payment_url，表示直接扣款成功
      const updateResult = await PaymentRepository.updatePaymentOrderFromCallback({
        orderId,
        callbackData: {
          status: 0,
          rec_trade_id: tapPayResult.externalOrderId,
          order_number: orderId
        },
        status: 'PAID' // 已付款待開立發票
      });

      if (!updateResult.success) {
        logger.error('❌ 更新訂單狀態失敗（同步充值）', { orderId, error: updateResult.error });
        return {
          success: false,
          orderId,
          status: 'FAILED',
          amount,
          message: '更新訂單狀態失敗',
          error: updateResult.error
        };
      }

      // 如果支付成功，開立發票並透過 TapPay 發送給用戶
      try {
        // 獲取支付訂單資訊
        const paymentOrder = await databaseService.getPaymentOrder(orderId);
        
        if (paymentOrder) {
          // 獲取用戶資訊 (user_id 是 UUID 字串，不是數字 ID)
          const user = await databaseService.getUserByUuid(paymentOrder.user_id);
          
          if (user && user.email) {
            logger.info('📄 [發票] 開始開立發票（同步充值）', {
              orderId: orderId,
              userId: user.id,
              email: user.email
            });

            // 呼叫 TapPay 發票 API
            const invoiceResult = await InvoiceRepository.issueInvoice({
              orderId: orderId,
              amount: amount,
              customerEmail: user.email,
              customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || '顧客',
              customerPhone: user.phone || '',
              description: paymentOrder.description || '充電錢包充值',
              userId: user.uuid, // 傳入用戶 UUID，用於保存發票
              tradeId: tapPayResult.externalOrderId // 傳入交易 ID
            });

            if (invoiceResult.success) {
              await databaseService.updatePaymentOrderStatus(orderId, 'COMPLETED');
              logger.info(`✅ [發票] 發票已成功開立並透過 TapPay 發送至: ${user.email}`);
            } else {
              logger.error(`❌ [發票] 發票開立失敗，但支付已成功: ${invoiceResult.error}`);
              // 發票失敗不影響支付結果，只記錄錯誤
            }
          } else {
            logger.warn('⚠️  [發票] 無法獲取用戶 email，跳過發票開立（同步充值）');
          }
        }
      } catch (invoiceError) {
        logger.error(`⚠️  [發票] 發票處理異常，但支付已成功: ${invoiceError instanceof Error ? invoiceError.message : String(invoiceError)}`);
        // 發票異常不影響支付結果，只記錄錯誤
      }

      console.log('✅ 充值成功:', { orderId, externalOrderId: tapPayResult.externalOrderId });

      return {
        success: true,
        orderId,
        externalOrderId: tapPayResult.externalOrderId,
        status: 'SUCCESS',
        amount,
        message: '成功'
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
        paymentMethod: 'tappay_line_pay',
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
        status: 'UNPAID',
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
   * 建立 LINE Pay 直連支付訂單（不透過 TapPay）
   * 
   * ⚠️ 重要：此流程不開立發票
   * 
   * 流程：
   * 1. 建立訂單記錄
   * 2. 直接呼叫 LINE Pay Request API
   * 3. 返回支付 URL 給前端
   * 4. 用戶完成支付後，LINE Pay 回調到 /api/payment/linepay-confirm
   * 5. 確認支付後更新訂單狀態（不開立發票）
   */
  static async createDirectLinePayOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const { userId, amount, description, metadata = {}, transactionId } = params;

      if (!amount || amount <= 0) {
        return {
          success: false,
          error: '金額無效'
        };
      }

      // 檢查 LINE Pay 服務是否已配置
      if (!linePayService.isConfigured()) {
        return {
          success: false,
          error: 'LINE Pay 直連服務未配置，請檢查環境變數'
        };
      }

      // 生成內部訂單ID
      const orderId = this.generateOrderId();

      // 1. 建立訂單記錄（使用 linepay_direct 作為支付方式）
      await databaseService.createPaymentOrder({
        orderId,
        userId,
        amount,
        description,
        transactionId,
        metadata,
        paymentMethod: 'direct_line_pay', // 區分 TapPay 整合的 line_pay
        idTag: metadata.idTag,
        cpid: metadata.cpid,
        cpsn: metadata.cpsn,
        connectorId: metadata.connectorId
      });

      console.log('✅ LINE Pay 直連訂單已建立:', { orderId });

      // 2. 呼叫 LINE Pay Request API
      const linePayResult = await linePayService.createSimplePayment(
        orderId,
        amount,
        description || '充電錢包充值'
      );

      if (!linePayResult.success || !linePayResult.data) {
        await databaseService.updatePaymentOrderStatus(orderId, 'FAILED');
        console.error('❌ LINE Pay 直連 API 呼叫失敗:', linePayResult.error);
        return {
          success: false,
          orderId,
          status: 'FAILED',
          amount,
          message: 'LINE Pay 支付初始化失敗',
          error: linePayResult.error
        };
      }

      // 3. 將 LINE Pay transactionId 存入訂單（用於後續確認）
      await databaseService.updatePaymentOrderReference(
        orderId,
        linePayResult.data.transactionId,
        'UNPAID'
      );

      console.log('✅ LINE Pay 直連支付 URL 已生成:', {
        orderId,
        transactionId: linePayResult.data.transactionId,
        payment_url: linePayResult.data.paymentUrl
      });

      return {
        success: true,
        orderId,
        externalOrderId: linePayResult.data.transactionId,
        status: 'UNPAID',
        amount,
        payment_url: linePayResult.data.paymentUrl,
        message: '請前往 LINE Pay 支付頁面'
      };

    } catch (error) {
      console.error('❌ 建立 LINE Pay 直連訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '建立 LINE Pay 直連訂單失敗'
      };
    }
  }

  /**
   * 確認 LINE Pay 直連支付（供回調 API 使用）
   * 
   * ⚠️ 重要：此流程不開立發票
   * 
   * @param orderId 內部訂單 ID
   * @param transactionId LINE Pay 交易 ID
   * @param amount 金額
   */
  static async confirmDirectLinePayOrder(
    orderId: string,
    transactionId: string,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 呼叫 LINE Pay Confirm API
      const confirmResult = await linePayService.confirmPayment({
        transactionId,
        amount,
        currency: 'TWD'
      });

      if (!confirmResult.success) {
        await databaseService.updatePaymentOrderStatus(orderId, 'FAILED');
        console.error('❌ LINE Pay 確認失敗:', confirmResult.error);
        return {
          success: false,
          error: confirmResult.error
        };
      }

      // 2. 更新訂單狀態為 PAID（注意：不開立發票，直接標記為 COMPLETED）
      const updateResult = await PaymentRepository.updatePaymentOrderFromCallback({
        orderId,
        callbackData: {
          status: 0,
          rec_trade_id: transactionId,
          order_number: orderId
        },
        status: 'COMPLETED' // 直接標記為完成，不需要後續發票處理
      });

      if (!updateResult.success) {
        console.error('❌ 更新訂單狀態失敗:', updateResult.error);
        return {
          success: false,
          error: updateResult.error
        };
      }

      console.log('✅ LINE Pay 直連支付確認成功（不開立發票）:', {
        orderId,
        transactionId
      });

      return { success: true };

    } catch (error) {
      console.error('❌ 確認 LINE Pay 直連訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '確認 LINE Pay 支付失敗'
      };
    }
  }

  /**
   * 取消 LINE Pay 直連訂單
   * 
   * @param orderId 內部訂單 ID
   */
  static async cancelDirectLinePayOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 更新訂單狀態為 CANCELLED
      await databaseService.updatePaymentOrderStatus(orderId, 'CANCELLED');
      
      console.log('✅ LINE Pay 直連訂單已取消:', { orderId });

      return { success: true };

    } catch (error) {
      console.error('❌ 取消 LINE Pay 直連訂單失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消訂單失敗'
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
        paymentMethod: 'tappay_easy_wallet',
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
        status: 'UNPAID',
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

      console.log('✅ 訂單已從回調更新:', { orderId, status });

      // 更新訂單狀態和錢包
      await databaseService.updatePaymentOrderWithCallback(
        orderId,
        callbackData,
        status
      );

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

      console.log("📡 呼叫 TapPay API 載荷:", JSON.stringify(payload, null, 2));

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

      console.log("📡 呼叫 TapPay API 載荷:", JSON.stringify(payload, null, 2));

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

      console.log("📡 呼叫 TapPay API 載荷:", JSON.stringify(payload, null, 2));

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
