/**
 * 连接服务
 * 管理WebSocket连接和充电站状态
 */

import { logger } from '../utils/index.js';
import { chargePointRepository } from '../repositories/index.js';

// WebSocket客户端池
const wsClients = {};

// 充电桩数据缓存
const wsCpdatas = {};

/**
 * 注册连接
 * @param {string} cpsn 充电站序列号
 * @param {Object} ws WebSocket实例
 * @returns {Promise<void>}
 */
async function registerConnection(cpsn, ws) {
  logger.info(`充电站 ${cpsn} 建立连接`);
  
  // 初始化连接池
  if (!wsClients[cpsn]) {
    wsClients[cpsn] = [];
  }
  
  // 添加到连接池
  wsClients[cpsn].push(ws);
  
  // 更新充电站状态为在线
  await updateStationOnlineStatus(cpsn);
  
  return wsClients[cpsn];
}

/**
 * 移除连接
 * @param {string} cpsn 充电站序列号
 * @param {Object} ws WebSocket实例
 * @returns {Promise<void>}
 */
async function removeConnection(cpsn, ws) {
  logger.info(`🔌 充电站 ${cpsn} 断开连接 (WebSocket 断开事件)`);
  
  if (wsClients[cpsn]) {
    // 从连接池中移除指定的 WebSocket 实例
    const index = wsClients[cpsn].indexOf(ws);
    if (index !== -1) {
      wsClients[cpsn].splice(index, 1);
      logger.info(`✅ 成功从连接池中移除 ${cpsn} 的 WebSocket 连接，索引: ${index}`);
    } else {
      logger.warn(`⚠️  未在连接池中找到 ${cpsn} 的 WebSocket 实例`);
    }
    
    // 清理无效连接（readyState 不是 OPEN 的连接）
    const originalLength = wsClients[cpsn].length;
    wsClients[cpsn] = wsClients[cpsn].filter(client => 
      client.readyState === client.OPEN
    );
    const cleanedLength = wsClients[cpsn].length;
    
    if (originalLength !== cleanedLength) {
      logger.info(`🧹 清理了 ${originalLength - cleanedLength} 个无效连接`);
    }
    
    logger.info(`📊 ${cpsn} 当前剩余连接数: ${wsClients[cpsn].length}`);
    
    // 如果没有更多有效连接，更新状态为离线
    if (wsClients[cpsn].length === 0) {
      logger.info(`🔴 ${cpsn} 没有剩余连接，开始更新为离线状态`);
      await updateStationOfflineStatus(cpsn);
      
      // 清理 WebSocket 数据缓存
      if (wsCpdatas[cpsn]) {
        logger.debug(`🧹 清理 ${cpsn} 的 WebSocket 数据缓存`);
        // 保留数据结构但标记为离线
        if (wsCpdatas[cpsn][0]) {
          wsCpdatas[cpsn][0].cp_online = "offline";
        }
      }
    } else {
      logger.info(`🟡 ${cpsn} 仍有其他连接存在，保持在线状态`);
    }
  } else {
    logger.warn(`❌ 连接池中未找到 ${cpsn} 的记录`);
  }
}

/**
 * 初始化充电站数据结构
 * @param {string} cpsn 充电站序列号
 * @returns {Promise<Object>} 创建的数据结构
 */
