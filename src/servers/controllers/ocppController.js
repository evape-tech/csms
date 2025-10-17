/**
 * OCPP控制器
 * 处理OCPP消息的核心控制器
 */

const WebSocket = require('ws');
const { logger } = require('../utils');
const { connectionService, ocppMessageService } = require('../services');
const { chargePointRepository } = require('../repositories');
const { mqConfig } = require('../config');
const { MQ_ENABLED } = mqConfig;

// OCPP消息类型常量
const CALL_MESSAGE = 2;
const CALLRESULT_MESSAGE = 3;
const CALLERROR_MESSAGE = 4;

/**
 * 处理WebSocket连接
 * @param {Object} ws WebSocket连接
 * @param {Object} req HTTP请求
 */
async function handleConnection(ws, req) {
  // 提取URL路径参数作为充电站ID
  const urlParts = req.url.split('/');
  const cpsn = urlParts[urlParts.length - 1];
  
  logger.info(`新的WebSocket连接: ${req.url}, CPSN: ${cpsn}`);
  
  // 注册连接
  await connectionService.registerConnection(cpsn, ws);
  
  // 设置WebSocket事件处理器
  ws.on('message', async (message) => {
    try {
      await handleMessage(cpsn, ws, message);
    } catch (err) {
      logger.error(`处理消息时出错: ${err.message}`, err);
    }
  });
  
  ws.on('close', async () => {
    try {
      await connectionService.removeConnection(cpsn, ws);
    } catch (err) {
      logger.error(`关闭连接时出错: ${err.message}`, err);
    }
  });
  
  ws.on('error', (err) => {
    logger.error(`WebSocket错误: ${err.message}`, err);
    try {
      connectionService.removeConnection(cpsn, ws);
    } catch (error) {
      logger.error(`处理错误时出错: ${error.message}`, error);
    }
  });
}

/**
 * 处理接收到的消息
 * @param {string} cpsn 充电站序列号
 * @param {Object} ws WebSocket连接
 * @param {Object} message 接收到的消息
 */
async function handleMessage(cpsn, ws, message) {
  let messageStr = message.toString();
  
  // 记录原始消息到数据库 - 这是与原始代码保持一致的关键
  try {
    // 使用充电站的主要CPID或fallback到CPSN
    const cpid = connectionService.getStationPrimaryCpid ? 
      connectionService.getStationPrimaryCpid(cpsn) : cpsn;
    
    // 记录原始消息到数据库
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: messageStr,
      time: new Date(),
      inout: "in",
    });
  } catch (logErr) {
    logger.error(`记录消息到数据库失败: ${logErr.message}`, logErr);
  }
  
  // 尝试解析消息并根据 OCPP 消息类型拆解字段
  let messageId, action, payload, msgTypeId;
  try {
    const parsedMessage = JSON.parse(messageStr);

    // OCPP 消息格式：
    // CALL:       [2, messageId, action, payload]
    // CALLRESULT: [3, messageId, payload]
    // CALLERROR:  [4, messageId, errorCode, errorDescription, errorDetails?]
    msgTypeId = parsedMessage[0];
    messageId = parsedMessage[1];

    if (msgTypeId === CALL_MESSAGE) {
      action = parsedMessage[2];
      payload = parsedMessage[3];
    } else if (msgTypeId === CALLRESULT_MESSAGE) {
      action = undefined;
      payload = parsedMessage[2];
    } else if (msgTypeId === CALLERROR_MESSAGE) {
      action = undefined;
      payload = {
        errorCode: parsedMessage[2],
        errorDescription: parsedMessage[3],
        errorDetails: parsedMessage[4]
      };
    } else {
      // fallback：保留原始解構（兼容未知格式）
      [msgTypeId, messageId, action, payload] = parsedMessage;
    }

    logger.info(`收到来自 ${cpsn} 的消息: [${msgTypeId}, ${messageId}, ${action || ''}, ${payload ? JSON.stringify(payload) : 'undefined'}]`);
  } catch (err) {
    logger.error(`无法解析消息: ${messageStr}`, err);
    return;
  }
  
  // 根据消息类型处理
  switch (msgTypeId) {
    case CALL_MESSAGE:
      // 充电站向服务器发送请求
      await handleCallMessage(cpsn, ws, messageId, action, payload);
      break;
    
    case CALLRESULT_MESSAGE:
      // 接收充电站对我们请求的响应
      await handleCallResultMessage(cpsn, messageId, payload);
      break;
    
    case CALLERROR_MESSAGE:
      // 继续执行 CALLERROR 的业务处理逻辑
      await handleCallErrorMessage(cpsn, messageId, payload);
      break;
    
    default:
      logger.error(`未知的消息类型: ${msgTypeId}`);
  }
  
  // 如果启用了MQ，发布消息到MQ
  if (MQ_ENABLED) {
    try {
      // 这里会调用MQ服务发布消息
      // 具体实现在MQ服务中
    } catch (err) {
      logger.error(`发布MQ消息时出错: ${err.message}`, err);
    }
  }
}

