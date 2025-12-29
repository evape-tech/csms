/**
 * EMS控制器
 * 处理能源管理系统(Energy Management System)相关接口和逻辑
 */

import { logger, generateUniqueId } from '../utils/index.js';
import { connectionService, ocppMessageService, emsService } from '../services/index.js';
import { chargePointRepository } from '../repositories/index.js';
import { calculateEmsAllocation } from '../../lib/index.js';

/**
 * 全站功率重新分配调度器
 * 当系统状态发生变化时，重新计算并分配所有在线充电桩的功率
 * 使用事件驱动的方式进行重新分配
 * @param {string} eventType 触发事件类型
 * @param {object} eventDetails 事件详细信息
 * @param {boolean} immediate 是否立即执行（手动触发时为 true）
 */
async function scheduleGlobalPowerReallocation(eventType, eventDetails = {}, immediate = false) {
    const reallocationId = `${eventType}_${Date.now()}`;
    logger.info(`[全站重分配] 🌐 开始所有站點電表功率重新分配 (ID: ${reallocationId})`);
    logger.info(`[全站重分配] 📋 触发事件: ${eventType}`);
    logger.info(`[全站重分配] 📊 事件详情: ${JSON.stringify(eventDetails)}`);
    
    try {
        // 1. 獲取所有站點和電表
        logger.debug(`[全站重分配] 🔍 獲取所有站點和電表...`);
        const allStations = await chargePointRepository.getStations();
        
        if (!allStations || allStations.length === 0) {
            logger.info(`[全站重分配] ⚠️ 沒有找到任何站點，跳過重新分配`);
            return;
        }
        
        logger.info(`[全站重分配] 📊 找到 ${allStations.length} 個站點`);
        
        // 2. 清除所有现有的功率配置定时器，避免冲突
        logger.debug(`[全站重分配] 🧹 清除现有功率配置定时器...`);
    if (emsService.clearAllProfileUpdateTimers) {
        emsService.clearAllProfileUpdateTimers();
    }
    const executionMode = immediate ? '立即执行' : '延迟排程';
        
        logger.info(`[全站重分配] 🚀 開始批量${executionMode}所有站點電表的功率配置更新...`);
        
        for (const station of allStations) {
            if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
                logger.info(`[全站重分配] ⚠️ 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
                continue;
            }
            
            logger.info(`[全站重分配] 🏭 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
            
            // 依序處理每個電表
            for (const meter of station.meters) {
                try {
                    // 獲取該電表下的充電桩
                    const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
                    const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
                    
                    if (meterCpids.length === 0) {
                        logger.info(`[全站重分配] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 沒有關聯的充電桩，跳過`);
                        continue;
                    }
                    
                    // 過濾出在線的充電桩
                    const onlineCpids = await connectionService.getOnlineCpids();
                    const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
                    
                    if (onlineMeterCpids.length === 0) {
                        logger.info(`[全站重分配] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 下沒有在線充電桩，跳過`);
                        continue;
                    }
                    
                    logger.info(`[全站重分配] ⚡ 處理電表 ${meter.id} (${meter.meter_no})，包含 ${onlineMeterCpids.length} 個在線充電桩: [${onlineMeterCpids.join(', ')}]`);
                    
                    // 為該電表配置功率分配
                    await emsService.configureStationPowerDistribution(onlineMeterCpids, {
                        immediate,
                        eventType: `${eventType}_MeterReallocation`,
                        eventDetails: {
                            ...eventDetails,
                            meter_id: meter.id,
                            station_id: station.id,
                            station_name: station.name,
                            meter_name: meter.meter_no,
                            reallocationId,
                            triggerEvent: eventType
                        }
                    });
                    
                    totalScheduledUpdates += onlineMeterCpids.length;
                    totalProcessedMeters++;
                    
                    // 加入小延遲避免過於頻繁的處理
                    if (!immediate) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    
                } catch (meterError) {
                    logger.error(`[全站重分配] ❌ 處理電表 ${meter.id} 時發生錯誤:`, meterError);
                }
            }
        }
        
        logger.info(`[全站重分配] 📈 重分配统计:`);
        logger.info(`[全站重分配]   - 执行模式: ${executionMode}`);
        logger.info(`[全站重分配]   - 處理站點: ${allStations.length} 個`);
        logger.info(`[全站重分配]   - 處理電表: ${totalProcessedMeters} 個`);
        logger.info(`[全站重分配]   - 排程更新: ${totalScheduledUpdates} 個充電桩`);
        
        // 4. 延迟显示全站功率配置总览
        const estimatedDelay = totalScheduledUpdates * (immediate ? 100 : 300) + (immediate ? 1000 : 2000);
        setTimeout(async () => {
            try {
                logger.info(`[全站重分配] 📊 显示重分配后的功率配置总览...`);
                // 顯示第一個電表的配置作為參考
                const firstStation = allStations.find(s => s.meters && s.meters.length > 0);
                if (firstStation && firstStation.meters[0]) {
                    const firstMeter = firstStation.meters[0];
                    await emsService.logCurrentPowerConfiguration(
                        firstMeter.ems_mode || 'static', 
                        parseFloat(firstMeter.max_power_kw) || 100
                    );
                }
                logger.info(`[全站重分配] 🎯 全站重分配完全完成 (ID: ${reallocationId})`);
            } catch (error) {
                logger.error(`[全站重分配] ❌ 显示功率总览失败: ${error.message}`, error);
            }
        }, estimatedDelay);
        
    } catch (error) {
        logger.error(`[全站重分配] ❌ 全站功率重新分配失败 (ID: ${reallocationId}): ${error.message}`, error);
    }
}

/**
 * 特定電表功率重新分配调度器
 * 當特定充電樁狀態發生變化時，只重新計算並分配該電表下的充電樁功率
 * @param {number} meterId 電表ID
 * @param {string} eventType 触发事件类型
 * @param {object} eventDetails 事件详细信息
 * @param {boolean} immediate 是否立即执行（事件驱动时为 true）
 */
async function scheduleSpecificMeterPowerReallocation(meterId, eventType, eventDetails = {}, immediate = true) {
    const reallocationId = `${eventType}_meter_${meterId}_${Date.now()}`;
    logger.info(`[电表重分配] 🎯 开始电表 ${meterId} 的功率重新分配 (ID: ${reallocationId})`);
    logger.info(`[电表重分配] 📋 触发事件: ${eventType}`);
    logger.info(`[电表重分配] 📊 事件详情: ${JSON.stringify(eventDetails)}`);
    
    try {
        // 1. 獲取指定電表的信息
        const stations = await chargePointRepository.getStations();
        let targetMeter = null;
        let targetStation = null;
        
        for (const station of stations) {
            if (station.meters && Array.isArray(station.meters)) {
                const foundMeter = station.meters.find(meter => meter.id == meterId);
                if (foundMeter) {
                    targetMeter = foundMeter;
                    targetStation = station;
                    break;
                }
            }
        }
        
        if (!targetMeter) {
            logger.warn(`[电表重分配] ⚠️ 找不到电表 ID: ${meterId}`);
            return;
        }
        
        logger.info(`[电表重分配] 🎯 找到目标电表: ${targetMeter.meter_no} (ID: ${targetMeter.id})，归属站点: ${targetStation.name} (ID: ${targetStation.id})`);
        
        // 2. 獲取該電表下的所有充電樁
        const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meterId });
        const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
        
        if (meterCpids.length === 0) {
            logger.info(`[电表重分配] ⚠️ 电表 ${meterId} 下没有关联的充电桩，跳过重新分配`);
            return;
        }
        
        // 3. 檢查在線狀態
        const onlineCpids = await connectionService.getOnlineCpids();
        const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
        
        logger.info(`[电表重分配] 📊 电表统计:`);
        logger.info(`[电表重分配]   - 电表下充电桩总数: ${meterCpids.length}`);
        logger.info(`[电表重分配]   - 在线充电桩数量: ${onlineMeterCpids.length}`);
        logger.info(`[电表重分配]   - 在线充电桩列表: [${onlineMeterCpids.join(', ')}]`);
        
        if (onlineMeterCpids.length === 0) {
            logger.info(`[电表重分配] ⚠️ 电表 ${meterId} 下没有在线充电桩，无需进行功率重新分配`);
            return;
        }
        
        // 4. 執行該電表的功率配置更新
        logger.info(`[电表重分配] 🚀 开始执行电表 ${meterId} 的功率重新分配...`);
        
        await emsService.configureStationPowerDistribution(onlineMeterCpids, {
            immediate,
            eventType: `${eventType}_MeterEventDriven`,
            eventDetails: {
                ...eventDetails,
                meter_id: meterId,
                station_id: targetStation.id,
                station_name: targetStation.name,
                meter_name: targetMeter.meter_no,
                reallocationId,
                triggerEvent: eventType,
                scope: 'meter-level'
            }
        });
        
        logger.info(`[电表重分配] 📈 电表重分配统计:`);
        logger.info(`[电表重分配]   - 执行模式: ${immediate ? '立即执行' : '延迟排程'}`);
        logger.info(`[电表重分配]   - 目标电表: ${targetMeter.meter_no} (ID: ${meterId})`);
        logger.info(`[电表重分配]   - 排程更新: ${onlineMeterCpids.length} 个充電桩`);
        
        // 5. 延迟显示电表功率配置总览
        const estimatedDelay = onlineMeterCpids.length * (immediate ? 100 : 300) + (immediate ? 500 : 1000);
        setTimeout(async () => {
            try {
                logger.info(`[电表重分配] 📊 显示电表 ${meterId} 重分配后的功率配置总览...`);
                await emsService.logCurrentPowerConfiguration(
                    targetMeter.ems_mode || 'static', 
                    parseFloat(targetMeter.max_power_kw) || 100,
                    targetStation.id
                );
                logger.info(`[电表重分配] 🎯 电表 ${meterId} 重分配完全完成 (ID: ${reallocationId})`);
            } catch (error) {
                logger.error(`[电表重分配] ❌ 显示功率总览失败: ${error.message}`, error);
            }
        }, estimatedDelay);
        
    } catch (error) {
        logger.error(`[电表重分配] ❌ 电表 ${meterId} 功率重新分配失败 (ID: ${reallocationId}): ${error.message}`, error);
    }
}

