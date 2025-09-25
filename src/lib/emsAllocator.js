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
 * 安全解析浮點數
 * @param {any} value 需要解析的值
 * @returns {number} 解析後的數值，異常時返回0
 */
function safeParseFloat(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
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
  const maxPowerKw = safeParseFloat(max_power_kw);
  
  const allocations = [];
  const logs = [];
  
  // 分類充電槍，並處理DC樁的共用功率邏輯
  const acGuns = allGuns.filter(g => g.acdc === 'AC');
  const dcGuns = allGuns.filter(g => g.acdc === 'DC');
  
  // 將DC槍按樁分組 (使用cpsn分組，同一個cpsn表示同一個物理樁)
  const dcStations = {};
  dcGuns.forEach(gun => {
    const stationId = gun.cpsn || gun.cpid; // 使用cpsn作為樁ID，如果沒有則用cpid
    if (!dcStations[stationId]) {
      dcStations[stationId] = {
        stationId,
        guns: [],
        maxPowerKw: 0
      };
    }
    dcStations[stationId].guns.push(gun);
    // DC樁的最大功率取第一支槍的規格 (假設同樁的槍規格相同)
    if (dcStations[stationId].maxPowerKw === 0) {
      dcStations[stationId].maxPowerKw = safeParseFloat(gun.max_kw);
    }
  });
  
  const dcStationsList = Object.values(dcStations);
  
  logs.push(`[EMS] 模式: ${ems_mode}, 場域限制: ${maxPowerKw}kW`);
  logs.push(`[EMS] 總槍數: AC=${acGuns.length}, DC=${dcGuns.length}`);
  logs.push(`[EMS] DC樁分組: ${dcStationsList.length}個DC樁, 平均每樁${(dcGuns.length/dcStationsList.length).toFixed(1)}支槍`);
  
  if (ems_mode === 'static') {
    logs.push('[static模式] 不管樁有無上線，按場域總功率限制分配');
    
    // Static 模式：AC 先分配，DC 取剩餘
    const totalAcDemand = acGuns.reduce((sum, g) => sum + safeParseFloat(g.max_kw), 0);
    const actualAcPower = Math.min(totalAcDemand, maxPowerKw);
    const availableDcPower = maxPowerKw - actualAcPower;
    
    logs.push(`[static] AC總需求: ${totalAcDemand}kW, AC實際分配: ${actualAcPower}kW`);
    logs.push(`[static] DC可用功率: ${availableDcPower}kW`);
    
    // 分配 AC 充電槍
    for (const gun of acGuns) {
      let allocatedPower, unit, limit;
      
      if (totalAcDemand <= maxPowerKw) {
        // AC總需求不超過場域限制，按樁規格分配
        allocatedPower = safeParseFloat(gun.max_kw);
        unit = "A";
        limit = Math.round((allocatedPower * 1000) / 220);
        logs.push(`[static-AC] ${gun.cpid} 按規格分配: ${limit}A (${allocatedPower}kW)`);
      } else {
        // AC總需求超過場域限制，按比例分配
        const ratio = maxPowerKw / totalAcDemand;
        allocatedPower = safeParseFloat(gun.max_kw) * ratio;
        unit = "A";
        limit = Math.round((allocatedPower * 1000) / 220);
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
        original_max_kw: safeParseFloat(gun.max_kw),
        charging: false // 靜態模式下設為false
      });
    }
    
    // 分配 DC 充電槍 (按樁分配，然後分配給槍)
    for (const dcStation of dcStationsList) {
      const stationPower = dcStationsList.length > 0 ? availableDcPower / dcStationsList.length : 0;
      logs.push(`[static-DC樁] ${dcStation.stationId} 樁分配功率: ${stationPower.toFixed(2)}kW (${dcStation.guns.length}支槍)`);
      
      // 樁內槍的功率分配：如果只有一支槍，全部給它；如果兩支槍，平均分配
      const powerPerGun = stationPower / dcStation.guns.length;
      
      for (const gun of dcStation.guns) {
        const unit = "W";
        let limit = Math.round(powerPerGun * 1000); // 轉為瓦特
        
        // 應用 DC 限制
        limit = applyDcLimits(gun, limit, logs);
        
        logs.push(`[static-DC] ${gun.cpid} (樁${dcStation.stationId}) 設定瓦數: ${limit}W (樁內${dcStation.guns.length}槍平分)`);
        
        allocations.push({
          cpid: gun.cpid,
          cpsn: gun.cpsn,
          connector: gun.connector,
          acdc: gun.acdc,
          unit,
          limit,
          allocated_kw: limit / 1000, // W 轉 kW
          original_max_kw: safeParseFloat(gun.max_kw),
          charging: false, // 靜態模式下設為false
          station_id: dcStation.stationId // 記錄所屬樁ID
        });
      }
    }
  }
  else if (ems_mode === 'dynamic') {
    logs.push('[dynamic模式] 依據正在充電的樁數量動態分配');
    
    // 在線充電槍 (使用cpid而非cpsn來匹配)
    const onlineAcGuns = acGuns.filter(g => onlineCpids.includes(g.cpid));
    const onlineDcGuns = dcGuns.filter(g => onlineCpids.includes(g.cpid));
    
    // 統計在線的DC樁 (一個樁可能有多支槍在線)
    const onlineDcStations = {};
    onlineDcGuns.forEach(gun => {
      const stationId = gun.cpsn || gun.cpid;
      if (!onlineDcStations[stationId]) {
        onlineDcStations[stationId] = {
          stationId,
          guns: dcStations[stationId].guns, // 該樁的所有槍
          onlineGuns: [],
          chargingGuns: []
        };
      }
      onlineDcStations[stationId].onlineGuns.push(gun);
      if (isCharging(gun.guns_status)) {
        onlineDcStations[stationId].chargingGuns.push(gun);
      }
    });
    
    const onlineDcStationsList = Object.values(onlineDcStations);
    
    // 正在充電的槍
    const chargingAcGuns = onlineAcGuns.filter(g => isCharging(g.guns_status));
    const chargingDcGuns = onlineDcGuns.filter(g => isCharging(g.guns_status));
    const chargingDcStations = onlineDcStationsList.filter(station => station.chargingGuns.length > 0);
    
    const totalChargingGuns = chargingAcGuns.length + chargingDcGuns.length;
    logs.push(`[dynamic] 在線槍數: AC=${onlineAcGuns.length}, DC=${onlineDcGuns.length}`);
    logs.push(`[dynamic] 在線DC樁數: ${onlineDcStationsList.length}, 充電中DC樁數: ${chargingDcStations.length}`);
    logs.push(`[dynamic] 充電槍數: AC=${chargingAcGuns.length}, DC=${chargingDcGuns.length}, 總充電數=${totalChargingGuns}`);
    
    if (totalChargingGuns === 0) {
      // 回退到 static 模式
      logs.push('[dynamic->static] 沒有充電樁在充電，回退到靜態分配模式');
      return calculateEmsAllocation({ ems_mode: 'static', max_power_kw: maxPowerKw }, allGuns, onlineCpids);
    }
    
    // Dynamic 模式：充電中的槍優先分配，待機槍最低功率
    logs.push(`[dynamic] 有 ${totalChargingGuns} 個充電樁在充電，使用動態分配`);
    
    // 第一步：所有在線槍都設置最小功率
    const allocatedPowers = {};
    let remainingPower = maxPowerKw;
    
    // 為所有在線槍分配最小功率
    [...onlineAcGuns, ...onlineDcGuns].forEach(gun => {
      const minPower = gun.acdc === 'AC' ? 1.32 : 1.0; // AC: 6A = 1.32kW, DC: 1kW
      allocatedPowers[gun.cpid] = minPower;
      remainingPower -= minPower;
      logs.push(`[dynamic-最小] ${gun.cpid} (${gun.acdc}) 分配最小功率: ${minPower}kW`);
    });
    
    logs.push(`[dynamic] 最小功率分配完成，剩餘功率: ${remainingPower.toFixed(2)}kW`);
    
    // 第二步：將剩餘功率分配給充電中的槍，按優先級：AC先於DC
    if (remainingPower > 0) {
      logs.push(`[dynamic] 開始第二步分配，剩餘功率: ${remainingPower.toFixed(2)}kW`);
      
      // 先給充電中的AC槍分配到滿額
      logs.push(`[dynamic] 充電中AC槍數量: ${chargingAcGuns.length}`);
      for (const gun of chargingAcGuns) {
        const maxGunPower = safeParseFloat(gun.max_kw);
        const currentPower = allocatedPowers[gun.cpid];
        const additionalNeeded = maxGunPower - currentPower;
        const additionalGiven = Math.min(additionalNeeded, remainingPower);
        
        logs.push(`[dynamic-AC分配前] ${gun.cpid}: 當前=${currentPower}kW, 需要額外=${additionalNeeded}kW, 剩餘=${remainingPower.toFixed(2)}kW`);
        
        allocatedPowers[gun.cpid] = currentPower + additionalGiven;
        remainingPower -= additionalGiven;
        
        logs.push(`[dynamic-AC] ${gun.cpid} 充電中，分配: ${allocatedPowers[gun.cpid].toFixed(2)}kW (需求:${maxGunPower}kW, 獲得額外:${additionalGiven.toFixed(2)}kW)`);
        logs.push(`[dynamic-AC分配後] 剩餘功率: ${remainingPower.toFixed(2)}kW`);
        
        if (remainingPower <= 0) break;
      }
      
      // 給充電中的DC樁分配剩餘功率 (按樁分配，樁內平分)
      if (remainingPower > 0 && chargingDcStations.length > 0) {
        logs.push(`[dynamic-DC樁開始] 剩餘功率: ${remainingPower.toFixed(2)}kW, 充電中DC樁數量: ${chargingDcStations.length}`);
        
        // 計算每個充電中的DC樁可以獲得的平均額外功率
        const dcPowerPerStation = remainingPower / chargingDcStations.length;
        logs.push(`[dynamic-DC樁] 每個DC樁平均可得: ${dcPowerPerStation.toFixed(2)}kW`);
        
        for (const dcStation of chargingDcStations) {
          // 樁的總功率限制 (取樁內第一支槍的規格)
          const stationMaxPower = safeParseFloat(dcStation.guns[0].max_kw);
          
          // 樁內充電槍平分樁的功率
          const chargingGunsCount = dcStation.chargingGuns.length;
          const currentStationPower = dcStation.chargingGuns.reduce((sum, gun) => sum + allocatedPowers[gun.cpid], 0);
          const additionalStationPower = Math.min(dcPowerPerStation, stationMaxPower - currentStationPower);
          const additionalPowerPerGun = additionalStationPower / chargingGunsCount;
          
          logs.push(`[dynamic-DC樁] 樁${dcStation.stationId}: ${chargingGunsCount}支槍充電中, 樁當前${currentStationPower.toFixed(2)}kW, 樁上限${stationMaxPower}kW`);
          logs.push(`[dynamic-DC樁] 樁${dcStation.stationId}: 可得額外${additionalStationPower.toFixed(2)}kW, 每槍${additionalPowerPerGun.toFixed(2)}kW`);
          
          for (const gun of dcStation.chargingGuns) {
            const currentPower = allocatedPowers[gun.cpid];
            const maxGunPower = safeParseFloat(gun.max_kw);
            const actualAdditional = Math.min(additionalPowerPerGun, maxGunPower - currentPower);
            
            allocatedPowers[gun.cpid] = currentPower + actualAdditional;
            remainingPower -= actualAdditional;
            
            logs.push(`[dynamic-DC槍] ${gun.cpid} (樁${dcStation.stationId}) 充電中，分配: ${allocatedPowers[gun.cpid].toFixed(2)}kW (單槍上限:${maxGunPower}kW, 額外:${actualAdditional.toFixed(2)}kW)`);
          }
          
          logs.push(`[dynamic-DC樁分配後] 剩餘功率: ${remainingPower.toFixed(2)}kW`);
        }
        
        logs.push(`[dynamic-DC樁] 充電中DC樁分配完成，剩餘功率: ${remainingPower.toFixed(2)}kW`);
      }
      
      // 第三步：待機槍維持最低功率（動態模式的核心原則）
      logs.push(`[dynamic-待機] 待機槍維持最低功率，不分配額外功率`);
      logs.push(`[dynamic] 最終剩餘功率: ${remainingPower.toFixed(2)}kW 不分配（動態模式節能原則）`);
    }
    
    logs.push(`[dynamic] 分配完成，最終剩餘功率: ${remainingPower.toFixed(2)}kW`);
    
    // 第四步：根據分配的功率生成allocations (處理所有槍)
    for (const gun of acGuns) {
      const currentGunCharging = isCharging(gun.guns_status) && onlineCpids.includes(gun.cpid);
      const isOnline = onlineCpids.includes(gun.cpid);
      const allocatedPower = isOnline ? (allocatedPowers[gun.cpid] || 1.32) : 1.32; // 離線槍給最低功率
      
      const unit = "A";
      let limit = Math.round((allocatedPower * 1000) / 220);
      
      const status = currentGunCharging ? '充電中' : (isOnline ? '待機' : '離線');
      logs.push(`[dynamic-AC] ${gun.cpid} ${status}，分配: ${limit}A (${allocatedPower.toFixed(2)}kW)`);
      
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
        original_max_kw: safeParseFloat(gun.max_kw),
        charging: currentGunCharging
      });
    }
    
    for (const gun of dcGuns) {
      const currentGunCharging = isCharging(gun.guns_status) && onlineCpids.includes(gun.cpid);
      const isOnline = onlineCpids.includes(gun.cpid);
      const allocatedPower = isOnline ? (allocatedPowers[gun.cpid] || 1.0) : 1.0; // 離線槍給最低功率
      const stationId = gun.cpsn || gun.cpid; // 槍所屬的樁ID
      
      const unit = "W";
      let limit = Math.round(allocatedPower * 1000);
      
      const status = currentGunCharging ? '充電中' : (isOnline ? '待機' : '離線');
      logs.push(`[dynamic-DC] ${gun.cpid} (樁${stationId}) ${status}，分配: ${limit}W (${allocatedPower.toFixed(2)}kW)`);
      
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
        original_max_kw: safeParseFloat(gun.max_kw),
        charging: currentGunCharging,
        station_id: stationId // 記錄所屬樁ID
      });
    }
  }
  
  // 計算初始統計資訊
  let totalAllocatedPower = allocations.reduce((sum, a) => sum + a.allocated_kw, 0);
  
  // 場域限制檢查和智能調整
  if (totalAllocatedPower > maxPowerKw) {
    logs.push(`[警告] 總分配功率 ${totalAllocatedPower.toFixed(2)}kW 超過場域限制 ${maxPowerKw}kW，進行智能調整`);
    
    // 分離AC和DC分配
    const acAllocations = allocations.filter(a => a.acdc === 'AC');
    const dcAllocations = allocations.filter(a => a.acdc === 'DC');
    
    // 計算最低保證需求
    const acMinTotal = acAllocations.length * 1.32; // 6A = 1.32kW
    const dcMinTotal = dcAllocations.length * 1.0;   // 1kW最低
    const totalMinRequired = acMinTotal + dcMinTotal;
    
    logs.push(`[調整] 最低保證需求: AC=${acMinTotal.toFixed(2)}kW, DC=${dcMinTotal.toFixed(2)}kW, 總計=${totalMinRequired.toFixed(2)}kW`);
    
    if (totalMinRequired <= maxPowerKw) {
      // 可分配的剩餘功率
      const availablePower = maxPowerKw - totalMinRequired;
      logs.push(`[調整] 可分配剩餘功率: ${availablePower.toFixed(2)}kW`);
      
      // 重新分配策略：先AC後DC，按比例分配剩餘功率
      const chargingAllocations = allocations.filter(a => a.charging);
      
      // 1. 先給所有樁最低保證
      allocations.forEach(allocation => {
        const minPower = allocation.acdc === 'AC' ? 1.32 : 1.0;
        const minLimit = allocation.acdc === 'AC' ? 6 : 1000;
        
        allocation.allocated_kw = minPower;
        allocation.limit = minLimit;
      });
      
      // 2. 計算所有槍的額外需求
      let remainingPower = availablePower;
      
      if (ems_mode === 'dynamic' && chargingAllocations.length > 0) {
        // 動態模式：優先滿足AC充電槍需求，剩餘功率全部給DC充電槍
        logs.push(`[動態調整] 總共 ${chargingAllocations.length} 支充電槍需要額外功率分配`);
        
        // 先滿足AC充電槍的需求
        const acChargingAllocations = chargingAllocations.filter(a => a.acdc === 'AC');
        const dcChargingAllocations = chargingAllocations.filter(a => a.acdc === 'DC');
        
        logs.push(`[動態調整] AC充電槍: ${acChargingAllocations.length}支, DC充電槍: ${dcChargingAllocations.length}支`);
        
        // AC充電槍優先滿足到規格上限
        acChargingAllocations.forEach(allocation => {
          const minPower = 1.32;
          const maxPossible = allocation.original_max_kw;
          const additionalNeeded = maxPossible - minPower;
          const additionalGiven = Math.min(additionalNeeded, remainingPower);
          
          if (additionalGiven > 0.01) {
            allocation.allocated_kw = minPower + additionalGiven;
            allocation.limit = Math.round(allocation.allocated_kw / 0.22 * 10) / 10;
            allocation.limit = Math.max(6, Math.min(allocation.limit, 48));
            remainingPower -= additionalGiven;
            
            logs.push(`[動態調整-AC] ${allocation.cpid} 分配: ${allocation.allocated_kw.toFixed(2)}kW (額外:${additionalGiven.toFixed(2)}kW)`);
          }
        });
        
        // DC充電槍獲得所有剩餘功率
        if (remainingPower > 0 && dcChargingAllocations.length > 0) {
          const powerPerDcGun = remainingPower / dcChargingAllocations.length;
          logs.push(`[動態調整-DC] 剩餘功率 ${remainingPower.toFixed(2)}kW 分配給 ${dcChargingAllocations.length}支DC槍，每支: ${powerPerDcGun.toFixed(2)}kW`);
          
          dcChargingAllocations.forEach(allocation => {
            const minPower = 1.0;
            const maxPossible = allocation.original_max_kw;
            const additionalPower = Math.min(powerPerDcGun, maxPossible - minPower);
            
            if (additionalPower > 0.01) {
              allocation.allocated_kw = minPower + additionalPower;
              allocation.limit = Math.round(allocation.allocated_kw * 1000);
              remainingPower -= additionalPower;
              
              logs.push(`[動態調整-DC] ${allocation.cpid} 分配: ${allocation.allocated_kw.toFixed(2)}kW (額外:${additionalPower.toFixed(2)}kW)`);
            }
          });
        }
        
        logs.push(`[動態模式] 非充電槍維持最低功率，剩餘功率: ${remainingPower.toFixed(2)}kW`);
      } else {
        // 靜態模式：AC優先，再分配DC，最大化場域使用率
        const acAllocations = allocations.filter(a => a.acdc === 'AC');
        const dcAllocations = allocations.filter(a => a.acdc === 'DC');
        
        // 先分配AC槍的剩餘需求
        const acExtraDemand = acAllocations.reduce((sum, a) => {
          return sum + Math.max(0, a.original_max_kw - 1.32);
        }, 0);
        
        if (remainingPower > 0 && acExtraDemand > 0) {
          const acAllocatedExtra = Math.min(remainingPower, acExtraDemand);
          logs.push(`[靜態調整] AC槍額外分配: ${acAllocatedExtra.toFixed(2)}kW / ${acExtraDemand.toFixed(2)}kW`);
          
          acAllocations.forEach(allocation => {
            const maxExtra = allocation.original_max_kw - 1.32;
            const extraAllocated = maxExtra * (acAllocatedExtra / acExtraDemand);
            
            if (extraAllocated > 0.01) {
              allocation.allocated_kw += extraAllocated;
              allocation.limit = Math.round(allocation.allocated_kw / 0.22 * 10) / 10;
              allocation.limit = Math.max(6, Math.min(allocation.limit, 48));
            }
          });
          
          remainingPower -= acAllocatedExtra;
        }
        
        // 再分配DC槍的剩餘需求
        const dcExtraDemand = dcAllocations.reduce((sum, a) => {
          return sum + Math.max(0, a.original_max_kw - 1.0);
        }, 0);
        
        if (remainingPower > 0 && dcExtraDemand > 0) {
          const dcAllocatedExtra = Math.min(remainingPower, dcExtraDemand);
          logs.push(`[靜態調整] DC槍額外分配: ${dcAllocatedExtra.toFixed(2)}kW / ${dcExtraDemand.toFixed(2)}kW`);
          
          dcAllocations.forEach(allocation => {
            const maxExtra = allocation.original_max_kw - 1.0;
            const extraAllocated = maxExtra * (dcAllocatedExtra / dcExtraDemand);
            
            if (extraAllocated > 0.01) {
              allocation.allocated_kw += extraAllocated;
              allocation.limit = Math.round(allocation.allocated_kw * 1000);
              allocation.limit = Math.max(1000, allocation.limit);
            }
          });
          
          remainingPower -= dcAllocatedExtra;
        }
        
        logs.push(`[靜態模式] 最大化使用率完成，剩餘功率: ${remainingPower.toFixed(2)}kW`);
      }
      
      // 重新計算總功率
      totalAllocatedPower = allocations.reduce((sum, a) => sum + a.allocated_kw, 0);
      logs.push(`[調整完成] 調整後總功率: ${totalAllocatedPower.toFixed(2)}kW (限制: ${maxPowerKw}kW)`);
    } else {
      logs.push(`[錯誤] 最低保證需求 ${totalMinRequired.toFixed(2)}kW 超過場域限制 ${maxPowerKw}kW，需要減少充電樁數量`);
    }
  }
  
  // 計算最終統計資訊
  const summary = {
    ems_mode,
    mode: ems_mode, // 添加mode字段
    max_power_kw: maxPowerKw,
    total_guns: allGuns.length,
    ac_guns: acGuns.length,
    dc_guns: dcGuns.length,
    online_guns: onlineCpids.length,
    charging_guns: allocations.filter(a => a.charging).length,
    total_allocated_ac_kw: allocations.filter(a => a.acdc === 'AC').reduce((sum, a) => sum + a.allocated_kw, 0),
    total_allocated_dc_kw: allocations.filter(a => a.acdc === 'DC').reduce((sum, a) => sum + a.allocated_kw, 0),
    total_allocated_kw: totalAllocatedPower,
    within_limit: totalAllocatedPower <= maxPowerKw + 0.01,
    power_adjusted: totalAllocatedPower <= maxPowerKw + 0.01 && allocations.some(a => a.allocated_kw !== a.original_max_kw)
  };
  
  logs.push(`[EMS結果] AC分配總功率: ${summary.total_allocated_ac_kw.toFixed(2)}kW`);
  logs.push(`[EMS結果] DC分配總功率: ${summary.total_allocated_dc_kw.toFixed(2)}kW`);
  logs.push(`[EMS結果] 總分配功率: ${summary.total_allocated_kw.toFixed(2)}kW`);
  logs.push(`[EMS結果] 場域限制檢查: ${summary.within_limit ? '✅ 通過' : '❌ 超限'}`);
  
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
  if (safeParseFloat(gun.max_kw) >= 11 && limit > 48) {
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
  // DC充電樁最小不能低於1kW
  if (limit < 1000) {
    limit = 1000; // DC最小1kW
    logs.push(`[警告] ${gun.cpid} DC充電樁功率過小，設為最小值: ${limit}W`);
  }
  
  // DC充電樁不能超過規格功率
  const maxPowerW = safeParseFloat(gun.max_kw) * 1000;
  if (limit > maxPowerW) {
    limit = maxPowerW;
    logs.push(`[限制] ${gun.cpid} DC充電樁功率超過規格，限制為最大值: ${limit}W (規格:${gun.max_kw}kW)`);
  }
  
  return limit;
}

module.exports = {
  calculateEmsAllocation,
  isCharging,
  applyAcLimits,
  applyDcLimits,
  safeParseFloat
};
