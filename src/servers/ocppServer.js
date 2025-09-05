/**
 * OCPP WebSocket服务器
 * 实现OCPP协议通信的WebSocket服务器
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const logger = require('./utils/logger');

// 引入配置
const { SERVER } = require('./config/envConfig');
const { MQ_ENABLED } = require('./config/mqConfig');

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
    // 只接受ocpp1.6协议
    if (protocols.includes('ocpp1.6')) {
      return 'ocpp1.6';
    }
    return false;
  }
});

// 引入控制器 (在wss初始化之后)
const ocppController = require('./controllers/ocppController');

// 引入MQ服务 (如果启用)
const mqServer = MQ_ENABLED ? require('./mqServer') : null;
const ocppEventPublisher = MQ_ENABLED ? require('./publishers/ocppEventPublisher') : null;
const ocppEventConsumer = MQ_ENABLED ? require('./consumers/ocppEventConsumer') : null;
const emsEventConsumer = MQ_ENABLED ? require('./consumers/emsEventConsumer') : null;
const notificationService = MQ_ENABLED ? require('./services/notificationService') : null;
const systemStatusService = MQ_ENABLED ? require('./services/systemStatusService') : null;

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
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: '1.0.0' });
  });
  
  // MQ健康检查端点
  app.get('/mq/health', (req, res) => {
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
    app.get('/system/status', (req, res) => {
      res.json(systemStatusService.getSystemStatus());
    });
  }
  
  // 获取在线充电桩列表
  app.get('/api/v1/chargepoints/online', async (req, res) => {
    try {
      const onlineCpids = await ocppController.getOnlineChargePoints();
      res.status(200).json({ status: 'success', data: onlineCpids });
    } catch (err) {
      logger.error('获取在线充电桩列表失败', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  // 启动远程充电
  app.post('/api/v1/chargepoints/:cpsn/remotestart', async (req, res) => {
    try {
      const { cpsn } = req.params;
      const { connectorId, idTag } = req.body;
      
      if (!connectorId || !idTag) {
        return res.status(400).json({ 
          status: 'error', 
          message: '缺少必要参数: connectorId, idTag' 
        });
      }
      
      const success = await ocppController.startRemoteCharging(cpsn, connectorId, idTag);
      
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
  app.post('/api/v1/chargepoints/:cpsn/remotestop', async (req, res) => {
    try {
      const { cpsn } = req.params;
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ 
          status: 'error', 
          message: '缺少必要参数: transactionId' 
        });
      }
      
      const success = await ocppController.stopRemoteCharging(cpsn, transactionId);
      
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
  app.post('/api/v1/chargepoints/:cpsn/reset', async (req, res) => {
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
  
  // 兼容旧版API路由
  app.post('/ocpp/api/spacepark_cp_api', (req, res) => {
    res.status(410).json({ 
      status: 'error', 
      message: '此API已弃用，请使用新的API端点' 
    });
  });
  
  app.post('/ocpp/api/ocpp_send_cmd', (req, res) => {
    res.status(410).json({ 
      status: 'error', 
      message: '此API已弃用，请使用新的API端点' 
    });
  });
  
  app.get('/ocpp/api/see_connections', async (req, res) => {
    try {
      const onlineCpids = await ocppController.getOnlineChargePoints();
      res.status(200).json({ online: onlineCpids });
    } catch (err) {
      logger.error('获取连接列表失败', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.get('/ocpp/api/ocpp_cpid/:id', (req, res) => {
    res.status(410).json({ 
      status: 'error', 
      message: '此API已弃用，请使用新的API端点' 
    });
  });
  
  app.get('/ocpp/api/ocpp_stop_charging/:cpid', (req, res) => {
    res.status(410).json({ 
      status: 'error', 
      message: '此API已弃用，请使用新的API端点' 
    });
  });
  
  // 添加触发全站功率重新分配的API
  app.post('/ocpp/api/trigger_profile_update', async (req, res) => {
    try {
      // 使用新架构中的emsController代替旧的ocppController
      const emsController = require('./controllers/emsController');
      await emsController.trigger_profile_update(req, res);
    } catch (err) {
      logger.error('触发全站功率重新分配失败', err);
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
 * 优雅关闭服务器及所有连接
 * @param {string} signal - 触发关闭的信号
 * @returns {Promise<void>}
 */
async function gracefulShutdown(signal) {
  logger.info(`接收到${signal || '关闭'}信号，开始优雅关闭...`);
  
  // 更新系统状态
  if (systemStatusService) {
    systemStatusService.updateServerStatus('stopping');
  }
  
  // 尝试发送关闭通知
  if (MQ_ENABLED && mqServer && mqServer.isConnected() && systemStatusService) {
    try {
      await systemStatusService.sendStatusReport(`shutdown-${signal || 'manual'}`);
      logger.info('系统关闭通知已发送');
    } catch (error) {
      logger.warn(`发送关闭通知失败: ${error.message}`);
    }
  }
  
  // 关闭MQ连接
  if (MQ_ENABLED && mqServer && mqServer.isConnected()) {
    try {
      await mqServer.close();
      logger.info('MQ连接已关闭');
    } catch (error) {
      logger.error(`关闭MQ连接出错: ${error.message}`);
    }
  }
  
  // 关闭WebSocket连接
  if (wss && wss.clients) {
    wss.clients.forEach(client => {
      try {
        client.terminate();
      } catch (err) {
        // 忽略关闭错误
      }
    });
  }
  
  // 关闭HTTP服务器
  if (server && server.close) {
    server.close(() => {
      logger.info('HTTP服务器已关闭');
    });
  }
  
  // 等待1秒后退出进程，给日志刷新时间
  setTimeout(() => {
    logger.info('服务器已安全关闭');
    process.exit(0);
  }, 1000);
}

/**
 * 启动服务器
 */
async function startServer() {
  // 初始化API路由
  initializeRoutes();
  
  // 初始化WebSocket服务器
  initializeWebSocketServer();
  
  // 初始化MQ系统（如果启用）
  let mqInitialized = false;
  if (MQ_ENABLED) {
    mqInitialized = await initializeMQ();
  }
  
  // 初始化EMS系统
  try {
    const emsController = require('./controllers/emsController');
    emsController.initializeEmsSystem();
    logger.info('⚡ EMS能源管理系统初始化完成');
  } catch (error) {
    logger.error(`⚠️ EMS系统初始化失败: ${error.message}`);
  }
  
  // 启动HTTP服务器
  server.listen(PORT, () => {
    logger.info(`OCPP服务器正在监听端口 ${PORT}`);
    logger.info(`REST API: http://localhost:${PORT}/api/v1`);
    logger.info(`WebSocket服务: ws://localhost:${PORT}/ocpp`);
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
  });
}

// 捕获终止信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon重启信号
process.on('uncaughtException', (error) => {
  logger.error(`未捕获的异常: ${error.message}`, error);
  gracefulShutdown('uncaughtException');
});

// 如果这个文件是直接运行的，则启动服务器
if (require.main === module) {
  startServer();
}

// 导出供其他模块使用
module.exports = {
  app,
  server,
  wss,
  startServer,
  gracefulShutdown
};