async function initializeStationData(cpsn) {
  logger.info(`初始化充电站 ${cpsn} 数据结构`);
  
  try {
    // 查询充电桩CPID映射
    const guns1 = await chargePointRepository.getAllGuns({ cpsn, connector: "1" });
    const guns2 = await chargePointRepository.getAllGuns({ cpsn, connector: "2" });
    const guns3 = await chargePointRepository.getAllGuns({ cpsn, connector: "3" });
    const guns4 = await chargePointRepository.getAllGuns({ cpsn, connector: "4" });
    
    const cpidMapping1 = guns1.length > 0 ? guns1[0].cpid : "";
    const cpidMapping2 = guns2.length > 0 ? guns2[0].cpid : "";
    const cpidMapping3 = guns3.length > 0 ? guns3[0].cpid : "";
    const cpidMapping4 = guns4.length > 0 ? guns4[0].cpid : "";
    
    // 初始化数据结构
    if (!wsCpdatas[cpsn]) {
      wsCpdatas[cpsn] = [];
    }
    
    const socketCpData = {
      cpsn: cpsn,
      cp_online: "online",
      cp_vendor: "",
      cp_model: "",
      memo1: "",
      memo2: "",
      heartbeat: "",
      
      connector_1_meter: {
        cpid_mapping: cpidMapping1,
        current_status: "",
        charging_start_time: "",
        charging_stop_time: "",
        last_total_time: "",
        last_kwh: "",
        data1: "0.00",
        data2: "0.00",
        data3: "0.00",
        data4: "0.00",
        data5: "0.00",
        data6: "0.00"
      },
      connector_2_meter: {
        cpid_mapping: cpidMapping2,
        current_status: "",
        charging_start_time: "",
        charging_stop_time: "",
        last_total_time: "",
        last_kwh: "",
        data1: "0.00",
        data2: "0.00",
        data3: "0.00",
        data4: "0.00",
        data5: "0.00",
        data6: "0.00"
      },
      connector_3_meter: {
        cpid_mapping: cpidMapping3,
        current_status: "",
        charging_start_time: "",
        charging_stop_time: "",
        last_total_time: "",
        last_kwh: "",
        data1: "0.00",
        data2: "0.00",
        data3: "0.00",
        data4: "0.00",
        data5: "0.00",
        data6: "0.00"
      },
      connector_4_meter: {
        cpid_mapping: cpidMapping4,
        current_status: "",
        charging_start_time: "",
        charging_stop_time: "",
        last_total_time: "",
        last_kwh: "",
        data1: "0.00",
        data2: "0.00",
        data3: "0.00",
        data4: "0.00",
        data5: "0.00",
        data6: "0.00"
      }
    };
    
    wsCpdatas[cpsn].push(socketCpData);
    logger.info(`充电站 ${cpsn} 数据结构初始化完成`);
    
    return socketCpData;
  } catch (error) {
    logger.error(`初始化充电站 ${cpsn} 数据结构失败`, error);
    throw error;
  }
}

/**
 * 更新充电站在线状态
 * @param {string} cpsn 充电站序列号
 * @returns {Promise<Array>} 查找到的充电桩列表
 */
async function updateStationOnlineStatus(cpsn) {
  try {
    logger.info(`充电站 ${cpsn} WebSocket 连接建立`);
    
    // 查找该充电站下的所有充电桩
    const guns = await chargePointRepository.getAllGuns({ cpsn });
    
    if (guns.length === 0) {
      logger.warn(`未找到充电站 ${cpsn} 的充电桩记录`);
      return [];
    }
    
    logger.info(`充电站 ${cpsn} 共有 ${guns.length} 个充电桩连接器`);
    
    // 记录每个充电桩的连接建立事件（不改变状态）
    for (const gun of guns) {
      logger.info(`CPID:${gun.cpid} | 连接器:${gun.connector} | 状态: ${gun.guns_status} -> Available`);
    }
    
    logger.info(`充电站 ${cpsn} 已上线，等待接收 StatusNotification 更新实际状态`);
    
    return guns;
  } catch (error) {
    logger.error(`处理充电站 ${cpsn} 上线状态失败`, error);
    throw error;
  }
}

/**
 * 更新充电站离线状态
 * @param {string} cpsn 充电站序列号
 * @returns {Promise<Array>} 更新的充电桩列表
 */
async function updateStationOfflineStatus(cpsn) {
  try {
    logger.info(`🔴 开始更新充电站 ${cpsn} 离线状态`);
    
    // 查找该充电站下的所有充电桩
    const guns = await chargePointRepository.getAllGuns({ cpsn });
    
    if (guns.length === 0) {
      logger.warn(`❌ 未找到充电站 ${cpsn} 的充电桩记录`);
      return [];
    }
    
    logger.info(`📋 找到 ${guns.length} 个充电桩需要更新状态`);
    
    // 记录更新前的状态
    guns.forEach(gun => {
      logger.info(`📝 更新前 - CPID:${gun.cpid} | 连接器:${gun.connector} | 当前状态: ${gun.guns_status}`);
    });
    
    // 批量更新所有充电桩状态为 Unavailable (离线)
    const updateResult = await chargePointRepository.updateGunStatus(
      { cpsn },
      'Unavailable'
    );
    
    logger.info(`✅ 成功更新 ${updateResult[0]} 个充电桩状态为 Unavailable`);
    
    // 重新查询验证更新结果
    const updatedGuns = await chargePointRepository.getAllGuns({ cpsn });
    updatedGuns.forEach(gun => {
      logger.info(`🔍 更新后 - CPID:${gun.cpid} | 连接器:${gun.connector} | 新状态: ${gun.guns_status}`);
    });
    
    return updatedGuns;
  } catch (error) {
    logger.error(`❌ 更新充电站 ${cpsn} 离线状态失败`, error);
    throw error;
  }
}

/**
 * 获取在线的充电桩ID列表
 * @returns {Promise<Array>} 充电桩ID列表
 */
