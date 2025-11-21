/**
 * Invoice Service - TapPay 發票管理服務
 * 
 * 職責：
 * - 呼叫 TapPay 發票 API 開立發票
 * - 將發票資訊保存到資料庫
 * - 發票會透過 TapPay 平台自動寄送郵件給用戶
 */

const axios = require('axios');
// databaseService is ESM, so we need to import it dynamically or assume it's handled.
// But this file is being converted to CJS.
// We will handle databaseService injection or dynamic import.

class InvoiceRepository {
  /**
   * 開立發票並透過 TapPay 發送給用戶
   * 
   * TapPay 發票 API 會自動將發票寄送到客戶的 email
   */
  static async issueInvoice(params) {
    try {
      const { orderId, amount, customerEmail, customerName, customerPhone, description, userId, tradeId } = params;

      if (!orderId || !amount || !customerEmail) {
        return {
          success: false,
          error: '缺少必要參數: orderId, amount, customerEmail'
        };
      }

      const invoiceUrl = process.env.TAPPAY_INVOICE_URL;
      if (!invoiceUrl) {
        console.warn('⚠️ TAPPAY_INVOICE_URL 未配置，跳過發票開立');
        return {
          success: false,
          error: 'TapPay 發票 API 未配置'
        };
      }

      const partnerKey = process.env.TAPPAY_PARTNER_KEY;

      if (!partnerKey) {
        console.error('❌ TAPPAY_PARTNER_KEY 或 TAPPAY_MERCHANT_ID 未配置');
        return {
          success: false,
          error: 'TapPay 認證資訊未配置'
        };
      }

      // 根據 TapPay 發票 API 文檔構建請求
      // 訂單日期格式: YYYYMMDD
      const orderDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      // 計算稅額 (台灣稅率 5%)
      const taxRate = 0.05;
      const salesAmount = Math.round(amount / (1 + taxRate)); // 未稅金額
      const taxAmount = amount - salesAmount; // 稅額
      
      const payload = {
        partner_key: partnerKey,
        order_number: orderId,
        order_date: orderDate,
        
        // 賣方資訊 (您的公司資訊，需要從環境變數配置)
        seller_name: process.env.COMPANY_NAME || 'Evape Tech',
        seller_identifier: process.env.COMPANY_TAX_ID || '00000000', // 需要配置真實的統編
        
        // 買方資訊 (B2C - 一般消費者)
        buyer_email: customerEmail,
        buyer_name: customerName || '顧客',
        buyer_cell_phone: customerPhone || '',
        
        // 發票類型與通知設定
        issue_notify_email: 'AUTO', // 自動寄送發票通知信
        invoice_type: 1, // 一般稅額
        
        // 金額資訊
        currency: 'TWD',
        total_amount: amount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        sales_amount: salesAmount, // 應稅銷售額
        zero_tax_sales_amount: 0,
        free_tax_sales_amount: 0,
        
        // 付款方式
        payment_type: 'CREDIT_CARD',
        
        // 銷售品項明細
        details: [
          {
            sequence_id: '1', // 項目序號 (STRING, 最多3碼)
            description: '充電錢包充值',
            quantity: 1,
            unit_price: salesAmount,
            sub_amount: salesAmount,
            amount: salesAmount,
            tax_type: 1, // 應稅
            tax_rate: taxRate,
            tax_amount: taxAmount
          }
        ],
        
        // 通知 URL (發票異常時接收通知)
        notify_url: `${process.env.TAPPAY_BACKEND_NOTIFY_URL}/api/payment/invoice-callback`,
        
        // 備註
        remark: description || '充電錢包充值服務'
      };

      // 生成唯一的 request-id（商戶自定義請求識別碼）
      const requestId = `INV_${orderId}_${Date.now()}`;

      console.log('📄 呼叫 TapPay 發票 API:', { 
        url: `${invoiceUrl}/invoice/issue`, 
        orderId, 
        amount,
        customerEmail,
        requestId,
        partnerKey: partnerKey.substring(0, 20) + '...' // 只顯示前 20 字元
      });

      console.log('📄 請求 Payload (partner_key 已隱藏):', JSON.stringify({
        ...payload,
        partner_key: '***HIDDEN***'
      }, null, 2));

      // TapPay 發票 API endpoint
      // 正確路徑: /einvoice/issue (不是 /tpc/invoice/issue)
      const endpoint = `${invoiceUrl}/einvoice/issue`;
      
      console.log('📄 完整請求資訊:', {
        endpoint,
        method: 'POST',
        hasPartnerKey: !!partnerKey,
        requestId
      });

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': partnerKey,
          'request-id': requestId
        },
        timeout: 30000
      });

      console.log('📄 TapPay 發票 API 回應:', JSON.stringify(response.data, null, 2));

      // TapPay 發票 API 成功響應 (status === 0 表示成功)
      if (response.data?.status === 0) {
        const invoiceNumber = response.data?.invoice_number;
        const recInvoiceId = response.data?.rec_invoice_id; // TapPay 開立識別碼
        const providerInvoiceId = response.data?.invoice_issue_order_number; // 加值中心產生的開立識別碼
        const invoiceDateStr = response.data?.invoice_date; // YYYYMMDD
        const invoiceTimeStr = response.data?.invoice_time; // HHmmss

        console.log('✅ TapPay 發票已成功開立並發送:', {
          orderId,
          invoiceNumber,
          recInvoiceId,
          providerInvoiceId,
          customerEmail
        });

        // 將發票資訊保存到資料庫
        if (userId) {
          try {
            await this.saveInvoiceToDatabase({
              invoiceNumber,
              recInvoiceId,
              providerInvoiceId,
              userId,
              invoiceDateStr,
              invoiceTimeStr,
              amount,
              tradeId
            });
          } catch (dbError) {
            console.error('⚠️ 保存發票資訊到資料庫失敗:', dbError);
            // 資料庫錯誤不影響發票開立結果
          }
        }

        return {
          success: true,
          invoiceNumber: invoiceNumber,
          invoiceDate: invoiceDateStr, // YYYYMMDD
          invoiceTime: invoiceTimeStr, // HHmmss
          recInvoiceId: recInvoiceId,
          providerInvoiceId: providerInvoiceId
        };
      }

      console.error('❌ TapPay 開立發票失敗:', response.data);
      return {
        success: false,
        error: response.data?.msg || response.data?.message || '發票開立失敗'
      };

    } catch (error) {
      console.error('❌ TapPay 發票 API 異常:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || '發票開立異常'
      };
    }
  }

  /**
   * 將發票資訊保存到資料庫
   */
  static async saveInvoiceToDatabase(params) {
    const {
      invoiceNumber,
      recInvoiceId,
      providerInvoiceId,
      userId,
      invoiceDateStr,
      invoiceTimeStr,
      amount,
      tradeId,
      description
    } = params;

    try {
      // Dynamic import for ESM database service
      const { databaseService } = await import('../../lib/database/service.js');

      // 轉換日期格式：YYYYMMDD -> YYYY-MM-DD
      const invoiceDate = invoiceDateStr
        ? new Date(
            invoiceDateStr.slice(0, 4) +
            '-' +
            invoiceDateStr.slice(4, 6) +
            '-' +
            invoiceDateStr.slice(6, 8)
          )
        : new Date();

      // 轉換時間格式：HHmmss -> HH:mm:ss
      const invoiceTime = invoiceTimeStr
        ? new Date(
            `2000-01-01T${invoiceTimeStr.slice(0, 2)}:${invoiceTimeStr.slice(2, 4)}:${invoiceTimeStr.slice(4, 6)}`
          )
        : null;

      // 計算稅額 (台灣稅率 5%)
      const taxRate = 0.05;
      const subtotal = Math.round(amount / (1 + taxRate));
      const taxAmount = amount - subtotal;

      await databaseService.createUserInvoice({
        invoice_number: invoiceNumber,
        invoice_provider: 'TAPPAY',
        provider_invoice_id: recInvoiceId, // TapPay 開立識別碼
        user_id: userId,
        invoice_date: invoiceDate,
        invoice_time: invoiceTime,
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: amount,
        currency: 'TWD',
        status: 'ISSUED', // 已開立
        payment_status: 'PAID', // 已支付
        payment_method: 'credit_card',
        payment_reference: tradeId,
        sent_at: new Date(),
        paid_at: new Date(),
        description: description || '充電錢包充值'
      });

      console.log('✅ 發票資訊已保存到資料庫:', {
        invoiceNumber,
        userId
      });
    } catch (error) {
      console.error('❌ 保存發票到資料庫異常:', error);
      throw error;
    }
  }
}

module.exports = { InvoiceRepository };
