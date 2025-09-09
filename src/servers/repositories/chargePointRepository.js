/**
 * 充电桩数据仓库
 * 负责所有与充电桩相关的数据库访问操作
 */

// 动态导入依赖
let DatabaseUtils;
let databaseService;
let createCpLog;

// 导入日志工具
const logger = require('../utils/logger');

// 数据库初始化标志
let isDbInitialized = false;

/**
 * 动态加载数据库模块
 * @returns {Promise<Object>} 包含数据库工具和服务的对象
 */
const loadDatabaseModules = async () => {
  if (!DatabaseUtils) {
    try {
      const utilsModule = await import('../../lib/database/utils.js');
      const serviceModule = await import('../../lib/database/service.js');
      DatabaseUtils = utilsModule.default;
      databaseService = serviceModule.databaseService;
      createCpLog = databaseService.createCpLog;
      
      logger.debug('数据库模块加载成功');
    } catch (error) {
      logger.error('加载数据库模块失败', error);
      throw new Error(`数据库模块加载失败: ${error.message}`);
    }
  }
  return { DatabaseUtils, databaseService, createCpLog };
};

/**
 * 确保数据库已初始化
 * @returns {Promise<void>}
 */
async function ensureDbInitialized() {
  if (!isDbInitialized) {
    logger.info('初始化数据库连接...');
    
    try {
      const { DatabaseUtils: dbUtils } = await loadDatabaseModules();
      
      // 初始化数据库连接，指定 provider
      const targetProvider = process.env.DB_PROVIDER || 'mysql';
      logger.info(`目标数据库提供者: ${targetProvider}`);
      
      const initialized = await dbUtils.initialize(targetProvider);
      
      if (initialized) {
        isDbInitialized = true;
        logger.info(`数据库初始化成功，当前提供者: ${dbUtils.getCurrentProvider().toUpperCase()}`);
        
        // 执行健康检查
        const isHealthy = await dbUtils.healthCheck();
        logger.info(`数据库健康状态: ${isHealthy ? '正常' : '异常'}`);
      } else {
        throw new Error('数据库初始化失败');
      }
    } catch (error) {
      logger.error('数据库初始化出错', error);
      throw error;
    }
  }
}

/**
 * 获取所有充电桩
 * @param {Object} whereClause 查询条件
 * @returns {Promise<Array>} 充电桩列表
 */
async function getAllGuns(whereClause = {}) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns(whereClause);
    logger.debug(`获取充电桩成功，共 ${guns.length} 条记录`);
    return guns;
  } catch (error) {
    logger.error(`获取充电桩失败`, error);
    throw error;
  }
}

/**
 * 获取指定CPID的充电桩
 * @param {string} cpid 充电桩ID
 * @returns {Promise<Object|null>} 充电桩信息
 */
async function getGunByCpid(cpid) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpid });
    const gun = guns.length > 0 ? guns[0] : null;
    
    if (gun) {
      logger.debug(`获取充电桩 ${cpid} 成功`);
    } else {
      logger.warn(`找不到充电桩 ${cpid}`);
    }
    
    return gun;
  } catch (error) {
    logger.error(`获取充电桩 ${cpid} 失败`, error);
    throw error;
  }
}

/**
 * 获取指定充电站的所有充电桩
 * @param {string} cpsn 充电站序列号
 * @returns {Promise<Array>} 充电桩列表
 */
async function getGunsByCpsn(cpsn) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpsn });
    logger.debug(`获取充电站 ${cpsn} 的充电桩成功，共 ${guns.length} 个`);
    return guns;
  } catch (error) {
    logger.error(`获取充电站 ${cpsn} 的充电桩失败`, error);
    throw error;
  }
}

/**
 * 更新充电桩
 * @param {Object} whereClause 查询条件
 * @param {Object} updateData 更新数据
 * @returns {Promise<Array>} 更新结果
 */
async function updateGun(whereClause, updateData) {
  try {
    await ensureDbInitialized();
    
    // 查找充电桩
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns(whereClause);
    
    if (guns.length === 0) {
      logger.warn(`未找到符合条件的充电桩进行更新`, whereClause);
      return [0];
    }
    
    // 批量更新
    const updatePromises = guns.map(gun => 
      dbService.updateGun(gun.id, {
        ...updateData,
        updatedAt: new Date()
      })
    );
    
    await Promise.all(updatePromises);
    logger.debug(`更新了 ${guns.length} 个充电桩`);
    
    return [guns.length];
  } catch (error) {
    logger.error(`更新充电桩失败`, error);
    throw error;
  }
}

