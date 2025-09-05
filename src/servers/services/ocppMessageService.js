/**
 * OCPP消息服务
 * 处理OCPP协议消息的发送和接收
 */

const logger = require('../utils/logger');
const connectionService = require('./connectionService');
const chargePointRepository = require('../repositories/chargePointRepository');
// 移除對emsController的直接引用，打破循環依賴
const { generateUniqueId } = require('../utils/helpers');
const EventEmitter = require('events');

// 創建事件發射器，用於觸發OCPP事件而不直接依賴emsController
const ocppEventEmitter = new EventEmitter();

// 用於註冊OCPP事件處理器的函數
function registerOcppEventHandler(handler) {
  if (typeof handler === 'function') {
    // 移除之前的所有處理器
    ocppEventEmitter.removeAllListeners('ocpp_event');
    // 註冊新的處理器
    ocppEventEmitter.on('ocpp_event', handler);
    logger.info('[ocppMessageService] 已註冊OCPP事件處理器');
    return true;
  }
  logger.error('[ocppMessageService] 嘗試註冊無效的事件處理器');
  return false;
}

// OCPP 消息类型常量
const CALL_MESSAGE = 2;        // 请求消息
const CALLRESULT_MESSAGE = 3;  // 响应成功
const CALLERROR_MESSAGE = 4;   // 响应错误

/**
 * 处理BootNotification请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleBootNotification(cpsn, messageBody) {
  logger.info(`处理充电站 ${cpsn} 的 BootNotification`);
  
  try {
    // 初始化充电站数据
    let cpData = connectionService.wsCpdatas[cpsn];
    if (!cpData || !cpData[0]) {
      // 如果不存在，初始化数据结构
      cpData = await connectionService.initializeStationData(cpsn);
    } else {
      cpData = cpData[0];
    }
    
    // 更新充电站信息
    if (messageBody && messageBody.chargePointVendor) {
      cpData.cp_vendor = messageBody.chargePointVendor;
    }
    
    if (messageBody && messageBody.chargePointModel) {
      cpData.cp_model = messageBody.chargePointModel;
    }
    
    // 组装响应
    const response = {
      status: "Accepted",
      currentTime: new Date().toISOString(),
      interval: 30 // 心跳间隔，单位秒
    };
    
    // 记录详细日志到数据库
    try {
      // 使用第一个连接器的 cpid 作为主要记录
      const cpid = connectionService.getStationPrimaryCpid(cpsn);
      
      // 记录详细的原始数据
      const detailedLog = {
        action: "BootNotification",
        vendor: messageBody.chargePointVendor || "Unknown",
        model: messageBody.chargePointModel || "Unknown",
        serialNumber: messageBody.chargePointSerialNumber,
        firmware: messageBody.firmwareVersion,
        response: JSON.stringify(response)
      };
      
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: `Boot Notification - Model: ${cpData.cp_model}, Vendor: ${cpData.cp_vendor}, Details: ${JSON.stringify(detailedLog)}`,
        time: new Date(),
        inout: "in",
      });
    } catch (err) {
      logger.error(`记录 BootNotification 日志失败`, err);
    }
    
    return response;
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 BootNotification 失败`, error);
    return {
      status: "Rejected",
      currentTime: new Date().toISOString(),
      interval: 300
    };
  }
}

/**
 * 处理StatusNotification请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleStatusNotification(cpsn, messageBody) {
  const { connectorId, status, errorCode } = messageBody;
  logger.info(`处理充电站 ${cpsn} 的 StatusNotification: Connector ${connectorId}, Status: ${status}, Error: ${errorCode}`);
  
  try {
    // 获取或映射CPID
    let cpid = connectionService.getCpidFromWsData(cpsn, connectorId);
    
    // 如果CPID不存在，尝试创建映射
    if (!cpid) {
      logger.debug(`没有找到 ${cpsn}:${connectorId} 的映射，尝试创建`);
      cpid = await connectionService.cpidMapping(cpsn, connectorId);
      
      if (!cpid) {
        logger.warn(`无法为 ${cpsn}:${connectorId} 创建CPID映射`);
      }
    }
    
    // 更新充电桩状态
    if (cpid) {
      await chargePointRepository.updateConnectorStatus(cpid, status);
      
      // 记录状态变更日志
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: `Status changed to ${status}${errorCode !== "NoError" ? ` (Error: ${errorCode})` : ''}`,
        time: new Date(),
        inout: "in",
      });
      
      // 更新WebSocket数据中的状态
      updateStatusInWsData(cpsn, connectorId, status);
      
      // 【事件驱动】触发EMS控制器处理OCPP事件
      logger.info(`[事件驱动] 处理 StatusNotification 事件: ${cpsn}:${connectorId}, 状态: ${status}`);
      try {
        // 使用事件发射器触发OCPP事件，避免循环依赖
        ocppEventEmitter.emit('ocpp_event', 'StatusNotification', messageBody, cpsn, connectorId);
        logger.debug(`[事件驱动] StatusNotification 事件已发送`);
      } catch (emsError) {
        logger.error(`[事件驱动] 处理 StatusNotification 事件失败: ${emsError.message}`);
        // 错误不影响正常响应流程
      }
    }
    
    // StatusNotification没有特定响应内容，只返回空对象
    return {};
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 StatusNotification 失败`, error);
    return {};
  }
}

/**
 * 处理Heartbeat请求
 * @param {string} cpsn 充电站序列号
 * @returns {Promise<Object>} 响应对象
 */
