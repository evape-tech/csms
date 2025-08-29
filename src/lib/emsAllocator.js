/**
 * EMS (Energy Management System) 分配演算法
 * 從 ocppController.js 抽出的純函式，便於單元測試
 */

/**
 * 檢查充電樁是否正在充電
 * @param {string} status 充電樁狀態
 * @returns {boolean}
 */
function isCharging(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase();
  return statusLower.includes('charg') || statusLower.includes('inuse') || statusLower === 'charging';
}

/**
 * 計算 EMS 分配結果
 * @param {object} siteSetting - 場域設定 {ems_mode, max_power_kw}
 * @param {array} allGuns - 所有充電槍資料 [{cpid, acdc, max_kw, guns_status, connector, cpsn}, ...]
 * @param {array} onlineCpids - 在線充電樁 cpid 清單 (用於 dynamic 模式)
 * @returns {object} 分配結果 {allocations: [{cpid, unit, limit, allocated_kw, logs}], summary: {...}}
 */
function calculateEmsAllocation(siteSetting, allGuns, onlineCpids = []) {
  const { ems_mode, max_power_kw } = siteSetting;
  const maxPowerKw = parseFloat(max_power_kw);
  
  const allocations = [];
  const logs = [];
  
  // 分類充電槍
  const acGuns = allGuns.filter(g => g.acdc === 'AC');
  const dcGuns = allGuns.filter(g => g.acdc === 'DC');
  
  logs.push(`[EMS] 模式: ${ems_mode}, 場域限制: ${maxPowerKw}kW`);
  logs.push(`[EMS] 總槍數: AC=${acGuns.length}, DC=${dcGuns.length}`);
  
  if (ems_mode === 'static') {
    logs.push('[static模式] 不管樁有無上線，按場域總功率限制分配');
    
    // Static 模式：AC 先分配，DC 取剩餘
    const totalAcDemand = acGuns.reduce((sum, g) => sum + parseFloat(g.max_kw || 0), 0);
    const actualAcPower = Math.min(totalAcDemand, maxPowerKw);
    const availableDcPower = maxPowerKw - actualAcPower;
    
    logs.push(`[static] AC總需求: ${totalAcDemand}kW, AC實際分配: ${actualAcPower}kW`);
    logs.push(`[static] DC可用功率: ${availableDcPower}kW`);
    
    // 分配 AC 充電槍
    for (const gun of acGuns) {
      let allocatedPower, unit, limit;
      
      if (totalAcDemand <= maxPowerKw) {
        // AC總需求不超過場域限制，按樁規格分配
        allocatedPower = parseFloat(gun.max_kw || 0);
        unit = "A";
        limit = Math.floor((allocatedPower * 1000) / 220);
        logs.push(`[static-AC] ${gun.cpid} 按規格分配: ${limit}A (${allocatedPower}kW)`);
      } else {
        // AC總需求超過場域限制，按比例分配
        const ratio = maxPowerKw / totalAcDemand;
        allocatedPower = parseFloat(gun.max_kw || 0) * ratio;
        unit = "A";
        limit = Math.floor((allocatedPower * 1000) / 220);
        logs.push(`[static-AC] ${gun.cpid} 按比例分配: ${limit}A (${allocatedPower.toFixed(2)}kW, 比例:${ratio.toFixed(3)})`);
      }
      
      // 應用 AC 限制
      limit = applyAcLimits(gun, limit, logs);
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit,
        limit,
        allocated_kw: (limit * 220) / 1000, // 反推分配功率
        original_max_kw: parseFloat(gun.max_kw || 0)
      });
    }
    
    // 分配 DC 充電槍
    const dcPowerPerGun = dcGuns.length > 0 ? availableDcPower / dcGuns.length : 0;
    for (const gun of dcGuns) {
      const unit = "W";
      let limit = Math.floor(dcPowerPerGun * 1000); // 轉為瓦特
      
      // 應用 DC 限制
      limit = applyDcLimits(gun, limit, logs);
      
      logs.push(`[static-DC] ${gun.cpid} 設定瓦數: ${limit}W`);
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit,
        limit,
        allocated_kw: limit / 1000, // W 轉 kW
        original_max_kw: parseFloat(gun.max_kw || 0)
      });
    }
  }
  else if (ems_mode === 'dynamic') {
    logs.push('[dynamic模式] 依據正在充電的樁數量動態分配');
    
    // 在線充電槍
    const onlineAcGuns = acGuns.filter(g => onlineCpids.includes(g.cpsn));
    const onlineDcGuns = dcGuns.filter(g => onlineCpids.includes(g.cpsn));
    
    // 正在充電的槍
    const chargingAcGuns = onlineAcGuns.filter(g => isCharging(g.guns_status));
    const chargingDcGuns = onlineDcGuns.filter(g => isCharging(g.guns_status));
    
    const totalChargingGuns = chargingAcGuns.length + chargingDcGuns.length;
    logs.push(`[dynamic] 在線槍數: AC=${onlineAcGuns.length}, DC=${onlineDcGuns.length}`);
    logs.push(`[dynamic] 充電槍數: AC=${chargingAcGuns.length}, DC=${chargingDcGuns.length}, 總充電數=${totalChargingGuns}`);
    
    if (totalChargingGuns === 0) {
      // 回退到 static 模式
      logs.push('[dynamic->static] 沒有充電樁在充電，回退到靜態分配模式');
      return calculateEmsAllocation({ ems_mode: 'static', max_power_kw: maxPowerKw }, allGuns, onlineCpids);
    }
    
    // Dynamic 模式：只為充電中的槍分配功率
    logs.push(`[dynamic] 有 ${totalChargingGuns} 個充電樁在充電，使用動態分配`);
    
    // 計算充電中 AC 槍的需求與分配
    const totalChargingAcDemand = chargingAcGuns.reduce((sum, g) => sum + parseFloat(g.max_kw || 0), 0);
    const actualChargingAcPower = Math.min(totalChargingAcDemand, maxPowerKw);
    const availableDcPower = maxPowerKw - actualChargingAcPower;
    
    logs.push(`[dynamic] 充電AC總需求: ${totalChargingAcDemand}kW, AC實際分配: ${actualChargingAcPower}kW`);
    logs.push(`[dynamic] DC可用功率: ${availableDcPower}kW`);
    
    // 分配所有 AC 充電槍（包含非充電的）
    for (const gun of acGuns) {
      const currentGunCharging = isCharging(gun.guns_status);
      let allocatedPower, unit, limit;
      
      if (currentGunCharging) {
        // 正在充電的槍
        if (totalChargingAcDemand <= maxPowerKw) {
          // 充電AC總需求不超過場域限制，按樁規格分配
          allocatedPower = parseFloat(gun.max_kw || 0);
          unit = "A";
          limit = Math.floor((allocatedPower * 1000) / 220);
          logs.push(`[dynamic-AC] ${gun.cpid} 按規格分配: ${limit}A (${allocatedPower}kW)`);
        } else {
          // 充電AC總需求超過場域限制，按比例分配
          const ratio = maxPowerKw / totalChargingAcDemand;
          allocatedPower = parseFloat(gun.max_kw || 0) * ratio;
          unit = "A";
          limit = Math.floor((allocatedPower * 1000) / 220);
          logs.push(`[dynamic-AC] ${gun.cpid} 按比例分配: ${limit}A (${allocatedPower.toFixed(2)}kW, 比例:${ratio.toFixed(3)})`);
        }
      } else {
        // 非充電狀態，設為最小功率
        unit = "A";
        limit = 6; // AC充電樁最小電流
        allocatedPower = (limit * 220) / 1000;
        logs.push(`[dynamic-AC] ${gun.cpid} 非充電狀態，設為最小功率: ${limit}A`);
      }
      
      // 應用 AC 限制
      limit = applyAcLimits(gun, limit, logs);
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit,
        limit,
        allocated_kw: (limit * 220) / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0),
        charging: currentGunCharging
      });
    }
    
    // 分配所有 DC 充電槍
    const dcPowerPerGun = chargingDcGuns.length > 0 ? availableDcPower / chargingDcGuns.length : 0;
    for (const gun of dcGuns) {
      const currentGunCharging = isCharging(gun.guns_status);
      let unit, limit;
      
      if (currentGunCharging) {
        // 正在充電的 DC 槍
        unit = "W";
        limit = Math.floor(dcPowerPerGun * 1000);
        logs.push(`[dynamic-DC] ${gun.cpid} 設定瓦數: ${limit}W`);
      } else {
        // 非充電狀態，設為最小功率
        unit = "W";
        limit = 1000; // DC最小1kW
        logs.push(`[dynamic-DC] ${gun.cpid} 非充電狀態，設為最小功率: ${limit}W`);
      }
      
      // 應用 DC 限制
      limit = applyDcLimits(gun, limit, logs);
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit,
        limit,
        allocated_kw: limit / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0),
        charging: currentGunCharging
      });
    }
  }
  
  // 計算統計資訊
  const summary = {
    ems_mode,
    max_power_kw: maxPowerKw,
    total_guns: allGuns.length,
    ac_guns: acGuns.length,
    dc_guns: dcGuns.length,
    online_guns: onlineCpids.length,
    charging_guns: allocations.filter(a => a.charging).length,
    total_allocated_ac_kw: allocations.filter(a => a.acdc === 'AC').reduce((sum, a) => sum + a.allocated_kw, 0),
    total_allocated_dc_kw: allocations.filter(a => a.acdc === 'DC').reduce((sum, a) => sum + a.allocated_kw, 0)
  };
  
  logs.push(`[EMS結果] AC分配總功率: ${summary.total_allocated_ac_kw.toFixed(2)}kW`);
  logs.push(`[EMS結果] DC分配總功率: ${summary.total_allocated_dc_kw.toFixed(2)}kW`);
  logs.push(`[EMS結果] 總分配功率: ${(summary.total_allocated_ac_kw + summary.total_allocated_dc_kw).toFixed(2)}kW`);
  
  return {
    allocations,
    summary,
    logs
  };
}