/**
 * 更新充电桩状态
 * @param {Object} whereClause 查询条件
 * @param {string} status 新状态
 * @returns {Promise<Array>} 更新结果
 */
async function updateGunStatus(whereClause, status) {
  try {
    return await updateGun(whereClause, { guns_status: status });
  } catch (error) {
    logger.error(`更新充电桩状态失败`, error);
    throw error;
  }
}

/**
 * 更新连接器状态
 * @param {string} cpid 充电桩ID
 * @param {string} status 新状态
 * @returns {Promise<Array>} 更新结果
 */
async function updateConnectorStatus(cpid, status) {
  try {
    logger.debug(`更新充电桩 ${cpid} 状态为 ${status}`);
    return await updateGun({ cpid }, { guns_status: status });
  } catch (error) {
    logger.error(`更新充电桩 ${cpid} 状态失败`, error);
    throw error;
  }
}

/**
 * 更新充电桩电表值
 * @param {string} cpsn 充电站序列号
 * @param {string} connector 连接器编号
 * @param {Object} meterValues 电表值
 * @returns {Promise<boolean>} 更新结果
 */
async function updateGunMeterValues(cpsn, connector, meterValues) {
  try {
    await ensureDbInitialized();
    
    // 查找充电桩
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ 
      cpsn: cpsn, 
      connector: String(connector) 
    });
    
    if (guns.length === 0) {
      logger.warn(`未找到充电桩 ${cpsn}:${connector} 进行电表更新`);
      return false;
    }
    
    const gun = guns[0];
    
    // 准备更新数据
    const updateData = {
      ...meterValues,
      updatedAt: new Date()
    };
    
    // 处理 null 值
    if (gun.guns_metervalue5 === null || gun.guns_metervalue6 === null) {
      if (gun.guns_metervalue5 === null) {
        updateData.guns_metervalue5 = "0.00";
      }
      if (gun.guns_metervalue6 === null) {
        updateData.guns_metervalue6 = "0.00";
      }
    }
    
    // 更新
    await dbService.updateGun(gun.id, updateData);
    logger.debug(`更新充电桩 ${cpsn}:${connector} 电表值成功`);
    
    return true;
  } catch (error) {
    logger.error(`更新充电桩 ${cpsn}:${connector} 电表值失败`, error);
    throw error;
  }
}

/**
 * 创建充电桩日志
 * @param {Object} logData 日志数据
 * @returns {Promise<Object>} 创建的日志
 */
async function createCpLogEntry(logData) {
  try {
    await ensureDbInitialized();
    const { createCpLog: logFunction } = await loadDatabaseModules();
    const log = await logFunction(logData);
    logger.debug(`创建充电桩日志成功: ${logData.cpid}`);
    return log;
  } catch (error) {
    logger.error(`创建充电桩日志失败: ${logData.cpid}`, error);
    throw error;
  }
}

/**
 * 获取站点设置
 * @returns {Promise<Array>} 站点设置数组
 */
async function getStations() {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const stations = await dbService.getStations();
    logger.info(`获取站点设置成功，共 ${stations ? stations.length : 0} 个站点`);
    
    if (!stations || stations.length === 0) {
      logger.warn('未找到任何站点配置，尝试创建默认站点');
      await createDefaultStation();
      // 重新获取站点信息
      return await dbService.getStations();
    }
    
    return stations;
  } catch (error) {
    logger.error(`获取站点设置失败: ${error.message}`, error);
    return []; // 返回空数组而非null，避免后续引用错误
  }
}

/**
 * 创建默认站点和电表配置
 * 当数据库中没有站点时，自动创建默认配置
 */
