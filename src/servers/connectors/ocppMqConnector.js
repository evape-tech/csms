/**
 * OCPP MQ连接器
 * 将OCPP控制器与MQ系统集成
 */

import * as ocppEventPublisher from '../publishers/ocppEventPublisher.js';
import { isConnected } from '../mqServer.js';
import * as systemStatusService from '../services/systemStatusService.js';

/**
 * 发布充电桩状态事件
 * @param {string} chargePointId - 充电桩ID
 * @param {string} status - 充电桩状态
 * @param {Object} additionalData - 额外数据
 */
async function publishStatusEvent(chargePointId, status, additionalData = {}) {
  if (!isConnected()) return;
  
  try {
    await ocppEventPublisher.publishStatusChanged({
      cpsn: chargePointId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    });
    
    systemStatusService.incrementEventCounter('sent');
  } catch (error) {
    console.error(`❌ 发布状态事件失败 - ${chargePointId}: ${error.message}`);
    systemStatusService.incrementEventCounter('errors');
  }
}

/**
 * 发布充电开始事件
 * @param {Object} chargingSession - 充电会话信息
 */
async function publishChargingStarted(chargingSession) {
  if (!isConnected()) return;
  
  try {
    await ocppEventPublisher.publishChargingStarted({
      ...chargingSession,
      timestamp: new Date().toISOString()
    });
    
    systemStatusService.incrementEventCounter('sent');
  } catch (error) {
    console.error(`❌ 发布充电开始事件失败: ${error.message}`);
    systemStatusService.incrementEventCounter('errors');
  }
}

/**
 * 发布充电结束事件
 * @param {Object} chargingSession - 充电会话信息
 */
async function publishChargingStopped(chargingSession) {
  if (!isConnected()) return;
  
  try {
    await ocppEventPublisher.publishChargingStopped({
      ...chargingSession,
      timestamp: new Date().toISOString()
    });
    
    systemStatusService.incrementEventCounter('sent');
  } catch (error) {
    console.error(`❌ 发布充电结束事件失败: ${error.message}`);
    systemStatusService.incrementEventCounter('errors');
  }
}

/**
 * 发布电表读数事件
 * @param {string} chargePointId - 充电桩ID
 * @param {string} connectorId - 连接器ID
 * @param {Array} meterValues - 电表读数数组
 */
async function publishMeterValues(chargePointId, connectorId, meterValues) {
  if (!isConnected()) return;
  
  try {
    await ocppEventPublisher.publishMeterValues({
      cpsn: chargePointId,
      connectorId,
      values: meterValues,
      timestamp: new Date().toISOString()
    });
    
    systemStatusService.incrementEventCounter('sent');
  } catch (error) {
    console.error(`❌ 发布电表读数事件失败 - ${chargePointId}: ${error.message}`);
    systemStatusService.incrementEventCounter('errors');
  }
}

/**
 * 发布OCPP消息事件
 * @param {string} chargePointId - 充电桩ID 
 * @param {Object} message - OCPP消息
 * @param {string} direction - 消息方向 ('incoming' 或 'outgoing')
 */
async function publishOcppMessage(chargePointId, message, direction) {
  if (!isConnected()) return;
  
  try {
    await ocppEventPublisher.publishOcppMessage({
      cpsn: chargePointId,
      message,
      direction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ 发布OCPP消息事件失败 - ${chargePointId}: ${error.message}`);
    systemStatusService.incrementEventCounter('errors');
  }
}

export { publishStatusEvent, publishChargingStarted, publishChargingStopped, publishMeterValues, publishOcppMessage };
