/**
 * 孤兒交易監控服務
 * 負責監控和處理因斷電、網路中斷等原因產生的孤兒交易
 */

import cron from 'node-cron';
import { logger } from '../utils/index.js';
import { chargePointRepository } from '../repositories/index.js';

// 默認設定
// 每 12 小時執行一次（00:00、12:00）
const DEFAULT_CRON_EXPRESSION = '0 */12 * * *'; // 每 12 小時
const DEFAULT_TRANSACTION_TIMEOUT_MINUTES = 30;
const DEFAULT_METER_UPDATE_TIMEOUT_MINUTES = 15;
const DEFAULT_ORPHAN_CONFIG = {
  cronExpression: DEFAULT_CRON_EXPRESSION,
  transactionTimeoutMinutes: DEFAULT_TRANSACTION_TIMEOUT_MINUTES,
  meterUpdateTimeoutMinutes: DEFAULT_METER_UPDATE_TIMEOUT_MINUTES
};

class OrphanTransactionService {
  // 初始狀態以常數為準
  isRunning = false;
  scheduler = null;
  config = { ...DEFAULT_ORPHAN_CONFIG };

  /**
   * 啟動孤兒交易監控服務
   * @param {Object} options 配置選項
   */
  start(options = {}) {
    if (this.isRunning) {
      logger.warn('[孤兒交易監控] 服務已在運行中');
      return;
    }

    // 合併配置（允許動態覆寫 cronExpression）
    this.config = { ...this.config, ...options };

    logger.info(`[孤兒交易監控] 啟動服務 - cron: ${this.config.cronExpression}, 交易超時: ${this.config.transactionTimeoutMinutes}分鐘`);

    // 立即執行一次檢查
    this.performCheck();

    // 使用 cron 排程（不再使用 interval）
    try {
      if (this.scheduler) {
        this.scheduler.stop();
      }
      this.scheduler = cron.schedule(this.config.cronExpression, () => this.performCheck(), { scheduled: true });
      logger.info(`[孤兒交易監控] 已排程 (cron): ${this.config.cronExpression}`);
    } catch (err) {
      logger.error('[孤兒交易監控] 建立 cron 排程失敗，服務未啟動', err);
      return;
    }

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
    // 停止 cron 排程
    if (this.scheduler) {
      try {
        this.scheduler.stop();
      } catch (err) {
        logger.error('[孤兒交易監控] 停止 cron 排程時發生錯誤', err);
      }
      this.scheduler = null;
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
      scheduler: this.scheduler ? 'cron' : 'stopped',
      cronExpression: this.config.cronExpression || null,
      nextCheckIn: this.isRunning ? `cron: ${this.config.cronExpression}` : '服務未運行'
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

    // 如果服務正在運行且 cronExpression 改變，重啟服務
    if (this.isRunning && oldConfig.cronExpression !== this.config.cronExpression) {
      logger.info('[孤兒交易監控] 排程配置已改變，重啟服務');
      this.stop();
      this.start();
    }
  }
}

// 創建單例實例
const orphanTransactionService = new OrphanTransactionService();

export { OrphanTransactionService, orphanTransactionService };