async function handleHeartbeat(cpsn) {
  logger.debug(`处理充电站 ${cpsn} 的 Heartbeat`);
  
  try {
    // 获取当前时间
    const currentTime = new Date();
    const formattedTime = currentTime.toISOString();
    
    // 更新最后心跳时间
    if (connectionService.wsCpdatas[cpsn] && connectionService.wsCpdatas[cpsn][0]) {
      connectionService.wsCpdatas[cpsn][0].heartbeat = formattedTime;
    }
    
    // 每10次心跳记录一次日志(避免日志过多)
    // 使用模块级别的变量来记录心跳次数
    if (!global.heartbeatCounter) {
      global.heartbeatCounter = {};
    }
    
    if (!global.heartbeatCounter[cpsn]) {
      global.heartbeatCounter[cpsn] = 0;
    }
    
    global.heartbeatCounter[cpsn]++;
    if (global.heartbeatCounter[cpsn] >= 10) {
      global.heartbeatCounter[cpsn] = 0;
      
      // 记录日志
      try {
        const cpid = connectionService.getStationPrimaryCpid(cpsn);
        await chargePointRepository.createCpLogEntry({
          cpid: cpid,
          cpsn: cpsn,
          log: `Heartbeat`,
          time: currentTime,
          inout: "in",
        });
      } catch (err) {
        logger.error(`记录心跳日志失败`, err);
      }
    }
    
    return {
      currentTime: formattedTime
    };
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 Heartbeat 失败`, error);
    return {
      currentTime: new Date().toISOString()
    };
  }
}

/**
 * 处理MeterValues请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleMeterValues(cpsn, messageBody) {
  const { connectorId, meterValue, transactionId } = messageBody;
  logger.info(`处理充电站 ${cpsn} 的 MeterValues: Connector ${connectorId}, TransactionId: ${transactionId}`);
  
  try {
    // 获取CPID
    const cpid = connectionService.getCpidFromWsData(cpsn, connectorId);
    
    if (!cpid) {
      logger.warn(`无法找到 ${cpsn}:${connectorId} 的CPID映射`);
      return {};
    }
    
    // 初始化默认值
    let cp_data1 = "0.00"; // kWh
    let cp_data2 = "0.00"; // Current (A)
    let cp_data3 = "0.00"; // Voltage (V)
    let cp_data4 = "0.00"; // Power (kW)
    let cp_data5 = "0.00"; // 附加数据
    
    // 根据厂商不同处理MeterValues
    if (cpsn[0] === "T" && cpsn[1] === "A" && cpsn[2] === "C") {
      // ABB充电桩的处理逻辑
      logger.info(`处理ABB充电桩 ${cpsn} 的MeterValues`);
      
      // 安全检查 sampledValue 数组长度
      if (Array.isArray(meterValue) && meterValue.length > 0 && 
          meterValue[0].sampledValue && Array.isArray(meterValue[0].sampledValue)) {
        
        const sampledValues = meterValue[0].sampledValue;
        logger.debug(`收到 ${sampledValues.length} 个 sampledValue: ${JSON.stringify(sampledValues)}`);
        
        // 根据实际收到的数据解析
        for (let i = 0; i < sampledValues.length; i++) {
          const sample = sampledValues[i];
          logger.debug(`sampledValue[${i}]: ${JSON.stringify(sample)}`);
          
          if (sample.measurand === "Energy.Active.Import.Register") {
            cp_data1 = (parseFloat(sample.value) / 1000).toFixed(3); // Wh -> kWh
          } else if (sample.measurand === "Current.Import" || sample.measurand === "Current") {
            cp_data2 = parseFloat(sample.value).toFixed(2);
          } else if (sample.measurand === "Voltage") {
            cp_data3 = parseFloat(sample.value).toFixed(2);
          } else if (sample.measurand === "Power.Active.Import") {
            cp_data4 = parseFloat(sample.value).toFixed(3);
          }
        }
        
        // 如果没有直接的功率读数，计算功率 (V * A / 1000)
        if (cp_data4 === "0.00" && cp_data2 !== "0.00" && cp_data3 !== "0.00") {
          cp_data4 = (parseFloat(cp_data2) * parseFloat(cp_data3) / 1000).toFixed(3);
        }
      }
      
    } else if (cpsn[0] === "s" && cpsn[1] === "p") {
      // Spacepark充电桩的处理逻辑
      logger.info(`处理Spacepark充电桩 ${cpsn} 的MeterValues`);
      
      if (Array.isArray(meterValue) && meterValue.length > 0 && 
          meterValue[0].sampledValue && Array.isArray(meterValue[0].sampledValue)) {
        
        const sampledValues = meterValue[0].sampledValue;
        
        if (sampledValues[0].unit === "Wh") {
          // 非充电状态的数据
          cp_data1 = (parseFloat(sampledValues[0].value) / 1000).toFixed(3); // Wh -> kWh
          cp_data2 = "0.00";
          cp_data3 = "0.0";
          cp_data4 = "0.0";
        } else {
          // 充电状态的数据
          cp_data1 = (parseFloat(sampledValues[1].value) / 1000).toFixed(3); // Wh -> kWh
          cp_data2 = sampledValues[0].value;
          cp_data3 = sampledValues[3].value;
          cp_data4 = (parseFloat(cp_data2) * parseFloat(cp_data3)).toFixed(3); // 计算功率
        }
      }
      
    } else if (cpsn[0] === "G" && cpsn[1] === "S") {
      // GS充电桩的处理逻辑
      logger.info(`处理GS充电桩 ${cpsn} 的MeterValues`);
      
      if (Array.isArray(meterValue) && meterValue.length > 0 && 
          meterValue[0].sampledValue && Array.isArray(meterValue[0].sampledValue)) {
        
        const sampledValues = meterValue[0].sampledValue;
        
        // 记录所有采样值，便于诊断
        for (let i = 0; i < Math.min(sampledValues.length, 10); i++) {
          logger.debug(`metervalue_[${i}]: ${sampledValues[i].value}`);
        }
        
        if (sampledValues[0].unit === "Wh") {
          // 非充电状态的数据
          cp_data1 = (parseFloat(sampledValues[0].value) / 1000).toFixed(3); // Wh -> kWh
          cp_data2 = "0.00";
          cp_data3 = "0.0";
          cp_data4 = "0.0";
        } else {
          // 充电状态的数据
          cp_data1 = (parseFloat(sampledValues[4].value) / 1000).toFixed(3); // Wh -> kWh
          cp_data2 = sampledValues[0].value; // 电流
          cp_data3 = sampledValues[7].value; // 电压
          cp_data4 = (parseFloat(cp_data2) * parseFloat(cp_data3)).toFixed(3); // 计算功率
        }
      }
      
    } else {
      // 通用处理逻辑，适用于其他厂商
      logger.info(`处理通用充电桩 ${cpsn} 的MeterValues`);
      
      // 解析计量数据
      if (Array.isArray(meterValue) && meterValue.length > 0) {
        // 处理最新的一组数据
        const latestValues = meterValue[meterValue.length - 1];
        
        if (latestValues.sampledValue && Array.isArray(latestValues.sampledValue)) {
          // 遍历所有采样值，找出我们需要的数据
          for (const sample of latestValues.sampledValue) {
            if (sample.measurand === "Energy.Active.Import.Register") {
              cp_data1 = (parseFloat(sample.value) / (sample.unit === "Wh" ? 1000 : 1)).toFixed(3);
            } else if (sample.measurand === "Current.Import" || sample.measurand === "Current") {
              cp_data2 = parseFloat(sample.value).toFixed(2);
            } else if (sample.measurand === "Voltage") {
              cp_data3 = parseFloat(sample.value).toFixed(2);
            } else if (sample.measurand === "Power.Active.Import") {
              cp_data4 = parseFloat(sample.value).toFixed(3);
            } else if (sample.measurand === "Temperature") {
              cp_data5 = parseFloat(sample.value).toFixed(2);
            }
          }
        }
      }
    }
    
    // 更新WebSocket数据
    logger.debug(`更新 ${cpsn}:${connectorId} 的电表读数: kWh=${cp_data1}, A=${cp_data2}, V=${cp_data3}, Power=${cp_data4}`);
    
    // 使用数据库仓库更新电表数据
    await chargePointRepository.updateGunMeterValues(cpsn, connectorId, {
      guns_metervalue1: cp_data1, // kWh
      guns_metervalue2: cp_data2, // A
      guns_metervalue3: cp_data3, // V
      guns_metervalue4: cp_data4, // Power
      guns_memo2: new Date().toISOString() // 更新时间
    });
    
    // 记录日志
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: `MeterValues - Energy: ${cp_data1} kWh, Current: ${cp_data2} A, Voltage: ${cp_data3} V, Power: ${cp_data4} kW`,
      time: Array.isArray(meterValue) && meterValue.length > 0 ? new Date(meterValue[0].timestamp) : new Date(),
      inout: "in",
    });
    
    // MeterValues没有特定响应内容，只返回空对象
    return {};
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 MeterValues 失败: ${error.message}`, error);
    return {};
  }
}