async function getOnlineCpids() {
  try {
    logger.debug('检查在线充电桩...');
    
    // 获取在线的 CPSN（设备序号）
    const onlineCSPNs = Object.keys(wsClients).filter(
      k => Array.isArray(wsClients[k]) && wsClients[k].length > 0
    );
    
    logger.debug(`找到 ${onlineCSPNs.length} 个在线设备序号 (CPSN): [${onlineCSPNs.join(', ')}]`);
    
    // 调试信息：显示每个 CPSN 的连接数
    for (const cpsn of Object.keys(wsClients)) {
      const connections = wsClients[cpsn] || [];
      const validConnections = connections.filter(ws => ws.readyState === ws.OPEN);
      logger.debug(`CPSN ${cpsn}: 总连接数=${connections.length}, 有效连接数=${validConnections.length}`);
    }
    
    if (onlineCSPNs.length === 0) {
      // logger.info('没有在线的充电站');
      return [];
    }
    
    // 收集所有在线 CPSN 对应的所有 CPID
    const allOnlineCpids = [];
    
    for (const cpsn of onlineCSPNs) {
      logger.debug(`查询 CPSN ${cpsn} 的所有 connector...`);
      
      // 查询该 CPSN 下的所有充电桩（所有 connector）
      const guns = await chargePointRepository.getAllGuns({ cpsn });
      
      logger.debug(`CPSN ${cpsn} 找到 ${guns.length} 个 connector:`);
      
      for (const gun of guns) {
        logger.debug(`CPID: ${gun.cpid}, Connector: ${gun.connector}, 状态: ${gun.guns_status}`);
        allOnlineCpids.push(gun.cpid);
      }
      
      if (guns.length === 0) {
        logger.warn(`CPSN ${cpsn} 在数据库中找不到对应记录`);
      }
    }
    
    // 去除重复的 CPID（虽然通常不会重复）
    const uniqueOnlineCpids = [...new Set(allOnlineCpids)];
    
    logger.info(`最终找到 ${uniqueOnlineCpids.length} 个在线 CPID: [${uniqueOnlineCpids.join(', ')}]`);
    
    return uniqueOnlineCpids;
  } catch (error) {
    logger.error('获取在线充电桩清单时发生错误', error);
    return [];
  }
}

/**
 * 从WebSocket数据中获取CPID
 * @param {string} cpsn 充电站序列号
 * @param {number} connector 连接器编号
 * @returns {string|null} CPID
 */
function getCpidFromWsData(cpsn, connector) {
  logger.debug(`查找 cpsn: ${cpsn}, connector: ${connector} 的 cpid 映射`);
  
  try {
    const wsData = wsCpdatas[cpsn] && wsCpdatas[cpsn][0];
    if (!wsData) {
      logger.debug(`找不到 ${cpsn} 的 WebSocket 数据`);
      return null;
    }
    
    let cpid = null;
    
    // 統一轉換為數字進行比較，支持字符串和數字類型的 connector
    const connectorNum = parseInt(connector);
    logger.debug(`connector 原值: ${connector} (類型: ${typeof connector}), 轉換後: ${connectorNum}`);
    
    if (connectorNum === 1) {
      cpid = wsData.connector_1_meter?.cpid_mapping;
    } else if (connectorNum === 2) {
      cpid = wsData.connector_2_meter?.cpid_mapping;
    } else if (connectorNum === 3) {
      cpid = wsData.connector_3_meter?.cpid_mapping;
    } else if (connectorNum === 4) {
      cpid = wsData.connector_4_meter?.cpid_mapping;
    } else {
      logger.warn(`不支持的 connector 编号: ${connector} (原值), ${connectorNum} (轉換後)`);
    }
    
    if (cpid) {
      logger.debug(`成功找到映射: ${cpsn}:${connector} -> ${cpid}`);
    } else {
      logger.debug(`未找到 ${cpsn}:${connector} 的 cpid 映射`);
      // 当前函数只负责查找，不主动创建映射
    }
    
    return cpid;
  } catch (error) {
    logger.error('获取 cpid 映射时发生错误', error);
    return null;
  }
}

/**
 * 取得充电站的主要 cpid
 * @param {string} cpsn 充电站序列号
 * @returns {string} 对应的 cpid，找不到则使用 cpsn 作为 fallback
 */
function getStationPrimaryCpid(cpsn) {
  logger.debug(`取得充电站 ${cpsn} 的主要 cpid`);
  
  // 优先尝试 connector 1
  let cpid = getCpidFromWsData(cpsn, 1);
  
  // 如果 connector 1 没有，尝试 connector 2
  if (!cpid) {
    logger.debug(`connector 1 没有 cpid，尝试 connector 2`);
    cpid = getCpidFromWsData(cpsn, 2);
  }
  
  // 如果都没有，使用 cpsn 作为 fallback
  if (!cpid) {
    logger.warn(`无法找到 ${cpsn} 的 cpid 映射，使用 cpsn 作为 fallback`);
    cpid = cpsn;
  }
  
  logger.debug(`${cpsn} 的主要 cpid: ${cpid}`);
  return cpid;
}