/**
 * 應用 AC 充電槍限制
 * @param {object} gun 充電槍資料
 * @param {number} limit 計算出的電流限制
 * @param {array} logs 日誌陣列
 * @returns {number} 應用限制後的電流值
 */
function applyAcLimits(gun, limit, logs) {
  // AC充電樁最小不能低於6A
  if (limit < 6) {
    limit = 6;
    logs.push(`[警告] ${gun.cpid} AC充電樁電流過小，設為最小值: ${limit}A`);
  }
  
  // 針對11kW AC充電樁設定最大電流限制為48A
  if (parseFloat(gun.max_kw || 0) >= 11 && limit > 48) {
    limit = 48;
    logs.push(`[限制] ${gun.cpid} 11kW AC充電樁電流限制為最大值: ${limit}A`);
  }
  
  return limit;
}

/**
 * 應用 DC 充電槍限制
 * @param {object} gun 充電槍資料
 * @param {number} limit 計算出的功率限制
 * @param {array} logs 日誌陣列
 * @returns {number} 應用限制後的功率值
 */
function applyDcLimits(gun, limit, logs) {
  // DC充電樁只檢查是否為負值
  if (limit <= 0) {
    limit = 1000; // DC最小1kW
    logs.push(`[警告] ${gun.cpid} DC充電樁功率過小，設為最小值: ${limit}W`);
  }
  
  return limit;
}

module.exports = {
  calculateEmsAllocation,
  isCharging,
  applyAcLimits,
  applyDcLimits
};
