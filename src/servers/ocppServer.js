/**
 * OCPP WebSocket服务器
 * 实现OCPP协议通信的WebSocket服务器
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { logger } = require('./utils');

// 引入配置
const { envConfig, mqConfig, apiConfig } = require('./config');
const { SERVER } = envConfig;
const { MQ_ENABLED } = mqConfig;
const { API_PATHS } = apiConfig;

// 创建Express应用
const app = express();
app.use(cors({
  origin: SERVER.CORS_ORIGIN
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建HTTP服务器
const server = http.createServer(app);
const PORT = SERVER.PORT || 8089;

// 创建WebSocket服务器
const wss = new WebSocket.Server({
  server,
  handleProtocols: (protocols) => {
    logger.info(`📡 WebSocket 協議協商 - 客戶端支援: ${JSON.stringify(protocols)}`);
    
    // 支援的協議列表
    const SUPPORTED_PROTOCOLS = ['ocpp1.6', 'ocpp'];
    
    // 優先選擇 ocpp1.6
    if (protocols.includes('ocpp1.6')) {
      logger.info(`✅ 選擇協議: ocpp1.6`);
      return 'ocpp1.6';
    }
    
    // 備選 ocpp
    if (protocols.includes('ocpp')) {
      logger.info(`✅ 選擇協議: ocpp (作為 ocpp1.6 別名)`);
      return 'ocpp';  // 或返回 'ocpp1.6' 進行標準化
    }
    
    logger.warn(`❌ 拒絕不支援的協議: ${JSON.stringify(protocols)}`);
    logger.info(`💡 支援的協議: ${JSON.stringify(SUPPORTED_PROTOCOLS)}`);
    return false;
  }
});

// 引入控制器 (在wss初始化之后)
const { ocppController, emsController } = require('./controllers');

// 引入MQ服务 (如果启用)
const mqServer = MQ_ENABLED ? require('./mqServer') : null;
const { ocppEventPublisher } = MQ_ENABLED ? require('./publishers') : { ocppEventPublisher: null };
const { ocppEventConsumer, emsEventConsumer } = MQ_ENABLED ? require('./consumers') : { ocppEventConsumer: null, emsEventConsumer: null };
const { notificationService, systemStatusService, orphanTransactionService, healthMonitoringService } = require('./services');

/**
 * 发布充电桩连接状态事件到MQ
 * @param {string} id - 充电桩ID 
 * @param {string} state - 连接状态
 * @param {Object} additionalData - 其他相关数据
 */
async function publishConnectionState(id, state, additionalData = {}) {
  // 检查MQ是否已初始化且启用
  if (!MQ_ENABLED || !mqServer || !mqServer.isConnected() || !ocppEventPublisher) {
    return;
  }
  
  try {
    await ocppEventPublisher.publishConnectionState({
      cpsn: id,
      state,
      timestamp: new Date().toISOString(),
      ...additionalData
    });
  } catch (err) {
    logger.warn(`MQ发布${state}事件失败: ${err.message}`);
  }
}

/**
 * 初始化REST API路由
 */