/**
 * 处理调用消息 (充电站 -> 服务器)
 * @param {string} cpsn 充电站序列号
 * @param {Object} ws WebSocket连接
 * @param {string} messageId 消息ID
 * @param {string} action 操作名称
 * @param {Object} payload 消息负载
 */
async function handleCallMessage(cpsn, ws, messageId, action, payload) {
  // logger.info(`处理来自 ${cpsn} 的调用: ${action}`);
  
  let response = {};
  
  try {
    // 根据不同的操作类型调用对应的服务方法
    switch (action) {
      case 'BootNotification':
        response = await ocppMessageService.handleBootNotification(cpsn, payload);
        break;
      
      case 'StatusNotification':
        response = await ocppMessageService.handleStatusNotification(cpsn, payload);
        break;
      
      case 'Heartbeat':
        response = await ocppMessageService.handleHeartbeat(cpsn);
        break;
      
      case 'MeterValues':
        response = await ocppMessageService.handleMeterValues(cpsn, payload);
        break;
      
      case 'StartTransaction':
        response = await ocppMessageService.handleStartTransaction(cpsn, payload);
        break;
      
      case 'StopTransaction':
        response = await ocppMessageService.handleStopTransaction(cpsn, payload);
        break;
      
      case 'DataTransfer':
        response = await ocppMessageService.handleDataTransfer(cpsn, payload);
        break;
        
      case 'Authorize':
        response = await ocppMessageService.handleAuthorize(cpsn, payload);
        break;
      
      default:
        logger.warn(`未实现的操作: ${action}`);
        // 对于未知操作，返回空对象作为响应
        response = {};
    }
    
    // 准备响应消息
    const callResultMessage = JSON.stringify([CALLRESULT_MESSAGE, messageId, response]);
    
    // 发送响应前先记录到数据库
    try {
      // 使用充电站的主要CPID或fallback到CPSN
      const cpid = connectionService.getStationPrimaryCpid ? 
        connectionService.getStationPrimaryCpid(cpsn) : cpsn;
      
      // 记录响应消息到数据库
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: callResultMessage,
        time: new Date(),
        inout: "out",
      });
    } catch (logErr) {
      logger.error(`记录响应到数据库失败: ${logErr.message}`, logErr);
    }
    
    // 发送响应
    ws.send(callResultMessage);
    
    logger.debug(`已发送响应 ${messageId}: ${JSON.stringify(response)}`);
  } catch (err) {
    logger.error(`处理 ${action} 时出错: ${err.message}`, err);
    
    // 准备错误响应
    const errorResponse = {
      error: {
        code: 'InternalError',
        description: `处理 ${action} 时出错: ${err.message}`
      }
    };
    
    const callErrorMessage = JSON.stringify([CALLERROR_MESSAGE, messageId, errorResponse]);
    
    // 发送错误响应前先记录到数据库
    try {
      // 使用充电站的主要CPID或fallback到CPSN
      const cpid = connectionService.getStationPrimaryCpid ? 
        connectionService.getStationPrimaryCpid(cpsn) : cpsn;
      
      // 记录错误响应到数据库
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: callErrorMessage,
        time: new Date(),
        inout: "out",
      });
    } catch (logErr) {
      logger.error(`记录错误响应到数据库失败: ${logErr.message}`, logErr);
    }
    
    // 发送错误响应
    ws.send(callErrorMessage);
  }
}