/**
 * 处理StartTransaction请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleStartTransaction(cpsn, messageBody) {
  const { connectorId, idTag, meterStart, timestamp } = messageBody;
  logger.info(`处理充电站 ${cpsn} 的 StartTransaction: Connector ${connectorId}, IdTag: ${idTag}, MeterStart: ${meterStart}`);
  
  try {
    // 开发模式：简化验证逻辑
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // 获取CPID
    let cpid = connectionService.getCpidFromWsData(cpsn, connectorId);
    
    if (!cpid) {
      if (isDevelopment) {
        // 开发模式：尝试从数据库直接获取CPID
        logger.warn(`[开发模式] 无法找到 ${cpsn}:${connectorId} 的CPID映射，尝试从数据库获取`);
        try {
          const guns = await chargePointRepository.getGuns({ cpsn: cpsn });
          if (guns && guns.length > 0) {
            cpid = guns[0].cpid;
            logger.info(`[开发模式] 从数据库获取到 CPID: ${cpid}`);
          }
        } catch (dbError) {
          logger.error(`[开发模式] 从数据库获取CPID失败:`, dbError);
        }
      }
      
      if (!cpid) {
        logger.warn(`无法找到 ${cpsn}:${connectorId} 的CPID映射`);
        return {
          transactionId: -1,
          idTagInfo: { status: "Invalid" }
        };
      }
    }
    
    // 验证idTag
    const validTag = await chargePointRepository.validateIdTag(idTag);
    
    if (!validTag) {
      logger.warn(`无效的 IdTag: ${idTag}`);
      return {
        transactionId: -1,
        idTagInfo: { status: "Invalid" }
      };
    }
    
    // 生成事务ID - 根據 connectorId 設置固定值
    let transactionId;
    if (connectorId === 1) {
      transactionId = 111;
    } else if (connectorId === 2) {
      transactionId = 222;
    } else {
      // 其他連接器使用時間戳
      transactionId = Date.now();
    }
    
    logger.info(`為 ${cpsn}:${connectorId} 分配 transactionId: ${transactionId}`);
    
    // 更新充电桩状态
    await chargePointRepository.updateConnectorStatus(cpid, "Charging");
    
    // 更新WebSocket数据
    updateTransactionStartInWsData(cpsn, connectorId, timestamp, meterStart);
    
    // 记录充电开始事务
    await chargePointRepository.createTransactionRecord({
      cpid: cpid,
      cpsn: cpsn,
      idTag: idTag,
      meterStart: meterStart,
      timestamp: timestamp,
      transactionId: transactionId
    });
    
    // 记录日志
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: `Start Transaction - ID: ${transactionId}, IdTag: ${idTag}, MeterStart: ${meterStart} kWh`,
      time: new Date(timestamp) || new Date(),
      inout: "in",
    });
    
    // 【事件驱动】触发EMS控制器处理StartTransaction事件
    logger.info(`[事件驱动] 处理 StartTransaction 事件: ${cpsn}:${connectorId}, IdTag: ${idTag}`);
    try {
      // 使用事件发射器触发OCPP事件，避免循环依赖
      ocppEventEmitter.emit('ocpp_event', 'StartTransaction', messageBody, cpsn, connectorId);
      logger.info(`[事件驱动] StartTransaction 事件已发送，预计触发功率重分配`);
    } catch (emsError) {
      logger.error(`[事件驱动] 处理 StartTransaction 事件失败: ${emsError.message}`);
      // 错误不影响正常响应流程
    }
    
    return {
      transactionId: transactionId,
      idTagInfo: { status: "Accepted" }
    };
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 StartTransaction 失败`, error);
    return {
      transactionId: -1,
      idTagInfo: { status: "Invalid" }
    };
  }
}

/**
 * 处理StopTransaction请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleStopTransaction(cpsn, messageBody) {
  const { transactionId, idTag, meterStop, timestamp } = messageBody;
  logger.info(`处理充电站 ${cpsn} 的 StopTransaction: TransactionId ${transactionId}, IdTag: ${idTag}, MeterStop: ${meterStop}`);
  
  try {
    // 查找事务记录
    const transaction = await chargePointRepository.findTransaction(transactionId);
    
    if (!transaction) {
      logger.warn(`找不到事务ID: ${transactionId} 的记录`);
      return {
        idTagInfo: { status: "Invalid" }
      };
    }
    
    // 获取CPID和连接器ID
    const cpid = transaction.cpid;
    const connectorId = transaction.connector;
    
    if (!cpid) {
      logger.warn(`事务记录中没有CPID信息`);
      return {
        idTagInfo: { status: "Invalid" }
      };
    }
    
    // 计算充电量和充电时长
    const meterStart = transaction.meterStart || 0;
    const chargingEnergy = Math.max(0, parseFloat(meterStop) - parseFloat(meterStart)).toFixed(2);
    
    const startTime = new Date(transaction.timestamp);
    const stopTime = new Date(timestamp);
    const chargingDuration = Math.floor((stopTime - startTime) / 1000); // 秒
    
    // 更新充电桩状态
    await chargePointRepository.updateConnectorStatus(cpid, "Available");
    
    // 更新WebSocket数据
    updateTransactionStopInWsData(cpsn, connectorId, timestamp, meterStop, chargingEnergy, chargingDuration);
    
    // 更新事务记录
    await chargePointRepository.updateTransactionRecord(transactionId, {
      meterStop: meterStop,
      stopTimestamp: timestamp,
      chargingEnergy: chargingEnergy,
      chargingDuration: chargingDuration
    });
    
    // 记录日志
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: `Stop Transaction - ID: ${transactionId}, IdTag: ${idTag}, MeterStop: ${meterStop} kWh, Energy: ${chargingEnergy} kWh, Duration: ${formatDuration(chargingDuration)}`,
      time: new Date(timestamp) || new Date(),
      inout: "in",
    });
    
    // 【事件驱动】触发EMS控制器处理StopTransaction事件
    logger.info(`[事件驱动] 处理 StopTransaction 事件: ${cpsn}:${connectorId}, TransactionId: ${transactionId}`);
    try {
      // 使用事件发射器触发OCPP事件，避免循环依赖
      ocppEventEmitter.emit('ocpp_event', 'StopTransaction', messageBody, cpsn, connectorId);
      logger.info(`[事件驱动] StopTransaction 事件已发送，预计触发功率重分配`);
    } catch (emsError) {
      logger.error(`[事件驱动] 处理 StopTransaction 事件失败: ${emsError.message}`);
      // 错误不影响正常响应流程
    }
    
    return {
      idTagInfo: { status: "Accepted" }
    };
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 StopTransaction 失败`, error);
    return {
      idTagInfo: { status: "Accepted" }
    };
  }
}

/**
 * 发送远程启动交易请求
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {string} idTag 用户标识
 * @returns {Promise<boolean>} 是否成功
 */