async function createDefaultStation() {
  try {
    logger.warn('创建默认站点配置...');
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 创建默认站点
    const defaultStation = await dbService.createStation({
      name: '默认站点',
      station_code: 'DEFAULT',
      address: '默认地址',
      gps_lat: 0,
      gps_lng: 0,
      status: 'active'
    });
    
    logger.info(`创建默认站点成功: ID=${defaultStation.id}`);
    
    // 创建默认电表
    const defaultMeter = await dbService.createMeter({
      station_id: defaultStation.id,
      name: '默认电表',
      meter_code: 'DEFAULT',
      ems_mode: 'static',
      max_power_kw: 100
    });
    
    logger.info(`创建默认电表成功: ID=${defaultMeter.id}`);
    
    // 关联所有现有充电枪到默认电表
    const guns = await getAllGuns();
    if (guns && guns.length > 0) {
      logger.info(`尝试关联 ${guns.length} 个现有充电枪到默认电表...`);
      
      for (const gun of guns) {
        await dbService.updateGun(gun.id, {
          meter_id: defaultMeter.id
        });
      }
      
      logger.info(`成功关联 ${guns.length} 个充电枪到默认电表`);
    }
    
    return defaultStation;
  } catch (error) {
    logger.error(`创建默认站点失败: ${error.message}`, error);
    throw error;
  }
}

/**
 * 验证IdTag是否有效
 * @param {string} idTag 用户标识标签
 * @returns {Promise<boolean>} 是否有效
 */
async function validateIdTag(idTag) {
  try {
    // 開發階段：跳過所有驗證，直接返回 true
    logger.debug(`[開發階段] 跳過 IdTag 驗證，直接接受: ${idTag}`);
    return true;
    
    // 以下代碼暫時註解，等正式環境再啟用
    /*
    await ensureDbInitialized();
    
    // 開發模式：接受所有非空的 idTag
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // 基本验证逻辑：非空且长度合理
    if (!idTag || typeof idTag !== 'string' || idTag.trim().length === 0) {
      logger.warn(`IdTag 格式无效: ${idTag}`);
      return false;
    }
    
    // 開發模式下，接受所有有效格式的 idTag
    if (isDevelopment) {
      logger.debug(`[開發模式] 接受 IdTag: ${idTag}`);
      return true;
    }
    
    // 如果是来自web界面的标签，直接认为有效
    if (idTag === 'web_interface_tag' || idTag.startsWith('web_')) {
      logger.debug(`接受web界面标签: ${idTag}`);
      return true;
    }
    
    // 如果是测试标签，直接认为有效
    if (idTag.startsWith('test_') || idTag === 'default_tag') {
      logger.debug(`接受测试标签: ${idTag}`);
      return true;
    }
    
    // 对于其他标签，可以在这里添加更复杂的验证逻辑
    // 例如：查询用户数据库、检查授权状态等
    
    logger.debug(`IdTag 验证通过: ${idTag}`);
    return true;
    */
  } catch (error) {
    logger.error(`验证IdTag失败: ${idTag}`, error);
    return true; // 開發階段：即使出錯也返回 true
  }
}

/**
 * 创建交易记录
 * @param {Object} transactionData 交易数据
 * @returns {Promise<Object>} 创建的交易记录
 */
async function createTransactionRecord(transactionData) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 更新充电桩的交易ID
    if (transactionData.cpid && transactionData.transactionId) {
      await updateGun(
        { cpid: transactionData.cpid },
        { transactionid: String(transactionData.transactionId) }
      );
    }
    
    return {
      id: transactionData.transactionId,
      ...transactionData,
      createdAt: new Date()
    };
  } catch (error) {
    logger.error(`创建交易记录失败`, error);
    throw error;
  }
}

/**
 * 创建新的交易记录到 transactions 表格
 * @param {Object} transactionData 交易数据
 * @returns {Promise<Object>} 创建的交易记录
 */
