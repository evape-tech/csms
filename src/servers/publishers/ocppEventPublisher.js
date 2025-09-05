/**
 * OCPP事件发布者
 * 负责发布OCPP相关事件到消息队列
 */
const chargeEventService = require('../services/chargeEventService');

// 重新导出事件类型，方便使用
const EVENT_TYPES = chargeEventService.EVENT_TYPES;

/**
 * 发布充电开始事件
 * @param {Object} data - 充电开始数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishChargingStarted(data) {
  console.log(`📤 发布充电开始事件:`, data);
  
  const eventData = {
    eventType: EVENT_TYPES.CHARGING_STARTED,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await chargeEventService.publishChargingStarted(eventData);
}

/**
 * 发布充电结束事件
 * @param {Object} data - 充电结束数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishChargingStopped(data) {
  console.log(`📤 发布充电结束事件:`, data);
  
  const eventData = {
    eventType: EVENT_TYPES.CHARGING_STOPPED,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await chargeEventService.publishChargingStopped(eventData);
}

/**
 * 发布状态变更事件
 * @param {Object} data - 状态变更数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishStatusChanged(data) {
  console.log(`📤 发布状态变更事件:`, data);
  
  const eventData = {
    eventType: EVENT_TYPES.STATUS_CHANGED,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await chargeEventService.publishStatusChanged(eventData);
}

/**
 * 发布计量值事件
 * @param {Object} data - 计量值数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishMeterValues(data) {
  // 计量值可能较多，减少日志输出
  console.log(`📤 发布计量值事件: cpid=${data.cpid}, connector=${data.connector}`);
  
  const eventData = {
    eventType: EVENT_TYPES.METER_VALUES,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await chargeEventService.publishMeterValues(eventData);
}

/**
 * 发布连接状态事件
 * @param {Object} data - 连接状态数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishConnectionState(data) {
  console.log(`📤 发布连接状态事件: cpsn=${data.cpsn}, state=${data.state}`);
  
  const eventData = {
    eventType: EVENT_TYPES.CONNECTION_STATE,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await chargeEventService.publishConnectionState(eventData);
}

module.exports = {
  EVENT_TYPES,
  publishChargingStarted,
  publishChargingStopped,
  publishStatusChanged,
  publishMeterValues,
  publishConnectionState
};
