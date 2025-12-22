/**
 * 孤兒交易監控服務
 * 負責監控和處理因斷電、網路中斷等原因產生的孤兒交易
 */

import { logger } from '../utils/index.js';
import { chargePointRepository } from '../repositories/index.js';

class OrphanTransactionService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.config = {
      checkIntervalMinutes: 10,      // 檢查間隔：10分鐘
      transactionTimeoutMinutes: 30, // 交易超時：30分鐘
      meterUpdateTimeoutMinutes: 15  // 電表更新超時：15分鐘
    };
  }

  /**
   * 啟動孤兒交易監控服務
   * @param {Object} options 配置選項
   */
  start(options = {}) {
    if (this.isRunning) {
      logger.warn('[孤兒交易監控] 服務已在運行中');
      return;
    }

    // 合併配置
    this.config = { ...this.config, ...options };
    
    logger.info(`[孤兒交易監控] 啟動服務 - 檢查間隔: ${this.config.checkIntervalMinutes}分鐘, 交易超時: ${this.config.transactionTimeoutMinutes}分鐘`);

    // 立即執行一次檢查
    this.performCheck();

    // 設置定期檢查
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.config.checkIntervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  /**
   * 停止孤兒交易監控服務
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('[孤兒交易監控] 服務未在運行');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('[孤兒交易監控] 服務已停止');
  }

  /**
   * 執行孤兒交易檢查
   */
  async performCheck() {
    try {
      logger.debug('[孤兒交易監控] 開始執行檢查...');
      
      const startTime = Date.now();
      const orphans = await chargePointRepository.findAndHandleOrphanTransactions(
        this.config.transactionTimeoutMinutes
      );
      
      const duration = Date.now() - startTime;
      
      if (orphans.length > 0) {
        logger.warn(`[孤兒交易監控] 檢查完成 - 發現並處理 ${orphans.length} 個孤兒交易 (耗時: ${duration}ms)`);
        
        // 記錄詳細信息
        orphans.forEach(orphan => {
          logger.info(`[孤兒交易監控] 處理: ${orphan.transaction_id} (CPID: ${orphan.cpid}, 能量: ${orphan.energy_consumed || 0}kWh)`);
        });
      } else {
        logger.debug(`[孤兒交易監控] 檢查完成 - 未發現孤兒交易 (耗時: ${duration}ms)`);
      }

    } catch (error) {
      logger.error('[孤兒交易監控] 檢查過程中發生錯誤', error);
    }
  }

  /**
   * 手動觸發檢查
   * @returns {Promise<Array>} 處理的孤兒交易列表
   */
  async manualCheck() {
    logger.info('[孤兒交易監控] 手動觸發檢查');
    return await chargePointRepository.findAndHandleOrphanTransactions(
      this.config.transactionTimeoutMinutes
    );
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
    
    logger.info('[孤兒交易監控] 配置已更新', { 
      old: oldConfig, 
      new: this.config 
    });

    // 如果服務正在運行且檢查間隔改變，重啟服務
    if (this.isRunning && oldConfig.checkIntervalMinutes !== this.config.checkIntervalMinutes) {
      logger.info('[孤兒交易監控] 檢查間隔已改變，重啟服務');
      this.stop();
      this.start();
    }
  }
}

// 創建單例實例
const orphanTransactionService = new OrphanTransactionService();

export { OrphanTransactionService, orphanTransactionService };
