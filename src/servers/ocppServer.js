/**
 * OCPP WebSocket服务器
 * 实现OCPP协议通信的WebSocket服务器
 */

import path from 'path';
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

import dotenv from 'dotenv';
dotenv.config({ path: envPath });

import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { logger } from './utils/index.js';

// 引入配置
import { apiConfig } from './config/index.js';
const { API_PATHS } = apiConfig;

// 创建Express应用
const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建HTTP服务器
const server = http.createServer(app);

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

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

// 引入控制器 (在wss初始化之后)
import { ocppController, emsController } from './controllers/index.js';

// 引入服務
import { systemStatusService, orphanTransactionService, invoiceRetryService } from './services/index.js';

/**
 * 初始化REST API路由
 */
function initializeRoutes() {
  // 健康检查端点 - 系统级别，不带版本
  app.get(API_PATHS.HEALTH, (req, res) => {
    const response = {
      status: 'ok',
      version: '1.0.0',
      apiVersion: apiConfig.API.VERSION,
      timestamp: new Date().toISOString()
    };

    // 附帶系統狀態資訊（僅供內部檢查）
    try {
      if (systemStatusService && typeof systemStatusService.getSystemStatus === 'function') {
        response.system = systemStatusService.getSystemStatus();
      }
    } catch (err) {
      response.system = { error: err.message };
    }

    res.status(200).json(response);
  });
  
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
      const { connectorId, idTag, userUuid } = req.body;
      
      if (!connectorId || !idTag) {
        return res.status(400).json({ 
          status: 'error', 
          message: '缺少必要参数: connectorId, idTag' 
        });
      }
      
      logger.info(`启动远程充电: ${cpsn}, 连接器: ${connectorId}, IdTag: ${idTag}, 用戶UUID: ${userUuid || '未提供'}`);
      const success = await ocppController.startRemoteCharging(cpsn, connectorId, idTag, userUuid);
      
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
      
      // 委托给控制器处理
      await ocppController.handleConnection(ws, req);
      
      // 监听WebSocket关闭事件
      ws.on('close', (code, reason) => {
        logger.info(`WebSocket断开: id=${id}, code=${code}, reason=${reason || 'No reason'}`);
      });
      
      // 监听WebSocket错误事件
      ws.on('error', (error) => {
        logger.error(`WebSocket错误: id=${id}: ${error.message}`);
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
 * 启动服务器（可包含重试逻辑）
 * @param {Object} options 可选配置 { maxRetries, retryDelay, backoffMultiplier, maxRetryDelay }
 */
async function startServer(options = {}) {
  // 支持兩種傳入格式：
  // - startServer({ retry: { enabled: true, maxRetries, retryDelay, ... } })
  // - startServer({ retryEnabled: true/false })
  const retryOpt = options.retry || {};
  const retryEnabled = (typeof options.retryEnabled === 'boolean') ? options.retryEnabled : (retryOpt.enabled ?? true);

  const RETRY_CONFIG = {
    maxRetries: retryOpt.maxRetries ?? options.maxRetries ?? 5,
    retryDelay: retryOpt.retryDelay ?? options.retryDelay ?? 3000,
    backoffMultiplier: retryOpt.backoffMultiplier ?? options.backoffMultiplier ?? 1.5,
    maxRetryDelay: retryOpt.maxRetryDelay ?? options.maxRetryDelay ?? 15000
  };

  // Helper: resolve host/port from env or options
  function getHostAndPort(options = {}) {
    const HOST = options.host || process.env.OCPP_HOST || '0.0.0.0';
    const PORT = options.port ? parseInt(options.port, 10) : parseInt(process.env.OCPP_PORT || process.env.PORT || '8089', 10);
    return { HOST, PORT };
  }

  // Helper: log server addresses
  function logServerAddresses(host, port) {
    logger.info(`OCPP服务器正在监听端口 ${port} (綁定到: ${host})`);
    logger.info(`REST API: http://${host}:${port}${apiConfig.API.BASE_PATH}/${apiConfig.API.VERSION}`);
    logger.info(`OCPP API: http://${host}:${port}${apiConfig.API.OCPP_BASE_PATH}/${apiConfig.API.VERSION}`);
    logger.info(`WebSocket服务: ws://${host}:${port}/ocpp`);
    logger.info(`健康檢查: http://${host}:${port}${API_PATHS.HEALTH}`);
    if (host === '0.0.0.0') {
      logger.info(`本地訪問: http://localhost:${port}`);
      logger.info(`局域網訪問: http://0.0.0.0:${port}`);
    }
  }

  // 内部一次性启动函数，复用原有 startServer 实现
  async function startOnce(startOptions = {}) {
    return new Promise((resolve, reject) => {
      try {
        // 檢查服務器是否已經在監聽
        if (server && server.listening) {
          logger.warn('服務器已在運行，跳過重複啟動');
          resolve();
          return;
        }

        // 初始化API路由與WebSocket
        initializeRoutes();
        initializeWebSocketServer();

        // 异步初始化其他服务
        initializeServices().then(() => {
          const { HOST, PORT } = getHostAndPort(startOptions);
          const serverInstance = server.listen(PORT, HOST, () => {
            logServerAddresses(HOST, PORT);

            // 更新系统状态
            if (systemStatusService) {
              systemStatusService.updateServerStatus('running');
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

  // 如果外部關閉重試，則只執行一次 startOnce，發生錯誤時拋出給呼叫者處理
  if (!retryEnabled) {
    logger.info('啟動時已禁用重試，僅嘗試一次啟動');
    await startOnce();
    logger.info('✅ OCPP Server 啟動成功（無重試模式）！');
    return;
  }

  let retryCount = 0;
  while (retryCount < RETRY_CONFIG.maxRetries) {
    try {
      logger.info(retryCount > 0 ? `🔄 重試啟動 OCPP Server (第 ${retryCount + 1} 次)` : '🚀 啟動 OCPP Server...');
      await startOnce();
      logger.info('✅ OCPP Server 啟動成功！');
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
        logger.error('💥 已達到最大重試次數，OCPP Server 啟動失敗');
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
 * 初始化服務
 */
async function initializeServices() {
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
      // 使用服務內部常數設定，不從外部傳入排程或超時參數
      orphanTransactionService.start();
      logger.info('🔍 孤兒交易監控服務已啟動');
    } else {
      logger.debug('🔍 孤兒交易監控服務已在運行，跳過重複啟動');
    }
  } catch (error) {
    logger.error(`⚠️ 孤兒交易監控服務啟動失败: ${error.message}`);
  }

  // 啟動發票重試監控服務
  try {
    if (!invoiceRetryService.isRunning) {
        // 使用 InvoiceRetryService 的預設配置啟動（預設：每 6 小時）
        invoiceRetryService.start();
      logger.info('📄 發票重試監控服務已啟動');
    } else {
      logger.debug('📄 發票重試監控服務已在運行，跳過重複啟動');
    }
  } catch (error) {
    logger.error(`⚠️ 發票重試監控服務啟動失败: ${error.message}`);
  }
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
          startServer().catch((restartError) => {
            logger.error(`重啟失敗: ${restartError.message}`);
            process.exit(1);
          });
        });
      } else {
        startServer().catch((restartError) => {
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

  // 停止孤兒交易監控服務
  try {
    orphanTransactionService.stop();
    // logger.info('孤兒交易監控服務已停止');
  } catch (error) {
    logger.error(`停止孤兒交易監控服務時出錯: ${error.message}`);
  }

  // 停止發票重試監控服務
  try {
    invoiceRetryService.stop();
    // logger.info('發票重試監控服務已停止');
  } catch (error) {
    logger.error(`停止發票重試監控服務時出錯: ${error.message}`);
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
if (process.argv[1] === __filename) {
  startServer();
}

// 导出供其他模块使用
export { app, server, wss, startServer, gracefulShutdown };
