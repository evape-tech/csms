/**
 * MQ配置文件
 * 包含所有与消息队列相关的配置项
 */

const path = require('path');

// 根據 NODE_ENV 決定使用哪個 .env 文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

// 是否启用MQ功能
const MQ_ENABLED = process.env.ENABLE_MQ !== 'false';

// RabbitMQ连接配置
const MQ_CONFIG = {
  // 基本连接配置
  connection: {
    user: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASS || 'guest',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    vhost: process.env.RABBITMQ_VHOST || '/',
    // 如果在Docker环境中运行，使用Docker网络中的RabbitMQ地址
    hostDocker: process.env.RABBITMQ_HOST_DOCKER || 'rabbitmq',
    // 连接选项
    options: {
      timeout: parseInt(process.env.RABBITMQ_TIMEOUT || '10000', 10),
      heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60', 10)
    }
  },
  
  // 重连配置
  reconnect: {
    // 重连间隔(毫秒)
    interval: parseInt(process.env.RABBITMQ_RECONNECT_INTERVAL || '5000', 10),
    // 最大重连次数，0表示无限制
    maxAttempts: parseInt(process.env.RABBITMQ_MAX_RECONNECT || '0', 10)
  },
  
  // 交换机配置
  exchanges: {
    // OCPP事件交换机
    ocppEvents: {
      name: 'ocpp.events',
      type: 'topic',
      options: { durable: true }
    },
    // EMS事件交换机
    emsEvents: {
      name: 'ems.events',
      type: 'topic',
      options: { durable: true }
    },
    // 通知事件交换机
    notificationEvents: {
      name: 'notification.events',
      type: 'fanout',
      options: { durable: true }
    }
  },
  
  // 队列配置
  queues: {
    // OCPP事件队列
    ocpp: {
      chargingStarted: 'ocpp.charging.started',
      chargingStopped: 'ocpp.charging.stopped',
      statusChanged: 'ocpp.status.changed',
      meterValues: 'ocpp.meter.values',
      connectionState: 'ocpp.connection.state'
    },
    // EMS事件队列
    ems: {
      allocationRequest: 'ems.allocation.request',
      allocationResult: 'ems.allocation.result',
      profileUpdate: 'ems.profile.update',
      globalReallocation: 'ems.global.reallocation'
    }
  },
  
  // 消费者配置
  consumers: {
    // 预取数量
    prefetch: {
      default: parseInt(process.env.RABBITMQ_PREFETCH_DEFAULT || '1', 10),
      meterValues: parseInt(process.env.RABBITMQ_PREFETCH_METER_VALUES || '20', 10),
      statusChanged: parseInt(process.env.RABBITMQ_PREFETCH_STATUS_CHANGED || '10', 10)
    }
  }
};

// 生成RabbitMQ连接URL
function getMqUrl(isDocker = false) {
  const { user, password, host, hostDocker, port, vhost } = MQ_CONFIG.connection;
  const hostname = isDocker ? hostDocker : host;
  return `amqp://${user}:${password}@${hostname}:${port}${vhost}`;
}

module.exports = {
  MQ_ENABLED,
  MQ_CONFIG,
  getMqUrl
};
