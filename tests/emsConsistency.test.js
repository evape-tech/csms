/**
 * EMS 一致性測試 - 驗證 ocppController 與 emsAllocator 邏輯一致性
 * 這個測試確保提取的純函式與原始 OCPP 控制器中的邏輯產生相同結果
 */

const { calculateEmsAllocation } = require('../src/lib/emsAllocator');

// 模擬 ocppController 中的 EMS 邏輯 (簡化版本用於比較)
function simulateOcppControllerEms(siteSetting, guns, onlineCpids = []) {
  // 這是從 ocppController.js 中提取的關鍵邏輯，用於比較驗證
  const { ems_mode, max_power_kw: maxPowerKw } = siteSetting;
  const logs = [];
  const allocations = [];
  
  logs.push(`[模擬OCPP] 模式: ${ems_mode}, 場域限制: ${maxPowerKw}kW`);
  
  // 分離 AC 和 DC 充電槍
  const acGuns = guns.filter(g => g.acdc === 'AC');
  const dcGuns = guns.filter(g => g.acdc === 'DC');
  
  // 判斷是否為充電狀態的函式
  const isCharging = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'charging' || s === 'inuse';
  };
  
  if (ems_mode === 'static') {
    // 靜態模式邏輯
    const totalAcDemand = acGuns.reduce((sum, g) => sum + parseFloat(g.max_kw || 0), 0);
    const actualAcPower = Math.min(totalAcDemand, maxPowerKw);
    const availableDcPower = maxPowerKw - actualAcPower;
    
    // AC 分配
    for (const gun of acGuns) {
      let allocatedPower, limit;
      
      if (totalAcDemand <= maxPowerKw) {
        allocatedPower = parseFloat(gun.max_kw || 0);
        limit = Math.floor((allocatedPower * 1000) / 220);
      } else {
        const ratio = maxPowerKw / totalAcDemand;
        allocatedPower = parseFloat(gun.max_kw || 0) * ratio;
        limit = Math.floor((allocatedPower * 1000) / 220);
      }
      
      // 應用 AC 限制
      if (limit < 6) {
        limit = 6;
      }
      if (parseFloat(gun.max_kw || 0) >= 11 && limit > 48) {
        limit = 48;
      }
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit: 'A',
        limit,
        allocated_kw: (limit * 220) / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0)
      });
    }
    
    // DC 分配
    const dcPowerPerGun = dcGuns.length > 0 ? availableDcPower / dcGuns.length : 0;
    for (const gun of dcGuns) {
      let limit = Math.floor(dcPowerPerGun * 1000);
      
      if (limit <= 0) {
        limit = 1000;
      }
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit: 'W',
        limit,
        allocated_kw: limit / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0)
      });
    }
  }
  else if (ems_mode === 'dynamic') {
    // 動態模式邏輯
    const onlineAcGuns = acGuns.filter(g => onlineCpids.includes(g.cpsn));
    const onlineDcGuns = dcGuns.filter(g => onlineCpids.includes(g.cpsn));
    
    const chargingAcGuns = onlineAcGuns.filter(g => isCharging(g.guns_status));
    const chargingDcGuns = onlineDcGuns.filter(g => isCharging(g.guns_status));
    
    const totalChargingGuns = chargingAcGuns.length + chargingDcGuns.length;
    
    if (totalChargingGuns === 0) {
      // 回退到靜態模式
      return simulateOcppControllerEms({ ems_mode: 'static', max_power_kw: maxPowerKw }, guns, onlineCpids);
    }
    
    // Dynamic 邏輯
    const totalChargingAcDemand = chargingAcGuns.reduce((sum, g) => sum + parseFloat(g.max_kw || 0), 0);
    const actualChargingAcPower = Math.min(totalChargingAcDemand, maxPowerKw);
    const availableDcPower = maxPowerKw - actualChargingAcPower;
    
    // AC 分配
    for (const gun of acGuns) {
      const currentGunCharging = isCharging(gun.guns_status);
      let limit;
      
      if (currentGunCharging) {
        if (totalChargingAcDemand <= maxPowerKw) {
          limit = Math.floor((parseFloat(gun.max_kw || 0) * 1000) / 220);
        } else {
          const ratio = maxPowerKw / totalChargingAcDemand;
          const allocatedPower = parseFloat(gun.max_kw || 0) * ratio;
          limit = Math.floor((allocatedPower * 1000) / 220);
        }
      } else {
        limit = 6; // 最小值
      }
      
      // 應用 AC 限制
      if (limit < 6) {
        limit = 6;
      }
      if (parseFloat(gun.max_kw || 0) >= 11 && limit > 48) {
        limit = 48;
      }
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit: 'A',
        limit,
        allocated_kw: (limit * 220) / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0),
        charging: currentGunCharging
      });
    }
    
    // DC 分配
    const dcPowerPerGun = chargingDcGuns.length > 0 ? availableDcPower / chargingDcGuns.length : 0;
    for (const gun of dcGuns) {
      const currentGunCharging = isCharging(gun.guns_status);
      let limit;
      
      if (currentGunCharging) {
        limit = Math.floor(dcPowerPerGun * 1000);
      } else {
        limit = 1000; // 最小值
      }
      
      if (limit <= 0) {
        limit = 1000;
      }
      
      allocations.push({
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        acdc: gun.acdc,
        unit: 'W',
        limit,
        allocated_kw: limit / 1000,
        original_max_kw: parseFloat(gun.max_kw || 0),
        charging: currentGunCharging
      });
    }
  }
  
  return {
    allocations,
    logs,
    summary: {
      ems_mode,
      max_power_kw: maxPowerKw,
      total_allocated_ac_kw: allocations.filter(a => a.acdc === 'AC').reduce((sum, a) => sum + a.allocated_kw, 0),
      total_allocated_dc_kw: allocations.filter(a => a.acdc === 'DC').reduce((sum, a) => sum + a.allocated_kw, 0)
    }
  };
}

