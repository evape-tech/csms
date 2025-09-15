/**
 * 全局环境变量配置
 * 统一管理系统中使用的环境变量
 */

// 导入dotenv以确保环境变量已加载
require('dotenv').config();

// 运行环境
const ENV = {
  // 当前环境: 'development', 'test', 'production'
  NODE_ENV: process.env.NODE_ENV || 'development',
  // 是否在Docker环境中运行
  DOCKER_ENV: process.env.DOCKER_ENV === 'true',
  // 是否开启调试模式
  DEBUG: process.env.DEBUG === 'true'
};

// 服务配置
const SERVER = {
  // HTTP服务器主机
  HOST: process.env.OCPP_HOST || 'localhost',
  // HTTP服务器端口
  PORT: parseInt(process.env.OCPP_PORT || process.env.PORT || '8089', 10),
  // 允许的跨域来源
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  // 状态报告间隔(毫秒)
  STATUS_REPORT_INTERVAL: parseInt(process.env.STATUS_REPORT_INTERVAL || '600000', 10) // 默认10分钟
};

// 数据库配置
const DATABASE = {
  // 默认数据库提供商：mysql 或 mssql
  PROVIDER: process.env.DATABASE_PROVIDER || 'mysql',
  // 数据库URL
  URL: process.env.DATABASE_URL,
  // 是否启用数据库连接
  ENABLED: process.env.DATABASE_ENABLED !== 'false'
};

// MQ配置
const MQ = {
  // 是否启用MQ功能
  ENABLED: process.env.ENABLE_MQ !== 'false',
  // RabbitMQ配置
  RABBIT: {
    HOST: process.env.RABBITMQ_HOST || 'localhost',
    PORT: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    USER: process.env.RABBITMQ_USER || 'guest',
    PASS: process.env.RABBITMQ_PASS || 'guest',
    VHOST: process.env.RABBITMQ_VHOST || '/',
    HOST_DOCKER: process.env.RABBITMQ_HOST_DOCKER || 'rabbitmq'
  }
};

// OCPP协议配置
const OCPP = {
  // 支持的OCPP版本
  VERSIONS: ['1.6'],
  // 心跳间隔(秒)
  HEARTBEAT_INTERVAL: parseInt(process.env.OCPP_HEARTBEAT_INTERVAL || '300', 10),
  // 请求超时(毫秒)
  REQUEST_TIMEOUT: parseInt(process.env.OCPP_REQUEST_TIMEOUT || '30000', 10),
  // 最大充电功率限制(kW)
  MAX_CHARGING_POWER: parseFloat(process.env.OCPP_MAX_CHARGING_POWER || '100'),
  // 电表值上报间隔(秒)
  METER_VALUES_INTERVAL: parseInt(process.env.OCPP_METER_VALUES_INTERVAL || '60', 10)
};

// EMS配置
const EMS = {
  // 是否启用EMS功能
  ENABLED: process.env.ENABLE_EMS !== 'false',
  // 配电模式：'equal', 'dynamic', 'fifo'等
  ALLOCATION_MODE: process.env.EMS_ALLOCATION_MODE || 'dynamic'
};

module.exports = {
  ENV,
  SERVER,
  DATABASE,
  MQ,
  OCPP,
  EMS
};