/**
 * 处理调用结果消息 (服务器 <- 充电站)
 * @param {string} cpsn 充电站序列号
 * @param {string} messageId 消息ID
 * @param {Object} payload 消息负载
 */
async function handleCallResultMessage(cpsn, messageId, payload) {
  // logger.info(`接收到 ${cpsn} 对 ${messageId} 的响应`);
  
  try {
    // 这里可以处理充电站对我们发送的请求的响应
    // 例如，我们发送了一个RemoteStartTransaction，这里会处理充电站的响应
    
    // 具体实现可能需要一个待处理请求的映射来跟踪每个请求的回调
  } catch (err) {
    logger.error(`处理调用结果时出错: ${err.message}`, err);
  }
}

/**
 * 处理调用错误消息 (服务器 <- 充电站)
 * @param {string} cpsn 充电站序列号
 * @param {string} messageId 消息ID
 * @param {Object} payload 错误负载
 */
async function handleCallErrorMessage(cpsn, messageId, payload) {
  logger.error(`接收到 ${cpsn} 对 ${messageId} 的错误: ${JSON.stringify(payload)}`);
  
  try {
    // 处理错误响应
    // 可能需要通知相应的服务或重试请求
  } catch (err) {
    logger.error(`处理调用错误时出错: ${err.message}`, err);
  }
}

/**
 * 启动远程充电
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {string} idTag 用户标识
 * @param {string} userUuid 用戶UUID
 * @param {string} userRole 用戶角色
 * @returns {Promise<boolean>} 是否成功发送命令
 */
async function startRemoteCharging(cpsn, connectorId, idTag, userUuid) {
  logger.info(`启动远程充电: ${cpsn}, 连接器: ${connectorId}, IdTag: ${idTag}, 用戶UUID: ${userUuid || '未提供'}`);
  
  try {
    return await ocppMessageService.sendRemoteStartTransaction(cpsn, connectorId, idTag, userUuid);
  } catch (err) {
    logger.error(`启动远程充电时出错: ${err.message}`, err);
    return false;
  }
}

/**
 * 停止远程充电
 * @param {string} cpsn 充电站序列号
 * @param {number} transactionId 交易ID
 * @param {string} userUuid 用戶UUID
 * @param {string} userRole 用戶角色
 * @returns {Promise<boolean>} 是否成功发送命令
 */
async function stopRemoteCharging(cpsn, transactionId, userUuid = null, userRole = null) {
  logger.info(`停止远程充电: ${cpsn}, 交易ID: ${transactionId}, 用戶UUID: ${userUuid || '未提供'}, 角色: ${userRole || '未知'}`);
  
  try {
    return await ocppMessageService.sendRemoteStopTransaction(cpsn, transactionId, userUuid, userRole);
  } catch (err) {
    logger.error(`停止远程充电时出错: ${err.message}`, err);
    return false;
  }
}

/**
 * 重启充电桩
 * @param {string} cpsn 充电站序列号
 * @param {string} type 重启类型 (Hard/Soft)
 * @returns {Promise<boolean>} 是否成功发送命令
 */
async function resetChargePoint(cpsn, type = 'Soft') {
  logger.info(`重启充电桩: ${cpsn}, 类型: ${type}`);
  
  try {
    return await ocppMessageService.sendResetCommand(cpsn, type);
  } catch (err) {
    logger.error(`重启充电桩时出错: ${err.message}`, err);
    return false;
  }
}

/**
 * 获取在线充电桩列表
 * @returns {Promise<Array>} 在线充电桩ID列表
 */
