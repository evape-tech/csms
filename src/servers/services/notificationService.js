/**
 * 通知服务
 * 处理系统通知和警报
 */
const mqService = require('./mqService');
const { EXCHANGES } = require('../mqServer');

// 定义通知类型
const NOTIFICATION_TYPES = {
  ALERT: 'alert',
  MAINTENANCE: 'maintenance',
  STATUS: 'status'
};

// 定义通知级别
const NOTIFICATION_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * 发送警报通知
 * @param {Object} data - 通知数据
 * @returns {Promise<boolean>}
 */
async function sendAlert(data) {
  const alertData = {
    type: NOTIFICATION_TYPES.ALERT,
    level: data.level || NOTIFICATION_LEVELS.WARNING,
    ...data
  };
  
  return await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, NOTIFICATION_TYPES.ALERT, alertData);
}

/**
 * 发送维护通知
 * @param {Object} data - 通知数据
 * @returns {Promise<boolean>}
 */
async function sendMaintenance(data) {
  const maintenanceData = {
    type: NOTIFICATION_TYPES.MAINTENANCE,
    level: data.level || NOTIFICATION_LEVELS.INFO,
    ...data
  };
  
  return await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, NOTIFICATION_TYPES.MAINTENANCE, maintenanceData);
}

/**
 * 发送状态通知
 * @param {Object} data - 通知数据
 * @returns {Promise<boolean>}
 */
async function sendStatus(data) {
  const statusData = {
    type: NOTIFICATION_TYPES.STATUS,
    level: data.level || NOTIFICATION_LEVELS.INFO,
    ...data
  };
  
  return await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, NOTIFICATION_TYPES.STATUS, statusData);
}

/**
 * 处理收到的通知
 * @param {Object} data - 通知数据
 */
async function handleNotification(data) {
  console.log(`📣 收到通知:`, data);
  
  // 根据通知类型和级别进行不同的处理
  switch (data.type) {
    case NOTIFICATION_TYPES.ALERT:
      await handleAlert(data);
      break;
    case NOTIFICATION_TYPES.MAINTENANCE:
      await handleMaintenance(data);
      break;
    case NOTIFICATION_TYPES.STATUS:
      await handleStatus(data);
      break;
    default:
      console.log(`⚠️ 未知的通知类型: ${data.type}`);
  }
  
  return true;
}

/**
 * 处理警报通知
 * @param {Object} data - 通知数据
 */
async function handleAlert(data) {
  console.log(`🚨 处理警报通知 [${data.level}]:`, data.message);
  
  // 在这里添加警报处理逻辑
  // 例如：记录到数据库、发送邮件等
}

/**
 * 处理维护通知
 * @param {Object} data - 通知数据
 */
async function handleMaintenance(data) {
  console.log(`🔧 处理维护通知 [${data.level}]:`, data.message);
  
  // 在这里添加维护通知处理逻辑
}

/**
 * 处理状态通知
 * @param {Object} data - 通知数据
 */
async function handleStatus(data) {
  console.log(`ℹ️ 处理状态通知 [${data.level}]:`, data.message);
  
  // 在这里添加状态通知处理逻辑
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_LEVELS,
  sendAlert,
  sendMaintenance,
  sendStatus,
  handleNotification
};
