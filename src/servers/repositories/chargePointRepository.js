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
 * @returns {Promise<Object>} 站点设置
 */
async function getSiteSettings() {
  try {
    await ensureDbInitialized();
    const { databaseService: dbService } = await loadDatabaseModules();
    const settings = await dbService.getSiteSettings();
    return settings.length > 0 ? settings[0] : null;
  } catch (error) {
    logger.error(`获取站点设置失败`, error);
    throw error;
  }
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
  getSiteSettings
};
