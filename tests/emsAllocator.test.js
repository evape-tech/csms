/**
 * EMS 分配演算法單元測試
 * 基於 docs/EMS_TEST_CASES.md 的測試案例
 */

const { calculateEmsAllocation, isCharging } = require('../src/lib/emsAllocator');

describe('EMS 分配演算法', () => {
  
  describe('isCharging 函式', () => {
    test('應該正確識別充電狀態', () => {
      expect(isCharging('Charging')).toBe(true);
      expect(isCharging('charging')).toBe(true);
      expect(isCharging('CHARGING')).toBe(true);
      expect(isCharging('InUse')).toBe(true);
      expect(isCharging('Available')).toBe(false);
      expect(isCharging('Unavailable')).toBe(false);
      expect(isCharging('')).toBe(false);
      expect(isCharging(null)).toBe(false);
    });
  });

  describe('Case 1 — 靜態（容量足夠）', () => {
    test('3台AC 7kW，場域50kW，應按規格分配', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 50 };
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      // 預期：21 <= 50，每台給予原始值 A = floor(7000/220) = 31A
      expect(result.allocations).toHaveLength(3);
      result.allocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(31); // floor(7000/220) = 31
        expect(allocation.allocated_kw).toBeCloseTo(6.82, 1); // (31 * 220) / 1000
      });
      
      expect(result.summary.ems_mode).toBe('static');
      expect(result.summary.max_power_kw).toBe(50);
      expect(result.summary.total_allocated_ac_kw).toBeCloseTo(20.46, 1); // 31*220/1000 * 3
    });
  });

  describe('Case 2 — 靜態（超載，比例縮放）', () => {
    test('3台AC 7kW，場域10kW，應按比例分配', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 10 };
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      // 預期：ratio = 10/21 ≈ 0.47619，allocated_kw ≈ 3.333kW，A = floor(3333/220) = 15A
      expect(result.allocations).toHaveLength(3);
      result.allocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(15); // floor(3333/220) = 15
        expect(allocation.allocated_kw).toBeCloseTo(3.3, 1); // (15 * 220) / 1000
      });
      
      expect(result.summary.total_allocated_ac_kw).toBeCloseTo(9.9, 1); // 15*220/1000 * 3，接近場域限制10kW
    });
  });

  describe('Case 3 — 動態（無槍在充電，回退 static）', () => {
    test('所有槍均非charging，應回退static行為', () => {
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 50 };
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      const onlineCpids = ['CP1', 'CP2', 'CP3'];
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      
      // 預期：回退static，分配結果與Case1相同
      expect(result.allocations).toHaveLength(3);
      result.allocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(31); // 與Case1相同
      });
      
      // 由於是遞歸調用，檢查日誌應該來自最終的static結果
      expect(result.summary.ems_mode).toBe('static'); // 確認模式被更改為static
    });
  });

  describe('Case 4 — 動態（部分槍在充電，需求 <= max）', () => {
    test('4台AC，2台charging，應給charging槍full spec，其餘最小值', () => {
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 20 };
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-CP-4', cpsn: 'CP4', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      const onlineCpids = ['CP1', 'CP2', 'CP3', 'CP4'];
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      
      expect(result.allocations).toHaveLength(4);
      
      // 檢查充電槍（CP1, CP2）：charging total = 14kW <= 20kW，應給full spec
      const chargingAllocations = result.allocations.filter(a => a.charging);
      expect(chargingAllocations).toHaveLength(2);
      chargingAllocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(31); // 7kW → 31A
      });
      
      // 檢查非充電槍（CP3, CP4）：應給最小值6A
      const nonChargingAllocations = result.allocations.filter(a => !a.charging);
      expect(nonChargingAllocations).toHaveLength(2);
      nonChargingAllocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(6); // 最小值
      });
    });
  });

  describe('Case 5 — 動態（charging 過載，charging 間比例分配）', () => {
    test('3台AC，2台charging，charging需求超載應比例分配', () => {
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 10 };
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-2', cpsn: 'CP2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-CP-3', cpsn: 'CP3', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      const onlineCpids = ['CP1', 'CP2', 'CP3'];
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      
      expect(result.allocations).toHaveLength(3);
      
      // 檢查充電槍：charging total = 14kW > 10kW，ratio = 10/14 ≈ 0.7143
      // allocated_kw_per_charging ≈ 5.0kW → A = floor(5000/220) = 22A
      const chargingAllocations = result.allocations.filter(a => a.charging);
      expect(chargingAllocations).toHaveLength(2);
      chargingAllocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(allocation.limit).toBe(22); // floor(5000/220) = 22
      });
      
      // 檢查非充電槍：6A
      const nonChargingAllocations = result.allocations.filter(a => !a.charging);
      expect(nonChargingAllocations).toHaveLength(1);
      expect(nonChargingAllocations[0].limit).toBe(6);
    });
  });

  describe('Case 6 — DC 分配（AC 優先，DC 取剩餘）', () => {
    test('3台DC各360kW，場域1080kW，純DC場域', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 1080 };
      const guns = [
        { cpid: 'TEST-DC-1', cpsn: 'DC1', connector: '1', acdc: 'DC', max_kw: 360, guns_status: 'Charging' },
        { cpid: 'TEST-DC-2', cpsn: 'DC2', connector: '1', acdc: 'DC', max_kw: 360, guns_status: 'Charging' },
        { cpid: 'TEST-DC-3', cpsn: 'DC3', connector: '1', acdc: 'DC', max_kw: 360, guns_status: 'Charging' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      // 預期：availableDcPower = 1080kW → per DC = 1080/3 = 360kW = 360000W
      expect(result.allocations).toHaveLength(3);
      result.allocations.forEach(allocation => {
        expect(allocation.unit).toBe('W');
        expect(allocation.limit).toBe(360000); // 360kW * 1000 = 360000W
        expect(allocation.allocated_kw).toBe(360);
      });
      
      expect(result.summary.total_allocated_dc_kw).toBe(1080); // 360 * 3
    });
  });

  describe('Case 7 — 11kW AC 上限截斷', () => {
    test('單台11kW AC，應截斷至48A上限', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 50 };
      const guns = [
        { cpid: 'TEST-11KW-1', cpsn: '11KW1', connector: '1', acdc: 'AC', max_kw: 11, guns_status: 'Charging' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      // 預期：原始A = floor(11000/220) = 50A，但系統上限48A
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].unit).toBe('A');
      expect(result.allocations[0].limit).toBe(48); // 截斷至48A
      expect(result.allocations[0].allocated_kw).toBeCloseTo(10.56, 1); // (48 * 220) / 1000
      
      // 檢查日誌包含上限訊息
      const logText = result.logs.join(' ');
      expect(logText).toContain('11kW AC充電樁電流限制為最大值');
    });
  });

  describe('Case 8 — 動態模式混合AC/DC分配', () => {
    test('動態模式：AC charging + DC charging，測試混合分配', () => {
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 100 };
      const guns = [
        { cpid: 'TEST-AC-1', cpsn: 'AC1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpid: 'TEST-AC-2', cpsn: 'AC2', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpid: 'TEST-DC-1', cpsn: 'DC1', connector: '1', acdc: 'DC', max_kw: 50, guns_status: 'Charging' },
        { cpid: 'TEST-DC-2', cpsn: 'DC2', connector: '1', acdc: 'DC', max_kw: 50, guns_status: 'Available' }
      ];
      const onlineCpids = ['AC1', 'AC2', 'DC1', 'DC2'];
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      
      expect(result.allocations).toHaveLength(4);
      
      // 檢查AC充電槍：給予full spec
      const acChargingAllocation = result.allocations.find(a => a.cpid === 'TEST-AC-1');
      expect(acChargingAllocation.limit).toBe(31); // 7kW full spec
      expect(acChargingAllocation.charging).toBe(true);
      
      // 檢查AC非充電槍：給予最小值
      const acNonChargingAllocation = result.allocations.find(a => a.cpid === 'TEST-AC-2');
      expect(acNonChargingAllocation.limit).toBe(6); // 最小值
      expect(acNonChargingAllocation.charging).toBe(false);
      
      // 檢查DC充電槍：剩餘功率分配
      const dcChargingAllocation = result.allocations.find(a => a.cpid === 'TEST-DC-1');
      expect(dcChargingAllocation.unit).toBe('W');
      expect(dcChargingAllocation.charging).toBe(true);
      expect(dcChargingAllocation.limit).toBeGreaterThan(1000); // 應該比最小值大
      
      // 檢查DC非充電槍：最小功率
      const dcNonChargingAllocation = result.allocations.find(a => a.cpid === 'TEST-DC-2');
      expect(dcNonChargingAllocation.limit).toBe(1000); // DC最小值
      expect(dcNonChargingAllocation.charging).toBe(false);
    });
  });

  describe('邊界條件測試', () => {
    test('AC最小值限制：分配值<6A應補正為6A', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 1 }; // 極小場域
      const guns = [
        { cpid: 'TEST-CP-1', cpsn: 'CP1', connector: '1', acdc: 'AC', max_kw: 7, guns_status: 'Available' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      expect(result.allocations[0].limit).toBe(6); // 最小值補正
      
      const logText = result.logs.join(' ');
      expect(logText).toContain('AC充電樁電流過小，設為最小值');
    });

    test('DC最小值限制：分配值<=0應補正為1000W', () => {
      const siteSetting = { ems_mode: 'static', max_power_kw: 0 }; // 場域功率為0
      const guns = [
        { cpid: 'TEST-DC-1', cpsn: 'DC1', connector: '1', acdc: 'DC', max_kw: 360, guns_status: 'Available' }
      ];
      
      const result = calculateEmsAllocation(siteSetting, guns);
      
      expect(result.allocations[0].limit).toBe(1000); // DC最小值1kW
      
      const logText = result.logs.join(' ');
      expect(logText).toContain('DC充電樁功率過小，設為最小值');
    });
  });

});
