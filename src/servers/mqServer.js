import amqp from 'amqplib';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './utils/index.js';

// 根據 NODE_ENV 決定使用哪個 .env 文件（使用 switch，支援 production / dev / 其他）
let envFile;
switch (process.env.NODE_ENV) {
  case 'production':
    envFile = '.env.production';
    break;
  case 'development':
    envFile = '.env.development';
    break;
  default:
    envFile = '.env';
}

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { MQ_ENABLED, MQ_CONFIG, getMqUrl } from './config/mqConfig.js';

let connection = null;
let channel = null;
let reconnectAttempts = 0;
let pendingConnect = null; // Promise for ongoing connect() to avoid concurrent connects
let reconnectTimer = null;  // timer id for scheduled reconnect

// 从配置导入交换机类型
const EXCHANGE_TYPES = {
  DIRECT: 'direct',
  TOPIC: 'topic',
  FANOUT: 'fanout'
};

// 从配置导入交换机
const EXCHANGES = {
  OCPP_EVENTS: MQ_CONFIG.exchanges.ocppEvents.name,
  EMS_EVENTS: MQ_CONFIG.exchanges.emsEvents.name,
  NOTIFICATION_EVENTS: MQ_CONFIG.exchanges.notificationEvents.name
};

/**
 * 连接到RabbitMQ并创建通道和交换机
 * @returns {Promise<{connection: *, channel: *}|null>}
 */
async function connect() {
  // Avoid concurrent connect attempts
  if (pendingConnect) return pendingConnect;

  pendingConnect = (async () => {
    try {
    // 检查是否启用了MQ
    if (!MQ_ENABLED) {
      logger.warn('⚠️ MQ功能已通过环境变量禁用');
      return null;
    }
    
    // 检查是否在Docker环境中运行
    const isDocker = process.env.DOCKER_ENV === 'true';
    if (isDocker) {
      logger.info('🐳 检测到Docker环境，使用Docker网络中的RabbitMQ地址');
    }
    
    // 获取连接URL
    const url = getMqUrl(isDocker);
  logger.info(`🔌 连接到RabbitMQ: ${url.replace(/:[^:]*@/, ':****@')}`); // 隐藏密码
    
    // 设置连接选项
    const connectOptions = {
      timeout: MQ_CONFIG.connection.options.timeout,
      heartbeat: MQ_CONFIG.connection.options.heartbeat
    };
    
  connection = await amqp.connect(url, connectOptions);
  channel = await connection.createChannel();
    
    // 创建交换机
    await channel.assertExchange(
      MQ_CONFIG.exchanges.ocppEvents.name, 
      MQ_CONFIG.exchanges.ocppEvents.type, 
      MQ_CONFIG.exchanges.ocppEvents.options
    );
    await channel.assertExchange(
      MQ_CONFIG.exchanges.emsEvents.name, 
      MQ_CONFIG.exchanges.emsEvents.type, 
      MQ_CONFIG.exchanges.emsEvents.options
    );
    await channel.assertExchange(
      MQ_CONFIG.exchanges.notificationEvents.name, 
      MQ_CONFIG.exchanges.notificationEvents.type, 
      MQ_CONFIG.exchanges.notificationEvents.options
    );
    
  logger.info('✅ MQ连接成功，交换机初始化完成');
    
    // 连接成功后重置重连计数
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // 监听连接关闭事件
    connection.on('close', () => {
      logger.warn('⚠️ MQ连接关闭，准备重连...');
      handleReconnect();
    });
    
    // 监听错误事件
    connection.on('error', (err) => {
      logger.error('❌ MQ连接错误:', err.message);
      if (connection) {
        connection.close().catch((closeErr) => {
          logger.error('关闭连接出错:', closeErr);
        });
      }
    });
    
    return { connection, channel };
  } catch (error) {
    logger.error('❌ MQ连接失败:', error?.message || error);
    logger.info('🔄 将尝试重连...');
    // schedule reconnect and return null
    handleReconnect();
    return null;
  } finally {
    pendingConnect = null;
  }
  })();

  return pendingConnect;
}

/**
 * 处理重连逻辑
 * @returns {Promise<null>}
 */
function handleReconnect() {
  reconnectAttempts++;

  // 检查是否达到最大重连次数
  const { maxAttempts, interval } = MQ_CONFIG.reconnect;
  const backoffMultiplier = MQ_CONFIG.reconnect.backoffMultiplier || 1;

  if (maxAttempts > 0 && reconnectAttempts > maxAttempts) {
    logger.error(`❌ 已达到最大重连次数(${maxAttempts})，停止重连`);
    return null;
  }

  const delay = Math.min(interval * Math.pow(backoffMultiplier, reconnectAttempts - 1), MQ_CONFIG.reconnect.maxDelay || 60000);
  logger.info(`🔄 重连尝试 ${reconnectAttempts}${maxAttempts > 0 ? `/${maxAttempts}` : ''}，将在${Math.round(delay/1000)}秒后进行...`);

  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    // call connect which manages pendingConnect
    connect().catch((err) => logger.error('重连失败:', err));
  }, delay);

  return null;
}

