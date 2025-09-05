/**
 * 系统状态服务
 * 管理和报告系统各组件状态
 */

const mqServer = require('../mqServer');
const { MQ_ENABLED } = require('../config/mqConfig');
const notificationService = require('./notificationService');

// 系统组件状态
const systemStatus = {
  // 服务状态
  ocppServer: {
    status: 'starting',
    startTime: null,
    uptime: 0,
    connections: 0
  },
  // MQ状态
  mq: {
    enabled: MQ_ENABLED,
    initialized: false,
    connected: false,
    exchanges: 0,
    queues: 0,
    consumers: 0
  },
  // 事件统计
  events: {
    received: 0,
    sent: 0,
    errors: 0
  }
};

// 更新服务启动状态
function updateServerStatus(status) {
  if (status === 'running' && systemStatus.ocppServer.status !== 'running') {
    systemStatus.ocppServer.startTime = Date.now();
  }
  
  systemStatus.ocppServer.status = status;
  
  // 计算运行时间
  if (systemStatus.ocppServer.startTime) {
    systemStatus.ocppServer.uptime = Math.floor((Date.now() - systemStatus.ocppServer.startTime) / 1000);
  }
}

// 更新MQ状态
function updateMqStatus(status = {}) {
  systemStatus.mq = {
    ...systemStatus.mq,
    ...status
  };
}

// 更新连接数量
function updateConnectionCount(count) {
  systemStatus.ocppServer.connections = count;
}

// 增加事件统计
function incrementEventCounter(type) {
  if (type in systemStatus.events) {
    systemStatus.events[type]++;
  }
}

// 获取完整系统状态
function getSystemStatus() {
  // 更新MQ连接状态
  systemStatus.mq.connected = mqServer.isConnected();
  
  // 更新运行时间
  if (systemStatus.ocppServer.startTime) {
    systemStatus.ocppServer.uptime = Math.floor((Date.now() - systemStatus.ocppServer.startTime) / 1000);
  }
  
  return {
    ...systemStatus,
    timestamp: new Date().toISOString()
  };
}

/**
 * 发送系统状态报告
 * @param {string} reason - 状态报告原因
 */
async function sendStatusReport(reason = 'periodic') {
  if (!mqServer.isConnected()) {
    return;
  }
  
  const status = getSystemStatus();
  
  try {
    await notificationService.sendStatus({
      title: 'OCPP系统状态报告',
      message: `系统状态: ${systemStatus.ocppServer.status}, MQ状态: ${systemStatus.mq.connected ? '已连接' : '未连接'}, 连接数: ${systemStatus.ocppServer.connections}`,
      level: 'info',
      timestamp: new Date().toISOString(),
      details: status,
      reason
    });
  } catch (error) {
    console.error('发送状态报告失败:', error);
  }
}

module.exports = {
  updateServerStatus,
  updateMqStatus,
  updateConnectionCount,
  incrementEventCounter,
  getSystemStatus,
  sendStatusReport
};
