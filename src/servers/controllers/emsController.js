/**
 * EMS控制器
 * 处理能源管理系统(Energy Management System)相关接口和逻辑
 */

const logger = require('../utils/logger');
const connectionService = require('../services/connectionService');
const chargePointRepository = require('../repositories/chargePointRepository');
const ocppMessageService = require('../services/ocppMessageService');
const emsService = require('../services/emsService');
const { calculateEmsAllocation } = require('../../lib/emsAllocator');
const { generateUniqueId } = require('../utils/helpers');

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
    logger.info(`[全站重分配] 🌐 开始全站功率重新分配 (ID: ${reallocationId})`);
    logger.info(`[全站重分配] 📋 触发事件: ${eventType}`);
    logger.info(`[全站重分配] 📊 事件详情: ${JSON.stringify(eventDetails)}`);
    
    try {
        // 1. 获取当前所有在线充电桩
        logger.debug(`[全站重分配] 🔍 获取所有在线充电桩...`);
        const onlineCpids = await connectionService.getOnlineCpids();
        
        if (onlineCpids.length === 0) {
            logger.info(`[全站重分配] ⚠️ 没有在线充电桩，跳过重新分配`);
            return;
        }
        
        logger.info(`[全站重分配] 📊 找到 ${onlineCpids.length} 个在线充电桩: [${onlineCpids.join(', ')}]`);
        
        // 2. 获取场域设置
        const siteSetting = await chargePointRepository.getSiteSettings();
        logger.info(`[全站重分配] ⚙️ 场域设置: EMS模式=${siteSetting.ems_mode}, 最大功率=${siteSetting.max_power_kw}kW`);
        
        // 3. 清除所有现有的功率配置定时器，避免冲突
        logger.debug(`[全站重分配] 🧹 清除现有功率配置定时器...`);
        if (emsService.clearAllProfileUpdateTimers) {
            // 如果emsService提供了清除所有定时器的方法，优先使用
            emsService.clearAllProfileUpdateTimers();
        }
        
        // 4. 使用事件驱动系统发布全站重新分配事件
        const executionMode = immediate ? '立即执行' : '延迟排程';
        logger.info(`[全站重分配] 🚀 通过事件系统开始批量${executionMode}功率配置更新...`);
        
        // 发布全站重新分配事件到消息队列
        const publishSuccess = await emsService.publishGlobalReallocation({
            reallocationId,
            onlineCpids,
            siteSetting,
            executionMode,
            immediate,
            eventType,
            eventDetails,
            timestamp: new Date().toISOString()
        });
        
        if (publishSuccess) {
            logger.info(`[全站重分配] 📤 全站重新分配事件已发布到消息队列 (ID: ${reallocationId})`);
        } else {
            logger.warn(`[全站重分配] ⚠️ 发布全站重新分配事件失败，降级为直接处理模式`);
            
            // 消息发布失败，降级为直接处理模式
            let scheduledCount = 0;
            const baseDelay = immediate ? 0 : 1000; // 手动触发时无延迟，自动触发时基础延迟 1 秒
            const intervalDelay = immediate ? 100 : 500; // 手动触发时间隔较短
            
            for (let i = 0; i < onlineCpids.length; i++) {
                const cpid = onlineCpids[i];
                const delay = baseDelay + (i * intervalDelay);
                
                if (immediate) {
                    logger.debug(`[全站重分配-降级] ⚡ 立即执行 ${cpid} 功率配置更新，间隔 ${delay}ms`);
                } else {
                    logger.debug(`[全站重分配-降级] ⚡ 排程 ${cpid} 功率配置更新，延迟 ${delay}ms`);
                }
                
                // 使用特殊标记表示这是全站重新分配
                await emsService.scheduleProfileUpdate(cpid, delay, {
                    isGlobalReallocation: true,
                    isManualTrigger: immediate,
                    reallocationId: reallocationId,
                    triggerEvent: eventType,
                    triggerDetails: eventDetails
                });
                
                scheduledCount++;
            }
            
            logger.info(`[全站重分配-降级] 📈 重分配统计:`);
            logger.info(`[全站重分配-降级]   - 执行模式: ${executionMode} (降级模式)`);
            logger.info(`[全站重分配-降级]   - 在线充电桩: ${onlineCpids.length} 个`);
            logger.info(`[全站重分配-降级]   - 排程更新: ${scheduledCount} 个`);
        }
        
        // 5. 无论使用哪种模式，都延迟显示全站功率配置总览
        const estimatedDelay = onlineCpids.length * (immediate ? 100 : 500) + (immediate ? 1000 : 2000);
        setTimeout(async () => {
            try {
                logger.info(`[全站重分配] 📊 显示重分配后的功率配置总览...`);
                await emsService.logCurrentPowerConfiguration(siteSetting.ems_mode, parseFloat(siteSetting.max_power_kw));
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
 * 基于OCPP事件分析充电状态变化，并触发相应的功率调整
 * @param {string} action OCPP事件类型
 * @param {Object} payload 事件载荷
 * @param {string} cpsn 充电站序列号
 * @param {number} connectorId 连接器ID
 */
async function processOcppEvent(action, payload, cpsn, connectorId) {
    logger.info(`[OCPP事件处理] 处理 ${cpsn}:${connectorId} 的 ${action} 事件`);
    
    try {

        const chargingChange = emsService.detectChargingStatusChange(action, payload);
        
        if (chargingChange !== null) {
            // 充电状态变化，需要触发功率重分配
            logger.info(`[OCPP事件处理] 📋 检测到 ${cpsn}:${connectorId} 充电状态变化: ${chargingChange ? '开始充电/可用' : '停止充电'}`);
            
            // 触发全站功率重新分配
            await scheduleGlobalPowerReallocation(action, {
                cpsn,
                connectorId,
                payload,
                chargingChange,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.debug(`[OCPP事件处理] ${action} 事件不需要触发功率重分配`);
        }
    } catch (error) {
        logger.error(`[OCPP事件处理] 处理 ${action} 事件失败: ${error.message}`, error);
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
        const { cpid, siteSettings } = options;
        logger.info(`[calculateEmsPowerAllocation] 计算充电桩 ${cpid} 的功率分配`);
        
        // 获取场域设置
        const siteSetting = siteSettings || await chargePointRepository.getSiteSettings();
        const emsMode = siteSetting?.ems_mode || 'dynamic';
        const maxPowerKw = parseFloat(siteSetting?.max_power_kw || 50);
        
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
        logger.info('🚀 [trigger_profile_update] 收到手动触发全站功率配置更新请求');
        logger.info(`[trigger_profile_update] 📅 触发时间: ${new Date().toISOString()}`);
        logger.info(`[trigger_profile_update] 🖥️ 请求来源IP: ${req.ip || req.connection.remoteAddress}`);
        
        // 解析请求体以获取额外信息
        const requestData = req.body || {};
        logger.info(`[trigger_profile_update] 📊 请求数据: ${JSON.stringify(requestData)}`);
        
        // 使用全站功率重新分配系统（立即执行模式）
        logger.info('[trigger_profile_update] 🔄 使用全站功率重新分配系统（立即执行模式）...');
        
        // 触发全站重新分配（立即执行，非阻塞）
        scheduleGlobalPowerReallocation('ManualTrigger', {
            source: requestData.source || 'manual-api-trigger',
            userAgent: requestData.userAgent || req.headers['user-agent'],
            clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
            timestamp: requestData.timestamp || new Date().toISOString(),
            triggerAPI: '/ocpp/api/trigger_profile_update'
        }, true); // 第三个参数 immediate = true
        
        // 获取当前在线充电桩清单以回传统计信息
        const onlineCpids = await connectionService.getOnlineCpids();
        logger.info(`[trigger_profile_update] 📊 在线充电桩统计: ${onlineCpids.length} 个`);
        
        if (onlineCpids.length === 0) {
            logger.info('[trigger_profile_update] ⚠️ 目前无在线充电桩，无需更新');
            return res.json({
                success: true,
                message: '目前无在线充电桩，无需进行功率配置更新',
                onlineStations: 0,
                scheduledUpdates: 0,
                timestamp: new Date().toISOString(),
                method: 'global-reallocation-immediate'
            });
        }
        
        // 回传成功响应（不等待实际完成）
        const response = {
            success: true,
            message: `已立即触发全站功率重新分配，涵盖 ${onlineCpids.length} 个在线充电桩`,
            onlineStations: onlineCpids.length,
            scheduledUpdates: onlineCpids.length, // 每个在线充电桩都会被更新
            estimatedCompletionTime: `${Math.ceil((onlineCpids.length * 0.1) + 1)} 秒`, // 立即执行，完成时间较短
            timestamp: new Date().toISOString(),
            method: 'global-reallocation-immediate',
            trigger: {
                source: requestData.source || 'manual-api-trigger',
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

// 暴露模块API
module.exports = {
    scheduleGlobalPowerReallocation,
    processOcppEvent,
    calculateEmsPowerAllocation,
    trigger_profile_update,
    get_power_allocation,
    initializeEmsSystem
};