async function createNewTransaction(transactionData) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 生成內部自訂編號 (字串格式，用於內部追蹤)
    const now = new Date();
    const internalTransactionId = `TX${now.getTime()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // 準備交易記錄數據 (id 將由資料庫自動生成)
    const transactionRecord = {
      transaction_id: internalTransactionId, // 內部自訂編號 (字串)
      user_id: transactionData.user_id || null,
      start_time: new Date(),
      cpid: transactionData.cpid,
      cpsn: transactionData.cpsn,
      connector_id: transactionData.connector_id || 1,
      id_tag: transactionData.idTag,
      meter_start: parseFloat(transactionData.meterStart) || 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 創建交易記錄
    const transaction = await dbService.createTransaction(transactionRecord);
    
    // 獲取資料庫自動生成的 id 作為 OCPP transactionId
    // 注意：Prisma BigInt 需要轉換為 JavaScript number 用於 OCPP 協議
    const ocppTransactionId = Number(transaction.id);
    
    // 檢查是否在安全範圍內 (JavaScript Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991)
    if (ocppTransactionId > Number.MAX_SAFE_INTEGER) {
      logger.warn(`交易ID超出JavaScript安全整數範圍: ${transaction.id}`);
    }
    
    // 更新充电桩的交易ID（存儲為資料庫 ID 的字串形式）
    await updateGun(
      { cpid: transactionData.cpid },
      { transactionid: ocppTransactionId.toString() }
    );
    
    logger.info(`創建新交易記錄成功: OCPP ID=${ocppTransactionId}, 內部ID=${internalTransactionId} for ${transactionData.cpid}`);
    
    // 返回整數 transactionId 以符合 OCPP 協議
    return { 
      ...transaction, 
      ocppTransactionId: ocppTransactionId, // OCPP 協議使用的整數ID (資料庫自動生成)
      internalTransactionId: internalTransactionId // 內部追蹤用的字串ID
    };
  } catch (error) {
    logger.error(`創建交易記錄失败`, error);
    throw error;
  }
}

/**
 * 更新交易記錄
 * @param {number} ocppTransactionId OCPP 交易ID (整數主鍵)
 * @param {Object} updateData 更新數據
 * @returns {Promise<Object>} 更新的交易記錄
 */
async function updateTransactionRecord(ocppTransactionId, updateData) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 確保 ocppTransactionId 為整數
    const transactionIdInt = parseInt(ocppTransactionId);
    
    // 準備更新數據
    const updateFields = {
      ...updateData,
      updatedAt: new Date()
    };
    
    // 如果有結束時間，設置狀態為完成
    if (updateData.end_time || updateData.stopTimestamp) {
      updateFields.end_time = updateData.end_time || new Date(updateData.stopTimestamp);
      updateFields.status = 'COMPLETED';
    }
    
    // 如果有電表停止讀數，計算消耗電量
    if (updateData.meter_stop !== undefined) {
      updateFields.meter_stop = parseFloat(updateData.meter_stop);
      
      // 查找原始記錄以計算消耗電量
      const originalTransaction = await findTransactionById(transactionIdInt);
      if (originalTransaction && originalTransaction.meter_start !== null) {
        updateFields.energy_consumed = Math.max(0, 
          parseFloat(updateData.meter_stop) - parseFloat(originalTransaction.meter_start)
        );
      }
    }
    
    // 如果有充電時長，設置它
    if (updateData.chargingDuration !== undefined) {
      updateFields.charging_duration = parseInt(updateData.chargingDuration);
    }
    
    const transaction = await dbService.updateTransactionById(transactionIdInt, updateFields);
    logger.info(`更新交易記錄成功: OCPP ID=${transactionIdInt}`);
    return transaction;
  } catch (error) {
    logger.error(`更新交易記錄失败: OCPP ID=${ocppTransactionId}`, error);
    throw error;
  }
}

/**
 * 根據 OCPP 交易ID 查找交易記錄
 * @param {number} ocppTransactionId OCPP 交易ID (整數主鍵)
 * @returns {Promise<Object|null>} 交易記錄
 */
async function findTransactionById(ocppTransactionId) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 確保 ocppTransactionId 為整數
    const transactionIdInt = parseInt(ocppTransactionId);
    
    const transaction = await dbService.getTransactionById(transactionIdInt);
    if (transaction) {
      logger.debug(`找到交易記錄: OCPP ID=${transactionIdInt}`);
    } else {
      logger.warn(`未找到交易記錄: OCPP ID=${transactionIdInt}`);
    }
    return transaction;
  } catch (error) {
    logger.error(`查找交易記錄失败: OCPP ID=${ocppTransactionId}`, error);
    return null;
  }
}

/**
 * 查找交易记录 (向後兼容)
 * @param {string} transactionId 交易ID
 * @returns {Promise<Object|null>} 交易记录
 */
async function findTransaction(transactionId) {
  try {
    // 首先嘗試從 transactions 表格查找
    const transaction = await findTransactionById(transactionId);
    if (transaction) {
      return {
        id: transaction.transaction_id,
        cpid: transaction.cpid,
        cpsn: transaction.cpsn,
        connector: transaction.connector_id,
        meterStart: transaction.meter_start,
        status: transaction.status,
        timestamp: transaction.start_time,
        startTime: transaction.start_time
      };
    }
    
    // 如果沒找到，嘗試舊的方法（向後兼容）
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    const guns = await dbService.getGuns({ transactionid: String(transactionId) });
    
    if (guns.length > 0) {
      const gun = guns[0];
      logger.debug(`找到交易记录: ${transactionId} 对应充电桩 ${gun.cpid}`);
      
      return {
        id: transactionId,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector || 1,
        status: gun.guns_status,
        startTime: gun.updatedAt
      };
    } else {
      logger.warn(`未找到交易记录: ${transactionId}`);
      return null;
    }
  } catch (error) {
    logger.error(`查找交易记录失败: ${transactionId}`, error);
    return null;
  }
}

/**
 * 查找並處理孤兒交易
 * 孤兒交易：超過指定時間仍處於 ACTIVE 狀態且沒有最近 MeterValues 更新的交易
 * @param {number} timeoutMinutes 超時時間（分鐘），預設 30 分鐘
 * @returns {Promise<Array>} 處理的孤兒交易列表
 */
async function findAndHandleOrphanTransactions(timeoutMinutes = 30) {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    
    // 計算超時時間點
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    // 查找孤兒交易的條件：
    // 1. 狀態為 ACTIVE
    // 2. 開始時間超過 timeoutMinutes 分鐘
    // 3. 最後電表更新時間超過 timeoutMinutes/2 分鐘（或為 null）
    const meterUpdateThreshold = new Date(Date.now() - (timeoutMinutes / 2) * 60 * 1000);
    
    logger.info(`查找孤兒交易: 超時閾值=${timeoutThreshold.toISOString()}, 電表更新閾值=${meterUpdateThreshold.toISOString()}`);
    
    // 查找所有可能的孤兒交易
    const activeTransactions = await dbService.getTransactions({ 
      status: 'ACTIVE',
      start_time: {
        lt: timeoutThreshold // 開始時間早於超時閾值
      }
    });
    
    logger.info(`找到 ${activeTransactions.length} 個超時的活躍交易`);
    
    const orphanTransactions = [];
    
    for (const transaction of activeTransactions) {
      let isOrphan = false;
      
      // 檢查最後電表更新時間，判斷是否為孤兒交易
      if (!transaction.last_meter_update) {
        // 沒有電表更新記錄，可能是孤兒交易
        isOrphan = true;
        logger.warn(`交易 ${transaction.transaction_id} 沒有電表更新記錄`);
      } else if (new Date(transaction.last_meter_update) < meterUpdateThreshold) {
        // 電表更新時間過舊
        isOrphan = true;
        logger.warn(`交易 ${transaction.transaction_id} 電表更新時間過舊: ${transaction.last_meter_update}`);
      }
      
      if (isOrphan) {
        // 處理孤兒交易
        const handledTransaction = await handleOrphanTransaction(transaction);
        orphanTransactions.push(handledTransaction);
      }
    }
    
    logger.info(`處理了 ${orphanTransactions.length} 個孤兒交易`);
    return orphanTransactions;
    
  } catch (error) {
    logger.error(`查找和處理孤兒交易失敗`, error);
    throw error;
  }
}

/**
 * 處理單個孤兒交易
 * 
 * 核心邏輯：
 * 1. 將超時的交易記錄狀態設為 ERROR
 * 2. 不更新充電樁狀態，因為孤兒交易通常由斷電/網路中斷造成
 * 3. 讓充電樁重新連接時自己報告正確的狀態
 * 
 * 為什麼不更新充電樁狀態：
 * - 斷電：充電樁可能仍然離線
 * - 網路中斷：充電樁可能已恢復但狀態未知
 * - 硬體重啟：充電樁可能正在進行新的操作
 * 
 * @param {Object} transaction 交易記錄
 * @returns {Promise<Object>} 處理後的交易記錄
 */
async function handleOrphanTransaction(transaction) {
  try {
    logger.warn(`處理孤兒交易: ${transaction.transaction_id} (CPID: ${transaction.cpid})`);
    
    // 使用最後已知的電表讀數作為結束讀數
    const meterStop = transaction.energy_consumed 
      ? (parseFloat(transaction.meter_start || 0) + parseFloat(transaction.energy_consumed)).toFixed(3)
      : transaction.meter_start || 0;
    
    // 計算結束時間：使用最後電表更新時間，或當前時間
    const endTime = transaction.last_meter_update 
      ? new Date(transaction.last_meter_update)
      : new Date();
    
    // 重新計算充電時長
    const startTime = new Date(transaction.start_time);
    const finalChargingDuration = Math.floor((endTime - startTime) / 1000);
    
    // 更新交易狀態為異常結束
    const updateData = {
      end_time: endTime,
      meter_stop: parseFloat(meterStop),
      status: 'ERROR',
      stop_reason: 'ORPHAN_TRANSACTION_AUTO_CLOSED',
      charging_duration: finalChargingDuration,
      updatedAt: new Date()
    };
    
    // 使用 dbService.updateTransaction 方法直接更新，因為我們有字符串形式的 transaction_id
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const updatedTransaction = await dbService.updateTransaction(transaction.transaction_id, updateData);
    
    // 注意：不更新充電樁狀態，因為孤兒交易通常由斷電/網路中斷造成
    // 充電樁可能：
    // 1. 仍然離線（斷電未恢復）
    // 2. 已重新上線但處於不同狀態
    // 3. 已經在進行新的交易
    // 因此，讓充電樁在重新連接時自己報告正確的狀態
    logger.info(`孤兒交易 ${transaction.transaction_id} 已標記為ERROR，充電樁狀態保持不變`);
    
    // 記錄孤兒交易處理日志
    // await createCpLogEntry({
    //   cpid: transaction.cpid,
    //   cpsn: transaction.cpsn,
    //   log: `Orphan Transaction Auto-Closed - ID: ${transaction.transaction_id}, Energy: ${transaction.energy_consumed || 0} kWh, Duration: ${formatDuration(finalChargingDuration)}, Reason: Timeout/Lost Connection`,
    //   time: endTime,
    //   inout: "system",
    // });
    
    logger.info(`孤兒交易 ${transaction.transaction_id} 已自動關閉`);
    return { ...transaction, ...updateData, handled: true };
    
  } catch (error) {
    logger.error(`處理孤兒交易 ${transaction.transaction_id} 失敗`, error);
    throw error;
  }
}

/**
 * 啟動孤兒交易監控服務
 * 定期檢查並處理孤兒交易
 * @param {number} intervalMinutes 檢查間隔（分鐘），預設 10 分鐘
 * @param {number} timeoutMinutes 交易超時時間（分鐘），預設 30 分鐘
 */
function startOrphanTransactionMonitor(intervalMinutes = 10, timeoutMinutes = 30) {
  logger.info(`啟動孤兒交易監控服務: 檢查間隔=${intervalMinutes}分鐘, 超時閾值=${timeoutMinutes}分鐘`);
  
  // 立即執行一次檢查
  findAndHandleOrphanTransactions(timeoutMinutes).catch(error => {
    logger.error('首次孤兒交易檢查失敗', error);
  });
  
  // 設置定期檢查
  setInterval(async () => {
    try {
      logger.debug('執行定期孤兒交易檢查...');
      const orphans = await findAndHandleOrphanTransactions(timeoutMinutes);
      if (orphans.length > 0) {
        logger.warn(`定期檢查發現並處理了 ${orphans.length} 個孤兒交易`);
      }
    } catch (error) {
      logger.error('定期孤兒交易檢查失敗', error);
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * 格式化時長為可讀格式
 * @param {number} seconds 秒數
 * @returns {string} 格式化的時長
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0:00:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  loadDatabaseModules,
  ensureDbInitialized,
  getAllGuns,
  getGunByCpid,
  getGunsByCpsn,
  updateGun,
  updateGunStatus,
  updateConnectorStatus,
  updateGunMeterValues,
  createCpLogEntry,
  getStations,
  validateIdTag,
  createTransactionRecord,
  findTransaction,
  createNewTransaction,
  updateTransactionRecord,
  findTransactionById,
  findAndHandleOrphanTransactions,
  handleOrphanTransaction,
  startOrphanTransactionMonitor,
  formatDuration
};