/**
 * 安全关闭MQ连接
 */
async function close() {
  try {
    if (channel) {
      await channel.close();
      logger.info('✅ MQ通道已关闭');
    }
    if (connection) {
      await connection.close();
      logger.info('✅ MQ连接已安全关闭');
    }
  } catch (error) {
    logger.error('❌ 关闭MQ连接出错:', error.message);
  } finally {
    channel = null;
    connection = null;
    // 重置重连计数
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
}

/**
 * 检查MQ是否已连接并可用
 * @returns {boolean}
 */
function isConnected() {
  return connection !== null && channel !== null;
}

// 檢查MQ是否已初始化（即是否曾成功建立通道）
function isInitialized() {
  return channel !== null;
}

/**
 * Publish a message to an exchange
 * @param {string} exchange
 * @param {string} routingKey
 * @param {Buffer|string|Object} message
 * @param {Object} options
 */
function publish(exchange, routingKey = '', message = '', options = {}) {
  if (!channel) throw new Error('MQ channel not available');
  const payload = (typeof message === 'object' && !Buffer.isBuffer(message)) ? Buffer.from(JSON.stringify(message)) : Buffer.from(String(message));
  return channel.publish(exchange, routingKey, payload, options);
}

// 导出模块
function getConnection() { return connection; }
function getChannel() { return channel; }

// 导出模块（统一导出）
export { connect, initialize, close, publish, EXCHANGES, EXCHANGE_TYPES, getConnection, getChannel, isConnected, isInitialized, handleReconnect, MQ_CONFIG };

/**
 * 初始化MQ (连接 + 初始化消费者)
 * @param {number} maxRetries
 * @param {number} retryDelay
 * @returns {Promise<boolean>} 是否初始化成功
 */
async function initialize(maxRetries = 3, retryDelay = 5000) {
  // 如果未启用 MQ，直接返回 false
  if (!MQ_ENABLED) {
    logger.warn('⚠️ MQ已被禁用，跳过初始化');
    return false;
  }

  try {
    logger.info('🔧 开始初始化 MQ (connect + consumers)');

    // 连接尝试（带重试）
    let mqConnection = null;
    let retryCount = 0;

    while (!mqConnection && retryCount < maxRetries) {
      if (retryCount > 0) {
        logger.info(`MQ连接重试 (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      mqConnection = await connect();
      retryCount++;
    }

    if (!mqConnection) {
      logger.warn('无法连接到 RabbitMQ，跳过消费者初始化');
      return false;
    }

    logger.info('MQ 已连接，开始初始化消费者...');

    // 动态导入消费者以防止循环依赖
    const ocppEventConsumer = await import('./consumers/ocppEventConsumer.js');
    const emsEventConsumer = await import('./consumers/emsEventConsumer.js');

    const results = await Promise.allSettled([
      ocppEventConsumer.initConsumers(),
      emsEventConsumer.initConsumers()
    ]);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(`${failures.length} 个消费者初始化失败，系统将使用部分 MQ 功能运行`);
      failures.forEach((f, i) => logger.warn(`消费者初始化错误 ${i + 1}: ${f.reason?.message || f.reason}`));
    } else {
      logger.info('✅ 所有 MQ 消费者初始化成功');
    }

    // 尝试更新系统状态并发送启动通知（若可用）
    try {
      const services = await import('./services/index.js');
      if (services.systemStatusService && typeof services.systemStatusService.updateMqStatus === 'function') {
        services.systemStatusService.updateMqStatus({
          initialized: true,
          connected: true,
          consumers: results.filter(r => r.status === 'fulfilled').length
        });
      }

      if (services.systemStatusService && typeof services.systemStatusService.sendStatusReport === 'function') {
        try {
          await services.systemStatusService.sendStatusReport('startup');
          logger.info('系统启动通知已发送');
        } catch (notifyErr) {
          logger.warn(`发送启动通知失败: ${notifyErr.message}`);
        }
      }
    } catch (svcErr) {
      logger.warn('无法更新 systemStatusService: ', svcErr.message);
    }

    return true;
  } catch (err) {
    logger.error('MQ 初始化过程发生错误: ', err.message || err);
    return false;
  }
}
