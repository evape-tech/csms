/**
 * LINE Pay 直連 API 服務
 * 
 * 此服務直接與 LINE Pay API 通訊，不透過 TapPay
 * 
 * LINE Pay API v3 文檔：
 * https://pay.line.me/documents/online_v3.html
 * 
 * 主要功能：
 * 1. Request API (Reserve) - 建立支付請求
 * 2. Confirm API - 確認支付
 * 3. Refund API - 退款
 * 4. Check Payment Status API - 查詢支付狀態
 * 
 * 注意：此流程不開立發票
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';

// 簡易 logger（因為 utils/logger 是 CommonJS 模組）
const logger = {
  info: (message: string, data?: any) => console.log(`ℹ️ ${message}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (message: string, data?: any) => console.warn(`⚠️ ${message}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (message: string, data?: any) => console.error(`❌ ${message}`, data ? JSON.stringify(data, null, 2) : ''),
};

// =====================================
// 類型定義
// =====================================

/** LINE Pay 配置 */
interface LinePayConfig {
  channelId: string;
  channelSecret: string;
  apiUrl: string;
  confirmUrl: string;
  cancelUrl: string;
  frontendRedirectUrl: string;
}

/** 產品資訊 */
interface LinePayProduct {
  id?: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  price: number;
}

/** 套餐資訊 */
interface LinePayPackage {
  id: string;
  amount: number;
  userFee?: number;
  name?: string;
  products: LinePayProduct[];
}

/** 重導向 URL */
interface LinePayRedirectUrls {
  confirmUrl: string;
  cancelUrl: string;
}

/** Request API 請求參數 */
interface LinePayRequestParams {
  orderId: string;
  amount: number;
  currency?: string;
  packages: LinePayPackage[];
  redirectUrls?: LinePayRedirectUrls;
  options?: {
    display?: {
      locale?: string;
      checkConfirmUrlBrowser?: boolean;
    };
    shipping?: {
      type?: string;
      feeAmount?: number;
      feeInquiryUrl?: string;
      feeInquiryType?: string;
      addressChanged?: string;
    };
    familyService?: {
      addFriends?: Array<{
        type: string;
        idList: string[];
      }>;
    };
    extra?: {
      branchName?: string;
      branchId?: string;
    };
  };
}

/** Request API 回應 */
interface LinePayRequestResponse {
  returnCode: string;
  returnMessage: string;
  info?: {
    paymentUrl: {
      web: string;
      app: string;
    };
    transactionId: string;
    paymentAccessToken: string;
  };
}

/** Confirm API 請求參數 */
interface LinePayConfirmParams {
  transactionId: string;
  amount: number;
  currency?: string;
}

/** Confirm API 回應 */
interface LinePayConfirmResponse {
  returnCode: string;
  returnMessage: string;
  info?: {
    transactionId: string;
    orderId: string;
    payInfo: Array<{
      method: string;
      amount: number;
    }>;
    packages: LinePayPackage[];
  };
}

/** Refund API 請求參數 */
interface LinePayRefundParams {
  transactionId: string;
  refundAmount?: number;
}

/** Refund API 回應 */
interface LinePayRefundResponse {
  returnCode: string;
  returnMessage: string;
  info?: {
    refundTransactionId: string;
    refundTransactionDate: string;
  };
}

/** 支付狀態查詢回應 */
interface LinePayStatusResponse {
  returnCode: string;
  returnMessage: string;
  info?: Array<{
    transactionId: string;
    transactionDate: string;
    transactionType: string;
    payInfo: Array<{
      method: string;
      amount: number;
    }>;
    productName: string;
    currency: string;
    orderId: string;
    refundList?: Array<{
      refundTransactionId: string;
      transactionType: string;
      refundAmount: number;
      refundTransactionDate: string;
    }>;
  }>;
}

/** 通用服務回應 */
interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// =====================================
// LINE Pay 服務類別
// =====================================

export class LinePayService {
  private config: LinePayConfig;
  private httpClient: AxiosInstance;

  constructor() {
    this.config = this.loadConfig();
    this.httpClient = this.createHttpClient();
  }

  /**
   * 載入 LINE Pay 配置
   */
  private loadConfig(): LinePayConfig {
    const channelId = process.env.LINE_PAY_CHANNEL_ID;
    const channelSecret = process.env.LINE_PAY_CHANNEL_SECRET;
    const apiUrl = process.env.LINE_PAY_API_URL || 'https://sandbox-api-pay.line.me';
    const confirmUrl = process.env.LINE_PAY_CONFIRM_URL || '';
    const cancelUrl = process.env.LINE_PAY_CANCEL_URL || '';
    const frontendRedirectUrl = process.env.LINE_PAY_FRONTEND_REDIRECT_URL || '';

    if (!channelId || !channelSecret) {
      logger.warn('⚠️ LINE Pay 配置不完整，請檢查環境變數 LINE_PAY_CHANNEL_ID 和 LINE_PAY_CHANNEL_SECRET');
    }

    return {
      channelId: channelId || '',
      channelSecret: channelSecret || '',
      apiUrl,
      confirmUrl,
      cancelUrl,
      frontendRedirectUrl,
    };
  }

