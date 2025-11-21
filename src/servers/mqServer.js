const amqp = require('amqplib');
const path = require('path');

// 根據 NODE_ENV 決定使用哪個 .env 文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const { MQ_ENABLED, MQ_CONFIG, getMqUrl } = require('./config/mqConfig');

let connection = null;
let channel = null;
let reconnectAttempts = 0;

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
  try {
    // 检查是否启用了MQ
    if (!MQ_ENABLED) {
      console.log('⚠️ MQ功能已通过环境变量禁用');
      return null;
    }
    
    // 检查是否在Docker环境中运行
    const isDocker = process.env.DOCKER_ENV === 'true';
    if (isDocker) {
      console.log('🐳 检测到Docker环境，使用Docker网络中的RabbitMQ地址');
    }
    
    // 获取连接URL
    const url = getMqUrl(isDocker);
    console.log(`🔌 连接到RabbitMQ: ${url.replace(/:[^:]*@/, ':****@')}`); // 隐藏密码
    
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
    
    console.log('✅ MQ连接成功，交换机初始化完成');
    
    // 连接成功后重置重连计数
    reconnectAttempts = 0;
    
    // 监听连接关闭事件
    connection.on('close', () => {
      console.log('⚠️ MQ连接关闭，准备重连...');
      handleReconnect();
    });
    
    // 监听错误事件
    connection.on('error', (err) => {
      console.error('❌ MQ连接错误:', err.message);
      if (connection) {
        connection.close().catch((closeErr) => {
          console.error('关闭连接出错:', closeErr);
        });
      }
    });
    
    return { connection, channel };
  } catch (error) {
    console.error('❌ MQ连接失败:', error.message);
    console.log('🔄 将尝试重连...');
    return handleReconnect();
  }
}

/**
 * 处理重连逻辑
 * @returns {Promise<null>}
 */
function handleReconnect() {
  reconnectAttempts++;
  
  // 检查是否达到最大重连次数
  const { maxAttempts, interval } = MQ_CONFIG.reconnect;
  if (maxAttempts > 0 && reconnectAttempts > maxAttempts) {
    console.error(`❌ 已达到最大重连次数(${maxAttempts})，停止重连`);
    return null;
  }
  
  console.log(`🔄 重连尝试 ${reconnectAttempts}${maxAttempts > 0 ? `/${maxAttempts}` : ''}，将在${interval/1000}秒后进行...`);
  setTimeout(connect, interval);
  return null;
}

/**
 * 安全关闭MQ连接
 */
async function close() {
  try {
    if (channel) {
      await channel.close();
      console.log('✅ MQ通道已关闭');
    }
    if (connection) {
      await connection.close();
      console.log('✅ MQ连接已安全关闭');
    }
  } catch (error) {
    console.error('❌ 关闭MQ连接出错:', error.message);
  } finally {
    channel = null;
    connection = null;
    // 重置重连计数
    reconnectAttempts = 0;
  }
}

/**
 * 检查MQ是否已连接并可用
 * @returns {boolean}
 */
function isConnected() {
  return connection !== null && channel !== null;
}

// 导出模块
module.exports = {
  connect,
  close,
  EXCHANGES,
  EXCHANGE_TYPES,
  getConnection: () => connection,
  getChannel: () => channel,
  isConnected,
  handleReconnect,
  MQ_CONFIG
};