async function sendRemoteStartTransaction(cpsn, connectorId, idTag) {
  logger.info(`发送远程启动交易请求: ${cpsn}, 连接器: ${connectorId}, IdTag: ${idTag}`);
  
  try {
    const messageId = generateUniqueId();
    
    const message = [
      2, // 请求类型
      messageId,
      "RemoteStartTransaction",
      {
        connectorId: parseInt(connectorId),
        idTag: idTag
      }
    ];
    
    const success = connectionService.sendCommandToStation(cpsn, message);
    
    if (success) {
      // 获取CPID
      const cpid = connectionService.getCpidFromWsData(cpsn, connectorId);
      
      if (cpid) {
        // 记录日志
        await chargePointRepository.createCpLogEntry({
          cpid: cpid,
          cpsn: cpsn,
          log: `RemoteStartTransaction requested - IdTag: ${idTag}`,
          time: new Date(),
          inout: "out",
        });
      }
    }
    
    return success;
  } catch (error) {
    logger.error(`发送RemoteStartTransaction失败: ${cpsn}, 连接器: ${connectorId}`, error);
    return false;
  }
}

/**
 * 发送远程停止交易请求
 * @param {string} cpsn 充电站序列号
 * @param {number} transactionId 交易ID
 * @returns {Promise<boolean>} 是否成功
 */
