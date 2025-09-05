/**
 * 充电事件处理服务
 * 处理所有与充电相关的事件
 */
const mqService = require('./mqService');
const { EXCHANGES } = require('../mqServer');

// 定义事件类型
const EVENT_TYPES = {
  CHARGING_STARTED: 'charging.started',
  CHARGING_STOPPED: 'charging.stopped',
  STATUS_CHANGED: 'status.changed',
  METER_VALUES: 'meter.values',
  CONNECTION_STATE: 'connection.state'
};

/**
 * 发布充电开始事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishChargingStarted(data) {
  return await mqService.publishMessage(EXCHANGES.OCPP_EVENTS, EVENT_TYPES.CHARGING_STARTED, data);
}

/**
 * 发布充电结束事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishChargingStopped(data) {
  return await mqService.publishMessage(EXCHANGES.OCPP_EVENTS, EVENT_TYPES.CHARGING_STOPPED, data);
}

/**
 * 发布状态变更事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishStatusChanged(data) {
  return await mqService.publishMessage(EXCHANGES.OCPP_EVENTS, EVENT_TYPES.STATUS_CHANGED, data);
}

/**
 * 发布计量值事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishMeterValues(data) {
  return await mqService.publishMessage(EXCHANGES.OCPP_EVENTS, EVENT_TYPES.METER_VALUES, data);
}

/**
 * 发布连接状态事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishConnectionState(data) {
  return await mqService.publishMessage(EXCHANGES.OCPP_EVENTS, EVENT_TYPES.CONNECTION_STATE, data);
}

/**
 * 处理充电开始事件
 * @param {Object} data - 事件数据
 */
async function handleChargingStarted(data) {
  console.log(`⚡ 处理充电开始事件:`, data);
  // 在这里添加充电开始的业务逻辑
  
  // 可以触发其他相关事件
  await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'charging.notification', {
    type: 'CHARGING_STARTED',
    message: `充电桩 ${data.cpid} 开始充电`,
    data
  });
}

/**
 * 处理充电结束事件
 * @param {Object} data - 事件数据
 */
async function handleChargingStopped(data) {
  console.log(`🛑 处理充电结束事件:`, data);
  // 在这里添加充电结束的业务逻辑
  
  // 可以触发其他相关事件
  await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'charging.notification', {
    type: 'CHARGING_STOPPED',
    message: `充电桩 ${data.cpid} 结束充电`,
    data
  });
}

module.exports = {
  EVENT_TYPES,
  publishChargingStarted,
  publishChargingStopped,
  publishStatusChanged,
  publishMeterValues,
  publishConnectionState,
  handleChargingStarted,
  handleChargingStopped
};