/**
 * 创建 CPID 映射
 * @param {string} cpsn 充电站序列号
 * @param {number} connector 连接器编号
 * @returns {Promise<string|null>} CPID
 */
async function cpidMapping(cpsn, connector) {
  logger.info(`开始为 ${cpsn}:${connector} 建立映射`);
  
  try {
    // 查询数据库
    const guns = await chargePointRepository.getAllGuns({ 
      cpsn: cpsn, 
      connector: String(connector) 
    });
    
    const gun = guns.length > 0 ? guns[0] : null;
    
    if (gun !== null) {
      logger.info(`找到 gun_cpid: ${gun.cpid} for ${cpsn}:${connector}`);
      
      // 确保 wsCpdatas 结构存在
      if (!wsCpdatas[cpsn] || !wsCpdatas[cpsn][0]) {
        logger.debug(`初始化 ${cpsn} 的 wsCpdatas 结构`);
        if (!wsCpdatas[cpsn]) wsCpdatas[cpsn] = [{}];
        if (!wsCpdatas[cpsn][0]) wsCpdatas[cpsn][0] = {};
      }
      
      // 更新映射
      if (connector === 1) {
        if (!wsCpdatas[cpsn][0].connector_1_meter) {
          wsCpdatas[cpsn][0].connector_1_meter = {};
        }
        wsCpdatas[cpsn][0].connector_1_meter.cpid_mapping = gun.cpid;
        logger.debug(`设置 connector 1 映射: ${gun.cpid}`);
      } else if (connector === 2) {
        if (!wsCpdatas[cpsn][0].connector_2_meter) {
          wsCpdatas[cpsn][0].connector_2_meter = {};
        }
        wsCpdatas[cpsn][0].connector_2_meter.cpid_mapping = gun.cpid;
        logger.debug(`设置 connector 2 映射: ${gun.cpid}`);
      } else if (connector === 3) {
        if (!wsCpdatas[cpsn][0].connector_3_meter) {
          wsCpdatas[cpsn][0].connector_3_meter = {};
        }
        wsCpdatas[cpsn][0].connector_3_meter.cpid_mapping = gun.cpid;
        logger.debug(`设置 connector 3 映射: ${gun.cpid}`);
      } else if (connector === 4) {
        if (!wsCpdatas[cpsn][0].connector_4_meter) {
          wsCpdatas[cpsn][0].connector_4_meter = {};
        }
        wsCpdatas[cpsn][0].connector_4_meter.cpid_mapping = gun.cpid;
        logger.debug(`设置 connector 4 映射: ${gun.cpid}`);
      }
      
      return gun.cpid;
    } else {
      logger.warn(`数据库中找不到 cpsn: ${cpsn}, connector: ${connector} 的记录!`);
      return null;
    }
  } catch (error) {
    logger.error(`为 ${cpsn}:${connector} 建立映射失败`, error);
    return null;
  }
}

/**
 * 发送命令到充电桩
 * @param {string} cpsn 充电站序列号
 * @param {Array|Object} command 命令内容
 * @returns {Promise<boolean>} 是否发送成功
 */
async function sendCommandToStation(cpsn, command) {
  try {
    const cmdStr = JSON.stringify(command);
    logger.debug(`向 ${cpsn} 发送命令: ${cmdStr}`);
    
    // 先记录到数据库
    try {
      const cpid = getStationPrimaryCpid(cpsn);
      await chargePointRepository.createCpLogEntry({
        cpid: cpid,
        cpsn: cpsn,
        log: cmdStr,
        time: new Date(),
        inout: "out",
      });
    } catch (logErr) {
      logger.error(`记录命令到数据库失败: ${logErr.message}`, logErr);
      // 即使日志记录失败，继续尝试发送命令
    }
    
    // 发送命令
    if (wsClients[cpsn] && wsClients[cpsn].length > 0) {
      wsClients[cpsn].forEach(client => {
        client.send(cmdStr);
      });
      return true;
    } else {
      logger.warn(`充电站 ${cpsn} 不在线，无法发送命令`);
      return false;
    }
  } catch (error) {
    logger.error(`向 ${cpsn} 发送命令失败`, error);
    return false;
  }
}

export {
  wsClients,
  wsCpdatas,
  registerConnection,
  removeConnection,
  initializeStationData,
  updateStationOnlineStatus,
  updateStationOfflineStatus,
  getOnlineCpids,
  getCpidFromWsData,
  getStationPrimaryCpid,
  cpidMapping,
  sendCommandToStation
};