async function getOnlineChargePoints() {
  try {
    return await connectionService.getOnlineCpids();
  } catch (err) {
    logger.error(`获取在线充电桩列表时出错: ${err.message}`, err);
    return [];
  }
}

/**
 * 查詢充電樁狀態
 * @param {Object} query - 查詢參數 { cpid?, cpsn? }
 * @returns {Promise<Object|Array>} 充電樁狀態資料
 */
async function getChargePointsStatus(query = {}) {
  try {
    const { cpid, cpsn } = query;
    
    // 根據查詢參數建立過濾條件
    const filter = {};
    if (cpid) filter.cpid = cpid;
    if (cpsn) filter.cpsn = cpsn;
    
    // 查詢充電樁資料
    const guns = await chargePointRepository.getAllGuns(filter);
    
    // 轉換資料格式，只返回狀態相關的欄位
    const statusData = guns.map(gun => ({
      id: gun.id,
      cpid: gun.cpid,
      cpsn: gun.cpsn,
      connector: gun.connector,
      guns_status: gun.guns_status,
      acdc: gun.acdc,
      max_kw: gun.max_kw,
      guns_memo1: gun.guns_memo1,
      createdAt: gun.createdAt,
      updatedAt: gun.updatedAt
    }));
    
    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件
    if ((cpid || cpsn) && statusData.length === 1) {
      return statusData[0];
    }
    
    // 返回陣列格式（多筆或無過濾條件）
    return statusData;
  } catch (err) {
    logger.error(`查詢充電樁狀態時出錯: ${err.message}`, err);
    throw err;
  }
}

/**
 * 手动触发全站功率配置更新 - 已转移至emsController.js
 * 此方法保留此處只用于向後兼容，實際轉調emsController.trigger_profile_update
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_profile_update(req, res) {
  try {
    logger.info('🚀 收到手动触发全站功率配置更新请求，转发至EMS控制器...');
    
    // 导入EMS控制器并调用其方法
    const emsController = require('./emsController');
    return await emsController.trigger_profile_update(req, res);
    
  } catch (error) {
    logger.error('❌ 转发至EMS控制器过程中发生错误:', error);
    
    // 回传错误信息
    res.status(500).json({
      success: false,
      message: '触发功率配置更新失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 手動觸發特定電表功率重新分配
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_meter_reallocation(req, res) {
  try {
    logger.info('🔄 收到手动触发电表功率重新分配请求');
    logger.info(`📊 请求参数:`, JSON.stringify(req.body));
    
    const { meter_id, source = 'manual-api-trigger' } = req.body;
    
    if (!meter_id) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: meter_id',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🎯 针对电表 ${meter_id} 触发功率重新分配`);
    
    // 导入EMS控制器并调用其方法
    const emsController = require('./emsController');
    return await emsController.trigger_meter_reallocation(req, res);
    
  } catch (error) {
    logger.error('❌ 触发电表功率重新分配过程中发生错误:', error);
    
    res.status(500).json({
      success: false,
      message: '触发电表功率重新分配失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 手動觸發特定站點功率重新分配
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_station_reallocation(req, res) {
  try {
    logger.info('🏢 收到手动触发站点功率重新分配请求');
    logger.info(`📊 请求参数:`, JSON.stringify(req.body));
    
    const { station_id, source = 'manual-api-trigger' } = req.body;
    
    if (!station_id) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: station_id',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🎯 针对站点 ${station_id} 触发功率重新分配`);
    
    // 导入EMS控制器并调用其方法
    const emsController = require('./emsController');
    return await emsController.trigger_station_reallocation(req, res);
    
  } catch (error) {
    logger.error('❌ 触发站点功率重新分配过程中发生错误:', error);
    
    res.status(500).json({
      success: false,
      message: '触发站点功率重新分配失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  handleConnection,
  startRemoteCharging,
  stopRemoteCharging,
  resetChargePoint,
  getOnlineChargePoints,
  getChargePointsStatus,
  trigger_profile_update,
  trigger_meter_reallocation,
  trigger_station_reallocation
};