async function sendRemoteStopTransaction(cpsn, transactionId) {
  logger.info(`发送远程停止交易请求: ${cpsn}, 交易ID: ${transactionId}`);
  
  try {
    const messageId = generateUniqueId();
    
    const message = [
      2, // 请求类型
      messageId,
      "RemoteStopTransaction",
      {
        transactionId: parseInt(transactionId)
      }
    ];
    
    const success = connectionService.sendCommandToStation(cpsn, message);
    
    if (success) {
      // 查找事务记录
      const transaction = await chargePointRepository.findTransaction(transactionId);
      
      if (transaction && transaction.cpid) {
        // 记录日志
        await chargePointRepository.createCpLogEntry({
          cpid: transaction.cpid,
          cpsn: cpsn,
          log: `RemoteStopTransaction requested - TransactionId: ${transactionId}`,
          time: new Date(),
          inout: "out",
        });
      }
    }
    
    return success;
  } catch (error) {
    logger.error(`发送RemoteStopTransaction失败: ${cpsn}, 交易ID: ${transactionId}`, error);
    return false;
  }
}

/**
 * 发送充电桩复位请求
 * @param {string} cpsn 充电站序列号
 * @param {string} type 复位类型 (Hard/Soft)
 * @returns {Promise<boolean>} 是否成功
 */
async function sendResetCommand(cpsn, type) {
  logger.info(`发送复位请求: ${cpsn}, 类型: ${type}`);
  
  try {
    const messageId = generateUniqueId();
    
    const message = [
      2, // 请求类型
      messageId,
      "Reset",
      {
        type: type || "Soft" // 默认软重置
      }
    ];
    
    const success = connectionService.sendCommandToStation(cpsn, message);
    
    if (success) {
      // 获取主要CPID
      const cpid = connectionService.getStationPrimaryCpid(cpsn);
      
      // 记录日志
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: `Reset command sent - Type: ${type}`,
        time: new Date(),
        inout: "out",
      });
    }
    
    return success;
  } catch (error) {
    logger.error(`发送Reset命令失败: ${cpsn}, 类型: ${type}`, error);
    return false;
  }
}

/**
 * 更新WebSocket数据中的状态
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {string} status 状态
 */
function updateStatusInWsData(cpsn, connectorId, status) {
  logger.debug(`更新WebSocket数据 ${cpsn}:${connectorId} 状态为 ${status}`);
  
  try {
    if (!connectionService.wsCpdatas[cpsn] || !connectionService.wsCpdatas[cpsn][0]) {
      logger.debug(`${cpsn} 的WebSocket数据不存在`);
      return;
    }
    
    const wsData = connectionService.wsCpdatas[cpsn][0];
    let connectorData = null;
    
    if (connectorId === 1) {
      connectorData = wsData.connector_1_meter;
    } else if (connectorId === 2) {
      connectorData = wsData.connector_2_meter;
    } else if (connectorId === 3) {
      connectorData = wsData.connector_3_meter;
    } else if (connectorId === 4) {
      connectorData = wsData.connector_4_meter;
    }
    
    if (connectorData) {
      connectorData.current_status = status;
      logger.debug(`${cpsn}:${connectorId} 状态已更新为 ${status}`);
    }
  } catch (error) {
    logger.error(`更新WebSocket数据状态失败: ${cpsn}:${connectorId}`, error);
  }
}

/**
 * 更新WebSocket数据中的计量值
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {Array} sampledValues 采样值数组
 */