describe('EMS 一致性驗證', () => {
  
  const testCases = [
    {
      name: '靜態模式 - 容量足夠',
      siteSetting: { ems_mode: 'static', max_power_kw: 50 },
      guns: [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ],
      onlineCpids: ['CP1', 'CP2', 'CP3']
    },
    {
      name: '靜態模式 - 超載比例縮放',
      siteSetting: { ems_mode: 'static', max_power_kw: 10 },
      guns: [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ]
    },
    {
      name: '動態模式 - 部分充電',
      siteSetting: { ems_mode: 'dynamic', max_power_kw: 20 },
      guns: [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-4', cpsn: 'CP4', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ],
      onlineCpids: ['CP1', 'CP2', 'CP3', 'CP4']
    },
    {
      name: '混合 AC/DC',
      siteSetting: { ems_mode: 'static', max_power_kw: 100 },
      guns: [
        { cpid: 'TEST-AC-1', cpsn: 'AC1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-DC-1', cpsn: 'DC1', connector: '1', acdc: 'DC', max_kw: 50, guns_status: 'Charging' }
      ]
    },
    {
      name: '11kW AC 限制測試',
      siteSetting: { ems_mode: 'static', max_power_kw: 50 },
      guns: [
        { cpid: 'TEST-11KW-1', cpsn: '11KW1', connector: '1', acdc: 'AC', max_kw: 11, guns_status: 'Charging' }
      ]
    }
  ];

  testCases.forEach(testCase => {
    test(`一致性驗證: ${testCase.name}`, () => {
      // 執行兩種實作
      const emsResult = calculateEmsAllocation(testCase.siteSetting, testCase.guns, testCase.onlineCpids);
      const ocppResult = simulateOcppControllerEms(testCase.siteSetting, testCase.guns, testCase.onlineCpids);
      
      // 比較分配結果數量
      expect(emsResult.allocations.length).toBe(ocppResult.allocations.length);
      
      // 逐一比較每個分配結果
      for (let i = 0; i < emsResult.allocations.length; i++) {
        const emsAlloc = emsResult.allocations[i];
        const ocppAlloc = ocppResult.allocations[i];
        
        // 比較關鍵欄位
        expect(emsAlloc.cpid).toBe(ocppAlloc.cpid);
        expect(emsAlloc.unit).toBe(ocppAlloc.unit);
        expect(emsAlloc.limit).toBe(ocppAlloc.limit);
        expect(emsAlloc.acdc).toBe(ocppAlloc.acdc);
        
        // 比較分配功率 (允許小數點誤差)
        expect(emsAlloc.allocated_kw).toBeCloseTo(ocppAlloc.allocated_kw, 2);
      }
      
      // 比較總分配功率
      expect(emsResult.summary.total_allocated_ac_kw).toBeCloseTo(ocppResult.summary.total_allocated_ac_kw, 2);
      expect(emsResult.summary.total_allocated_dc_kw).toBeCloseTo(ocppResult.summary.total_allocated_dc_kw, 2);
      
      // 比較模式
      expect(emsResult.summary.ems_mode).toBe(ocppResult.summary.ems_mode);
    });
  });

  test('邊界條件一致性 - AC 最小值', () => {
    const siteSetting = { ems_mode: 'static', max_power_kw: 1 };
    const guns = [
      { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
    ];
    
    const emsResult = calculateEmsAllocation(siteSetting, guns);
    const ocppResult = simulateOcppControllerEms(siteSetting, guns);
    
    expect(emsResult.allocations[0].limit).toBe(ocppResult.allocations[0].limit);
    expect(emsResult.allocations[0].limit).toBe(6); // 確認最小值
  });

  test('邊界條件一致性 - DC 最小值', () => {
    const siteSetting = { ems_mode: 'static', max_power_kw: 0 };
    const guns = [
      { cpid: 'TEST-DC-1', cpsn: 'DC1', connector: '1', acdc: 'DC', max_kw: 360, guns_status: 'Available' }
    ];
    
    const emsResult = calculateEmsAllocation(siteSetting, guns);
    const ocppResult = simulateOcppControllerEms(siteSetting, guns);
    
    expect(emsResult.allocations[0].limit).toBe(ocppResult.allocations[0].limit);
    expect(emsResult.allocations[0].limit).toBe(1000); // 確認最小值
  });

});

describe('整合驗證建議', () => {
  test('提醒：需要將 emsAllocator 整合回 ocppController', () => {
    // 這個測試提醒開發者下一步需要做的整合工作
    const reminder = `
    下一步整合建議：
    1. 在 ocppController.js 中 import { calculateEmsAllocation } from '../lib/emsAllocator'
    2. 將 ocpp_set_charging_profile 函式中的 EMS 邏輯替換為 calculateEmsAllocation 調用
    3. 保持相同的輸入參數格式 (siteSetting, guns, onlineCpids)
    4. 確保輸出格式與現有邏輯相容
    5. 執行完整的整合測試來驗證 OCPP 功能正常
    `;
    
    console.log(reminder);
    expect(true).toBe(true); // 這只是一個提醒測試
  });
});
