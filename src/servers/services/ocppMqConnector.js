/**
 * OCPP控制器MQ连接器
 * 
 * 这个文件作为ocppController.js和MQ系统之间的桥梁
 * 用于在不修改原始ocppController.js的情况下添加MQ事件发布功能
 */
import { ocppEventPublisher } from '../publishers/ocppEventPublisher.js';
import { emsEventPublisher } from '../publishers/emsEventPublisher.js';
import * as mqServer from '../mqServer.js';

/**
 * 检查MQ是否可用
 * @returns {boolean} MQ是否可用
 */
function isMQAvailable() {
  return !!mqServer.getChannel();
}

/**
 * 发布充电开始事件
 * @param {string} cpsn 充电站序列号
 * @param {string} cpid 充电桩ID
 * @param {number} connector 连接器编号
 * @param {string} transactionId 交易ID
 */
async function publishChargingStarted(cpsn, cpid, connector, transactionId) {
  if (!isMQAvailable()) return;
  
  try {
    await ocppEventPublisher.publishChargingStarted({
      cpsn,
      cpid,
      connector,
      transactionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布充电开始事件失败:', error.message);
  }
}

/**
 * 发布充电结束事件
 * @param {string} cpsn 充电站序列号
 * @param {string} cpid 充电桩ID
 * @param {number} connector 连接器编号
 * @param {string} transactionId 交易ID
 * @param {number} meterStop 结束时的表计读数
 */
async function publishChargingStopped(cpsn, cpid, connector, transactionId, meterStop) {
  if (!isMQAvailable()) return;
  
  try {
    await ocppEventPublisher.publishChargingStopped({
      cpsn,
      cpid,
      connector,
      transactionId,
      meterStop,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布充电结束事件失败:', error.message);
  }
}

/**
 * 发布状态变更事件
 * @param {string} cpsn 充电站序列号
 * @param {string} cpid 充电桩ID
 * @param {number} connector 连接器编号
 * @param {string} oldStatus 旧状态
 * @param {string} newStatus 新状态
 */
async function publishStatusChanged(cpsn, cpid, connector, oldStatus, newStatus) {
  if (!isMQAvailable()) return;
  
  try {
    await ocppEventPublisher.publishStatusChanged({
      cpsn,
      cpid,
      connector,
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布状态变更事件失败:', error.message);
  }
}

/**
 * 发布计量值事件
 * @param {string} cpsn 充电站序列号
 * @param {string} cpid 充电桩ID
 * @param {number} connector 连接器编号
 * @param {Object} meterValues 计量值数据
 */
async function publishMeterValues(cpsn, cpid, connector, meterValues) {
  if (!isMQAvailable()) return;
  
  try {
    await ocppEventPublisher.publishMeterValues({
      cpsn,
      cpid,
      connector,
      ...meterValues,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布计量值事件失败:', error.message);
  }
}

/**
 * 发布全站功率重新分配事件
 * @param {string} triggerEvent 触发事件
 * @param {Object} details 事件详情
 */
async function publishGlobalReallocation(triggerEvent, details) {
  if (!isMQAvailable()) return;
  
  try {
    await emsEventPublisher.publishGlobalReallocation({
      trigger: triggerEvent,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布全站功率重新分配事件失败:', error.message);
  }
}

/**
 * 发布功率配置更新事件
 * @param {string} cpid 充电桩ID
 * @param {Object} profileData 配置数据
 */
async function publishProfileUpdate(cpid, profileData) {
  if (!isMQAvailable()) return;
  
  try {
    await emsEventPublisher.publishProfileUpdate({
      cpid,
      profileData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 发布功率配置更新事件失败:', error.message);
  }
}

export { publishChargingStarted, publishChargingStopped, publishStatusChanged, publishMeterValues, publishGlobalReallocation, publishProfileUpdate };
