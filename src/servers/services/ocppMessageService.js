/**
 * OCPP消息服务
 * 处理OCPP协议消息的发送和接收
 */

const { logger, generateUniqueId } = require('../utils');
const connectionService = require('./connectionService');
const { chargePointRepository } = require('../repositories');
// 移除對emsController的直接引用，打破循環依賴
const EventEmitter = require('events');

/**
 * 创建OCPP日志条目 - 只记录OCPP JSON消息
 * @param {string} cpid - 充电桩ID
 * @param {string} cpsn - 充电桩序列号
 * @param {Object} ocppMessage - OCPP消息对象
 * @param {string} direction - 消息方向 "in" 或 "out"
 * @param {Date} timestamp - 时间戳
 */
async function createOcppLogEntry(cpid, cpsn, ocppMessage, direction = "in", timestamp = new Date()) {
  try {
    await chargePointRepository.createCpLogEntry({
      cpid: cpid,
      cpsn: cpsn,
      log: JSON.stringify(ocppMessage),
      time: timestamp,
      inout: direction,
    });
  } catch (error) {
    logger.error(`创建OCPP日志失败: ${error.message}`, error);
  }
}

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

/**
 * 查找充電樁所屬的電表
 * @param {string} cpid 充電樁ID
 * @returns {Promise<Object|null>} 電表信息或null
 */
