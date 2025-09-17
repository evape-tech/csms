/**
 * OCPP Server 健康監控服務
 * 定期檢查服務器健康狀態，類似孤兒交易監控服務的架構
 */

const http = require('http');
const logger = require('../utils/logger');

class HealthMonitoringService {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = null;
    this.config = {
      checkIntervalSeconds: 30,      // 檢查間隔（秒）
      healthTimeout: 5000,           // 健康檢查超時（毫秒）
      maxConsecutiveFailures: 3,     // 最大連續失敗次數
      enableAutoRestart: false       // 是否啟用自動重啟（生產環境建議關閉）
    };
    this.stats = {
      consecutiveFailures: 0,
      lastHealthCheck: null,
      totalChecks: 0,
      totalFailures: 0,
      uptime: null
    };
  }

  /**
   * 啟動健康監控服務
   * @param {Object} options - 配置選項
   */
  start(options = {}) {
    if (this.isRunning) {
      logger.warn('健康監控服務已在運行');
      return;
    }

    // 合併配置
    this.config = { ...this.config, ...options };
    this.isRunning = true;
    this.stats.uptime = new Date();

    logger.info('🔍 啟動 OCPP Server 健康監控服務');
    logger.info(`📋 監控配置:`, {
      checkInterval: `${this.config.checkIntervalSeconds}秒`,
      healthTimeout: `${this.config.healthTimeout}ms`,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures === -1 ? '無限重試' : this.config.maxConsecutiveFailures,
      autoRestart: this.config.enableAutoRestart
    });

    // 立即執行一次檢查
    this.performHealthCheck();

    // 設置定期檢查
    this.monitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkIntervalSeconds * 1000);
  }

  /**
   * 停止健康監控服務
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 停止健康監控服務');
    this.isRunning = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // 記錄最終統計
    this.logFinalStats();
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck() {
    if (!this.isRunning) return;

    this.stats.totalChecks++;
    const checkStartTime = Date.now();

    try {
      const healthResult = await this.checkServerHealth();
      const responseTime = Date.now() - checkStartTime;

      if (healthResult.success) {
        this.handleHealthCheckSuccess(responseTime);
      } else {
        this.handleHealthCheckFailure(healthResult.error, responseTime);
      }

      this.stats.lastHealthCheck = new Date();

    } catch (error) {
      const responseTime = Date.now() - checkStartTime;
      this.handleHealthCheckFailure(error.message, responseTime);
    }
  }

  /**
   * 檢查服務器健康狀態
   */
  async checkServerHealth() {
    return new Promise((resolve) => {
      const PORT = process.env.OCPP_PORT || 8089;
      
      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/health',
        method: 'GET',
        timeout: this.config.healthTimeout
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const healthData = JSON.parse(data);
              resolve({ 
                success: true, 
                data: healthData,
                statusCode: res.statusCode 
              });
            } catch (parseError) {
              resolve({ 
                success: true, 
                data: { status: 'ok' },
                statusCode: res.statusCode 
              });
            }
          } else {
            resolve({ 
              success: false, 
              error: `HTTP ${res.statusCode}`,
              statusCode: res.statusCode 
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ 
          success: false, 
          error: error.message 
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ 
          success: false, 
          error: 'timeout' 
        });
      });

      req.end();
    });
  }

  /**
   * 處理健康檢查成功
   */
  handleHealthCheckSuccess(responseTime) {
    // 如果之前有失敗，記錄恢復
    if (this.stats.consecutiveFailures > 0) {
      logger.info(`✅ 服務器健康狀態恢復 (響應時間: ${responseTime}ms)`);
      logger.info(`📊 恢復前連續失敗次數: ${this.stats.consecutiveFailures}`);
      this.stats.consecutiveFailures = 0;
    }

    // 定期記錄正常狀態（每10次檢查記錄一次）
    if (this.stats.totalChecks % 100 === 0) {
      logger.info(`💚 服務器運行正常 (響應時間: ${responseTime}ms, 總檢查: ${this.stats.totalChecks})`);
    }
  }

  /**
   * 處理健康檢查失敗
   */
  handleHealthCheckFailure(error, responseTime) {
    this.stats.consecutiveFailures++;
    this.stats.totalFailures++;

    // 如果設置為無限重試（-1），則不顯示分母
    const failureDisplay = this.config.maxConsecutiveFailures === -1 
      ? `${this.stats.consecutiveFailures}/∞` 
      : `${this.stats.consecutiveFailures}/${this.config.maxConsecutiveFailures}`;

    logger.warn(`❌ 健康檢查失敗 (${failureDisplay}):`, {
      error,
      responseTime: `${responseTime}ms`,
      totalFailures: this.stats.totalFailures
    });

    // 只有在設置了具體失敗次數限制時才處理嚴重失敗
    if (this.config.maxConsecutiveFailures > 0 && 
        this.stats.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.handleCriticalFailure();
    } else if (this.config.maxConsecutiveFailures === -1) {
      // 無限重試模式，每10次失敗記錄一次統計信息
      if (this.stats.consecutiveFailures % 10 === 0) {
        logger.warn(`🔄 持續重試中: 已連續失敗 ${this.stats.consecutiveFailures} 次，將繼續重試...`);
      }
    }
  }

  /**
   * 處理嚴重失敗
   */
  handleCriticalFailure() {
    logger.error(`🚨 嚴重警告: 連續 ${this.stats.consecutiveFailures} 次健康檢查失敗`);
    
    const stats = this.getHealthStats();
    logger.error(`📊 健康監控統計:`, stats);

    // 發送警報通知（如果有配置）
    this.sendAlert('CRITICAL_HEALTH_FAILURE', {
      consecutiveFailures: this.stats.consecutiveFailures,
      stats
    });

    // 如果啟用自動重啟且在開發環境
    if (this.config.enableAutoRestart && process.env.NODE_ENV !== 'production') {
      logger.warn('🔄 開發環境檢測到嚴重健康問題，建議手動重啟服務器');
      // 這裡可以觸發重啟機制，但建議謹慎使用
    } else {
      logger.error('💥 生產環境檢測到嚴重健康問題，請立即檢查服務器狀態');
    }
  }

  /**
   * 發送警報通知
   */
  async sendAlert(alertType, data) {
    try {
      // 如果啟用了MQ，可以發送警報到消息隊列
      const { MQ_ENABLED } = require('../config/mqConfig');
      if (MQ_ENABLED) {
        const notificationService = require('./notificationService');
        if (notificationService) {
          await notificationService.sendAlert({
            type: alertType,
            severity: 'critical',
            source: 'health-monitoring-service',
            timestamp: new Date().toISOString(),
            data
          });
        }
      }
    } catch (error) {
      logger.error('發送健康監控警報失敗:', error.message);
    }
  }

  /**
   * 獲取健康統計信息
   */
  getHealthStats() {
    const now = new Date();
    const uptime = this.stats.uptime ? now - this.stats.uptime : 0;
    
    return {
      isRunning: this.isRunning,
      uptime: Math.floor(uptime / 1000), // 秒
      totalChecks: this.stats.totalChecks,
      totalFailures: this.stats.totalFailures,
      consecutiveFailures: this.stats.consecutiveFailures,
      successRate: this.stats.totalChecks > 0 ? 
        ((this.stats.totalChecks - this.stats.totalFailures) / this.stats.totalChecks * 100).toFixed(2) + '%' : 
        'N/A',
      lastHealthCheck: this.stats.lastHealthCheck,
      config: this.config
    };
  }

  /**
   * 記錄最終統計
   */
  logFinalStats() {
    const stats = this.getHealthStats();
    logger.info('📊 健康監控服務統計報告:', stats);
  }

  /**
   * 獲取服務狀態
   */
  getStatus() {
    return {
      serviceName: 'health-monitoring',
      isRunning: this.isRunning,
      ...this.getHealthStats()
    };
  }
}

// 創建單例實例
const healthMonitoringService = new HealthMonitoringService();

module.exports = {
  healthMonitoringService
};
