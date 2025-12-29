/**
 * MQ基础服务封装
 * 提供消息发布和订阅的通用方法
 */
import { getChannel, isConnected, MQ_CONFIG } from '../mqServer.js';

/**
 * 发布消息到指定交换机和路由键
 * @param {string} exchange - 交换机名称
 * @param {string} routingKey - 路由键
 * @param {Object} data - 要发送的数据
 * @param {Object} options - 发布选项
 * @returns {Promise<boolean>} - 发布是否成功
 */
async function publishMessage(exchange, routingKey, data, options = {}) {
  try {
    // 检查MQ连接状态
    if (!isConnected()) {
      console.warn(`⚠️ MQ未连接，无法发布消息 - 交换机: ${exchange}, 路由键: ${routingKey}`);
      return false;
    }
    
    const channel = getChannel();
    
    // 生成唯一消息ID
    const messageId = options.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const message = Buffer.from(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }));
    
    const publishOptions = {
      persistent: true,  // 消息持久化
      messageId: messageId,  // 设置消息ID
      ...options
    };
    
    const success = await channel.publish(exchange, routingKey, message, publishOptions);
    
    if (success) {
      console.log(`📤 消息发布成功 - 交换机: ${exchange}, 路由键: ${routingKey}, 消息ID: ${messageId}`);
    } else {
      console.warn(`⚠️ 消息发布返回false - 交换机: ${exchange}, 路由键: ${routingKey}, 消息ID: ${messageId}`);
    }
    
    return success;
  } catch (error) {
    console.error(`❌ 消息发布失败 - 交换机: ${exchange}, 路由键: ${routingKey}:`, error.message);
    return false;
  }
}

/**
 * 创建一个消费者
 * @param {string} queue - 队列名称
 * @param {function} handler - 消息处理函数
 * @param {Object} options - 消费者选项
 * @returns {Promise<Object|null>} - 消费者信息
 */
async function setupConsumer(queue, handler, options = {}) {
  try {
    // 检查MQ连接状态
    if (!isConnected()) {
      console.warn(`⚠️ MQ未连接，无法创建消费者 - 队列: ${queue}`);
      return null;
    }
    
    const channel = getChannel();
    
    // 确保队列存在
    const queueOptions = { 
      durable: true,
      ...options
    };
    
    // 如果需要死信队列，创建相关配置
    if (options.deadLetterExchange) {
      queueOptions.arguments = {
        'x-dead-letter-exchange': options.deadLetterExchange,
        'x-dead-letter-routing-key': options.deadLetterRoutingKey || queue,
        'x-message-ttl': options.messageTtl || 60000, // 默认1分钟
      };
    }
    
    await channel.assertQueue(queue, queueOptions);
    
    // 设置预取数量 - 根据队列名称使用特定预取值或默认值
    const prefetchCount = getPrefetchCount(queue, options.prefetch);
    await channel.prefetch(prefetchCount);
    
    // 开始消费
    const consumer = await channel.consume(queue, async (msg) => {
      if (!msg) return;
      
      try {
        // 解析消息内容
        const content = JSON.parse(msg.content.toString());
        const messageId = msg.properties.messageId || 'unknown';
        
        console.log(`📥 接收消息 - 队列: ${queue}, 消息ID: ${messageId}`);
        
        // 处理消息
        const result = await handler(content, msg.properties);
        
        // 根据处理结果决定是否确认消息
        if (result !== false) {
          channel.ack(msg);
          console.log(`✓ 消息确认 - 队列: ${queue}, 消息ID: ${messageId}`);
        } else {
          // 拒绝消息但不重新入队
          channel.nack(msg, false, false);
          console.log(`✗ 消息拒绝 - 队列: ${queue}, 消息ID: ${messageId}`);
        }
      } catch (error) {
        console.error(`❌ 消息处理出错 - 队列: ${queue}:`, error);
        // 处理出错，拒绝消息并重新入队
        channel.nack(msg, false, options.requeue !== false);
      }
    }, { noAck: false });
    
    // console.log(`✅ 消费者创建成功 - 队列: ${queue}, 消费者标签: ${consumer.consumerTag}`);
    return consumer;
  } catch (error) {
    console.error(`❌ 创建消费者失败 - 队列: ${queue}:`, error.message);
    return null;
  }
}

/**
 * 根据队列名称获取适合的预取数量
 * @param {string} queue - 队列名称
 * @param {number} customPrefetch - 自定义预取数
 * @returns {number} - 预取数量
 */
function getPrefetchCount(queue, customPrefetch) {
  // 如果提供了自定义预取数，使用它
  if (customPrefetch) {
    return customPrefetch;
  }
  
  // 根据队列名称使用特定的预取配置
  if (queue.includes('meter.values')) {
    return MQ_CONFIG.consumers.prefetch.meterValues;
  } else if (queue.includes('status')) {
    return MQ_CONFIG.consumers.prefetch.statusChanged;
  }
  
  // 默认预取数
  return MQ_CONFIG.consumers.prefetch.default;
}

/**
 * 绑定队列到交换机
 * @param {string} queue - 队列名称
 * @param {string} exchange - 交换机名称
 * @param {string} routingKey - 路由键
 * @param {Object} queueOptions - 队列选项
 * @returns {Promise<boolean>}
 */
async function bindQueue(queue, exchange, routingKey, queueOptions = {}) {
  try {
    // 检查MQ连接状态
    if (!isConnected()) {
      console.warn(`⚠️ MQ未连接，无法绑定队列 - 队列: ${queue}, 交换机: ${exchange}`);
      return false;
    }
    
    const channel = getChannel();
    
    // 确保队列存在
    await channel.assertQueue(queue, { 
      durable: true,
      ...queueOptions
    });
    
    // 绑定队列到交换机
    await channel.bindQueue(queue, exchange, routingKey);
    
    // console.log(`✅ 队列绑定成功 - 队列: ${queue}, 交换机: ${exchange}, 路由键: ${routingKey}`);
    return true;
  } catch (error) {
    console.error(`❌ 队列绑定失败 - 队列: ${queue}, 交换机: ${exchange}:`, error.message);
    return false;
  }
}

/**
 * 创建死信队列
 * @param {string} queue - 队列名称 
 * @param {string} deadLetterExchange - 死信交换机
 * @param {string} deadLetterRoutingKey - 死信路由键
 * @returns {Promise<boolean>}
 */
async function setupDeadLetterQueue(queue, deadLetterExchange, deadLetterRoutingKey) {
  try {
    // 检查MQ连接状态
    if (!isConnected()) {
      console.warn(`⚠️ MQ未连接，无法创建死信队列 - 队列: ${queue}`);
      return false;
    }
    
    const channel = getChannel();
    
    // 创建死信交换机
    await channel.assertExchange(deadLetterExchange, 'direct', { durable: true });
    
    // 创建死信队列
    const deadLetterQueue = `${queue}.deadletter`;
    await channel.assertQueue(deadLetterQueue, { durable: true });
    
    // 绑定死信队列到死信交换机
    await channel.bindQueue(deadLetterQueue, deadLetterExchange, deadLetterRoutingKey);
    
    // console.log(`✅ 死信队列配置成功 - 队列: ${queue}, 死信队列: ${deadLetterQueue}`);
    return true;
  } catch (error) {
    console.error(`❌ 创建死信队列失败 - 队列: ${queue}:`, error.message);
    return false;
  }
}

export { publishMessage, setupConsumer, bindQueue, setupDeadLetterQueue, getPrefetchCount };
