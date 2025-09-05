/**
 * 能源管理系统(EMS)服务
 * 处理功率分配和能源管理相关功能
 * 
 * 从旧版 ocppController.js 迁移而来
 */
const mqService = require('./mqService');
const { EXCHANGES } = require('../mqServer');
const logger = require('../utils/logger');
const chargePointRepository = require('../repositories/chargePointRepository');
const connectionService = require('./connectionService');
const ocppMessageService = require('./ocppMessageService');

// 引入EMS分配算法
const { calculateEmsAllocation, isCharging } = require('../../lib/emsAllocator');

// 定义事件类型
const EVENT_TYPES = {
  ALLOCATION_REQUEST: 'allocation.request',
  ALLOCATION_RESULT: 'allocation.result',
  PROFILE_UPDATE: 'profile.update',
  GLOBAL_REALLOCATION: 'global.reallocation'
};

// 事件驱动功率管理相关变量
const profileUpdateTimers = {};              // 存储每个 cpid 的防抖定时器
const lastProfileUpdateTime = {};            // 记录每个 cpid 的最后更新时间
const PROFILE_UPDATE_DEBOUNCE_MS = 3000;     // 3秒防抖延迟，避免短时间内重复触发
const PROFILE_MIN_INTERVAL_MS = 30000;       // 30秒最小间隔，防止过度频繁更新
const RECONCILE_INTERVAL_MS = 60000;         // 60秒定时校正间隔，容错补偿机制
let reconciliationIntervalId = null;         // 定时校正的 interval ID

/**
 * 请求功率分配计算
 * @param {Object} data - 功率分配请求数据
 * @returns {Promise<boolean>}
 */
async function requestAllocation(data) {
  return await mqService.publishMessage(EXCHANGES.EMS_EVENTS, EVENT_TYPES.ALLOCATION_REQUEST, data);
}

/**
 * 发布功率分配结果
 * @param {Object} data - 分配结果数据
 * @returns {Promise<boolean>}
 */
async function publishAllocationResult(data) {
  return await mqService.publishMessage(EXCHANGES.EMS_EVENTS, EVENT_TYPES.ALLOCATION_RESULT, data);
}

/**
 * 发布功率配置更新事件
 * @param {Object} data - 更新数据
 * @returns {Promise<boolean>}
 */
async function publishProfileUpdate(data) {
  return await mqService.publishMessage(EXCHANGES.EMS_EVENTS, EVENT_TYPES.PROFILE_UPDATE, data);
}

/**
 * 发布全站重新分配事件
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function publishGlobalReallocation(data) {
  return await mqService.publishMessage(EXCHANGES.EMS_EVENTS, EVENT_TYPES.GLOBAL_REALLOCATION, data);
}

/**
 * 处理功率分配请求
 * @param {Object} data - 请求数据
 */