/**
 * 基于OCPP事件分析充电状态变化，并触发相应的電表級功率调整
 * @param {string} action OCPP事件类型
 * @param {Object} payload 事件载荷
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 */
async function processOcppEvent(action, payload, cpsn, connectorId) {
    logger.info(`[OCPP事件处理-电表级] 处理 ${cpsn}:${connectorId} 的 ${action} 事件`);
    
    try {
        const chargingChange = emsService.detectChargingStatusChange(action, payload);
        
        if (chargingChange !== null) {
            // 充电状态变化，需要触发電表級功率重分配
            logger.info(`[OCPP事件处理-电表级] 📋 检测到 ${cpsn}:${connectorId} 充电状态变化: ${chargingChange ? '开始充电/可用' : '停止充电'}`);
            
            // 檢查是否有電表信息
            if (payload.meter_id) {
                logger.info(`[OCPP事件处理-电表级] 🎯 触发电表 ${payload.meter_id} (${payload.meter_no}) 的功率重分配`);
                
                // 觸發特定電表的功率重新分配
                await scheduleSpecificMeterPowerReallocation(payload.meter_id, action, {
                    cpsn,
                    connectorId,
                    payload,
                    chargingChange,
                    meter_id: payload.meter_id,
                    station_id: payload.station_id,
                    timestamp: new Date().toISOString()
                });
            } else {
                // 如果沒有電表信息，回退到全站重分配
                logger.warn(`[OCPP事件处理-电表级] ⚠️ 事件中缺少电表信息，回退到全站重分配`);
                await scheduleGlobalPowerReallocation(action, {
                    cpsn,
                    connectorId,
                    payload,
                    chargingChange,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            logger.debug(`[OCPP事件处理-电表级] ${action} 事件不需要触发功率重分配`);
        }
    } catch (error) {
        logger.error(`[OCPP事件处理-电表级] 处理 ${action} 事件失败: ${error.message}`, error);
    }
}

/**
 * 执行EMS分配计算，返回充电桩的功率分配结果
 * 可用于直接计算或API调用
 * @param {Object} options 计算选项
 * @returns {Object} EMS分配结果
 */
async function calculateEmsPowerAllocation(options) {
    try {
        const { cpid, stations } = options;
        logger.info(`[calculateEmsPowerAllocation] 计算充电桩 ${cpid} 的功率分配`);
        
        // 获取场域设置
        const station = stations || await chargePointRepository.getStations();
        const emsMode = station?.ems_mode || 'dynamic';
        const maxPowerKw = parseFloat(station?.max_power_kw || 50);

        // 获取所有充电桩
        const allGuns = await chargePointRepository.getAllGuns({});
        const onlineCpids = await connectionService.getOnlineCpids();
        
        // 执行EMS分配计算
        const result = calculateEmsAllocation({ ems_mode: emsMode, max_power_kw: maxPowerKw }, allGuns, onlineCpids);
        
        // 如果指定了cpid，返回特定充电桩的分配结果
        if (cpid) {
            const gunAllocation = result.allocations.find(a => a.cpid === cpid);
            
            if (gunAllocation) {
                logger.info(`[calculateEmsPowerAllocation] ${cpid} 分配结果: ${gunAllocation.limit}${gunAllocation.unit} (${gunAllocation.allocated_kw.toFixed(2)}kW)`);
                return {
                    success: true,
                    allocation: gunAllocation,
                    summary: result.summary
                };
            } else {
                logger.warn(`[calculateEmsPowerAllocation] 找不到充电桩 ${cpid} 的分配结果`);
                return {
                    success: false,
                    message: `找不到充电桩 ${cpid} 的分配结果`
                };
            }
        }
        
        // 返回所有分配结果
        logger.info(`[calculateEmsPowerAllocation] 计算完成，共 ${result.allocations.length} 个分配结果`);
        return {
            success: true,
            allocations: result.allocations,
            summary: result.summary
        };
    } catch (error) {
        logger.error(`[calculateEmsPowerAllocation] 计算功率分配失败: ${error.message}`, error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * 手动触发全站功率配置更新
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_profile_update(req, res) {
    try {
        logger.info('🚀 [trigger_profile_update] 收到手动触发功率配置更新请求');
        logger.info(`[trigger_profile_update] 📅 触发时间: ${new Date().toISOString()}`);
        logger.info(`[trigger_profile_update] 🖥️ 请求来源IP: ${req.ip || req.connection.remoteAddress}`);
        
        // 解析请求体以获取额外信息
        const requestData = req.body || {};
        logger.info(`[trigger_profile_update] 📊 请求数据: ${JSON.stringify(requestData)}`);
        
        // 檢查是否有指定特定電表
        const affectedCpids = requestData.affected_cpids;
        const meterId = requestData.meter_id;
        const stationId = requestData.station_id;
        
        let totalScheduledUpdates = 0;
        let updateScope = 'all-stations-meters';
        let allStations = []; // 在外部作用域聲明
        
        if (affectedCpids && Array.isArray(affectedCpids) && affectedCpids.length > 0 && meterId) {
            // 如果指定了特定的電表和充電桩列表，只更新這個電表
            updateScope = `meter-${meterId}`;
            logger.info(`[trigger_profile_update] 🎯 目標更新模式：特定電表 ${meterId} 下的 ${affectedCpids.length} 個充電桩: [${affectedCpids.join(', ')}]`);
            
            // 執行針對特定電表的更新
            logger.info(`[trigger_profile_update] 🔄 執行電表 ${meterId} 的功率配置更新...`);
            
            const configResult = await emsService.configureStationPowerDistribution(affectedCpids, {
                immediate: true,
                eventType: 'MeterSettingsChanged',
                eventDetails: {
                    source: requestData.source || 'meter-settings-api-trigger',
                    meter_id: meterId,
                    station_id: stationId,
                    updated_settings: requestData.updated_settings || {},
                    userAgent: requestData.userAgent || req.headers['user-agent'],
                    clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
                    timestamp: requestData.timestamp || new Date().toISOString(),
                    triggerAPI: '/ocpp/api/v1/trigger_profile_update'
                }
            });
            
            totalScheduledUpdates = affectedCpids.length;
            logger.info(`[trigger_profile_update] ✅ 電表 ${meterId} 功率配置更新完成，影響 ${totalScheduledUpdates} 個充電桩`);
            
        } else {
            // 沒有指定特定電表，依序處理所有 stations 下的所有 meters
            logger.info('[trigger_profile_update] 🌐 執行所有站點電表的功率配置更新...');
            
            // 獲取所有站點和電表
            allStations = await chargePointRepository.getStations();
            logger.info(`[trigger_profile_update] 📊 找到 ${allStations.length} 個站點`);
            
            if (!allStations || allStations.length === 0) {
                logger.info('[trigger_profile_update] ⚠️ 沒有找到任何站點，無需更新');
                return res.json({
                    success: true,
                    message: '沒有找到任何站點，無需進行功率配置更新',
                    onlineStations: 0,
                    scheduledUpdates: 0,
                    timestamp: new Date().toISOString(),
                    updateScope,
                    method: 'all-stations-meters-update'
                });
            }
            
            let processedMeters = 0;
            
            // 依序處理每個站點下的所有電表
            for (const station of allStations) {
                if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
                    logger.info(`[trigger_profile_update] ⚠️ 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
                    continue;
                }
                
                logger.info(`[trigger_profile_update] 🏭 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
                
                // 依序處理每個電表
                for (const meter of station.meters) {
                    try {
                        // 獲取該電表下的充電桩
                        const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
                        const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
                        
                        if (meterCpids.length === 0) {
                            logger.info(`[trigger_profile_update] ⚠️ 電表 ${meter.id} (${meter.meter_no}) 沒有關聯的充電桩，跳過`);
                            continue;
                        }
                        
                        logger.info(`[trigger_profile_update] ⚡ 處理電表 ${meter.id} (${meter.meter_no})，包含 ${meterCpids.length} 個充電桩: [${meterCpids.join(', ')}]`);
                        
                        // 為該電表配置功率分配
                        await emsService.configureStationPowerDistribution(meterCpids, {
                            immediate: true,
                            eventType: 'AllStationsMetersUpdate',
                            eventDetails: {
                                source: requestData.source || 'all-stations-api-trigger',
                                meter_id: meter.id,
                                station_id: station.id,
                                station_name: station.name,
                                meter_name: meter.meter_no,
                                userAgent: requestData.userAgent || req.headers['user-agent'],
                                clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
                                timestamp: requestData.timestamp || new Date().toISOString(),
                                triggerAPI: '/ocpp/api/v1/trigger_profile_update'
                            }
                        });
                        
                        totalScheduledUpdates += meterCpids.length;
                        processedMeters++;
                        
                        // 加入小延遲避免過於頻繁的處理
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (meterError) {
                        logger.error(`[trigger_profile_update] ❌ 處理電表 ${meter.id} 時發生錯誤:`, meterError);
                    }
                }
            }
            
            logger.info(`[trigger_profile_update] ✅ 所有站點電表處理完成，共處理 ${processedMeters} 個電表，影響 ${totalScheduledUpdates} 個充電桩`);
            
            // 在此作用域定義 allStations 變數供後續使用
            updateScope = 'all-stations-meters';
        }
        
        
        // 回传成功响应
        const response = {
            success: true,
            message: updateScope.startsWith('meter-') 
                ? `已觸發電表 ${meterId} 下 ${totalScheduledUpdates} 個充電桩的功率配置更新`
                : `已完成所有站點電表的功率配置更新，共影響 ${totalScheduledUpdates} 個充電桩`,
            onlineStations: updateScope.startsWith('meter-') ? 1 : allStations?.length || 0,
            scheduledUpdates: totalScheduledUpdates,
            updateScope,
            targetCpids: updateScope.startsWith('meter-') ? affectedCpids : undefined,
            meterId: updateScope.startsWith('meter-') ? meterId : undefined,
            estimatedCompletionTime: `${Math.ceil((totalScheduledUpdates * 0.1) + 1)} 秒`,
            timestamp: new Date().toISOString(),
            method: updateScope.startsWith('meter-') ? 'targeted-meter-update' : 'all-stations-meters-update',
            trigger: {
                source: requestData.source || (updateScope.startsWith('meter-') ? 'meter-settings-api-trigger' : 'all-stations-api-trigger'),
                userAgent: requestData.userAgent || req.headers['user-agent'],
                clientIP: requestData.clientIP || req.ip
            }
        };
        
        logger.info(`[trigger_profile_update] ✅ 手动触发完成，回传结果: ${JSON.stringify(response)}`);
        res.json(response);
        
    } catch (error) {
        logger.error('❌ [trigger_profile_update] 手动触发过程中发生错误:', error);
        
        // 回传错误响应
        res.status(500).json({
            success: false,
            message: '触发功率配置更新失败',
            error: error.message,
            timestamp: new Date().toISOString(),
            method: 'global-reallocation'
        });
    }
}

/**
 * 获取当前电力分配情况API
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function get_power_allocation(req, res) {
    try {
        logger.info('[get_power_allocation] 收到获取当前电力分配情况请求');
        
        // 获取请求参数
        const { cpid } = req.query;
        
        // 执行EMS分配计算
        const result = await calculateEmsPowerAllocation({ cpid });
        
        if (result.success) {
            res.json({
                success: true,
                data: cpid ? result.allocation : result.allocations,
                summary: result.summary,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                message: result.message,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error('[get_power_allocation] 获取电力分配情况失败:', error);
        res.status(500).json({
            success: false,
            message: '获取电力分配情况失败',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 手动触发特定电表功率重新分配
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_meter_reallocation(req, res) {
    try {
        logger.info('🔄 [trigger_meter_reallocation] 收到手动触发电表功率重新分配请求');
        logger.info(`[trigger_meter_reallocation] 📅 触发时间: ${new Date().toISOString()}`);
        logger.info(`[trigger_meter_reallocation] 🖥️ 请求来源IP: ${req.ip || req.connection.remoteAddress}`);
        
        // 解析请求体
        const requestData = req.body || {};
        const { meter_id, source = 'meter-manual-api-trigger' } = requestData;
        
        logger.info(`[trigger_meter_reallocation] 📊 请求数据: ${JSON.stringify(requestData)}`);
        
        if (!meter_id) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: meter_id',
                timestamp: new Date().toISOString()
            });
        }
        
        // 获取指定电表的信息
        const stations = await chargePointRepository.getStations();
        let targetMeter = null;
        let targetStation = null;
        
        for (const station of stations) {
            if (station.meters && Array.isArray(station.meters)) {
                const foundMeter = station.meters.find(meter => meter.id == meter_id);
                if (foundMeter) {
                    targetMeter = foundMeter;
                    targetStation = station;
                    break;
                }
            }
        }
        
        if (!targetMeter) {
            return res.status(404).json({
                success: false,
                message: `找不到电表 ID: ${meter_id}`,
                timestamp: new Date().toISOString()
            });
        }
        
        logger.info(`[trigger_meter_reallocation] 🎯 找到目标电表: ${targetMeter.meter_no} (ID: ${targetMeter.id})，归属站点: ${targetStation.name} (ID: ${targetStation.id})`);
        
        // 获取该电表下的所有充电桩
        const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter_id });
        const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
        
        if (meterCpids.length === 0) {
            return res.status(404).json({
                success: false,
                message: `电表 ${meter_id} 下没有关联的充电桩`,
                timestamp: new Date().toISOString()
            });
        }
        
        // 检查在线状态
        const onlineCpids = await connectionService.getOnlineCpids();
        const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
        
        logger.info(`[trigger_meter_reallocation] 📊 电表统计:`);
        logger.info(`[trigger_meter_reallocation]   - 电表下充电桩总数: ${meterCpids.length}`);
        logger.info(`[trigger_meter_reallocation]   - 在线充电桩数量: ${onlineMeterCpids.length}`);
        logger.info(`[trigger_meter_reallocation]   - 在线充电桩列表: [${onlineMeterCpids.join(', ')}]`);
        
        if (onlineMeterCpids.length === 0) {
            return res.json({
                success: true,
                message: `电表 ${meter_id} 下没有在线充电桩，无需进行功率重新分配`,
                onlineStations: 0,
                scheduledUpdates: 0,
                meterId: meter_id,
                timestamp: new Date().toISOString(),
                method: 'meter-reallocation'
            });
        }
        
        // 执行电表级功率重新分配
        logger.info(`[trigger_meter_reallocation] 🚀 开始执行电表 ${meter_id} 的功率重新分配...`);
        
        await emsService.configureStationPowerDistribution(onlineMeterCpids, {
            immediate: true,
            eventType: 'MeterManualReallocation',
            eventDetails: {
                source: source,
                meter_id: meter_id,
                station_id: targetStation.id,
                station_name: targetStation.name,
                meter_name: targetMeter.meter_no,
                userAgent: requestData.userAgent || req.headers['user-agent'],
                clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
                timestamp: requestData.timestamp || new Date().toISOString(),
                triggerAPI: '/ocpp/api/v1/trigger_meter_reallocation'
            }
        });
        
        // 回传成功响应
        const response = {
            success: true,
            message: `已成功触发电表 ${meter_id} (${targetMeter.meter_no}) 的功率重新分配`,
            onlineStations: 1,
            scheduledUpdates: onlineMeterCpids.length,
            meterId: meter_id,
            meterName: targetMeter.meter_no,
            stationId: targetStation.id,
            stationName: targetStation.name,
            targetType: 'meter',
            targetId: meter_id,
            affectedCpids: onlineMeterCpids,
            estimatedCompletionTime: `${Math.ceil((onlineMeterCpids.length * 0.1) + 1)} 秒`,
            timestamp: new Date().toISOString(),
            method: 'meter-reallocation',
            trigger: {
                source: source,
                userAgent: requestData.userAgent || req.headers['user-agent'],
                clientIP: requestData.clientIP || req.ip
            }
        };
        
        logger.info(`[trigger_meter_reallocation] ✅ 电表功率重新分配完成，回传结果: ${JSON.stringify(response)}`);
        res.json(response);
        
    } catch (error) {
        logger.error('❌ [trigger_meter_reallocation] 触发电表功率重新分配过程中发生错误:', error);
        
        res.status(500).json({
            success: false,
            message: '触发电表功率重新分配失败',
            error: error.message,
            timestamp: new Date().toISOString(),
            method: 'meter-reallocation'
        });
    }
}

/**
 * 手动触发特定站点功率重新分配
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function trigger_station_reallocation(req, res) {
    try {
        logger.info('🏢 [trigger_station_reallocation] 收到手动触发站点功率重新分配请求');
        logger.info(`[trigger_station_reallocation] 📅 触发时间: ${new Date().toISOString()}`);
        logger.info(`[trigger_station_reallocation] 🖥️ 请求来源IP: ${req.ip || req.connection.remoteAddress}`);
        
        // 解析请求体
        const requestData = req.body || {};
        const { station_id, source = 'station-manual-api-trigger' } = requestData;
        
        logger.info(`[trigger_station_reallocation] 📊 请求数据: ${JSON.stringify(requestData)}`);
        
        if (!station_id) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: station_id',
                timestamp: new Date().toISOString()
            });
        }
        
        // 获取指定站点的信息
        const stations = await chargePointRepository.getStations();
        const targetStation = stations.find(station => station.id == station_id);
        
        if (!targetStation) {
            return res.status(404).json({
                success: false,
                message: `找不到站点 ID: ${station_id}`,
                timestamp: new Date().toISOString()
            });
        }
        
        logger.info(`[trigger_station_reallocation] 🎯 找到目标站点: ${targetStation.name} (ID: ${targetStation.id})`);
        
        if (!targetStation.meters || !Array.isArray(targetStation.meters) || targetStation.meters.length === 0) {
            return res.status(404).json({
                success: false,
                message: `站点 ${station_id} 下没有电表`,
                timestamp: new Date().toISOString()
            });
        }
        
        logger.info(`[trigger_station_reallocation] 📊 站点包含 ${targetStation.meters.length} 个电表`);
        
        // 收集该站点下所有电表的充电桩
        let totalScheduledUpdates = 0;
        let processedMeters = 0;
        const allStationCpids = [];
        
        for (const meter of targetStation.meters) {
            try {
                // 获取该电表下的充电桩
                const gunsForMeter = await chargePointRepository.getAllGuns({ meter_id: meter.id });
                const meterCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
                
                if (meterCpids.length === 0) {
                    logger.info(`[trigger_station_reallocation] ⚠️ 电表 ${meter.id} (${meter.meter_no}) 没有关联的充电桩，跳过`);
                    continue;
                }
                
                // 检查在线状态
                const onlineCpids = await connectionService.getOnlineCpids();
                const onlineMeterCpids = meterCpids.filter(cpid => onlineCpids.includes(cpid));
                
                if (onlineMeterCpids.length === 0) {
                    logger.info(`[trigger_station_reallocation] ⚠️ 电表 ${meter.id} (${meter.meter_no}) 下没有在线充电桩，跳过`);
                    continue;
                }
                
                logger.info(`[trigger_station_reallocation] ⚡ 处理电表 ${meter.id} (${meter.meter_no})，包含 ${onlineMeterCpids.length} 个在线充电桩: [${onlineMeterCpids.join(', ')}]`);
                
                // 为该电表配置功率分配
                await emsService.configureStationPowerDistribution(onlineMeterCpids, {
                    immediate: true,
                    eventType: 'StationManualReallocation',
                    eventDetails: {
                        source: source,
                        station_id: station_id,
                        station_name: targetStation.name,
                        meter_id: meter.id,
                        meter_name: meter.meter_no,
                        userAgent: requestData.userAgent || req.headers['user-agent'],
                        clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
                        timestamp: requestData.timestamp || new Date().toISOString(),
                        triggerAPI: '/ocpp/api/v1/trigger_station_reallocation'
                    }
                });
                
                totalScheduledUpdates += onlineMeterCpids.length;
                allStationCpids.push(...onlineMeterCpids);
                processedMeters++;
                
                // 加入小延迟避免过于频繁的处理
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (meterError) {
                logger.error(`[trigger_station_reallocation] ❌ 处理电表 ${meter.id} 时发生错误:`, meterError);
            }
        }
        
        if (totalScheduledUpdates === 0) {
            return res.json({
                success: true,
                message: `站点 ${station_id} 下没有在线充电桩，无需进行功率重新分配`,
                onlineStations: 0,
                scheduledUpdates: 0,
                stationId: station_id,
                timestamp: new Date().toISOString(),
                method: 'station-reallocation'
            });
        }
        
        // 回传成功响应
        const response = {
            success: true,
            message: `已成功触发站点 ${station_id} (${targetStation.name}) 的功率重新分配`,
            onlineStations: 1,
            scheduledUpdates: totalScheduledUpdates,
            processedMeters: processedMeters,
            stationId: station_id,
            stationName: targetStation.name,
            targetType: 'station',
            targetId: station_id,
            affectedCpids: allStationCpids,
            estimatedCompletionTime: `${Math.ceil((totalScheduledUpdates * 0.1) + 1)} 秒`,
            timestamp: new Date().toISOString(),
            method: 'station-reallocation',
            trigger: {
                source: source,
                userAgent: requestData.userAgent || req.headers['user-agent'],
                clientIP: requestData.clientIP || req.ip
            }
        };
        
        logger.info(`[trigger_station_reallocation] ✅ 站点功率重新分配完成，回传结果: ${JSON.stringify(response)}`);
        res.json(response);
        
    } catch (error) {
        logger.error('❌ [trigger_station_reallocation] 触发站点功率重新分配过程中发生错误:', error);
        
        res.status(500).json({
            success: false,
            message: '触发站点功率重新分配失败',
            error: error.message,
            timestamp: new Date().toISOString(),
            method: 'station-reallocation'
        });
    }
}

/**
 * 初始化EMS系统
 * 启动必要的后台任务和监控
 */
function initializeEmsSystem() {
    try {
        logger.info('[initializeEmsSystem] 初始化EMS系统...');
        
        // 启动定时功率校正机制
        emsService.initReconciliationInterval();
        
        // 注册OCPP事件处理器，解决循环依赖问题
        if (ocppMessageService.registerOcppEventHandler) {
            ocppMessageService.registerOcppEventHandler(processOcppEvent);
            logger.info('[initializeEmsSystem] 已注册OCPP事件处理器');
        } else {
            logger.warn('[initializeEmsSystem] ocppMessageService.registerOcppEventHandler未定义，无法注册事件处理器');
        }
        
        logger.info('[initializeEmsSystem] EMS系统初始化完成');
    } catch (error) {
        logger.error(`[initializeEmsSystem] EMS系统初始化失败: ${error.message}`, error);
    }
}

// 暴露模块API (ESM)
export {
    scheduleGlobalPowerReallocation,
    scheduleSpecificMeterPowerReallocation,
    processOcppEvent,
    calculateEmsPowerAllocation,
    trigger_profile_update,
    trigger_meter_reallocation,
    trigger_station_reallocation,
    get_power_allocation,
    initializeEmsSystem
};