function updateMeterValuesInWsData(cpsn, connectorId, sampledValues) {
  logger.debug(`更新WebSocket数据 ${cpsn}:${connectorId} 的计量值`);
  
  try {
    if (!connectionService.wsCpdatas[cpsn] || !connectionService.wsCpdatas[cpsn][0]) {
      logger.debug(`${cpsn} 的WebSocket数据不存在`);
      return;
    }
    
    const wsData = connectionService.wsCpdatas[cpsn][0];
    let connectorData = null;
    
    if (connectorId === 1) {
      connectorData = wsData.connector_1_meter;
    } else if (connectorId === 2) {
      connectorData = wsData.connector_2_meter;
    } else if (connectorId === 3) {
      connectorData = wsData.connector_3_meter;
    } else if (connectorId === 4) {
      connectorData = wsData.connector_4_meter;
    }
    
    if (!connectorData) return;
    
    // 映射不同的计量值到data1-data6字段
    for (const sample of sampledValues) {
      const value = sample.value || "0";
      
      switch (sample.measurand) {
        case "Energy.Active.Import.Register":
          connectorData.data1 = parseFloat(value).toFixed(2);
          break;
        case "Power.Active.Import":
          connectorData.data2 = parseFloat(value).toFixed(2);
          break;
        case "Current.Import":
          connectorData.data3 = parseFloat(value).toFixed(2);
          break;
        case "Voltage":
          connectorData.data4 = parseFloat(value).toFixed(2);
          break;
        case "Temperature":
          connectorData.data5 = parseFloat(value).toFixed(2);
          break;
        default:
          // 其他值放在data6
          connectorData.data6 = parseFloat(value).toFixed(2);
          break;
      }
    }
    
    logger.debug(`${cpsn}:${connectorId} 计量值已更新`);
  } catch (error) {
    logger.error(`更新WebSocket数据计量值失败: ${cpsn}:${connectorId}`, error);
  }
}

/**
 * 更新WebSocket数据中的交易开始信息
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {string} timestamp 时间戳
 * @param {number} meterStart 开始电表读数
 */
function updateTransactionStartInWsData(cpsn, connectorId, timestamp, meterStart) {
  logger.debug(`更新WebSocket数据 ${cpsn}:${connectorId} 的交易开始信息`);
  
  try {
    if (!connectionService.wsCpdatas[cpsn] || !connectionService.wsCpdatas[cpsn][0]) {
      logger.debug(`${cpsn} 的WebSocket数据不存在`);
      return;
    }
    
    const wsData = connectionService.wsCpdatas[cpsn][0];
    let connectorData = null;
    
    if (connectorId === 1) {
      connectorData = wsData.connector_1_meter;
    } else if (connectorId === 2) {
      connectorData = wsData.connector_2_meter;
    } else if (connectorId === 3) {
      connectorData = wsData.connector_3_meter;
    } else if (connectorId === 4) {
      connectorData = wsData.connector_4_meter;
    }
    
    if (connectorData) {
      connectorData.current_status = "Charging";
      connectorData.charging_start_time = timestamp;
      connectorData.data1 = parseFloat(meterStart).toFixed(2); // 开始电表读数
      logger.debug(`${cpsn}:${connectorId} 交易开始信息已更新`);
    }
  } catch (error) {
    logger.error(`更新WebSocket数据交易开始信息失败: ${cpsn}:${connectorId}`, error);
  }
}

/**
 * 更新WebSocket数据中的交易结束信息
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {string} timestamp 时间戳
 * @param {number} meterStop 结束电表读数
 * @param {number} energy 充电量
 * @param {number} duration 充电时长(秒)
 */
function updateTransactionStopInWsData(cpsn, connectorId, timestamp, meterStop, energy, duration) {
  logger.debug(`更新WebSocket数据 ${cpsn}:${connectorId} 的交易结束信息`);
  
  try {
    if (!connectionService.wsCpdatas[cpsn] || !connectionService.wsCpdatas[cpsn][0]) {
      logger.debug(`${cpsn} 的WebSocket数据不存在`);
      return;
    }
    
    const wsData = connectionService.wsCpdatas[cpsn][0];
    let connectorData = null;
    
    if (connectorId === 1) {
      connectorData = wsData.connector_1_meter;
    } else if (connectorId === 2) {
      connectorData = wsData.connector_2_meter;
    } else if (connectorId === 3) {
      connectorData = wsData.connector_3_meter;
    } else if (connectorId === 4) {
      connectorData = wsData.connector_4_meter;
    }
    
    if (connectorData) {
      connectorData.current_status = "Available";
      connectorData.charging_stop_time = timestamp;
      connectorData.last_total_time = formatDuration(duration);
      connectorData.last_kwh = energy;
      connectorData.data1 = parseFloat(meterStop).toFixed(2); // 结束电表读数
      logger.debug(`${cpsn}:${connectorId} 交易结束信息已更新`);
    }
  } catch (error) {
    logger.error(`更新WebSocket数据交易结束信息失败: ${cpsn}:${connectorId}`, error);
  }
}

