/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 發票重試監控服務
 * 負責監控和重新發送失敗的發票開立請求
 * 
 * 監控條件：
 * - status 為 DRAFT（草稿，未開立）
 * - status 為 ERROR（開立失敗）
 * - 創建時間超過設定的時間閾值
 */

const { logger } = require('../utils/index.js');
const { InvoiceRepository } = require('../repositories/invoiceRepository.js');

// Dynamic import helper for ESM modules
let dbServiceInstance;
async function getDatabaseService() {
  if (!dbServiceInstance) {
    const mod = await import('../../lib/database/service.js');
    dbServiceInstance = mod.databaseService;
  }
  return dbServiceInstance;
}

class InvoiceRetryService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.config = {
      checkIntervalMinutes: 30,      // 檢查間隔：1分鐘
      retryAfterMinutes: 10,         // 創建後多久才重試：10分鐘
      maxRetryCount: 5,              // 最大重試次數
      batchSize: 10                  // 每次批次處理數量
    };
  }

  /**
   * 啟動發票重試監控服務
   * @param {Object} options 配置選項
   */
  start(options = {}) {
    if (this.isRunning) {
      logger.warn('[發票重試監控] 服務已在運行中');
      return;
    }

    // 合併配置
    this.config = { ...this.config, ...options };
    
    logger.info(`[發票重試監控] 啟動服務 - 檢查間隔: ${this.config.checkIntervalMinutes}分鐘, 重試延遲: ${this.config.retryAfterMinutes}分鐘`);

    // 設置定期檢查
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.config.checkIntervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  /**
   * 停止發票重試監控服務
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('[發票重試監控] 服務未在運行');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('[發票重試監控] 服務已停止');
  }

  /**
   * 執行發票重試檢查
   */
  async performCheck() {
    try {
      logger.info('[發票重試監控] 開始執行檢查...');
      
      const startTime = Date.now();
      const failedInvoices = await this.findFailedInvoices();
      
      if (failedInvoices.length === 0) {
        const duration = Date.now() - startTime;
        logger.info(`[發票重試監控] 檢查完成 - 未發現需要重試的發票 (耗時: ${duration}ms)`);
        return;
      }

      logger.info(`[發票重試監控] 發現 ${failedInvoices.length} 張需要重試的發票`);

      // 批次處理失敗的發票
      const results = await this.retryFailedInvoices(failedInvoices);
      
      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      logger.info(
        `[發票重試監控] 檢查完成 - 成功: ${successCount}, 失敗: ${failCount}, 總計: ${results.length} (耗時: ${duration}ms)`
      );

    } catch (error) {
      logger.error('[發票重試監控] 檢查過程中發生錯誤', error);
    }
  }

  /**
   * 查找需要重試的失敗發票
   * @returns {Promise<Array>} 失敗的發票列表
   */
  async findFailedInvoices() {
    try {
      const dbService = await getDatabaseService();
      // 直接使用 databaseService 的方法查詢失敗發票
      const failedInvoices = await dbService.getFailedInvoices({
        retryAfterMinutes: this.config.retryAfterMinutes,
        batchSize: this.config.batchSize
      });

      logger.info(`[發票重試監控] 查詢到 ${failedInvoices.length} 張需要重試的發票`);
      
      return failedInvoices;

    } catch (error) {
      logger.error('[發票重試監控] 查詢失敗發票時發生錯誤', error);
      return [];
    }
  }

  /**
   * 重試失敗的發票開立
   * @param {Array} invoices 發票列表
   * @returns {Promise<Array>} 重試結果
   */
  async retryFailedInvoices(invoices) {
    const results = [];

    for (const invoice of invoices) {
      try {
        logger.info(`[發票重試監控] 重試發票: ${invoice.invoice_number} (用戶: ${invoice.users?.email})`);

        const result = await this.retryInvoice(invoice);
        results.push({
          invoiceNumber: invoice.invoice_number,
          success: result.success,
          error: result.error
        });

        // 添加延遲以避免 API 限流
        await this.sleep(1000);

      } catch (error) {
        logger.error(`[發票重試監控] 重試發票 ${invoice.invoice_number} 時發生異常`, error);
        results.push({
          invoiceNumber: invoice.invoice_number,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 重試單張發票
   * @param {Object} invoice 發票資訊
   * @returns {Promise<Object>} 重試結果
   */
  async retryInvoice(invoice) {
    const dbService = await getDatabaseService();
    try {
      // 檢查用戶資訊是否完整
      if (!invoice.users || !invoice.users.email) {
        logger.error(`[發票重試監控] 發票 ${invoice.invoice_number} 缺少用戶資訊`);
        
        // 使用 databaseService 更新發票狀態
        await dbService.updateUserInvoice(invoice.id, {
          status: 'ERROR',
          error_message: '缺少用戶 Email 資訊'
        });

        return {
          success: false,
          error: '缺少用戶 Email 資訊'
        };
      }

      // 呼叫 TapPay 發票 API
      const issueResult = await InvoiceRepository.issueInvoice({
        orderId: invoice.invoice_number,
        amount: parseFloat(invoice.total_amount.toString()),
        customerEmail: invoice.users.email,
        customerName: `${invoice.users.first_name || ''} ${invoice.users.last_name || ''}`.trim() || '顧客',
        customerPhone: invoice.users.phone || undefined,
        description: invoice.description || '充電錢包充值',
        userId: invoice.users.uuid,
        tradeId: invoice.payment_reference || undefined
      });

      if (issueResult.success) {
        // 使用 databaseService 更新發票狀態為已發送
        // SENT: 已發送，TapPay 會自動發送發票到用戶 Email
        await dbService.updateUserInvoice(invoice.id, {
          status: 'SENT',
          provider_invoice_id: issueResult.recInvoiceId || invoice.provider_invoice_id,
          sent_at: new Date(),
          error_message: null
        });

        logger.info(`[發票重試監控] ✅ 發票 ${invoice.invoice_number} 重試成功`);
        
        return {
          success: true
        };

      } else {
        // 使用 databaseService 更新發票狀態為錯誤
        await dbService.updateUserInvoice(invoice.id, {
          status: 'ERROR',
          error_message: issueResult.error || '發票開立失敗'
        });

        logger.error(`[發票重試監控] ❌ 發票 ${invoice.invoice_number} 重試失敗: ${issueResult.error}`);
        
        return {
          success: false,
          error: issueResult.error
        };
      }

    } catch (error) {
      logger.error(`[發票重試監控] 重試發票時發生異常`, error);

      // 使用 databaseService 更新發票錯誤訊息
      try {
        await dbService.updateUserInvoice(invoice.id, {
          status: 'ERROR',
          error_message: error.message || '系統異常'
        });
      } catch (dbError) {
        logger.error(`[發票重試監控] 更新發票錯誤狀態時發生異常`, dbError);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 手動觸發檢查
   * @returns {Promise<Object>} 檢查結果
   */
  async manualCheck() {
    logger.info('[發票重試監控] 手動觸發檢查');
    
    const failedInvoices = await this.findFailedInvoices();
    
    if (failedInvoices.length === 0) {
      return {
        message: '未發現需要重試的發票',
        count: 0
      };
    }

    const results = await this.retryFailedInvoices(failedInvoices);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      message: '手動檢查完成',
      total: results.length,
      success: successCount,
      failed: failCount,
      results: results
    };
  }

  /**
   * 獲取服務狀態
   * @returns {Object} 服務狀態信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextCheckIn: this.isRunning ? 
        `${this.config.checkIntervalMinutes} 分鐘` : 
        '服務未運行'
    };
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    logger.info('[發票重試監控] 配置已更新', { 
      old: oldConfig, 
      new: this.config 
    });

    // 如果服務正在運行且檢查間隔改變，重啟服務
    if (this.isRunning && oldConfig.checkIntervalMinutes !== this.config.checkIntervalMinutes) {
      logger.info('[發票重試監控] 檢查間隔已改變，重啟服務');
      this.stop();
      this.start();
    }
  }

  /**
   * 延遲工具函數
   * @param {number} ms 毫秒
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 創建單例實例
const invoiceRetryService = new InvoiceRetryService();

module.exports = {
  InvoiceRetryService,
  invoiceRetryService
};