function initializeRoutes() {
  // 健康检查端点 - 系统级别，不带版本
  app.get(API_PATHS.HEALTH, (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      version: '1.0.0',
      apiVersion: apiConfig.API.VERSION,
      timestamp: new Date().toISOString()
    });
  });
  
  // MQ健康检查端点
  app.get(API_PATHS.MQ_HEALTH, (req, res) => {
    if (!MQ_ENABLED) {
      return res.json({ 
        status: 'disabled', 
        message: 'MQ功能已通过配置禁用',
        mqEnabled: MQ_ENABLED,
        timestamp: new Date().toISOString()
      });
    }
    
    const mqChannel = mqServer.getChannel();
    const health = {
      mqEnabled: MQ_ENABLED,
      mqInitialized: mqServer.isInitialized(),
      mqConnected: mqServer.isConnected(),
      mqChannelReady: !!mqChannel,
      timestamp: new Date().toISOString()
    };
    
    if (health.mqConnected && health.mqChannelReady) {
      return res.json({ 
        status: 'ok', 
        message: 'MQ系统正常运行', 
        ...health 
      });
    } else if (health.mqInitialized) {
      return res.status(503).json({ 
        status: 'degraded', 
        message: 'MQ连接当前不可用，系统可能正在尝试重连', 
        ...health 
      });
    } else {
      return res.status(503).json({ 
        status: 'unavailable', 
        message: 'MQ系统未初始化或初始化失败，系统运行在降级模式', 
        ...health 
      });
    }
  });
  
  // 系统状态端点
  if (systemStatusService) {
    app.get(API_PATHS.SYSTEM_STATUS, (req, res) => {
      res.json(systemStatusService.getSystemStatus());
    });
  }
  
  // 获取在线充电桩列表
  app.get(API_PATHS.CHARGEPOINTS_ONLINE, async (req, res) => {
    try {
      const onlineCpids = await ocppController.getOnlineChargePoints();
      res.status(200).json({ status: 'success', data: onlineCpids });
    } catch (err) {
      logger.error('获取在线充电桩列表失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // 启动远程充电
  app.post(API_PATHS.CHARGEPOINT_REMOTE_START, async (req, res) => {
    try {
      const { cpsn } = req.params;
      const { connectorId, idTag, userUuid, userRole } = req.body;
      
      if (!connectorId || !idTag) {
        return res.status(400).json({ 
          status: 'error', 
          message: '缺少必要参数: connectorId, idTag' 
        });
      }
      
      logger.info(`启动远程充电: ${cpsn}, 连接器: ${connectorId}, IdTag: ${idTag}, 用戶UUID: ${userUuid || '未提供'}, 角色: ${userRole || '未知'}`);
      const success = await ocppController.startRemoteCharging(cpsn, connectorId, idTag, userUuid, userRole);
      
      if (success) {
        res.status(200).json({ status: 'success', message: '远程启动命令已发送' });
      } else {
        res.status(400).json({ status: 'error', message: '远程启动命令发送失败' });
      }
    } catch (err) {
      logger.error('远程启动充电失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // 停止远程充电
  app.post(API_PATHS.CHARGEPOINT_REMOTE_STOP, async (req, res) => {
    try {
      const { cpsn } = req.params;
      const { transactionId, userUuid, userRole } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ 
          status: 'error', 
          message: '缺少必要参数: transactionId' 
        });
      }
      
      logger.info(`停止远程充电: ${cpsn}, 交易ID: ${transactionId}, 用戶UUID: ${userUuid || '未提供'}, 角色: ${userRole || '未知'}`);
      const success = await ocppController.stopRemoteCharging(cpsn, transactionId, userUuid, userRole);
      
      if (success) {
        res.status(200).json({ status: 'success', message: '远程停止命令已发送' });
      } else {
        res.status(400).json({ status: 'error', message: '远程停止命令发送失败' });
      }
    } catch (err) {
      logger.error('远程停止充电失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // 重启充电桩
  app.post(API_PATHS.CHARGEPOINT_RESET, async (req, res) => {
    try {
      const { cpsn } = req.params;
      const { type = 'Soft' } = req.body;
      
      const success = await ocppController.resetChargePoint(cpsn, type);
      
      if (success) {
        res.status(200).json({ status: 'success', message: '重启命令已发送' });
      } else {
        res.status(400).json({ status: 'error', message: '重启命令发送失败' });
      }
    } catch (err) {
      logger.error('重启充电桩失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // 獲取OCPP連接狀態 - 新版本API
  app.get(API_PATHS.OCPP_CONNECTIONS, async (req, res) => {
    try {
      const onlineCpids = await ocppController.getOnlineChargePoints();
      res.status(200).json({ 
        status: 'success', 
        data: { online: onlineCpids },
        apiVersion: apiConfig.API.VERSION,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('获取连接列表失败', err);
      res.status(500).json({ 
        status: 'error', 
        message: err.message,
        apiVersion: apiConfig.API.VERSION,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // EMS功率管理API端點 - 新版本
  app.post(API_PATHS.OCPP_TRIGGER_PROFILE_UPDATE, async (req, res) => {
    try {
      await emsController.trigger_profile_update(req, res);
    } catch (err) {
      logger.error('触发全站功率重新分配失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  app.post(API_PATHS.OCPP_TRIGGER_METER_REALLOCATION, async (req, res) => {
    try {
      await emsController.trigger_meter_reallocation(req, res);
    } catch (err) {
      logger.error('触发电表级功率重新分配失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  app.post(API_PATHS.OCPP_TRIGGER_STATION_REALLOCATION, async (req, res) => {
    try {
      await emsController.trigger_station_reallocation(req, res);
    } catch (err) {
      logger.error('触发站点级功率重新分配失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
}

/**
 * 初始化WebSocket服务器
 */
function initializeWebSocketServer() {
  // WebSocket连接事件
  wss.on('connection', async (ws, req) => {
    try {
      // 提取充电站ID
      const urlParts = req.url.split('/');
      const id = urlParts[urlParts.length - 1];
      const remote = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      logger.info(`新WebSocket连接: id=${id}, remote=${remote}, agent=${userAgent}`);
      
      // 发布连接事件到MQ
      publishConnectionState(id, 'connected', { remote, userAgent });
      
      // 委托给控制器处理
      await ocppController.handleConnection(ws, req);
      
      // 监听WebSocket关闭事件
      ws.on('close', (code, reason) => {
        logger.info(`WebSocket断开: id=${id}, code=${code}, reason=${reason || 'No reason'}`);
        
        // 发布断开连接事件到MQ
        publishConnectionState(id, 'disconnected', { 
          remote, 
          userAgent, 
          code, 
          reason: reason?.toString() 
        });
      });
      
      // 监听WebSocket错误事件
      ws.on('error', (error) => {
        logger.error(`WebSocket错误: id=${id}: ${error.message}`);
        
        // 发布WebSocket错误事件到MQ
        publishConnectionState(id, 'ws_error', { 
          remote, 
          userAgent, 
          error: error.message 
        });
      });
    } catch (err) {
      logger.error('处理WebSocket连接时出错', err);
      ws.close();
    }
  });
  
  // WebSocket服务器错误事件
  wss.on('error', (error) => {
    logger.error('WebSocket服务器错误', error);
  });
}

/**
 * 初始化MQ连接和消费者
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 重试间隔(毫秒)
 * @returns {Promise<boolean>} - 初始化是否成功
 */
async function initializeMQ(maxRetries = 3, retryDelay = 5000) {
  // 如果MQ功能未启用，直接返回
  if (!MQ_ENABLED || !mqServer) {
    logger.info('MQ功能已通过配置禁用，系统将在无MQ模式下运行');
    return false;
  }
  
  try {
    logger.info('初始化消息队列连接...');
    
    // 尝试连接，带有重试逻辑
    let mqConnection = null;
    let retryCount = 0;
    
    while (!mqConnection && retryCount < maxRetries) {
      if (retryCount > 0) {
        logger.info(`MQ连接重试 (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
      mqConnection = await mqServer.connect();
      retryCount++;
    }
    
    // 如果连接失败，降级运行
    if (!mqConnection) {
      logger.warn('无法连接到RabbitMQ，系统将在无MQ模式下运行');
      return false;
    }
    
    logger.info('消息队列连接成功，开始初始化消费者...');
    
    try {
      // 初始化各种消费者，使用Promise.allSettled以允许部分成功
      const results = await Promise.allSettled([
        ocppEventConsumer.initConsumers(),
        emsEventConsumer.initConsumers()
      ]);
      
      // 检查消费者初始化结果
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        logger.warn(`${failures.length}个消费者初始化失败，系统将使用部分MQ功能运行`);
        failures.forEach((failure, index) => {
          logger.warn(`消费者初始化错误 ${index+1}: ${failure.reason.message}`);
        });
      } else {
        logger.info('所有MQ消费者初始化成功!');
      }
      
      // 更新MQ状态
      if (systemStatusService) {
        systemStatusService.updateMqStatus({
          initialized: true,
          connected: true,
          consumers: results.filter(r => r.status === 'fulfilled').length
        });
      }
      
      // 尝试发送系统启动通知
      if (systemStatusService) {
        try {
          await systemStatusService.sendStatusReport('startup');
          logger.info('系统启动通知已发送');
        } catch (notifyError) {
          logger.warn(`发送启动通知失败: ${notifyError.message}`);
        }
      }
      
      return true;
    } catch (consumerError) {
      logger.error(`初始化消费者失败: ${consumerError.message}`);
      logger.info('将使用部分MQ功能运行');
      return true; // 仍然返回true，因为MQ连接成功
    }
  } catch (error) {
    logger.error(`MQ初始化失败: ${error.message}`);
    logger.info('将使用降级模式运行，不依赖MQ功能');
    return false;
  }
}

/**
 * 启动服务器（帶重試機制）
 */
async function startServerWithRetry() {
  const RETRY_CONFIG = {
    maxRetries: 5,
    retryDelay: 3000,
    backoffMultiplier: 1.5,
    maxRetryDelay: 15000
  };
  
  let retryCount = 0;
  
  while (retryCount < RETRY_CONFIG.maxRetries) {
    try {
      logger.info(retryCount > 0 ? 
        `🔄 重試啟動 OCPP Server (第 ${retryCount + 1} 次)` : 
        '🚀 啟動 OCPP Server...');
      
      await startServer();
      
      // 啟動成功
      logger.info(`✅ OCPP Server 啟動成功！`);
      return;
      
    } catch (error) {
      retryCount++;
      logger.error(`❌ 啟動失敗 (嘗試 ${retryCount}/${RETRY_CONFIG.maxRetries}): ${error.message}`);
      
      // 清理失敗的服務器實例
      try {
        if (server && server.listening) {
          logger.info('🧹 清理失敗的服務器實例...');
          server.close();
        }
        if (wss) {
          logger.info('🧹 清理 WebSocket 服務器...');
          wss.close();
        }
      } catch (cleanupError) {
        logger.warn(`清理服務器實例時出錯: ${cleanupError.message}`);
      }
      
      if (retryCount >= RETRY_CONFIG.maxRetries) {
        logger.error(`💥 已達到最大重試次數，OCPP Server 啟動失敗`);
        process.exit(1);
      }
      
      // 計算退避延遲
      const delay = Math.min(
        RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount - 1),
        RETRY_CONFIG.maxRetryDelay
      );
      
      logger.info(`⏳ ${delay/1000} 秒後重試...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * 启动服务器（基本版本）
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // 檢查服務器是否已經在監聽
      if (server && server.listening) {
        logger.warn('服務器已在運行，跳過重複啟動');
        resolve();
        return;
      }
      
      // 初始化API路由
      initializeRoutes();
      
      // 初始化WebSocket服务器
      initializeWebSocketServer();
      
      // 异步初始化其他服务
      initializeServices().then((mqInitialized) => {
        // 启动HTTP服务器
        const HOST = SERVER.HOST || 'localhost';
        const PORT = SERVER.PORT || 8089;
        const serverInstance = server.listen(PORT, HOST, () => {
          logger.info(`OCPP服务器正在监听端口 ${PORT} (綁定到: ${HOST})`);
          logger.info(`REST API: http://${HOST}:${PORT}${apiConfig.API.BASE_PATH}/${apiConfig.API.VERSION}`);
          logger.info(`OCPP API: http://${HOST}:${PORT}${apiConfig.API.OCPP_BASE_PATH}/${apiConfig.API.VERSION}`);
          logger.info(`WebSocket服务: ws://${HOST}:${PORT}/ocpp`);
          logger.info(`健康檢查: http://${HOST}:${PORT}${API_PATHS.HEALTH}`);
          
          // 如果綁定到所有接口，顯示額外的訪問地址
          if (HOST === '0.0.0.0') {
            logger.info(`本地訪問: http://localhost:${PORT}`);
            logger.info(`局域網訪問: http://[本機IP]:${PORT}`);
          }
          
          logger.info(`消息队列(MQ)状态: ${mqInitialized ? '已连接' : '未连接'}`);
          
          // 更新系统状态
          if (systemStatusService) {
            systemStatusService.updateServerStatus('running');
            
            // 定期发送状态报告
            const statusReportInterval = SERVER.STATUS_REPORT_INTERVAL;
            if (statusReportInterval > 0) {
              setInterval(() => {
                systemStatusService.sendStatusReport('periodic');
              }, statusReportInterval);
            }
          }
          
          resolve();
        });
        
        serverInstance.on('error', (error) => {
          reject(error);
        });
      }).catch(reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 初始化服務
 */
async function initializeServices() {
  // 初始化MQ系统（如果启用）
  let mqInitialized = false;
  if (MQ_ENABLED) {
    try {
      mqInitialized = await initializeMQ();
    } catch (error) {
      logger.warn(`MQ初始化失敗: ${error.message}`);
    }
  }
  
  // 初始化EMS系统
  try {
    emsController.initializeEmsSystem();
    logger.info('⚡ EMS能源管理系统初始化完成');
  } catch (error) {
    logger.error(`⚠️ EMS系统初始化失败: ${error.message}`);
  }

  // 啟動孤兒交易監控服務
  try {
    if (!orphanTransactionService.isRunning) {
      orphanTransactionService.start({
        checkIntervalMinutes: 10,      // 每10分鐘檢查一次
        transactionTimeoutMinutes: 10, // 10分鐘超時
        meterUpdateTimeoutMinutes: 10  // 10分鐘電表更新超時
      });
      logger.info('🔍 孤兒交易監控服務已啟動');
    } else {
      logger.debug('🔍 孤兒交易監控服務已在運行，跳過重複啟動');
    }
  } catch (error) {
    logger.error(`⚠️ 孤兒交易監控服務啟動失败: ${error.message}`);
  }

  // 啟動健康監控服務
  try {
    if (!healthMonitoringService.isRunning) {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const HOST = process.env.OCPP_HOST || 'localhost';
      const PORT = process.env.OCPP_PORT || 8089;
      
      healthMonitoringService.start({
        checkIntervalSeconds: isDevelopment ? 5 : 60,  // 開發環境5秒，生產環境60秒
        enableAutoRestart: isDevelopment,               // 只在開發環境啟用自動重啟
        maxConsecutiveFailures: -1,                     // -1 表示無限制重試，不放棄
        healthEndpoint: `http://${SERVER.HOST || 'localhost'}:${SERVER.PORT || 8089}/ocpp/api/health`, // 健康檢查端點
        onRestartRequired: () => {
          // 當需要重啟時的回調函數
          logger.warn('🔄 健康監控服務檢測到需要重啟服務器');
          if (isDevelopment) {
            handleCriticalError('healthCheckFailed', new Error('連續健康檢查失敗'));
          }
        }
      });
      logger.info('💓 健康監控服務已啟動');
    } else {
      logger.debug('💓 健康監控服務已在運行，跳過重複啟動');
    }
  } catch (error) {
    logger.error(`⚠️ 健康監控服務啟動失败: ${error.message}`);
  }
  
  return mqInitialized;
}

// 捕获终止信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon重启信号

// 錯誤處理和自動重啟
process.on('uncaughtException', (error) => {
  logger.error(`未捕获的异常: ${error.message}`, error);
  handleCriticalError('uncaughtException', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未处理的Promise拒绝: ${reason}`, promise);
  handleCriticalError('unhandledRejection', new Error(reason));
});

/**
 * 處理嚴重錯誤
 */
function handleCriticalError(type, error) {
  logger.error(`嚴重錯誤 (${type}): ${error.message}`);
  
  // 如果是開發環境，嘗試重啟
  if (process.env.NODE_ENV !== 'production') {
    logger.info('🔄 開發環境檢測到嚴重錯誤，準備重啟...');
    
    setTimeout(() => {
      logger.info('🚀 正在重啟 OCPP Server...');
      
      // 清理現有連接
      if (server && server.listening) {
        server.close(() => {
          startServerWithRetry().catch((restartError) => {
            logger.error(`重啟失敗: ${restartError.message}`);
            process.exit(1);
          });
        });
      } else {
        startServerWithRetry().catch((restartError) => {
          logger.error(`重啟失敗: ${restartError.message}`);
          process.exit(1);
        });
      }
    }, 2000);
  } else {
    // 生產環境直接退出，讓進程管理器重啟
    gracefulShutdown(type);
  }
}

/**
 * 優雅關閉服務器
 */
async function gracefulShutdown(signal) {
  logger.info(`接收到信号 ${signal}，准备关闭服务器...`);
  
  // 停止健康監控服務
  try {
    healthMonitoringService.stop();
    // logger.info('💓 健康監控服務已停止');
  } catch (error) {
    logger.error(`停止健康監控服務時出錯: ${error.message}`);
  }

  // 停止孤兒交易監控服務
  try {
    orphanTransactionService.stop();
    // logger.info('孤兒交易監控服務已停止');
  } catch (error) {
    logger.error(`停止孤兒交易監控服務時出錯: ${error.message}`);
  }
  
  // 清理WebSocket連接
  if (wss) {
    wss.clients.forEach((ws) => {
      ws.terminate();
    });
    logger.info('WebSocket連接已清理');
  }
  
  // 關閉HTTP服務器
  if (server && server.listening) {
    server.close(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// 如果这个文件是直接运行的，则启动服务器
if (require.main === module) {
  startServerWithRetry();
}

// 导出供其他模块使用
module.exports = {
  app,
  server,
  wss,
  startServer,
  startServerWithRetry,
  gracefulShutdown
};