  /**
   * 建立 HTTP 客戶端
   */
  private createHttpClient(): AxiosInstance {
    return axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 生成 HMAC SHA256 簽名
   * 
   * LINE Pay API v3 簽名規則：
   * Signature = Base64(HMAC-SHA256(ChannelSecret, (ChannelSecret + URI + RequestBody + Nonce)))
   */
  private generateSignature(uri: string, requestBody: string, nonce: string): string {
    const message = this.config.channelSecret + uri + requestBody + nonce;
    const hmac = crypto.createHmac('sha256', this.config.channelSecret);
    hmac.update(message);
    return hmac.digest('base64');
  }

  /**
   * 生成隨機 Nonce
   */
  private generateNonce(): string {
    return crypto.randomUUID();
  }

  /**
   * 取得認證 Headers
   */
  private getAuthHeaders(uri: string, requestBody: string): Record<string, string> {
    const nonce = this.generateNonce();
    const signature = this.generateSignature(uri, requestBody, nonce);

    return {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': this.config.channelId,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    };
  }

  /**
   * 檢查配置是否有效
   */
  public isConfigured(): boolean {
    return !!(this.config.channelId && this.config.channelSecret);
  }

  /**
   * Request API (Reserve) - 建立支付請求
   * 
   * 此 API 會返回支付 URL，用戶需要被重導向到該 URL 完成支付
   * 
   * @param params 請求參數
   * @returns 包含支付 URL 和交易 ID 的回應
   */
  async requestPayment(params: LinePayRequestParams): Promise<ServiceResponse<LinePayRequestResponse['info']>> {
    const uri = '/v3/payments/request';
    
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'LINE Pay 配置不完整',
          errorCode: 'CONFIG_ERROR',
        };
      }

      // 建立請求 body
      const requestBody = {
        amount: params.amount,
        currency: params.currency || 'TWD',
        orderId: params.orderId,
        packages: params.packages,
        redirectUrls: params.redirectUrls || {
          confirmUrl: this.config.confirmUrl,
          cancelUrl: this.config.cancelUrl,
        },
        options: params.options,
      };

      const bodyString = JSON.stringify(requestBody);
      const headers = this.getAuthHeaders(uri, bodyString);

      logger.info('📡 [LINE Pay] 發送 Request API', {
        orderId: params.orderId,
        amount: params.amount,
        uri,
      });

      const response = await this.httpClient.post<LinePayRequestResponse>(uri, requestBody, { headers });

      if (response.data.returnCode === '0000') {
        logger.info('✅ [LINE Pay] Request API 成功', {
          orderId: params.orderId,
          transactionId: response.data.info?.transactionId,
          paymentUrl: response.data.info?.paymentUrl.web,
        });

        return {
          success: true,
          data: response.data.info,
        };
      } else {
        logger.error('❌ [LINE Pay] Request API 失敗', {
          orderId: params.orderId,
          returnCode: response.data.returnCode,
          returnMessage: response.data.returnMessage,
        });

        return {
          success: false,
          error: response.data.returnMessage,
          errorCode: response.data.returnCode,
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError<LinePayRequestResponse>;
      logger.error('❌ [LINE Pay] Request API 異常', {
        orderId: params.orderId,
        error: axiosError.response?.data || axiosError.message,
      });

      return {
        success: false,
        error: axiosError.response?.data?.returnMessage || axiosError.message || 'Request API 呼叫失敗',
        errorCode: axiosError.response?.data?.returnCode || 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Confirm API - 確認支付
   * 
   * 用戶完成支付後，LINE Pay 會重導向到 confirmUrl，
   * 此時需要呼叫此 API 來確認並完成交易
   * 
   * @param params 確認參數
   * @returns 確認結果
   */
  async confirmPayment(params: LinePayConfirmParams): Promise<ServiceResponse<LinePayConfirmResponse['info']>> {
    const uri = `/v3/payments/requests/${params.transactionId}/confirm`;

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'LINE Pay 配置不完整',
          errorCode: 'CONFIG_ERROR',
        };
      }

      const requestBody = {
        amount: params.amount,
        currency: params.currency || 'TWD',
      };

      const bodyString = JSON.stringify(requestBody);
      const headers = this.getAuthHeaders(uri, bodyString);

      logger.info('📡 [LINE Pay] 發送 Confirm API', {
        transactionId: params.transactionId,
        amount: params.amount,
      });

      const response = await this.httpClient.post<LinePayConfirmResponse>(uri, requestBody, { headers });

      if (response.data.returnCode === '0000') {
        logger.info('✅ [LINE Pay] Confirm API 成功', {
          transactionId: params.transactionId,
          orderId: response.data.info?.orderId,
        });

        return {
          success: true,
          data: response.data.info,
        };
      } else {
        logger.error('❌ [LINE Pay] Confirm API 失敗', {
          transactionId: params.transactionId,
          returnCode: response.data.returnCode,
          returnMessage: response.data.returnMessage,
        });

        return {
          success: false,
          error: response.data.returnMessage,
          errorCode: response.data.returnCode,
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError<LinePayConfirmResponse>;
      logger.error('❌ [LINE Pay] Confirm API 異常', {
        transactionId: params.transactionId,
        error: axiosError.response?.data || axiosError.message,
      });

      return {
        success: false,
        error: axiosError.response?.data?.returnMessage || axiosError.message || 'Confirm API 呼叫失敗',
        errorCode: axiosError.response?.data?.returnCode || 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Refund API - 退款
   * 
   * @param params 退款參數
   * @returns 退款結果
   */
  async refundPayment(params: LinePayRefundParams): Promise<ServiceResponse<LinePayRefundResponse['info']>> {
    const uri = `/v3/payments/requests/${params.transactionId}/refund`;

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'LINE Pay 配置不完整',
          errorCode: 'CONFIG_ERROR',
        };
      }

      const requestBody: Record<string, any> = {};
      if (params.refundAmount !== undefined) {
        requestBody.refundAmount = params.refundAmount;
      }

      const bodyString = JSON.stringify(requestBody);
      const headers = this.getAuthHeaders(uri, bodyString);

      logger.info('📡 [LINE Pay] 發送 Refund API', {
        transactionId: params.transactionId,
        refundAmount: params.refundAmount,
      });

      const response = await this.httpClient.post<LinePayRefundResponse>(uri, requestBody, { headers });

      if (response.data.returnCode === '0000') {
        logger.info('✅ [LINE Pay] Refund API 成功', {
          transactionId: params.transactionId,
          refundTransactionId: response.data.info?.refundTransactionId,
        });

        return {
          success: true,
          data: response.data.info,
        };
      } else {
        logger.error('❌ [LINE Pay] Refund API 失敗', {
          transactionId: params.transactionId,
          returnCode: response.data.returnCode,
          returnMessage: response.data.returnMessage,
        });

        return {
          success: false,
          error: response.data.returnMessage,
          errorCode: response.data.returnCode,
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError<LinePayRefundResponse>;
      logger.error('❌ [LINE Pay] Refund API 異常', {
        transactionId: params.transactionId,
        error: axiosError.response?.data || axiosError.message,
      });

      return {
        success: false,
        error: axiosError.response?.data?.returnMessage || axiosError.message || 'Refund API 呼叫失敗',
        errorCode: axiosError.response?.data?.returnCode || 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Check Payment Status API - 查詢支付狀態
   * 
   * @param transactionId LINE Pay 交易 ID
   * @returns 支付狀態
   */
  async checkPaymentStatus(transactionId: string): Promise<ServiceResponse<LinePayStatusResponse['info']>> {
    const uri = `/v3/payments/requests/${transactionId}/check`;

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'LINE Pay 配置不完整',
          errorCode: 'CONFIG_ERROR',
        };
      }

      // GET 請求不需要 body
      const headers = this.getAuthHeaders(uri, '');

      logger.info('📡 [LINE Pay] 發送 Check Payment Status API', {
        transactionId,
      });

      const response = await this.httpClient.get<LinePayStatusResponse>(uri, { headers });

      if (response.data.returnCode === '0000') {
        logger.info('✅ [LINE Pay] Check Payment Status API 成功', {
          transactionId,
          info: response.data.info,
        });

        return {
          success: true,
          data: response.data.info,
        };
      } else {
        logger.error('❌ [LINE Pay] Check Payment Status API 失敗', {
          transactionId,
          returnCode: response.data.returnCode,
          returnMessage: response.data.returnMessage,
        });

        return {
          success: false,
          error: response.data.returnMessage,
          errorCode: response.data.returnCode,
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError<LinePayStatusResponse>;
      logger.error('❌ [LINE Pay] Check Payment Status API 異常', {
        transactionId,
        error: axiosError.response?.data || axiosError.message,
      });

      return {
        success: false,
        error: axiosError.response?.data?.returnMessage || axiosError.message || 'Check Payment Status API 呼叫失敗',
        errorCode: axiosError.response?.data?.returnCode || 'NETWORK_ERROR',
      };
    }
  }

  /**
   * 建立簡化的支付請求（用於錢包充值等場景）
   * 
   * @param orderId 訂單 ID
   * @param amount 金額
   * @param productName 產品名稱
   * @returns 支付 URL 和交易資訊
   */
  async createSimplePayment(
    orderId: string,
    amount: number,
    productName: string
  ): Promise<ServiceResponse<{ paymentUrl: string; transactionId: string }>> {
    const result = await this.requestPayment({
      orderId,
      amount,
      currency: 'TWD',
      packages: [
        {
          id: orderId,
          amount,
          name: productName,
          products: [
            {
              name: productName,
              quantity: 1,
              price: amount,
            },
          ],
        },
      ],
    });

    if (result.success && result.data) {
      return {
        success: true,
        data: {
          paymentUrl: result.data.paymentUrl.web,
          transactionId: result.data.transactionId,
        },
      };
    }

    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  /**
   * 取得前端重導向 URL
   */
  public getFrontendRedirectUrl(): string {
    return this.config.frontendRedirectUrl;
  }
}

// 導出單例實例
export const linePayService = new LinePayService();