/**
 * 格式化时长
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
  if (!seconds) return "0:00:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 处理Authorize请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleAuthorize(cpsn, messageBody) {
  const { idTag } = messageBody;
  logger.info(`处理充电站 ${cpsn} 的 Authorize: IdTag=${idTag}`);
  
  try {
    // 获取CPID
    const cpid = connectionService.getStationPrimaryCpid(cpsn);
    
    // 记录日志
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: `Authorize requested - IdTag: ${idTag}`,
      time: new Date(),
      inout: "in",
    });
    
    // 在实际应用中，这里应当验证idTag
    // 为了保持与原有逻辑一致，总是返回Accepted
    return {
      idTagInfo: {
        status: "Accepted"
      }
    };
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 Authorize 失败`, error);
    return {
      idTagInfo: {
        status: "Accepted" // 出错时仍返回Accepted，保持与原逻辑一致
      }
    };
  }
}

/**
 * 处理DataTransfer请求
 * @param {string} cpsn 充电站序列号
 * @param {Object} messageBody 消息体
 * @returns {Promise<Object>} 响应对象
 */
async function handleDataTransfer(cpsn, messageBody) {
  logger.info(`处理充电站 ${cpsn} 的 DataTransfer: vendorId=${messageBody.vendorId}, messageId=${messageBody.messageId || 'N/A'}`);
  
  try {
    // 特殊处理efaner厂商请求
    if(messageBody.vendorId === "efaner") {
      logger.info(`[DataTransfer] 收到 efaner 请求，查找 CPSN=${cpsn} 的对应 CPID`);
      
      // 查找充电站的CPID
      try {
        // 使用数据库服务查询CPID
        const guns = await chargePointRepository.getAllGuns({ cpsn });
        
        let cpid;
        if (guns && guns.length > 0 && guns[0].cpid) {
          cpid = guns[0].cpid; // 使用找到的CPID
          logger.info(`[DataTransfer] 为 CPSN=${cpsn} 找到对应 CPID=${cpid}`);
        } else {
          // 找不到CPID时使用CPSN作为回应
          logger.warn(`[DataTransfer] 找不到 CPSN=${cpsn} 的对应 CPID，使用 CPSN 作为回应`);
          cpid = cpsn;
        }
        
        // 记录日志
        await chargePointRepository.createCpLogEntry({
          cpid: cpid,
          cpsn: cpsn,
          log: `DataTransfer - efaner - 返回CPID: ${cpid}`,
          time: new Date(),
          inout: "in",
        });
        
        // 返回CPID作为data
        return {
          status: "Accepted",
          data: cpid
        };
        
      } catch (error) {
        logger.error(`[DataTransfer] 查询 CPID 时发生错误`, error);
        
        // 发生错误时使用CPSN作为fallback
        return {
          status: "Accepted",
          data: cpsn
        };
      }
    } 
    // 其他厂商的DataTransfer请求
    else {
      // 记录日志
      const cpid = connectionService.getStationPrimaryCpid(cpsn);
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: `DataTransfer - ${messageBody.vendorId} - ${JSON.stringify(messageBody)}`,
        time: new Date(),
        inout: "in",
      });
      
      // 默认返回Accepted
      return {
        status: "Accepted"
      };
    }
  } catch (error) {
    logger.error(`处理 ${cpsn} 的 DataTransfer 失败`, error);
    return {
      status: "Rejected"
    };
  }
}

/**
 * 发送充电配置文件
 * 使用EMS算法为充电桩分配合适的功率
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 * @param {Object} siteSetting 站点设置
 * @returns {Promise<boolean>} 是否成功
 */