async function findMeterForChargePoint(cpid) {
  try {
    // 先查找充電樁信息
    const guns = await chargePointRepository.getAllGuns({ cpid });
    if (guns.length === 0) {
      logger.warn(`[findMeterForChargePoint] 找不到充電樁 ${cpid} 的信息`);
      return null;
    }
    
    const gun = guns[0];
    const meterId = gun.meter_id;
    
    if (!meterId) {
      logger.warn(`[findMeterForChargePoint] 充電樁 ${cpid} 沒有關聯的電表ID`);
      return null;
    }
    
    // 查找電表信息 - 需要從stations中獲取完整的電表數據
    const stations = await chargePointRepository.getStations();
    
    for (const station of stations) {
      if (station.meters && Array.isArray(station.meters)) {
        const meter = station.meters.find(m => m.id === meterId);
        if (meter) {
          logger.debug(`[findMeterForChargePoint] 充電樁 ${cpid} 屬於電表 ${meter.id} (${meter.meter_no}), 站點 ${station.id} (${station.name})`);
          return {
            ...meter,
            station_id: station.id,
            station_name: station.name
          };
        }
      }
    }
    
    logger.warn(`[findMeterForChargePoint] 找不到電表ID ${meterId} 的詳細信息`);
    return null;
  } catch (error) {
    logger.error(`[findMeterForChargePoint] 查找充電樁 ${cpid} 所屬電表時發生錯誤:`, error);
    return null;
  }
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
      await createOcppLogEntry(cpid, cpsn, messageBody, "in");
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
      
      // 更新WebSocket数据中的状态
      updateStatusInWsData(cpsn, connectorId, status);
      
      // 【事件驱动】找到充电樁所屬電表，觸發電表級功率重新分配
      logger.info(`[事件驱动-电表级] 处理 StatusNotification 事件: ${cpsn}:${connectorId}, 状态: ${status}`);
      try {
        // 查找該充電樁所屬的電表
        const meter = await findMeterForChargePoint(cpid);
        if (meter) {
          logger.info(`[事件驱动-电表级] 充电桩 ${cpid} 属于电表 ${meter.id} (${meter.meter_no})`);
          // 觸發電表級功率重新分配事件
          ocppEventEmitter.emit('ocpp_event', 'StatusNotification', {
            ...messageBody,
            meter_id: meter.id,
            meter_no: meter.meter_no,
            station_id: meter.station_id,
            cpid: cpid
          }, cpsn, connectorId);
          logger.debug(`[事件驱动-电表级] StatusNotification 事件已发送，目标电表: ${meter.id}`);
        } else {
          logger.warn(`[事件驱动-电表级] 无法找到充电桩 ${cpid} 所属的电表，跳过功率重分配`);
        }
      } catch (emsError) {
        logger.error(`[事件驱动-电表级] 处理 StatusNotification 事件失败: ${emsError.message}`);
        // 错误不影响正常响应流程
      }
    }
    
    // 记录OCPP JSON日志
    if (cpid) {
      await createOcppLogEntry(cpid, cpsn, messageBody, "in");
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
    
  // 初始化默认值 (更具可读性的变量名)
  let energy_kwh = "0.00"; // kWh
  let current_a = "0.00"; // Current (A)
  let voltage_v = "0.00"; // Voltage (V)
  let power_kw = "0.00"; // Power (kW)
  let extra_data = "0.00"; // 附加数据
    
    // 根据厂商不同处理MeterValues
    switch (true) {
      case cpsn.startsWith("TAC"): {
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
              energy_kwh = (parseFloat(sample.value) / 1000).toFixed(3); // Wh -> kWh
            } else if (sample.measurand === "Current.Import" || sample.measurand === "Current") {
              current_a = parseFloat(sample.value).toFixed(2);
            } else if (sample.measurand === "Voltage") {
              voltage_v = parseFloat(sample.value).toFixed(2);
            } else if (sample.measurand === "Power.Active.Import") {
              power_kw = parseFloat(sample.value).toFixed(3);
            }
          }
          
          // 如果没有直接的功率读数，计算功率 (V * A / 1000)
          if (power_kw === "0.00" && current_a !== "0.00" && voltage_v !== "0.00") {
            power_kw = (parseFloat(current_a) * parseFloat(voltage_v) / 1000).toFixed(3);
          }
        }
        break;
      }
      
      case cpsn.startsWith("sp"): {
        // Spacepark充电桩的处理逻辑
        logger.info(`处理Spacepark充电桩 ${cpsn} 的MeterValues`);
        
        if (Array.isArray(meterValue) && meterValue.length > 0 && 
            meterValue[0].sampledValue && Array.isArray(meterValue[0].sampledValue)) {
          
          const sampledValues = meterValue[0].sampledValue;
          
          if (sampledValues[0].unit === "Wh") {
            // 非充电状态的数据
            energy_kwh = (parseFloat(sampledValues[0].value) / 1000).toFixed(3); // Wh -> kWh
            current_a = "0.00";
            voltage_v = "0.0";
            power_kw = "0.0";
          } else {
            // 充电状态的数据
            energy_kwh = (parseFloat(sampledValues[1].value) / 1000).toFixed(3); // Wh -> kWh
            current_a = sampledValues[0].value;
            voltage_v = sampledValues[3].value;
            power_kw = (parseFloat(current_a) * parseFloat(voltage_v)).toFixed(3); // 计算功率
          }
        }
        break;
      }
      
      case cpsn.startsWith("GS"): {
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
            energy_kwh = (parseFloat(sampledValues[0].value) / 1000).toFixed(3); // Wh -> kWh
            current_a = "0.00";
            voltage_v = "0.0";
            power_kw = "0.0";
          } else {
            // 充电状态的数据
            energy_kwh = (parseFloat(sampledValues[4].value) / 1000).toFixed(3); // Wh -> kWh
            current_a = sampledValues[0].value; // 电流
            voltage_v = sampledValues[7].value; // 电压
            power_kw = (parseFloat(current_a) * parseFloat(voltage_v)).toFixed(3); // 计算功率
          }
        }
        break;
      }
      
      default: {
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
                energy_kwh = (parseFloat(sample.value) / (sample.unit === "Wh" ? 1000 : 1)).toFixed(3);
              } else if (sample.measurand === "Current.Import" || sample.measurand === "Current") {
                current_a = parseFloat(sample.value).toFixed(2);
              } else if (sample.measurand === "Voltage") {
                voltage_v = parseFloat(sample.value).toFixed(2);
              } else if (sample.measurand === "Power.Active.Import") {
                power_kw = parseFloat(sample.value).toFixed(3);
              } else if (sample.measurand === "Temperature") {
                extra_data = parseFloat(sample.value).toFixed(2);
              }
            }
          }
        }
        break;
      }
    }
    
    // 更新WebSocket数据
  logger.debug(`更新 ${cpsn}:${connectorId} 的电表读数: kWh=${energy_kwh}, A=${current_a}, V=${voltage_v}, Power=${power_kw}`);
    
    // 使用数据库仓库更新电表数据
    await chargePointRepository.updateGunMeterValues(cpsn, connectorId, {
      guns_metervalue1: energy_kwh, // kWh
      guns_metervalue2: current_a, // A
      guns_metervalue3: voltage_v, // V
      guns_metervalue4: power_kw, // Power
      guns_memo2: new Date().toISOString() // 更新时间
    });
    
    // 如果有活躍的交易，同步更新 transactions 表格
    if (transactionId && transactionId !== 0) {
      try {
        // 查找對應的交易記錄
        const activeTransaction = await chargePointRepository.findTransactionById(transactionId);
        
        if (activeTransaction && activeTransaction.status === 'ACTIVE') {
          // 計算累積電量（基於當前電表讀數）
          const currentMeterReading = parseFloat(energy_kwh);
          const startMeterReading = parseFloat(activeTransaction.meter_start) || 0;
          const energyConsumed = Math.max(0, currentMeterReading - startMeterReading);
          
          // 計算充電時長
          const startTime = new Date(activeTransaction.start_time);
          const currentTime = new Date();
          const chargingDuration = Math.floor((currentTime - startTime) / 1000); // 秒
          
          // 更新交易記錄的即時數據
          const updateTime = new Date();
          await chargePointRepository.updateTransactionRecord(transactionId, {
            // 不更新 meter_stop，保持為 null 直到交易結束
            energy_consumed: energyConsumed,
            charging_duration: chargingDuration,
            // 更新即時充電數據
            current_power: parseFloat(power_kw),
            current_voltage: parseFloat(voltage_v),
            current_current: parseFloat(current_a),
            last_meter_update: updateTime,
            updatedAt: updateTime
          });
          
          logger.debug(`更新交易 ${transactionId} 的即時數據: 累積電量=${energyConsumed.toFixed(3)}kWh, 時長=${chargingDuration}秒, 功率=${cp_data4}kW`);
        }
      } catch (transactionError) {
        logger.error(`更新交易 ${transactionId} 的即時數據失敗: ${transactionError.message}`);
        // 不拋出錯誤，避免影響正常的 MeterValues 處理流程
      }
    }
    
    // 记录OCPP JSON日志
    await createOcppLogEntry(cpid, cpsn, messageBody, "in", Array.isArray(meterValue) && meterValue.length > 0 ? new Date(meterValue[0].timestamp) : new Date());
    
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
    
    // 验证idTag
    
    const validTag = await chargePointRepository.validateIdTag(idTag);
      
    if (!validTag) {
      logger.warn(`无效的 IdTag: ${idTag}`);
      return {
        transactionId: -1,
        idTagInfo: { status: "Invalid" }
      };
    }
    
    // OCPP 的 meterStart 為 Wh，轉換為 kWh 再儲存
    const meterStartParsed = meterStart !== undefined && meterStart !== null ? parseFloat(meterStart) : null;
    const meterStartKwh = meterStartParsed !== null && !isNaN(meterStartParsed) ? (meterStartParsed / 1000) : null;

    // 創建新的交易記錄（存入 kWh）
    const transactionRecord = await chargePointRepository.createNewTransaction({
      cpid: cpid,
      cpsn: cpsn,
      connector_id: connectorId,
      idTag: idTag,
      meterStart: meterStartKwh,
      user_id: validTag.userUuid // 关联用户ID
    });
    
    // 獲取符合 OCPP 1.6 協議的整數 transactionId
    const ocppTransactionId = transactionRecord.ocppTransactionId;
    const internalTransactionId = transactionRecord.internalTransactionId;
    logger.info(`為 ${cpsn}:${connectorId} 創建新交易: OCPP ID=${ocppTransactionId}, 內部ID=${internalTransactionId}`);
    
    // 更新充电桩状态
    await chargePointRepository.updateConnectorStatus(cpid, "Charging");
    
  // 更新WebSocket数据（显示为 kWh）
  updateTransactionStartInWsData(cpsn, connectorId, timestamp, meterStartKwh);
    
    // 記錄OCPP JSON日志
    await createOcppLogEntry(cpid, cpsn, messageBody, "in", new Date(timestamp) || new Date());
    
    // 【事件驱动】找到充电樁所屬電表，觸發電表級功率重新分配
    logger.info(`[事件驱动-电表级] 处理 StartTransaction 事件: ${cpsn}:${connectorId}, IdTag: ${idTag}`);
    try {
      // 查找該充電樁所屬的電表
      const meter = await findMeterForChargePoint(cpid);
      if (meter) {
        logger.info(`[事件驱动-电表级] 充电桩 ${cpid} 属于电表 ${meter.id} (${meter.meter_no})`);
        // 觸發電表級功率重新分配事件
        ocppEventEmitter.emit('ocpp_event', 'StartTransaction', {
          ...messageBody,
          meter_id: meter.id,
          meter_no: meter.meter_no,
          station_id: meter.station_id,
          cpid: cpid
        }, cpsn, connectorId);
        logger.info(`[事件驱动-电表级] StartTransaction 事件已发送，预计触发电表 ${meter.id} 的功率重分配`);
      } else {
        logger.warn(`[事件驱动-电表级] 无法找到充电桩 ${cpid} 所属的电表，跳过功率重分配`);
      }
    } catch (emsError) {
      logger.error(`[事件驱动-电表级] 处理 StartTransaction 事件失败: ${emsError.message}`);
      // 错误不影响正常响应流程
    }
    
    return {
      transactionId: ocppTransactionId, // 返回 OCPP 協議要求的整數 ID
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
    // 查找事務記錄
    const transaction = await chargePointRepository.findTransactionById(transactionId);
    
    if (!transaction) {
      logger.warn(`找不到事务ID: ${transactionId} 的记录`);
      return {
        idTagInfo: { status: "Invalid" }
      };
    }
    
    // 獲取充電桩信息
    const cpid = transaction.cpid;
    const connectorId = transaction.connector_id;
    
    if (!cpid) {
      logger.warn(`事务记录中没有CPID信息`);
      return {
        idTagInfo: { status: "Invalid" }
      };
    }
    
  // OCPP 的 meterStop 為 Wh，轉為 kWh 再計算
  const meterStopParsed = meterStop !== undefined && meterStop !== null ? parseFloat(meterStop) : null;
  const meterStopKwh = meterStopParsed !== null && !isNaN(meterStopParsed) ? (meterStopParsed / 1000) : null;

  const meterStart = transaction.meter_start || 0; // DB 中應為 kWh
  const meterStopForCalc = meterStopKwh !== null ? meterStopKwh : parseFloat(meterStop);
  const chargingEnergy = Math.max(0, parseFloat(meterStopForCalc) - parseFloat(meterStart)).toFixed(2);
  logger.info(`计算充电量: 开始=${meterStart}kWh, 结束=${meterStopForCalc}kWh, 消耗=${chargingEnergy}kWh`);
    
    const startTime = new Date(transaction.start_time);
    const stopTime = new Date(timestamp);
    const chargingDuration = Math.floor((stopTime - startTime) / 1000); // 秒
    
    // 更新充电桩状态
    await chargePointRepository.updateConnectorStatus(cpid, "Available");
    
    // 更新WebSocket数据
    // 更新WebSocket数据（以 kWh 顯示）
    updateTransactionStopInWsData(transaction.cpsn, connectorId, timestamp, meterStopForCalc, chargingEnergy, chargingDuration);
    
    // 更新交易記錄
    await chargePointRepository.updateTransactionRecord(transactionId, {
      end_time: stopTime,
      meter_stop: parseFloat(meterStopForCalc),
      energy_consumed: parseFloat(chargingEnergy),
      charging_duration: chargingDuration,
      status: 'COMPLETED'
    });
    
    // 清除充電桩上的交易ID
    await chargePointRepository.updateGun(
      { cpid: cpid },
      { transactionid: null }
    );
    
    // 记录OCPP JSON日志
    await createOcppLogEntry(cpid, transaction.cpsn, messageBody, "in", new Date(timestamp) || new Date());
    
    // 【事件驱动】找到充电樁所屬電表，觸發電表級功率重新分配
    logger.info(`[事件驱动-电表级] 处理 StopTransaction 事件: ${cpsn}:${connectorId}, TransactionId: ${transactionId}`);
    try {
      // 查找該充電樁所屬的電表
      const meter = await findMeterForChargePoint(cpid);
      if (meter) {
        logger.info(`[事件驱动-电表级] 充电桩 ${cpid} 属于电表 ${meter.id} (${meter.meter_no})`);
        // 觸發電表級功率重新分配事件
        ocppEventEmitter.emit('ocpp_event', 'StopTransaction', {
          ...messageBody,
          meter_id: meter.id,
          meter_no: meter.meter_no,
          station_id: meter.station_id,
          cpid: cpid
        }, cpsn, connectorId);
        logger.info(`[事件驱动-电表级] StopTransaction 事件已发送，预计触发电表 ${meter.id} 的功率重分配`);
      } else {
        logger.warn(`[事件驱动-电表级] 无法找到充电桩 ${cpid} 所属的电表，跳过功率重分配`);
      }
    } catch (emsError) {
      logger.error(`[事件驱动-电表级] 处理 StopTransaction 事件失败: ${emsError.message}`);
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
 * @param {string} userUuid 用户UUID
 * @param {string} userRole 用户角色
 * @returns {Promise<boolean>} 是否成功
 */
async function sendRemoteStartTransaction(cpsn, connectorId, idTag, userUuid) {
  logger.info(`发送远程启动交易请求: ${cpsn}, 连接器: ${connectorId}, IdTag: ${idTag}, 用户UUID: ${userUuid || '未提供'}}`);
  
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
        // 记录OCPP JSON日志，包含用户上下文信息
        const logEntry = {
          ...message,
          userContext: {
            userUuid: userUuid,
            timestamp: new Date().toISOString()
          }
        };
        await createOcppLogEntry(cpid, cpsn, logEntry, "out");
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
 * @param {string} userUuid 用户UUID
 * @param {string} userRole 用户角色
 * @returns {Promise<boolean>} 是否成功
 */
async function sendRemoteStopTransaction(cpsn, transactionId, userUuid = null, userRole = null) {
  logger.info(`发送远程停止交易请求: ${cpsn}, 交易ID: ${transactionId}, 用户UUID: ${userUuid || '未提供'}, 角色: ${userRole || '未知'}`);
  
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
        // 记录OCPP JSON日志，包含用户上下文信息
        const logEntry = {
          ...message,
          userContext: {
            userUuid: userUuid,
            userRole: userRole,
            timestamp: new Date().toISOString()
          }
        };
        await createOcppLogEntry(transaction.cpid, cpsn, logEntry, "out");
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
      
      // 记录OCPP JSON日志
      await createOcppLogEntry(cpid, cpsn, message, "out");
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
    
    // 记录OCPP JSON日志
    await createOcppLogEntry(cpid, cpsn, messageBody, "in");
    
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
        
        // 记录OCPP JSON日志
        await createOcppLogEntry(cpid, cpsn, messageBody, "in");
        
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
      // 记录OCPP JSON日志
      const cpid = connectionService.getStationPrimaryCpid(cpsn);
      await createOcppLogEntry(cpid, cpsn, messageBody, "in");
      
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
    const meterId = siteSetting.meter_id;
    
    logger.debug(`[EMS] 为 ${gun.cpid} 计算功率分配，模式: ${emsMode}, 场域限制: ${maxPowerKw}kW, 电表ID: ${meterId || '未指定'}`);
    
    // 使用EMS分配算法计算功率
    let unit, limit;
    
    try {
      // 导入EMS分配算法
      const { calculateEmsAllocation } = require('../../lib/emsAllocator');
      
      // 如果指定了电表ID，只处理该电表下的充电桩
      let targetGuns, targetOnlineCpids;
      
      if (meterId) {
        // 获取指定电表下的充电桩
        const allGuns = await chargePointRepository.getAllGuns({});
        targetGuns = allGuns.filter(g => g.meter_id == meterId);
        
        // 获取在线充电桩，过滤出该电表下的在线充电桩
        const onlineCpids = await connectionService.getOnlineCpids();
        targetOnlineCpids = onlineCpids.filter(cpid => {
          const meterGun = targetGuns.find(g => g.cpid === cpid);
          return meterGun !== undefined;
        });
        
        logger.debug(`[EMS] 电表级计算: 电表 ${meterId} 包含 ${targetGuns.length} 个充电桩，${targetOnlineCpids.length} 个在线`);
      } else {
        // 如果没有指定电表ID，使用全部充电桩（兼容旧逻辑）
        targetGuns = await chargePointRepository.getAllGuns({});
        targetOnlineCpids = await connectionService.getOnlineCpids();
        
        logger.debug(`[EMS] 全局计算: 总共 ${targetGuns.length} 个充电桩，${targetOnlineCpids.length} 个在线`);
      }
      
      // 运行EMS算法
      logger.debug(`[EMS] 运行EMS算法，模式: ${emsMode}, 范围: ${meterId ? '电表级' : '全局'}`);
      const emsResult = calculateEmsAllocation({ ems_mode: emsMode, max_power_kw: maxPowerKw }, targetGuns, targetOnlineCpids);
      
      // 查找当前充电桩的分配结果
      const gunAllocation = emsResult.allocations.find(a => a.cpid === gun.cpid);
      
      if (gunAllocation) {
        // 使用分配的值
        unit = gunAllocation.unit;
        limit = gunAllocation.limit;
        
        logger.info(`[EMS] ${gun.cpid} 配置结果: ${limit}${unit} (${gunAllocation.allocated_kw}kW) ${meterId ? `[电表${meterId}]` : '[全局]'}`);
        
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
    
    // 记录OCPP JSON日志
    await createOcppLogEntry(gun.cpid, cpsn, message, "out");
    
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
};