async function handleAllocationRequest(data) {
  logger.info(`🔋 处理功率分配请求:`, data);
  
  try {
    const { siteSetting, allGuns, onlineCpids } = data;
    
    // 执行EMS分配算法
    const result = calculateEmsAllocation(siteSetting, allGuns, onlineCpids);
    
    // 发布分配结果
    await publishAllocationResult({
      requestId: data.requestId,
      result: result,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ 功率分配计算完成，共分配 ${result.allocations?.length || 0} 个充电桩`);
    return true;
  } catch (error) {
    logger.error('❌ 功率分配计算失败:', error.message);
    
    // 发送失败结果
    await publishAllocationResult({
      requestId: data.requestId,
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }
}

/**
 * 处理全站重新分配事件
 * 基于事件驱动的全站功率重分配实现
 * @param {Object} data - 事件数据
 * @returns {Promise<boolean>}
 */
async function handleGlobalReallocation(data) {
  const reallocationId = data.reallocationId || `auto_${Date.now()}`;
  logger.info(`[全站重分配-MQ] 🔄 处理全站功率重新分配事件 (ID: ${reallocationId})`);
  
  try {
    const { onlineCpids, siteSetting, immediate = false, eventType, eventDetails } = data;
    
    if (!onlineCpids || !Array.isArray(onlineCpids) || onlineCpids.length === 0) {
      logger.warn(`[全站重分配-MQ] ⚠️ 无在线充电桩数据或列表为空，跳过处理`);
      return false;
    }
    
    if (!siteSetting) {
      logger.warn(`[全站重分配-MQ] ⚠️ 缺少场域设置数据，跳过处理`);
      return false;
    }
    
    logger.info(`[全站重分配-MQ] 📋 处理 ${onlineCpids.length} 个在线充电桩`);
    logger.info(`[全站重分配-MQ] 📊 场域设置: EMS模式=${siteSetting.ems_mode}, 最大功率=${siteSetting.max_power_kw}kW`);
    
    // 清除所有现有定时器
    clearAllProfileUpdateTimers();
    logger.info(`[全站重分配-MQ] 🧹 已清除所有现有功率配置定时器`);
    
    // 执行批量调度处理
    let scheduledCount = 0;
    const baseDelay = immediate ? 0 : 1000; 
    const intervalDelay = immediate ? 100 : 500; 
    const executionMode = immediate ? '立即执行' : '延迟排程';
    
    logger.info(`[全站重分配-MQ] 🚀 开始批量${executionMode}功率配置更新...`);
    
    for (let i = 0; i < onlineCpids.length; i++) {
      const cpid = onlineCpids[i];
      const delay = baseDelay + (i * intervalDelay);
      
      // 使用特殊标记表示这是全站重新分配
      await scheduleProfileUpdate(cpid, delay, {
        isGlobalReallocation: true,
        isManualTrigger: immediate,
        reallocationId: reallocationId,
        triggerEvent: eventType,
        triggerDetails: eventDetails
      });
      
      scheduledCount++;
    }
    
    logger.info(`[全站重分配-MQ] � 重分配统计:`);
    logger.info(`[全站重分配-MQ]   - 执行模式: ${executionMode} (事件驱动)`);
    logger.info(`[全站重分配-MQ]   - 在线充电桩: ${onlineCpids.length} 个`);
    logger.info(`[全站重分配-MQ]   - 排程更新: ${scheduledCount} 个`);
    logger.info(`[全站重分配-MQ]   - 预计完成: ${baseDelay + (scheduledCount * intervalDelay)}ms 后`);
    
    // 发送通知
    await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'ems.notification', {
      type: 'GLOBAL_REALLOCATION',
      message: `全站功率重分配事件处理完成，共排程 ${scheduledCount} 个充电桩配置更新`,
      data: {
        reallocationId,
        eventType,
        scheduledCount,
        executionMode: `${executionMode} (事件驱动)`,
        timestamp: new Date().toISOString()
      }
    });
    
    return true;
  } catch (error) {
    logger.error(`[全站重分配-MQ] ❌ 全站功率重新分配处理失败: ${error.message}`, error);
    return false;
  }
}

/**
 * 充电状态事件判断函数
 * 根据 OCPP 事件类型和载荷判断充电状态变化
 * 
 * 从旧版 ocppController.js 的 detectChargingStatusChange 迁移
 * 
 * @param {string} action OCPP 事件类型
 * @param {object} payload 事件载荷
 * @returns {boolean|null} true=开始充电, false=停止充电, null=无法判断
 */
function detectChargingStatusChange(action, payload) {
  logger.debug(`[detectChargingStatusChange] 分析事件: ${action}, 载荷: ${JSON.stringify(payload)}`);
  
  switch (action) {
    case 'StartTransaction':
      logger.debug('[detectChargingStatusChange] StartTransaction 事件 -> 判定为开始充电');
      return true;
      
    case 'StopTransaction':
      logger.debug('[detectChargingStatusChange] StopTransaction 事件 -> 判定为停止充电');
      return false;
      
    case 'StatusNotification':
      const status = (payload.status || '').toLowerCase();
      logger.debug(`[detectChargingStatusChange] StatusNotification 状态: ${status}`);
      
      if (status.includes('charg') || status.includes('inuse')) {
        logger.debug('[detectChargingStatusChange] 状态包含充电关键字 -> 判定为充电中');
        return true;
      }
      if (['available'].includes(status)) {
        // 特殊处理：Available 状态也触发功率配置下发
        logger.debug('[detectChargingStatusChange] Available状态 -> 判定为需要下发初始配置');
        return true; // 修改为返回true，确保触发功率配置下发
      }
      if (['unavailable', 'faulted', 'finishing'].includes(status)) {
        logger.debug('[detectChargingStatusChange] 状态为非充电状态 -> 判定为未充电');
        return false;
      }
      logger.debug('[detectChargingStatusChange] 状态不明确 -> 无法判断');
      return null;
      
    case 'MeterValues':
      // MeterValues 仅用于辅助判断，不直接触发配置更新
      logger.debug('[detectChargingStatusChange] MeterValues 事件 -> 不触发状态变更');
      return null;
      
    default:
      logger.debug(`[detectChargingStatusChange] 未知事件类型: ${action} -> 无法判断`);
      return null;
  }
}

/**
 * 全站功率重新分配调度器
 * 当系统状态发生变化时，重新计算并分配所有在线充电桩的功率
 * 
 * 从旧版 ocppController.js 的 scheduleGlobalPowerReallocation 迁移
 * 
 * @param {string} eventType 触发事件类型
 * @param {object} eventDetails 事件详细信息
 * @param {boolean} immediate 是否立即执行（手动触发时为 true）
 * @returns {Promise<boolean>} 成功返回 true，失败返回 false
 */
async function scheduleGlobalPowerReallocation(eventType, eventDetails = {}, immediate = false) {
  const reallocationId = `${eventType}_${Date.now()}`;
  logger.info(`[全站重分配] 🌐 开始全站功率重新分配 (ID: ${reallocationId})`);
  logger.info(`[全站重分配] 📋 触发事件: ${eventType}`);
  logger.info(`[全站重分配] 📊 事件详情: ${JSON.stringify(eventDetails)}`);
  
  try {
    // 1. 获取当前所有在线充电桩
    logger.debug(`[全站重分配] 🔍 获取所有在线充电桩...`);
    const onlineCpids = await connectionService.getOnlineCpids();
    
    if (onlineCpids.length === 0) {
      logger.info(`[全站重分配] ⚠️ 没有在线充电桩，跳过重新分配`);
      return false;
    }
    
    logger.info(`[全站重分配] 📊 找到 ${onlineCpids.length} 个在线充电桩: [${onlineCpids.join(', ')}]`);
    
    // 2. 获取场域设置
    const siteSetting = await chargePointRepository.getSiteSettings();
    logger.info(`[全站重分配] ⚙️ 场域设置: EMS模式=${siteSetting.ems_mode}, 最大功率=${siteSetting.max_power_kw}kW`);
    
    // 3. 清除所有现有的功率配置定时器，避免冲突
    logger.debug(`[全站重分配] 🧹 清除现有功率配置定时器...`);
    clearAllProfileUpdateTimers();
    
    // 4. 批量排程所有在线充电桩的功率配置更新
    const executionMode = immediate ? '立即执行' : '延迟排程';
    logger.info(`[全站重分配] 🚀 开始批量${executionMode}功率配置更新...`);
    
    let scheduledCount = 0;
    const baseDelay = immediate ? 0 : 1000; // 手动触发时无延迟，自动触发时基础延迟 1 秒
    const intervalDelay = immediate ? 100 : 500; // 手动触发时间隔较短
    
    for (let i = 0; i < onlineCpids.length; i++) {
      const cpid = onlineCpids[i];
      const delay = baseDelay + (i * intervalDelay);
      
      if (immediate) {
        logger.debug(`[全站重分配] ⚡ 立即执行 ${cpid} 功率配置更新，间隔 ${delay}ms`);
      } else {
        logger.debug(`[全站重分配] ⚡ 排程 ${cpid} 功率配置更新，延迟 ${delay}ms`);
      }
      
      // 使用特殊标记表示这是全站重新分配
      await scheduleProfileUpdate(cpid, delay, {
        isGlobalReallocation: true,
        isManualTrigger: immediate,
        reallocationId: reallocationId,
        triggerEvent: eventType,
        triggerDetails: eventDetails
      });
      
      scheduledCount++;
    }
    
    logger.info(`[全站重分配] 📈 重分配统计:`);
    logger.info(`[全站重分配]   - 执行模式: ${executionMode}`);
    logger.info(`[全站重分配]   - 触发事件: ${eventType}`);
    logger.info(`[全站重分配]   - 在线充电桩: ${onlineCpids.length} 个`);
    logger.info(`[全站重分配]   - 排程更新: ${scheduledCount} 个`);
    logger.info(`[全站重分配]   - 预计完成: ${baseDelay + (scheduledCount * intervalDelay)}ms 后`);
    logger.info(`[全站重分配] ✅ 全站功率重新分配排程完成 (ID: ${reallocationId})`);
    
    // 5. 延迟显示全站功率配置总览
    const totalDelay = baseDelay + (scheduledCount * intervalDelay) + (immediate ? 1000 : 2000); // 手动触发较短等待时间
    setTimeout(async () => {
      try {
        logger.info(`[全站重分配] 📊 显示重分配后的功率配置总览...`);
        await logCurrentPowerConfiguration(siteSetting.ems_mode, parseFloat(siteSetting.max_power_kw));
        logger.info(`[全站重分配] 🎯 全站重分配完全完成 (ID: ${reallocationId})`);
      } catch (error) {
        logger.error(`[全站重分配] ❌ 显示功率总览失败: ${error.message}`, error);
      }
    }, totalDelay);
    
    return true;
    
  } catch (error) {
    logger.error(`[全站重分配] ❌ 全站功率重新分配失败 (ID: ${reallocationId}): ${error.message}`, error);
    return false;
  }
}

/**
 * 防抖动的配置更新调度器
 * 使用防抖机制和最小间隔限制，避免过度频繁的配置下发
 * 
 * 从旧版 ocppController.js 的 scheduleProfileUpdate 迁移
 * 
 * @param {string} cpid 充电桩 ID
 * @param {number} delay 延迟时间(毫秒)，预设为防抖延迟时间
 * @param {object} context 额外上下文信息，可选
 * @returns {Promise<void>}
 */
async function scheduleProfileUpdate(cpid, delay = PROFILE_UPDATE_DEBOUNCE_MS, context = {}) {
  if (!cpid) {
    logger.warn('[scheduleProfileUpdate] cpid 为空，跳过排程');
    return;
  }
  
  const isGlobalReallocation = context.isGlobalReallocation || false;
  const logPrefix = isGlobalReallocation ? '[全站重分配→单桩]' : '[scheduleProfileUpdate]';
  
  if (isGlobalReallocation) {
    logger.info(`${logPrefix} 🔄 ${cpid} 功率配置更新 (重分配ID: ${context.reallocationId})，延迟 ${delay}ms`);
  } else {
    logger.info(`${logPrefix} 排程 ${cpid} 功率配置更新，延迟 ${delay}ms`);
  }
  
  // 清除现有的定时器，实现防抖效果
  if (profileUpdateTimers[cpid]) {
    logger.debug(`${logPrefix} 清除 ${cpid} 的现有定时器`);
    clearTimeout(profileUpdateTimers[cpid]);
  }
  
  // 设置新的定时器
  profileUpdateTimers[cpid] = setTimeout(async () => {
    const now = Date.now();
    const isManualTrigger = context.isManualTrigger || false;
    
    // 手动触发时跳过最小间隔限制检查
    if (!isManualTrigger && lastProfileUpdateTime[cpid] && 
        now - lastProfileUpdateTime[cpid] < PROFILE_MIN_INTERVAL_MS) {
      const remainingTime = PROFILE_MIN_INTERVAL_MS - (now - lastProfileUpdateTime[cpid]);
      logger.info(`${logPrefix} ${cpid} 更新间隔过短(剩余 ${Math.ceil(remainingTime/1000)}s)，跳过此次更新`);
      return;
    }
    
    // 记录更新时间
    lastProfileUpdateTime[cpid] = now;
    
    if (isGlobalReallocation) {
      const triggerMode = isManualTrigger ? '手动触发' : '自动触发';
      logger.info(`${logPrefix} ⚡ 开始执行 ${cpid} 功率配置更新 (${triggerMode}, 重分配ID: ${context.reallocationId})`);
    } else {
      logger.info(`${logPrefix} 开始执行 ${cpid} 功率配置更新`);
    }
    
    try {
      // 获取场域设置
      const siteSetting = await chargePointRepository.getSiteSettings();
      logger.debug(`${logPrefix} ${cpid} 使用场域设置: ${JSON.stringify(siteSetting)}`);
      
      // 触发配置更新 - 使用 ocppMessageService
      logger.debug(`${logPrefix} 调用 ocppMessageService 为 ${cpid} 下发配置`);
      
      try {
        // 获取充电桩信息
        const guns = await chargePointRepository.getAllGuns({ cpid });
        
        if (guns.length === 0) {
          logger.warn(`${logPrefix} 找不到充电桩 ${cpid} 的信息，无法下发配置`);
          return;
        }
        
        const gun = guns[0];
        const cpsn = gun.cpsn;
        const connectorId = gun.connector;
        
        if (!cpsn || !connectorId) {
          logger.warn(`${logPrefix} 充电桩 ${cpid} 缺少 CPSN 或 connectorId 信息`);
          return;
        }
        
        // 直接调用sendChargingProfile避开循环依赖
        logger.info(`${logPrefix} 为 ${cpid} (${cpsn}:${connectorId}) 下发配置`);
        await ocppMessageService.sendChargingProfile(cpsn, connectorId, siteSetting);
      } catch (err) {
        logger.error(`${logPrefix} 下发配置失败: ${err.message}`);
      }
      
      if (isGlobalReallocation) {
        logger.info(`${logPrefix} ✅ ${cpid} 功率配置更新完成 (重分配ID: ${context.reallocationId})`);
      } else {
        logger.info(`${logPrefix} ${cpid} 功率配置更新完成`);
      }
      
      // 额外记录当前充电桩配置概况（简化版）
      try {
        const guns = await chargePointRepository.getAllGuns({ cpid });
        const gun = guns.length > 0 ? guns[0] : null;
        if (gun) {
          const emoji = isGlobalReallocation ? '🌐' : '🔍';
          logger.info(`${emoji} [单桩更新] ${cpid} -> 类型:${gun.acdc} | 规格:${gun.max_kw}kW | 状态:${gun.guns_status} | EMS:${siteSetting.ems_mode}`);
        }
      } catch (e) {
        logger.warn(`${logPrefix} 无法获取 ${cpid} 详细信息: ${e.message}`);
      }
      
    } catch (error) {
      logger.error(`${logPrefix} ${cpid} 更新失败: ${error.message}`, error);
    }
  }, delay);
  
  if (isGlobalReallocation) {
    logger.debug(`${logPrefix} 🕐 ${cpid} 定时器已设置，将在 ${delay}ms 后执行 (重分配ID: ${context.reallocationId})`);
  } else {
    logger.debug(`${logPrefix} ${cpid} 定时器已设置，将在 ${delay}ms 后执行`);
  }
}

/**
 * 清除所有功率配置更新定时器
 */
function clearAllProfileUpdateTimers() {
  logger.debug(`[clearAllProfileUpdateTimers] 清除所有功率配置定时器...`);
  
  const timerKeys = Object.keys(profileUpdateTimers);
  if (timerKeys.length > 0) {
    timerKeys.forEach(cpid => {
      if (profileUpdateTimers[cpid]) {
        clearTimeout(profileUpdateTimers[cpid]);
        logger.debug(`[clearAllProfileUpdateTimers] 清除 ${cpid} 的定时器`);
      }
    });
    logger.info(`[clearAllProfileUpdateTimers] 已清除 ${timerKeys.length} 个定时器`);
  } else {
    logger.debug(`[clearAllProfileUpdateTimers] 当前无活动定时器`);
  }
}

/**
 * 记录当前全站功率配置总览
 * 显示所有充电桩的功率分配状况，包含 A 和 W 的详细记录
 * 
 * 从旧版 ocppController.js 的 logCurrentPowerConfiguration 迁移
 * 
 * @param {string} emsMode EMS 模式 (static/dynamic)
 * @param {number} maxPowerKw 场域总功率限制
 */
async function logCurrentPowerConfiguration(emsMode, maxPowerKw) {
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 【全站功率配置总览】');
    logger.info(`🔧 EMS模式: ${emsMode.toUpperCase()} | 💡 场域总功率: ${maxPowerKw}kW`);
    logger.info('='.repeat(80));
    
    // 获取所有充电桩数据
    const allGuns = await chargePointRepository.getAllGuns({});
    const onlineCpids = await connectionService.getOnlineCpids();
    
    // 🚀 使用正确的 EMS 分配算法
    const siteSetting = { ems_mode: emsMode, max_power_kw: maxPowerKw };
    const emsResult = calculateEmsAllocation(siteSetting, allGuns, onlineCpids);
    const allocation = emsResult.allocations;
    
    // 分类统计
    const acGuns = allGuns.filter(g => g.acdc === 'AC');
    const dcGuns = allGuns.filter(g => g.acdc === 'DC');
    const onlineAcGuns = acGuns.filter(g => onlineCpids.includes(g.cpsn));
    const onlineDcGuns = dcGuns.filter(g => onlineCpids.includes(g.cpsn));
    
    const chargingAcGuns = onlineAcGuns.filter(g => isCharging(g.guns_status));
    const chargingDcGuns = onlineDcGuns.filter(g => isCharging(g.guns_status));
    
    logger.info(`📈 充电站统计: 总数=${allGuns.length} | 在线=${onlineCpids.length} | AC在线=${onlineAcGuns.length} | DC在线=${onlineDcGuns.length}`);
    logger.info(`⚡ 充电中统计: AC充电=${chargingAcGuns.length} | DC充电=${chargingDcGuns.length}`);
    logger.info('-'.repeat(80));
    
    // AC 充电桩配置详情
    if (onlineAcGuns.length > 0) {
      logger.info('🔌 AC充电桩配置详情:');
      let totalAcCurrentA = 0;
      let totalAcPowerKw = 0;
      
      onlineAcGuns.forEach(gun => {
        const status = gun.guns_status || 'Unknown';
        const charging = isCharging(status) ? '⚡充电中' : '⏸️待机';
        const maxKw = parseFloat(gun.max_kw || 0);
        
        // 从EMS分配结果获取配置值
        const gunAllocation = allocation.find(a => a.cpid === gun.cpid);
        let allocatedCurrentA, allocatedPowerKw;
        
        if (gunAllocation) {
          allocatedCurrentA = gunAllocation.limit; // EMS已经计算好的A值
          allocatedPowerKw = gunAllocation.allocated_kw; // EMS已经计算好的kW值
        } else {
          // 备用值
          allocatedCurrentA = 6;
          allocatedPowerKw = (6 * 220) / 1000;
        }
        
        totalAcCurrentA += allocatedCurrentA;
        totalAcPowerKw += allocatedPowerKw;
        
        logger.info(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedCurrentA.toString().padStart(3)}A | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 规格:${maxKw}kW`);
      });
      
      logger.info(`  🔋 AC总计: ${totalAcCurrentA}A | ${totalAcPowerKw.toFixed(2)}kW`);
      logger.info('-'.repeat(80));
    }
    
    // DC 充电桩配置详情
    if (onlineDcGuns.length > 0) {
      logger.info('🔋 DC充电桩配置详情:');
      let totalDcPowerW = 0;
      let totalDcPowerKw = 0;
      
      onlineDcGuns.forEach(gun => {
        const status = gun.guns_status || 'Unknown';
        const charging = isCharging(status) ? '⚡充电中' : '⏸️待机';
        const maxKw = parseFloat(gun.max_kw || 0);
        
        // 从EMS分配结果获取配置值
        const gunAllocation = allocation.find(a => a.cpid === gun.cpid);
        let allocatedPowerW, allocatedPowerKw;
        
        if (gunAllocation) {
          allocatedPowerW = gunAllocation.limit; // EMS已经计算好的W值
          allocatedPowerKw = gunAllocation.allocated_kw; // EMS已经计算好的kW值
        } else {
          // 备用值
          allocatedPowerW = 1000;
          allocatedPowerKw = 1;
        }
        
        totalDcPowerW += allocatedPowerW;
        totalDcPowerKw += allocatedPowerKw;
        
        logger.info(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedPowerW.toString().padStart(6)}W | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 规格:${maxKw}kW`);
      });
      
      logger.info(`  ⚡ DC总计: ${totalDcPowerW}W | ${totalDcPowerKw.toFixed(2)}kW`);
      logger.info('-'.repeat(80));
    }
    
    // 功率使用统计 - 使用EMS分配结果
    const totalUsedPower = emsResult.summary.total_allocated_kw;
    const powerUtilization = (totalUsedPower / maxPowerKw * 100).toFixed(1);
    
    logger.info(`📊 功率使用统计:`);
    logger.info(`  💡 场域总功率: ${maxPowerKw}kW`);
    logger.info(`  ⚡ 实际使用功率: ${totalUsedPower.toFixed(2)}kW`);
    logger.info(`  📈 功率使用率: ${powerUtilization}%`);
    logger.info(`  ⏰ 更新时间: ${new Date().toLocaleString('zh-TW')}`);
    logger.info('='.repeat(80));
    logger.info('📊 【功率配置总览完成】\n');
    
    return emsResult;
    
  } catch (error) {
    logger.error('❌ 记录功率配置总览时发生错误:', error);
    throw error;
  }
}

/**
 * 初始化定时功率校正机制
 * 每 60 秒执行一次全站功率配置检查和更新
 * 
 * 从旧版 ocppController.js 的 setInterval 功能迁移
 */
function initReconciliationInterval() {
  // 如果已经存在定时任务，先清除
  if (reconciliationIntervalId) {
    clearInterval(reconciliationIntervalId);
  }
  
  logger.info(`[EMS] 初始化定时功率校正机制，间隔: ${RECONCILE_INTERVAL_MS/1000} 秒`);
  
  reconciliationIntervalId = setInterval(async () => {
    try {
      logger.info('='.repeat(60));
      logger.info('[reconciliation] 🔄 开始定时功率配置校正');
      logger.info(`[reconciliation] ⏰ 校正间隔: ${RECONCILE_INTERVAL_MS/1000} 秒`);
      
      // 获取当前在线的充电桩清单
      const onlineCpids = await connectionService.getOnlineCpids();
      logger.info(`[reconciliation] 📊 在线充电桩统计: ${onlineCpids.length} 个`);
      logger.info(`[reconciliation] 📋 在线清单: [${onlineCpids.join(', ')}]`);
      
      // 如果没有在线充电桩，跳过校正
      if (onlineCpids.length === 0) {
        logger.info('[reconciliation] ⚠️ 无在线充电桩，跳过此次校正');
        logger.info('='.repeat(60));
        return;
      }
      
      let totalScheduledUpdates = 0;
      
      // 批量处理每个在线充电桩的配置更新
      logger.info('[reconciliation] 🚀 开始批量排程功率配置更新...');
      
      for (let i = 0; i < onlineCpids.length; i++) {
        const cpid = onlineCpids[i];
        logger.debug(`[reconciliation] 处理充电桩 ${i+1}/${onlineCpids.length}: CPID ${cpid}`);
        
        // 使用随机延迟避免同时下发，分散服务器负载
        const delay = Math.random() * 5000;  // 0-5秒随机延迟
        logger.debug(`[reconciliation] ✅ 排程更新 ${cpid}，延迟 ${Math.round(delay)}ms`);
        scheduleProfileUpdate(cpid, delay);
        totalScheduledUpdates++;
      }
      
      logger.info(`[reconciliation] 📈 校正统计:`);
      logger.info(`[reconciliation]   - 扫描充电站: ${onlineCpids.length} 个`);
      logger.info(`[reconciliation]   - 排程更新: ${totalScheduledUpdates} 个`);
      logger.info(`[reconciliation] ✨ 定时校正完成，下次校正将在 ${RECONCILE_INTERVAL_MS/1000} 秒后执行`);
      logger.info('='.repeat(60));
      
      // 如果有排程更新，延迟显示全站功率配置总览
      if (totalScheduledUpdates > 0) {
        const totalDelay = Math.max(5000, totalScheduledUpdates * 500); // 至少等待5秒，或按更新数量计算
        logger.debug(`[reconciliation] 📊 将在 ${totalDelay}ms 后显示全站功率配置总览`);
        
        setTimeout(async () => {
          try {
            const siteSetting = await chargePointRepository.getSiteSettings();
            await logCurrentPowerConfiguration(siteSetting.ems_mode, parseFloat(siteSetting.max_power_kw));
          } catch (error) {
            logger.error('❌ [reconciliation] 显示功率总览时发生错误:', error);
          }
        }, totalDelay);
      }
      
    } catch (error) {
      logger.error('❌ [reconciliation] 定时校正过程中发生严重错误:');
      logger.error('[reconciliation] 错误消息:', error.message);
      logger.error('[reconciliation] 错误堆栈:', error.stack);
      logger.info('[reconciliation] 🔄 系统将在下个周期重试校正');
      logger.info('='.repeat(60));
    }
  }, RECONCILE_INTERVAL_MS);
  
  logger.info(`[EMS] 定时功率校正机制初始化完成，intervalId: ${reconciliationIntervalId}`);
  return reconciliationIntervalId;
}

module.exports = {
  EVENT_TYPES,
  PROFILE_UPDATE_DEBOUNCE_MS,
  PROFILE_MIN_INTERVAL_MS,
  RECONCILE_INTERVAL_MS,
  requestAllocation,
  publishAllocationResult,
  publishProfileUpdate,
  publishGlobalReallocation,
  handleAllocationRequest,
  handleGlobalReallocation,
  detectChargingStatusChange,
  scheduleGlobalPowerReallocation,
  scheduleProfileUpdate,
  clearAllProfileUpdateTimers,
  logCurrentPowerConfiguration,
  initReconciliationInterval
};
