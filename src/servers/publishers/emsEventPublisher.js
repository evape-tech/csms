/**
 * EMS事件发布者
 * 负责发布能源管理系统相关事件到消息队列
 */
import * as emsService from '../services/emsService.js';

// 重新导出事件类型，方便使用
const EVENT_TYPES = emsService.EVENT_TYPES;

/**
 * 请求功率分配计算
 * @param {Object} data - 功率分配请求数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function requestAllocation(data) {
  console.log(`📤 发布功率分配请求:`, data);
  
  const requestData = {
    requestId: data.requestId || Date.now().toString(),
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await emsService.requestAllocation(requestData);
}

/**
 * 发布功率配置更新事件
 * @param {Object} data - 更新数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishProfileUpdate(data) {
  console.log(`📤 发布功率配置更新事件: cpid=${data.cpid}`);
  
  const eventData = {
    eventType: EVENT_TYPES.PROFILE_UPDATE,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await emsService.publishProfileUpdate(eventData);
}

/**
 * 发布全站重新分配事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>} - 是否成功发布
 */
async function publishGlobalReallocation(data) {
  console.log(`📤 发布全站功率重新分配事件: trigger=${data.trigger}`);
  
  const eventData = {
    eventType: EVENT_TYPES.GLOBAL_REALLOCATION,
    requestId: data.requestId || Date.now().toString(),
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  return await emsService.publishGlobalReallocation(eventData);
}

export { EVENT_TYPES, requestAllocation, publishProfileUpdate, publishGlobalReallocation };
