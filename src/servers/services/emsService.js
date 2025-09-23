/**
 * 能源管理系统(EMS)服务
 * 处理功率分配和能源管理相关功能
 * 
 * 从旧版 ocppController.js 迁移而来
 */
const mqService = require('./mqService');
const { EXCHANGES } = require('../mqServer');
const { logger } = require('../utils');
const { chargePointRepository } = require('../repositories');
const connectionService = require('./connectionService');
const ocppMessageService = require('./ocppMessageService');

// 引入EMS分配算法
const { calculateEmsAllocation } = require('../../lib');

// 电表和充电枪相关辅助函数
let databaseService;

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
 * 处理功率分配请求 - 修复后按电表分组计算
 * @param {Object} data - 请求数据
 */
async function handleAllocationRequest(data) {
  logger.info(`🔋 处理功率分配请求:`, data);
  
  try {
    let { siteSetting, allGuns, onlineCpids, meterId } = data;
    
    // 如果指定了meterId，只处理该电表的分配
    if (meterId) {
      logger.info(`🎯 处理指定电表 ${meterId} 的功率分配`);
      
      // 获取指定电表的配置
      const stations = await chargePointRepository.getStations();
      let targetMeter = null;
      
      for (const station of stations) {
        if (station.meters && Array.isArray(station.meters)) {
          const foundMeter = station.meters.find(meter => meter.id == meterId);
          if (foundMeter) {
            targetMeter = foundMeter;
            siteSetting = {
              ems_mode: foundMeter.ems_mode || 'static',
              max_power_kw: foundMeter.max_power_kw || 100,
              station_id: station.id,
              station_name: station.name,
              meter_id: foundMeter.id
            };
            break;
          }
        }
      }
      
      if (!targetMeter) {
        throw new Error(`找不到电表 ID: ${meterId}`);
      }
      
      // 只获取该电表下的充电枪
      const meterGuns = allGuns.filter(gun => gun.meter_id == meterId);
      const meterOnlineCpids = onlineCpids.filter(cpid => {
        const gun = meterGuns.find(g => g.cpid === cpid);
        return gun !== undefined;
      });
      
      logger.info(`🔋 电表 ${meterId} 包含 ${meterGuns.length} 个充电枪，${meterOnlineCpids.length} 个在线`);
      
      // 执行该电表的EMS分配算法
      const result = calculateEmsAllocation(siteSetting, meterGuns, meterOnlineCpids);
      
      // 发布分配结果
      await publishAllocationResult({
        requestId: data.requestId,
        result: result,
        meterId: meterId,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ 电表 ${meterId} 功率分配完成，共分配 ${result.allocations?.length || 0} 个充电桩`);
      return true;
    }
    
    // 如果没有指定meterId，按电表分组处理所有功率分配
    logger.info(`🌐 处理所有电表的功率分配`);
    
    // 获取所有站点和电表信息
    const stations = await chargePointRepository.getStations();
    const combinedResults = {
      allocations: [],
      summary: {
        total_allocated_kw: 0,
        ac_allocated_kw: 0,
        dc_allocated_kw: 0,
        total_available_kw: 0
      }
    };
    
    let processedMeters = 0;
    
    // 按电表分组处理
    for (const station of stations) {
      if (!station.meters || !Array.isArray(station.meters)) continue;
      
      for (const meter of station.meters) {
        // 获取该电表下的充电枪
        const meterGuns = allGuns.filter(gun => gun.meter_id == meter.id);
        const meterOnlineCpids = onlineCpids.filter(cpid => {
          const gun = meterGuns.find(g => g.cpid === cpid);
          return gun !== undefined;
        });
        
        if (meterGuns.length === 0) {
          logger.debug(`⚠️ 电表 ${meter.id} (${meter.meter_no}) 没有关联充电枪，跳过`);
          continue;
        }
        
        logger.info(`⚡ 处理电表 ${meter.id} (${meter.meter_no}): ${meterGuns.length} 个充电枪，${meterOnlineCpids.length} 个在线`);
        
        // 为该电表创建独立的配置
        const meterSiteSetting = {
          ems_mode: meter.ems_mode || 'static',
          max_power_kw: meter.max_power_kw || 100,
          station_id: station.id,
          station_name: station.name,
          meter_id: meter.id
        };
        
        // 执行该电表的EMS分配算法
        const meterResult = calculateEmsAllocation(meterSiteSetting, meterGuns, meterOnlineCpids);
        
        // 合并结果
        combinedResults.allocations.push(...meterResult.allocations);
        combinedResults.summary.total_allocated_kw += meterResult.summary.total_allocated_kw;
        combinedResults.summary.ac_allocated_kw += meterResult.summary.ac_allocated_kw;
        combinedResults.summary.dc_allocated_kw += meterResult.summary.dc_allocated_kw;
        combinedResults.summary.total_available_kw += meterResult.summary.total_available_kw;
        
        processedMeters++;
        
        logger.info(`✅ 电表 ${meter.id} 分配完成: ${meterResult.allocations.length} 个充电桩，${meterResult.summary.total_allocated_kw.toFixed(2)}kW`);
      }
    }
    
    // 发布合并后的分配结果
    await publishAllocationResult({
      requestId: data.requestId,
      result: combinedResults,
      processedMeters: processedMeters,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ 所有电表功率分配完成: ${processedMeters} 个电表，共分配 ${combinedResults.allocations.length} 个充电桩，总功率 ${combinedResults.summary.total_allocated_kw.toFixed(2)}kW`);
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
  logger.info(`[全站重分配-MQ] 🔄 处理所有站點電表功率重新分配事件 (ID: ${reallocationId})`);
  
  try {
    let { immediate = false, eventType, eventDetails } = data;
    
    // 獲取所有站點和電表，不依賴傳入的 onlineCpids 列表
    const allStations = await chargePointRepository.getStations();
    
    if (!allStations || allStations.length === 0) {
      logger.warn(`[全站重分配-MQ] ⚠️ 沒有找到任何站點，跳過處理`);
      return false;
    }
    
    logger.info(`[全站重分配-MQ] 📋 處理 ${allStations.length} 個站點的所有電表`);
    
    let totalProcessedMeters = 0;
    let totalScheduledUpdates = 0;
    const executionMode = immediate ? '立即执行' : '延迟排程';
    
    // 依序處理每個站點下的所有電表
    for (const station of allStations) {
      if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
        logger.info(`[全站重分配-MQ] ⚠️ 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
        continue;
      }
      
      logger.info(`[全站重分配-MQ] 🏭 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
      
      // 依序處理每個電表
      for (const meter of station.meters) {
        try {
          // 獲取該電表下的充電桩
          const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
          const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
          
          if (meterCpids.length === 0) {
            logger.info(`[全站重分配-MQ] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 沒有關聯的充電桩，跳過`);
            continue;
          }
          
          // 過濾出在線的充電桩
          const onlineCpids = await connectionService.getOnlineCpids();
          const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
          
          if (onlineMeterCpids.length === 0) {
            logger.info(`[全站重分配-MQ] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 下沒有在線充電桩，跳過`);
            continue;
          }
          
          logger.info(`[全站重分配-MQ] ⚡ 處理電表 ${meter.id} (${meter.meter_no})，包含 ${onlineMeterCpids.length} 個在線充電桩: [${onlineMeterCpids.join(', ')}]`);
          
          // 為該電表配置功率分配
          await configureStationPowerDistribution(onlineMeterCpids, {
            immediate,
            eventType: `${eventType || 'mq_event'}_MeterReallocation`,
            eventDetails: {
              ...(eventDetails || {}),
              meter_id: meter.id,
              station_id: station.id,
              station_name: station.name,
              meter_name: meter.meter_no,
              reallocationId,
              triggerEvent: eventType || 'mq_event'
            }
          });
          
          totalScheduledUpdates += onlineMeterCpids.length;
          totalProcessedMeters++;
          
          // 加入小延遲避免過於頻繁的處理
          if (!immediate) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
        } catch (meterError) {
          logger.error(`[全站重分配-MQ] ❌ 處理電表 ${meter.id} 時發生錯誤:`, meterError);
        }
      }
    }
    
    if (totalScheduledUpdates > 0) {
      logger.info(`[全站重分配-MQ] 📈 重分配统计:`);
      logger.info(`[全站重分配-MQ]   - 执行模式: ${executionMode} (事件驱动)`);
      logger.info(`[全站重分配-MQ]   - 處理站點: ${allStations.length} 個`);
      logger.info(`[全站重分配-MQ]   - 處理電表: ${totalProcessedMeters} 個`);
      logger.info(`[全站重分配-MQ]   - 排程更新: ${totalScheduledUpdates} 個充電桩`);
      
      // 发送通知
      await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'ems.notification', {
        type: 'GLOBAL_REALLOCATION',
        message: `所有站點電表功率重分配事件處理完成，共排程 ${totalScheduledUpdates} 個充電桩配置更新`,
        data: {
          reallocationId,
          eventType: eventType || 'mq_event',
          totalStations: allStations.length,
          totalMeters: totalProcessedMeters,
          scheduledCount: totalScheduledUpdates,
          executionMode: `${executionMode} (事件驱动)`,
          timestamp: new Date().toISOString()
        }
      });
      
      return true;
    } else {
      logger.warn(`[全站重分配-MQ] ⚠️ 沒有找到任何需要處理的在線充電桩`);
      
      // 发送通知
      await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'ems.notification', {
        type: 'GLOBAL_REALLOCATION_SKIP',
        message: `所有站點電表功率重分配事件跳過，沒有找到在線充電桩`,
        data: {
          reallocationId,
          eventType: eventType || 'mq_event',
          totalStations: allStations.length,
          totalMeters: totalProcessedMeters,
          scheduledCount: 0,
          timestamp: new Date().toISOString()
        }
      });
      
      return false;
    }
    
  } catch (error) {
    logger.error(`[全站重分配-MQ] ❌ 處理過程發生錯誤: ${error.message}`, error);
    
    // 发送错误通知
    await mqService.publishMessage(EXCHANGES.NOTIFICATION_EVENTS, 'ems.notification', {
      type: 'GLOBAL_REALLOCATION_ERROR',
      message: `所有站點電表功率重分配事件處理失敗: ${error.message}`,
      data: {
        reallocationId,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
    
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
    
    // 使用新函数配置站点功率分配，利用电表分组机制
    const result = await configureStationPowerDistribution(onlineCpids, {
      immediate: immediate,
      eventType: eventType,
      eventDetails: eventDetails
    });
    
    if (result.success) {
      logger.info(`[全站重分配] ✅ 站点功率配置成功 (ID: ${reallocationId})`);
      logger.info(`[全站重分配] 📈 重分配统计:`);
      logger.info(`[全站重分配]   - 执行模式: ${immediate ? '立即执行' : '延迟排程'}`);
      logger.info(`[全站重分配]   - 触发事件: ${eventType}`);
      logger.info(`[全站重分配]   - 电表总数: ${result.total_meters} 个`);
      logger.info(`[全站重分配]   - 在线充电桩: ${onlineCpids.length} 个`);
      logger.info(`[全站重分配]   - 排程更新: ${result.total_scheduled} 个`);
      
      // 延迟显示全站功率配置总览
      const totalDelay = (immediate ? 1000 : 2000) + (result.total_scheduled * (immediate ? 100 : 300));
      setTimeout(async () => {
        try {
          logger.info(`[全站重分配] 📊 显示重分配后的功率配置总览...`);
          
          // 获取所有电表和充电枪信息
          const allMeters = await getMetersAndGunsForStation();
          if (allMeters.length > 0) {
            const firstMeter = allMeters[0];
            const emsMode = firstMeter.ems_mode || 'static';
            const maxPower = firstMeter.max_power_kw ? parseFloat(firstMeter.max_power_kw) : 100;
            const stationId = firstMeter.station_id;
            
            logger.info(`[全站重分配] 使用电表配置: 模式=${emsMode}, 最大功率=${maxPower}kW, 站点ID=${stationId}`);
            await logCurrentPowerConfiguration(emsMode, maxPower, stationId);
            logger.info(`[全站重分配] 🎯 全站重分配完全完成 (ID: ${reallocationId})`);
          } else {
            logger.warn(`[全站重分配] ⚠️ 无法获取电表信息，跳过功率配置总览`);
          }
        } catch (error) {
          logger.error(`[全站重分配] ❌ 显示功率总览失败: ${error.message}`, error);
        }
      }, totalDelay);
      
      return true;
    } else {
      logger.error(`[全站重分配] ❌ 站点功率配置失败: ${result.message}`);
      return false;
    }
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
      // 设置默认值
      let siteSetting = {
        station_id: 0,
        station_name: 'Default Station',
        ems_mode: 'static',
        max_power_kw: 100
      };
      
      // 如果上下文中有传递siteSetting，则优先使用
      if (context.siteSetting) {
        siteSetting = {
          ...siteSetting,
          ...context.siteSetting
        };
        logger.debug(`${logPrefix} ${cpid} 使用上下文中的场域设置`);
      } else {
        // 获取充电枪信息
        const guns = await chargePointRepository.getAllGuns({ cpid });
        
        if (guns.length === 0) {
          logger.warn(`${logPrefix} 找不到充电桩 ${cpid} 的信息，无法下发配置`);
          return;
        }
        
        const gun = guns[0];
        
        // 获取该充电枪对应电表的配置
        const meter = await getMeterForGun(gun);
        
        if (meter) {
          logger.debug(`${logPrefix} ${cpid} 找到关联电表: ID=${meter.id}`);
          
          // 获取电表所属的站点信息
          const stations = await chargePointRepository.getStations();
          let station = null;
          
          if (stations && Array.isArray(stations)) {
            station = stations.find(s => s.meters && s.meters.some(m => m.id === meter.id));
          }
          
          siteSetting = {
            station_id: station ? station.id : 0,
            station_name: station ? station.name : 'Unknown Station',
            ems_mode: meter.ems_mode || 'static',
            max_power_kw: meter.max_power_kw || 100,
            meter_id: meter.id
          };
        } else {
          logger.warn(`${logPrefix} ${cpid} 未找到关联电表，使用默认值`);
        }
      }
      
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
        logger.info(`${logPrefix} 为 ${cpid} (${cpsn}:${connectorId}) 下发配置，电表ID: ${siteSetting.meter_id || '未知'}`);
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
          const emsMode = siteSetting.ems_mode || 'UNKNOWN';
          logger.info(`${emoji} [单桩更新] ${cpid} -> 类型:${gun.acdc} | 规格:${gun.max_kw}kW | 状态:${gun.guns_status} | EMS:${emsMode} | 电表ID:${siteSetting.meter_id || gun.meter_id || '未知'}`);
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
 * 已适配新的数据库结构（stations - meters - guns）并修复按电表分组计算
 * 
 * @param {string} emsMode EMS 模式 (static/dynamic)
 * @param {number} maxPowerKw 场域总功率限制
 * @param {number} stationId 站点ID，用于筛选特定站点的充电桩
 */
async function logCurrentPowerConfiguration(emsMode, maxPowerKw, stationId = null) {
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 【全站功率配置总览】');
    const formattedEmsMode = emsMode ? emsMode.toUpperCase() : 'UNKNOWN';
    const formattedMaxPower = maxPowerKw ? parseFloat(maxPowerKw) : 0;
    logger.info(`🔧 EMS模式: ${formattedEmsMode} | 💡 场域总功率: ${formattedMaxPower}kW`);
    logger.info('='.repeat(80));
    
    // 获取所有充电桩数据
    const allGuns = await chargePointRepository.getAllGuns({});
    const onlineCpids = await connectionService.getOnlineCpids();
    
    // 获取所有站点和电表信息
    const stations = await chargePointRepository.getStations();
    
    // 按电表分组进行EMS分配计算
    const combinedAllocation = [];
    let totalSystemPowerKw = 0;
    
    for (const station of stations) {
      if (!station.meters || !Array.isArray(station.meters)) continue;
      
      for (const meter of station.meters) {
        // 获取该电表下的充电枪
        const meterGuns = allGuns.filter(gun => gun.meter_id == meter.id);
        const meterOnlineCpids = onlineCpids.filter(cpid => {
          const gun = meterGuns.find(g => g.cpid === cpid);
          return gun !== undefined;
        });
        
        if (meterGuns.length === 0) continue;
        
        // 为该电表创建独立的配置
        const meterSiteSetting = {
          ems_mode: meter.ems_mode || 'static',
          max_power_kw: meter.max_power_kw || 100,
          station_id: station.id,
          station_name: station.name,
          meter_id: meter.id
        };
        
        // 执行该电表的EMS分配算法
        const meterResult = calculateEmsAllocation(meterSiteSetting, meterGuns, meterOnlineCpids);
        
        // 合并结果
        combinedAllocation.push(...meterResult.allocations);
        totalSystemPowerKw += meterResult.summary.total_allocated_kw;
        
        logger.info(`📋 电表 ${meter.id} (${meter.meter_no}): ${meterResult.summary.total_allocated_kw.toFixed(2)}kW / ${meter.max_power_kw}kW`);
      }
    }
    
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
        
        // 从按电表分组的EMS分配结果获取配置值
        const gunAllocation = combinedAllocation.find(a => a.cpid === gun.cpid);
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
        
        // 显示电表信息
        const meterInfo = gun.meter_id ? `[M${gun.meter_id}]` : '[M?]';
        logger.info(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedCurrentA.toString().padStart(3)}A | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 规格:${maxKw}kW ${meterInfo}`);
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
        
        // 从按电表分组的EMS分配结果获取配置值
        const gunAllocation = combinedAllocation.find(a => a.cpid === gun.cpid);
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
        
        // 显示电表信息
        const meterInfo = gun.meter_id ? `[M${gun.meter_id}]` : '[M?]';
        logger.info(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedPowerW.toString().padStart(6)}W | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 规格:${maxKw}kW ${meterInfo}`);
      });
      
      logger.info(`  ⚡ DC总计: ${totalDcPowerW}W | ${totalDcPowerKw.toFixed(2)}kW`);
      logger.info('-'.repeat(80));
    }
    
    // 功率使用统计 - 使用按电表分组计算的总和
    const totalUsedPower = totalSystemPowerKw;
    const powerUtilization = formattedMaxPower > 0 ? ((totalUsedPower / formattedMaxPower) * 100).toFixed(1) : '0.0';
    
    logger.info(`📊 功率使用统计:`);
    logger.info(`  💡 系统配置总功率: ${formattedMaxPower}kW (输入参考值)`);
    logger.info(`  ⚡ 按电表分组计算功率: ${totalUsedPower.toFixed(2)}kW`);
    logger.info(`  📈 功率使用率: ${powerUtilization}%`);
    logger.info(`  ⏰ 更新时间: ${new Date().toLocaleString('zh-TW')}`);
    logger.info('='.repeat(80));
    logger.info('📊 【功率配置总览完成】\n');
    
    return {
      allocations: combinedAllocation,
      summary: {
        total_allocated_kw: totalSystemPowerKw,
        total_available_kw: formattedMaxPower,
        utilization_percent: parseFloat(powerUtilization)
      }
    };
    
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
  
  logger.info(`[EMS] 初始化定时功率校正机制（按電表分組），间隔: ${RECONCILE_INTERVAL_MS/1000} 秒`);
  
  reconciliationIntervalId = setInterval(async () => {
    try {
      // logger.info('='.repeat(60));
      // logger.info('[reconciliation] 🔄 开始定时功率配置校正（按電表分組）');
      // logger.info(`[reconciliation] ⏰ 校正间隔: ${RECONCILE_INTERVAL_MS/1000} 秒`);
      
      // 獲取所有站點和電表
      const allStations = await chargePointRepository.getStations();
      
      if (!allStations || allStations.length === 0) {
        // logger.info('[reconciliation] ⚠️ 沒有找到任何站點，跳過此次校正');
        // logger.info('='.repeat(60));
        return;
      }
      
      // logger.info(`[reconciliation] � 找到 ${allStations.length} 個站點`);
      
      let totalProcessedMeters = 0;
      let totalScheduledUpdates = 0;
      
      // 依序處理每個站點下的所有電表
      for (const station of allStations) {
        if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
          // logger.info(`[reconciliation] ⚠️ 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
          continue;
        }
        
        // logger.info(`[reconciliation] 🏭 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
        
        // 依序處理每個電表
        for (const meter of station.meters) {
          try {
            // 獲取該電表下的充電桩
            const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
            const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
            
            if (meterCpids.length === 0) {
              // logger.info(`[reconciliation] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 沒有關聯的充電桩，跳過`);
              continue;
            }
            
            // 過濾出在線的充電桩
            const onlineCpids = await connectionService.getOnlineCpids();
            const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
            
            if (onlineMeterCpids.length === 0) {
              // logger.info(`[reconciliation] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 下沒有在線充電桩，跳過`);
              continue;
            }
            
            // logger.info(`[reconciliation] ⚡ 校正電表 ${meter.id} (${meter.meter_no})，包含 ${onlineMeterCpids.length} 個在線充電桩: [${onlineMeterCpids.join(', ')}]`);
            
            // 為該電表下的每個充電桩排程更新，使用隨機延遲
            for (let i = 0; i < onlineMeterCpids.length; i++) {
              const cpid = onlineMeterCpids[i];
              // 使用随机延迟避免同时下发，分散服务器负载
              const delay = Math.random() * 5000 + (i * 200);  // 0-5秒随机延迟 + 序列延迟
              
              scheduleProfileUpdate(cpid, delay, {
                isReconciliation: true,
                meter_id: meter.id,
                station_id: station.id,
                reconciliationTime: new Date().toISOString()
              });
              
              // logger.debug(`[reconciliation] ✅ 排程更新 ${cpid} (電表 ${meter.id})，延迟 ${Math.round(delay)}ms`);
              totalScheduledUpdates++;
            }
            
            totalProcessedMeters++;
            
            // 加入小延遲避免過於頻繁的處理
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (meterError) {
            // logger.error(`[reconciliation] ❌ 處理電表 ${meter.id} 時發生錯誤:`, meterError);
          }
        }
      }
      
      // logger.info(`[reconciliation] 📈 校正统计:`);
      // logger.info(`[reconciliation]   - 掃描站點: ${allStations.length} 個`);
      // logger.info(`[reconciliation]   - 處理電表: ${totalProcessedMeters} 個`);
      // logger.info(`[reconciliation]   - 排程更新: ${totalScheduledUpdates} 個充電桩`);
      // logger.info(`[reconciliation] ✨ 定时校正完成，下次校正将在 ${RECONCILE_INTERVAL_MS/1000} 秒后执行`);
      // logger.info('='.repeat(60));
      
      // 如果有排程更新，延迟显示全站功率配置总览
      if (totalScheduledUpdates > 0) {
        const totalDelay = Math.max(5000, totalScheduledUpdates * 300); // 至少等待5秒
        // logger.debug(`[reconciliation] 📊 将在 ${totalDelay}ms 后显示全站功率配置总览`);
        
        setTimeout(async () => {
          try {
            // 使用第一個電表的配置作為參考
            const firstStation = allStations.find(s => s.meters && s.meters.length > 0);
            if (firstStation && firstStation.meters[0]) {
              const firstMeter = firstStation.meters[0];
              const emsMode = firstMeter.ems_mode || 'static';
              const maxPower = firstMeter.max_power_kw ? parseFloat(firstMeter.max_power_kw) : 100;
              // await logCurrentPowerConfiguration(emsMode, maxPower, firstStation.id);
            } else {
              logger.warn('❌ [reconciliation] 未找到可用的電表配置，使用默認值');
              await logCurrentPowerConfiguration('static', 100, null);
            }
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

/**
 * 根据充电枪获取对应的电表信息
 * @param {Object} gun 充电枪对象
 * @returns {Promise<Object|null>} 电表信息
 */
async function getMeterForGun(gun) {
  try {
    if (!gun) {
      logger.warn(`无法获取电表: 缺少充电枪数据`);
      return null;
    }

    // 懒加载数据库服务
    if (!databaseService) {
      const { loadDatabaseModules } = require('../repositories/chargePointRepository');
      const modules = await loadDatabaseModules();
      databaseService = modules.databaseService;
    }

    // 直接通过充电枪的meter_id关系获取电表
    if (gun.meter_id) {
      try {
        const meter = await databaseService.getMeterById(gun.meter_id);
        if (meter) {
          logger.debug(`成功获取充电枪 ${gun.cpid || '未知'} 对应的电表: ID=${meter.id}`);
          return meter;
        } else {
          logger.warn(`未找到电表ID ${gun.meter_id} 的信息，尝试通过其他方式查找`);
        }
      } catch (err) {
        logger.warn(`获取电表ID ${gun.meter_id} 失败: ${err.message}，尝试其他方式查找`);
      }
    } else {
      logger.warn(`充电枪 ${gun.cpid || '未知'} 没有关联电表ID，尝试通过站点关系查找`);
    }
    
    // 如果直接获取失败或没有meter_id，尝试通过站点->电表->充电枪关系查找
    try {
      const stations = await chargePointRepository.getStations();
      if (!stations || !Array.isArray(stations) || stations.length === 0) {
        logger.warn(`未找到任何站点信息`);
        return null;
      }
      
      // 遍历所有站点
      for (const station of stations) {
        if (!station.meters || !Array.isArray(station.meters)) continue;
        
        // 遍历站点下所有电表
        for (const meter of station.meters) {
          // 检查该电表是否关联了此充电枪
          if (meter.guns && Array.isArray(meter.guns)) {
            const matchedGun = meter.guns.find(g => g.cpid === gun.cpid || g.id === gun.id);
            if (matchedGun) {
              logger.info(`通过关系查找到充电枪 ${gun.cpid || gun.id || '未知'} 对应的电表: ID=${meter.id}`);
              return meter;
            }
          }
        }
      }
      
      // 如果还没找到，使用第一个站点的第一个电表作为默认
      if (stations[0] && stations[0].meters && stations[0].meters.length > 0) {
        logger.warn(`未找到充电枪 ${gun.cpid || '未知'} 关联的电表，使用默认电表`);
        return stations[0].meters[0];
      }
    } catch (err) {
      logger.error(`通过关系查找电表失败: ${err.message}`);
    }
    
    logger.error(`无法为充电枪 ${gun.cpid || '未知'} 找到任何关联电表`);
    return null;
  } catch (error) {
    logger.error(`获取电表信息失败: ${error.message}`, error);
    return null;
  }
}

/**
 * 获取站点下所有电表及其关联的充电枪
 * @param {number|string|null} stationId 可选的站点ID，不提供则获取所有站点
 * @returns {Promise<Array>} 包含电表和充电枪信息的数组
 */
async function getMetersAndGunsForStation(stationId = null) {
  try {
    // 获取所有站点信息
    let stations = await chargePointRepository.getStations();
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      logger.warn(`未找到任何站点信息，尝试创建默认站点`);
      // 由于chargePointRepository.getStations已内置创建默认站点的逻辑，重新获取站点信息
      const newStations = await chargePointRepository.getStations();
      if (!newStations || !Array.isArray(newStations) || newStations.length === 0) {
        logger.error(`尝试创建默认站点后仍无法获取站点信息`);
        return [];
      }
      logger.info(`成功创建默认站点，共 ${newStations.length} 个站点`);
      // 使用新创建的站点继续处理
      stations = newStations;
    }
    
    // 过滤指定站点或使用所有站点
    let targetStations = stations;
    if (stationId) {
      targetStations = stations.filter(station => station.id === parseInt(stationId));
      if (targetStations.length === 0) {
        logger.warn(`未找到ID为${stationId}的站点`);
        return [];
      }
    }
    
    // 收集所有电表及其关联的充电枪
    let result = [];
    for (const station of targetStations) {
      if (!station.meters || !Array.isArray(station.meters)) continue;
      
      for (const meter of station.meters) {
        // 复制电表信息，添加站点信息
        const meterInfo = {
          ...meter,
          station_id: station.id,
          station_name: station.name,
          station_code: station.station_code,
          guns: []
        };
        
        // 获取电表关联的充电枪
        if (meter.guns && Array.isArray(meter.guns)) {
          meterInfo.guns = meter.guns;
        } else {
          // 如果电表没有预加载的充电枪信息，则查询数据库
          try {
            if (!databaseService) {
              const { loadDatabaseModules } = require('../repositories/chargePointRepository');
              const modules = await loadDatabaseModules();
              databaseService = modules.databaseService;
            }
            
            const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
            meterInfo.guns = gunsForMeter || [];
            logger.debug(`为电表ID=${meter.id}查询到${meterInfo.guns.length}个充电枪`);
          } catch (err) {
            logger.error(`查询电表ID=${meter.id}的充电枪失败: ${err.message}`);
            meterInfo.guns = [];
          }
        }
        
        result.push(meterInfo);
      }
    }
    
    logger.info(`共获取${result.length}个电表信息，包含充电枪${result.reduce((sum, meter) => sum + meter.guns.length, 0)}个`);
    return result;
  } catch (error) {
    logger.error(`获取站点电表及充电枪失败: ${error.message}`, error);
    return [];
  }
}

/**
 * 基于站点->电表->充电枪关系进行功率配置下发
 * @param {Array} cpids 充电桩ID列表
 * @param {Object} options 配置选项
 * @returns {Promise<Object>} 处理结果
 */
async function configureStationPowerDistribution(cpids, options = {}) {
  const { immediate = false, eventType = 'manual', eventDetails = {} } = options;
  const operationId = `${eventType}_${Date.now()}`;
  logger.info(`[站点功率配置] 🌐 开始站点功率配置 (ID: ${operationId})`);
  
  try {
    // 1. 验证输入
    if (!cpids || !Array.isArray(cpids) || cpids.length === 0) {
      logger.warn(`[站点功率配置] ⚠️ 没有提供充电桩ID列表`);
      return { success: false, message: '没有提供充电桩ID列表' };
    }
    
    // 2. 获取所有站点的电表和充电枪信息
    const allMetersWithGuns = await getMetersAndGunsForStation();
    if (allMetersWithGuns.length === 0) {
      logger.warn(`[站点功率配置] ⚠️ 未找到任何电表信息`);
      return { success: false, message: '未找到任何电表信息' };
    }
    
    // 3. 为每个电表分组充电桩
    const meterGroups = new Map(); // 电表ID -> 关联的充电桩IDs
    
    // 先创建所有电表分组
    allMetersWithGuns.forEach(meter => {
      meterGroups.set(meter.id, {
        meter,
        cpids: []
      });
    });
    
    // 遍历所有请求的充电桩，找到它们所属的电表
    for (const cpid of cpids) {
      // 获取充电桩信息
      const guns = await chargePointRepository.getAllGuns({ cpid });
      if (guns.length === 0) {
        logger.warn(`[站点功率配置] ⚠️ 未找到充电桩 ${cpid} 的信息`);
        continue;
      }
      
      const gun = guns[0];
      
      // 如果充电枪有明确的meter_id关联
      if (gun.meter_id) {
        if (meterGroups.has(gun.meter_id)) {
          meterGroups.get(gun.meter_id).cpids.push(cpid);
          logger.debug(`[站点功率配置] 充电桩 ${cpid} 分配给电表 ${gun.meter_id}`);
        } else {
          logger.warn(`[站点功率配置] ⚠️ 充电桩 ${cpid} 关联的电表ID ${gun.meter_id} 不存在`);
        }
        continue;
      }
      
      // 如果没有明确关联，通过关系查找
      let meterFound = false;
      for (const [meterId, group] of meterGroups.entries()) {
        const gunInMeter = group.meter.guns?.find(g => g.cpid === cpid);
        if (gunInMeter) {
          group.cpids.push(cpid);
          logger.debug(`[站点功率配置] 充电桩 ${cpid} 通过关系查找分配给电表 ${meterId}`);
          meterFound = true;
          break;
        }
      }
      
      if (!meterFound) {
        // 如果没找到关联电表，使用第一个电表
        const firstMeterId = meterGroups.keys().next().value;
        if (firstMeterId) {
          meterGroups.get(firstMeterId).cpids.push(cpid);
          logger.warn(`[站点功率配置] ⚠️ 充电桩 ${cpid} 没有明确关联电表，分配给默认电表 ${firstMeterId}`);
        } else {
          logger.error(`[站点功率配置] ❌ 无法为充电桩 ${cpid} 分配电表`);
        }
      }
    }
    
    // 4. 对每个电表分组执行功率配置
    const results = [];
    for (const [meterId, group] of meterGroups.entries()) {
      if (group.cpids.length === 0) continue; // 跳过没有关联充电桩的电表
      
      const meter = group.meter;
      const meterCpids = group.cpids;
      
      logger.info(`[站点功率配置] 🔌 电表 ${meterId} (${meter.station_name || '未知站点'}) 配置 ${meterCpids.length} 个充电桩`);
      
      // 为该电表下的充电桩创建单独的siteSetting
      const siteSetting = {
        station_id: meter.station_id,
        station_name: meter.station_name,
        ems_mode: meter.ems_mode || 'static',
        max_power_kw: meter.max_power_kw || 100,
        meter_id: meterId
      };
      
      // 批量排程所有充电桩的配置更新
      const baseDelay = immediate ? 0 : 1000;
      const intervalDelay = immediate ? 100 : 500;
      
      let scheduledCount = 0;
      for (let i = 0; i < meterCpids.length; i++) {
        const cpid = meterCpids[i];
        const delay = baseDelay + (i * intervalDelay);
        
        await scheduleProfileUpdate(cpid, delay, {
          isGlobalReallocation: true,
          isManualTrigger: immediate,
          reallocationId: operationId,
          triggerEvent: eventType,
          triggerDetails: {
            ...eventDetails,
            meter_id: meterId,
            station_id: meter.station_id
          },
          siteSetting // 传递特定电表的配置
        });
        
        scheduledCount++;
      }
      
      results.push({
        meter_id: meterId,
        station_id: meter.station_id,
        station_name: meter.station_name,
        ems_mode: meter.ems_mode,
        max_power_kw: meter.max_power_kw,
        cpids: meterCpids,
        scheduled: scheduledCount
      });
    }
    
    // 5. 总结结果
    const totalScheduled = results.reduce((sum, r) => sum + r.scheduled, 0);
    logger.info(`[站点功率配置] ✅ 完成配置: ${results.length}个电表, ${totalScheduled}个充电桩`);
    
    return {
      success: true,
      operation_id: operationId,
      total_meters: results.length,
      total_scheduled: totalScheduled,
      details: results
    };
  } catch (error) {
    logger.error(`[站点功率配置] ❌ 处理失败: ${error.message}`, error);
    return {
      success: false,
      message: error.message,
      operation_id: operationId
    };
  }
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
  initReconciliationInterval,
  getMeterForGun,
  getMetersAndGunsForStation,
  configureStationPowerDistribution
};