async function sendChargingProfile(cpsn, connectorId, siteSetting) {
  logger.info(`发送充电配置文件: ${cpsn}, 连接器: ${connectorId}, 设置:`, siteSetting);
  
  try {
    const messageId = generateUniqueId();
    
    // 查询充电桩信息以确定类型
    const guns = await chargePointRepository.getAllGuns({ 
      cpsn: cpsn, 
      connector: String(connectorId) 
    });
    
    if (guns.length === 0) {
      logger.warn(`找不到充电桩 ${cpsn}:${connectorId} 的信息`);
      return false;
    }
    
    const gun = guns[0];
    const acdc = gun.acdc || 'AC';
    const isAC = acdc === 'AC';
    
    // 获取EMS设置
    const emsMode = siteSetting.ems_mode || 'dynamic';
    const maxPowerKw = parseFloat(siteSetting.max_power_kw || 50);
    
    logger.debug(`[EMS] 为 ${gun.cpid} 计算功率分配，模式: ${emsMode}, 场域限制: ${maxPowerKw}kW`);
    
    // 使用EMS分配算法计算功率
    let unit, limit;
    
    try {
      // 导入EMS分配算法
      const { calculateEmsAllocation } = require('../../lib/emsAllocator');
      
      // 获取所有充电桩数据
      const allGuns = await chargePointRepository.getAllGuns({});
      
      // 获取在线充电桩
      const onlineCpids = await connectionService.getOnlineCpids();
      
      // 运行EMS算法
      logger.debug(`[EMS] 运行EMS算法，模式: ${emsMode}`);
      const emsResult = calculateEmsAllocation({ ems_mode: emsMode, max_power_kw: maxPowerKw }, allGuns, onlineCpids);
      
      // 查找当前充电桩的分配结果
      const gunAllocation = emsResult.allocations.find(a => a.cpid === gun.cpid);
      
      if (gunAllocation) {
        // 使用分配的值
        unit = gunAllocation.unit;
        limit = gunAllocation.limit;
        
        logger.info(`[EMS] ${gun.cpid} 配置结果: ${limit}${unit} (${gunAllocation.allocated_kw}kW)`);
        
        // 记录EMS日志以便调试
        emsResult.logs.forEach(log => {
          if (log.includes(gun.cpid)) {
            logger.debug(`[EMS] ${log}`);
          }
        });
      } else {
        // 如果没有找到分配结果，使用默认值
        logger.warn(`[EMS] 无法为 ${gun.cpid} 找到分配结果，使用默认值`);
        unit = isAC ? 'A' : 'W';
        limit = isAC ? 6 : 1000; // 最小值
      }
    } catch (emsError) {
      logger.error(`[EMS] 计算功率分配失败: ${emsError.message}`, emsError);
      
      // 使用简单的备用逻辑
      unit = isAC ? 'A' : 'W';
      if (isAC) {
        // AC充电桩: 通常以安培(A)为单位
        limit = emsMode === 'dynamic' ? 32 : 16; // 动态模式下给予更高功率
      } else {
        // DC充电桩: 以瓦特(W)为单位
        limit = emsMode === 'dynamic' ? 50000 : 30000; // 动态模式下给予更高功率
      }
      logger.info(`[EMS-备用] 使用备用逻辑设置 ${gun.cpid}: ${limit}${unit}`);
    }
    
    // 计算延迟时间，确保命令立即生效
    const networkDelayMs = 5000; // 5秒
    const startTime = new Date(Date.now() + networkDelayMs).toISOString();
    
    // 构建消息
    const message = [
      CALL_MESSAGE,
      messageId,
      "SetChargingProfile",
      {
        connectorId: parseInt(connectorId),
        csChargingProfiles: {
          chargingProfileId: 1,
          stackLevel: 1,
          chargingProfilePurpose: "TxDefaultProfile",
          chargingProfileKind: "Absolute",
          chargingSchedule: {
            chargingRateUnit: unit,
            startSchedule: startTime,
            chargingSchedulePeriod: [
              {
                startPeriod: 0,
                limit: limit
              }
            ]
          }
        }
      }
    ];
    
    // 记录发送的消息
    await chargePointRepository.createCpLogEntry({
      cpid: gun.cpid,
      cpsn: cpsn,
      log: `发送充电配置: ${JSON.stringify(message)}`,
      time: new Date(),
      inout: "out",
    });
    
    // 发送消息
    const success = await connectionService.sendCommandToStation(cpsn, message);
    
    if (success) {
      logger.info(`充电配置已发送: ${cpsn}, 连接器: ${connectorId}, 单位: ${unit}, 限制: ${limit}`);
    } else {
      logger.warn(`发送充电配置失败: ${cpsn}, 连接器: ${connectorId}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`发送充电配置失败: ${error.message}`, error);
    return false;
  }
}

/**
 * 发送充电配置 - EMS功率分配
 * 通过CPID查找充电桩并发送功率配置
 * 
 * 新增函数，支持新架构中的EMS功能
 * 
 * @param {string} cpid 充电桩ID
 * @param {Object} options 选项 {siteSetting, context}
 * @returns {Promise<boolean>} 是否成功
 */
async function sendSetChargingProfile(cpid, options = {}) {
  logger.info(`[EMS] 发送充电配置到 CPID: ${cpid}`);
  
  try {
    // 从选项中获取场域设置和上下文
    const { siteSetting, context = {} } = options;
    
    if (!siteSetting) {
      logger.error(`[EMS] 未提供场域设置`);
      return false;
    }
    
    // 查询充电桩信息
    const guns = await chargePointRepository.getAllGuns({ cpid });
    
    if (guns.length === 0) {
      logger.warn(`[EMS] 找不到充电桩 CPID: ${cpid} 的信息`);
      return false;
    }
    
    const gun = guns[0];
    const cpsn = gun.cpsn;
    const connectorId = gun.connector;
    
    if (!cpsn || !connectorId) {
      logger.warn(`[EMS] 充电桩 ${cpid} 缺少 CPSN 或 connectorId 信息`);
      return false;
    }
    
    // 使用已有的函数发送充电配置
    logger.info(`[EMS] 为 CPID: ${cpid} (CPSN: ${cpsn}, Connector: ${connectorId}) 设置充电配置`);
    const success = await sendChargingProfile(cpsn, connectorId, siteSetting);
    
    // 记录额外上下文信息
    if (success && context.isGlobalReallocation) {
      logger.info(`[EMS] ${cpid} 功率配置成功更新 (全站重分配ID: ${context.reallocationId || 'unknown'})`);
    }
    
    return success;
  } catch (error) {
    logger.error(`[EMS] 发送充电配置失败: ${error.message}`, error);
    return false;
  }
}

module.exports = {
  handleBootNotification,
  handleStatusNotification,
  handleHeartbeat,
  handleMeterValues,
  handleStartTransaction,
  handleStopTransaction,
  handleDataTransfer,
  handleAuthorize,
  registerOcppEventHandler, // 添加事件處理器註冊函數
  sendRemoteStartTransaction,
  sendRemoteStopTransaction,
  sendResetCommand,
  sendChargingProfile,
  sendSetChargingProfile,
};
